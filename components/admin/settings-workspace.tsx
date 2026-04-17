"use client";

import { useEffect, useState } from "react";

import { saveSettingsAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { SiteIcon } from "@/components/icons";
import type { AdminLocale } from "@/lib/admin-locale";
import { CATEGORY_ICON_OPTIONS, resolveBuiltinIcon } from "@/lib/category-icons";
import type { SiteSettingsRecord } from "@/lib/types";

type SettingsWorkspaceProps = {
  settings: SiteSettingsRecord;
  linkCount: number;
  locale: AdminLocale;
};

export function SettingsWorkspace({ settings, linkCount, locale }: SettingsWorkspaceProps) {
  const [draft, setDraft] = useState(settings);
  const isZh = locale === "zh";
  const sourceLabel =
    draft.secondaryEntrySource === "jinrishici"
      ? isZh
        ? "\u4eca\u65e5\u8bd7\u8bcd"
        : "Jinrishici"
      : isZh
        ? "\u4e00\u8a00"
        : "Hitokoto";
  const homeRailIcon = resolveBuiltinIcon(draft.homeRailIcon, "compass");
  const homeRailLabel = draft.homeRailLabel.trim() || "首页";

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  return (
    <div className="admin-view-stack">
      <section className="admin-page-header">
        <div className="admin-page-copy">
          <p className="section-kicker">{isZh ? "\u8bbe\u7f6e" : "Settings"}</p>
          <h2 className="admin-page-title">{isZh ? "\u7ad9\u70b9\u914d\u7f6e" : "Site settings"}</h2>
          <p className="admin-page-note">
            {isZh
              ? "\u5728\u8fd9\u91cc\u7ef4\u62a4\u524d\u53f0\u4e3b\u6587\u6848\u3001Secondary entry points \u6587\u6848\u6e90\u548c\u540e\u53f0\u54c1\u724c\u4fe1\u606f\uff0c\u540c\u65f6\u4fdd\u7559\u5b9e\u65f6\u9884\u89c8\u3002"
              : "Edit the public copy, the Secondary entry points quote source, and the admin brand while keeping a live preview of the shell signals."}
          </p>
        </div>
        <div className="admin-header-meta">
          <span className="admin-data-chip">
            {linkCount} {isZh ? "\u4e2a\u542f\u7528\u7ad9\u70b9" : "active links"}
          </span>
          <span className="admin-data-chip">
            {draft.defaultTheme === "dark" ? (isZh ? "\u6697\u8272\u4e3b\u9898" : "dark theme") : isZh ? "\u4eae\u8272\u4e3b\u9898" : "light theme"}
          </span>
        </div>
      </section>

      <section className="admin-workspace-grid">
        <article className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-copy">
              <p className="section-kicker">{isZh ? "\u7ad9\u70b9\u8bbe\u7f6e" : "Site settings"}</p>
              <h3 className="admin-card-title">{isZh ? "\u57fa\u7840\u53c2\u6570" : "Core fields"}</h3>
            </div>
          </div>

          <form action={saveSettingsAction} className="admin-form-grid">
            <label className="field-stack">
              <span className="field-label">{isZh ? "\u7ad9\u70b9\u540d\u79f0" : "Site name"}</span>
              <input
                name="siteName"
                value={draft.siteName}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, siteName: event.target.value }))}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "\u54c1\u724c\u4e3b\u6587\u6848" : "Brand mark"}</span>
              <input
                name="brandMark"
                value={draft.brandMark}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, brandMark: event.target.value }))}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "\u54c1\u724c\u6b21\u6587\u6848" : "Brand subline"}</span>
              <input
                name="brandSub"
                value={draft.brandSub}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, brandSub: event.target.value }))}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "Home \u5bfc\u822a\u540d\u79f0" : "Home rail label"}</span>
              <input
                name="homeRailLabel"
                value={draft.homeRailLabel}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, homeRailLabel: event.target.value }))}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "Home \u5bfc\u822a\u56fe\u6807" : "Home rail icon"}</span>
              <div className="admin-icon-select">
                <span className="admin-icon-select-preview" aria-hidden="true">
                  <SiteIcon name={homeRailIcon} width={18} height={18} />
                </span>
                <select
                  name="homeRailIcon"
                  value={draft.homeRailIcon}
                  className="field-input"
                  onChange={(event) => setDraft((current) => ({ ...current, homeRailIcon: event.target.value }))}
                >
                  {CATEGORY_ICON_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="field-stack admin-form-span">
              <span className="field-label">{isZh ? "\u4e3b\u6807\u9898\u4e0a\u65b9\u5bfc\u8bed" : "Hero eyebrow"}</span>
              <input
                name="heroEyebrow"
                value={draft.heroEyebrow}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, heroEyebrow: event.target.value }))}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "\u9996\u9875\u4e3b\u6807\u9898" : "Hero title"}</span>
              <input
                name="heroTitle"
                value={draft.heroTitle}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, heroTitle: event.target.value }))}
              />
            </label>

            <label className="field-stack admin-form-span">
              <span className="field-label">{isZh ? "\u9996\u9875\u526f\u6807\u9898" : "Hero subtitle"}</span>
              <textarea
                name="heroSubtitle"
                rows={3}
                className="field-input field-textarea"
                value={draft.heroSubtitle}
                onChange={(event) => setDraft((current) => ({ ...current, heroSubtitle: event.target.value }))}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "Secondary entry points \u6587\u6848\u6e90" : "Secondary entry points source"}</span>
              <select
                name="secondaryEntrySource"
                value={draft.secondaryEntrySource}
                className="field-input"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    secondaryEntrySource: event.target.value === "jinrishici" ? "jinrishici" : "hitokoto"
                  }))
                }
              >
                <option value="hitokoto">{isZh ? "\u4e00\u8a00\uff08\u9ed8\u8ba4\uff09" : "Hitokoto (default)"}</option>
                <option value="jinrishici">{isZh ? "\u4eca\u65e5\u8bd7\u8bcd" : "Jinrishici"}</option>
              </select>
            </label>

            <label className="field-stack admin-form-span">
              <span className="field-label">{isZh ? "Secondary entry points \u56de\u9000\u6587\u6848" : "Secondary entry points fallback"}</span>
              <textarea
                name="secondaryEntryFallback"
                rows={3}
                className="field-input field-textarea"
                value={draft.secondaryEntryFallback}
                onChange={(event) => setDraft((current) => ({ ...current, secondaryEntryFallback: event.target.value }))}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "\u9996\u9875\u63a8\u8350\u524d\u7f00" : "Featured section kicker"}</span>
              <input
                name="featuredSectionKicker"
                value={draft.featuredSectionKicker}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, featuredSectionKicker: event.target.value }))}
              />
            </label>

            <label className="field-stack admin-form-span">
              <span className="field-label">{isZh ? "\u9996\u9875\u63a8\u8350\u6807\u9898" : "Featured section title"}</span>
              <input
                name="featuredSectionTitle"
                value={draft.featuredSectionTitle}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, featuredSectionTitle: event.target.value }))}
              />
            </label>

            <label className="field-stack admin-form-span">
              <span className="field-label">{isZh ? "\u9996\u9875\u63a8\u8350\u8bf4\u660e" : "Featured section note"}</span>
              <textarea
                name="featuredSectionNote"
                rows={3}
                className="field-input field-textarea"
                value={draft.featuredSectionNote}
                onChange={(event) => setDraft((current) => ({ ...current, featuredSectionNote: event.target.value }))}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "\u5f3a\u8c03\u8272" : "Accent color"}</span>
              <input
                name="accentColor"
                value={draft.accentColor}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, accentColor: event.target.value }))}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "\u9ed8\u8ba4\u4e3b\u9898" : "Default theme"}</span>
              <select
                name="defaultTheme"
                value={draft.defaultTheme}
                className="field-input"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, defaultTheme: event.target.value === "dark" ? "dark" : "light" }))
                }
              >
                <option value="light">{isZh ? "\u4eae\u8272" : "Light"}</option>
                <option value="dark">{isZh ? "\u6697\u8272" : "Dark"}</option>
              </select>
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "\u540e\u53f0\u54c1\u724c\u6587\u6848" : "Admin branding"}</span>
              <input
                name="adminBranding"
                value={draft.adminBranding}
                className="field-input"
                onChange={(event) => setDraft((current) => ({ ...current, adminBranding: event.target.value }))}
              />
            </label>

            <SubmitButton className="primary-button admin-action-button" pendingLabel={isZh ? "\u4fdd\u5b58\u4e2d..." : "Saving..."}>
              {isZh ? "\u4fdd\u5b58\u8bbe\u7f6e" : "Save settings"}
            </SubmitButton>
          </form>
        </article>

        <article className="admin-card">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "\u5b9e\u65f6\u9884\u89c8" : "Live preview"}</p>
            <h3 className="admin-card-title">{isZh ? "\u5373\u65f6\u9884\u89c8" : "Immediate preview"}</h3>
            <p className="admin-card-note">
              {isZh
                ? "\u8fd9\u91cc\u53ea\u9884\u89c8\u6587\u6848\u548c\u4e3b\u9898\u4fe1\u53f7\uff0c\u4e0d\u76f4\u63a5\u62c9\u53d6\u8fdc\u7aef\u4e00\u53e5\u8bdd\u3002\u8fd0\u884c\u65f6\u4f1a\u6309\u5f53\u524d\u6765\u6e90\u8bf7\u6c42\uff0c\u5931\u8d25\u65f6\u9000\u56de\u56de\u9000\u6587\u6848\u3002"
                : "This panel previews the copy and theme signals only. Runtime will fetch from the selected source and fall back to the stored line on failure."}
            </p>
          </div>

          <div className="admin-preview-surface">
            <p className="eyebrow">{draft.heroEyebrow}</p>
            <h3 className="admin-preview-title">{draft.heroTitle}</h3>
            <p className="admin-card-note">{draft.heroSubtitle}</p>
            <div className="admin-sidebar-pills">
              <span>{draft.defaultTheme}</span>
              <span>{draft.accentColor}</span>
            </div>
          </div>

          <div className="admin-callout-list">
            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "\u540e\u53f0\u54c1\u724c\u5757" : "Admin brand block"}</span>
              <span className="admin-card-note">{draft.adminBranding}</span>
            </div>

            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "\u524d\u53f0\u54c1\u724c\u5757" : "Public brand block"}</span>
              <span className="admin-card-note">{draft.brandMark}</span>
              <span className="admin-card-note">{draft.brandSub}</span>
            </div>

            <div className="admin-callout">
                  <span className="admin-callout-title">{isZh ? "Home \u5bfc\u822a\u5165\u53e3" : "Home rail entry"}</span>
                  <div className="admin-rail-preview-row">
                    <span className="admin-rail-preview-state">{isZh ? "\u6536\u8d77\u6001" : "Collapsed"}</span>
                    <div className="admin-rail-preview-item is-collapsed" aria-hidden="true">
                      <SiteIcon name={homeRailIcon} width={18} height={18} className="side-nav-icon" />
                </div>
              </div>
                  <div className="admin-rail-preview-row">
                    <span className="admin-rail-preview-state">{isZh ? "\u5c55\u5f00\u6001" : "Expanded"}</span>
                    <div className="admin-rail-preview-item" aria-hidden="true">
                      <SiteIcon name={homeRailIcon} width={18} height={18} className="side-nav-icon" />
                      <span className="admin-rail-preview-label">{homeRailLabel}</span>
                    </div>
                  </div>
                </div>

            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "Secondary entry points \u6587\u6848" : "Secondary entry points copy"}</span>
              <span className="admin-card-note">{isZh ? `\u5f53\u524d\u6765\u6e90\uff1a${sourceLabel}` : `Current source: ${sourceLabel}`}</span>
              <span className="admin-card-note">{draft.secondaryEntryFallback}</span>
            </div>

            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "\u9996\u9875\u63a8\u8350\u533a" : "Featured section"}</span>
              <span className="admin-card-note">{draft.featuredSectionKicker}</span>
              <span className="admin-card-note">{draft.featuredSectionTitle}</span>
              <span className="admin-card-note">{draft.featuredSectionNote}</span>
            </div>

            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "\u5f53\u524d\u76ee\u5f55\u89c4\u6a21" : "Current directory scale"}</span>
              <span className="admin-card-note">
                {isZh ? `${linkCount} \u4e2a\u7ad9\u70b9\u4f1a\u5171\u4eab\u8fd9\u4e9b\u524d\u53f0\u6587\u6848\u548c\u4e3b\u9898\u53c2\u6570\u3002` : `${linkCount} links currently share this front-end copy and theme configuration.`}
              </span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
