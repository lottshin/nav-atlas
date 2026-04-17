import { TaxonomyManagementWorkspace } from "@/components/admin/taxonomy-management-workspace";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminTagsPageData } from "@/lib/queries";

export default async function AdminTagsPage() {
  const locale = await getAdminLocale();
  const { advancedEnabled, links, tags } = await getAdminTagsPageData();

  return <TaxonomyManagementWorkspace mode="tag" advancedEnabled={advancedEnabled} items={tags} links={links} locale={locale} />;
}
