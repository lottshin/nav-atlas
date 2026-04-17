import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveCategoryIcon } from "@/lib/category-icons";
import { prisma } from "@/lib/prisma";
import type {
  AdminOverviewStats,
  CategoryRecord,
  CategoryWithLinks,
  CreateCategoryInput,
  CreateLinkInput,
  DirectoryStore,
  LinkCheckRecord,
  LinkMetadataRecord,
  LinkRecord,
  SiteSettingsRecord,
  UpdateCategoryInput,
  UpdateLinkInput,
  UpdateSettingsInput
} from "@/lib/types";
import { getStorageMode } from "@/lib/env";
import type { HealthCheckResult } from "@/lib/health";
import {
  createNormalizedLink,
  ensureCategoryRecord,
  ensureDirectoryStore,
  ensureLinkMetadataRecord,
  ensureLinkRecord,
  ensureSettings,
  getFaviconFallback,
  nowIso,
  slugify,
  sortCategories,
  sortLinkMetadataRecords,
  sortLinks
} from "@/lib/utils";

const LOCAL_STORE_PATH = path.join(process.cwd(), "data", "navigation-store.json");
let localMutationQueue = Promise.resolve();

type ImportLinksBatchInput = {
  items: Array<{
    title: string;
    url: string;
    description: string;
    icon: string;
    sourceCategory: string;
    sortOrder: number;
  }>;
  mappings: Record<string, string>;
  sourceType: "json" | "bookmarks-html";
  filename: string | null;
  conflictMode: "skip" | "overwrite" | "duplicate";
};

function readStorageMode() {
  return getStorageMode();
}

function resolveImportTarget(mappingValue: string | undefined, sourceCategory: string) {
  if (mappingValue?.startsWith("existing:")) {
    return {
      mode: "existing" as const,
      categoryId: mappingValue.slice("existing:".length),
      categoryName: null
    };
  }

  if (mappingValue?.startsWith("create:")) {
    return {
      mode: "create" as const,
      categoryId: null,
      categoryName: mappingValue.slice("create:".length) || sourceCategory
    };
  }

  return {
    mode: "create" as const,
    categoryId: null,
    categoryName: sourceCategory
  };
}

