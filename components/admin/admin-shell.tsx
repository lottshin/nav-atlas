"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { logoutAction } from "@/app/admin/actions";
import { AdminLocaleSwitcher } from "@/components/admin/admin-locale-switcher";
import { AdminThemeToggle } from "@/components/admin/admin-theme-toggle";
import { SubmitButton } from "@/components/admin/submit-button";
import { ArrowUpRightIcon, CheckIcon, GridIcon, LayersIcon, RocketIcon, ShieldIcon, SparkIcon, TerminalIcon } from "@/components/icons";
import type { AdminLocale } from "@/lib/admin-locale";
import type { AdminOverviewStats, StorageMode, ThemeMode } from "@/lib/types";

type AdminShellProps = {
  branding: string;
  locale: AdminLocale;
  theme: ThemeMode;
  username: string;
  storageMode: StorageMode;
  stats: AdminOverviewStats;
  children: ReactNode;
};

function getNavItems(locale: AdminLocale) {
  const isZh = locale === "zh";

  return [
    { href: "/admin", label: isZh ? "总览" : "Overview", description: isZh ? "系统摘要" : "System summary", icon: GridIcon },
    { href: "/admin/links", label: isZh ? "站点" : "Links", description: isZh ? "目录记录" : "Directory records", icon: TerminalIcon },
    { href: "/admin/categories", label: isZh ? "分类" : "Categories", description: isZh ? "浏览结构" : "Browse structure", icon: LayersIcon },
    { href: "/admin/tags", label: isZh ? "标签" : "Tags", description: isZh ? "主题标记" : "Topic markers", icon: SparkIcon },
    { href: "/admin/collections", label: isZh ? "集合" : "Collections", description: isZh ? "策展清单" : "Curated lists", icon: LayersIcon },
    { href: "/admin/views", label: isZh ? "视图" : "Views", description: isZh ? "保存筛选" : "Saved filters", icon: GridIcon },
    { href: "/admin/import", label: isZh ? "导入" : "Import", description: isZh ? "导入与导出" : "Intake and export", icon: RocketIcon },
    { href: "/admin/health", label: isZh ? "健康" : "Health", description: isZh ? "可用性信号" : "Availability signals", icon: CheckIcon },
    { href: "/admin/metadata", label: isZh ? "元数据" : "Metadata", description: isZh ? "解析结果" : "Resolved content", icon: SparkIcon },
    { href: "/admin/tasks", label: isZh ? "任务" : "Tasks", description: isZh ? "队列与执行器" : "Queue and runner", icon: SparkIcon },
    { href: "/admin/settings", label: isZh ? "设置" : "Settings", description: isZh ? "品牌与默认值" : "Brand and defaults", icon: ShieldIcon }
  ] as const;
}

export function AdminShell({ branding, locale, theme, username, storageMode, stats, children }: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navOpen, setNavOpen] = useState(false);
  const isZh = locale === "zh";
  const navItems = useMemo(() => getNavItems(locale), [locale]);
  const returnTo = useMemo(() => {
    const currentPath = pathname ?? "/admin";
    const query = searchParams.toString();
    return query ? `${currentPath}?${query}` : currentPath;
  }, [pathname, searchParams]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const statusPills = useMemo(
    () => [
      `${isZh ? "存储" : "storage"} ${storageMode.toUpperCase()}`,
      `${stats.linkCount} ${isZh ? "站点" : "sites"}`,
      `${stats.categoryCount} ${isZh ? "分类" : "cats"}`
    ],
    [isZh, stats.categoryCount, stats.linkCount, storageMode]
  );

  return (
    <div className={`admin-app ${navOpen ? "is-open" : ""} ${isZh ? "is-zh" : "is-en"}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-panel">
          <div className="admin-brand-block">
            <p className="eyebrow">{isZh ? "后台控制台" : "control room"}</p>
            <Link href="/admin" className="admin-brand-title">
              {branding}
            </Link>
            <p className="admin-brand-note">
              {isZh
                ? "延续前台的黑白纸面语法，但把真正的运营动作收进更轻的后台骨架。"
                : "Keep the front-end paper aesthetic, but route real operating work through a lighter admin frame."}
            </p>
          </div>

          <div className="admin-sidebar-pills">
            {statusPills.map((pill) => (
              <span key={pill}>{pill}</span>
            ))}
          </div>

          <nav className="admin-nav" aria-label={isZh ? "后台分区" : "Admin sections"}>
            {navItems.map((item) => {
              const isActive = item.href === "/admin" ? pathname === item.href : pathname?.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href} className={`admin-nav-link ${isActive ? "is-active" : ""}`}>
                  <Icon className="admin-nav-icon" />
                  <span className="admin-nav-copy">
                    <span className="admin-nav-label">{item.label}</span>
                    <span className="admin-nav-kicker">{item.description}</span>
                  </span>
                  <ArrowUpRightIcon className="admin-nav-arrow" />
                </Link>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <p className="admin-sidebar-note">
              {isZh
                ? `当前操作员：${username || "admin"}。所有改动会立即影响公开目录。`
                : `Current operator: ${username || "admin"}. All changes affect the public directory immediately.`}
            </p>
            <Link href="/" className="admin-utility-link">
              {isZh ? "查看前台" : "View front-end"}
              <ArrowUpRightIcon className="admin-utility-icon" />
            </Link>
          </div>
        </div>
      </aside>

      <div className="admin-frame">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-mobile-toggle"
            onClick={() => setNavOpen((current) => !current)}
            aria-expanded={navOpen}
            aria-label={navOpen ? (isZh ? "关闭后台导航" : "Close admin navigation") : isZh ? "打开后台导航" : "Open admin navigation"}
          >
            {navOpen ? (isZh ? "关闭" : "CLOSE") : isZh ? "菜单" : "MENU"}
          </button>

          <div className="admin-topbar-copy">
            <p className="section-kicker">{isZh ? "目录运营" : "directory operations"}</p>
            <h1 className="admin-topbar-title">{branding}</h1>
            <p className="admin-topbar-note">
              {isZh ? "后台继续沿用黑白纸面逻辑，但把结构、任务和维护动作组织成更稳定的工作流。" : "The admin keeps the same monochrome paper logic as the public site, but adds real operational structure."}
            </p>
          </div>

          <div className="admin-topbar-actions">
            <AdminThemeToggle initialTheme={theme} locale={locale} compact />
            <AdminLocaleSwitcher locale={locale} returnTo={returnTo} compact />
            <Link href="/" className="secondary-button">
              {isZh ? "查看前台" : "View front-end"}
            </Link>
            <form action={logoutAction}>
              <SubmitButton className="secondary-button" pendingLabel={isZh ? "退出中..." : "Signing out..."}>
                {isZh ? "退出登录" : "Sign out"}
              </SubmitButton>
            </form>
          </div>
        </header>

        <div className="admin-view">{children}</div>
      </div>

      {navOpen ? (
        <button type="button" className="admin-backdrop" onClick={() => setNavOpen(false)} aria-label={isZh ? "关闭导航" : "Close navigation"} />
      ) : null}
    </div>
  );
}
