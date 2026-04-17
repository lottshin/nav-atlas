import { DirectoryShell } from "@/components/directory/directory-shell";
import { getSearchPageData } from "@/lib/queries";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = await searchParams;
  const { categories, settings, commandItems, lensShortcuts, searchResult } = await getSearchPageData(resolvedSearchParams);

  return (
    <DirectoryShell
      categories={categories}
      settings={settings}
      commandItems={commandItems}
      lensShortcuts={lensShortcuts}
      activeCategorySlug={searchResult.params.category || undefined}
      page={{
        kind: "search",
        eyebrow: "\u670d\u52a1\u7aef\u641c\u7d22",
        title: searchResult.params.q ? "\u641c\u7d22\u7ed3\u679c" : "\u6d4f\u89c8\u76ee\u5f55",
        subtitle: searchResult.params.q
          ? `\u4e0e\u201c${searchResult.params.q}\u201d\u76f8\u5173\u7684\u7ed3\u679c\uff0c\u5305\u542b\u5206\u7c7b\u3001\u6807\u7b7e\u3001\u96c6\u5408\u548c\u5143\u6570\u636e\u547d\u4e2d\u3002`
          : "\u4f7f\u7528\u7edf\u4e00\u67e5\u8be2\u5c42\u6309\u5206\u7c7b\u3001\u6807\u7b7e\u3001\u96c6\u5408\u3001\u72b6\u6001\u548c\u63a8\u8350\u6807\u8bb0\u7b5b\u9009\u516c\u5f00\u76ee\u5f55\u3002",
        stats: [
          `${searchResult.total} \u6761\u7ed3\u679c`,
          `${
            searchResult.params.category || searchResult.params.tag || searchResult.params.collection
              ? "\u5df2\u7b5b\u9009"
              : "\u5168\u90e8\u5206\u7c7b"
          }`,
          "\u53ef\u5206\u4eab\u94fe\u63a5"
        ],
        searchPlaceholder: "\u641c\u7d22\u7ad9\u70b9\u3001\u6807\u7b7e\u3001\u96c6\u5408\u3001\u5143\u6570\u636e...",
        searchParams: searchResult.params,
        links: searchResult.results,
        sectionKicker: "\u641c\u7d22",
        sectionTitle: "\u7b5b\u9009\u7ed3\u679c",
        sectionNote: "\u4e0b\u65b9\u7b5b\u9009\u9879\u4f1a\u751f\u6210\u53ef\u5206\u4eab\u7684\u641c\u7d22\u94fe\u63a5\uff0c\u5e76\u4fdd\u6301\u5728\u540c\u4e00\u5957\u9ed1\u767d\u6d4f\u89c8\u754c\u9762\u4e2d\u3002",
        emptyMessage: "\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u7684\u7f51\u7ad9\u3002",
        facets: searchResult.facets,
        gridVariant: "dense"
      }}
    />
  );
}
