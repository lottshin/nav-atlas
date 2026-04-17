import "server-only";

import { prisma } from "@/lib/prisma";
import type { LinkSearchDocumentRecord, PublicDirectoryLink } from "@/lib/types";
import { requireAdvancedDirectory } from "@/lib/feature-guard";

function compactSegments(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim().toLowerCase()).filter((value): value is string => Boolean(value)))].join(" ");
}

function toSearchDocument(link: PublicDirectoryLink) {
  const titleText = compactSegments([link.title, link.displayTitle, link.normalizedDomain, link.url]);
  const taxonomyText = compactSegments([
    link.categoryName,
    link.categorySlug,
    ...link.tags.flatMap((tag) => [tag.name, tag.slug]),
    ...link.collections.flatMap((collection) => [collection.name, collection.slug])
  ]);
  const metadataText = compactSegments([
    link.metadata?.resolvedTitle,
    link.metadata?.resolvedDescription,
    link.metadata?.siteName,
    link.metadata?.canonicalUrl
  ]);

  return {
    linkId: link.id,
    titleText,
    taxonomyText,
    metadataText,
    documentText: compactSegments([titleText, taxonomyText, metadataText, link.description, link.displayDescription])
  };
}

function serializeSearchDocument(input: {
  linkId: string;
  titleText: string;
  taxonomyText: string;
  metadataText: string;
  documentText: string;
  updatedAt: Date;
}): LinkSearchDocumentRecord {
  return {
    linkId: input.linkId,
    titleText: input.titleText,
    taxonomyText: input.taxonomyText,
    metadataText: input.metadataText,
    documentText: input.documentText,
    updatedAt: input.updatedAt.toISOString()
  };
}

export async function getSearchDocumentMap(linkIds?: string[]) {
  requireAdvancedDirectory("Search index");

  const uniqueIds = linkIds?.filter(Boolean).length ? [...new Set(linkIds.filter(Boolean))] : undefined;
  const rows = await prisma.linkSearchDocument.findMany({
    where: uniqueIds ? { linkId: { in: uniqueIds } } : undefined
  });

  return new Map(rows.map((row) => [row.linkId, serializeSearchDocument(row)]));
}

export async function deleteSearchDocuments(linkIds: string[]) {
  requireAdvancedDirectory("Search index");

  const uniqueIds = [...new Set(linkIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return 0;
  }

  const result = await prisma.linkSearchDocument.deleteMany({
    where: {
      linkId: { in: uniqueIds }
    }
  });

  return result.count;
}

export async function rebuildSearchDocuments(input: { catalog: PublicDirectoryLink[]; linkIds?: string[] }) {
  requireAdvancedDirectory("Search index");

  const scopedCatalog = input.linkIds?.length ? input.catalog.filter((link) => input.linkIds?.includes(link.id)) : input.catalog;
  const documents = scopedCatalog.map(toSearchDocument);
  const existingIds = new Set(scopedCatalog.map((link) => link.id));
  const scopedIds = input.linkIds?.length ? [...new Set(input.linkIds.filter(Boolean))] : [];
  const removedIds = scopedIds.filter((linkId) => !existingIds.has(linkId));

  if (!documents.length && !removedIds.length && input.linkIds?.length) {
    return {
      rebuiltCount: 0,
      removedCount: 0
    };
  }

  if (!input.linkIds?.length) {
    await prisma.$transaction([
      prisma.linkSearchDocument.deleteMany({}),
      ...(documents.length
        ? [
            prisma.linkSearchDocument.createMany({
              data: documents
            })
          ]
        : [])
    ]);

    return {
      rebuiltCount: documents.length,
      removedCount: 0
    };
  }

  await prisma.$transaction([
    ...documents.map((document) =>
      prisma.linkSearchDocument.upsert({
        where: { linkId: document.linkId },
        create: document,
        update: document
      })
    ),
    ...(removedIds.length
      ? [
          prisma.linkSearchDocument.deleteMany({
            where: { linkId: { in: removedIds } }
          })
        ]
      : [])
  ]);

  return {
    rebuiltCount: documents.length,
    removedCount: removedIds.length
  };
}

function tokenizeKeyword(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreDocumentMatch(document: Pick<LinkSearchDocumentRecord, "titleText" | "taxonomyText" | "metadataText" | "documentText">, tokens: string[]) {
  let score = 0;

  for (const token of tokens) {
    if (document.titleText.includes(token)) {
      score += 4;
    }

    if (document.taxonomyText.includes(token)) {
      score += 2;
    }

    if (document.metadataText.includes(token)) {
      score += 2;
    }

    if (document.documentText.includes(token)) {
      score += 1;
    }
  }

  return score;
}

export async function findMatchingSearchDocumentIds(keyword: string) {
  requireAdvancedDirectory("Search index");

  const tokens = tokenizeKeyword(keyword);
  if (!tokens.length) {
    return [] as string[];
  }

  const rows = await prisma.linkSearchDocument.findMany({
    where: {
      AND: tokens.map((token) => ({
        documentText: {
          contains: token,
          mode: "insensitive"
        }
      }))
    },
    select: {
      linkId: true,
      titleText: true,
      taxonomyText: true,
      metadataText: true,
      documentText: true
    }
  });

  return rows
    .map((row) => ({
      linkId: row.linkId,
      score: scoreDocumentMatch(row, tokens)
    }))
    .sort((left, right) => right.score - left.score)
    .map((row) => row.linkId);
}
