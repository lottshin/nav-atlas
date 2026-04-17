import {
  runAllHealthChecksAction,
  runAttentionHealthChecksAction,
  runSingleHealthCheckAction
} from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { getAdminIntlLocale } from "@/lib/admin-locale";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { HEALTH_CHECK_REQUEST_LIMIT, HEALTH_STALE_DAYS } from "@/lib/health";
import { getAdminHealthPageData } from "@/lib/queries";
import type { LinkCheckState, LinkStatus } from "@/lib/types";
import { getDomain } from "@/lib/utils";

function formatDateLabel(value: string | null, locale: "zh" | "en") {
  if (!value) {
    return locale === "zh" ? "从未" : "Never";
  }

  return new Intl.DateTimeFormat(getAdminIntlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getStatusLabel(status: LinkStatus, locale: "zh" | "en") {
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

function getCheckStateLabel(value: LinkCheckState, locale: "zh" | "en") {
  if (locale === "zh") {
    switch (value) {
      case "ok":
        return "正常";
      case "error":
        return "错误";
      default:
        return "空闲";
    }
  }

  switch (value) {
    case "ok":
      return "OK";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

function formatHttpStatus(value: number | null, locale: "zh" | "en") {
  return value ? `HTTP ${value}` : locale === "zh" ? "待检测" : "Pending";
}

function isStaleLink(lastCheckedAt: string | null) {
  if (!lastCheckedAt) {
    return true;
  }

  const checkedAt = Date.parse(lastCheckedAt);
  if (Number.isNaN(checkedAt)) {
    return true;
  }

  return Date.now() - checkedAt >= HEALTH_STALE_DAYS * 24 * 60 * 60 * 1000;
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseNumberParam(value: string | string[] | undefined) {
  const parsed = Number(readParam(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildRunSummary(searchParams: Record<string, string | string[] | undefined>, locale: "zh" | "en") {
  const attempted = parseNumberParam(searchParams.attempted);
  const success = parseNumberParam(searchParams.success);
  const failed = parseNumberParam(searchParams.failed);
  const queued = parseNumberParam(searchParams.queued);
  const remaining = parseNumberParam(searchParams.remaining);
  const scope = readParam(searchParams.scope);

  if (!scope) {
    return null;
  }

  const scopeLabel =
    scope === "attention"
      ? locale === "zh"
        ? "关注队列"
        : "attention queue"
      : scope === "single"
        ? locale === "zh"
          ? "单站检测"
          : "single site check"
        : locale === "zh"
          ? "目录批次"
          : "directory batch";

  return {
    attempted,
    failed,
    queued,
    remaining,
    scopeLabel,
    success
  };
}

type AdminHealthPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminHealthPage({ searchParams }: AdminHealthPageProps) {
  const locale = await getAdminLocale();
  const isZh = locale === "zh";
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { checkCount, links, latestChecksByLinkId, recentChecks, stats } = await getAdminHealthPageData();
  const linkById = new Map(links.map((link) => [link.id, link]));
  const checkedCount = links.filter((link) => link.lastCheckedAt).length;
  const attentionCount = links.filter(
    (link) => !link.lastCheckedAt || link.status === "broken" || link.status === "warning" || link.status === "unknown" || isStaleLink(link.lastCheckedAt)
  ).length;
  const warningCount = links.filter((link) => link.status === "warning").length;
  const pendingCount = links.filter((link) => !link.lastCheckedAt || link.status === "unknown").length;
  const runSummary = buildRunSummary(resolvedSearchParams, locale);

  return (
    <div className="admin-view-stack">
      <section className="admin-page-header">
        <div className="admin-page-copy">
          <p className="section-kicker">{isZh ? "健康" : "Health"}</p>
          <h2 className="admin-page-title">{isZh ? "目录脉搏" : "Directory pulse"}</h2>
          <p className="admin-page-note">
            {isZh
              ? "按批运行在线检测，写回 HTTP、favicon 和标题信号，在不把后台做成监控面板的前提下维持目录体征。"
              : "Run bounded live checks, write back the latest HTTP/favicon/title signals, and keep the directory's operating pulse visible without turning this panel into a full monitoring dashboard."}
          </p>
        </div>

        <div className="admin-header-meta">
          <span className="admin-data-chip">{stats.brokenCount} {isZh ? "失效" : "broken"}</span>
          <span className="admin-data-chip">{warningCount} {isZh ? "警告" : "warning"}</span>
          <span className="admin-data-chip">{pendingCount} {isZh ? "待检测" : "pending"}</span>
        </div>
      </section>

      <article className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "队列控制" : "Queue control"}</p>
            <h3 className="admin-card-title">{isZh ? "限量健康检查" : "Bounded health runs"}</h3>
          </div>
        </div>

        <p className="admin-card-note">
          {isZh
            ? `每次触发最多检查 ${HEALTH_CHECK_REQUEST_LIMIT} 个站点。database 模式会入队给内部 runner，file 模式则保留本地同步执行。`
            : `Each trigger targets up to ${HEALTH_CHECK_REQUEST_LIMIT} sites. In database mode the action enqueues jobs for the internal runner; in file mode it still executes the bounded checks inline.`}
        </p>

        <div className="admin-inline-actions">
          <form action={runAttentionHealthChecksAction}>
            <SubmitButton className="secondary-button" pendingLabel={isZh ? "检查关注队列..." : "Checking attention queue..."}>
              {isZh ? "运行关注批次" : "Run attention batch"}
            </SubmitButton>
          </form>
          <form action={runAllHealthChecksAction}>
            <SubmitButton className="primary-button" pendingLabel={isZh ? "检查下一批..." : "Checking next batch..."}>
              {isZh ? "扫描下一批" : "Sweep next batch"}
            </SubmitButton>
          </form>
        </div>

        {runSummary ? (
          <p className="admin-card-note">
            {isZh
              ? `最近一次动作：${runSummary.scopeLabel}。入队 ${runSummary.queued}，尝试 ${runSummary.attempted}，保存 ${runSummary.success}，失败 ${runSummary.failed}，剩余 ${runSummary.remaining}。`
              : `Last action: ${runSummary.scopeLabel}. Queued ${runSummary.queued}, attempted ${runSummary.attempted}, saved ${runSummary.success}, failed ${runSummary.failed}, remaining ${runSummary.remaining}.`}
          </p>
        ) : null}
      </article>

      <section className="admin-stat-grid admin-stat-grid--triple">
        <article className="admin-stat-card">
          <span className="admin-stat-label">{isZh ? "已检测覆盖" : "Checked coverage"}</span>
          <strong className="admin-stat-value">{checkedCount}</strong>
          <p className="admin-stat-note">{isZh ? "至少拥有一条健康检查记录的站点数量。" : "Sites that have at least one recorded health check."}</p>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{isZh ? "需要关注" : "Needs attention"}</span>
          <strong className="admin-stat-value">{attentionCount}</strong>
          <p className="admin-stat-note">{isZh ? "优先回看的待检测、过期、警告或失效站点。" : "Pending, stale, warning, or broken links that should be revisited first."}</p>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{isZh ? "累计检测记录" : "Recorded checks"}</span>
          <strong className="admin-stat-value">{checkCount}</strong>
          <p className="admin-stat-note">{isZh ? "当前目录里累计写入的健康检查条数。" : "Total health-check records currently stored for this directory."}</p>
        </article>
      </section>

      <article className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "当前信号" : "Current signal"}</p>
            <h3 className="admin-card-title">{isZh ? "站点健康矩阵" : "Site health matrix"}</h3>
          </div>
          <span className="admin-record-count">{links.length} {isZh ? "条记录" : "records"}</span>
        </div>

        <div className="admin-table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{isZh ? "站点" : "Site"}</th>
                <th>{isZh ? "状态" : "Status"}</th>
                <th>{isZh ? "上次检测" : "Last checked"}</th>
                <th>HTTP</th>
                <th>Favicon</th>
                <th>{isZh ? "标题" : "Title"}</th>
                <th>{isZh ? "动作" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const latestCheck = latestChecksByLinkId[link.id];

                return (
                  <tr key={link.id}>
                    <td>
                      <div className="admin-table-site-copy">
                        <strong>{link.title}</strong>
                        <span>{getDomain(link.url)}</span>
                        {latestCheck?.note ? <p className="admin-card-note">{latestCheck.note}</p> : null}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-status-pill is-${link.status}`}>{getStatusLabel(link.status, locale)}</span>
                    </td>
                    <td>{formatDateLabel(link.lastCheckedAt, locale)}</td>
                    <td>{formatHttpStatus(link.httpStatus, locale)}</td>
                    <td>{getCheckStateLabel(link.faviconStatus, locale)}</td>
                    <td>{getCheckStateLabel(link.titleStatus, locale)}</td>
                    <td>
                      <form action={runSingleHealthCheckAction}>
                        <input type="hidden" name="id" value={link.id} />
                        <SubmitButton className="secondary-button" pendingLabel={isZh ? "检查中..." : "Checking..."}>
                          {isZh ? "运行检查" : "Run check"}
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!links.length ? <div className="admin-empty">{isZh ? "还没有站点。先添加链接，再执行健康检查。" : "No sites yet. Add links before running health checks."}</div> : null}
        </div>
      </article>

      <article className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "最近脉搏" : "Recent pulse"}</p>
            <h3 className="admin-card-title">{isZh ? "最新检测记录" : "Latest recorded runs"}</h3>
          </div>
          <span className="admin-record-count">{recentChecks.length} {isZh ? "条记录" : "records"}</span>
        </div>

        <div className="admin-stack-list">
          {recentChecks.length ? (
            recentChecks.map((check) => {
              const link = linkById.get(check.linkId);

              return (
                <div key={check.id} className="admin-stack-item">
                  <div className="admin-stack-topline">
                    <span className="admin-stack-title">{link?.title ?? (isZh ? "未知站点" : "Unknown site")}</span>
                    <span className="admin-record-count">{formatDateLabel(check.checkedAt, locale)}</span>
                  </div>
                  <div className="admin-stack-subline">
                    <span>{link ? getDomain(link.url) : check.linkId}</span>
                    <span>{formatHttpStatus(check.httpStatus, locale)}</span>
                    <span>favicon {getCheckStateLabel(check.faviconStatus, locale)}</span>
                    <span>{isZh ? "标题" : "title"} {getCheckStateLabel(check.titleStatus, locale)}</span>
                  </div>
                  {check.note ? <p className="admin-card-note">{check.note}</p> : null}
                </div>
              );
            })
          ) : (
            <div className="admin-empty">{isZh ? "还没有检测记录。先运行一次站点检查。" : "No checks recorded yet. Run a site check to populate this history."}</div>
          )}
        </div>
      </article>
    </div>
  );
}
