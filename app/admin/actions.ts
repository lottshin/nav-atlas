"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { ADMIN_LOCALE_COOKIE, resolveAdminLocale } from "@/lib/admin-locale";
import { resolveBuiltinIcon } from "@/lib/category-icons";
import { getStorageMode, getTaskRunnerBatchLimit } from "@/lib/env";
import { cleanupFaviconCache } from "@/lib/favicon-cache";
import { hasAnyCachedFaviconSource } from "@/lib/favicon-cache";
import { warmCachedFavicon } from "@/lib/favicon-cache";
import { runPendingJobs } from "@/lib/job-runner";
import { HEALTH_CHECK_CONCURRENCY, HEALTH_CHECK_REQUEST_LIMIT, HEALTH_STALE_DAYS, HEALTH_STALE_WINDOW_MS, runLinkHealthCheck } from "@/lib/health";
import { parseBookmarksHtmlText, parseJsonImportText } from "@/lib/import-utils";
import { getMetadataMapForLinks, getMetadataRetryCandidateIds, queueMetadataRefresh, refreshLinkMetadata } from "@/lib/metadata";
import { buildFaviconSources, isImageLikeFavicon } from "@/lib/favicon-sources";
import { isRemoteFaviconSource } from "@/lib/favicon-sources";
import {
  bulkDeleteLinks,
  bulkRefreshLinksFavicon,
  bulkSetLinksFeatured,
  bulkUpdateLinkCategory,
  createCategory,
  createLink,
  deleteCategory,
  deleteLink,
  getLinkRecords,
  importLinksBatch,
  recordLinkHealthCheck,
  updateCategory,
  updateLink,
  updateSettings
} from "@/lib/repository";
import { deleteSearchDocuments } from "@/lib/search-index";
import {
  createCollection,
  createSavedView,
  createTag,
  deleteCollection,
  deleteSavedView,
  deleteTag,
  updateCollection,
  updateSavedView,
  updateTag
} from "@/lib/taxonomy";
import { cancelJob, enqueueJob, enqueueSearchReindex, retryJob } from "@/lib/tasks";
import type {
  CreateCategoryInput,
  CreateCollectionInput,
  CreateLinkInput,
  CreateSavedViewInput,
  CreateTagInput,
  LinkRecord,
  SavedViewQueryState,
  UpdateCategoryInput,
  UpdateCollectionInput,
  UpdateLinkInput,
  UpdateSavedViewInput,
  UpdateSettingsInput,
  UpdateTagInput
} from "@/lib/types";
import { DEFAULT_SETTINGS, resolveSecondaryEntrySource, safeTrim } from "@/lib/utils";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
}

function parseOrder(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFeatured(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function parseSelectedIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid selection payload");
  }

  return [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
}

function assertUrl(value: string) {
  try {
    new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }
}

function parseJsonField<T>(value: FormDataEntryValue | null): T {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Missing JSON payload");
  }

  return JSON.parse(value) as T;
}

function parseSavedViewQueryState(formData: FormData): SavedViewQueryState {
  const featured = safeTrim(formData.get("featured"));
  const status = safeTrim(formData.get("status"));
  const sort = safeTrim(formData.get("sort"));

  return {
    q: safeTrim(formData.get("q")),
    category: safeTrim(formData.get("category")),
    tag: safeTrim(formData.get("tag")),
    collection: safeTrim(formData.get("collection")),
    featured: featured === "true" || featured === "false" ? featured : "all",
    status: status === "healthy" || status === "warning" || status === "broken" || status === "unknown" ? status : "all",
    sort: sort === "title" || sort === "recent" || sort === "featured" ? sort : "relevance"
  };
}

function revalidateAdminSurfaces() {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/links");
  revalidatePath("/admin/metadata");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/collections");
  revalidatePath("/admin/views");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/import");
  revalidatePath("/admin/health");
  revalidatePath("/admin/tasks");
  revalidatePath("/category/[slug]", "page");
  revalidatePath("/tag/[slug]", "page");
  revalidatePath("/collection/[slug]", "page");
  revalidatePath("/view/[slug]", "page");
}

export async function setAdminLocaleAction(formData: FormData) {
  const locale = resolveAdminLocale(safeTrim(formData.get("locale")));
  const returnTo = safeTrim(formData.get("returnTo"));
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  redirect(returnTo.startsWith("/admin") ? returnTo : "/admin");
}

