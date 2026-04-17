import type {
  CategoryRecord,
  CreateLinkInput,
  DirectoryStore,
  ImportBatchRecord,
  LinkCheckRecord,
  LinkIconMode,
  LinkMetadataRecord,
  LinkRecord,
  LinkStatus,
  SecondaryEntrySource,
  SiteSettingsRecord,
  ThemeMode
} from "@/lib/types";
import { resolveBuiltinIcon, resolveCategoryIcon } from "@/lib/category-icons";

export const DEFAULT_SETTINGS: SiteSettingsRecord = {
  id: "singleton",
  siteName: "Nav Atlas",
  brandMark: "NAV/ATLAS",
  brandSub: "站点在线",
  homeRailLabel: "首页",
  homeRailIcon: "compass",
  heroEyebrow: "精选网站目录",
  heroTitle: "找到真正有用的",
  heroSubtitle: "\u6309\u5206\u7c7b\u6d4f\u89c8 AI\u3001\u8bbe\u8ba1\u3001\u5f71\u89c6\u4e0e\u9ad8\u9891\u5de5\u5177\u7f51\u7ad9\u3002",
  secondaryEntrySource: "hitokoto",
  secondaryEntryFallback: "想要更克制的入口时，可以改用标签、集合和保存视图，而不是完整分类目录。",
  featuredSectionKicker: "\u63a8\u8350",
  featuredSectionTitle: "本期精选推荐",
  featuredSectionNote: "\u4ece\u5de6\u4fa7\u5207\u6362\u5206\u7c7b\uff0c\u53ef\u4ee5\u67e5\u770b\u5bf9\u5e94\u5206\u7c7b\u4e0b\u7684\u5b8c\u6574\u7f51\u7ad9\u5217\u8868\u3002",
  accentColor: "#2563EB",
  defaultTheme: "light",
  adminBranding: "Nav Atlas 控制台"
};

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function sortCategories<T extends CategoryRecord>(categories: T[]) {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN"));
}

export function ensureCategoryRecord(
  input: Partial<CategoryRecord> & Pick<CategoryRecord, "id" | "name" | "slug" | "description" | "sortOrder">
): CategoryRecord {
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    icon: resolveCategoryIcon(input.icon, input.slug),
    sortOrder: input.sortOrder
  };
}

export function sortLinks<T extends LinkRecord>(links: T[]) {
  return [...links].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "en"));
}

export function sortLinkChecks<T extends LinkCheckRecord>(checks: T[]) {
  return [...checks].sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
}

export function sortImportBatches<T extends ImportBatchRecord>(batches: T[]) {
  return [...batches].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function sortLinkMetadataRecords<T extends LinkMetadataRecord>(records: T[]) {
  return [...records].sort((left, right) => {
    const timeDelta = (Date.parse(right.lastFetchedAt ?? "") || 0) - (Date.parse(left.lastFetchedAt ?? "") || 0);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.linkId.localeCompare(right.linkId, "en");
  });
}

export function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function getFaviconFallback(url: string) {
  const origin = getOrigin(url);
  return origin ? `${origin}/favicon.ico` : null;
}

export function isImageLikeIcon(value: string) {
  return /^(https?:)?\/\//.test(value) || value.startsWith("/") || value.startsWith("data:image/");
}

export function resolveIconMode(value: string): LinkIconMode {
  if (!value) return "auto";
  return isImageLikeIcon(value) ? "custom" : "builtin";
}

export function normalizeDomain(url: string) {
  return getDomain(url).toLowerCase();
}

export function nowIso() {
  return new Date().toISOString();
}

export function resolveThemeMode(value?: string | null): ThemeMode {
  return value === "dark" ? "dark" : "light";
}

export function resolveSecondaryEntrySource(value?: string | null): SecondaryEntrySource {
  return value === "jinrishici" ? "jinrishici" : "hitokoto";
}

export function ensureSettings(input?: Partial<SiteSettingsRecord>): SiteSettingsRecord {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    brandMark: input?.brandMark?.trim() || DEFAULT_SETTINGS.brandMark,
    brandSub: input?.brandSub?.trim() || DEFAULT_SETTINGS.brandSub,
    homeRailLabel: input?.homeRailLabel?.trim() || DEFAULT_SETTINGS.homeRailLabel,
    homeRailIcon: resolveBuiltinIcon(input?.homeRailIcon, "compass"),
    heroEyebrow: input?.heroEyebrow?.trim() || DEFAULT_SETTINGS.heroEyebrow,
    secondaryEntrySource: resolveSecondaryEntrySource(input?.secondaryEntrySource),
    secondaryEntryFallback: input?.secondaryEntryFallback?.trim() || DEFAULT_SETTINGS.secondaryEntryFallback,
    featuredSectionKicker: input?.featuredSectionKicker?.trim() || DEFAULT_SETTINGS.featuredSectionKicker,
    featuredSectionTitle: input?.featuredSectionTitle?.trim() || DEFAULT_SETTINGS.featuredSectionTitle,
    featuredSectionNote: input?.featuredSectionNote?.trim() || DEFAULT_SETTINGS.featuredSectionNote,
    defaultTheme: resolveThemeMode(input?.defaultTheme)
  };
}

