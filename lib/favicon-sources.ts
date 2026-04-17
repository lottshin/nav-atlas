export type FaviconSourceInput = {
  url: string;
  icon: string;
  iconUrl?: string | null;
  faviconUrl?: string | null;
};

export function isImageLikeFavicon(value: string) {
  return /^(https?:)?\/\//.test(value) || value.startsWith("/") || value.startsWith("data:image/");
}

export function isRemoteFaviconSource(value: string) {
  return /^https?:\/\//i.test(value);
}

export function buildFaviconSources({ url, icon, iconUrl, faviconUrl }: FaviconSourceInput) {
  const sources: string[] = [];

  if (iconUrl && isImageLikeFavicon(iconUrl)) {
    sources.push(iconUrl);
  }

  if (icon && isImageLikeFavicon(icon)) {
    sources.push(icon);
  }

  if (faviconUrl && isImageLikeFavicon(faviconUrl)) {
    sources.push(faviconUrl);
  }

  try {
    const parsed = new URL(url);
    sources.push(`${parsed.origin}/favicon.ico`);
    sources.push(`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsed.origin)}&sz=64`);
  } catch {
    // Ignore malformed URLs here and let the caller fall back to the line icon.
  }

  return [...new Set(sources)];
}
