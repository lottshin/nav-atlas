import { notFound } from "next/navigation";

import { DirectoryShell } from "@/components/directory/directory-shell";
import { getCollectionPageData } from "@/lib/queries";

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const { categories, settings, commandItems, lensShortcuts, collection, searchResult } = await getCollectionPageData(slug);

  if (!collection) {
    notFound();
  }

  return (
    <DirectoryShell
      categories={categories}
      settings={settings}
      commandItems={commandItems}
      lensShortcuts={lensShortcuts}
      page={{
        kind: "collection",
        eyebrow: "\u7cbe\u9009\u96c6\u5408",
        title: collection.name,
        subtitle: collection.description || "\u4e00\u4e2a\u9762\u5411\u7279\u5b9a\u5de5\u4f5c\u6d41\u6216\u4eba\u7fa4\u7684\u516c\u5f00\u7cbe\u9009\u6e05\u5355\u3002",
        stats: [`${searchResult.total} \u4e2a\u7ad9\u70b9`, collection.published ? "\u5df2\u53d1\u5e03" : "\u8349\u7a3f", "\u53ef\u5206\u4eab"],
        searchPlaceholder: `\u5728\u96c6\u5408 ${collection.name} \u4e2d\u641c\u7d22...`,
        searchParams: { ...searchResult.params, collection: collection.slug },
        links: searchResult.results,
        sectionKicker: "\u96c6\u5408",
        sectionTitle: collection.name,
        sectionNote: "\u96c6\u5408\u662f\u516c\u5f00\u53d1\u5e03\u7684\u6709\u5e8f\u7cbe\u9009\u5217\u8868\u3002\u53ef\u4ee5\u7ee7\u7eed\u4f7f\u7528\u7b5b\u9009\u9762\u677f\uff0c\u4ece\u8fd9\u4e2a\u96c6\u5408\u5207\u5230\u66f4\u7a84\u7684\u516c\u5f00\u7ed3\u679c\u9875\u3002",
        emptyMessage: "\u8fd9\u4e2a\u96c6\u5408\u6682\u65f6\u8fd8\u6ca1\u6709\u5df2\u53d1\u5e03\u7684\u7f51\u7ad9\u3002",
        facets: searchResult.facets,
        backHref: "/",
        backLabel: "\u8fd4\u56de\u9996\u9875",
        gridVariant: "dense"
      }}
    />
  );
}
