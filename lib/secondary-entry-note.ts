import "server-only";

import type { SecondaryEntrySource, SiteSettingsRecord } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/utils";

const NOTE_REVALIDATE_SECONDS = 60 * 30;
const MAX_QUOTE_LENGTH = 64;
const MAX_ATTRIBUTION_LENGTH = 32;
const BLOCKED_ATTRIBUTION_TERMS = [
  "\u66f2\u5a49\u5a77",
  "\u6211\u7684\u6b4c\u58f0\u91cc",
  "\u6b4c\u624b",
  "\u6b4c\u8bcd",
  "\u4e13\u8f91",
  "\u7535\u5f71",
  "\u7535\u89c6\u5267",
  "\u52a8\u753b",
  "\u756a\u5267",
  "\u7efc\u827a",
  "\u6e38\u620f",
  "song",
  "ost",
  "album",
  "anime",
  "movie",
  "film",
  "soundtrack",
  "theme song",
  "game"
];
const BLOCKED_QUOTE_TERMS = [
  "\u6b4c\u8bcd",
  "\u4e3b\u9898\u66f2",
  "\u63d2\u66f2",
  "\u7247\u5c3e\u66f2",
  "\u7247\u5934\u66f2",
  "BGM",
  "\u4e13\u8f91",
  "\u5267\u60c5",
  "\u7535\u5f71",
  "\u7535\u89c6\u5267",
  "\u756a\u5267",
  "\u52a8\u753b",
  "\u6e38\u620f",
  "song",
  "ost",
  "album",
  "anime",
  "movie",
  "film",
  "soundtrack",
  "theme song",
  "game"
];
const CURATED_FALLBACK_QUOTES: Record<SecondaryEntrySource, ResolvedSecondaryEntryQuote[]> = {
  hitokoto: [
    { text: "\u77e5\u4eba\u8005\u667a\uff0c\u81ea\u77e5\u8005\u660e\u3002", attribution: "\u300a\u9053\u5fb7\u7ecf\u300b" },
    { text: "\u4e0d\u79ef\u8dcc\u6b65\uff0c\u65e0\u4ee5\u81f3\u5343\u91cc\u3002", attribution: "\u300a\u8350\u5b50\u300b" },
    { text: "\u7eb8\u4e0a\u5f97\u6765\u7ec8\u89c9\u6d45\uff0c\u7edd\u77e5\u6b64\u4e8b\u8981\u8eac\u884c\u3002", attribution: "\u9646\u6e38\u300a\u51ac\u591c\u8bfb\u4e66\u793a\u5b50\u807f\u300b" },
    { text: "\u535a\u89c2\u800c\u7ea6\u53d6\uff0c\u539a\u79ef\u800c\u8584\u53d1\u3002", attribution: "\u82cf\u8f7c" }
  ],
  jinrishici: [
    { text: "\u5c71\u91cd\u6c34\u590d\u7591\u65e0\u8def\uff0c\u67f3\u6697\u82b1\u660e\u53c8\u4e00\u6751\u3002", attribution: "\u9646\u6e38\u300a\u6e38\u5c71\u897f\u6751\u300b" },
    { text: "\u957f\u98ce\u7834\u6d6a\u4f1a\u6709\u65f6\uff0c\u76f4\u6302\u4e91\u5e06\u6d4e\u6ca7\u6d77\u3002", attribution: "\u674e\u767d\u300a\u884c\u8def\u96be\u300b" },
    { text: "\u4e14\u5c06\u65b0\u706b\u8bd5\u65b0\u8336\uff0c\u8bd7\u9152\u8d81\u5e74\u534e\u3002", attribution: "\u82cf\u8f7c\u300a\u671b\u6c5f\u5357\u300b" },
    { text: "\u4e00\u70b9\u6d69\u7136\u6c14\uff0c\u5343\u91cc\u5feb\u54c9\u98ce\u3002", attribution: "\u82cf\u8f7c\u300a\u6c34\u8c03\u6b4c\u5934\u300b" }
  ]
};

type ResolvedSecondaryEntryQuote = {
  text: string;
  attribution: string;
};

type HitokotoResponse = {
  hitokoto?: unknown;
  from?: unknown;
  from_who?: unknown;
};

