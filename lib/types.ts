export type ThemeMode = "light" | "dark";
export type StorageMode = "file" | "database";
export type SecondaryEntrySource = "hitokoto" | "jinrishici";
export type LinkIconMode = "auto" | "builtin" | "custom";
export type LinkStatus = "unknown" | "healthy" | "warning" | "broken";
export type LinkCheckState = "idle" | "ok" | "error";
export type ImportSourceType = "json" | "bookmarks-html";
export type MetadataFetchStatus = "idle" | "queued" | "ok" | "error";
export type JobType = "HEALTH_CHECK" | "METADATA_REFRESH" | "SEARCH_REINDEX";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type SearchSort = "relevance" | "title" | "recent" | "featured";
export type SearchFeaturedFilter = "all" | "true" | "false";
export type SearchStatusFilter = LinkStatus | "all";
export type AdminLinksSort = "sortOrder" | "updatedAt" | "title" | "category" | "metadata";
export type AdminLinksMetadataFilter = MetadataFetchStatus | "all";
export type AdminMetadataSort = "recent" | "oldest" | "title" | "status";
export const ADMIN_FEATURED_CATEGORY_FILTER = "__featured__";

export type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
};

export type TagRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CollectionRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SavedViewQueryState = {
  q: string;
  category: string;
  tag: string;
  collection: string;
  featured: SearchFeaturedFilter;
  status: SearchStatusFilter;
  sort: SearchSort;
};

export type SavedViewRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  sortOrder: number;
  queryState: SavedViewQueryState;
  createdAt: string;
  updatedAt: string;
};

export type LinkTagRecord = {
  linkId: string;
  tagId: string;
  createdAt: string;
};

export type CollectionLinkRecord = {
  collectionId: string;
  linkId: string;
  sortOrder: number;
  createdAt: string;
};

export type CreateCategoryInput = Pick<CategoryRecord, "name" | "description" | "icon" | "sortOrder"> & {
  slug?: string;
};
export type UpdateCategoryInput = Pick<CategoryRecord, "id" | "name" | "description" | "icon" | "sortOrder"> & {
  slug?: string;
};
export type CreateTagInput = Pick<TagRecord, "name" | "description" | "sortOrder"> & { linkIds?: string[] };
export type UpdateTagInput = Pick<TagRecord, "id" | "name" | "description" | "sortOrder"> & { linkIds?: string[] };
export type CreateCollectionInput = Pick<CollectionRecord, "name" | "description" | "published" | "sortOrder"> & { linkIds?: string[] };
export type UpdateCollectionInput = Pick<CollectionRecord, "id" | "name" | "description" | "published" | "sortOrder"> & { linkIds?: string[] };
export type CreateSavedViewInput = Pick<SavedViewRecord, "name" | "description" | "published" | "sortOrder" | "queryState">;
export type UpdateSavedViewInput = Pick<SavedViewRecord, "id" | "name" | "description" | "published" | "sortOrder" | "queryState">;

