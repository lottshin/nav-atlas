import { notFound } from "next/navigation";

import { DirectoryShell } from "@/components/directory/directory-shell";
import { getTagPageData } from "@/lib/queries";

type TagPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params;
  const { categories, settings, commandItems, lensShortcuts, tag, searchResult } = await getTagPageData(slug);

  if (!tag) {
    notFound();
  }

  return (
    <DirectoryShell
      categories={categories}
      settings={settings}
      commandItems={commandItems}
      lensShortcuts={lensShortcuts}
      page={{
        kind: "tag",
        eyebrow: "\u6807\u7b7e\u89c6\u56fe",
        title: tag.name,
        subtitle: tag.description || "\u4e00\u4e2a\u8de8\u5206\u7c7b\u7684\u8f7b\u91cf\u4e3b\u9898\u5207\u7247\u3002",
        stats: [`${searchResult.total} \u6761\u7ed3\u679c`, "\u8de8\u5206\u7c7b", "Cmd/Ctrl + K"],
        searchPlaceholder: `\u5728\u6807\u7b7e ${tag.name} \u4e2d\u641c\u7d22...`,
        searchParams: { ...searchResult.params, tag: tag.slug },
        links: searchResult.results,
        sectionKicker: "\u6807\u7b7e\u7ed3\u679c",
        sectionTitle: `${tag.name} \u00b7 \u5168\u7ad9\u7ed3\u679c`,
        sectionNote: "\u6807\u7b7e\u662f\u8de8\u5206\u7c7b\u7684\u8f7b\u91cf\u4e3b\u9898\u6807\u8bb0\u3002\u9700\u8981\u65f6\u53ef\u4ee5\u7ee7\u7eed\u7528\u7b5b\u9009\u9762\u677f\u6536\u7a84\u7ed3\u679c\u3002",
        emptyMessage: "\u8fd9\u4e2a\u6807\u7b7e\u4e0b\u6682\u65f6\u8fd8\u6ca1\u6709\u7f51\u7ad9\u3002",
        facets: searchResult.facets,
        backHref: "/",
        backLabel: "\u8fd4\u56de\u9996\u9875",
        gridVariant: "dense"
      }}
    />
  );
}
