import { TaxonomyManagementWorkspace } from "@/components/admin/taxonomy-management-workspace";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminCollectionsPageData } from "@/lib/queries";

export default async function AdminCollectionsPage() {
  const locale = await getAdminLocale();
  const { advancedEnabled, collections, links } = await getAdminCollectionsPageData();

  return <TaxonomyManagementWorkspace mode="collection" advancedEnabled={advancedEnabled} items={collections} links={links} locale={locale} />;
}
