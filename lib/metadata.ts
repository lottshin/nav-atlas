import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getStorageMode } from "@/lib/env";
import { getLinkMetadataRecords, getLinkRecords, upsertLocalLinkMetadataRecord } from "@/lib/repository";
import type { LinkMetadataRecord, MetadataFetchStatus } from "@/lib/types";
import { getFaviconFallback } from "@/lib/utils";
import { requireAdvancedDirectory } from "@/lib/feature-guard";
import { enqueueJob, enqueueSearchReindex } from "@/lib/tasks";

type MetadataPayload = {
  title: string | null;
  description: string | null;
  siteName: string | null;
  canonicalUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
};

const METADATA_REQUEST_TIMEOUT_MS = 12_000;
const BROWSERISH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

function buildMetadataRequestHeaders() {
  return {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": BROWSERISH_USER_AGENT
  };
}

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

function extractTagAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const attributePattern = /([^\s"'=<>`/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(tag))) {
    const [, rawName, doubleQuoted, singleQuoted, bareValue] = match;
    const value = doubleQuoted ?? singleQuoted ?? bareValue ?? "";
    attributes.set(rawName.toLowerCase(), decodeHtmlEntities(value).trim());
  }

  return attributes;
}

function extractMetaContentByNameOrProperty(html: string, key: string) {
  const metaTagPattern = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  const target = key.toLowerCase();

  while ((match = metaTagPattern.exec(html))) {
    const attributes = extractTagAttributes(match[0]);
    const candidate = (attributes.get("property") || attributes.get("name") || "").toLowerCase();
    if (candidate !== target) {
      continue;
    }

    const content = attributes.get("content");
    if (content) {
      return content;
    }
  }

  return null;
}

function extractLinkHrefByRelToken(html: string, token: string) {
  const linkTagPattern = /<link\b[^>]*>/gi;
  const target = token.toLowerCase();
  let match: RegExpExecArray | null;

  while ((match = linkTagPattern.exec(html))) {
    const attributes = extractTagAttributes(match[0]);
    const rel = (attributes.get("rel") || "").toLowerCase();
    if (!rel || !rel.split(/\s+/).includes(target)) {
      continue;
    }

    const href = attributes.get("href");
    if (href) {
      return href;
    }
  }

  return null;
}

