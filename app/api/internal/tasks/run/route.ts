import { NextResponse } from "next/server";

import { getStorageMode, getTaskRunnerBatchLimit } from "@/lib/env";
import { runPendingJobs } from "@/lib/job-runner";

function isAuthorized(request: Request) {
  const configuredSecret = process.env.JOB_RUNNER_SECRET?.trim();

  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerValue = request.headers.get("x-job-runner-secret")?.trim();
  const bearerValue = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return headerValue === configuredSecret || bearerValue === configuredSecret;
}

async function handleRun(request: Request) {
  if (getStorageMode() !== "database") {
    return NextResponse.json(
      {
        ok: false,
        message: "Task runner is only available in database mode."
      },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized runner invocation."
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.trunc(parsedLimit), 24) : getTaskRunnerBatchLimit();
  const summary = await runPendingJobs(limit);

  return NextResponse.json({
    ok: true,
    limit,
    attemptedAt: new Date().toISOString(),
    summary
  });
}

export async function GET(request: Request) {
  return handleRun(request);
}

export async function POST(request: Request) {
  return handleRun(request);
}
