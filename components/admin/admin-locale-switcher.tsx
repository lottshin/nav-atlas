"use client";

import { setAdminLocaleAction } from "@/app/admin/actions";
import type { AdminLocale } from "@/lib/admin-locale";

type AdminLocaleSwitcherProps = {
  locale: AdminLocale;
  returnTo: string;
  compact?: boolean;
};

export function AdminLocaleSwitcher({ locale, returnTo, compact = false }: AdminLocaleSwitcherProps) {
  return (
    <form action={setAdminLocaleAction} className={`admin-locale-switch ${compact ? "is-compact" : ""}`}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        name="locale"
        value="zh"
        className={`admin-locale-button ${locale === "zh" ? "is-active" : ""}`}
        aria-pressed={locale === "zh"}
      >
        中文
      </button>
      <button
        type="submit"
        name="locale"
        value="en"
        className={`admin-locale-button ${locale === "en" ? "is-active" : ""}`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </form>
  );
}
