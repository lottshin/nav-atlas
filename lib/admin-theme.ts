import type { ThemeMode } from "@/lib/types";

export const ADMIN_THEME_COOKIE = "admin_theme";
export const ADMIN_THEME_STORAGE_KEY = "admin-theme";

export function resolveAdminTheme(value: string | null | undefined, fallback: ThemeMode = "light"): ThemeMode {
  return value === "dark" || value === "light" ? value : fallback;
}