async function executeHealthChecks(links: Awaited<ReturnType<typeof getLinkRecords>>) {
  if (!links.length) {
    return {
      attempted: 0,
      failedCount: 0,
      successCount: 0
    };
  }

  let successCount = 0;
  let failedCount = 0;

  for (let index = 0; index < links.length; index += HEALTH_CHECK_CONCURRENCY) {
    const batch = links.slice(index, index + HEALTH_CHECK_CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (link) => {
        const result = await runLinkHealthCheck(link);
        await recordLinkHealthCheck(link.id, result);
      })
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        successCount += 1;
      } else {
        failedCount += 1;
      }
    });
  }

  return {
    attempted: links.length,
    failedCount,
    successCount
  };
}

async function enqueueHealthChecks(links: LinkRecord[]) {
  await Promise.all(
    links.map((link) =>
      enqueueJob("HEALTH_CHECK", {
        payload: { linkId: link.id },
        priority: link.status === "broken" ? 4 : link.status === "warning" ? 3 : 2
      })
    )
  );
}

function isHealthCheckStale(lastCheckedAt: string | null) {
  if (!lastCheckedAt) {
    return true;
  }

  const checkedAt = Date.parse(lastCheckedAt);
  if (Number.isNaN(checkedAt)) {
    return true;
  }

  return Date.now() - checkedAt >= HEALTH_STALE_WINDOW_MS;
}

function needsAttention(link: LinkRecord) {
  return !link.lastCheckedAt || link.status === "broken" || link.status === "warning" || link.status === "unknown" || isHealthCheckStale(link.lastCheckedAt);
}

function getHealthPriority(link: LinkRecord) {
  if (!link.lastCheckedAt) {
    return 0;
  }

  if (link.status === "broken") {
    return 1;
  }

  if (link.status === "warning") {
    return 2;
  }

  if (link.status === "unknown") {
    return 3;
  }

  if (isHealthCheckStale(link.lastCheckedAt)) {
    return 4;
  }

  return 5;
}

function sortHealthQueue(links: LinkRecord[]) {
  return [...links].sort((left, right) => {
    const priorityDelta = getHealthPriority(left) - getHealthPriority(right);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const leftCheckedAt = left.lastCheckedAt ? Date.parse(left.lastCheckedAt) : 0;
    const rightCheckedAt = right.lastCheckedAt ? Date.parse(right.lastCheckedAt) : 0;
    const safeLeftCheckedAt = Number.isNaN(leftCheckedAt) ? 0 : leftCheckedAt;
    const safeRightCheckedAt = Number.isNaN(rightCheckedAt) ? 0 : rightCheckedAt;
    return safeLeftCheckedAt - safeRightCheckedAt || left.title.localeCompare(right.title, "en");
  });
}

function redirectToHealthPage(input: {
  attempted: number;
  failedCount: number;
  queuedCount?: number;
  remainingCount: number;
  scope: "all" | "attention" | "single";
  successCount: number;
}) {
  const params = new URLSearchParams({
    attempted: String(input.attempted),
    failed: String(input.failedCount),
    queued: String(input.queuedCount ?? 0),
    remaining: String(input.remainingCount),
    scope: input.scope,
    staleDays: String(HEALTH_STALE_DAYS),
    success: String(input.successCount)
  });

  redirect(`/admin/health?${params.toString()}`);
}

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  const baseInput: CreateCategoryInput = {
    name: safeTrim(formData.get("name")),
    slug: safeTrim(formData.get("slug")),
    description: safeTrim(formData.get("description")),
    icon: safeTrim(formData.get("icon")),
    sortOrder: parseOrder(formData.get("sortOrder"))
  };

  if (!baseInput.name || !baseInput.description) {
    throw new Error("Category fields are required");
  }

  if (id) {
    const input: UpdateCategoryInput = { id, ...baseInput };
    await updateCategory(input);
  } else {
    await createCategory(baseInput);
  }

  if (getStorageMode() === "database") {
    await enqueueSearchReindex({ scope: "full" }, 2);
  }

  revalidateAdminSurfaces();
}

export async function removeCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = safeTrim(formData.get("id"));
  if (!id) {
    throw new Error("Category id is required");
  }

  await deleteCategory(id);

  if (getStorageMode() === "database") {
    await enqueueSearchReindex({ scope: "full" }, 2);
  }

  revalidateAdminSurfaces();
}

