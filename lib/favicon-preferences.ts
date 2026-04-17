import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { isRemoteFaviconSource } from "@/lib/favicon-sources";

const FAVICON_PREFERENCES_PATH = path.join(process.cwd(), "data", "favicon-preferences.json");

type FaviconPreferenceMap = Record<string, string>;

let writeQueue = Promise.resolve();

async function ensurePreferencesDir() {
  await fs.mkdir(path.dirname(FAVICON_PREFERENCES_PATH), { recursive: true });
}

async function readPreferences(): Promise<FaviconPreferenceMap> {
  try {
    const raw = await fs.readFile(FAVICON_PREFERENCES_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}

async function writePreferences(preferences: FaviconPreferenceMap) {
  await ensurePreferencesDir();
  await fs.writeFile(FAVICON_PREFERENCES_PATH, JSON.stringify(preferences, null, 2), "utf8");
}

export async function getPreferredFaviconSource(linkId: string) {
  if (!linkId) {
    return null;
  }

  const preferences = await readPreferences();
  return preferences[linkId] ?? null;
}

export async function getPreferredFaviconSourceMap(linkIds: string[]) {
  const uniqueIds = [...new Set(linkIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map<string, string>();
  }

  const preferences = await readPreferences();
  return new Map(uniqueIds.flatMap((linkId) => (preferences[linkId] ? [[linkId, preferences[linkId]]] : [])));
}

export async function rememberPreferredFaviconSource(linkId: string, source: string) {
  if (!linkId || !isRemoteFaviconSource(source)) {
    return;
  }

  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        const preferences = await readPreferences();
        if (preferences[linkId] === source) {
          return;
        }

        preferences[linkId] = source;
        await writePreferences(preferences);
      } catch {
        // Preference persistence is best-effort and must not break favicon delivery.
      }
    });

  await writeQueue.catch(() => undefined);
}
