import "server-only";

import { getStorageMode } from "@/lib/env";

export function isAdvancedDirectoryEnabled() {
  return getStorageMode() === "database";
}

export function requireAdvancedDirectory(feature: string) {
  if (!isAdvancedDirectoryEnabled()) {
    throw new Error(`${feature} requires NAV_STORAGE_MODE="database".`);
  }
}
