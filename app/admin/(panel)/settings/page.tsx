import { SettingsWorkspace } from "@/components/admin/settings-workspace";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminSettingsPageData } from "@/lib/queries";

export default async function AdminSettingsPage() {
  const locale = await getAdminLocale();
  const { settings, stats } = await getAdminSettingsPageData();

  return <SettingsWorkspace settings={settings} linkCount={stats.linkCount} locale={locale} />;
}