function resolveUniqueSlug(baseValue: string, usedSlugs: Set<string>) {
  const baseSlug = slugify(baseValue) || "category";
  let candidate = baseSlug;
  let suffix = 2;

  while (usedSlugs.has(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  usedSlugs.add(candidate);
  return candidate;
}

function resolveCategorySlug(preferredSlug: string | undefined, fallbackName: string, usedSlugs: Set<string>) {
  return resolveUniqueSlug(preferredSlug?.trim() || fallbackName, usedSlugs);
}

async function ensureLocalStoreDir() {
  await fs.mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
}

async function ensureLocalStoreFile() {
  await ensureLocalStoreDir();
  const initialStore = JSON.stringify(ensureDirectoryStore(), null, 2);

  try {
    await fs.writeFile(LOCAL_STORE_PATH, initialStore, {
      encoding: "utf8",
      flag: "wx"
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

async function readLocalStore(): Promise<DirectoryStore> {
  try {
    const raw = await fs.readFile(LOCAL_STORE_PATH, "utf8");
    return ensureDirectoryStore(JSON.parse(raw) as DirectoryStore);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    await ensureLocalStoreFile();
    const raw = await fs.readFile(LOCAL_STORE_PATH, "utf8");
    return ensureDirectoryStore(JSON.parse(raw) as DirectoryStore);
  }
}

async function writeLocalStore(store: DirectoryStore) {
  await ensureLocalStoreDir();
  await fs.writeFile(LOCAL_STORE_PATH, JSON.stringify(ensureDirectoryStore(store), null, 2), "utf8");
}

async function mutateLocalStore<T>(mutator: (draft: DirectoryStore) => Promise<T> | T): Promise<T> {
  const task = localMutationQueue.then(async () => {
    const store = await readLocalStore();
    const result = await mutator(store);
    await writeLocalStore(store);
    return result;
  });

  localMutationQueue = task.then(
    () => undefined,
    () => undefined
  );

  return task;
}

function serializePrismaStore(input: {
  categories: Array<{ id: string; name: string; slug: string; description: string; icon: string; sortOrder: number }>;
  links: Array<{
    id: string;
    title: string;
    url: string;
    description: string;
    displayChipPrimary: string | null;
    displayChipSecondary: string | null;
    icon: string;
    iconMode: string;
    iconUrl: string | null;
    faviconUrl: string | null;
    normalizedDomain: string;
    status: string;
    lastCheckedAt: Date | null;
    httpStatus: number | null;
    faviconStatus: string;
    titleStatus: string;
    categoryId: string;
    featured: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  linkChecks: Array<{
    id: string;
    linkId: string;
    checkedAt: Date;
    httpStatus: number | null;
    faviconStatus: string;
    titleStatus: string;
    note: string | null;
  }>;
  importBatches: Array<{
    id: string;
    sourceType: string;
    filename: string | null;
    itemCount: number;
    importedCount: number;
    skippedCount: number;
    createdAt: Date;
  }>;
  settings: {
    id: string;
    siteName: string;
    brandMark: string;
    brandSub: string;
    homeRailLabel: string;
    homeRailIcon: string;
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    secondaryEntrySource: string;
    secondaryEntryFallback: string;
    featuredSectionKicker: string;
    featuredSectionTitle: string;
    featuredSectionNote: string;
    accentColor: string;
    defaultTheme: string;
    adminBranding: string;
  } | null;
  linkMetadata: Array<{
    linkId: string;
    resolvedTitle: string | null;
    resolvedDescription: string | null;
    siteName: string | null;
    canonicalUrl: string | null;
    faviconUrl: string | null;
    ogImageUrl: string | null;
    lastFetchedAt: Date | null;
    fetchStatus: string;
    lastError: string | null;
  }>;
}): DirectoryStore {
  return ensureDirectoryStore({
    categories: sortCategories(input.categories.map((category) => ensureCategoryRecord(category))),
    links: sortLinks(
      input.links.map((link) =>
        ensureLinkRecord({
          ...link,
          iconMode: link.iconMode === "custom" || link.iconMode === "builtin" ? link.iconMode : "auto",
          status: link.status === "healthy" || link.status === "warning" || link.status === "broken" ? link.status : "unknown",
          faviconStatus: link.faviconStatus === "ok" || link.faviconStatus === "error" ? link.faviconStatus : "idle",
          titleStatus: link.titleStatus === "ok" || link.titleStatus === "error" ? link.titleStatus : "idle",
          lastCheckedAt: link.lastCheckedAt?.toISOString() ?? null,
          createdAt: link.createdAt.toISOString(),
          updatedAt: link.updatedAt.toISOString()
        })
      )
    ),
    linkChecks: input.linkChecks.map((check) => ({
      id: check.id,
      linkId: check.linkId,
      checkedAt: check.checkedAt.toISOString(),
      httpStatus: check.httpStatus,
      faviconStatus: check.faviconStatus === "ok" || check.faviconStatus === "error" ? check.faviconStatus : "idle",
      titleStatus: check.titleStatus === "ok" || check.titleStatus === "error" ? check.titleStatus : "idle",
      note: check.note
    })),
    importBatches: input.importBatches.map((batch) => ({
      id: batch.id,
      sourceType: batch.sourceType === "bookmarks-html" ? "bookmarks-html" : "json",
      filename: batch.filename,
      itemCount: batch.itemCount,
      importedCount: batch.importedCount,
      skippedCount: batch.skippedCount,
      createdAt: batch.createdAt.toISOString()
    })),
    settings: ensureSettings(
      input.settings
        ? {
            ...input.settings,
            secondaryEntrySource: input.settings.secondaryEntrySource === "jinrishici" ? "jinrishici" : "hitokoto",
            defaultTheme: input.settings.defaultTheme === "dark" ? "dark" : "light"
          }
        : undefined
    ),
    linkMetadata: input.linkMetadata.map((record) =>
      ensureLinkMetadataRecord({
        ...record,
        lastFetchedAt: record.lastFetchedAt?.toISOString() ?? null,
        fetchStatus: record.fetchStatus === "queued" || record.fetchStatus === "ok" || record.fetchStatus === "error" ? record.fetchStatus : "idle"
      })
    )
  });
}

async function readDatabaseStore(): Promise<DirectoryStore> {
  const [categories, links, linkChecks, importBatches, settings, linkMetadata] = await prisma.$transaction([
    prisma.category.findMany(),
    prisma.link.findMany(),
    prisma.linkCheck.findMany(),
    prisma.importBatch.findMany(),
    prisma.siteSettings.findUnique({ where: { id: "singleton" } }),
    prisma.linkMetadata.findMany()
  ]);

  return serializePrismaStore({ categories, links, linkChecks, importBatches, settings, linkMetadata });
}

async function readStoreByMode(): Promise<DirectoryStore> {
  const storageMode = readStorageMode();
  return storageMode === "database" ? readDatabaseStore() : readLocalStore();
}

export async function getStore(): Promise<DirectoryStore> {
  return readStoreByMode();
}

export async function getCategoryRecords(): Promise<CategoryRecord[]> {
  const store = await getStore();
  return store.categories;
}

export async function getLinkRecords(): Promise<LinkRecord[]> {
  const store = await getStore();
  return store.links;
}

export async function getLinkMetadataRecords(): Promise<LinkMetadataRecord[]> {
  const store = await getStore();
  return store.linkMetadata;
}

export async function getLinkChecks(): Promise<LinkCheckRecord[]> {
  const store = await getStore();
  return store.linkChecks;
}

export async function recordLinkHealthCheck(linkId: string, result: HealthCheckResult) {
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    await prisma.$transaction([
      prisma.link.update({
        where: { id: linkId },
        data: {
          status: result.status,
          lastCheckedAt: new Date(result.checkedAt),
          httpStatus: result.httpStatus,
          faviconStatus: result.faviconStatus,
          titleStatus: result.titleStatus,
          faviconUrl: result.faviconUrl ?? undefined
        }
      }),
      prisma.linkCheck.create({
        data: {
          linkId,
          checkedAt: new Date(result.checkedAt),
          httpStatus: result.httpStatus,
          faviconStatus: result.faviconStatus,
          titleStatus: result.titleStatus,
          note: result.note
        }
      })
    ]);
    return;
  }

  await mutateLocalStore((store) => {
    const linkIndex = store.links.findIndex((link) => link.id === linkId);
    if (linkIndex < 0) {
      throw new Error(`Link not found: ${linkId}`);
    }

    const current = store.links[linkIndex];
    store.links[linkIndex] = {
      ...current,
      status: result.status,
      lastCheckedAt: result.checkedAt,
      httpStatus: result.httpStatus,
      faviconStatus: result.faviconStatus,
      titleStatus: result.titleStatus,
      faviconUrl: result.faviconUrl ?? current.faviconUrl,
      updatedAt: result.checkedAt
    };

    store.links = sortLinks(store.links);
    store.linkChecks = [
      {
        id: randomUUID(),
        linkId,
        checkedAt: result.checkedAt,
        httpStatus: result.httpStatus,
        faviconStatus: result.faviconStatus,
        titleStatus: result.titleStatus,
        note: result.note
      },
      ...store.linkChecks
    ];
  });
}

export async function getSettings() {
  const store = await getStore();
  return store.settings;
}

export async function getGroupedCategories(): Promise<CategoryWithLinks[]> {
  const store = await getStore();
  return store.categories.map((category) => ({
    ...category,
    links: sortLinks(store.links.filter((link) => link.categoryId === category.id))
  }));
}

export async function getCategoryBySlug(slug: string) {
  const grouped = await getGroupedCategories();
  return grouped.find((category) => category.slug === slug) ?? null;
}

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const store = await getStore();
  return {
    categoryCount: store.categories.length,
    linkCount: store.links.length,
    featuredCount: store.links.filter((link) => link.featured).length,
    brokenCount: store.links.filter((link) => link.status === "broken").length,
    importBatchCount: store.importBatches.length,
    tagCount: 0,
    collectionCount: 0,
    savedViewCount: 0,
    queuedJobCount: 0,
    runningJobCount: 0,
    failedJobCount: 0
  };
}

export async function createCategory(input: CreateCategoryInput) {
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    const usedSlugs = new Set((await prisma.category.findMany({ select: { slug: true } })).map((category) => category.slug));
    const slug = resolveCategorySlug(input.slug, input.name, usedSlugs);
    const icon = resolveCategoryIcon(input.icon, slug);

    return prisma.category.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          icon,
          sortOrder: input.sortOrder
        }
      });
  }

  return mutateLocalStore((store) => {
    const usedSlugs = new Set(store.categories.map((category) => category.slug));
    const slug = resolveCategorySlug(input.slug, input.name, usedSlugs);
    const icon = resolveCategoryIcon(input.icon, slug);
    const category: CategoryRecord = {
      id: randomUUID(),
      name: input.name,
      slug,
      description: input.description,
      icon,
      sortOrder: input.sortOrder
    };

    store.categories.push(category);
    store.categories = sortCategories(store.categories);
    return category;
  });
}

export async function updateCategory(input: UpdateCategoryInput) {
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    const usedSlugs = new Set(
      (await prisma.category.findMany({ select: { id: true, slug: true } }))
        .filter((category) => category.id !== input.id)
        .map((category) => category.slug)
    );
    const slug = resolveCategorySlug(input.slug, input.name, usedSlugs);
    const icon = resolveCategoryIcon(input.icon, slug);

    await prisma.category.update({
      where: { id: input.id },
      data: {
        name: input.name,
        slug,
        description: input.description,
        icon,
        sortOrder: input.sortOrder
      }
    });
    return;
  }

  await mutateLocalStore((store) => {
    const usedSlugs = new Set(store.categories.filter((category) => category.id !== input.id).map((category) => category.slug));
    const slug = resolveCategorySlug(input.slug, input.name, usedSlugs);
    const icon = resolveCategoryIcon(input.icon, slug);
    store.categories = sortCategories(
      store.categories.map((category) =>
        category.id === input.id
          ? {
              ...category,
              name: input.name,
              slug,
              description: input.description,
              icon,
              sortOrder: input.sortOrder
            }
          : category
      )
    );
  });
}

