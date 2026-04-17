import "server-only";

import { getPreferredFaviconSourceMap } from "@/lib/favicon-preferences";
import { prisma } from "@/lib/prisma";
import { getStorageMode, getTaskRunnerBatchLimit, getTaskRunnerRetryBackoffMs } from "@/lib/env";
import { resolveSecondaryEntryQuote } from "@/lib/secondary-entry-note";
import {
  getAdminOverviewStats,
  getCategoryBySlug,
  getGroupedCategories,
  getLinkChecks,
  getLinkMetadataRecords,
  getLinkRecords,
  getSettings,
  getStore
} from "@/lib/repository";
import { findMatchingSearchDocumentIds } from "@/lib/search-index";
import { getPublicDirectoryCatalog, searchDirectory, searchParamsFromRecord } from "@/lib/search";
import { getJobSummary, listJobs } from "@/lib/tasks";
import { getCollectionEditorRecords, getCollectionRecords, getSavedViewRecords, getTagEditorRecords, getTagRecords } from "@/lib/taxonomy";
import { ADMIN_FEATURED_CATEGORY_FILTER } from "@/lib/types";
import type {
  AdminLinksQueryState,
  AdminLinksSort,
  AdminLinksMetadataFilter,
  AdminMetadataQueryState,
  AdminMetadataRow,
  AdminMetadataSort,
  AdminLinkRow,
  CategoryWithLinks,
  CollectionRecord,
  CommandItemRecord,
  LensShortcut,
  PublicDirectoryLink,
  SavedViewRecord,
  SearchDirectoryParams,
  TagRecord
} from "@/lib/types";
import { decodeRouteParam } from "@/lib/utils";

function flattenAdminLinks(categories: CategoryWithLinks[], catalogMap?: Map<string, PublicDirectoryLink>): AdminLinkRow[] {
  return categories.flatMap((category) =>
    category.links.map((link) => {
      const enriched = catalogMap?.get(link.id);

      return {
        ...link,
        categoryName: category.name,
        categorySlug: category.slug,
        tags: enriched?.tags ?? [],
        collections: enriched?.collections ?? [],
        metadata: enriched?.metadata ?? null,
        metadataTitle: enriched?.metadata?.resolvedTitle ?? null,
        metadataDescription: enriched?.metadata?.resolvedDescription ?? null,
        preferredFaviconSource: enriched?.preferredFaviconSource ?? null
      };
    })
  );
}

function sortByRecent<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = Date.parse(left.updatedAt ?? left.createdAt ?? "");
    const rightValue = Date.parse(right.updatedAt ?? right.createdAt ?? "");
    return rightValue - leftValue;
  });
}

function buildCatalogMap(catalog: PublicDirectoryLink[]) {
  return new Map(catalog.map((link) => [link.id, link]));
}

function normalizeAdminLinksSort(value: string | undefined): AdminLinksSort {
  if (value === "updatedAt" || value === "title" || value === "category" || value === "metadata") {
    return value;
  }

  return "sortOrder";
}

function normalizeAdminLinksMetadataFilter(value: string | undefined): AdminLinksMetadataFilter {
  if (value === "idle" || value === "queued" || value === "ok" || value === "error") {
    return value;
  }

  return "all";
}

function normalizeAdminMetadataSort(value: string | undefined): AdminMetadataSort {
  if (value === "oldest" || value === "title" || value === "status") {
    return value;
  }

  return "recent";
}

function adminMetadataParamsFromRecord(input: Record<string, string | string[] | undefined>): AdminMetadataQueryState {
  const readValue = (key: keyof AdminMetadataQueryState) => {
    const raw = input[key];
    return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  };

  return {
    q: readValue("q").trim(),
    status: normalizeAdminLinksMetadataFilter(readValue("status")),
    sort: normalizeAdminMetadataSort(readValue("sort"))
  };
}

