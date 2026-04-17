"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  bulkAssignCategoryAction,
  bulkDeleteLinksAction,
  bulkFeatureLinksAction,
  bulkRefreshFaviconAction,
  bulkRefreshMetadataAction,
  bulkUnfeatureLinksAction,
  refreshLinkMetadataAction,
  type SaveLinkActionState,
  saveLinkAction
} from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { WebsiteIcon } from "@/components/directory/website-icon";
import { ArrowUpRightIcon } from "@/components/icons";
import type { AdminLocale } from "@/lib/admin-locale";
import { getAdminIntlLocale } from "@/lib/admin-locale";
import type {
  AdminLinkRow,
  AdminLinksQueryState,
  CategoryWithLinks,
  CollectionRecord,
  TagRecord
} from "@/lib/types";
import { ADMIN_FEATURED_CATEGORY_FILTER } from "@/lib/types";
import { getDomain } from "@/lib/utils";

type LinkManagementWorkspaceProps = {
  advancedEnabled: boolean;
  categories: CategoryWithLinks[];
  tags: TagRecord[];
  collections: CollectionRecord[];
  links: AdminLinkRow[];
  locale: AdminLocale;
  totalLinkCount: number;
  filters: AdminLinksQueryState;
};

type EditorState = {
  id: string | null;
  title: string;
  url: string;
  description: string;
  icon: string;
  displayChipPrimary: string;
  displayChipSecondary: string;
  categoryId: string;
  sortOrder: number;
  featured: boolean;
};

type EditorNotice = {
  tone: "success" | "error";
  message: string;
};

const DISPLAY_CHIP_MAX = 14;
const SUCCESS_NOTICE_TIMEOUT_MS = 4000;
const initialSaveState: SaveLinkActionState = {
  status: "idle",
  message: "",
  requestId: null,
  editorSessionKey: null
};

function createEditorSessionKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const emptyEditor = (categoryId = ""): EditorState => ({
  id: null,
  title: "",
  url: "",
  description: "",
  icon: "",
  displayChipPrimary: "",
  displayChipSecondary: "",
  categoryId,
  sortOrder: 0,
  featured: false
});

function createEditorState(link: AdminLinkRow): EditorState {
  return {
    id: link.id,
    title: link.title,
    url: link.url,
    description: link.description,
    icon: link.icon,
    displayChipPrimary: link.displayChipPrimary ?? "",
    displayChipSecondary: link.displayChipSecondary ?? "",
    categoryId: link.categoryId,
    sortOrder: link.sortOrder,
    featured: link.featured
  };
}

function normalizeDisplayChip(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, DISPLAY_CHIP_MAX);
}

function buildPublicChipPreview(editor: EditorState, categoryName: string, locale: AdminLocale) {
  const customChips = [editor.displayChipPrimary, editor.displayChipSecondary]
    .map(normalizeDisplayChip)
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);

  if (customChips.length > 0) {
    return customChips.slice(0, 2);
  }

  return [
    ...(editor.featured ? [locale === "zh" ? "推荐" : "Featured"] : []),
    ...(categoryName ? [categoryName] : [])
  ].slice(0, 2);
}

function isFeaturedChipLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  return label.trim() === "推荐" || normalized === "featured";
}

function getStatusLabel(status: AdminLinkRow["status"], locale: AdminLocale) {
  if (locale === "zh") {
    switch (status) {
      case "healthy":
        return "正常";
      case "warning":
        return "警告";
      case "broken":
        return "失效";
      default:
        return "未知";
    }
  }

  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "broken":
      return "Broken";
    default:
      return "Unknown";
  }
}

