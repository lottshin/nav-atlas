import { NextResponse } from "next/server";

import { cleanupFaviconCache } from "@/lib/favicon-cache";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const configuredSecret = process.env.JOB_RUNNER_SECRET?.trim();

  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerValue = request.headers.get("x-job-runner-secret")?.trim();
  const bearerValue = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return headerValue === configuredSecret || bearerValue === configuredSecret;
}

async function handleCleanup(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized cleanup invocation."
      },
      { status: 401 }
    );
  }

  const summary = await cleanupFaviconCache();

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    summary
  });
}

export async function GET(request: Request) {
  return handleCleanup(request);
}

export async function POST(request: Request) {
  return handleCleanup(request);
}