function adminLinksParamsFromRecord(input: Record<string, string | string[] | undefined>): AdminLinksQueryState {
  const readValue = (key: keyof AdminLinksQueryState) => {
    const raw = input[key];
    return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  };

  const featured = readValue("featured");
  const status = readValue("status");

  return {
    q: readValue("q").trim(),
    category: readValue("category").trim(),
    tag: readValue("tag").trim(),
    collection: readValue("collection").trim(),
    featured: featured === "true" || featured === "false" ? featured : "all",
    status: status === "healthy" || status === "warning" || status === "broken" || status === "unknown" ? status : "all",
    metadata: normalizeAdminLinksMetadataFilter(readValue("metadata")),
    sort: normalizeAdminLinksSort(readValue("sort"))
  };
}

async function filterAdminLinks(links: AdminLinkRow[], params: AdminLinksQueryState) {
  const keyword = params.q.toLowerCase();
  let keywordMatchedIds: Set<string> | null = null;

  if (getStorageMode() === "database" && keyword) {
    const matchingIds = await findMatchingSearchDocumentIds(keyword);
    keywordMatchedIds = new Set(matchingIds);
  }

  const filtered = links.filter((link) => {
    if (keywordMatchedIds && !keywordMatchedIds.has(link.id)) {
      return false;
    }

    if (!keywordMatchedIds && keyword) {
      const searchText = [
        link.title,
        link.description,
        link.url,
        link.categoryName,
        link.metadataTitle ?? "",
        link.metadataDescription ?? "",
        ...link.tags.map((tag) => tag.name),
        ...link.collections.map((collection) => collection.name)
      ]
        .join(" ")
        .toLowerCase();

      if (!searchText.includes(keyword)) {
        return false;
      }
    }

    if (params.category) {
      if (params.category === ADMIN_FEATURED_CATEGORY_FILTER) {
        if (!link.featured) {
          return false;
        }
      } else if (link.categoryId !== params.category) {
        return false;
      }
    }

    if (params.tag && !link.tags.some((tag) => tag.id === params.tag || tag.slug === params.tag)) {
      return false;
    }

    if (params.collection && !link.collections.some((collection) => collection.id === params.collection || collection.slug === params.collection)) {
      return false;
    }

    if (params.featured === "true" && !link.featured) {
      return false;
    }

    if (params.featured === "false" && link.featured) {
      return false;
    }

    if (params.status !== "all" && link.status !== params.status) {
      return false;
    }

    if (params.metadata !== "all" && (link.metadata?.fetchStatus ?? "idle") !== params.metadata) {
      return false;
    }

    return true;
  });

  return filtered.sort((left, right) => {
    if (params.sort === "title") {
      return left.title.localeCompare(right.title, "en");
    }

    if (params.sort === "updatedAt") {
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    }

    if (params.sort === "category") {
      return left.categoryName.localeCompare(right.categoryName, "en") || left.sortOrder - right.sortOrder;
    }

    if (params.sort === "metadata") {
      return (right.metadata?.lastFetchedAt ? Date.parse(right.metadata.lastFetchedAt) : 0) - (left.metadata?.lastFetchedAt ? Date.parse(left.metadata.lastFetchedAt) : 0);
    }

    return left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, "en");
  });
}

function sortAdminMetadataRows(rows: AdminMetadataRow[], filters: AdminMetadataQueryState) {
  return [...rows].sort((left, right) => {
    if (filters.sort === "title") {
      return left.title.localeCompare(right.title, "en");
    }

    if (filters.sort === "oldest") {
      return (Date.parse(left.lastFetchedAt ?? "") || 0) - (Date.parse(right.lastFetchedAt ?? "") || 0);
    }

    if (filters.sort === "status") {
      return left.fetchStatus.localeCompare(right.fetchStatus, "en") || left.title.localeCompare(right.title, "en");
    }

    return (Date.parse(right.lastFetchedAt ?? "") || 0) - (Date.parse(left.lastFetchedAt ?? "") || 0);
  });
}

