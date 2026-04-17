import "server-only";

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { listKnownRemoteFaviconSources } from "@/lib/favicon-route";

const FAVICON_CACHE_DIR = path.join(process.cwd(), "data", "favicon-cache");
const FAVICON_FETCH_TIMEOUT_MS = 8000;
const FAVICON_MAX_BYTES = 1024 * 1024;
const POSITIVE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const ERROR_CACHE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ORPHAN_SUCCESS_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
const BROWSER_WARM_RETRY_COOLDOWN_MS = 10 * 60 * 1000;

type FaviconCacheMeta = {
  source: string;
  fetchedAt: string;
  lastAttemptedAt: string;
  status: "ok" | "error";
  contentType: string | null;
  fileName: string | null;
  error: string | null;
};

type FaviconCacheHit = {
  kind: "hit";
  body: Buffer;
  contentType: string;
  fetchedAt: string;
  stale: boolean;
};

type FaviconCacheMiss = {
  kind: "miss";
  fetchedAt: string;
  stale: boolean;
  error: string | null;
};

type FaviconCacheResult = FaviconCacheHit | FaviconCacheMiss;

export type FaviconCacheCleanupSummary = {
  scannedMetaFiles: number;
  removedMetaFiles: number;
  removedDataFiles: number;
  removedInvalidMetaFiles: number;
  removedExpiredErrorEntries: number;
  removedOrphanedSuccessEntries: number;
  removedMissingDataEntries: number;
  removedOrphanedDataFiles: number;
  activeSources: number;
};

const pendingRequests = new Map<string, Promise<FaviconCacheResult>>();
const forcedRefreshTimestamps = new Map<string, number>();

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

function getCacheKey(source: string) {
  return createHash("sha256").update(source).digest("hex");
}

function getMetaPath(cacheKey: string) {
  return path.join(FAVICON_CACHE_DIR, `${cacheKey}.json`);
}

function getDataPath(fileName: string) {
  return path.join(FAVICON_CACHE_DIR, fileName);
}

function isRemoteSource(value: string) {
  return /^https?:\/\//i.test(value);
}

function isImageContentType(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized.startsWith("image/") || normalized === "application/octet-stream";
}

function normalizeContentType(value: string | null) {
  const normalized = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (isImageContentType(normalized)) {
    return normalized;
  }

  return null;
}

async function ensureCacheDir() {
  await fs.mkdir(FAVICON_CACHE_DIR, { recursive: true });
}

async function readMeta(cacheKey: string) {
  try {
    const raw = await fs.readFile(getMetaPath(cacheKey), "utf8");
    return JSON.parse(raw) as FaviconCacheMeta;
  } catch {
    return null;
  }
}

async function writeMeta(cacheKey: string, meta: FaviconCacheMeta) {
  await ensureCacheDir();
  await fs.writeFile(getMetaPath(cacheKey), JSON.stringify(meta, null, 2), "utf8");
}

async function removeDataFile(fileName: string | null) {
  if (!fileName) {
    return;
  }

  await fs.rm(getDataPath(fileName), { force: true });
}

async function readCachedFile(meta: FaviconCacheMeta) {
  if (meta.status !== "ok" || !meta.fileName || !meta.contentType) {
    return null;
  }

  try {
    const body = await fs.readFile(getDataPath(meta.fileName));
    return {
      body,
      contentType: meta.contentType
    };
  } catch {
    return null;
  }
}

export async function hasCachedFaviconSource(source: string) {
  if (!isRemoteSource(source)) {
    return false;
  }

  const meta = await readMeta(getCacheKey(source));
  if (!meta) {
    return false;
  }

  const cachedFile = await readCachedFile(meta);
  return Boolean(cachedFile);
}

export async function hasAnyCachedFaviconSource(sources: string[]) {
  for (const source of sources) {
    if (await hasCachedFaviconSource(source)) {
      return true;
    }
  }

  return false;
}

