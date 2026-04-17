import { notFound } from "next/navigation";

import { DirectoryShell } from "@/components/directory/directory-shell";
import { getCategoryPageData } from "@/lib/queries";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const { category, categories, settings, commandItems, lensShortcuts, searchResult } = await getCategoryPageData(slug);

  if (!category || !searchResult) {
    notFound();
  }

  return (
    <DirectoryShell
      categories={categories}
      settings={settings}
      commandItems={commandItems}
      lensShortcuts={lensShortcuts}
      activeCategorySlug={category.slug}
      page={{
        kind: "category",
        eyebrow: "\u5f53\u524d\u5206\u7c7b",
        title: category.name,
        subtitle: category.description,
        stats: [
          `${searchResult.total} \u4e2a\u7ad9\u70b9`,
          `${searchResult.params.q ? "\u7b5b\u9009\u4e2d" : "\u5b8c\u6574\u5206\u7c7b"}`,
          "Cmd/Ctrl + K"
        ],
        searchPlaceholder: `\u5728 ${category.name} \u4e2d\u641c\u7d22...`,
        searchParams: { category: category.slug },
        links: searchResult.results,
        sectionKicker: `${searchResult.total} \u4e2a\u7ad9\u70b9`,
        sectionTitle: category.name,
        sectionNote: "\u5f53\u524d\u9875\u4ec5\u5c55\u793a\u8fd9\u4e2a\u5206\u7c7b\u4e0b\u7684\u7f51\u7ad9\u3002\u53ef\u4ee5\u4f7f\u7528\u641c\u7d22\u6846\u8df3\u8f6c\u5230\u53ef\u5206\u4eab\u7684\u7b5b\u9009\u7ed3\u679c\u9875\u3002",
        emptyMessage: "\u8fd9\u4e2a\u5206\u7c7b\u4e0b\u6682\u65f6\u6ca1\u6709\u5339\u914d\u7684\u7f51\u7ad9\u3002",
        backHref: "/",
        backLabel: "\u8fd4\u56de\u9996\u9875",
        gridVariant: "dense"
      }}
    />
  );
}