function filterAdminMetadataRows(rows: AdminMetadataRow[], filters: AdminMetadataQueryState) {
  const keyword = filters.q.toLowerCase();

  return sortAdminMetadataRows(
    rows.filter((row) => {
      if (filters.status !== "all" && row.fetchStatus !== filters.status) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchText = [
        row.title,
        row.description,
        row.url,
        row.categoryName,
        row.resolvedTitle ?? "",
        row.resolvedDescription ?? "",
        row.canonicalUrl ?? ""
      ]
        .join(" ")
        .toLowerCase();

      return searchText.includes(keyword);
    }),
    filters
  );
}

function buildCommandItems(
  categories: CategoryWithLinks[],
  tags: TagRecord[],
  collections: CollectionRecord[],
  savedViews: SavedViewRecord[],
  catalog: PublicDirectoryLink[]
): CommandItemRecord[] {
  const categoryItems = categories.map((category) => ({
    id: `category-${category.id}`,
    label: category.name,
    hint: "category",
    kind: "category" as const,
    href: `/category/${category.slug}`
  }));

  const tagItems = tags.map((tag) => ({
    id: `tag-${tag.id}`,
    label: tag.name,
    hint: "tag",
    kind: "tag" as const,
    href: `/tag/${tag.slug}`
  }));

  const collectionItems = collections
    .filter((collection) => collection.published)
    .map((collection) => ({
      id: `collection-${collection.id}`,
      label: collection.name,
      hint: "collection",
      kind: "collection" as const,
      href: `/collection/${collection.slug}`
    }));

  const viewItems = savedViews
    .filter((view) => view.published)
    .map((view) => ({
      id: `view-${view.id}`,
      label: view.name,
      hint: "saved view",
      kind: "view" as const,
      href: `/view/${view.slug}`
    }));

  const linkItems = catalog.map((link) => ({
    id: `link-${link.id}`,
    label: link.displayTitle,
    hint: link.categoryName,
    kind: "link" as const,
    href: link.url
  }));

  return [...categoryItems, ...tagItems, ...collectionItems, ...viewItems, ...linkItems];
}

function buildLensShortcuts(catalog: PublicDirectoryLink[], tags: TagRecord[], collections: CollectionRecord[], savedViews: SavedViewRecord[]) {
  const tagUsage = new Map<string, number>();

  for (const link of catalog) {
    for (const tag of link.tags) {
      tagUsage.set(tag.slug, (tagUsage.get(tag.slug) ?? 0) + 1);
    }
  }

  const tagShortcuts: LensShortcut[] = tags
    .filter((tag) => tagUsage.has(tag.slug))
    .sort((left, right) => (tagUsage.get(right.slug) ?? 0) - (tagUsage.get(left.slug) ?? 0) || left.sortOrder - right.sortOrder)
    .slice(0, 6)
    .map((tag) => ({
      id: tag.id,
      label: tag.name,
      href: `/tag/${tag.slug}`,
      hint: "tag",
      count: tagUsage.get(tag.slug) ?? 0
    }));

  const collectionShortcuts: LensShortcut[] = collections
    .filter((collection) => collection.published)
    .slice(0, 4)
    .map((collection) => ({
      id: collection.id,
      label: collection.name,
      href: `/collection/${collection.slug}`,
      hint: "collection"
    }));

  const viewShortcuts: LensShortcut[] = savedViews
    .filter((view) => view.published)
    .slice(0, 4)
    .map((view) => ({
      id: view.id,
      label: view.name,
      href: `/view/${view.slug}`,
      hint: "view"
    }));

  return {
    tags: tagShortcuts,
    collections: collectionShortcuts,
    views: viewShortcuts
  };
}

async function getPublicShellData() {
  const [categories, settings, tags, collections, savedViews, catalog] = await Promise.all([
    getGroupedCategories(),
    getSettings(),
    getTagRecords(),
    getCollectionRecords(),
    getSavedViewRecords(),
    getPublicDirectoryCatalog()
  ]);

  return {
    categories,
    settings,
    tags,
    collections,
    savedViews,
    catalog,
    commandItems: buildCommandItems(categories, tags, collections, savedViews, catalog),
    lensShortcuts: buildLensShortcuts(catalog, tags, collections, savedViews)
  };
}

