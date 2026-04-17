"use client";

import { useEffect, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/icons";
import type { AdminLocale } from "@/lib/admin-locale";
import { ADMIN_THEME_COOKIE, ADMIN_THEME_STORAGE_KEY, resolveAdminTheme } from "@/lib/admin-theme";
import type { ThemeMode } from "@/lib/types";

type AdminThemeToggleProps = {
  initialTheme: ThemeMode;
  locale: AdminLocale;
  compact?: boolean;
};

function applyAdminTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
  document.cookie = `${ADMIN_THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function AdminThemeToggle({ initialTheme, locale, compact = false }: AdminThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const isZh = locale === "zh";

  useEffect(() => {
    const nextTheme = resolveAdminTheme(document.documentElement.dataset.theme, initialTheme);
    setTheme(nextTheme);
    applyAdminTheme(nextTheme);
  }, [initialTheme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyAdminTheme(nextTheme);
  };

  const nextModeLabel = theme === "light" ? (isZh ? "切到暗色" : "Switch to dark") : isZh ? "切到亮色" : "Switch to light";

  return (
    <div className={`admin-locale-switch admin-theme-switch ${compact ? "is-compact" : ""}`}>
      <button
        type="button"
        className="admin-locale-button is-active admin-theme-button"
        onClick={toggleTheme}
        aria-label={isZh ? "切换后台主题" : "Toggle admin theme"}
        aria-pressed={theme === "dark"}
        title={nextModeLabel}
      >
        {theme === "light" ? <MoonIcon className="button-icon" /> : <SunIcon className="button-icon" />}
      </button>
    </div>
  );
}
