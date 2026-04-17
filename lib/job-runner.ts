import "server-only";

import { prisma } from "@/lib/prisma";
import { getTaskRunnerBatchLimit, getTaskRunnerRetryBackoffMs } from "@/lib/env";
import { runLinkHealthCheck } from "@/lib/health";
import { refreshLinkMetadata } from "@/lib/metadata";
import { getLinkRecords, recordLinkHealthCheck } from "@/lib/repository";
import { rebuildSearchDocuments } from "@/lib/search-index";
import { getPublicDirectoryCatalog } from "@/lib/search";
import { requireAdvancedDirectory } from "@/lib/feature-guard";
import type { ReindexJobPayload } from "@/lib/types";

type JobRunSummary = {
  attempted: number;
  succeeded: number;
  failed: number;
};

const JOB_RUNNER_CONCURRENCY = 3;

function parseLinkIdPayload(payload: unknown) {
  if (typeof payload !== "object" || !payload) {
    return [];
  }

  const value = (payload as Record<string, unknown>).linkIds ?? (payload as Record<string, unknown>).linkId;
  if (typeof value === "string") {
    return [value];
  }

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function parseReindexPayload(payload: unknown): ReindexJobPayload {
  if (typeof payload !== "object" || !payload) {
    return { scope: "full" };
  }

  const scope = (payload as Record<string, unknown>).scope;
  if (scope === "links") {
    const linkIds = parseLinkIdPayload(payload);
    return {
      scope,
      linkIds
    };
  }

  return { scope: "full" };
}

async function runHealthCheckJob(payload: unknown) {
  const ids = parseLinkIdPayload(payload);
  const links = ids.length ? (await getLinkRecords()).filter((link) => ids.includes(link.id)) : [];

  for (const link of links) {
    const result = await runLinkHealthCheck(link);
    await recordLinkHealthCheck(link.id, result);
  }
}

async function runMetadataJob(payload: unknown) {
  const ids = parseLinkIdPayload(payload);
  for (const linkId of ids) {
    await refreshLinkMetadata(linkId);
  }
}

async function runReindexJob(payload: unknown) {
  const parsed = parseReindexPayload(payload);
  const catalog = await getPublicDirectoryCatalog();

  if (parsed.scope === "links") {
    await rebuildSearchDocuments({
      catalog,
      linkIds: parsed.linkIds
    });
    return;
  }

  await rebuildSearchDocuments({
    catalog
  });
}

async function executeJob(job: { id: string; type: string; payload: unknown; attemptCount: number; maxAttempts: number }) {
  try {
    if (job.type === "HEALTH_CHECK") {
      await runHealthCheckJob(job.payload);
    } else if (job.type === "METADATA_REFRESH") {
      await runMetadataJob(job.payload);
      } else {
        await runReindexJob(job.payload);
      }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        lastError: null
      }
    });

    return "succeeded" as const;
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "Job execution failed";
    const hasAttemptsLeft = job.attemptCount < job.maxAttempts;

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: hasAttemptsLeft ? "queued" : "failed",
        availableAt: hasAttemptsLeft ? new Date(Date.now() + getTaskRunnerRetryBackoffMs()) : new Date(),
        finishedAt: hasAttemptsLeft ? null : new Date(),
        lastError
      }
    });

    return "failed" as const;
  }
}

async function claimJob(id: string) {
  const claimed = await prisma.job.updateMany({
    where: {
      id,
      status: "queued"
    },
    data: {
      status: "running",
      startedAt: new Date(),
      attemptCount: { increment: 1 }
    }
  });

  if (!claimed.count) {
    return null;
  }

  return prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      payload: true,
      attemptCount: true,
      maxAttempts: true
    }
  });
}

export async function runPendingJobs(limit = getTaskRunnerBatchLimit()): Promise<JobRunSummary> {
  requireAdvancedDirectory("Task runner");

  const jobs = await prisma.job.findMany({
    where: {
      status: "queued",
      availableAt: { lte: new Date() }
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: limit
  });

  let succeeded = 0;
  let failed = 0;

  for (let index = 0; index < jobs.length; index += JOB_RUNNER_CONCURRENCY) {
    const batch = jobs.slice(index, index + JOB_RUNNER_CONCURRENCY);
    const claimedJobs = (await Promise.all(batch.map((job) => claimJob(job.id)))).filter(
      (item): item is NonNullable<Awaited<ReturnType<typeof claimJob>>> => Boolean(item)
    );

    const results = await Promise.all(claimedJobs.map((job) => executeJob(job)));

    for (const outcome of results) {
      if (outcome === "succeeded") {
        succeeded += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    attempted: jobs.length,
    succeeded,
    failed
  };
}