export async function saveTagAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  const baseInput: CreateTagInput = {
    name: safeTrim(formData.get("name")),
    description: safeTrim(formData.get("description")),
    sortOrder: parseOrder(formData.get("sortOrder")),
    linkIds: parseSelectedIds(formData.get("linkIds"))
  };

  if (!baseInput.name) {
    throw new Error("Tag name is required");
  }

  if (id) {
    const input: UpdateTagInput = { id, ...baseInput };
    await updateTag(input);
  } else {
    await createTag(baseInput);
  }

  if (getStorageMode() === "database") {
    await enqueueSearchReindex({ scope: "full" }, 2);
  }

  revalidateAdminSurfaces();
}

export async function removeTagAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  if (!id) {
    throw new Error("Tag id is required");
  }

  await deleteTag(id);

  if (getStorageMode() === "database") {
    await enqueueSearchReindex({ scope: "full" }, 2);
  }

  revalidateAdminSurfaces();
}

export async function saveCollectionAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  const baseInput: CreateCollectionInput = {
    name: safeTrim(formData.get("name")),
    description: safeTrim(formData.get("description")),
    published: parseFeatured(formData.get("published")),
    sortOrder: parseOrder(formData.get("sortOrder")),
    linkIds: parseSelectedIds(formData.get("linkIds"))
  };

  if (!baseInput.name) {
    throw new Error("Collection name is required");
  }

  if (id) {
    const input: UpdateCollectionInput = { id, ...baseInput };
    await updateCollection(input);
  } else {
    await createCollection(baseInput);
  }

  if (getStorageMode() === "database") {
    await enqueueSearchReindex({ scope: "full" }, 2);
  }

  revalidateAdminSurfaces();
}

export async function removeCollectionAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  if (!id) {
    throw new Error("Collection id is required");
  }

  await deleteCollection(id);

  if (getStorageMode() === "database") {
    await enqueueSearchReindex({ scope: "full" }, 2);
  }

  revalidateAdminSurfaces();
}

export async function saveSavedViewAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  const baseInput: CreateSavedViewInput = {
    name: safeTrim(formData.get("name")),
    description: safeTrim(formData.get("description")),
    published: parseFeatured(formData.get("published")),
    sortOrder: parseOrder(formData.get("sortOrder")),
    queryState: parseSavedViewQueryState(formData)
  };

  if (!baseInput.name) {
    throw new Error("View name is required");
  }

  if (id) {
    const input: UpdateSavedViewInput = { id, ...baseInput };
    await updateSavedView(input);
  } else {
    await createSavedView(baseInput);
  }

  revalidateAdminSurfaces();
}

export async function removeSavedViewAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  if (!id) {
    throw new Error("View id is required");
  }

  await deleteSavedView(id);
  revalidateAdminSurfaces();
}

export type SaveLinkActionState = {
  status: "idle" | "success" | "error";
  message: string;
  requestId: string | null;
  editorSessionKey: string | null;
};

function formatSaveLinkError(error: unknown, locale: "zh" | "en") {
  const fallback = locale === "zh" ? "\u7ad9\u70b9\u4fdd\u5b58\u5931\u8d25\u3002\u8bf7\u91cd\u8bd5\u3002" : "Failed to save the link. Please try again.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  if (locale === "zh") {
    switch (error.message) {
      case "Unauthorized":
        return "\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u540e\u518d\u4fdd\u5b58\u3002";
      case "Link fields are required":
        return "\u8bf7\u586b\u5199\u6807\u9898\u3001URL\u3001\u63cf\u8ff0\u548c\u5206\u7c7b\u540e\u518d\u4fdd\u5b58\u3002";
      case "Invalid URL":
        return "URL \u683c\u5f0f\u4e0d\u6b63\u786e\uff0c\u8bf7\u68c0\u67e5\u540e\u91cd\u8bd5\u3002";
      default:
        return fallback;
    }
  }

  if (error.message === "Unauthorized") {
    return "Your session expired. Sign in again before saving.";
  }

  if (error.message === "Link fields are required") {
    return "Fill in title, URL, description, and category before saving.";
  }

  if (error.message === "Invalid URL") {
    return "The URL format is invalid. Check it and try again.";
  }

  return fallback;
}

