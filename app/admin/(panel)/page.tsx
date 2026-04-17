import Link from "next/link";

import { getAdminIntlLocale } from "@/lib/admin-locale";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminOverviewPageData } from "@/lib/queries";
import { getDomain } from "@/lib/utils";

function formatDateLabel(value: string, locale: "zh" | "en") {
  return new Intl.DateTimeFormat(getAdminIntlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default async function AdminOverviewPage() {
  const locale = await getAdminLocale();
  const isZh = locale === "zh";
  const { categories, featuredLinks, recentImportBatches, recentLinks, stats, taskSummary } = await getAdminOverviewPageData();

  return (
    <div className="admin-view-stack">
      <section className="admin-page-header">
        <div className="admin-page-copy">
          <p className="section-kicker">{isZh ? "总览" : "Overview"}</p>
          <h2 className="admin-page-title">{isZh ? "目录总览" : "Directory overview"}</h2>
          <p className="admin-page-note">
            {isZh
              ? "把分类骨架、推荐位、导入记录和异步任务拆开看，先确认系统状态，再继续编辑。"
              : "Split the directory into structure, featured picks, intake history, and async background work so you can see the system state before making edits."}
          </p>
        </div>
        <div className="admin-header-meta">
          <span className="admin-data-chip">{stats.categoryCount} {isZh ? "个分类" : "categories"}</span>
          <span className="admin-data-chip">{stats.linkCount} {isZh ? "个站点" : "links"}</span>
          <span className="admin-data-chip">{stats.brokenCount} {isZh ? "个失效" : "broken"}</span>
        </div>
      </section>

      <section className="admin-stat-grid">
        <article className="admin-stat-card">
          <span className="admin-stat-label">{isZh ? "分类" : "Categories"}</span>
          <strong className="admin-stat-value">{stats.categoryCount}</strong>
          <p className="admin-stat-note">{isZh ? "决定公开导航入口的浏览骨架。" : "The browse skeleton that shapes the public navigation flow."}</p>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{isZh ? "站点" : "Links"}</span>
          <strong className="admin-stat-value">{stats.linkCount}</strong>
          <p className="admin-stat-note">{isZh ? "目录里当前可被检索和浏览的全部记录。" : "All records currently available across the directory."}</p>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{isZh ? "推荐位" : "Featured"}</span>
          <strong className="admin-stat-value">{stats.featuredCount}</strong>
          <p className="admin-stat-note">{isZh ? "可出现在首页的精选站点数量。" : "Curated links that can surface on the front page."}</p>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{isZh ? "失效站点" : "Broken"}</span>
          <strong className="admin-stat-value">{stats.brokenCount}</strong>
          <p className="admin-stat-note">{isZh ? "仍需跟进的可用性失败记录。" : "Availability failures that still need follow-up."}</p>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{isZh ? "导入批次" : "Import batches"}</span>
          <strong className="admin-stat-value">{stats.importBatchCount}</strong>
          <p className="admin-stat-note">{isZh ? "来自 JSON 或浏览器书签的批量导入记录。" : "Tracked bulk intake runs from JSON or browser bookmarks."}</p>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{isZh ? "排队任务" : "Queued jobs"}</span>
          <strong className="admin-stat-value">{taskSummary.queued}</strong>
          <p className="admin-stat-note">{isZh ? "等待内部 runner 消化的后台任务。" : "Background work waiting for the internal runner."}</p>
        </article>
      </section>

      <section className="admin-board-grid">
        <article className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-copy">
              <p className="section-kicker">{isZh ? "目录地图" : "Directory map"}</p>
              <h3 className="admin-card-title">{isZh ? "分类分布" : "Category spread"}</h3>
            </div>
            <Link href="/admin/categories" className="section-link">
              {isZh ? "管理分类" : "Manage categories"}
            </Link>
          </div>
          <div className="admin-stack-list">
            {categories.map((category) => (
              <div key={category.id} className="admin-stack-item">
                <div className="admin-stack-topline">
                  <span className="admin-stack-title">{category.name}</span>
                  <span className="admin-record-count">{category.links.length} {isZh ? "个站点" : "sites"}</span>
                </div>
                <div className="admin-stack-subline">
                  <span>{category.slug}</span>
                  <span>{category.links.filter((link) => link.featured).length} {isZh ? "个推荐" : "featured"}</span>
                </div>
                <p className="admin-card-note">{category.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-copy">
              <p className="section-kicker">{isZh ? "推荐队列" : "Featured queue"}</p>
              <h3 className="admin-card-title">{isZh ? "首页推荐位" : "Front-page picks"}</h3>
            </div>
            <Link href="/admin/links" className="section-link">
              {isZh ? "管理站点" : "Manage links"}
            </Link>
          </div>
          <div className="admin-stack-list">
            {featuredLinks.length ? (
              featuredLinks.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="admin-stack-item">
                  <div className="admin-stack-topline">
                    <span className="admin-stack-title">{link.title}</span>
                    <span className="admin-record-count">{link.categoryName}</span>
                  </div>
                  <div className="admin-stack-subline">
                    <span>{getDomain(link.url)}</span>
                    <span>{link.sortOrder.toString().padStart(2, "0")}</span>
                  </div>
                  <p className="admin-card-note">{link.description}</p>
                </a>
              ))
            ) : (
              <div className="admin-empty">{isZh ? "还没有推荐站点。首页会先保持克制，等你手动挑选后再展示。" : "No featured links yet. The public home page will stay intentionally sparse until you curate them."}</div>
            )}
          </div>
        </article>

        <article className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-copy">
              <p className="section-kicker">{isZh ? "最近改动" : "Recent edits"}</p>
              <h3 className="admin-card-title">{isZh ? "最新变更" : "Latest changes"}</h3>
            </div>
            <span className="admin-record-count">{isZh ? "最近 6 条站点" : "Last 6 links"}</span>
          </div>
          <div className="admin-stack-list">
            {recentLinks.map((link) => (
              <div key={link.id} className="admin-stack-item">
                <div className="admin-stack-topline">
                  <span className="admin-stack-title">{link.title}</span>
                  <span className="admin-record-count">{formatDateLabel(link.updatedAt, locale)}</span>
                </div>
                <div className="admin-stack-subline">
                  <span>{link.categoryName}</span>
                  <span>{getDomain(link.url)}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-copy">
              <p className="section-kicker">{isZh ? "任务队列" : "Task queue"}</p>
              <h3 className="admin-card-title">{isZh ? "后台异步任务" : "Background work"}</h3>
            </div>
            <Link href="/admin/tasks" className="section-link">
              {isZh ? "打开任务页" : "Open tasks"}
            </Link>
          </div>
          <div className="admin-callout-list">
            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "排队中" : "Queued"}</span>
              <span className="admin-card-note">{taskSummary.queued} {isZh ? "个待处理" : "waiting"}</span>
            </div>
            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "执行中" : "Running"}</span>
              <span className="admin-card-note">{taskSummary.running} {isZh ? "个正在运行" : "active"}</span>
            </div>
            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "失败" : "Failed"}</span>
              <span className="admin-card-note">{taskSummary.failed} {isZh ? "个待复核" : "need review"}</span>
            </div>
          </div>
          <div className="admin-split-line" />
          <p className="admin-card-note">
            {isZh
              ? "健康检查、元数据刷新和索引重建都已经走异步队列，不再阻塞单次后台请求。"
              : "Health checks, metadata refreshes, and reindex work now flow through the queue instead of blocking a single admin request."}
          </p>
        </article>

        <article className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-copy">
              <p className="section-kicker">{isZh ? "维护入口" : "Maintenance"}</p>
              <h3 className="admin-card-title">{isZh ? "运维捷径" : "Ops shortcuts"}</h3>
            </div>
            <Link href="/admin/health" className="section-link">
              {isZh ? "健康面板" : "Health panel"}
            </Link>
          </div>
          <div className="admin-callout-list">
            <Link href="/admin/import" className="admin-callout">
              <span className="admin-callout-title">{isZh ? "导入中心" : "Import center"}</span>
              <span className="admin-card-note">
                {isZh ? "导入 JSON 或浏览器书签，先预览，再映射分类后写入。" : "Load JSON or bookmark HTML, preview the payload, then map categories before writing."}
              </span>
            </Link>
            <Link href="/admin/health" className="admin-callout">
              <span className="admin-callout-title">{isZh ? "健康检查" : "Health checks"}</span>
              <span className="admin-card-note">
                {isZh ? "查看失效站点、favicon/title 异常和当前可用性矩阵。" : "Inspect broken links, favicon/title failures, and the current availability matrix."}
              </span>
            </Link>
            <Link href="/admin/settings" className="admin-callout">
              <span className="admin-callout-title">{isZh ? "站点设置" : "Site settings"}</span>
              <span className="admin-card-note">
                {isZh ? "直接维护首页文案、默认主题和后台品牌文案。" : "Control hero copy, theme default, and admin branding without touching code."}
              </span>
            </Link>
          </div>
          <div className="admin-split-line" />
          <div className="admin-stack-list">
            {recentImportBatches.length ? (
              recentImportBatches.map((batch) => (
                <div key={batch.id} className="admin-stack-item">
                  <div className="admin-stack-topline">
                    <span className="admin-stack-title">{batch.filename ?? batch.sourceType}</span>
                    <span className="admin-record-count">{formatDateLabel(batch.createdAt, locale)}</span>
                  </div>
                  <div className="admin-stack-subline">
                    <span>{batch.importedCount} {isZh ? "条已导入" : "imported"}</span>
                    <span>{batch.skippedCount} {isZh ? "条已跳过" : "skipped"}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="admin-empty">{isZh ? "还没有导入记录。当前数据仍来自手动维护或种子数据。" : "No import history yet. Current records are still hand-maintained or seeded data."}</div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
