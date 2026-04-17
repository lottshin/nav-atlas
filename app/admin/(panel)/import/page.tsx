import { ImportWorkspace } from "@/components/admin/import-workspace";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminImportPageData } from "@/lib/queries";

export default async function AdminImportPage() {
  const locale = await getAdminLocale();
  const { categories, links, batches } = await getAdminImportPageData();

  return <ImportWorkspace categories={categories} links={links} batches={batches} locale={locale} />;
}
