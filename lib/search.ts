import "server-only";

import { getPreferredFaviconSourceMap } from "@/lib/favicon-preferences";
import { prisma } from "@/lib/prisma";
import { getStorageMode } from "@/lib/env";
import { getStore } from "@/lib/repository";
import { findMatchingSearchDocumentIds } from "@/lib/search-index";
import type {
  CollectionRecord,
  FacetOption,
  LinkMetadataRecord,
  PublicDirectoryLink,
  SearchDirectoryParams,
  SearchDirectoryResult,
  SearchFeaturedFilter,
  SearchSort,
  SearchStatusFilter,
  TagRecord
} from "@/lib/types";
import { decodeRouteParam, getDomain } from "@/lib/utils";

function normalizeMetadataFetchStatus(value: string | null | undefined): LinkMetadataRecord["fetchStatus"] {
  if (value === "queued" || value === "ok" || value === "error") {
    return value;
  }

  return "idle";
}

function normalizeSearchSort(value: string | undefined): SearchSort {
  if (value === "title" || value === "recent" || value === "featured") {
    return value;
  }

  return "relevance";
}

function normalizeFeaturedFilter(value: string | undefined): SearchFeaturedFilter {
  if (value === "true" || value === "false") {
    return value;
  }

  return "all";
}

function normalizeStatusFilter(value: string | undefined): SearchStatusFilter {
  if (value === "healthy" || value === "warning" || value === "broken" || value === "unknown") {
    return value;
  }

  return "all";
}

export function normalizeSearchParams(input?: Partial<SearchDirectoryParams>): SearchDirectoryParams {
  return {
    q: input?.q?.trim() ?? "",
    category: input?.category?.trim() ? decodeRouteParam(input.category.trim()) : "",
    tag: input?.tag?.trim() ? decodeRouteParam(input.tag.trim()) : "",
    collection: input?.collection?.trim() ? decodeRouteParam(input.collection.trim()) : "",
    featured: normalizeFeaturedFilter(input?.featured),
    status: normalizeStatusFilter(input?.status),
    sort: normalizeSearchSort(input?.sort)
  };
}

export function searchParamsFromRecord(input: Record<string, string | string[] | undefined>) {
  const readValue = (key: keyof SearchDirectoryParams) => {
    const raw = input[key];
    return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  };

  return normalizeSearchParams({
    q: readValue("q"),
    category: readValue("category"),
    tag: readValue("tag"),
    collection: readValue("collection"),
    featured: readValue("featured") as SearchFeaturedFilter,
    status: readValue("status") as SearchStatusFilter,
    sort: readValue("sort") as SearchSort
  });
}

function createSearchText(link: PublicDirectoryLink) {
  return [
    link.title,
    link.displayTitle,
    link.description,
    link.displayDescription,
    link.url,
    link.normalizedDomain,
    link.categoryName,
    ...link.tags.map((tag) => tag.name),
    ...link.collections.map((collection) => collection.name),
    link.metadata?.resolvedTitle ?? "",
    link.metadata?.resolvedDescription ?? "",
    link.metadata?.siteName ?? ""
  ]
    .join(" ")
    .toLowerCase();
}

function computeRelevance(link: PublicDirectoryLink, keyword: string) {
  if (!keyword) {
    return 0;
  }

  const searchText = createSearchText(link);
  if (!searchText.includes(keyword)) {
    return -1;
  }

  let score = 0;

  if (link.title.toLowerCase().includes(keyword)) score += 4;
  if (link.displayTitle.toLowerCase().includes(keyword)) score += 3;
  if (link.description.toLowerCase().includes(keyword)) score += 2;
  if (link.tags.some((tag) => tag.name.toLowerCase().includes(keyword))) score += 2;
  if (link.collections.some((collection) => collection.name.toLowerCase().includes(keyword))) score += 2;
  if (link.normalizedDomain.includes(keyword)) score += 1;

  return score;
}

function toFacetOptions(items: Array<{ value: string; label: string }>) {
  const counts = new Map<string, FacetOption>();

  for (const item of items) {
    if (!item.value) {
      continue;
    }

    const existing = counts.get(item.value);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(item.value, {
        value: item.value,
        label: item.label,
        count: 1
      });
    }
  }

  return [...counts.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "en"));
}

function sortPublicLinks(links: PublicDirectoryLink[], sort: SearchSort, keyword: string) {
  return [...links].sort((left, right) => {
    if (sort === "title") {
      return left.displayTitle.localeCompare(right.displayTitle, "en");
    }

    if (sort === "recent") {
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    }

    if (sort === "featured") {
      return Number(right.featured) - Number(left.featured) || left.sortOrder - right.sortOrder;
    }

    const relevanceDelta = computeRelevance(right, keyword) - computeRelevance(left, keyword);
    if (relevanceDelta !== 0) {
      return relevanceDelta;
    }

    return Number(right.featured) - Number(left.featured) || left.sortOrder - right.sortOrder;
  });
}