export async function deleteCategory(id: string) {
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    await prisma.category.delete({ where: { id } });
    return;
  }

  await mutateLocalStore((store) => {
    store.categories = store.categories.filter((category) => category.id !== id);
    const removedLinkIds = new Set(store.links.filter((link) => link.categoryId === id).map((link) => link.id));
    store.links = store.links.filter((link) => link.categoryId !== id);
    store.linkChecks = store.linkChecks.filter((check) => !removedLinkIds.has(check.linkId));
    store.linkMetadata = store.linkMetadata.filter((record) => !removedLinkIds.has(record.linkId));
  });
}

export async function createLink(input: CreateLinkInput) {
  const now = nowIso();
  const normalized = createNormalizedLink(input, now);
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    return prisma.link.create({
      data: {
        title: normalized.title,
        url: normalized.url,
        description: normalized.description,
        icon: normalized.icon,
        iconMode: normalized.iconMode,
        iconUrl: normalized.iconUrl,
        faviconUrl: normalized.faviconUrl,
        displayChipPrimary: normalized.displayChipPrimary,
        displayChipSecondary: normalized.displayChipSecondary,
        normalizedDomain: normalized.normalizedDomain,
        status: normalized.status,
        lastCheckedAt: normalized.lastCheckedAt ? new Date(normalized.lastCheckedAt) : null,
        httpStatus: normalized.httpStatus,
        faviconStatus: normalized.faviconStatus,
        titleStatus: normalized.titleStatus,
        categoryId: normalized.categoryId,
        featured: normalized.featured,
        sortOrder: normalized.sortOrder
      }
    });
  }

  return mutateLocalStore((store) => {
    const link: LinkRecord = {
      ...normalized,
      id: randomUUID()
    };

    store.links.push(link);
    store.links = sortLinks(store.links);
    return link;
  });
}

