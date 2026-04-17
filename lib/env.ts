import type { StorageMode } from "@/lib/types";

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function requireEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is required to start nav-website.`);
  }

  return value;
}

export function isProductionBuild() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function getStorageMode(): StorageMode {
  const explicit = readEnv("NAV_STORAGE_MODE");

  if (!explicit) {
    throw new Error('NAV_STORAGE_MODE is required and must be set to "file" or "database".');
  }

  if (explicit !== "file" && explicit !== "database") {
    throw new Error(`NAV_STORAGE_MODE must be either "file" or "database". Received "${explicit}".`);
  }

  if (explicit === "database") {
    requireEnv("DATABASE_URL");
  }

  return explicit;
}

export function isDatabaseMode() {
  return getStorageMode() === "database";
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const raw = readEnv(name);
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

export function getTaskRunnerBatchLimit() {
  return Math.min(readPositiveIntegerEnv("TASK_RUNNER_BATCH_LIMIT", 8), 24);
}

export function getTaskRunnerRetryBackoffMs() {
  return readPositiveIntegerEnv("TASK_RUNNER_RETRY_BACKOFF_MS", 30_000);
}
