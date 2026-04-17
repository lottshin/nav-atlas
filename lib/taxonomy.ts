import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  CollectionRecord,
  CreateCollectionInput,
  CreateSavedViewInput,
  CreateTagInput,
  SavedViewQueryState,
  SavedViewRecord,
  TagRecord,
  TagEditorRecord,
  UpdateCollectionInput,
  UpdateSavedViewInput,
  UpdateTagInput,
  CollectionEditorRecord
} from "@/lib/types";
import { getStorageMode } from "@/lib/env";
import { requireAdvancedDirectory } from "@/lib/feature-guard";
import { slugify } from "@/lib/utils";

function resolveSavedViewState(input: Partial<SavedViewQueryState>): SavedViewQueryState {
  return {
    q: typeof input.q === "string" ? input.q : "",
    category: typeof input.category === "string" ? input.category : "",
    tag: typeof input.tag === "string" ? input.tag : "",
    collection: typeof input.collection === "string" ? input.collection : "",
    featured: input.featured === "true" || input.featured === "false" ? input.featured : "all",
    status:
      input.status === "healthy" || input.status === "warning" || input.status === "broken" || input.status === "unknown"
        ? input.status
        : "all",
    sort: input.sort === "title" || input.sort === "recent" || input.sort === "featured" ? input.sort : "relevance"
  };
}