type JinrishiciResponse = {
  data?: {
    content?: unknown;
    origin?: {
      title?: unknown;
      author?: unknown;
    };
  };
};

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function isBlockedAttribution(value: string | null) {
  if (!value) {
    return false;
  }

  return BLOCKED_ATTRIBUTION_TERMS.some((term) => value.includes(term));
}

function isBlockedQuoteText(value: string | null) {
  if (!value) {
    return false;
  }

  return BLOCKED_QUOTE_TERMS.some((term) => value.includes(term));
}

function getProviderFallbackAttribution(source: SecondaryEntrySource) {
  return source === "jinrishici" ? "\u4eca\u65e5\u8bd7\u8bcd" : "\u4e00\u8a00";
}

function pickCuratedFallbackQuote(source: SecondaryEntrySource) {
  const pool = CURATED_FALLBACK_QUOTES[source];
  const date = new Date();
  const seed = date.getUTCFullYear() * 372 + (date.getUTCMonth() + 1) * 31 + date.getUTCDate();
  return pool[seed % pool.length];
}

function getFallbackQuote(settings: SiteSettingsRecord, source: SecondaryEntrySource): ResolvedSecondaryEntryQuote {
  const customFallback = normalizeText(settings.secondaryEntryFallback, MAX_QUOTE_LENGTH);
  const defaultFallback = DEFAULT_SETTINGS.secondaryEntryFallback.trim();

  if (customFallback && customFallback !== defaultFallback && !isBlockedQuoteText(customFallback)) {
    return {
      text: customFallback,
      attribution: getProviderFallbackAttribution(source)
    };
  }

  return pickCuratedFallbackQuote(source);
}

async function fetchJson<T>(url: string) {
  const init: RequestInit & { next: { revalidate: number } } = {
    headers: {
      Accept: "application/json"
    },
    next: {
      revalidate: NOTE_REVALIDATE_SECONDS
    }
  };

  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    init.signal = AbortSignal.timeout(4500);
  }

  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Provider request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchHitokotoQuote() {
  const data = await fetchJson<HitokotoResponse>("https://v1.hitokoto.cn/?encode=json&c=d&c=i&c=k");
  const text = normalizeText(data.hitokoto, MAX_QUOTE_LENGTH);
  const attribution = normalizeText(
    [data.from_who, data.from].filter((item) => typeof item === "string" && item.trim()).join(" \u00b7 "),
    MAX_ATTRIBUTION_LENGTH
  );

  if (!text || isBlockedQuoteText(text) || isBlockedAttribution(attribution)) {
    return null;
  }

  return {
    text,
    attribution: attribution ?? "\u4e00\u8a00"
  } satisfies ResolvedSecondaryEntryQuote;
}

async function fetchJinrishiciQuote() {
  const data = await fetchJson<JinrishiciResponse>("https://v2.jinrishici.com/one.json");
  const text = normalizeText(data.data?.content, MAX_QUOTE_LENGTH);
  const title = normalizeText(data.data?.origin?.title, 18);
  const author = normalizeText(data.data?.origin?.author, 12);
  const attribution = normalizeText(
    [title ? `\u300a${title}\u300b` : null, author].filter(Boolean).join(" \u00b7 "),
    MAX_ATTRIBUTION_LENGTH
  );

  if (!text || isBlockedQuoteText(text) || isBlockedAttribution(attribution)) {
    return null;
  }

  return {
    text,
    attribution: attribution ?? "\u4eca\u65e5\u8bd7\u8bcd"
  } satisfies ResolvedSecondaryEntryQuote;
}

const providerMap: Record<SecondaryEntrySource, () => Promise<ResolvedSecondaryEntryQuote | null>> = {
  hitokoto: fetchHitokotoQuote,
  jinrishici: fetchJinrishiciQuote
};

export async function resolveSecondaryEntryQuote(settings: SiteSettingsRecord) {
  const source = settings.secondaryEntrySource;
  const fallbackQuote = getFallbackQuote(settings, source);
  const provider = providerMap[source] ?? providerMap.hitokoto;

  try {
    return (
      (await provider()) ?? {
        text: fallbackQuote.text,
        attribution: fallbackQuote.attribution
      }
    );
  } catch {
    return {
      text: fallbackQuote.text,
      attribution: fallbackQuote.attribution
    };
  }
}
