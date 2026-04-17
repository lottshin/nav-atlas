"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { ADMIN_THEME_COOKIE, resolveAdminTheme } from "@/lib/admin-theme";

const NAV_THEME_STORAGE_KEY = "nav-theme";

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function resolvePathTheme(pathname: string) {
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isAdmin) {
    return resolveAdminTheme(window.localStorage.getItem(NAV_THEME_STORAGE_KEY), "light");
  }

  return resolveAdminTheme(readCookie(ADMIN_THEME_COOKIE), "light");
}

export function ThemeSync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolvePathTheme(pathname ?? "/");
  }, [pathname]);

  return null;
}