export async function updateLink(input: UpdateLinkInput) {
  const storageMode = readStorageMode();
  const normalized = createNormalizedLink(input);

  if (storageMode === "database") {
    const existing = await prisma.link.findUnique({
      where: { id: input.id },
      select: {
        url: true,
        status: true,
        lastCheckedAt: true,
        httpStatus: true,
        faviconStatus: true,
        titleStatus: true
      }
    });
    const urlChanged = existing?.url !== normalized.url;

    await prisma.link.update({
      where: { id: input.id },
      data: {
        title: normalized.title,
        url: normalized.url,
        description: normalized.description,
        icon: normalized.icon,
        iconMode: normalized.iconMode,
        iconUrl: normalized.iconUrl,
        faviconUrl: normalized.faviconUrl,
        displayChipPrimary: normalized.displayChipPrimary,
        displayChipSecondary: normalized.displayChipSecondary,
        normalizedDomain: normalized.normalizedDomain,
        status: urlChanged ? "unknown" : (existing?.status ?? "unknown"),
        lastCheckedAt: urlChanged ? null : (existing?.lastCheckedAt ?? null),
        httpStatus: urlChanged ? null : (existing?.httpStatus ?? null),
        faviconStatus: urlChanged ? "idle" : (existing?.faviconStatus ?? "idle"),
        titleStatus: urlChanged ? "idle" : (existing?.titleStatus ?? "idle"),
        categoryId: normalized.categoryId,
        featured: normalized.featured,
        sortOrder: normalized.sortOrder
      }
    });
    return;
  }

  await mutateLocalStore((store) => {
    const existingLink = store.links.find((link) => link.id === input.id);
    const previousUrl = existingLink?.url ?? "";

    store.links = sortLinks(
      store.links.map((link) => {
        if (link.id !== input.id) {
          return link;
        }

        const normalized = createNormalizedLink(input, link.createdAt);
        const urlChanged = link.url !== normalized.url;
        return {
          ...normalized,
          id: link.id,
          createdAt: link.createdAt,
          updatedAt: nowIso(),
          lastCheckedAt: urlChanged ? null : link.lastCheckedAt,
          httpStatus: urlChanged ? null : link.httpStatus,
          faviconStatus: urlChanged ? "idle" : link.faviconStatus,
          titleStatus: urlChanged ? "idle" : link.titleStatus,
          status: urlChanged ? "unknown" : link.status,
          faviconUrl: urlChanged ? normalized.faviconUrl : link.faviconUrl ?? normalized.faviconUrl
        };
      })
    );

    if (existingLink && previousUrl !== input.url) {
      store.linkMetadata = store.linkMetadata.filter((record) => record.linkId !== input.id);
    }
  });
}

