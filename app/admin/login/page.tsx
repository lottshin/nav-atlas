import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLocaleSwitcher } from "@/components/admin/admin-locale-switcher";
import { AdminThemeToggle } from "@/components/admin/admin-theme-toggle";
import { LoginForm } from "@/components/admin/login-form";
import { SketchEmblem } from "@/components/directory/sketch-emblem";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminTheme } from "@/lib/admin-theme-server";

export default async function AdminLoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/admin");
  }

  const locale = await getAdminLocale();
  const theme = await getAdminTheme();
  const isZh = locale === "zh";

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-art">
          <SketchEmblem />
        </div>
        <div className="auth-copy">
          <div className="admin-auth-topline">
            <p className="eyebrow">{isZh ? "管理员入口" : "admin access"}</p>
            <div className="admin-auth-actions">
              <AdminThemeToggle initialTheme={theme} locale={locale} compact />
              <AdminLocaleSwitcher locale={locale} returnTo="/admin/login" compact />
            </div>
          </div>
          <h1 className="auth-title">{isZh ? "后台控制台" : "CONTROL ROOM."}</h1>
          <p className="auth-subtitle">
            {isZh
              ? "使用管理员账号与密码进入目录后台，维护分类、站点、任务和元数据。"
              : "Use the administrator account and password to enter the directory control room and maintain categories, links, jobs, and metadata."}
          </p>
        </div>
        <LoginForm locale={locale} />
      </div>
    </main>
  );
}
