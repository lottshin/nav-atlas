import { CategoryManagementWorkspace } from "@/components/admin/category-management-workspace";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminCategoriesPageData } from "@/lib/queries";

export default async function AdminCategoriesPage() {
  const locale = await getAdminLocale();
  const { categories } = await getAdminCategoriesPageData();

  return <CategoryManagementWorkspace categories={categories} locale={locale} />;
}