export async function saveLinkAction(_previousState: SaveLinkActionState, formData: FormData): Promise<SaveLinkActionState> {
  const locale = safeTrim(formData.get("locale")) === "zh" ? "zh" : "en";
  const editorSessionKey = safeTrim(formData.get("editorSessionKey")) || null;
  const requestId = `${Date.now()}`;

  try {
    await requireAdmin();

    const id = safeTrim(formData.get("id"));
    const baseInput: CreateLinkInput = {
      title: safeTrim(formData.get("title")),
      url: safeTrim(formData.get("url")),
      description: safeTrim(formData.get("description")),
      icon: safeTrim(formData.get("icon")),
      displayChipPrimary: safeTrim(formData.get("displayChipPrimary")) || null,
      displayChipSecondary: safeTrim(formData.get("displayChipSecondary")) || null,
      categoryId: safeTrim(formData.get("categoryId")),
      sortOrder: parseOrder(formData.get("sortOrder")),
      featured: parseFeatured(formData.get("featured"))
    };

    if (!baseInput.title || !baseInput.url || !baseInput.description || !baseInput.categoryId) {
      throw new Error("Link fields are required");
    }

    assertUrl(baseInput.url);

    if (id) {
      const input: UpdateLinkInput = { id, ...baseInput };
      await updateLink(input);
      if (getStorageMode() === "database") {
        await queueMetadataRefresh([id]);
        await enqueueSearchReindex({ scope: "links", linkIds: [id] }, 3);
      }
    } else {
      const created = await createLink(baseInput);
      if (getStorageMode() === "database" && created?.id) {
        await queueMetadataRefresh([created.id]);
        await enqueueSearchReindex({ scope: "links", linkIds: [created.id] }, 3);
      }
    }

    revalidateAdminSurfaces();

    return {
      status: "success",
      message: id
        ? locale === "zh"
          ? "\u7ad9\u70b9\u5df2\u4fdd\u5b58\uff0c\u5de5\u4f5c\u53f0\u5df2\u66f4\u65b0\u3002"
          : "Link saved and workspace refreshed."
        : locale === "zh"
          ? "\u7ad9\u70b9\u5df2\u521b\u5efa\uff0c\u5de5\u4f5c\u53f0\u5df2\u66f4\u65b0\u3002"
          : "Link created and workspace refreshed.",
      requestId,
      editorSessionKey
    };
  } catch (error) {
    return {
      status: "error",
      message: formatSaveLinkError(error, locale),
      requestId,
      editorSessionKey
    };
  }
}

export async function removeLinkAction(formData: FormData) {
  await requireAdmin();
  const id = safeTrim(formData.get("id"));
  if (!id) {
    throw new Error("Link id is required");
  }

  await deleteLink(id);
  if (getStorageMode() === "database") {
    await deleteSearchDocuments([id]);
  }
  revalidateAdminSurfaces();
}

export async function bulkAssignCategoryAction(formData: FormData) {
  await requireAdmin();
  const ids = parseSelectedIds(formData.get("ids"));
  const categoryId = safeTrim(formData.get("categoryId"));

  if (!ids.length || !categoryId) {
    throw new Error("Bulk category update requires ids and a category");
  }

  await bulkUpdateLinkCategory(ids, categoryId);
  if (getStorageMode() === "database") {
    await enqueueSearchReindex({ scope: "links", linkIds: ids }, 2);
  }
  revalidateAdminSurfaces();
}

export async function bulkFeatureLinksAction(formData: FormData) {
  await requireAdmin();
  const ids = parseSelectedIds(formData.get("ids"));

  if (!ids.length) {
    throw new Error("No links selected");
  }

  await bulkSetLinksFeatured(ids, true);
  revalidateAdminSurfaces();
}

export async function bulkUnfeatureLinksAction(formData: FormData) {
  await requireAdmin();
  const ids = parseSelectedIds(formData.get("ids"));

  if (!ids.length) {
    throw new Error("No links selected");
  }

  await bulkSetLinksFeatured(ids, false);
  revalidateAdminSurfaces();
}

