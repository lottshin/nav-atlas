export const CATEGORY_ICON_OPTIONS = [
  "search",
  "spark",
  "palette",
  "film",
  "terminal",
  "check",
  "grid",
  "layers",
  "ticket",
  "clapper",
  "code",
  "book",
  "rocket",
  "note",
  "compass"
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number];

const DEFAULT_CATEGORY_ICON_BY_SLUG: Record<string, CategoryIconName> = {
  "search-discovery": "search",
  "ai-tools": "spark",
  "design-inspiration": "palette",
  "video-entertainment": "film",
  "developer-tools": "terminal",
  productivity: "check"
};

export function resolveBuiltinIcon(value?: string | null, fallback: CategoryIconName = "grid"): CategoryIconName {
  if (value && CATEGORY_ICON_OPTIONS.includes(value as CategoryIconName)) {
    return value as CategoryIconName;
  }

  return fallback;
}

export function resolveCategoryIcon(value?: string | null, slug?: string): CategoryIconName {
  if (value && CATEGORY_ICON_OPTIONS.includes(value as CategoryIconName)) {
    return value as CategoryIconName;
  }

  if (slug && DEFAULT_CATEGORY_ICON_BY_SLUG[slug]) {
    return DEFAULT_CATEGORY_ICON_BY_SLUG[slug];
  }

  return "grid";
}