function getMetadataStatusLabel(status: NonNullable<AdminLinkRow["metadata"]>["fetchStatus"] | "idle", locale: AdminLocale) {
  if (locale === "zh") {
    switch (status) {
      case "ok":
        return "已就绪";
      case "queued":
        return "排队中";
      case "error":
        return "失败";
      default:
        return "空闲";
    }
  }

  switch (status) {
    case "ok":
      return "Ready";
    case "queued":
      return "Queued";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

export function LinkManagementWorkspace({
  advancedEnabled,
  categories,
  tags,
  collections,
  links,
  locale,
  totalLinkCount,
  filters
}: LinkManagementWorkspaceProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorSessionKey, setEditorSessionKey] = useState("");
  const [editorNotice, setEditorNotice] = useState<EditorNotice | null>(null);
  const [saveState, saveLinkFormAction] = useActionState(saveLinkAction, initialSaveState);
  const handledSaveRequestIdRef = useRef<string | null>(null);
  const isZh = locale === "zh";
  const compactDate = new Intl.DateTimeFormat(getAdminIntlLocale(locale), { month: "short", day: "numeric" });

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => links.some((link) => link.id === id)));
  }, [links]);

  useEffect(() => {
    setBulkCategoryId((current) => {
      if (!current) {
        return current;
      }

      return categories.some((category) => category.id === current) ? current : "";
    });
  }, [categories]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditor(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!saveState.requestId || handledSaveRequestIdRef.current === saveState.requestId) {
      return;
    }

    if (!saveState.editorSessionKey || saveState.editorSessionKey !== editorSessionKey) {
      return;
    }

    handledSaveRequestIdRef.current = saveState.requestId;

    if (saveState.status === "success") {
      setEditor(null);
      setEditorNotice({
        tone: "success",
        message: saveState.message
      });
      router.refresh();
    }
  }, [editorSessionKey, router, saveState]);

  useEffect(() => {
    if (editorNotice?.tone !== "success") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setEditorNotice((current) => (current?.tone === "success" ? null : current));
    }, SUCCESS_NOTICE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [editorNotice]);

  const allVisibleSelected = links.length > 0 && links.every((link) => selectedIds.includes(link.id));
  const selectionPayload = JSON.stringify(selectedIds);
  const filterFormKey = JSON.stringify(filters);
  const selectedCount = selectedIds.length;
  const editorCategoryName = editor ? categories.find((category) => category.id === editor.categoryId)?.name ?? "" : "";
  const editorChipPreview = editor ? buildPublicChipPreview(editor, editorCategoryName, locale) : [];
  const activeEditorSaveState =
    editor && saveState.editorSessionKey === editorSessionKey && saveState.status !== "idle" ? saveState : null;
  const activeFilterCount = [
    filters.q,
    filters.category,
    filters.tag,
    filters.collection,
    filters.featured !== "all" ? filters.featured : "",
    filters.status !== "all" ? filters.status : "",
    filters.metadata !== "all" ? filters.metadata : "",
    filters.sort !== "sortOrder" ? filters.sort : ""
  ].filter(Boolean).length;

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !links.some((link) => link.id === id));
      }

      const next = new Set(current);
      links.forEach((link) => next.add(link.id));
      return [...next];
    });
  };

  const openCreateDrawer = () => {
    setEditorNotice(null);
    setEditorSessionKey(createEditorSessionKey());
    setEditor(emptyEditor(categories[0]?.id ?? ""));
  };

  const openEditDrawer = (link: AdminLinkRow) => {
    setEditorNotice(null);
    setEditorSessionKey(createEditorSessionKey());
    setEditor(createEditorState(link));
  };

  return (
    <>
      <div className="admin-view-stack">
        <section className="admin-page-header">
          <div className="admin-page-copy">
            <p className="section-kicker">{isZh ? "站点" : "Links"}</p>
            <h2 className="admin-page-title">{isZh ? "站点工作台" : "Link workspace"}</h2>
            <p className="admin-page-note">
              {isZh
                ? "这张表已经完全由 URL 参数驱动，所以当前筛选结果可以被分享、回看和审计，不再依赖本地 UI 状态。"
                : "This table now reads from URL filters, so the current slice can be shared, reopened, and audited without replaying local UI state."}
            </p>
          </div>
          <div className="admin-header-meta">
            <span className="admin-data-chip">{links.length} {isZh ? "条当前结果" : "shown"}</span>
            <span className="admin-data-chip">{totalLinkCount} {isZh ? "条总记录" : "total"}</span>
            {activeFilterCount ? <span className="admin-data-chip">{activeFilterCount} {isZh ? "个筛选" : "filters"}</span> : null}
            <button type="button" className="primary-button" onClick={openCreateDrawer}>
              {isZh ? "新增站点" : "New link"}
            </button>
          </div>
        </section>

        {editorNotice ? (
          <div className={`admin-callout admin-action-feedback admin-action-feedback--${editorNotice.tone}`} role="status" aria-live="polite">
            <span className="admin-callout-title">{editorNotice.tone === "success" ? (isZh ? "\u5df2\u66f4\u65b0\u5de5\u4f5c\u53f0" : "Workspace updated") : isZh ? "\u9700\u8981\u5904\u7406" : "Needs attention"}</span>
            <span className="admin-card-note">{editorNotice.message}</span>
          </div>
        ) : null}

        <article className="admin-card">
          <form key={filterFormKey} method="get" action="/admin/links" className="admin-toolbar-stack">
            <div className="admin-toolbar-row admin-toolbar-row--links-primary">
              <label className="field-stack">
                <span className="field-label">{isZh ? "搜索" : "Search"}</span>
                <input name="q" defaultValue={filters.q} className="field-input" placeholder={isZh ? "标题、描述、域名、标签..." : "Title, description, domain, tag..."} />
              </label>

              <label className="field-stack">
                <span className="field-label">{isZh ? "分类" : "Category"}</span>
                <select name="category" defaultValue={filters.category} className="field-input">
                  <option value="">{isZh ? "全部分类" : "All categories"}</option>
                  <option value={ADMIN_FEATURED_CATEGORY_FILTER}>{isZh ? "首页推荐" : "Home featured"}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span className="field-label">{isZh ? "标签" : "Tag"}</span>
                <select name="tag" defaultValue={filters.tag} className="field-input">
                  <option value="">{isZh ? "全部标签" : "All tags"}</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span className="field-label">{isZh ? "集合" : "Collection"}</span>
                <select name="collection" defaultValue={filters.collection} className="field-input">
                  <option value="">{isZh ? "全部集合" : "All collections"}</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-toolbar-row admin-toolbar-row--links-secondary">
              <label className="field-stack">
                <span className="field-label">{isZh ? "推荐位" : "Featured"}</span>
                <select name="featured" defaultValue={filters.featured} className="field-input">
                  <option value="all">{isZh ? "全部站点" : "All links"}</option>
                  <option value="true">{isZh ? "只看推荐" : "Featured only"}</option>
                  <option value="false">{isZh ? "只看普通" : "Regular only"}</option>
                </select>
              </label>

              <label className="field-stack">
                <span className="field-label">{isZh ? "健康状态" : "Health"}</span>
                <select name="status" defaultValue={filters.status} className="field-input">
                  <option value="all">{isZh ? "全部状态" : "All states"}</option>
                  <option value="unknown">{isZh ? "未知" : "Unknown"}</option>
                  <option value="healthy">{isZh ? "正常" : "Healthy"}</option>
                  <option value="warning">{isZh ? "警告" : "Warning"}</option>
                  <option value="broken">{isZh ? "失效" : "Broken"}</option>
                </select>
              </label>

              <label className="field-stack">
                <span className="field-label">{isZh ? "元数据" : "Metadata"}</span>
                <select
                  name="metadata"
                  defaultValue={filters.metadata}
                  className="field-input"
                  disabled={!advancedEnabled}
                  aria-describedby={!advancedEnabled ? "metadata-filter-note" : undefined}
                >
                  <option value="all">{isZh ? "全部状态" : "All states"}</option>
                  <option value="idle">{isZh ? "空闲" : "Idle"}</option>
                  <option value="queued">{isZh ? "排队中" : "Queued"}</option>
                  <option value="ok">{isZh ? "已就绪" : "Ready"}</option>
                  <option value="error">{isZh ? "失败" : "Error"}</option>
                </select>
              </label>

              <label className="field-stack">
                <span className="field-label">{isZh ? "排序" : "Sort"}</span>
                <select name="sort" defaultValue={filters.sort} className="field-input">
                  <option value="sortOrder">{isZh ? "手动顺序" : "Manual order"}</option>
                  <option value="updatedAt">{isZh ? "最近更新" : "Recently updated"}</option>
                  <option value="title">{isZh ? "标题" : "Title"}</option>
                  <option value="category">{isZh ? "分类" : "Category"}</option>
                  <option value="metadata">{isZh ? "元数据新鲜度" : "Metadata freshness"}</option>
                </select>
              </label>

              <div className="admin-toolbar-actions">
                <SubmitButton className="secondary-button" pendingLabel={isZh ? "应用中..." : "Applying..."}>
                  {isZh ? "应用筛选" : "Apply filters"}
                </SubmitButton>
                <Link href="/admin/links" className="section-link">
                  {isZh ? "重置" : "Reset"}
                </Link>
              </div>
            </div>

            {!advancedEnabled ? (
              <p id="metadata-filter-note" className="admin-form-note">
                {isZh ? "元数据筛选仅在 database 模式下可用。" : "Metadata filters are available only in database mode."}
              </p>
            ) : null}
          </form>

          <div className="admin-selection-bar">
            <span className="admin-record-count">{selectedCount ? (isZh ? `已选择 ${selectedCount} 项` : `${selectedCount} selected`) : isZh ? "勾选行后使用批量操作" : "Select rows for bulk actions"}</span>

            <div className="admin-selection-actions">
              <form action={bulkAssignCategoryAction} className="admin-inline-bulk-form">
                <input type="hidden" name="ids" value={selectionPayload} />
                <select
                  name="categoryId"
                  value={bulkCategoryId}
                  onChange={(event) => setBulkCategoryId(event.target.value)}
                  className="field-input admin-bulk-select"
                  disabled={!selectedCount}
                  aria-label={isZh ? "批量移动到目标分类" : "Bulk move target category"}
                >
                  <option value="" disabled>
                    {isZh ? "选择要移动到的分类" : "Choose target category"}
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <SubmitButton className="secondary-button" pendingLabel={isZh ? "应用中..." : "Applying..."} disabled={!selectedCount || !bulkCategoryId}>
                  {isZh ? "移动分类" : "Move category"}
                </SubmitButton>
              </form>

              <form action={bulkFeatureLinksAction}>
                <input type="hidden" name="ids" value={selectionPayload} />
                <SubmitButton className="secondary-button" pendingLabel={isZh ? "应用中..." : "Applying..."} disabled={!selectedCount}>
                  {isZh ? "设为推荐" : "Set featured"}
                </SubmitButton>
              </form>

              <form action={bulkUnfeatureLinksAction}>
                <input type="hidden" name="ids" value={selectionPayload} />
                <SubmitButton className="secondary-button" pendingLabel={isZh ? "应用中..." : "Applying..."} disabled={!selectedCount}>
                  {isZh ? "取消推荐" : "Clear featured"}
                </SubmitButton>
              </form>

              <form action={bulkRefreshFaviconAction}>
                <input type="hidden" name="ids" value={selectionPayload} />
                <SubmitButton className="secondary-button" pendingLabel={isZh ? "刷新中..." : "Refreshing..."} disabled={!selectedCount}>
                  {isZh ? "重抓 favicon" : "Refresh favicon"}
                </SubmitButton>
              </form>

              {advancedEnabled ? (
                <form action={bulkRefreshMetadataAction}>
                  <input type="hidden" name="ids" value={selectionPayload} />
                  <SubmitButton className="secondary-button" pendingLabel={isZh ? "入队中..." : "Queueing..."} disabled={!selectedCount}>
                    {isZh ? "刷新元数据" : "Refresh metadata"}
                  </SubmitButton>
                </form>
              ) : null}

              <form action={bulkDeleteLinksAction}>
                <input type="hidden" name="ids" value={selectionPayload} />
                <SubmitButton className="danger-button" pendingLabel={isZh ? "删除中..." : "Deleting..."} disabled={!selectedCount}>
                  {isZh ? "删除所选" : "Delete selected"}
                </SubmitButton>
              </form>
            </div>
          </div>

          <div className="admin-table-shell">
            <table className="admin-table admin-table--links">
              <colgroup>
                <col className="admin-table-col admin-table-col--check" />
                <col className="admin-table-col admin-table-col--site" />
                <col className="admin-table-col admin-table-col--category" />
                <col className="admin-table-col admin-table-col--labels" />
                <col className="admin-table-col admin-table-col--health" />
                <col className="admin-table-col admin-table-col--metadata" />
                <col className="admin-table-col admin-table-col--updated" />
                <col className="admin-table-col admin-table-col--actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} aria-label={isZh ? "选中全部当前可见站点" : "Select all visible links"} />
                  </th>
                  <th>{isZh ? "站点" : "Site"}</th>
                  <th>{isZh ? "分类" : "Category"}</th>
                  <th>{isZh ? "标签" : "Labels"}</th>
                  <th>{isZh ? "健康" : "Health"}</th>
                  <th>{isZh ? "元数据" : "Metadata"}</th>
                  <th>{isZh ? "更新时间" : "Updated"}</th>
                  <th>{isZh ? "动作" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => {
                  const metadataStatus = link.metadata?.fetchStatus ?? "idle";
                  const labelPills = [
                    ...(link.featured ? [isZh ? "推荐" : "Featured"] : []),
                    ...(link.tags[0] ? [link.tags[0].name] : []),
                    ...(!link.tags[0] && link.collections[0] ? [link.collections[0].name] : [])
                  ];
                  const hiddenLabelCount =
                    link.displayChipPrimary || link.displayChipSecondary
                      ? 0
                      : Number(link.tags.length > 1 ? link.tags.length - 1 : 0) + Number(!link.tags[0] && link.collections.length > 1 ? link.collections.length - 1 : 0);
                  const customLabelPills = [link.displayChipPrimary, link.displayChipSecondary]
                    .map((value) => value?.trim() ?? "")
                    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
                  const effectiveLabelPills = customLabelPills.length > 0 ? customLabelPills : labelPills;

                  return (
                    <tr key={link.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(link.id)}
                          onChange={() => toggleSelection(link.id)}
                          aria-label={isZh ? `选择 ${link.title}` : `Select ${link.title}`}
                        />
                      </td>
                      <td>
                        <div className="admin-table-site">
                          <span className="admin-table-icon">
                            <WebsiteIcon
                              linkId={link.id}
                              url={link.url}
                              icon={link.icon}
                              iconUrl={link.iconUrl}
                              faviconUrl={link.metadata?.faviconUrl ?? link.faviconUrl}
                              preferredSource={link.preferredFaviconSource}
                              title={link.title}
                            />
                          </span>
                          <div className="admin-table-site-copy">
                            <strong>{link.title}</strong>
                            <span>{getDomain(link.url)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="admin-table-cell--nowrap">{link.categoryName}</td>
                      <td>
                        <div className="admin-inline-tags">
                          {effectiveLabelPills.map((label) => (
                            <span key={`${link.id}-${label}`} className={`admin-status-pill ${isFeaturedChipLabel(label) ? "is-featured-chip" : "is-neutral"}`}>
                              {label}
                            </span>
                          ))}
                          {hiddenLabelCount > 0 ? <small className="admin-domain-note">+{hiddenLabelCount} {isZh ? "项" : "more"}</small> : null}
                        </div>
                      </td>
                      <td>
                        <span className={`admin-status-pill is-${link.status}`}>{getStatusLabel(link.status, locale)}</span>
                      </td>
                      <td>
                        <div className="admin-stack-list admin-stack-list--tight">
                          <span
                            className={`admin-status-row is-${
                              metadataStatus === "ok"
                                ? "healthy"
                                : metadataStatus === "error"
                                  ? "broken"
                                  : metadataStatus === "queued"
                                    ? "warning"
                                    : "unknown"
                            }`}
                          >
                            <span
                              className={`admin-status-dot is-${
                                metadataStatus === "ok"
                                  ? "healthy"
                                  : metadataStatus === "error"
                                    ? "broken"
                                    : metadataStatus === "queued"
                                      ? "warning"
                                      : "unknown"
                              }`}
                            />
                            {getMetadataStatusLabel(metadataStatus, locale)}
                          </span>
                          {link.metadata?.lastFetchedAt ? <small className="admin-domain-note">{compactDate.format(new Date(link.metadata.lastFetchedAt))}</small> : null}
                        </div>
                      </td>
                      <td className="admin-table-cell--nowrap">{compactDate.format(new Date(link.updatedAt))}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button type="button" className="secondary-button" onClick={() => openEditDrawer(link)}>
                            {isZh ? "编辑" : "Edit"}
                          </button>
                          {advancedEnabled ? (
                            <form action={refreshLinkMetadataAction}>
                              <input type="hidden" name="id" value={link.id} />
                              <SubmitButton className="secondary-button" pendingLabel={isZh ? "入队中..." : "Queueing..."}>
                                {isZh ? "元数据" : "Metadata"}
                              </SubmitButton>
                            </form>
                          ) : null}
                          <a href={link.url} target="_blank" rel="noreferrer" className="section-link" aria-label={isZh ? `打开 ${link.title}` : `Open ${link.title}`}>
                            <ArrowUpRightIcon className="admin-inline-icon" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!links.length ? <div className="admin-empty">{isZh ? "当前服务端筛选下没有匹配站点。" : "No links match the current server-side filter set."}</div> : null}
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
                  {/*
                  <p className="section-kicker">{editor.id ? (isZh ? "编辑站点" : "Edit link") : isZh ? "创建站点" : "Create link"}</p>
                  <h3 className="admin-card-title">{editor.id ? (isZh ? "更新目录记录" : "Update directory record") : isZh ? "新增目录记录" : "Add directory record"}</h3>
                </div>
                <button type="button" className="secondary-button" onClick={() => setEditor(null)}>
                  {isZh ? "关闭" : "Close"}
                </button>
              </div>

              <div className="admin-preview-card">
                <span className="admin-table-icon">
                  <WebsiteIcon url={editor.url || "https://example.com"} icon={editor.icon} title={editor.title || "Preview"} />
                </span>
                <div className="admin-card-copy">
                  <strong>{editor.title || (isZh ? "站点预览" : "Site preview")}</strong>
                  <span className="admin-record-count">{editor.url ? getDomain(editor.url) : "preview.domain"}</span>
                </div>
              </div>

              <div className="admin-preview-card admin-chip-preview-card">
                <div className="admin-card-copy">
                  {/*
                  <span className="admin-chip-preview-label">{isZh ? "鍓嶅彴 chip 棰勮" : "Public chip preview"}</span>
                  */}
                  <span className="admin-chip-preview-label">{isZh ? "\u524d\u53f0 chip \u9884\u89c8" : "Public chip preview"}</span>
                  <div className="listing-meta admin-chip-preview">
                    {editorChipPreview.map((chip) => (
                      <span key={`preview-${chip}`} className={isFeaturedChipLabel(chip) ? "is-featured-chip" : undefined}>
                        {chip}
                      </span>
                    ))}
                    {editorChipPreview.length === 0 ? (
                      <span className="admin-chip-preview-empty">
                        {/*
                        {isZh ? "鏈～鍐?chip 鏃讹紝灏嗘寜鎺ㄨ崘鐘舵€佸拰鍒嗙被鍥為€€銆? : "Without custom chips, the card falls back to featured + category."}
                        */}
                        {isZh ? "\u672a\u586b\u5199 chip \u65f6\uff0c\u5c06\u6309\u63a8\u8350\u72b6\u6001\u548c\u5206\u7c7b\u56de\u9000\u3002" : "Without custom chips, the card falls back to featured + category."}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <form action={saveLinkFormAction} className="admin-form-grid">
                {editor.id ? <input type="hidden" name="id" value={editor.id} /> : null}
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="editorSessionKey" value={editorSessionKey} />

                <label className="field-stack">
                  <span className="field-label">{isZh ? "标题" : "Title"}</span>
                  <input
                    name="title"
                    className="field-input"
                    value={editor.title}
                    onChange={(event) => setEditor((current) => (current ? { ...current, title: event.target.value } : current))}
                    required
                  />
                </label>

                <label className="field-stack">
                  <span className="field-label">URL</span>
                  <input
                    name="url"
                    className="field-input"
                    value={editor.url}
                    onChange={(event) => setEditor((current) => (current ? { ...current, url: event.target.value } : current))}
                    required
                  />
                </label>

                <label className="field-stack">
                  <span className="field-label">{isZh ? "图标来源" : "Icon source"}</span>
                  <input
                    name="icon"
                    className="field-input"
                    value={editor.icon}
                    onChange={(event) => setEditor((current) => (current ? { ...current, icon: event.target.value } : current))}
                    placeholder={isZh ? "留空自动抓 favicon，或填 logo URL / 内置 slug" : "Leave empty for favicon, or enter a logo URL / builtin slug"}
                  />
                </label>

                <label className="field-stack">
                  <span className="field-label">{isZh ? "分类" : "Category"}</span>
                  <select
                    name="categoryId"
                    className="field-input"
                    value={editor.categoryId}
                    onChange={(event) => setEditor((current) => (current ? { ...current, categoryId: event.target.value } : current))}
                    required
                  >
                    <option value="" disabled>
                      {isZh ? "选择分类" : "Select a category"}
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-stack">
                  <span className="field-label">{isZh ? "\u5c55\u793a chip 1" : "Display chip 1"}</span>
                  <input
                    name="displayChipPrimary"
                    className="field-input"
                    value={editor.displayChipPrimary}
                    maxLength={DISPLAY_CHIP_MAX}
                    onChange={(event) =>
                      setEditor((current) => (current ? { ...current, displayChipPrimary: normalizeDisplayChip(event.target.value) } : current))
                    }
                    placeholder={isZh ? "\u4f8b\u5982\uff1a\u63a8\u8350 / AI \u5de5\u5177" : "For example: Featured / AI tools"}
                  />
                  <span className="admin-chip-field-note">
                    <span>{isZh ? "\u516c\u5171\u5361\u7247\u5c3d\u91cf\u4fdd\u6301\u77ed\u6807\u7b7e" : "Keep public chips short and scannable."}</span>
                    <span className="admin-chip-counter">{editor.displayChipPrimary.length}/{DISPLAY_CHIP_MAX}</span>
                  </span>
                </label>

                <label className="field-stack">
                  <span className="field-label">{isZh ? "\u5c55\u793a chip 2" : "Display chip 2"}</span>
                  <input
                    name="displayChipSecondary"
                    className="field-input"
                    value={editor.displayChipSecondary}
                    maxLength={DISPLAY_CHIP_MAX}
                    onChange={(event) =>
                      setEditor((current) => (current ? { ...current, displayChipSecondary: normalizeDisplayChip(event.target.value) } : current))
                    }
                    placeholder={isZh ? "\u4f8b\u5982\uff1a\u8bbe\u8ba1\u7075\u611f / \u6548\u7387\u534f\u4f5c" : "For example: Design / Productivity"}
                  />
                  <span className="admin-chip-field-note">
                    <span>{isZh ? "\u987a\u5e8f\u5373\u524d\u53f0\u663e\u793a\u987a\u5e8f" : "Order here is the order on the public card."}</span>
                    <span className="admin-chip-counter">{editor.displayChipSecondary.length}/{DISPLAY_CHIP_MAX}</span>
                  </span>
                </label>

                <div className="admin-inline-actions admin-chip-controls admin-form-span">
                  <button
                    type="button"
                    className="secondary-button admin-mini-button"
                    onClick={() =>
                      setEditor((current) =>
                        current
                          ? {
                              ...current,
                              displayChipPrimary: current.displayChipSecondary,
                              displayChipSecondary: current.displayChipPrimary
                            }
                          : current
                      )
                    }
                    disabled={!editor.displayChipPrimary || !editor.displayChipSecondary}
                  >
                    {isZh ? "\u4ea4\u6362\u987a\u5e8f" : "Swap order"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button admin-mini-button"
                    onClick={() => setEditor((current) => (current ? { ...current, displayChipSecondary: "" } : current))}
                    disabled={!editor.displayChipSecondary}
                  >
                    {isZh ? "\u6e05\u7a7a chip 2" : "Clear chip 2"}
                  </button>
                </div>

                <label className="field-stack">
                  <span className="field-label">{isZh ? "排序" : "Sort order"}</span>
                  <input
                    name="sortOrder"
                    type="number"
                    className="field-input"
                    value={editor.sortOrder}
                    onChange={(event) =>
                      setEditor((current) =>
                        current ? { ...current, sortOrder: Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : 0 } : current
                      )
                    }
                  />
                </label>

                <label className="field-stack field-checkbox">
                  <span className="field-label">{isZh ? "首页推荐" : "Featured on home"}</span>
                  <input
                    name="featured"
                    type="checkbox"
                    checked={editor.featured}
                    onChange={(event) => setEditor((current) => (current ? { ...current, featured: event.target.checked } : current))}
                  />
                </label>

                <label className="field-stack admin-form-span">
                  <span className="field-label">{isZh ? "描述" : "Description"}</span>
                  <textarea
                    name="description"
                    rows={4}
                    className="field-input field-textarea"
                    value={editor.description}
                    onChange={(event) => setEditor((current) => (current ? { ...current, description: event.target.value } : current))}
                    required
                  />
                </label>

                <p className="admin-card-note admin-form-span">
                  {isZh
                    ? "\u8fd9\u4e24\u679a chip \u53ea\u5f71\u54cd\u524d\u53f0\u5361\u7247\u663e\u793a\uff0c\u4e0d\u4f1a\u8986\u76d6\u771f\u5b9e Tag / Collection \u7684\u7b5b\u9009\u548c\u641c\u7d22\u903b\u8f91\u3002"
                    : "These chips only affect the public card display. They do not replace the real tag / collection filtering and search logic."}
                </p>

                {activeEditorSaveState?.status === "error" ? <p className="form-error admin-form-span">{activeEditorSaveState.message}</p> : null}

                <div className="admin-inline-actions admin-form-span">
                  <SubmitButton className="primary-button" pendingLabel={isZh ? "保存中..." : "Saving..."}>
                    {editor.id ? (isZh ? "保存站点" : "Save link") : isZh ? "创建站点" : "Create link"}
                  </SubmitButton>
                  <button type="button" className="secondary-button" onClick={() => setEditor(null)}>
                    {isZh ? "取消" : "Cancel"}
                  </button>
                </div>
              </form>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
