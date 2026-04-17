import { notFound } from "next/navigation";

import { DirectoryShell } from "@/components/directory/directory-shell";
import { getSavedViewPageData } from "@/lib/queries";

type SavedViewPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SavedViewPage({ params }: SavedViewPageProps) {
  const { slug } = await params;
  const { categories, settings, commandItems, lensShortcuts, savedView, searchResult } = await getSavedViewPageData(slug);

  if (!savedView) {
    notFound();
  }

  return (
    <DirectoryShell
      categories={categories}
      settings={settings}
      commandItems={commandItems}
      lensShortcuts={lensShortcuts}
      activeCategorySlug={searchResult.params.category || undefined}
      page={{
        kind: "view",
        eyebrow: "\u4fdd\u5b58\u89c6\u56fe",
        title: savedView.name,
        subtitle: savedView.description || "\u4e00\u4e2a\u7531\u540e\u53f0\u7ef4\u62a4\u7684\u516c\u5f00\u7b5b\u9009\u5feb\u7167\u3002",
        stats: [`${searchResult.total} \u4e2a\u7ad9\u70b9`, savedView.published ? "\u5df2\u53d1\u5e03" : "\u8349\u7a3f", "\u53ef\u5206\u4eab\u94fe\u63a5"],
        searchPlaceholder: `\u5728\u89c6\u56fe ${savedView.name} \u4e2d\u641c\u7d22...`,
        searchParams: searchResult.params,
        links: searchResult.results,
        sectionKicker: "\u4fdd\u5b58\u89c6\u56fe",
        sectionTitle: savedView.name,
        sectionNote: "\u4fdd\u5b58\u89c6\u56fe\u662f\u540e\u53f0\u5b9a\u4e49\u597d\u7684\u516c\u5f00\u67e5\u8be2\u5feb\u7167\u3002\u4e0b\u65b9\u7b5b\u9009\u9879\u53ef\u4ee5\u57fa\u4e8e\u5f53\u524d\u89c6\u56fe\u7ee7\u7eed\u6d3e\u751f\u65b0\u7684\u53ef\u5206\u4eab\u641c\u7d22\u94fe\u63a5\u3002",
        emptyMessage: "\u8fd9\u4e2a\u4fdd\u5b58\u89c6\u56fe\u5f53\u524d\u6ca1\u6709\u8fd4\u56de\u4efb\u4f55\u7f51\u7ad9\u3002",
        facets: searchResult.facets,
        backHref: "/",
        backLabel: "\u8fd4\u56de\u9996\u9875",
        gridVariant: "dense"
      }}
    />
  );
}