export async function bulkDeleteLinksAction(formData: FormData) {
  await requireAdmin();
  const ids = parseSelectedIds(formData.get("ids"));

  if (!ids.length) {
    throw new Error("No links selected");
  }

  await bulkDeleteLinks(ids);
  if (getStorageMode() === "database") {
    await deleteSearchDocuments(ids);
  }
  revalidateAdminSurfaces();
}

export async function bulkRefreshFaviconAction(formData: FormData) {
  await requireAdmin();
  const ids = parseSelectedIds(formData.get("ids"));

  if (!ids.length) {
    throw new Error("No links selected");
  }

  await bulkRefreshLinksFavicon(ids);
  revalidateAdminSurfaces();
}

export async function bulkRefreshMetadataAction(formData: FormData) {
  await requireAdmin();
  const ids = parseSelectedIds(formData.get("ids"));

  if (!ids.length) {
    throw new Error("No links selected");
  }

  if (getStorageMode() !== "database") {
    throw new Error("Metadata refresh requires database mode");
  }

  await queueMetadataRefresh(ids);
  revalidateAdminSurfaces();
}

export async function refreshLinkMetadataAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  if (!id) {
    throw new Error("Link id is required");
  }

  if (getStorageMode() !== "database") {
    const record = await refreshLinkMetadata(id);
    if (record.faviconUrl && isRemoteFaviconSource(record.faviconUrl)) {
      await warmCachedFavicon(record.faviconUrl);
    }
    revalidateAdminSurfaces();
    return;
  }

  await queueMetadataRefresh([id]);
  revalidateAdminSurfaces();
}

export async function runAllHealthChecksAction(_formData: FormData) {
  await requireAdmin();
  const queue = sortHealthQueue(await getLinkRecords());
  const links = queue.slice(0, HEALTH_CHECK_REQUEST_LIMIT);
  const storageMode = getStorageMode();

  if (storageMode === "database") {
    await enqueueHealthChecks(links);
    revalidateAdminSurfaces();
    redirectToHealthPage({
      attempted: 0,
      failedCount: 0,
      queuedCount: links.length,
      remainingCount: Math.max(queue.length - links.length, 0),
      scope: "all",
      successCount: 0
    });
  }

  const result = await executeHealthChecks(links);
  revalidateAdminSurfaces();
  redirectToHealthPage({
    ...result,
    remainingCount: Math.max(queue.length - links.length, 0),
    scope: "all"
  });
}

export async function runAttentionHealthChecksAction(_formData: FormData) {
  await requireAdmin();
  const queue = sortHealthQueue((await getLinkRecords()).filter((link) => needsAttention(link)));
  const links = queue.slice(0, HEALTH_CHECK_REQUEST_LIMIT);
  const storageMode = getStorageMode();

  if (storageMode === "database") {
    await enqueueHealthChecks(links);
    revalidateAdminSurfaces();
    redirectToHealthPage({
      attempted: 0,
      failedCount: 0,
      queuedCount: links.length,
      remainingCount: Math.max(queue.length - links.length, 0),
      scope: "attention",
      successCount: 0
    });
  }

  const result = await executeHealthChecks(links);

  revalidateAdminSurfaces();
  redirectToHealthPage({
    ...result,
    remainingCount: Math.max(queue.length - links.length, 0),
    scope: "attention"
  });
}

export async function runSingleHealthCheckAction(formData: FormData) {
  await requireAdmin();
  const id = safeTrim(formData.get("id"));

  if (!id) {
    throw new Error("Link id is required");
  }

  const link = (await getLinkRecords()).find((item) => item.id === id);
  if (!link) {
    throw new Error("Link not found");
  }

  if (getStorageMode() === "database") {
    await enqueueHealthChecks([link]);
    revalidateAdminSurfaces();
    redirectToHealthPage({
      attempted: 0,
      failedCount: 0,
      queuedCount: 1,
      remainingCount: 0,
      scope: "single",
      successCount: 0
    });
  }

  const result = await executeHealthChecks([link]);
  revalidateAdminSurfaces();
  redirectToHealthPage({
    ...result,
    remainingCount: 0,
    scope: "single"
  });
}

