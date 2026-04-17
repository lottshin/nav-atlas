import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminTheme } from "@/lib/admin-theme-server";
import { getStorageMode } from "@/lib/env";
import { getAdminLayoutData } from "@/lib/queries";

export default async function AdminPanelLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const locale = await getAdminLocale();
  const theme = await getAdminTheme();
  const { settings, stats } = await getAdminLayoutData();

  return (
    <main className="admin-shell">
      <AdminShell
        branding={settings.adminBranding}
        locale={locale}
        theme={theme}
        username={session.user.name ?? "admin"}
        storageMode={getStorageMode()}
        stats={stats}
      >
        {children}
      </AdminShell>
    </main>
  );
}
