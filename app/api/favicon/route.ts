import { NextResponse } from "next/server";

import { resolveCachedFavicon, warmCachedFavicon } from "@/lib/favicon-cache";
import { getStorageMode } from "@/lib/env";
import { getMetadataMapForLinks, refreshLinkMetadata } from "@/lib/metadata";
import { rememberPreferredFaviconSource } from "@/lib/favicon-preferences";
import { listKnownFaviconSourcesForLink, resolveKnownFaviconSource } from "@/lib/favicon-route";

export const runtime = "nodejs";
const FILE_METADATA_RETRY_WINDOW_MS = 12 * 60 * 60 * 1000;

function buildCacheControl(stale: boolean) {
  if (stale) {
    return "public, max-age=3600, stale-while-revalidate=86400";
  }

  return "public, max-age=2592000, stale-while-revalidate=86400";
}

async function tryRefreshFileModeMetadata(linkId: string, candidate: number, currentSource: string) {
  if (getStorageMode() !== "file" || candidate !== 0) {
    return null;
  }

  const metadata = (await getMetadataMapForLinks([linkId])).get(linkId) ?? null;
  const lastFetchedAt = Date.parse(metadata?.lastFetchedAt ?? "");
  const shouldAttemptRefresh =
    !metadata ||
    metadata.fetchStatus === "idle" ||
    (metadata.fetchStatus === "error" && (!Number.isFinite(lastFetchedAt) || Date.now() - lastFetchedAt > FILE_METADATA_RETRY_WINDOW_MS));

  if (!shouldAttemptRefresh) {
    return null;
  }

  try {
    await refreshLinkMetadata(linkId);
  } catch {
    return null;
  }

  const refreshedSource = await resolveKnownFaviconSource(linkId, candidate);
  if (!refreshedSource || refreshedSource === currentSource) {
    return null;
  }

  return {
    source: refreshedSource,
    result: await resolveCachedFavicon(refreshedSource)
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get("linkId")?.trim() ?? "";
  const sourceParam = searchParams.get("source")?.trim() ?? "";
  const candidate = Number.parseInt(searchParams.get("candidate") ?? "", 10);

  if (!sourceParam && (!linkId || !Number.isInteger(candidate) || candidate < 0)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing favicon selector."
      },
      { status: 400 }
    );
  }

  const source = sourceParam || (await resolveKnownFaviconSource(linkId, candidate));
  if (!source) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unknown favicon source."
      },
      { status: 404 }
    );
  }

  const result = await resolveCachedFavicon(source);
  const refreshed = !sourceParam && result.kind !== "hit" ? await tryRefreshFileModeMetadata(linkId, candidate, source) : null;
  const finalSource = refreshed?.source ?? source;
  const finalResult = refreshed?.result ?? result;

  if (finalResult.kind !== "hit") {
    return NextResponse.json(
      {
        ok: false,
        message: finalResult.error || "Favicon not available."
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "public, max-age=3600"
        }
      }
    );
  }

  const payload = new Uint8Array(finalResult.body.byteLength);
  payload.set(finalResult.body);
  if (linkId) {
    void rememberPreferredFaviconSource(linkId, finalSource);
  }

  return new NextResponse(payload, {
    status: 200,
    headers: {
      "Content-Type": finalResult.contentType,
      "Cache-Control": buildCacheControl(finalResult.stale),
      "X-Favicon-Cache": finalResult.stale ? "stale-hit" : refreshed ? "refreshed-hit" : "hit"
    }
  });
}

export async function POST(request: Request) {
  let body: { linkId?: string; candidate?: number; source?: string } | null = null;

  try {
    body = (await request.json()) as { linkId?: string; candidate?: number; source?: string };
  } catch {
    body = null;
  }

  const linkId = typeof body?.linkId === "string" ? body.linkId.trim() : "";
  const candidate = typeof body?.candidate === "number" ? Math.trunc(body.candidate) : -1;
  const requestedSource = typeof body?.source === "string" ? body.source.trim() : "";

  if (!linkId || candidate < 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing favicon selector."
      },
      { status: 400 }
    );
  }

  let source = await resolveKnownFaviconSource(linkId, candidate);
  if (requestedSource) {
    const knownSources = await listKnownFaviconSourcesForLink(linkId);
    if (knownSources.includes(requestedSource)) {
      source = requestedSource;
    }
  }

  if (getStorageMode() === "file" && candidate === 0) {
    try {
      await refreshLinkMetadata(linkId);
      if (!requestedSource) {
        source = (await resolveKnownFaviconSource(linkId, candidate)) ?? source;
      }
    } catch {
      // Ignore warm refresh failures and fall back to the current source.
    }
  }

  if (!source) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unknown favicon source."
      },
      { status: 404 }
    );
  }

  const result = await warmCachedFavicon(source);
  if (result.kind === "hit") {
    void rememberPreferredFaviconSource(linkId, source);
  }

  return NextResponse.json(
    {
      ok: result.kind === "hit",
      stale: result.kind === "hit" ? result.stale : false,
      message: result.kind === "hit" ? "Favicon warmed." : result.error || "Warm attempt skipped."
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