export async function getHomePageData() {
  const { categories, settings, commandItems, lensShortcuts, catalog } = await getPublicShellData();
  const featuredLinks = catalog.filter((link) => link.featured).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 8);
  const secondaryEntryQuote = await resolveSecondaryEntryQuote(settings);

  return {
    categories,
    settings,
    featuredLinks,
    commandItems,
    lensShortcuts,
    secondaryEntryQuote
  };
}

export async function getCategoryPageData(slug: string) {
  const normalizedSlug = decodeRouteParam(slug);
  const { categories, settings, commandItems, lensShortcuts } = await getPublicShellData();
  const category = categories.find((item) => item.slug === normalizedSlug) ?? (await getCategoryBySlug(normalizedSlug));
  const searchResult = category ? await searchDirectory({ category: normalizedSlug }) : null;

  return {
    category,
    settings,
    categories,
    commandItems,
    lensShortcuts,
    searchResult
  };
}

export async function getTagPageData(slug: string) {
  const normalizedSlug = decodeRouteParam(slug);
  const shell = await getPublicShellData();
  const tag = shell.tags.find((item) => item.slug === normalizedSlug) ?? null;
  const result = await searchDirectory({ tag: normalizedSlug });

  return {
    ...shell,
    tag,
    searchResult: result
  };
}

export async function getCollectionPageData(slug: string) {
  const normalizedSlug = decodeRouteParam(slug);
  const shell = await getPublicShellData();
  const collection = shell.collections.find((item) => item.slug === normalizedSlug && item.published) ?? null;
  const result = await searchDirectory({ collection: normalizedSlug });

  return {
    ...shell,
    collection,
    searchResult: result
  };
}

export async function getSavedViewPageData(slug: string) {
  const normalizedSlug = decodeRouteParam(slug);
  const shell = await getPublicShellData();
  const savedView = shell.savedViews.find((item) => item.slug === normalizedSlug && item.published) ?? null;
  const result = await searchDirectory(savedView?.queryState ?? {});

  return {
    ...shell,
    savedView,
    searchResult: result
  };
}

export async function getSearchPageData(searchParams: Record<string, string | string[] | undefined>) {
  const shell = await getPublicShellData();
  const params = searchParamsFromRecord(searchParams);
  const result = await searchDirectory(params);

  return {
    ...shell,
    searchResult: result
  };
}

async function buildAugmentedOverviewStats() {
  const [stats, tags, collections, savedViews, taskSummary] = await Promise.all([
    getAdminOverviewStats(),
    getTagRecords(),
    getCollectionRecords(),
    getSavedViewRecords(),
    getJobSummary()
  ]);

  return {
    ...stats,
    tagCount: tags.length,
    collectionCount: collections.length,
    savedViewCount: savedViews.length,
    queuedJobCount: taskSummary.queued,
    runningJobCount: taskSummary.running,
    failedJobCount: taskSummary.failed
  };
}

export async function getAdminLayoutData() {
  const [settings, stats] = await Promise.all([getSettings(), buildAugmentedOverviewStats()]);

  return {
    settings,
    stats
  };
}

export async function getAdminOverviewPageData() {
  const [categories, settings, stats, store, taskSummary] = await Promise.all([
    getGroupedCategories(),
    getSettings(),
    buildAugmentedOverviewStats(),
    getStore(),
    getJobSummary()
  ]);
  const links = flattenAdminLinks(categories, buildCatalogMap(await getPublicDirectoryCatalog()));

  return {
    categories,
    settings,
    stats,
    taskSummary,
    featuredLinks: links.filter((link) => link.featured).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 6),
    recentLinks: sortByRecent(links).slice(0, 6),
    recentImportBatches: [...store.importBatches].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 4)
  };
}

