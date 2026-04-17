"use client";

import { useEffect, useMemo, useState } from "react";

import { removeCategoryAction, saveCategoryAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { SiteIcon } from "@/components/icons";
import type { AdminLocale } from "@/lib/admin-locale";
import { CATEGORY_ICON_OPTIONS, resolveCategoryIcon } from "@/lib/category-icons";
import type { CategoryWithLinks } from "@/lib/types";
import { slugify } from "@/lib/utils";

type CategoryManagementWorkspaceProps = {
  categories: CategoryWithLinks[];
  locale: AdminLocale;
};

type CategoryEditorState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
};

const COPY = {
  sectionKicker: { zh: "\u5206\u7c7b", en: "Categories" },
  sectionTitle: { zh: "\u5206\u7c7b\u4e0e\u5bfc\u822a\u56fe\u6807", en: "Categories and rail icons" },
  sectionNote: {
    zh: "\u5de6\u4fa7\u5bfc\u822a\u680f\u4f1a\u4f18\u5148\u8bfb\u53d6\u8fd9\u91cc\u914d\u7f6e\u7684\u56fe\u6807\u3002\u4f60\u53ef\u4ee5\u4fdd\u6301\u5206\u7c7b\u7ed3\u6784\u4e0d\u53d8\uff0c\u53ea\u66ff\u6362\u66f4\u5408\u9002\u7684\u5165\u53e3\u56fe\u5f62\u3002",
    en: "The left rail now reads icon choices from this editor first, so you can tune category symbols without changing the category structure."
  },
  categoryCount: { zh: "\u4e2a\u5206\u7c7b", en: "categories" },
  linkCount: { zh: "\u4e2a\u7ad9\u70b9", en: "links" },
  createButton: { zh: "\u65b0\u589e\u5206\u7c7b", en: "New category" },
  emptyState: {
    zh: "\u8fd8\u6ca1\u6709\u5206\u7c7b\u3002\u5148\u521b\u5efa\u4e00\u4e2a\u5206\u7c7b\uff0c\u518d\u7ed9\u5b83\u914d\u7f6e\u5bfc\u822a\u56fe\u6807\u3002",
    en: "No categories yet. Create one first, then assign a rail icon."
  },
  editKicker: { zh: "\u7f16\u8f91\u5206\u7c7b", en: "Edit category" },
  createKicker: { zh: "\u521b\u5efa\u5206\u7c7b", en: "Create category" },
  untitled: { zh: "\u672a\u547d\u540d\u5206\u7c7b", en: "Untitled category" },
  close: { zh: "\u5173\u95ed", en: "Close" },
  closeAria: { zh: "\u5173\u95ed\u5206\u7c7b\u7f16\u8f91\u5668", en: "Close category editor" },
  name: { zh: "\u540d\u79f0", en: "Name" },
  slug: { zh: "\u94fe\u8def\u540d", en: "Slug" },
  slugHint: {
    zh: "\u663e\u793a\u540d\u79f0\u548c\u94fe\u8def\u540d\u5206\u5f00\u8bbe\u7f6e\u3002\u7559\u7a7a\u65f6\u4f1a\u6839\u636e\u540d\u79f0\u81ea\u52a8\u751f\u6210\u3002",
    en: "Display name and route slug are independent. Leave blank to generate from the name."
  },
  sortOrder: { zh: "\u6392\u5e8f", en: "Sort order" },
  description: { zh: "\u63cf\u8ff0", en: "Description" },
  icon: { zh: "\u5bfc\u822a\u56fe\u6807", en: "Rail icon" },
  previewKicker: { zh: "\u5de6\u4fa7\u5bfc\u822a\u9884\u89c8", en: "Left rail preview" },
  previewTitle: { zh: "\u56fe\u6807\u4e0e\u6807\u9898\u4f1a\u8fd9\u6837\u663e\u793a", en: "This is how the rail item will read" },
  previewNote: {
    zh: "\u540d\u79f0\u53ea\u5f71\u54cd\u663e\u793a\uff0c\u94fe\u8def\u540d\u5355\u72ec\u4fdd\u5b58\u3002\u7559\u7a7a\u65f6\u624d\u4f1a\u6839\u636e\u540d\u79f0\u81ea\u52a8\u751f\u6210\uff1b\u56fe\u6807\u4f1a\u76f4\u63a5\u8ddf\u968f\u8fd9\u91cc\u7684\u9009\u62e9\u3002",
    en: "The name only affects display. The slug is stored independently and only auto-generates when left blank."
  },
  previewNameFallback: { zh: "\u5206\u7c7b\u6807\u9898", en: "Category title" },
  previewSlugFallback: { zh: "\u81ea\u52a8\u751f\u6210", en: "Auto-generated" },
  previewCollapsed: { zh: "\u9ed8\u8ba4\u6536\u8d77", en: "Default collapsed" },
  previewExpanded: { zh: "\u5c55\u5f00\u540e", en: "Expanded rail" },
  previewCount: { zh: "\u9879", en: "items" },
  save: { zh: "\u4fdd\u5b58\u5206\u7c7b", en: "Save category" },
  saving: { zh: "\u4fdd\u5b58\u4e2d...", en: "Saving category..." },
  cancel: { zh: "\u53d6\u6d88", en: "Cancel" },
  remove: { zh: "\u5220\u9664\u5206\u7c7b", en: "Delete category" },
  removing: { zh: "\u5220\u9664\u4e2d...", en: "Deleting category..." }
} as const;