function filterPublicLinks(links: PublicDirectoryLink[], params: SearchDirectoryParams) {
  const keyword = params.q.trim().toLowerCase();

  return links.filter((link) => {
    if (keyword && computeRelevance(link, keyword) < 0) {
      return false;
    }

    if (params.category && link.categorySlug !== params.category && link.categoryId !== params.category) {
      return false;
    }

    if (params.tag && !link.tags.some((tag) => tag.slug === params.tag || tag.id === params.tag)) {
      return false;
    }

    if (params.collection && !link.collections.some((collection) => collection.slug === params.collection || collection.id === params.collection)) {
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

    return true;
  });
}

export async function getPublicDirectoryCatalog(): Promise<PublicDirectoryLink[]> {
  if (getStorageMode() === "database") {
    const links = await prisma.link.findMany({
      include: {
        category: true,
        metadata: true,
        tags: {
          include: {
            tag: true
          }
        },
        collections: {
          include: {
            collection: true
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }]
    });
    const preferredSourceMap = await getPreferredFaviconSourceMap(links.map((link) => link.id));

    return links.map((link) => {
      const metadata: LinkMetadataRecord | null =
        link.metadata == null
          ? null
          : {
              linkId: link.metadata.linkId,
              resolvedTitle: link.metadata.resolvedTitle,
              resolvedDescription: link.metadata.resolvedDescription,
              siteName: link.metadata.siteName,
              canonicalUrl: link.metadata.canonicalUrl,
              faviconUrl: link.metadata.faviconUrl,
              ogImageUrl: link.metadata.ogImageUrl,
              lastFetchedAt: link.metadata.lastFetchedAt?.toISOString() ?? null,
              fetchStatus: normalizeMetadataFetchStatus(link.metadata.fetchStatus),
              lastError: link.metadata.lastError
            };

      return {
        id: link.id,
        title: link.title,
        url: link.url,
        description: link.description,
        icon: link.icon,
        iconMode: link.iconMode === "custom" || link.iconMode === "builtin" ? link.iconMode : "auto",
        iconUrl: link.iconUrl,
        faviconUrl: link.faviconUrl,
        displayChipPrimary: link.displayChipPrimary,
        displayChipSecondary: link.displayChipSecondary,
        normalizedDomain: link.normalizedDomain || getDomain(link.url),
        status: link.status === "healthy" || link.status === "warning" || link.status === "broken" ? link.status : "unknown",
        lastCheckedAt: link.lastCheckedAt?.toISOString() ?? null,
        httpStatus: link.httpStatus,
        faviconStatus: link.faviconStatus === "ok" || link.faviconStatus === "error" ? link.faviconStatus : "idle",
        titleStatus: link.titleStatus === "ok" || link.titleStatus === "error" ? link.titleStatus : "idle",
        categoryId: link.categoryId,
        featured: link.featured,
        sortOrder: link.sortOrder,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
        categoryName: link.category.name,
        categorySlug: link.category.slug,
        tags: link.tags
          .map((item) => item.tag)
          .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "en"))
          .map((tag) => ({
            id: tag.id,
            name: tag.name,
            slug: tag.slug
          })),
        collections: link.collections
          .map((item) => item.collection)
          .filter((collection) => collection.published)
          .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "en"))
          .map((collection) => ({
            id: collection.id,
            name: collection.name,
            slug: collection.slug
          })),
        metadata,
        displayTitle: link.title || metadata?.resolvedTitle || getDomain(link.url),
        displayDescription: link.description || metadata?.resolvedDescription || "",
        preferredFaviconSource: preferredSourceMap.get(link.id) ?? null
      };
    });
  }

  const store = await getStore();
  const metadataMap = new Map(store.linkMetadata.map((record) => [record.linkId, record]));
  const preferredSourceMap = await getPreferredFaviconSourceMap(store.links.map((link) => link.id));

  return store.categories.flatMap((category) =>
    store.links
      .filter((link) => link.categoryId === category.id)
      .map((link) => {
        const metadata = metadataMap.get(link.id) ?? null;

        return {
          ...link,
          categoryName: category.name,
          categorySlug: category.slug,
          tags: [],
          collections: [],
          metadata,
          displayTitle: link.title || metadata?.resolvedTitle || getDomain(link.url),
          displayDescription: link.description || metadata?.resolvedDescription || "",
          preferredFaviconSource: preferredSourceMap.get(link.id) ?? null
        };
      })
  );
}

export async function searchDirectory(input?: Partial<SearchDirectoryParams>): Promise<SearchDirectoryResult> {
  const params = normalizeSearchParams(input);
  const catalog = await getPublicDirectoryCatalog();
  let projectionScopedCatalog = catalog;

  if (getStorageMode() === "database" && params.q) {
    const matchingIds = await findMatchingSearchDocumentIds(params.q);
    const rankedIds = new Map(matchingIds.map((id, index) => [id, index]));

    projectionScopedCatalog = catalog
      .filter((link) => rankedIds.has(link.id))
      .sort((left, right) => (rankedIds.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rankedIds.get(right.id) ?? Number.MAX_SAFE_INTEGER));
  }

  const filteredLinks = filterPublicLinks(projectionScopedCatalog, params);
  const results = sortPublicLinks(filteredLinks, params.sort, params.q.trim().toLowerCase());

  return {
    params,
    total: results.length,
    results,
    facets: {
      categories: toFacetOptions(results.map((link) => ({ value: link.categorySlug, label: link.categoryName }))),
      tags: toFacetOptions(results.flatMap((link) => link.tags.map((tag) => ({ value: tag.slug, label: tag.name })))),
      collections: toFacetOptions(results.flatMap((link) => link.collections.map((collection) => ({ value: collection.slug, label: collection.name })))),
      statuses: toFacetOptions(results.map((link) => ({ value: link.status, label: link.status })))
    }
  };
}
