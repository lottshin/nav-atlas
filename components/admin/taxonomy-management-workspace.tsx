"use client";

import { useMemo, useState } from "react";

import { removeCollectionAction, removeTagAction, saveCollectionAction, saveTagAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AdminLocale } from "@/lib/admin-locale";
import type { CollectionEditorRecord, PublicDirectoryLink, TagEditorRecord } from "@/lib/types";

type TaxonomyManagementWorkspaceProps =
  | {
      mode: "tag";
      advancedEnabled: boolean;
      items: TagEditorRecord[];
      links: PublicDirectoryLink[];
      locale: AdminLocale;
    }
  | {
      mode: "collection";
      advancedEnabled: boolean;
      items: CollectionEditorRecord[];
      links: PublicDirectoryLink[];
      locale: AdminLocale;
    };

type EditorState = {
  id: string | null;
  name: string;
  description: string;
  sortOrder: number;
  published: boolean;
  linkIds: string[];
};

function createEmptyEditor(mode: "tag" | "collection", nextSortOrder: number): EditorState {
  return {
    id: null,
    name: "",
    description: "",
    sortOrder: nextSortOrder,
    published: mode === "collection",
    linkIds: []
  };
}

export function TaxonomyManagementWorkspace({ mode, advancedEnabled, items, links, locale }: TaxonomyManagementWorkspaceProps) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const isZh = locale === "zh";

  const visibleLinks = useMemo(() => {
    const keyword = linkQuery.trim().toLowerCase();
    if (!keyword) {
      return links;
    }

    return links.filter((link) => `${link.displayTitle} ${link.categoryName} ${link.displayDescription}`.toLowerCase().includes(keyword));
  }, [linkQuery, links]);

  const nextSortOrder = items.length ? Math.max(...items.map((item) => item.sortOrder)) + 1 : 1;
  const itemLabel = mode === "tag" ? (isZh ? "标签" : "tag") : isZh ? "集合" : "collection";
  const saveAction = mode === "tag" ? saveTagAction : saveCollectionAction;
  const removeAction = mode === "tag" ? removeTagAction : removeCollectionAction;

  if (!advancedEnabled) {
    return (
      <article className="admin-card">
        <div className="admin-card-copy">
          <p className="section-kicker">{isZh ? "仅数据库模式" : "Database mode only"}</p>
          <h3 className="admin-card-title">{mode === "tag" ? (isZh ? "file 模式下标签不可用" : "Tags are disabled in file mode") : isZh ? "file 模式下集合不可用" : "Collections are disabled in file mode"}</h3>
          <p className="admin-card-note">
            {isZh ? "切到 `NAV_STORAGE_MODE=database` 后，才能启用策展 taxonomy 和公开浏览透镜。" : "Switch to `NAV_STORAGE_MODE=database` to enable curated taxonomy editing and public lenses."}
          </p>
        </div>
      </article>
    );
  }

  return (
    <>
      <div className="admin-view-stack">
        <section className="admin-page-header">
          <div className="admin-page-copy">
            <p className="section-kicker">{mode === "tag" ? (isZh ? "标签" : "Tags") : isZh ? "集合" : "Collections"}</p>
            <h2 className="admin-page-title">{mode === "tag" ? (isZh ? "主题标签" : "Theme tags") : isZh ? "策展集合" : "Curated collections"}</h2>
            <p className="admin-page-note">
              {mode === "tag"
                ? isZh
                  ? "标签保持轻量，用来串起跨分类路径，比如效率协作、设计灵感或视频创作。"
                  : "Tags stay lightweight and thematic. Use them to create cross-category paths like workflow, inspiration, or video tooling."
                : isZh
                  ? "集合是公开的策展清单，可以在不改变主分类结构的前提下组织专题浏览。"
                  : "Collections are public curated lists. They let the directory surface bundles without changing the main category structure."}
            </p>
          </div>
          <div className="admin-header-meta">
            <span className="admin-data-chip">{items.length} {itemLabel}</span>
            <button type="button" className="primary-button" onClick={() => setEditor(createEmptyEditor(mode, nextSortOrder))}>
              {isZh ? `新建${itemLabel}` : `New ${itemLabel}`}
            </button>
          </div>
        </section>

        <article className="admin-card">
          <div className="admin-stack-list">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="admin-stack-item admin-stack-item--button"
                  onClick={() =>
                    setEditor({
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      sortOrder: item.sortOrder,
                      published: "published" in item ? item.published : false,
                      linkIds: item.linkIds
                    })
                  }
                >
                  <div className="admin-stack-topline">
                    <span className="admin-stack-title">{item.name}</span>
                    <span className="admin-record-count">{item.linkIds.length} {isZh ? "个站点" : "links"}</span>
                  </div>
                  <div className="admin-stack-subline">
                    <span>{item.slug}</span>
                    {"published" in item ? <span>{item.published ? (isZh ? "公开" : "public") : isZh ? "草稿" : "draft"}</span> : <span>{isZh ? "公开透镜" : "live lens"}</span>}
                  </div>
                  {item.description ? <p className="admin-card-note">{item.description}</p> : null}
                </button>
              ))
            ) : (
              <div className="admin-empty">{isZh ? `还没有${itemLabel}。先创建一个，补出新的浏览路径。` : `No ${itemLabel}s yet. Create one to start curating alternate browse paths.`}</div>
            )}
          </div>
        </article>
      </div>

      {editor ? (
        <>
          <button type="button" className="admin-drawer-backdrop" onClick={() => setEditor(null)} aria-label={isZh ? "关闭编辑器" : "Close editor"} />
          <aside className="admin-drawer">
            <div className="admin-card admin-drawer-card">
              <div className="admin-card-header">
                <div className="admin-card-copy">
                  <p className="section-kicker">{editor.id ? (isZh ? `编辑${itemLabel}` : `Edit ${itemLabel}`) : isZh ? `创建${itemLabel}` : `Create ${itemLabel}`}</p>
                  <h3 className="admin-card-title">{editor.name || (isZh ? `未命名${itemLabel}` : `Untitled ${itemLabel}`)}</h3>
                </div>
                <button type="button" className="secondary-button" onClick={() => setEditor(null)}>
                  {isZh ? "关闭" : "Close"}
                </button>
              </div>

              <form action={saveAction} className="admin-form-grid">
                {editor.id ? <input type="hidden" name="id" value={editor.id} /> : null}
                <input type="hidden" name="linkIds" value={JSON.stringify(editor.linkIds)} />

                <label className="field-stack">
                  <span className="field-label">{isZh ? "名称" : "Name"}</span>
                  <input
                    name="name"
                    className="field-input"
                    value={editor.name}
                    onChange={(event) => setEditor((current) => (current ? { ...current, name: event.target.value } : current))}
                    required
                  />
                </label>

                <label className="field-stack">
                  <span className="field-label">{isZh ? "排序" : "Sort order"}</span>
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
                  <span className="field-label">{isZh ? "描述" : "Description"}</span>
                  <textarea
                    name="description"
                    className="field-input"
                    rows={3}
                    value={editor.description}
                    onChange={(event) => setEditor((current) => (current ? { ...current, description: event.target.value } : current))}
                  />
                </label>

                {mode === "collection" ? (
                  <label className="admin-checkbox-line">
                    <input
                      type="checkbox"
                      name="published"
                      checked={editor.published}
                      onChange={(event) => setEditor((current) => (current ? { ...current, published: event.target.checked } : current))}
                    />
                    <span>{isZh ? "公开到前台页面" : "Published on public pages"}</span>
                  </label>
                ) : null}

                <div className="admin-card admin-card--muted admin-form-span">
                  <div className="admin-card-copy">
                    <p className="section-kicker">{isZh ? "关联分配" : "Assignments"}</p>
                    <h4 className="admin-card-title">{isZh ? "选择目录站点" : "Select directory links"}</h4>
                    <p className="admin-card-note">{isZh ? "前台页面会直接复用这里的关联关系。" : "The public page will reuse these assignments directly."}</p>
                  </div>

                  <label className="field-stack">
                    <span className="field-label">{isZh ? "筛选站点" : "Filter links"}</span>
                    <input
                      value={linkQuery}
                      onChange={(event) => setLinkQuery(event.target.value)}
                      className="field-input"
                      placeholder={isZh ? "搜索站点..." : "Search links..."}
                    />
                  </label>

                  <div className="admin-checklist">
                    {visibleLinks.map((link) => {
                      const checked = editor.linkIds.includes(link.id);

                      return (
                        <label key={link.id} className="admin-checklist-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setEditor((current) =>
                                current
                                  ? {
                                      ...current,
                                      linkIds: event.target.checked
                                        ? [...current.linkIds, link.id]
                                        : current.linkIds.filter((item) => item !== link.id)
                                    }
                                  : current
                              )
                            }
                          />
                          <span>
                            <strong>{link.displayTitle}</strong>
                            <small>{link.categoryName}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="admin-inline-actions">
                  <SubmitButton className="primary-button" pendingLabel={isZh ? "保存中..." : `Saving ${itemLabel}...`}>
                    {isZh ? `保存${itemLabel}` : `Save ${itemLabel}`}
                  </SubmitButton>

                  {editor.id ? (
                    <form action={removeAction}>
                      <input type="hidden" name="id" value={editor.id} />
                      <SubmitButton className="danger-button" pendingLabel={isZh ? "删除中..." : `Removing ${itemLabel}...`}>
                        {isZh ? `删除${itemLabel}` : `Delete ${itemLabel}`}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </form>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
