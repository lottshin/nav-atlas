export type AdminLocale = "zh" | "en";

export const ADMIN_LOCALE_COOKIE = "admin_locale";

export function resolveAdminLocale(value: string | null | undefined): AdminLocale {
  return value === "en" ? "en" : "zh";
}

export function getAdminIntlLocale(locale: AdminLocale) {
  return locale === "en" ? "en-US" : "zh-CN";
}