export async function getAdminLinksPageData(searchParams?: Record<string, string | string[] | undefined>) {
  const advancedEnabled = getStorageMode() === "database";
  const [categories, settings, stats, catalog, tags, collections] = await Promise.all([
    getGroupedCategories(),
    getSettings(),
    buildAugmentedOverviewStats(),
    getPublicDirectoryCatalog(),
    getTagRecords(),
    getCollectionRecords()
  ]);

  const allLinks = flattenAdminLinks(categories, buildCatalogMap(catalog));
  const filters = adminLinksParamsFromRecord(searchParams ?? {});
  const filteredLinks = await filterAdminLinks(allLinks, filters);

  return {
    advancedEnabled,
    categories,
    tags,
    collections,
    filters,
    totalLinkCount: allLinks.length,
    links: filteredLinks,
    settings,
    stats
  };
}

export async function getAdminCategoriesPageData() {
  const [categories, stats] = await Promise.all([getGroupedCategories(), buildAugmentedOverviewStats()]);

  return {
    categories,
    stats
  };
}

export async function getAdminTagsPageData() {
  const advancedEnabled = getStorageMode() === "database";
  const [stats, tags, catalog] = await Promise.all([buildAugmentedOverviewStats(), getTagEditorRecords(), getPublicDirectoryCatalog()]);

  return {
    advancedEnabled,
    stats,
    tags,
    links: catalog
  };
}

export async function getAdminCollectionsPageData() {
  const advancedEnabled = getStorageMode() === "database";
  const [stats, collections, catalog] = await Promise.all([
    buildAugmentedOverviewStats(),
    getCollectionEditorRecords(),
    getPublicDirectoryCatalog()
  ]);

  return {
    advancedEnabled,
    stats,
    collections,
    links: catalog
  };
}

export async function getAdminViewsPageData() {
  const advancedEnabled = getStorageMode() === "database";
  const [stats, savedViews, categories, tags, collections] = await Promise.all([
    buildAugmentedOverviewStats(),
    getSavedViewRecords(),
    getGroupedCategories(),
    getTagRecords(),
    getCollectionRecords()
  ]);

  return {
    advancedEnabled,
    stats,
    savedViews,
    categories,
    tags,
    collections
  };
}

export async function getAdminSettingsPageData() {
  const [settings, stats] = await Promise.all([getSettings(), buildAugmentedOverviewStats()]);

  return {
    settings,
    stats
  };
}

export async function getAdminImportPageData() {
  const [categories, store, stats] = await Promise.all([getGroupedCategories(), getStore(), buildAugmentedOverviewStats()]);

  return {
    categories,
    links: store.links,
    batches: [...store.importBatches].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    stats
  };
}

export async function getAdminHealthPageData() {
  const [categories, allChecks, stats] = await Promise.all([getGroupedCategories(), getLinkChecks(), buildAugmentedOverviewStats()]);
  const sortedChecks = [...allChecks].sort((left, right) => Date.parse(right.checkedAt) - Date.parse(left.checkedAt));
  const latestChecksByLinkId: Record<string, (typeof sortedChecks)[number]> = {};

  for (const check of sortedChecks) {
    if (!latestChecksByLinkId[check.linkId]) {
      latestChecksByLinkId[check.linkId] = check;
    }
  }

  return {
    links: flattenAdminLinks(categories, buildCatalogMap(await getPublicDirectoryCatalog())),
    checkCount: sortedChecks.length,
    latestChecksByLinkId,
    recentChecks: sortedChecks.slice(0, 10),
    stats
  };
}

export async function getAdminTasksPageData() {
  const advancedEnabled = getStorageMode() === "database";

  if (!advancedEnabled) {
    return {
      advancedEnabled,
      jobs: [],
      taskSummary: {
        queued: 0,
        running: 0,
        failed: 0,
        succeeded: 0
      },
      runnerConfig: {
        batchLimit: getTaskRunnerBatchLimit(),
        retryBackoffMs: getTaskRunnerRetryBackoffMs(),
        endpoint: "/api/internal/tasks/run"
      }
    };
  }

  const [jobs, taskSummary] = await Promise.all([listJobs(40), getJobSummary()]);

  return {
    advancedEnabled,
    jobs,
    taskSummary,
    runnerConfig: {
      batchLimit: getTaskRunnerBatchLimit(),
      retryBackoffMs: getTaskRunnerRetryBackoffMs(),
      endpoint: "/api/internal/tasks/run"
    }
  };
}

