import "server-only";

import { getPreferredFaviconSource } from "@/lib/favicon-preferences";
import { prisma } from "@/lib/prisma";
import { getStorageMode } from "@/lib/env";
import { buildFaviconSources, isImageLikeFavicon, isRemoteFaviconSource } from "@/lib/favicon-sources";
import { getLinkRecords } from "@/lib/repository";

function prioritizeWithinGroup(sources: string[], preferredSource: string | null) {
  if (!preferredSource) {
    return sources;
  }

  const preferredIndex = sources.indexOf(preferredSource);
  if (preferredIndex <= 0) {
    return sources;
  }

  return [sources[preferredIndex], ...sources.slice(0, preferredIndex), ...sources.slice(preferredIndex + 1)];
}

function buildPreferredFaviconSources(
  input: {
    url: string;
    icon: string;
    iconUrl?: string | null;
    faviconUrl?: string | null;
  },
  preferredSource: string | null
) {
  const sources = buildFaviconSources(input);
  const explicitSources = [...new Set([input.iconUrl, input.icon, input.faviconUrl].filter((value): value is string => Boolean(value && isImageLikeFavicon(value))))];
  const fallbackSources = sources.filter((source) => !explicitSources.includes(source));

  return [...prioritizeWithinGroup(explicitSources, preferredSource), ...prioritizeWithinGroup(fallbackSources, preferredSource)];
}

export async function listKnownFaviconSourcesForLink(linkId: string) {
  if (!linkId) {
    return [];
  }

  const preferredSource = await getPreferredFaviconSource(linkId);

  if (getStorageMode() === "database") {
    const link = await prisma.link.findUnique({
      where: { id: linkId },
      select: {
        url: true,
        icon: true,
        iconUrl: true,
        faviconUrl: true,
        metadata: {
          select: {
            faviconUrl: true
          }
        }
      }
    });

    if (!link) {
      return [];
    }

    return buildPreferredFaviconSources(
      {
        url: link.url,
        icon: link.icon,
        iconUrl: link.iconUrl,
        faviconUrl: link.metadata?.faviconUrl ?? link.faviconUrl
      },
      preferredSource
    );
  }

  const links = await getLinkRecords();
  const link = links.find((item) => item.id === linkId);
  if (!link) {
    return [];
  }

  return buildPreferredFaviconSources(
    {
      url: link.url,
      icon: link.icon,
      iconUrl: link.iconUrl,
      faviconUrl: link.faviconUrl
    },
    preferredSource
  );
}

export async function resolveKnownFaviconSource(linkId: string, candidateIndex: number) {
  if (!linkId || !Number.isInteger(candidateIndex) || candidateIndex < 0) {
    return null;
  }

  const sources = await listKnownFaviconSourcesForLink(linkId);
  return sources[candidateIndex] ?? null;
}

export async function listKnownRemoteFaviconSources() {
  if (getStorageMode() === "database") {
    const links = await prisma.link.findMany({
      select: {
        url: true,
        icon: true,
        iconUrl: true,
        faviconUrl: true,
        metadata: {
          select: {
            faviconUrl: true
          }
        }
      }
    });

    return new Set(
      links.flatMap((link) =>
        buildFaviconSources({
          url: link.url,
          icon: link.icon,
          iconUrl: link.iconUrl,
          faviconUrl: link.metadata?.faviconUrl ?? link.faviconUrl
        }).filter(isRemoteFaviconSource)
      )
    );
  }

  const links = await getLinkRecords();
  return new Set(
    links.flatMap((link) =>
      buildFaviconSources({
        url: link.url,
        icon: link.icon,
        iconUrl: link.iconUrl,
        faviconUrl: link.faviconUrl
      }).filter(isRemoteFaviconSource)
    )
  );
}
