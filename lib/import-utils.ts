export type ImportPreviewItem = {
  title: string;
  url: string;
  description: string;
  icon: string;
  sourceCategory: string;
  sortOrder: number;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function fallbackTitle(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function parseJsonImportText(text: string): ImportPreviewItem[] {
  const parsed = JSON.parse(text) as unknown;
  const list = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed && "links" in parsed ? (parsed as { links: unknown[] }).links : [];
  const categories =
    typeof parsed === "object" && parsed && "categories" in parsed && Array.isArray((parsed as { categories: unknown[] }).categories)
      ? (parsed as { categories: Array<{ id?: string; name?: string }> }).categories
      : [];
  const categoryMap = new Map(categories.map((category) => [category.id ?? "", category.name ?? "Imported"]));

  return list
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const source = item as Record<string, unknown>;
      const url = typeof source.url === "string" ? source.url : "";
      if (!url) {
        return null;
      }

      const sourceCategory =
        (typeof source.categoryName === "string" && source.categoryName) ||
        (typeof source.category === "string" && source.category) ||
        (typeof source.categoryId === "string" && categoryMap.get(source.categoryId)) ||
        "Imported";

      return {
        title:
          (typeof source.title === "string" && source.title) ||
          (typeof source.name === "string" && source.name) ||
          fallbackTitle(url),
        url,
        description: typeof source.description === "string" ? source.description : "",
        icon: typeof source.icon === "string" ? source.icon : "",
        sourceCategory,
        sortOrder: typeof source.sortOrder === "number" ? source.sortOrder : index + 1
      };
    })
    .filter((item): item is ImportPreviewItem => Boolean(item));
}

export function parseBookmarksHtmlText(text: string): ImportPreviewItem[] {
  const items: ImportPreviewItem[] = [];
  const tokenPattern = /<h3[^>]*>(.*?)<\/h3>|<a\b([^>]*)href="([^"]+)"([^>]*)>(.*?)<\/a>/gims;
  let currentCategory = "Bookmarks";
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text))) {
    const [, heading, preAttrs = "", href = "", postAttrs = "", title = ""] = match;

    if (heading) {
      currentCategory = decodeHtml(stripTags(heading)).trim() || currentCategory;
      continue;
    }

    if (!href) {
      continue;
    }

    const attrs = `${preAttrs} ${postAttrs}`;
    const descriptionMatch = attrs.match(/description="([^"]*)"/i);

    items.push({
      title: decodeHtml(stripTags(title)).trim() || fallbackTitle(href),
      url: href,
      description: descriptionMatch ? decodeHtml(descriptionMatch[1]).trim() : "",
      icon: "",
      sourceCategory: currentCategory || "Bookmarks",
      sortOrder: items.length + 1
    });
  }

  return items;
}
