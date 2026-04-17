import "server-only";

import type { LinkCheckState, LinkRecord, LinkStatus } from "@/lib/types";
import { getFaviconFallback, nowIso } from "@/lib/utils";

export type HealthCheckResult = {
  checkedAt: string;
  httpStatus: number | null;
  faviconStatus: LinkCheckState;
  titleStatus: LinkCheckState;
  status: LinkStatus;
  note: string | null;
  faviconUrl: string | null;
};

export const HEALTH_CHECK_CONCURRENCY = 4;
export const HEALTH_CHECK_REQUEST_LIMIT = 8;
export const HEALTH_STALE_DAYS = 7;
export const HEALTH_STALE_WINDOW_MS = HEALTH_STALE_DAYS * 24 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 8000;

function createAbortSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
    }
  };
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

function resolveLinkStatus(httpStatus: number | null, faviconStatus: LinkCheckState, titleStatus: LinkCheckState): LinkStatus {
  if (httpStatus === null || httpStatus >= 400) {
    return "broken";
  }

  if (faviconStatus === "error" || titleStatus === "error") {
    return "warning";
  }

  return "healthy";
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const { signal, cleanup } = createAbortSignal(REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init?.headers ?? {})
      }
    });
  } finally {
    cleanup();
  }
}

async function checkMainPage(url: string) {
  const response = await fetchWithTimeout(url);
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    return {
      httpStatus: response.status,
      titleStatus: "error" as const,
      note: `Main request returned HTTP ${response.status}`
    };
  }

  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    return {
      httpStatus: response.status,
      titleStatus: "idle" as const,
      note: null
    };
  }

  const html = await response.text();
  const title = extractTitle(html);

  return {
    httpStatus: response.status,
    titleStatus: title ? ("ok" as const) : ("error" as const),
    note: title ? null : "Title tag missing from response"
  };
}

async function checkFavicon(url: string, preferredFaviconUrl: string | null) {
  const faviconUrl = preferredFaviconUrl || getFaviconFallback(url);
  if (!faviconUrl) {
    return {
      faviconUrl: null,
      faviconStatus: "error" as const,
      note: "Unable to derive favicon URL"
    };
  }

  try {
    const response = await fetchWithTimeout(faviconUrl, {
      method: "HEAD",
      headers: {
        Accept: "image/*,*/*;q=0.8"
      }
    });

    if (response.ok) {
      return {
        faviconUrl,
        faviconStatus: "ok" as const,
        note: null
      };
    }
  } catch {
    // Fall through to a GET retry.
  }

  try {
    const response = await fetchWithTimeout(faviconUrl, {
      method: "GET",
      headers: {
        Accept: "image/*,*/*;q=0.8"
      }
    });

    return {
      faviconUrl,
      faviconStatus: response.ok ? ("ok" as const) : ("error" as const),
      note: response.ok ? null : `Favicon request returned HTTP ${response.status}`
    };
  } catch (error) {
    return {
      faviconUrl,
      faviconStatus: "error" as const,
      note: error instanceof Error ? error.message : "Favicon request failed"
    };
  }
}

export async function runLinkHealthCheck(link: Pick<LinkRecord, "url" | "faviconUrl">): Promise<HealthCheckResult> {
  const checkedAt = nowIso();

  try {
    const [mainResult, faviconResult] = await Promise.all([checkMainPage(link.url), checkFavicon(link.url, link.faviconUrl)]);
    const notes = [mainResult.note, faviconResult.note].filter(Boolean);

    return {
      checkedAt,
      httpStatus: mainResult.httpStatus,
      faviconStatus: faviconResult.faviconStatus,
      titleStatus: mainResult.titleStatus,
      status: resolveLinkStatus(mainResult.httpStatus, faviconResult.faviconStatus, mainResult.titleStatus),
      note: notes.length ? notes.join(" | ") : null,
      faviconUrl: faviconResult.faviconUrl ?? link.faviconUrl ?? getFaviconFallback(link.url)
    };
  } catch (error) {
    return {
      checkedAt,
      httpStatus: null,
      faviconStatus: "error",
      titleStatus: "error",
      status: "broken",
      note: error instanceof Error ? error.message : "Health check failed",
      faviconUrl: link.faviconUrl ?? getFaviconFallback(link.url)
    };
  }
}