export async function applyImportBatchAction(formData: FormData) {
  await requireAdmin();

  const sourceType = safeTrim(formData.get("sourceType")) === "bookmarks-html" ? "bookmarks-html" : "json";
  const filename = safeTrim(formData.get("filename")) || null;
  const conflictModeValue = safeTrim(formData.get("conflictMode"));
  const conflictMode = conflictModeValue === "overwrite" || conflictModeValue === "duplicate" ? conflictModeValue : "skip";
  const importFile = formData.get("importFile");
  const mappings = parseJsonField<Record<string, string>>(formData.get("mappings"));
  if (!(importFile instanceof File) || importFile.size === 0) {
    throw new Error("Import file is required");
  }

  const fileText = await importFile.text();
  const items = sourceType === "bookmarks-html" ? parseBookmarksHtmlText(fileText) : parseJsonImportText(fileText);

  const normalizedItems = items
    .map((item) => ({
      title: item.title.trim(),
      url: item.url.trim(),
      description: item.description.trim(),
      icon: item.icon.trim(),
      sourceCategory: item.sourceCategory.trim() || "Imported",
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0
    }))
    .filter((item) => item.title && item.url);

  if (!normalizedItems.length) {
    throw new Error("No valid import items provided");
  }

  normalizedItems.forEach((item) => assertUrl(item.url));

  const importResult = await importLinksBatch({
    items: normalizedItems,
    mappings,
    sourceType,
    filename,
    conflictMode
  });

  if (getStorageMode() === "database" && importResult.importedLinkIds.length) {
    await queueMetadataRefresh(importResult.importedLinkIds);
    await enqueueSearchReindex({ scope: "links", linkIds: importResult.importedLinkIds }, 3);
  }

  revalidateAdminSurfaces();
}

export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();

  const input: UpdateSettingsInput = {
    siteName: safeTrim(formData.get("siteName")) || DEFAULT_SETTINGS.siteName,
    brandMark: safeTrim(formData.get("brandMark")) || DEFAULT_SETTINGS.brandMark,
    brandSub: safeTrim(formData.get("brandSub")) || DEFAULT_SETTINGS.brandSub,
    homeRailLabel: safeTrim(formData.get("homeRailLabel")) || DEFAULT_SETTINGS.homeRailLabel,
    homeRailIcon: resolveBuiltinIcon(safeTrim(formData.get("homeRailIcon")), "compass"),
    heroEyebrow: safeTrim(formData.get("heroEyebrow")) || DEFAULT_SETTINGS.heroEyebrow,
    heroTitle: safeTrim(formData.get("heroTitle")) || DEFAULT_SETTINGS.heroTitle,
    heroSubtitle: safeTrim(formData.get("heroSubtitle")) || DEFAULT_SETTINGS.heroSubtitle,
    secondaryEntrySource: resolveSecondaryEntrySource(safeTrim(formData.get("secondaryEntrySource"))),
    secondaryEntryFallback: safeTrim(formData.get("secondaryEntryFallback")) || DEFAULT_SETTINGS.secondaryEntryFallback,
    featuredSectionKicker: safeTrim(formData.get("featuredSectionKicker")) || DEFAULT_SETTINGS.featuredSectionKicker,
    featuredSectionTitle: safeTrim(formData.get("featuredSectionTitle")) || DEFAULT_SETTINGS.featuredSectionTitle,
    featuredSectionNote: safeTrim(formData.get("featuredSectionNote")) || DEFAULT_SETTINGS.featuredSectionNote,
    accentColor: safeTrim(formData.get("accentColor")) || DEFAULT_SETTINGS.accentColor,
    defaultTheme: safeTrim(formData.get("defaultTheme")) === "dark" ? "dark" : "light",
    adminBranding: safeTrim(formData.get("adminBranding")) || DEFAULT_SETTINGS.adminBranding
  };

  await updateSettings(input);
  revalidateAdminSurfaces();
}

export async function runTaskRunnerAction(_formData: FormData) {
  await requireAdmin();

  const result = await runPendingJobs(getTaskRunnerBatchLimit());
  revalidateAdminSurfaces();

  const params = new URLSearchParams({
    attempted: String(result.attempted),
    succeeded: String(result.succeeded),
    failed: String(result.failed)
  });

  redirect(`/admin/tasks?${params.toString()}`);
}

export async function queueFullReindexAction(_formData: FormData) {
  await requireAdmin();

  if (getStorageMode() !== "database") {
    throw new Error("Search reindex requires database mode");
  }

  await enqueueSearchReindex({ scope: "full" }, 4);
  revalidateAdminSurfaces();
  redirect("/admin/tasks?queuedReindex=1");
}

