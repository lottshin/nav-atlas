"use client";

import { useState } from "react";

import { removeSavedViewAction, saveSavedViewAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AdminLocale } from "@/lib/admin-locale";
import type { CategoryWithLinks, CollectionRecord, SavedViewRecord, TagRecord } from "@/lib/types";

type SavedViewWorkspaceProps = {
  advancedEnabled: boolean;
  savedViews: SavedViewRecord[];
  categories: CategoryWithLinks[];
  tags: TagRecord[];
  collections: CollectionRecord[];
  locale: AdminLocale;
};

type EditorState = {
  id: string | null;
  name: string;
  description: string;
  published: boolean;
  sortOrder: number;
  q: string;
  category: string;
  tag: string;
  collection: string;
  featured: string;
  status: string;
  sort: string;
};

function createEmptyEditor(nextSortOrder: number): EditorState {
  return {
    id: null,
    name: "",
    description: "",
    published: true,
    sortOrder: nextSortOrder,
    q: "",
    category: "",
    tag: "",
    collection: "",
    featured: "all",
    status: "all",
    sort: "relevance"
  };
}

export function SavedViewWorkspace({ advancedEnabled, savedViews, categories, tags, collections, locale }: SavedViewWorkspaceProps) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const nextSortOrder = savedViews.length ? Math.max(...savedViews.map((item) => item.sortOrder)) + 1 : 1;
  const isZh = locale === "zh";

  if (!advancedEnabled) {
    return (
      <article className="admin-card">
        <div className="admin-card-copy">
          <p className="section-kicker">{isZh ? "仅数据库模式" : "Database mode only"}</p>
          <h3 className="admin-card-title">{isZh ? "file 模式下保存视图不可用" : "Saved views are disabled in file mode"}</h3>
          <p className="admin-card-note">{isZh ? "保存视图依赖 database 模式下的 taxonomy 和查询层。" : "Saved search views depend on the database-backed taxonomy and query layer."}</p>
        </div>
      </article>
    );
  }

  return (
    <>
      <div className="admin-view-stack">
        <section className="admin-page-header">
          <div className="admin-page-copy">
            <p className="section-kicker">{isZh ? "视图" : "Views"}</p>
            <h2 className="admin-page-title">{isZh ? "保存浏览视图" : "Saved browse views"}</h2>
            <p className="admin-page-note">{isZh ? "用保存视图来发布具名的公开筛选切片，比如“推荐 AI”或“健康设计工具”。" : "Use saved views for named public slices like `featured AI` or `healthy design tools`."}</p>
          </div>
          <div className="admin-header-meta">
            <span className="admin-data-chip">{savedViews.length} {isZh ? "个视图" : "views"}</span>
            <button type="button" className="primary-button" onClick={() => setEditor(createEmptyEditor(nextSortOrder))}>
              {isZh ? "新建视图" : "New view"}
            </button>
          </div>
        </section>

        <article className="admin-card">
          <div className="admin-stack-list">
            {savedViews.length ? (
              savedViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className="admin-stack-item admin-stack-item--button"
                  onClick={() =>
                    setEditor({
                      id: view.id,
                      name: view.name,
                      description: view.description,
                      published: view.published,
                      sortOrder: view.sortOrder,
                      q: view.queryState.q,
                      category: view.queryState.category,
                      tag: view.queryState.tag,
                      collection: view.queryState.collection,
                      featured: view.queryState.featured,
                      status: view.queryState.status,
                      sort: view.queryState.sort
                    })
                  }
                >
                  <div className="admin-stack-topline">
                    <span className="admin-stack-title">{view.name}</span>
                    <span className="admin-record-count">{view.published ? (isZh ? "公开" : "public") : isZh ? "草稿" : "draft"}</span>
                  </div>
                  <div className="admin-stack-subline">
                    <span>{view.slug}</span>
                    <span>{view.queryState.sort}</span>
                  </div>
                  {view.description ? <p className="admin-card-note">{view.description}</p> : null}
                </button>
              ))
            ) : (
              <div className="admin-empty">{isZh ? "还没有保存视图。创建一个可复用的公开筛选切片。" : "No saved views yet. Create one to publish a reusable filtered directory slice."}</div>
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
                  <p className="section-kicker">{editor.id ? (isZh ? "编辑视图" : "Edit view") : isZh ? "创建视图" : "Create view"}</p>
                  <h3 className="admin-card-title">{editor.name || (isZh ? "未命名视图" : "Untitled view")}</h3>
                </div>
                <button type="button" className="secondary-button" onClick={() => setEditor(null)}>
                  {isZh ? "关闭" : "Close"}
                </button>
              </div>

              <form action={saveSavedViewAction} className="admin-form-grid">
                {editor.id ? <input type="hidden" name="id" value={editor.id} /> : null}

                <label className="field-stack">
                  <span className="field-label">{isZh ? "名称" : "Name"}</span>
                  <input name="name" className="field-input" value={editor.name} onChange={(event) => setEditor((current) => (current ? { ...current, name: event.target.value } : current))} required />
                </label>

                <label className="field-stack">
                  <span className="field-label">{isZh ? "排序" : "Sort order"}</span>
                  <input
                    name="sortOrder"
                    type="number"
                    className="field-input"
                    value={editor.sortOrder}
                    onChange={(event) => setEditor((current) => (current ? { ...current, sortOrder: Number(event.target.value) || 0 } : current))}
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

                <label className="admin-checkbox-line admin-form-span">
                  <input type="checkbox" name="published" checked={editor.published} onChange={(event) => setEditor((current) => (current ? { ...current, published: event.target.checked } : current))} />
                  <span>{isZh ? "公开到前台页面" : "Published on public pages"}</span>
                </label>

                <div className="admin-card admin-card--muted admin-form-span">
                  <div className="admin-card-copy">
                    <p className="section-kicker">{isZh ? "查询状态" : "Query state"}</p>
                    <h4 className="admin-card-title">{isZh ? "保存的筛选逻辑" : "Saved filter logic"}</h4>
                  </div>

                  <div className="admin-toolbar-grid">
                    <label className="field-stack">
                      <span className="field-label">{isZh ? "关键词" : "Keyword"}</span>
                      <input name="q" className="field-input" value={editor.q} onChange={(event) => setEditor((current) => (current ? { ...current, q: event.target.value } : current))} />
                    </label>

                    <label className="field-stack">
                      <span className="field-label">{isZh ? "分类" : "Category"}</span>
                      <select name="category" className="field-input" value={editor.category} onChange={(event) => setEditor((current) => (current ? { ...current, category: event.target.value } : current))}>
                        <option value="">{isZh ? "全部分类" : "All categories"}</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.slug}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-stack">
                      <span className="field-label">{isZh ? "标签" : "Tag"}</span>
                      <select name="tag" className="field-input" value={editor.tag} onChange={(event) => setEditor((current) => (current ? { ...current, tag: event.target.value } : current))}>
                        <option value="">{isZh ? "全部标签" : "All tags"}</option>
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.slug}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-stack">
                      <span className="field-label">{isZh ? "集合" : "Collection"}</span>
                      <select
                        name="collection"
                        className="field-input"
                        value={editor.collection}
                        onChange={(event) => setEditor((current) => (current ? { ...current, collection: event.target.value } : current))}
                      >
                        <option value="">{isZh ? "全部集合" : "All collections"}</option>
                        {collections.filter((collection) => collection.published).map((collection) => (
                          <option key={collection.id} value={collection.slug}>
                            {collection.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-stack">
                      <span className="field-label">{isZh ? "推荐位" : "Featured"}</span>
                      <select name="featured" className="field-input" value={editor.featured} onChange={(event) => setEditor((current) => (current ? { ...current, featured: event.target.value } : current))}>
                        <option value="all">{isZh ? "全部" : "All"}</option>
                        <option value="true">{isZh ? "只看推荐" : "Featured only"}</option>
                        <option value="false">{isZh ? "排除推荐" : "Non-featured only"}</option>
                      </select>
                    </label>

                    <label className="field-stack">
                      <span className="field-label">{isZh ? "健康状态" : "Health"}</span>
                      <select name="status" className="field-input" value={editor.status} onChange={(event) => setEditor((current) => (current ? { ...current, status: event.target.value } : current))}>
                        <option value="all">{isZh ? "全部" : "All"}</option>
                        <option value="healthy">{isZh ? "正常" : "Healthy"}</option>
                        <option value="warning">{isZh ? "警告" : "Warning"}</option>
                        <option value="broken">{isZh ? "失效" : "Broken"}</option>
                        <option value="unknown">{isZh ? "未知" : "Unknown"}</option>
                      </select>
                    </label>

                    <label className="field-stack">
                      <span className="field-label">{isZh ? "排序方式" : "Sort"}</span>
                      <select name="sort" className="field-input" value={editor.sort} onChange={(event) => setEditor((current) => (current ? { ...current, sort: event.target.value } : current))}>
                        <option value="relevance">{isZh ? "相关度" : "Relevance"}</option>
                        <option value="featured">{isZh ? "推荐优先" : "Featured"}</option>
                        <option value="recent">{isZh ? "最近更新" : "Recent"}</option>
                        <option value="title">{isZh ? "标题" : "Title"}</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="admin-inline-actions">
                  <SubmitButton className="primary-button" pendingLabel={isZh ? "保存中..." : "Saving view..."}>
                    {isZh ? "保存视图" : "Save view"}
                  </SubmitButton>

                  {editor.id ? (
                    <form action={removeSavedViewAction}>
                      <input type="hidden" name="id" value={editor.id} />
                      <SubmitButton className="danger-button" pendingLabel={isZh ? "删除中..." : "Removing view..."}>
                        {isZh ? "删除视图" : "Delete view"}
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
