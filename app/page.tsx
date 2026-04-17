import { DirectoryShell } from "@/components/directory/directory-shell";
import { getHomePageData } from "@/lib/queries";

export default async function HomePage() {
  const { categories, settings, featuredLinks, commandItems, lensShortcuts, secondaryEntryQuote } = await getHomePageData();

  return (
    <DirectoryShell
      categories={categories}
      settings={settings}
      commandItems={commandItems}
      lensShortcuts={lensShortcuts}
      page={{
        kind: "home",
        eyebrow: settings.heroEyebrow,
        title: settings.heroTitle,
        subtitle: settings.heroSubtitle,
        stats: [`${categories.length} 个分类`, `${featuredLinks.length} 个推荐`, "Cmd/Ctrl + K"],
        searchPlaceholder: "搜索整个目录...",
        links: featuredLinks,
        lensSectionQuote: secondaryEntryQuote.text,
        lensSectionAttribution: secondaryEntryQuote.attribution,
        sectionKicker: settings.featuredSectionKicker,
        sectionTitle: settings.featuredSectionTitle,
        sectionNote: settings.featuredSectionNote,
        emptyMessage: "还没有推荐站点。",
        gridVariant: "featured"
      }}
    />
  );
}