export async function deleteLink(id: string) {
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    await prisma.link.delete({ where: { id } });
    return;
  }

  await mutateLocalStore((store) => {
    store.links = store.links.filter((link) => link.id !== id);
    store.linkChecks = store.linkChecks.filter((check) => check.linkId !== id);
    store.linkMetadata = store.linkMetadata.filter((record) => record.linkId !== id);
  });
}

export async function bulkUpdateLinkCategory(ids: string[], categoryId: string) {
  const uniqueIds = [...new Set(ids)];
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    await prisma.link.updateMany({
      where: { id: { in: uniqueIds } },
      data: { categoryId }
    });
    return;
  }

  await mutateLocalStore((store) => {
    const selected = new Set(uniqueIds);
    const updatedAt = nowIso();

    store.links = sortLinks(
      store.links.map((link) => (selected.has(link.id) ? { ...link, categoryId, updatedAt } : link))
    );
  });
}

export async function bulkSetLinksFeatured(ids: string[], featured: boolean) {
  const uniqueIds = [...new Set(ids)];
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    await prisma.link.updateMany({
      where: { id: { in: uniqueIds } },
      data: { featured }
    });
    return;
  }

  await mutateLocalStore((store) => {
    const selected = new Set(uniqueIds);
    const updatedAt = nowIso();

    store.links = sortLinks(
      store.links.map((link) => (selected.has(link.id) ? { ...link, featured, updatedAt } : link))
    );
  });
}

export async function bulkDeleteLinks(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    await prisma.link.deleteMany({
      where: { id: { in: uniqueIds } }
    });
    return;
  }

  await mutateLocalStore((store) => {
    const selected = new Set(uniqueIds);
    store.links = store.links.filter((link) => !selected.has(link.id));
    store.linkChecks = store.linkChecks.filter((check) => !selected.has(check.linkId));
    store.linkMetadata = store.linkMetadata.filter((record) => !selected.has(record.linkId));
  });
}

export async function bulkRefreshLinksFavicon(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    const links = await prisma.link.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, url: true }
    });

    await prisma.$transaction(
      links.map((link) =>
        prisma.link.update({
          where: { id: link.id },
          data: {
            faviconUrl: getFaviconFallback(link.url),
            faviconStatus: "idle"
          }
        })
      )
    );
    return;
  }

  await mutateLocalStore((store) => {
    const selected = new Set(uniqueIds);
    const updatedAt = nowIso();

    store.links = sortLinks(
      store.links.map((link) =>
        selected.has(link.id)
          ? {
              ...link,
              faviconUrl: getFaviconFallback(link.url),
              faviconStatus: "idle",
              lastCheckedAt: null,
              updatedAt
            }
          : link
      )
    );
    store.linkMetadata = store.linkMetadata.filter((record) => !selected.has(record.linkId));
  });
}

