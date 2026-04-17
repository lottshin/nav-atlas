import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { JobRecord, JobStatus, JobSummary, JobType, ReindexJobPayload } from "@/lib/types";
import { requireAdvancedDirectory } from "@/lib/feature-guard";

type EnqueueJobOptions = {
  payload: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  availableAt?: Date;
};

function asJobType(value: string): JobType {
  if (value === "HEALTH_CHECK" || value === "METADATA_REFRESH") {
    return value;
  }

  return "SEARCH_REINDEX";
}

function asJobStatus(value: string): JobStatus {
  if (value === "running" || value === "succeeded" || value === "failed" || value === "cancelled") {
    return value;
  }

  return "queued";
}

function serializeJob(job: {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  availableAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}): JobRecord {
  return {
    id: job.id,
    type: asJobType(job.type),
    status: asJobStatus(job.status),
    payload: typeof job.payload === "object" && job.payload ? (job.payload as Record<string, unknown>) : {},
    priority: job.priority,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    lastError: job.lastError,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

export async function enqueueJob(type: JobType, options: EnqueueJobOptions) {
  requireAdvancedDirectory("Task queue");

  const job = await prisma.job.create({
    data: {
      type,
      status: "queued",
      payload: options.payload as Prisma.InputJsonValue,
      priority: options.priority ?? 0,
      maxAttempts: options.maxAttempts ?? 3,
      availableAt: options.availableAt ?? new Date()
    }
  });

  return serializeJob(job);
}

export async function enqueueSearchReindex(payload: ReindexJobPayload, priority = 2) {
  return enqueueJob("SEARCH_REINDEX", {
    payload,
    priority
  });
}

export async function listJobs(limit = 24) {
  if (!process.env.NAV_STORAGE_MODE || process.env.NAV_STORAGE_MODE !== "database") {
    return [] as JobRecord[];
  }

  const jobs = await prisma.job.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: limit
  });

  return jobs.map(serializeJob);
}

export async function getJobSummary(): Promise<JobSummary> {
  if (!process.env.NAV_STORAGE_MODE || process.env.NAV_STORAGE_MODE !== "database") {
    return {
      queued: 0,
      running: 0,
      failed: 0,
      succeeded: 0
    };
  }

  const grouped = await prisma.job.groupBy({
    by: ["status"],
    _count: { _all: true }
  });

  const counts = new Map(grouped.map((item) => [item.status, item._count._all]));

  return {
    queued: counts.get("queued") ?? 0,
    running: counts.get("running") ?? 0,
    failed: counts.get("failed") ?? 0,
    succeeded: counts.get("succeeded") ?? 0
  };
}

export async function retryJob(id: string) {
  requireAdvancedDirectory("Task queue");

  await prisma.job.update({
    where: { id },
    data: {
      status: "queued",
      availableAt: new Date(),
      startedAt: null,
      finishedAt: null,
      lastError: null
    }
  });
}

export async function cancelJob(id: string) {
  requireAdvancedDirectory("Task queue");

  await prisma.job.update({
    where: { id },
    data: {
      status: "cancelled",
      finishedAt: new Date()
    }
  });
}