export type LinkRecord = {
  id: string;
  title: string;
  url: string;
  description: string;
  icon: string;
  iconMode: LinkIconMode;
  iconUrl: string | null;
  faviconUrl: string | null;
  displayChipPrimary: string | null;
  displayChipSecondary: string | null;
  normalizedDomain: string;
  status: LinkStatus;
  lastCheckedAt: string | null;
  httpStatus: number | null;
  faviconStatus: LinkCheckState;
  titleStatus: LinkCheckState;
  categoryId: string;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateLinkInput = Pick<LinkRecord, "title" | "url" | "description" | "icon" | "categoryId" | "featured" | "sortOrder" | "displayChipPrimary" | "displayChipSecondary">;
export type UpdateLinkInput = Pick<LinkRecord, "id" | "title" | "url" | "description" | "icon" | "categoryId" | "featured" | "sortOrder" | "displayChipPrimary" | "displayChipSecondary">;

export type LinkMetadataRecord = {
  linkId: string;
  resolvedTitle: string | null;
  resolvedDescription: string | null;
  siteName: string | null;
  canonicalUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  lastFetchedAt: string | null;
  fetchStatus: MetadataFetchStatus;
  lastError: string | null;
};

export type LinkSearchDocumentRecord = {
  linkId: string;
  titleText: string;
  taxonomyText: string;
  metadataText: string;
  documentText: string;
  updatedAt: string;
};

export type ReindexJobPayload = {
  scope: "full";
} | {
  scope: "links";
  linkIds: string[];
};

export type JobRecord = {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteSettingsRecord = {
  id: string;
  siteName: string;
  brandMark: string;
  brandSub: string;
  homeRailLabel: string;
  homeRailIcon: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  secondaryEntrySource: SecondaryEntrySource;
  secondaryEntryFallback: string;
  featuredSectionKicker: string;
  featuredSectionTitle: string;
  featuredSectionNote: string;
  accentColor: string;
  defaultTheme: ThemeMode;
  adminBranding: string;
};

export type UpdateSettingsInput = Pick<
  SiteSettingsRecord,
  | "siteName"
  | "brandMark"
  | "brandSub"
  | "homeRailLabel"
  | "homeRailIcon"
  | "heroEyebrow"
  | "heroTitle"
  | "heroSubtitle"
  | "secondaryEntrySource"
  | "secondaryEntryFallback"
  | "featuredSectionKicker"
  | "featuredSectionTitle"
  | "featuredSectionNote"
  | "accentColor"
  | "defaultTheme"
  | "adminBranding"
>;

export type LinkCheckRecord = {
  id: string;
  linkId: string;
  checkedAt: string;
  httpStatus: number | null;
  faviconStatus: LinkCheckState;
  titleStatus: LinkCheckState;
  note: string | null;
};

export type ImportBatchRecord = {
  id: string;
  sourceType: ImportSourceType;
  filename: string | null;
  itemCount: number;
  importedCount: number;
  skippedCount: number;
  createdAt: string;
};

export type DirectoryStore = {
  categories: CategoryRecord[];
  links: LinkRecord[];
  linkMetadata: LinkMetadataRecord[];
  linkChecks: LinkCheckRecord[];
  importBatches: ImportBatchRecord[];
  settings: SiteSettingsRecord;
};

export type CategoryWithLinks = CategoryRecord & {
  links: LinkRecord[];
};

export type AdminLinkRow = LinkRecord & {
  categoryName: string;
  categorySlug: string;
  tags: Array<Pick<TagRecord, "id" | "name" | "slug">>;
  collections: Array<Pick<CollectionRecord, "id" | "name" | "slug">>;
  metadata: LinkMetadataRecord | null;
  metadataTitle: string | null;
  metadataDescription: string | null;
  preferredFaviconSource: string | null;
};

export type AdminOverviewStats = {
  categoryCount: number;
  linkCount: number;
  featuredCount: number;
  brokenCount: number;
  importBatchCount: number;
  tagCount: number;
  collectionCount: number;
  savedViewCount: number;
  queuedJobCount: number;
  runningJobCount: number;
  failedJobCount: number;
};

export type PublicDirectoryLink = LinkRecord & {
  categoryName: string;
  categorySlug: string;
  tags: Array<Pick<TagRecord, "id" | "name" | "slug">>;
  collections: Array<Pick<CollectionRecord, "id" | "name" | "slug">>;
  metadata: LinkMetadataRecord | null;
  displayTitle: string;
  displayDescription: string;
  preferredFaviconSource: string | null;
};

export type FacetOption = {
  value: string;
  label: string;
  count: number;
};

export type SearchDirectoryParams = {
  q: string;
  category: string;
  tag: string;
  collection: string;
  featured: SearchFeaturedFilter;
  status: SearchStatusFilter;
  sort: SearchSort;
};

export type SearchFacetCounts = {
  categories: FacetOption[];
  tags: FacetOption[];
  collections: FacetOption[];
  statuses: FacetOption[];
};

export type SearchDirectoryResult = {
  params: SearchDirectoryParams;
  total: number;
  results: PublicDirectoryLink[];
  facets: SearchFacetCounts;
};

export type AdminLinksQueryState = {
  q: string;
  category: string;
  tag: string;
  collection: string;
  featured: SearchFeaturedFilter;
  status: SearchStatusFilter;
  metadata: AdminLinksMetadataFilter;
  sort: AdminLinksSort;
};

export type JobSummary = {
  queued: number;
  running: number;
  failed: number;
  succeeded: number;
};

export type AdminMetadataQueryState = {
  q: string;
  status: MetadataFetchStatus | "all";
  sort: AdminMetadataSort;
};

export type AdminMetadataRow = {
  linkId: string;
  title: string;
  url: string;
  description: string;
  categoryName: string;
  categorySlug: string;
  fetchStatus: MetadataFetchStatus;
  lastFetchedAt: string | null;
  lastError: string | null;
  resolvedTitle: string | null;
  resolvedDescription: string | null;
  canonicalUrl: string | null;
  faviconUrl: string | null;
  preferredFaviconSource: string | null;
  updatedAt: string;
};

export type CommandItemRecord = {
  id: string;
  label: string;
  hint: string;
  kind: "link" | "category" | "tag" | "collection" | "view" | "action";
  href?: string;
  action?: "theme" | "admin";
};

export type LensShortcut = {
  id: string;
  label: string;
  href: string;
  hint: string;
  count?: number;
};

export type TagWithLinks = TagRecord & {
  links: PublicDirectoryLink[];
};

export type CollectionWithLinks = CollectionRecord & {
  links: PublicDirectoryLink[];
};

export type TagEditorRecord = TagRecord & {
  linkIds: string[];
};

export type CollectionEditorRecord = CollectionRecord & {
  linkIds: string[];
};