async function fetchRemoteFavicon(source: string, cacheKey: string, staleMeta?: FaviconCacheMeta | null): Promise<FaviconCacheResult> {
  const { signal, cleanup } = createAbortSignal(FAVICON_FETCH_TIMEOUT_MS);

  try {
    let refererOrigin = "";
    try {
      const parsed = new URL(source);
      refererOrigin = parsed.origin;
    } catch {
      refererOrigin = "";
    }

    const response = await fetch(source, {
      signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        ...(refererOrigin
          ? {
              Referer: `${refererOrigin}/`,
              Origin: refererOrigin
            }
          : {}),
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "same-site",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      const fetchedAt = new Date().toISOString();
      await writeMeta(
        cacheKey,
        staleMeta?.status === "ok" && staleMeta.fileName && staleMeta.contentType
          ? {
              ...staleMeta,
              source,
              lastAttemptedAt: fetchedAt,
              error: `HTTP ${response.status}`
            }
          : {
              source,
              fetchedAt,
              lastAttemptedAt: fetchedAt,
              status: "error",
              contentType: null,
              fileName: null,
              error: `HTTP ${response.status}`
            }
      );

      return {
        kind: "miss",
        fetchedAt,
        stale: false,
        error: `HTTP ${response.status}`
      };
    }

    const contentType = normalizeContentType(response.headers.get("content-type"));
    if (!contentType) {
      const fetchedAt = new Date().toISOString();
      await writeMeta(
        cacheKey,
        staleMeta?.status === "ok" && staleMeta.fileName && staleMeta.contentType
          ? {
              ...staleMeta,
              source,
              lastAttemptedAt: fetchedAt,
              error: "Response is not an image"
            }
          : {
              source,
              fetchedAt,
              lastAttemptedAt: fetchedAt,
              status: "error",
              contentType: null,
              fileName: null,
              error: "Response is not an image"
            }
      );

      return {
        kind: "miss",
        fetchedAt,
        stale: false,
        error: "Response is not an image"
      };
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > FAVICON_MAX_BYTES) {
      const fetchedAt = new Date().toISOString();
      await writeMeta(
        cacheKey,
        staleMeta?.status === "ok" && staleMeta.fileName && staleMeta.contentType
          ? {
              ...staleMeta,
              source,
              lastAttemptedAt: fetchedAt,
              error: "Favicon exceeds size limit"
            }
          : {
              source,
              fetchedAt,
              lastAttemptedAt: fetchedAt,
              status: "error",
              contentType: null,
              fileName: null,
              error: "Favicon exceeds size limit"
            }
      );

      return {
        kind: "miss",
        fetchedAt,
        stale: false,
        error: "Favicon exceeds size limit"
      };
    }

    const fetchedAt = new Date().toISOString();
    const fileName = `${cacheKey}.bin`;

    await ensureCacheDir();
    await fs.writeFile(getDataPath(fileName), body);
    await writeMeta(cacheKey, {
      source,
      fetchedAt,
      lastAttemptedAt: fetchedAt,
      status: "ok",
      contentType,
      fileName,
      error: null
    });

    return {
      kind: "hit",
      body,
      contentType,
      fetchedAt,
      stale: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Favicon fetch failed";
    const fetchedAt = new Date().toISOString();

    await writeMeta(
      cacheKey,
      staleMeta?.status === "ok" && staleMeta.fileName && staleMeta.contentType
        ? {
            ...staleMeta,
            source,
            lastAttemptedAt: fetchedAt,
            error: message
          }
        : {
            source,
            fetchedAt,
            lastAttemptedAt: fetchedAt,
            status: "error",
            contentType: null,
            fileName: null,
            error: message
          }
    );

    return {
      kind: "miss",
      fetchedAt,
      stale: false,
      error: message
    };
  } finally {
    cleanup();
  }
}

type ResolveCachedFaviconOptions = {
  forceRefresh?: boolean;
};

async function loadCachedOrFetch(source: string, options: ResolveCachedFaviconOptions = {}): Promise<FaviconCacheResult> {
  const cacheKey = getCacheKey(source);
  const meta = await readMeta(cacheKey);
  const now = Date.now();

  if (meta?.status === "ok") {
    const cachedFile = await readCachedFile(meta);
    if (cachedFile) {
      const fetchedAtMs = Date.parse(meta.fetchedAt);
      const isFresh = Number.isFinite(fetchedAtMs) && now - fetchedAtMs <= POSITIVE_CACHE_TTL_MS;

      if (isFresh) {
        return {
          kind: "hit",
          body: cachedFile.body,
          contentType: cachedFile.contentType,
          fetchedAt: meta.fetchedAt,
          stale: false
        };
      }

      const attemptedAtMs = Date.parse(meta.lastAttemptedAt || meta.fetchedAt);
      const shouldRetryRefresh = !Number.isFinite(attemptedAtMs) || now - attemptedAtMs > NEGATIVE_CACHE_TTL_MS;

      if (!options.forceRefresh && !shouldRetryRefresh) {
        return {
          kind: "hit",
          body: cachedFile.body,
          contentType: cachedFile.contentType,
          fetchedAt: meta.fetchedAt,
          stale: true
        };
      }

      const refreshed = await fetchRemoteFavicon(source, cacheKey, meta);
      if (refreshed.kind === "hit") {
        return refreshed;
      }

      return {
        kind: "hit",
        body: cachedFile.body,
        contentType: cachedFile.contentType,
        fetchedAt: meta.fetchedAt,
        stale: true
      };
    }

    await removeDataFile(meta.fileName);
  }

  if (meta?.status === "error") {
    const fetchedAtMs = Date.parse(meta.fetchedAt);
    const shouldReuseNegative = Number.isFinite(fetchedAtMs) && now - fetchedAtMs <= NEGATIVE_CACHE_TTL_MS;
    if (!options.forceRefresh && shouldReuseNegative) {
      return {
        kind: "miss",
        fetchedAt: meta.fetchedAt,
        stale: false,
        error: meta.error
      };
    }
  }

  return fetchRemoteFavicon(source, cacheKey);
}

export async function resolveCachedFavicon(source: string, options: ResolveCachedFaviconOptions = {}): Promise<FaviconCacheResult> {
  if (!isRemoteSource(source)) {
    return {
      kind: "miss",
      fetchedAt: new Date().toISOString(),
      stale: false,
      error: "Only remote favicon sources can be cached"
    };
  }

  const cacheKey = getCacheKey(source);
  const requestKey = options.forceRefresh ? `${cacheKey}:force` : cacheKey;
  const existing = pendingRequests.get(requestKey);
  if (existing) {
    return existing;
  }

  const task = loadCachedOrFetch(source, options).finally(() => {
    pendingRequests.delete(requestKey);
  });

  pendingRequests.set(requestKey, task);
  return task;
}

export async function warmCachedFavicon(source: string): Promise<FaviconCacheResult> {
  if (!isRemoteSource(source)) {
    return resolveCachedFavicon(source);
  }

  const cacheKey = getCacheKey(source);
  const now = Date.now();
  const lastForcedAt = forcedRefreshTimestamps.get(cacheKey) ?? 0;

  if (now - lastForcedAt < BROWSER_WARM_RETRY_COOLDOWN_MS) {
    return resolveCachedFavicon(source);
  }

  forcedRefreshTimestamps.set(cacheKey, now);
  return resolveCachedFavicon(source, { forceRefresh: true });
}

export async function cleanupFaviconCache(): Promise<FaviconCacheCleanupSummary> {
  await ensureCacheDir();

  const activeSources = await listKnownRemoteFaviconSources();
  const entries = await fs.readdir(FAVICON_CACHE_DIR, { withFileTypes: true });
  const metaFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
  const dataFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".bin"));
  const now = Date.now();

  let removedMetaFiles = 0;
  let removedDataFiles = 0;
  let removedInvalidMetaFiles = 0;
  let removedExpiredErrorEntries = 0;
  let removedOrphanedSuccessEntries = 0;
  let removedMissingDataEntries = 0;
  let removedOrphanedDataFiles = 0;

  const referencedDataFiles = new Set<string>();

  for (const metaEntry of metaFiles) {
    const metaPath = path.join(FAVICON_CACHE_DIR, metaEntry.name);
    let meta: FaviconCacheMeta | null = null;

    try {
      meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as FaviconCacheMeta;
    } catch {
      await fs.rm(metaPath, { force: true });
      removedMetaFiles += 1;
      removedInvalidMetaFiles += 1;
      continue;
    }

    if (meta.fileName) {
      referencedDataFiles.add(meta.fileName);
    }

    const lastAttemptedAt = Date.parse(meta.lastAttemptedAt || meta.fetchedAt);
    const fetchedAt = Date.parse(meta.fetchedAt);
    const hasValidTimestamps = Number.isFinite(lastAttemptedAt) && Number.isFinite(fetchedAt);
    const dataExists = meta.fileName ? await fs.access(getDataPath(meta.fileName)).then(() => true).catch(() => false) : false;
    const isActiveSource = activeSources.has(meta.source);

    if (meta.status === "error") {
      const shouldRemoveError =
        !hasValidTimestamps || now - lastAttemptedAt >= ERROR_CACHE_RETENTION_MS || !isActiveSource;

      if (shouldRemoveError) {
        await fs.rm(metaPath, { force: true });
        await removeDataFile(meta.fileName);
        removedMetaFiles += 1;
        removedExpiredErrorEntries += 1;
        if (meta.fileName && dataExists) {
          removedDataFiles += 1;
        }
      }

      continue;
    }

    if (!meta.fileName || !meta.contentType || !dataExists) {
      await fs.rm(metaPath, { force: true });
      await removeDataFile(meta.fileName);
      removedMetaFiles += 1;
      removedMissingDataEntries += 1;
      if (meta.fileName && dataExists) {
        removedDataFiles += 1;
      }
      continue;
    }

    const shouldRemoveInactiveSuccess =
      !isActiveSource && (!Number.isFinite(fetchedAt) || now - fetchedAt >= ORPHAN_SUCCESS_RETENTION_MS);

    if (shouldRemoveInactiveSuccess) {
      await fs.rm(metaPath, { force: true });
      await removeDataFile(meta.fileName);
      removedMetaFiles += 1;
      removedDataFiles += 1;
      removedOrphanedSuccessEntries += 1;
    }
  }

  for (const dataEntry of dataFiles) {
    if (referencedDataFiles.has(dataEntry.name)) {
      continue;
    }

    await fs.rm(path.join(FAVICON_CACHE_DIR, dataEntry.name), { force: true });
    removedDataFiles += 1;
    removedOrphanedDataFiles += 1;
  }

  return {
    scannedMetaFiles: metaFiles.length,
    removedMetaFiles,
    removedDataFiles,
    removedInvalidMetaFiles,
    removedExpiredErrorEntries,
    removedOrphanedSuccessEntries,
    removedMissingDataEntries,
    removedOrphanedDataFiles,
    activeSources: activeSources.size
  };
}