export function safeTrim(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function createNormalizedLink(input: CreateLinkInput, now = nowIso()): LinkRecord {
  const icon = input.icon.trim();
  const iconMode = resolveIconMode(icon);
  const displayChipPrimary = input.displayChipPrimary?.trim() || null;
  const displayChipSecondary = input.displayChipSecondary?.trim() || null;

  return {
    id: "",
    title: input.title,
    url: input.url,
    description: input.description,
    icon,
    iconMode,
    iconUrl: iconMode === "custom" ? icon : null,
    faviconUrl: getFaviconFallback(input.url),
    displayChipPrimary,
    displayChipSecondary,
    normalizedDomain: normalizeDomain(input.url),
    status: "unknown",
    lastCheckedAt: null,
    httpStatus: null,
    faviconStatus: "idle",
    titleStatus: "idle",
    categoryId: input.categoryId,
    featured: input.featured,
    sortOrder: input.sortOrder,
    createdAt: now,
    updatedAt: now
  };
}

export function ensureLinkRecord(
  input: Partial<LinkRecord> &
    Pick<LinkRecord, "id" | "title" | "url" | "description" | "categoryId" | "featured" | "sortOrder" | "createdAt" | "updatedAt">
): LinkRecord {
  const icon = (input.icon ?? "").trim();
  const iconMode = input.iconMode ?? resolveIconMode(icon);
  const iconUrl = input.iconUrl ?? (iconMode === "custom" ? icon : null);
  const faviconUrl = input.faviconUrl ?? getFaviconFallback(input.url);
  const displayChipPrimary = input.displayChipPrimary?.trim() || null;
  const displayChipSecondary = input.displayChipSecondary?.trim() || null;
  const status = (input.status ?? "unknown") as LinkStatus;

  return {
    id: input.id,
    title: input.title,
    url: input.url,
    description: input.description,
    icon,
    iconMode,
    iconUrl,
    faviconUrl,
    displayChipPrimary,
    displayChipSecondary,
    normalizedDomain: input.normalizedDomain ?? normalizeDomain(input.url),
    status,
    lastCheckedAt: input.lastCheckedAt ?? null,
    httpStatus: input.httpStatus ?? null,
    faviconStatus: input.faviconStatus ?? "idle",
    titleStatus: input.titleStatus ?? "idle",
    categoryId: input.categoryId,
    featured: input.featured,
    sortOrder: input.sortOrder,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

export function ensureLinkMetadataRecord(
  input: Partial<LinkMetadataRecord> & Pick<LinkMetadataRecord, "linkId">
): LinkMetadataRecord {
  return {
    linkId: input.linkId,
    resolvedTitle: input.resolvedTitle ?? null,
    resolvedDescription: input.resolvedDescription ?? null,
    siteName: input.siteName ?? null,
    canonicalUrl: input.canonicalUrl ?? null,
    faviconUrl: input.faviconUrl ?? null,
    ogImageUrl: input.ogImageUrl ?? null,
    lastFetchedAt: input.lastFetchedAt ?? null,
    fetchStatus: input.fetchStatus === "queued" || input.fetchStatus === "ok" || input.fetchStatus === "error" ? input.fetchStatus : "idle",
    lastError: input.lastError ?? null
  };
}

export function ensureDirectoryStore(input?: Partial<DirectoryStore>): DirectoryStore {
  return {
    categories: sortCategories((input?.categories ?? []).map((category) => ensureCategoryRecord(category))),
    links: sortLinks((input?.links ?? []).map((link) => ensureLinkRecord(link))),
    linkMetadata: sortLinkMetadataRecords((input?.linkMetadata ?? []).map((record) => ensureLinkMetadataRecord(record))),
    linkChecks: sortLinkChecks(input?.linkChecks ?? []),
    importBatches: sortImportBatches(input?.importBatches ?? []),
    settings: ensureSettings(input?.settings)
  };
}