const ICON_LABELS: Record<string, { zh: string; en: string }> = {
  search: { zh: "\u641c\u7d22", en: "Search" },
  spark: { zh: "\u706b\u82b1", en: "Spark" },
  palette: { zh: "\u8c03\u8272\u76d8", en: "Palette" },
  film: { zh: "\u5f71\u7247", en: "Film" },
  terminal: { zh: "\u7ec8\u7aef", en: "Terminal" },
  check: { zh: "\u52fe\u9009", en: "Check" },
  grid: { zh: "\u7f51\u683c", en: "Grid" },
  layers: { zh: "\u5c42\u7ea7", en: "Layers" },
  ticket: { zh: "\u7968\u5238", en: "Ticket" },
  clapper: { zh: "\u573a\u8bb0\u677f", en: "Clapper" },
  code: { zh: "\u4ee3\u7801", en: "Code" },
  book: { zh: "\u4e66\u9875", en: "Book" },
  rocket: { zh: "\u706b\u7bad", en: "Rocket" },
  note: { zh: "\u4fbf\u7b7e", en: "Note" },
  compass: { zh: "\u7f57\u76d8", en: "Compass" }
};

function getCopy(locale: AdminLocale, key: keyof typeof COPY) {
  return COPY[key][locale];
}

function createEmptyEditor(nextSortOrder: number): CategoryEditorState {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    icon: "grid",
    sortOrder: nextSortOrder
  };
}

function createEditorState(category: CategoryWithLinks): CategoryEditorState {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: resolveCategoryIcon(category.icon, category.slug),
    sortOrder: category.sortOrder
  };
}