function resolveUniqueSlug(baseValue: string, usedSlugs: Set<string>) {
  const baseSlug = slugify(baseValue) || "item";
  let candidate = baseSlug;
  let suffix = 2;

  while (usedSlugs.has(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  usedSlugs.add(candidate);
  return candidate;
}

function serializeTag(input: {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): TagRecord {
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    sortOrder: input.sortOrder,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString()
  };
}

function serializeCollection(input: {
  id: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): CollectionRecord {
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    published: input.published,
    sortOrder: input.sortOrder,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString()
  };
}

function serializeSavedView(input: {
  id: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  sortOrder: number;
  queryStateJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SavedViewRecord {
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    published: input.published,
    sortOrder: input.sortOrder,
    queryState: resolveSavedViewState((input.queryStateJson ?? {}) as Partial<SavedViewQueryState>),
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString()
  };
}

async function writeTagLinks(tx: Prisma.TransactionClient, tagId: string, linkIds: string[]) {
  await tx.linkTag.deleteMany({ where: { tagId } });

  if (!linkIds.length) {
    return;
  }

  await tx.linkTag.createMany({
    data: [...new Set(linkIds)].map((linkId) => ({
      tagId,
      linkId
    }))
  });
}

async function writeCollectionLinks(tx: Prisma.TransactionClient, collectionId: string, linkIds: string[]) {
  await tx.collectionLink.deleteMany({ where: { collectionId } });

  if (!linkIds.length) {
    return;
  }

  await tx.collectionLink.createMany({
    data: [...new Set(linkIds)].map((linkId, index) => ({
      collectionId,
      linkId,
      sortOrder: index
    }))
  });
}

export async function getTagRecords() {
  if (getStorageMode() !== "database") {
    return [] as TagRecord[];
  }

  const tags = await prisma.tag.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return tags.map(serializeTag);
}

export async function getTagEditorRecords() {
  if (getStorageMode() !== "database") {
    return [] as TagEditorRecord[];
  }

  const tags = await prisma.tag.findMany({
    include: {
      links: {
        select: { linkId: true }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return tags.map((tag) => ({
    ...serializeTag(tag),
    linkIds: tag.links.map((item) => item.linkId)
  }));
}

export async function getCollectionRecords() {
  if (getStorageMode() !== "database") {
    return [] as CollectionRecord[];
  }

  const collections = await prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return collections.map(serializeCollection);
}

export async function getCollectionEditorRecords() {
  if (getStorageMode() !== "database") {
    return [] as CollectionEditorRecord[];
  }

  const collections = await prisma.collection.findMany({
    include: {
      links: {
        orderBy: [{ sortOrder: "asc" }],
        select: { linkId: true }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return collections.map((collection) => ({
    ...serializeCollection(collection),
    linkIds: collection.links.map((item) => item.linkId)
  }));
}

export async function getSavedViewRecords() {
  if (getStorageMode() !== "database") {
    return [] as SavedViewRecord[];
  }

  const savedViews = await prisma.savedView.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return savedViews.map(serializeSavedView);
}

export async function createTag(input: CreateTagInput) {
  requireAdvancedDirectory("Tags");

  return prisma.$transaction(async (tx) => {
    const usedSlugs = new Set((await tx.tag.findMany({ select: { slug: true } })).map((item) => item.slug));
    const tag = await tx.tag.create({
      data: {
        name: input.name,
        slug: resolveUniqueSlug(input.name, usedSlugs),
        description: input.description,
        sortOrder: input.sortOrder
      }
    });

    await writeTagLinks(tx, tag.id, input.linkIds ?? []);
    return serializeTag(tag);
  });
}

export async function updateTag(input: UpdateTagInput) {
  requireAdvancedDirectory("Tags");

  return prisma.$transaction(async (tx) => {
    const usedSlugs = new Set(
      (await tx.tag.findMany({ select: { id: true, slug: true } }))
        .filter((item) => item.id !== input.id)
        .map((item) => item.slug)
    );

    const tag = await tx.tag.update({
      where: { id: input.id },
      data: {
        name: input.name,
        slug: resolveUniqueSlug(input.name, usedSlugs),
        description: input.description,
        sortOrder: input.sortOrder
      }
    });

    await writeTagLinks(tx, tag.id, input.linkIds ?? []);
    return serializeTag(tag);
  });
}

export async function deleteTag(id: string) {
  requireAdvancedDirectory("Tags");
  await prisma.tag.delete({ where: { id } });
}

export async function createCollection(input: CreateCollectionInput) {
  requireAdvancedDirectory("Collections");

  return prisma.$transaction(async (tx) => {
    const usedSlugs = new Set((await tx.collection.findMany({ select: { slug: true } })).map((item) => item.slug));
    const collection = await tx.collection.create({
      data: {
        name: input.name,
        slug: resolveUniqueSlug(input.name, usedSlugs),
        description: input.description,
        published: input.published,
        sortOrder: input.sortOrder
      }
    });

    await writeCollectionLinks(tx, collection.id, input.linkIds ?? []);
    return serializeCollection(collection);
  });
}

export async function updateCollection(input: UpdateCollectionInput) {
  requireAdvancedDirectory("Collections");

  return prisma.$transaction(async (tx) => {
    const usedSlugs = new Set(
      (await tx.collection.findMany({ select: { id: true, slug: true } }))
        .filter((item) => item.id !== input.id)
        .map((item) => item.slug)
    );

    const collection = await tx.collection.update({
      where: { id: input.id },
      data: {
        name: input.name,
        slug: resolveUniqueSlug(input.name, usedSlugs),
        description: input.description,
        published: input.published,
        sortOrder: input.sortOrder
      }
    });

    await writeCollectionLinks(tx, collection.id, input.linkIds ?? []);
    return serializeCollection(collection);
  });
}

export async function deleteCollection(id: string) {
  requireAdvancedDirectory("Collections");
  await prisma.collection.delete({ where: { id } });
}

export async function createSavedView(input: CreateSavedViewInput) {
  requireAdvancedDirectory("Saved views");

  const usedSlugs = new Set((await prisma.savedView.findMany({ select: { slug: true } })).map((item) => item.slug));
  const savedView = await prisma.savedView.create({
    data: {
      name: input.name,
      slug: resolveUniqueSlug(input.name, usedSlugs),
      description: input.description,
      published: input.published,
      sortOrder: input.sortOrder,
      queryStateJson: resolveSavedViewState(input.queryState)
    }
  });

  return serializeSavedView(savedView);
}

export async function updateSavedView(input: UpdateSavedViewInput) {
  requireAdvancedDirectory("Saved views");

  const usedSlugs = new Set(
    (await prisma.savedView.findMany({ select: { id: true, slug: true } }))
      .filter((item) => item.id !== input.id)
      .map((item) => item.slug)
  );

  const savedView = await prisma.savedView.update({
    where: { id: input.id },
    data: {
      name: input.name,
      slug: resolveUniqueSlug(input.name, usedSlugs),
      description: input.description,
      published: input.published,
      sortOrder: input.sortOrder,
      queryStateJson: resolveSavedViewState(input.queryState)
    }
  });

  return serializeSavedView(savedView);
}

export async function deleteSavedView(id: string) {
  requireAdvancedDirectory("Saved views");
  await prisma.savedView.delete({ where: { id } });
}