export async function queueMetadataRetryBatchAction(_formData: FormData) {
  await requireAdmin();

  if (getStorageMode() !== "database") {
    throw new Error("Metadata retry requires database mode");
  }

  const ids = await getMetadataRetryCandidateIds(getTaskRunnerBatchLimit());
  if (ids.length) {
    await queueMetadataRefresh(ids);
  }

  revalidateAdminSurfaces();
  redirect(`/admin/tasks?queuedMetadata=${ids.length}`);
}

export async function cleanupFaviconCacheAction(_formData: FormData) {
  await requireAdmin();

  const summary = await cleanupFaviconCache();
  revalidateAdminSurfaces();

  const params = new URLSearchParams({
    faviconCleanup: "1",
    faviconCleanupMeta: String(summary.removedMetaFiles),
    faviconCleanupData: String(summary.removedDataFiles),
    faviconCleanupScanned: String(summary.scannedMetaFiles),
    faviconCleanupActive: String(summary.activeSources),
    faviconCleanupInvalidMeta: String(summary.removedInvalidMetaFiles),
    faviconCleanupExpiredErrors: String(summary.removedExpiredErrorEntries),
    faviconCleanupOrphanedSuccess: String(summary.removedOrphanedSuccessEntries),
    faviconCleanupMissingData: String(summary.removedMissingDataEntries),
    faviconCleanupOrphanedData: String(summary.removedOrphanedDataFiles)
  });

  redirect(`/admin/tasks?${params.toString()}`);
}

export async function retryMetadataFailuresAction(_formData: FormData) {
  await requireAdmin();

  if (getStorageMode() !== "database") {
    throw new Error("Metadata retry requires database mode");
  }

  const ids = await getMetadataRetryCandidateIds(getTaskRunnerBatchLimit());
  if (ids.length) {
    await queueMetadataRefresh(ids);
  }

  revalidateAdminSurfaces();
  redirect(`/admin/metadata?queued=${ids.length}`);
}

export async function retryFailedMetadataAction(_formData: FormData) {
  await requireAdmin();

  if (getStorageMode() === "database") {
    const ids = await getMetadataRetryCandidateIds(getTaskRunnerBatchLimit());
    if (ids.length) {
      await queueMetadataRefresh(ids);
    }

    revalidateAdminSurfaces();
    redirect(`/admin/metadata?queued=${ids.length}`);
  }

  const links = await getLinkRecords();
  const metadataMap = await getMetadataMapForLinks(links.map((link) => link.id));
  const failedIds: string[] = [];

  for (const link of links) {
    if (link.iconMode === "builtin" && link.icon && !isImageLikeFavicon(link.icon)) {
      continue;
    }

    if (link.iconUrl && (link.iconUrl.startsWith("/") || link.iconUrl.startsWith("data:image/"))) {
      continue;
    }

    const metadata = metadataMap.get(link.id) ?? null;
    const remoteSources = buildFaviconSources({
      url: link.url,
      icon: link.icon,
      iconUrl: link.iconUrl,
      faviconUrl: metadata?.faviconUrl ?? link.faviconUrl
    }).filter((source) => /^https?:\/\//i.test(source));

    if (!remoteSources.length) {
      continue;
    }

    const hasCache = await hasAnyCachedFaviconSource(remoteSources);
    if (!hasCache) {
      failedIds.push(link.id);
    }
  }

  let retried = 0;
  for (const linkId of failedIds) {
    const record = await refreshLinkMetadata(linkId);
    if (record.faviconUrl && isRemoteFaviconSource(record.faviconUrl)) {
      await warmCachedFavicon(record.faviconUrl);
    }
    retried += 1;
  }

  revalidateAdminSurfaces();
  redirect(`/admin/metadata?retried=${retried}`);
}

export async function retryTaskAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  if (!id) {
    throw new Error("Task id is required");
  }

  await retryJob(id);
  revalidateAdminSurfaces();
}

export async function cancelTaskAction(formData: FormData) {
  await requireAdmin();

  const id = safeTrim(formData.get("id"));
  if (!id) {
    throw new Error("Task id is required");
  }

  await cancelJob(id);
  revalidateAdminSurfaces();
}

export async function logoutAction() {
  await requireAdmin();
  await signOut({ redirectTo: "/admin/login" });
}