export function CategoryManagementWorkspace({ categories, locale }: CategoryManagementWorkspaceProps) {
  const [editor, setEditor] = useState<CategoryEditorState | null>(null);
  const totalLinkCount = useMemo(() => categories.reduce((sum, category) => sum + category.links.length, 0), [categories]);
  const nextSortOrder = categories.length ? Math.max(...categories.map((category) => category.sortOrder)) + 1 : 1;
  const previewSlug = editor ? slugify(editor.slug || editor.name) : "";
  const previewIcon = resolveCategoryIcon(editor?.icon, previewSlug || undefined);
  const previewName = editor?.name || getCopy(locale, "previewNameFallback");
  const previewCount = editor?.id ? categories.find((category) => category.id === editor.id)?.links.length ?? 0 : 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditor(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="admin-view-stack">
        <section className="admin-page-header">
          <div className="admin-page-copy">
            <p className="section-kicker">{getCopy(locale, "sectionKicker")}</p>
            <h2 className="admin-page-title">{getCopy(locale, "sectionTitle")}</h2>
            <p className="admin-page-note">{getCopy(locale, "sectionNote")}</p>
          </div>
          <div className="admin-header-meta">
            <span className="admin-data-chip">
              {categories.length} {getCopy(locale, "categoryCount")}
            </span>
            <span className="admin-data-chip">
              {totalLinkCount} {getCopy(locale, "linkCount")}
            </span>
            <button type="button" className="primary-button" onClick={() => setEditor(createEmptyEditor(nextSortOrder))}>
              {getCopy(locale, "createButton")}
            </button>
          </div>
        </section>

        <article className="admin-card">
          <div className="admin-stack-list">
            {categories.length ? (
              categories.map((category) => {
                const iconName = resolveCategoryIcon(category.icon, category.slug);
                const iconLabel = ICON_LABELS[iconName]?.[locale] ?? iconName;

                return (
                  <button
                    key={category.id}
                    type="button"
                    className="admin-stack-item admin-stack-item--button"
                    onClick={() => setEditor(createEditorState(category))}
                  >
                    <div className="admin-stack-topline">
                      <div className="admin-stack-titleline">
                        <span className="admin-listing-icon" aria-hidden="true">
                          <SiteIcon name={iconName} width={18} height={18} />
                        </span>
                        <span className="admin-stack-title">{category.name}</span>
                      </div>
                      <span className="admin-record-count">
                        {category.links.length} {getCopy(locale, "linkCount")}
                      </span>
                    </div>
                    <div className="admin-stack-subline">
                      <span>{category.slug}</span>
                      <span>{iconLabel}</span>
                    </div>
                    {category.description ? <p className="admin-card-note">{category.description}</p> : null}
                  </button>
                );
              })
            ) : (
              <div className="admin-empty">{getCopy(locale, "emptyState")}</div>
            )}
          </div>
        </article>
      </div>

      {editor ? (
        <>
          <button
            type="button"
            className="admin-drawer-backdrop"
            onClick={() => setEditor(null)}
            aria-label={getCopy(locale, "closeAria")}
          />
          <aside className="admin-drawer">
            <div className="admin-card admin-drawer-card">
              <div className="admin-card-header">
                <div className="admin-card-copy">
                  <p className="section-kicker">{editor.id ? getCopy(locale, "editKicker") : getCopy(locale, "createKicker")}</p>
                  <h3 className="admin-card-title">{editor.name || getCopy(locale, "untitled")}</h3>
                </div>
                <button type="button" className="secondary-button" onClick={() => setEditor(null)}>
                  {getCopy(locale, "close")}
                </button>
              </div>

              <form
                action={saveCategoryAction}
                className="admin-form-grid"
                onSubmit={() => {
                  setEditor(null);
                }}
              >
                {editor.id ? <input type="hidden" name="id" value={editor.id} /> : null}

                <label className="field-stack">
                  <span className="field-label">{getCopy(locale, "name")}</span>
                  <input
                    name="name"
                    className="field-input"
                    value={editor.name}
                    onChange={(event) => setEditor((current) => (current ? { ...current, name: event.target.value } : current))}
                    required
                  />
                </label>

                <label className="field-stack">
                  <span className="field-label">{getCopy(locale, "slug")}</span>
                  <input
                    name="slug"
                    className="field-input"
                    value={editor.slug}
                    onChange={(event) => setEditor((current) => (current ? { ...current, slug: event.target.value } : current))}
                    placeholder={getCopy(locale, "previewSlugFallback")}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </label>

                <p className="admin-form-note admin-form-span">{getCopy(locale, "slugHint")}</p>

                <label className="field-stack">
                  <span className="field-label">{getCopy(locale, "sortOrder")}</span>
                  <input
                    name="sortOrder"
                    type="number"
                    className="field-input"
                    value={editor.sortOrder}
                    onChange={(event) =>
                      setEditor((current) => (current ? { ...current, sortOrder: Number(event.target.value) || 0 } : current))
                    }
                  />
                </label>

                <label className="field-stack admin-form-span">
                  <span className="field-label">{getCopy(locale, "description")}</span>
                  <textarea
                    name="description"
                    className="field-input field-textarea"
                    rows={3}
                    value={editor.description}
                    onChange={(event) => setEditor((current) => (current ? { ...current, description: event.target.value } : current))}
                    required
                  />
                </label>

                <label className="field-stack admin-form-span">
                  <span className="field-label">{getCopy(locale, "icon")}</span>
                  <div className="admin-icon-select">
                    <span className="admin-icon-select-preview" aria-hidden="true">
                      <SiteIcon name={previewIcon} width={18} height={18} />
                    </span>
                    <select
                      name="icon"
                      className="field-input"
                      value={editor.icon}
                      onChange={(event) => setEditor((current) => (current ? { ...current, icon: event.target.value } : current))}
                    >
                      {CATEGORY_ICON_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {ICON_LABELS[option]?.[locale] ?? option}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <div className="admin-card admin-card--muted admin-form-span">
                  <div className="admin-card-copy">
                    <p className="section-kicker">{getCopy(locale, "previewKicker")}</p>
                    <h4 className="admin-card-title">{getCopy(locale, "previewTitle")}</h4>
                    <p className="admin-card-note">{getCopy(locale, "previewNote")}</p>
                  </div>
                  <div className="admin-rail-preview">
                    <div className="admin-rail-preview-row">
                      <span className="admin-rail-preview-state">{getCopy(locale, "previewCollapsed")}</span>
                      <div className="admin-rail-preview-item is-collapsed" aria-hidden="true">
                        <SiteIcon name={previewIcon} width={18} height={18} />
                      </div>
                    </div>
                    <div className="admin-rail-preview-row">
                      <span className="admin-rail-preview-state">{getCopy(locale, "previewExpanded")}</span>
                      <div className="admin-rail-preview-item" aria-hidden="true">
                        <SiteIcon name={previewIcon} width={18} height={18} className="side-nav-icon" />
                        <span className="admin-rail-preview-label">{previewName}</span>
                        <small className="admin-rail-preview-count">{previewCount}</small>
                      </div>
                    </div>
                    <div className="admin-rail-preview-row admin-rail-preview-row--slug">
                      <span className="admin-rail-preview-state">{getCopy(locale, "slug")}</span>
                      <code className="admin-route-preview">/category/{previewSlug || getCopy(locale, "previewSlugFallback")}</code>
                    </div>
                  </div>
                </div>

                <div className="admin-inline-actions">
                  <SubmitButton className="primary-button" pendingLabel={getCopy(locale, "saving")}>
                    {getCopy(locale, "save")}
                  </SubmitButton>
                  <button type="button" className="secondary-button" onClick={() => setEditor(null)}>
                    {getCopy(locale, "cancel")}
                  </button>
                </div>
              </form>

              {editor.id ? (
                <form
                  action={removeCategoryAction}
                  className="admin-inline-actions"
                  onSubmit={() => {
                    setEditor(null);
                  }}
                >
                  <input type="hidden" name="id" value={editor.id} />
                  <SubmitButton className="danger-button" pendingLabel={getCopy(locale, "removing")}>
                    {getCopy(locale, "remove")}
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
