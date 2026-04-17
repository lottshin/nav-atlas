"use client";

import Link from "next/link";

import { refreshLinkMetadataAction, retryFailedMetadataAction, retryMetadataFailuresAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { WebsiteIcon } from "@/components/directory/website-icon";
import type { AdminLocale } from "@/lib/admin-locale";
import { getAdminIntlLocale } from "@/lib/admin-locale";
import type { AdminMetadataQueryState, AdminMetadataRow } from "@/lib/types";
import { getDomain } from "@/lib/utils";

type MetadataManagementWorkspaceProps = {
  advancedEnabled: boolean;
  filters: AdminMetadataQueryState;
  locale: AdminLocale;
  queuedCount: number | null;
  retriedCount: number | null;
  rows: AdminMetadataRow[];
  summary: {
    queued: number;
    ok: number;
    error: number;
    idle: number;
  };
};

function getMetadataStatusLabel(status: AdminMetadataRow["fetchStatus"], locale: AdminLocale) {
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

export function MetadataManagementWorkspace({
  advancedEnabled,
  filters,
  locale,
  queuedCount,
  retriedCount,
  rows,
  summary
}: MetadataManagementWorkspaceProps) {
  const filterFormKey = JSON.stringify(filters);
  const isZh = locale === "zh";
  const dateFormatter = new Intl.DateTimeFormat(getAdminIntlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <div className="admin-view-stack">
      <section className="admin-page-header">
        <div className="admin-page-copy">
          <p className="section-kicker">{isZh ? "元数据" : "Metadata"}</p>
          <h2 className="admin-page-title">{isZh ? "元数据运维" : "Metadata operations"}</h2>
          <p className="admin-page-note">
            {isZh
              ? "集中查看解析出的标题、描述、canonical 与 favicon 抓取结果，并对失败站点重新抓取真实 metadata。"
              : "Review resolved titles, descriptions, canonicals, and favicon fetch results, then retry failed sites when needed."}
          </p>
        </div>
        <div className="admin-header-meta">
          <span className="admin-data-chip">{summary.ok} {isZh ? "就绪" : "ready"}</span>
          <span className="admin-data-chip">{summary.queued} {isZh ? "排队中" : "queued"}</span>
          <span className="admin-data-chip">{summary.error} {isZh ? "失败" : "failed"}</span>
          <span className="admin-data-chip">{summary.idle} {isZh ? "空闲" : "idle"}</span>
        </div>
      </section>

      <article className="admin-card">
        <div className="admin-toolbar-stack">
          <form key={filterFormKey} method="get" action="/admin/metadata" className="admin-toolbar-row admin-toolbar-row--metadata">
            <label className="field-stack">
              <span className="field-label">{isZh ? "搜索" : "Search"}</span>
              <input
                name="q"
                defaultValue={filters.q}
                className="field-input"
                placeholder={isZh ? "标题、URL、解析标题、canonical..." : "Title, URL, resolved title, canonical..."}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">{isZh ? "抓取状态" : "Fetch state"}</span>
              <select name="status" defaultValue={filters.status} className="field-input">
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
                <option value="recent">{isZh ? "最近抓取" : "Recently fetched"}</option>
                <option value="oldest">{isZh ? "最早优先" : "Oldest first"}</option>
                <option value="title">{isZh ? "标题" : "Title"}</option>
                <option value="status">{isZh ? "状态" : "Status"}</option>
              </select>
            </label>

            <div className="admin-toolbar-actions">
              <SubmitButton className="secondary-button" pendingLabel={isZh ? "应用中..." : "Applying..."}>
                {isZh ? "应用筛选" : "Apply filters"}
              </SubmitButton>
              <Link href="/admin/metadata" className="section-link">
                {isZh ? "重置" : "Reset"}
              </Link>
            </div>
          </form>

          <div className="admin-inline-actions">
            {advancedEnabled ? (
              <form action={retryMetadataFailuresAction}>
                <SubmitButton className="secondary-button" pendingLabel={isZh ? "入队中..." : "Queueing..."}>
                  {isZh ? "重试失败批次" : "Retry failed batch"}
                </SubmitButton>
              </form>
            ) : null}

            <form action={retryFailedMetadataAction}>
              <SubmitButton className="secondary-button" pendingLabel={isZh ? "重抓中..." : "Refreshing..."}>
                {isZh ? "重抓失败站点" : "Retry failed sites"}
              </SubmitButton>
            </form>
          </div>

          {queuedCount !== null ? (
            <p className="admin-card-note">
              {isZh ? `已为 ${queuedCount} 个失败项加入元数据刷新队列。` : `Queued metadata refresh for ${queuedCount} failed item(s).`}
            </p>
          ) : null}

          {retriedCount !== null ? (
            <p className="admin-card-note">
              {isZh ? `已立即重抓 ${retriedCount} 个失败站点的真实 metadata。` : `Retried real metadata fetch for ${retriedCount} failed site(s).`}
            </p>
          ) : null}

          {!advancedEnabled ? (
            <p className="admin-card-note">
              {isZh
                ? "当前是 file 模式：这里不会走数据库队列，但仍然可以直接重抓失败站点的真实 metadata 与 favicon。"
                : "File mode skips the database queue, but you can still directly retry failed sites to resolve real metadata and favicons."}
            </p>
          ) : null}
        </div>
      </article>

      <article className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "元数据账本" : "Metadata ledger"}</p>
            <h3 className="admin-card-title">{isZh ? "解析内容快照" : "Resolved content snapshot"}</h3>
          </div>
          <span className="admin-record-count">{rows.length} {isZh ? "条记录" : "records"}</span>
        </div>

        <div className="admin-stack-list">
          {rows.map((row) => (
            <article key={row.linkId} className="admin-stack-item admin-ledger-item">
              <div className="admin-stack-topline">
                <div className="admin-table-site">
                  <span className="admin-table-icon">
                    <WebsiteIcon linkId={row.linkId} url={row.url} icon="" faviconUrl={row.faviconUrl} preferredSource={row.preferredFaviconSource} title={row.title} />
                  </span>
                  <div className="admin-table-site-copy">
                    <strong>{row.title}</strong>
                    <span>{getDomain(row.url)}</span>
                    <small className="admin-domain-note">{row.categoryName}</small>
                  </div>
                </div>

                <div className="admin-stack-list admin-stack-list--tight">
                  <span
                    className={`admin-status-pill is-${
                      row.fetchStatus === "ok" ? "healthy" : row.fetchStatus === "error" ? "broken" : row.fetchStatus === "queued" ? "warning" : "neutral"
                    }`}
                  >
                    {getMetadataStatusLabel(row.fetchStatus, locale)}
                  </span>
                  <small className="admin-domain-note">
                    {row.lastFetchedAt ? dateFormatter.format(new Date(row.lastFetchedAt)) : isZh ? "尚未抓取" : "Never fetched"}
                  </small>
                </div>
              </div>

              <div className="admin-ledger-grid">
                <div className="admin-stack-list admin-stack-list--tight">
                  <small className="admin-domain-note">{isZh ? "解析标题" : "Resolved title"}</small>
                  <strong>{row.resolvedTitle || (isZh ? "暂无解析标题" : "No resolved title")}</strong>
                  <small className="admin-domain-note">{row.resolvedDescription || (isZh ? "还没有解析描述。" : "No resolved description yet.")}</small>
                </div>

                <div className="admin-stack-list admin-stack-list--tight">
                  <small className="admin-domain-note">Canonical</small>
                  <span className="admin-domain-note">{row.canonicalUrl || (isZh ? "没有 canonical URL" : "No canonical URL")}</span>
                  <small className="admin-domain-note">{isZh ? "最近错误" : "Last error"}</small>
                  <span className="admin-domain-note">{row.lastError || (isZh ? "无" : "None")}</span>
                </div>
              </div>

              <div className="admin-row-actions">
                <form action={refreshLinkMetadataAction}>
                  <input type="hidden" name="id" value={row.linkId} />
                  <SubmitButton className="secondary-button" pendingLabel={advancedEnabled ? (isZh ? "入队中..." : "Queueing...") : isZh ? "重抓中..." : "Refreshing..."}>
                    {isZh ? "刷新" : "Refresh"}
                  </SubmitButton>
                </form>
                <a href={row.url} target="_blank" rel="noreferrer" className="section-link">
                  {isZh ? "访问" : "Visit"}
                </a>
              </div>
            </article>
          ))}

          {!rows.length ? <div className="admin-empty">{isZh ? "当前筛选下没有匹配的元数据记录。" : "No metadata rows match the current filter set."}</div> : null}
        </div>
      </article>
    </div>
  );
}