export async function upsertLocalLinkMetadataRecord(record: LinkMetadataRecord, resolvedFaviconUrl?: string | null) {
  await mutateLocalStore((store) => {
    const nextRecord = ensureLinkMetadataRecord(record);
    const existingIndex = store.linkMetadata.findIndex((item) => item.linkId === nextRecord.linkId);

    if (existingIndex >= 0) {
      store.linkMetadata[existingIndex] = nextRecord;
    } else {
      store.linkMetadata.push(nextRecord);
    }

    store.linkMetadata = sortLinkMetadataRecords(store.linkMetadata);

    if (resolvedFaviconUrl) {
      const updatedAt = nowIso();
      store.links = sortLinks(
        store.links.map((link) =>
          link.id === nextRecord.linkId
            ? {
                ...link,
                faviconUrl: resolvedFaviconUrl,
                updatedAt
              }
            : link
        )
      );
    }
  });
}

export async function importLinksBatch(input: ImportLinksBatchInput) {
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    return prisma.$transaction(async (tx) => {
      const [existingCategories, existingLinks] = await Promise.all([tx.category.findMany(), tx.link.findMany()]);
      const categoriesById = new Map(existingCategories.map((category) => [category.id, category]));
      const categoriesByName = new Map(existingCategories.map((category) => [category.name.toLowerCase(), category]));
      const usedSlugs = new Set(existingCategories.map((category) => category.slug));
      const linksByUrl = new Map(existingLinks.map((link) => [link.url, link]));
      let nextSortOrder = existingCategories.length ? Math.max(...existingCategories.map((category) => category.sortOrder)) + 1 : 1;
      let importedCount = 0;
      let skippedCount = 0;
      const importedLinkIds: string[] = [];

      const ensureCategoryId = async (sourceCategory: string) => {
        const target = resolveImportTarget(input.mappings[sourceCategory], sourceCategory);

        if (target.mode === "existing" && target.categoryId && categoriesById.has(target.categoryId)) {
          return target.categoryId;
        }

        const categoryName = (target.categoryName || sourceCategory).trim() || "Imported";
        const existing = categoriesByName.get(categoryName.toLowerCase());
        if (existing) {
          return existing.id;
        }

        const slug = resolveUniqueSlug(categoryName, usedSlugs);
        const created = await tx.category.create({
          data: {
            name: categoryName,
            slug,
            description: `Imported from ${input.sourceType}`,
            icon: resolveCategoryIcon(undefined, slug),
            sortOrder: nextSortOrder++
          }
        });

        categoriesById.set(created.id, created);
        categoriesByName.set(created.name.toLowerCase(), created);
        return created.id;
      };

      for (const item of input.items) {
        const categoryId = await ensureCategoryId(item.sourceCategory);
        const normalized = createNormalizedLink({
          title: item.title,
          url: item.url,
          description: item.description,
          icon: item.icon,
          displayChipPrimary: null,
          displayChipSecondary: null,
          categoryId,
          featured: false,
          sortOrder: item.sortOrder
        });
        const existing = linksByUrl.get(item.url);

        if (existing && input.conflictMode === "skip") {
          skippedCount += 1;
          continue;
        }

        if (existing && input.conflictMode === "overwrite") {
          const updated = await tx.link.update({
            where: { id: existing.id },
            data: {
              title: normalized.title,
              description: normalized.description,
              icon: normalized.icon,
              iconMode: normalized.iconMode,
              iconUrl: normalized.iconUrl,
              faviconUrl: normalized.faviconUrl,
              normalizedDomain: normalized.normalizedDomain,
              categoryId: normalized.categoryId,
              featured: existing.featured,
              sortOrder: normalized.sortOrder,
              status: existing.status,
              lastCheckedAt: existing.lastCheckedAt,
              httpStatus: existing.httpStatus,
              faviconStatus: existing.faviconStatus,
              titleStatus: existing.titleStatus
            }
          });

          linksByUrl.set(updated.url, updated);
          importedLinkIds.push(updated.id);
          importedCount += 1;
          continue;
        }

        const created = await tx.link.create({
          data: {
            title: normalized.title,
            url: normalized.url,
            description: normalized.description,
            icon: normalized.icon,
            iconMode: normalized.iconMode,
            iconUrl: normalized.iconUrl,
            faviconUrl: normalized.faviconUrl,
            normalizedDomain: normalized.normalizedDomain,
            status: normalized.status,
            lastCheckedAt: null,
            httpStatus: null,
            faviconStatus: normalized.faviconStatus,
            titleStatus: normalized.titleStatus,
            categoryId: normalized.categoryId,
            featured: normalized.featured,
            sortOrder: normalized.sortOrder
          }
        });

        linksByUrl.set(created.url, created);
        importedLinkIds.push(created.id);
        importedCount += 1;
      }

      const batch = await tx.importBatch.create({
        data: {
          sourceType: input.sourceType,
          filename: input.filename,
          itemCount: input.items.length,
          importedCount,
          skippedCount
        }
      });

      return {
        batch,
        importedLinkIds
      };
    });
  }

  return mutateLocalStore((store) => {
    const categoriesById = new Map(store.categories.map((category) => [category.id, category]));
    const categoriesByName = new Map(store.categories.map((category) => [category.name.toLowerCase(), category]));
    const usedSlugs = new Set(store.categories.map((category) => category.slug));
    let nextSortOrder = store.categories.length ? Math.max(...store.categories.map((category) => category.sortOrder)) + 1 : 1;
    let importedCount = 0;
    let skippedCount = 0;
    const importedLinkIds: string[] = [];

    const ensureCategoryId = (sourceCategory: string) => {
      const target = resolveImportTarget(input.mappings[sourceCategory], sourceCategory);

      if (target.mode === "existing" && target.categoryId && categoriesById.has(target.categoryId)) {
        return target.categoryId;
      }

      const categoryName = (target.categoryName || sourceCategory).trim() || "Imported";
      const existing = categoriesByName.get(categoryName.toLowerCase());
      if (existing) {
        return existing.id;
      }

      const created: CategoryRecord = ensureCategoryRecord({
        id: randomUUID(),
        name: categoryName,
        slug: resolveUniqueSlug(categoryName, usedSlugs),
        description: `Imported from ${input.sourceType}`,
        sortOrder: nextSortOrder++
      });

      store.categories.push(created);
      categoriesById.set(created.id, created);
      categoriesByName.set(created.name.toLowerCase(), created);
      return created.id;
    };

    for (const item of input.items) {
      const categoryId = ensureCategoryId(item.sourceCategory);
      const existingIndex = store.links.findIndex((link) => link.url === item.url);
        const normalized = createNormalizedLink(
          {
            title: item.title,
            url: item.url,
            description: item.description,
            icon: item.icon,
            displayChipPrimary: null,
            displayChipSecondary: null,
            categoryId,
            featured: false,
            sortOrder: item.sortOrder
          },
        nowIso()
      );

      if (existingIndex >= 0 && input.conflictMode === "skip") {
        skippedCount += 1;
        continue;
      }

      if (existingIndex >= 0 && input.conflictMode === "overwrite") {
        const existing = store.links[existingIndex];
        store.links[existingIndex] = {
          ...existing,
          title: normalized.title,
          description: normalized.description,
          icon: normalized.icon,
          iconMode: normalized.iconMode,
          iconUrl: normalized.iconUrl,
          faviconUrl: normalized.faviconUrl,
          normalizedDomain: normalized.normalizedDomain,
          categoryId: normalized.categoryId,
          sortOrder: normalized.sortOrder,
          updatedAt: nowIso()
        };
        importedLinkIds.push(existing.id);
        importedCount += 1;
        continue;
      }

      const createdId = randomUUID();
      store.links.push({
        ...normalized,
        id: createdId
      });
      importedLinkIds.push(createdId);
      importedCount += 1;
    }

    const batch = {
      id: randomUUID(),
      sourceType: input.sourceType,
      filename: input.filename,
      itemCount: input.items.length,
      importedCount,
      skippedCount,
      createdAt: nowIso()
    };

    store.categories = sortCategories(store.categories);
    store.links = sortLinks(store.links);
    store.importBatches = [batch, ...store.importBatches];

    return {
      batch,
      importedLinkIds
    };
  });
}

export async function updateSettings(input: UpdateSettingsInput) {
  const settings = ensureSettings({
    id: "singleton",
    ...input
  });
  const storageMode = readStorageMode();

  if (storageMode === "database") {
    await prisma.siteSettings.upsert({
      where: { id: "singleton" },
      create: settings,
      update: settings
    });
    return;
  }

  await mutateLocalStore((store) => {
    store.settings = ensureSettings(settings);
  });
}
