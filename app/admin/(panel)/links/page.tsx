import { LinkManagementWorkspace } from "@/components/admin/link-management-workspace";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminLinksPageData } from "@/lib/queries";

type AdminLinksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLinksPage({ searchParams }: AdminLinksPageProps) {
  const locale = await getAdminLocale();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { advancedEnabled, categories, collections, filters, links, tags, totalLinkCount } = await getAdminLinksPageData(resolvedSearchParams);

  return (
    <LinkManagementWorkspace
      advancedEnabled={advancedEnabled}
      categories={categories}
      tags={tags}
      collections={collections}
      links={links}
      locale={locale}
      totalLinkCount={totalLinkCount}
      filters={filters}
    />
  );
}
