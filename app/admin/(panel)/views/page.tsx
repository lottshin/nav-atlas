import { SavedViewWorkspace } from "@/components/admin/saved-view-workspace";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminViewsPageData } from "@/lib/queries";

export default async function AdminViewsPage() {
  const locale = await getAdminLocale();
  const { advancedEnabled, categories, collections, savedViews, tags } = await getAdminViewsPageData();

  return (
    <SavedViewWorkspace advancedEnabled={advancedEnabled} savedViews={savedViews} categories={categories} tags={tags} collections={collections} locale={locale} />
  );
}