function extractBestIconHref(html: string) {
  const linkTagPattern = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  const candidates: Array<{ score: number; href: string }> = [];

  while ((match = linkTagPattern.exec(html))) {
    const attributes = extractTagAttributes(match[0]);
    const rel = (attributes.get("rel") || "").toLowerCase();
    const href = attributes.get("href");
    if (!rel || !href) {
      continue;
    }

    const tokens = rel.split(/\s+/).filter(Boolean);
    if (!tokens.includes("icon")) {
      continue;
    }

    if (tokens.includes("mask-icon")) {
      continue;
    }

    const sizes = attributes.get("sizes") || "";
    const type = (attributes.get("type") || "").toLowerCase();

    let score = 10;
    if (rel === "icon") score = 100;
    else if (rel === "shortcut icon") score = 95;
    else if (tokens.includes("shortcut") && tokens.includes("icon")) score = 90;
    else if (tokens.includes("apple-touch-icon")) score = 70;

    if (type.includes("svg")) score += 6;
    else if (type.includes("png")) score += 5;
    else if (type.includes("icon")) score += 4;

    const sizeMatch = sizes.match(/(\d+)x(\d+)/i);
    if (sizeMatch) {
      const side = Number(sizeMatch[1]);
      if (Number.isFinite(side)) {
        score += Math.min(side, 512) / 64;
      }
    }

    candidates.push({ score, href });
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.href ?? null;
}

function extractMetadataFromHtml(html: string): MetadataPayload {
  return {
    title: (() => {
      const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      return match ? decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim() : null;
    })(),
    description: extractMetaContentByNameOrProperty(html, "description"),
    siteName: extractMetaContentByNameOrProperty(html, "og:site_name"),
    canonicalUrl: extractLinkHrefByRelToken(html, "canonical"),
    faviconUrl: extractBestIconHref(html),
    ogImageUrl: extractMetaContentByNameOrProperty(html, "og:image")
  };
}

function resolveMetadataUrl(value: string | null, baseUrl: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchMetadataDocument(targetUrl: string) {
  const { signal, cleanup } = createAbortSignal(METADATA_REQUEST_TIMEOUT_MS);
  const response = await fetch(targetUrl, {
    cache: "no-store",
    redirect: "follow",
    signal,
    headers: buildMetadataRequestHeaders()
  }).finally(cleanup);

  if (!response.ok) {
    throw new Error(`Metadata request returned HTTP ${response.status}`);
  }

  const html = await response.text();
  return {
    response,
    html
  };
}

function resolveFetchStatus(value: string): MetadataFetchStatus {
  if (value === "queued" || value === "ok" || value === "error") {
    return value;
  }

  return "idle";
}

function serializeMetadata(input: {
  linkId: string;
  resolvedTitle: string | null;
  resolvedDescription: string | null;
  siteName: string | null;
  canonicalUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  lastFetchedAt: Date | null;
  fetchStatus: string;
  lastError: string | null;
}): LinkMetadataRecord {
  return {
    linkId: input.linkId,
    resolvedTitle: input.resolvedTitle,
    resolvedDescription: input.resolvedDescription,
    siteName: input.siteName,
    canonicalUrl: input.canonicalUrl,
    faviconUrl: input.faviconUrl,
    ogImageUrl: input.ogImageUrl,
    lastFetchedAt: input.lastFetchedAt?.toISOString() ?? null,
    fetchStatus: resolveFetchStatus(input.fetchStatus),
    lastError: input.lastError
  };
}

export async function getMetadataMapForLinks(linkIds: string[]) {
  if (!linkIds.length) {
    return new Map<string, LinkMetadataRecord>();
  }

  if (getStorageMode() !== "database") {
    const wanted = new Set(linkIds);
    const rows = await getLinkMetadataRecords();
    return new Map(rows.filter((row) => wanted.has(row.linkId)).map((row) => [row.linkId, row]));
  }

  const rows = await prisma.linkMetadata.findMany({
    where: { linkId: { in: [...new Set(linkIds)] } }
  });

  return new Map(rows.map((row) => [row.linkId, serializeMetadata(row)]));
}

export async function queueMetadataRefresh(linkIds: string[]) {
  requireAdvancedDirectory("Metadata refresh");

  const uniqueIds = [...new Set(linkIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return [];
  }

  await Promise.all(
    uniqueIds.map((linkId) =>
      prisma.linkMetadata.upsert({
        where: { linkId },
        create: {
          linkId,
          fetchStatus: "queued"
        },
        update: {
          fetchStatus: "queued",
          lastError: null
        }
      })
    )
  );

  return Promise.all(uniqueIds.map((linkId) => enqueueJob("METADATA_REFRESH", { payload: { linkId }, priority: 3 })));
}

export async function getMetadataRetryCandidateIds(limit = 12) {
  requireAdvancedDirectory("Metadata refresh");

  const rows = await prisma.linkMetadata.findMany({
    where: {
      fetchStatus: "error"
    },
    orderBy: [{ lastFetchedAt: "asc" }],
    take: limit,
    select: {
      linkId: true
    }
  });

  return rows.map((row) => row.linkId);
}

export async function refreshLinkMetadata(linkId: string) {
  const storageMode = getStorageMode();

  const link =
    storageMode === "database"
      ? await prisma.link.findUnique({
          where: { id: linkId },
          select: {
            id: true,
            url: true,
            faviconUrl: true
          }
        })
      : (await getLinkRecords())
          .filter((item) => item.id === linkId)
          .map((item) => ({
            id: item.id,
            url: item.url,
            faviconUrl: item.faviconUrl
          }))[0] ?? null;

  if (!link) {
    throw new Error(`Link not found: ${linkId}`);
  }

  try {
    let response: Response;
    let html: string;

    try {
      ({ response, html } = await fetchMetadataDocument(link.url));
    } catch (error) {
      const origin = (() => {
        try {
          return new URL(link.url).origin;
        } catch {
          return "";
        }
      })();

      if (!origin || origin === link.url) {
        throw error;
      }

      ({ response, html } = await fetchMetadataDocument(origin));
    }

    const extracted = extractMetadataFromHtml(html);
    const fallbackFavicon = link.faviconUrl || getFaviconFallback(link.url);
    const resolvedBaseUrl = response.url || link.url;
    const canonicalUrl = resolveMetadataUrl(extracted.canonicalUrl, resolvedBaseUrl);
    const faviconUrl = resolveMetadataUrl(extracted.faviconUrl, resolvedBaseUrl) || fallbackFavicon;
    const ogImageUrl = resolveMetadataUrl(extracted.ogImageUrl, resolvedBaseUrl);

    if (storageMode === "database") {
      const record = await prisma.linkMetadata.upsert({
        where: { linkId: link.id },
        create: {
          linkId: link.id,
          resolvedTitle: extracted.title,
          resolvedDescription: extracted.description,
          siteName: extracted.siteName,
          canonicalUrl,
          faviconUrl,
          ogImageUrl,
          lastFetchedAt: new Date(),
          fetchStatus: "ok",
          lastError: null
        },
        update: {
          resolvedTitle: extracted.title,
          resolvedDescription: extracted.description,
          siteName: extracted.siteName,
          canonicalUrl,
          faviconUrl,
          ogImageUrl,
          lastFetchedAt: new Date(),
          fetchStatus: "ok",
          lastError: null
        }
      });

      await enqueueSearchReindex({ scope: "links", linkIds: [link.id] }, 2);
      return serializeMetadata(record);
    }

    const record = serializeMetadata({
      linkId: link.id,
      resolvedTitle: extracted.title,
      resolvedDescription: extracted.description,
      siteName: extracted.siteName,
      canonicalUrl,
      faviconUrl,
      ogImageUrl,
      lastFetchedAt: new Date(),
      fetchStatus: "ok",
      lastError: null
    });

    await upsertLocalLinkMetadataRecord(record, faviconUrl);
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Metadata refresh failed";

    if (storageMode === "database") {
      const record = await prisma.linkMetadata.upsert({
        where: { linkId: link.id },
        create: {
          linkId: link.id,
          faviconUrl: link.faviconUrl || getFaviconFallback(link.url),
          fetchStatus: "error",
          lastError: message,
          lastFetchedAt: new Date()
        },
        update: {
          fetchStatus: "error",
          lastError: message,
          lastFetchedAt: new Date()
        }
      });

      return serializeMetadata(record);
    }

    const record = serializeMetadata({
      linkId: link.id,
      resolvedTitle: null,
      resolvedDescription: null,
      siteName: null,
      canonicalUrl: null,
      faviconUrl: link.faviconUrl || getFaviconFallback(link.url),
      ogImageUrl: null,
      lastFetchedAt: new Date(),
      fetchStatus: "error",
      lastError: message
    });

    await upsertLocalLinkMetadataRecord(record);
    return record;
  }
}
