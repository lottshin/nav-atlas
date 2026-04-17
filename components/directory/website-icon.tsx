"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SiteIcon } from "@/components/icons";
import { buildFaviconSources, isImageLikeFavicon, isRemoteFaviconSource } from "@/lib/favicon-sources";

type WebsiteIconProps = {
  linkId?: string;
  url: string;
  icon: string;
  iconUrl?: string | null;
  faviconUrl?: string | null;
  preferredSource?: string | null;
  title: string;
};

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

function buildPreferredSources(input: { url: string; icon: string; iconUrl?: string | null; faviconUrl?: string | null }, preferredSource: string | null) {
  const sources = buildFaviconSources(input);
  const explicitSources = [...new Set([input.iconUrl, input.icon, input.faviconUrl].filter((value): value is string => Boolean(value && isImageLikeFavicon(value))))];
  const fallbackSources = sources.filter((source) => !explicitSources.includes(source));
  return [...prioritizeWithinGroup(explicitSources, preferredSource), ...prioritizeWithinGroup(fallbackSources, preferredSource)];
}

function toRenderableFaviconSource(value: string, linkId?: string) {
  if (!isRemoteFaviconSource(value)) {
    return value;
  }

  const params = new URLSearchParams({
    source: value
  });
  if (linkId) {
    params.set("linkId", linkId);
  }

  return `/api/favicon?${params.toString()}`;
}

export function WebsiteIcon({ linkId, url, icon, iconUrl, faviconUrl, preferredSource = null, title }: WebsiteIconProps) {
  const sources = useMemo(() => buildPreferredSources({ url, icon, iconUrl, faviconUrl }, preferredSource), [faviconUrl, icon, iconUrl, preferredSource, url]);
  const sourceKey = sources.join("|");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [usingDirectRemoteFallback, setUsingDirectRemoteFallback] = useState(false);
  const warmedSourceKeysRef = useRef<Set<string>>(new Set());
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setCurrentIndex(0);
    setLoadedSource(null);
    setUsingDirectRemoteFallback(false);
    warmedSourceKeysRef.current.clear();
  }, [linkId, sourceKey]);

  const currentSource = sources[currentIndex];
  const canUseProxy = Boolean(linkId && currentSource && isRemoteFaviconSource(currentSource));
  const renderSource = currentSource ? (isRemoteFaviconSource(currentSource) && !usingDirectRemoteFallback ? toRenderableFaviconSource(currentSource, linkId) : currentSource) : null;

  const warmCachedSource = useCallback(() => {
    if (!linkId || !currentSource || !isRemoteFaviconSource(currentSource) || !usingDirectRemoteFallback) {
      return;
    }

    const warmKey = `${linkId}:${currentIndex}:${currentSource}`;
    if (warmedSourceKeysRef.current.has(warmKey)) {
      return;
    }

    warmedSourceKeysRef.current.add(warmKey);
    void fetch("/api/favicon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        linkId,
        candidate: currentIndex,
        source: currentSource
      }),
      keepalive: true
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Warm request failed");
        }

        return (await response.json()) as { ok?: boolean };
      })
      .then(() => undefined)
      .catch(() => {
        warmedSourceKeysRef.current.delete(warmKey);
      });
  }, [currentIndex, currentSource, linkId, usingDirectRemoteFallback]);

  const advanceSource = useCallback(() => {
    if (canUseProxy && !usingDirectRemoteFallback) {
      setUsingDirectRemoteFallback(true);
      return;
    }

    setUsingDirectRemoteFallback(false);
    setCurrentIndex((index) => index + 1);
  }, [canUseProxy, usingDirectRemoteFallback]);

  useEffect(() => {
    if (!renderSource) {
      setLoadedSource(null);
      return;
    }

    setLoadedSource((current) => (current === renderSource ? current : null));

    const image = imageRef.current;
    if (!image || image.getAttribute("src") !== renderSource || !image.complete) {
      return;
    }

    if (image.naturalWidth > 0) {
      setLoadedSource(renderSource);
      warmCachedSource();
      return;
    }

    advanceSource();
  }, [advanceSource, renderSource, warmCachedSource]);

  return (
    <span className="listing-favicon-shell" aria-hidden="true">
      <SiteIcon name={icon || "globe"} className={`listing-icon-svg listing-icon-svg--fallback ${loadedSource === renderSource ? "is-hidden" : ""}`} />
      {renderSource ? (
        <img
          ref={imageRef}
          key={renderSource}
          src={renderSource}
          alt=""
          className={`listing-favicon ${loadedSource === renderSource ? "is-ready" : ""}`}
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={() => {
            setLoadedSource(renderSource);
            warmCachedSource();
          }}
          onError={() => {
            advanceSource();
          }}
        />
      ) : null}
    </span>
  );
}