export async function getAdminMetadataPageData(searchParams?: Record<string, string | string[] | undefined>) {
  const advancedEnabled = getStorageMode() === "database";
  const stats = await buildAugmentedOverviewStats();
  const filters = adminMetadataParamsFromRecord(searchParams ?? {});

  if (!advancedEnabled) {
    const [links, metadataRecords, categories] = await Promise.all([getLinkRecords(), getLinkMetadataRecords(), getGroupedCategories()]);
    const metadataMap = new Map(metadataRecords.map((record) => [record.linkId, record]));
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const preferredSourceMap = await getPreferredFaviconSourceMap(links.map((link) => link.id));

    const serializedRows: AdminMetadataRow[] = links.map((link) => {
      const metadata = metadataMap.get(link.id) ?? null;
      const category = categoryMap.get(link.categoryId);

      return {
        linkId: link.id,
        title: link.title,
        url: link.url,
        description: link.description,
        categoryName: category?.name ?? "",
        categorySlug: category?.slug ?? "",
        fetchStatus: metadata?.fetchStatus ?? "idle",
        lastFetchedAt: metadata?.lastFetchedAt ?? null,
        lastError: metadata?.lastError ?? null,
        resolvedTitle: metadata?.resolvedTitle ?? null,
        resolvedDescription: metadata?.resolvedDescription ?? null,
        canonicalUrl: metadata?.canonicalUrl ?? null,
        faviconUrl: metadata?.faviconUrl ?? link.faviconUrl ?? null,
        preferredFaviconSource: preferredSourceMap.get(link.id) ?? null,
        updatedAt: link.updatedAt
      };
    });

    const summary = serializedRows.reduce(
      (accumulator, row) => {
        accumulator[row.fetchStatus] += 1;
        return accumulator;
      },
      {
        queued: 0,
        ok: 0,
        error: 0,
        idle: 0
      }
    );

    return {
      advancedEnabled,
      stats,
      filters,
      rows: filterAdminMetadataRows(serializedRows, filters),
      summary
    };
  }

  const rows = await prisma.link.findMany({
    include: {
      category: true,
      metadata: true
    },
    orderBy: [{ updatedAt: "desc" }]
  });
  const preferredSourceMap = await getPreferredFaviconSourceMap(rows.map((link) => link.id));

  const serializedRows: AdminMetadataRow[] = rows.map((link) => ({
    linkId: link.id,
    title: link.title,
    url: link.url,
    description: link.description,
    categoryName: link.category.name,
    categorySlug: link.category.slug,
    fetchStatus:
      link.metadata?.fetchStatus === "queued" || link.metadata?.fetchStatus === "ok" || link.metadata?.fetchStatus === "error"
        ? link.metadata.fetchStatus
        : "idle",
    lastFetchedAt: link.metadata?.lastFetchedAt?.toISOString() ?? null,
    lastError: link.metadata?.lastError ?? null,
    resolvedTitle: link.metadata?.resolvedTitle ?? null,
    resolvedDescription: link.metadata?.resolvedDescription ?? null,
    canonicalUrl: link.metadata?.canonicalUrl ?? null,
    faviconUrl: link.metadata?.faviconUrl ?? null,
    preferredFaviconSource: preferredSourceMap.get(link.id) ?? null,
    updatedAt: link.updatedAt.toISOString()
  }));

  const summary = serializedRows.reduce(
    (accumulator, row) => {
      accumulator[row.fetchStatus] += 1;
      return accumulator;
    },
    {
      queued: 0,
      ok: 0,
      error: 0,
      idle: 0
    }
  );

  return {
    advancedEnabled,
    stats,
    filters,
    rows: filterAdminMetadataRows(serializedRows, filters),
    summary
  };
}

export async function getAdminPageData() {
  return getAdminLinksPageData();
}
