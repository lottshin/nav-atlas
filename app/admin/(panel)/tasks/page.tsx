import {
  cancelTaskAction,
  cleanupFaviconCacheAction,
  queueFullReindexAction,
  queueMetadataRetryBatchAction,
  retryTaskAction,
  runTaskRunnerAction
} from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { getAdminIntlLocale } from "@/lib/admin-locale";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminTasksPageData } from "@/lib/queries";
import type { JobRecord } from "@/lib/types";

function formatDateLabel(value: string | null, locale: "zh" | "en") {
  if (!value) {
    return locale === "zh" ? "未开始" : "Not started";
  }

  return new Intl.DateTimeFormat(getAdminIntlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function getTaskTypeLabel(type: JobRecord["type"], locale: "zh" | "en") {
  if (locale === "zh") {
    switch (type) {
      case "HEALTH_CHECK":
        return "健康检查";
      case "METADATA_REFRESH":
        return "元数据刷新";
      default:
        return "搜索重建";
    }
  }

  switch (type) {
    case "HEALTH_CHECK":
      return "Health check";
    case "METADATA_REFRESH":
      return "Metadata refresh";
    default:
      return "Search reindex";
  }
}

function getTaskStatusLabel(status: JobRecord["status"], locale: "zh" | "en") {
  if (locale === "zh") {
    switch (status) {
      case "queued":
        return "排队中";
      case "running":
        return "执行中";
      case "succeeded":
        return "已完成";
      case "failed":
        return "失败";
      default:
        return "已取消";
    }
  }

  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "succeeded":
      return "Succeeded";
    case "failed":
      return "Failed";
    default:
      return "Cancelled";
  }
}

function getTaskPayloadSummary(job: JobRecord, locale: "zh" | "en") {
  if (job.type === "SEARCH_REINDEX") {
    if (job.payload.scope === "links") {
      const count = Array.isArray(job.payload.linkIds) ? job.payload.linkIds.length : 0;
      return locale === "zh" ? `${count} 个定向站点` : `${count} scoped link(s)`;
    }

    return locale === "zh" ? "全量索引重建" : "Full index rebuild";
  }

  const linkId = typeof job.payload.linkId === "string" ? job.payload.linkId : "";
  const linkIds = Array.isArray(job.payload.linkIds) ? job.payload.linkIds : [];
  const count = linkId ? 1 : linkIds.length;
  return count ? (locale === "zh" ? `${count} 个目标站点` : `${count} link target(s)`) : locale === "zh" ? "等待目标载荷" : "Pending target payload";
}

type AdminTasksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminTasksPage({ searchParams }: AdminTasksPageProps) {
  const locale = await getAdminLocale();
  const isZh = locale === "zh";
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { advancedEnabled, jobs, runnerConfig, taskSummary } = await getAdminTasksPageData();
  const attempted = readParam(resolvedSearchParams.attempted);
  const succeeded = readParam(resolvedSearchParams.succeeded);
  const failed = readParam(resolvedSearchParams.failed);
  const queuedReindex = readParam(resolvedSearchParams.queuedReindex);
  const queuedMetadata = readParam(resolvedSearchParams.queuedMetadata);
  const faviconCleanup = readParam(resolvedSearchParams.faviconCleanup);
  const faviconCleanupMeta = readParam(resolvedSearchParams.faviconCleanupMeta);
  const faviconCleanupData = readParam(resolvedSearchParams.faviconCleanupData);
  const faviconCleanupScanned = readParam(resolvedSearchParams.faviconCleanupScanned);
  const faviconCleanupActive = readParam(resolvedSearchParams.faviconCleanupActive);
  const faviconCleanupInvalidMeta = readParam(resolvedSearchParams.faviconCleanupInvalidMeta);
  const faviconCleanupExpiredErrors = readParam(resolvedSearchParams.faviconCleanupExpiredErrors);
  const faviconCleanupOrphanedSuccess = readParam(resolvedSearchParams.faviconCleanupOrphanedSuccess);
  const faviconCleanupMissingData = readParam(resolvedSearchParams.faviconCleanupMissingData);
  const faviconCleanupOrphanedData = readParam(resolvedSearchParams.faviconCleanupOrphanedData);
  const faviconCleanupOverview = [
    {
      label: isZh ? "扫描记录" : "Scanned",
      value: faviconCleanupScanned || "0"
    },
    {
      label: isZh ? "活跃来源" : "Active sources",
      value: faviconCleanupActive || "0"
    },
    {
      label: isZh ? "删除总数" : "Removed files",
      value: `${faviconCleanupMeta || "0"} / ${faviconCleanupData || "0"}`
    }
  ];
  const faviconCleanupBreakdown = [
    {
      label: isZh ? "过期失败项" : "Expired failures",
      value: faviconCleanupExpiredErrors || "0"
    },
    {
      label: isZh ? "失去引用的旧缓存" : "Unreferenced stale cache",
      value: faviconCleanupOrphanedSuccess || "0"
    },
    {
      label: isZh ? "缺失数据的坏记录" : "Broken entries missing data",
      value: faviconCleanupMissingData || "0"
    },
    {
      label: isZh ? "损坏 meta" : "Invalid metadata",
      value: faviconCleanupInvalidMeta || "0"
    },
    {
      label: isZh ? "孤儿图标文件" : "Orphaned icon files",
      value: faviconCleanupOrphanedData || "0"
    }
  ];

  return (
    <div className="admin-view-stack">
      <section className="admin-page-header">
        <div className="admin-page-copy">
          <p className="section-kicker">{isZh ? "任务" : "Tasks"}</p>
          <h2 className="admin-page-title">{isZh ? "异步队列" : "Async queue"}</h2>
          <p className="admin-page-note">
            {isZh
              ? "后台动作只负责入队，真正的执行交给内部 runner，这样健康检查和元数据刷新不会堵在请求链路里。"
              : "Admin actions enqueue work; the internal runner processes it later. This keeps health and metadata jobs out of the request path."}
          </p>
        </div>
        <div className="admin-header-meta">
          <span className="admin-data-chip">{taskSummary.queued} {isZh ? "排队中" : "queued"}</span>
          <span className="admin-data-chip">{taskSummary.running} {isZh ? "执行中" : "running"}</span>
          <span className="admin-data-chip">{taskSummary.failed} {isZh ? "失败" : "failed"}</span>
        </div>
      </section>

      <article className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "缓存维护" : "Cache maintenance"}</p>
            <h3 className="admin-card-title">{isZh ? "Favicon 缓存清理" : "Favicon cache cleanup"}</h3>
            <p className="admin-card-note">
              {isZh
                ? "手动执行一次 favicon 缓存保洁：会清掉过期失败项、失去引用的旧缓存、损坏的 meta 和孤儿图标文件。部署后也建议用 cron 定期调用内部 cleanup 路由。"
                : "Run a manual favicon cache cleanup. This removes expired failures, unreferenced stale cache entries, broken metadata files, and orphaned icon binaries."}
            </p>
          </div>
        </div>

        <div className="admin-inline-actions">
          <form action={cleanupFaviconCacheAction}>
            <SubmitButton className="secondary-button" pendingLabel={isZh ? "清理中..." : "Cleaning cache..."}>
              {isZh ? "立即清理 favicon 缓存" : "Run favicon cleanup now"}
            </SubmitButton>
          </form>
        </div>

        {faviconCleanup ? (
          <div className="admin-stack-list admin-stack-list--tight">
            <div className="admin-breakdown-summary">
              {faviconCleanupOverview.map((item) => (
                <div key={item.label} className="admin-breakdown-pill">
                  <small className="admin-domain-note">{item.label}</small>
                  <span className="admin-record-count">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="admin-breakdown-grid">
              {faviconCleanupBreakdown.map((item) => (
                <div key={item.label} className="admin-breakdown-item">
                  <small className="admin-domain-note">{item.label}</small>
                  <span className="admin-record-count">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      {!advancedEnabled ? (
        <article className="admin-card">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "仅数据库模式" : "Database mode only"}</p>
            <h3 className="admin-card-title">{isZh ? "file 模式下任务系统不可用" : "Tasks are disabled in file mode"}</h3>
            <p className="admin-card-note">
              {isZh
                ? "把 `NAV_STORAGE_MODE` 切到 `database`，才能启用队列、runner、元数据刷新和搜索索引。"
                : "Switch `NAV_STORAGE_MODE` to `database` to enable the queue, runner, metadata refresh jobs, and search indexing."}
            </p>
          </div>
        </article>
      ) : (
        <>
          <article className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-copy">
                <p className="section-kicker">{isZh ? "执行器控制" : "Runner control"}</p>
                <h3 className="admin-card-title">{isZh ? "执行待处理任务" : "Execute pending jobs"}</h3>
                <p className="admin-card-note">
                  {isZh
                    ? `Runner 入口：${runnerConfig.endpoint}。当前批次上限 ${runnerConfig.batchLimit}，重试退避 ${Math.round(runnerConfig.retryBackoffMs / 1000)} 秒。`
                    : `Runner endpoint: ${runnerConfig.endpoint}. Current batch limit is ${runnerConfig.batchLimit}, retry backoff is ${Math.round(runnerConfig.retryBackoffMs / 1000)}s.`}
                </p>
              </div>
            </div>

            <div className="admin-inline-actions">
              <form action={runTaskRunnerAction}>
                <SubmitButton className="primary-button" pendingLabel={isZh ? "执行中..." : "Running jobs..."}>
                  {isZh ? "运行待处理批次" : "Run pending batch"}
                </SubmitButton>
              </form>
              <form action={queueFullReindexAction}>
                <SubmitButton className="secondary-button" pendingLabel={isZh ? "入队中..." : "Queueing..."}>
                  {isZh ? "加入全量重建" : "Queue full reindex"}
                </SubmitButton>
              </form>
              <form action={queueMetadataRetryBatchAction}>
                <SubmitButton className="secondary-button" pendingLabel={isZh ? "入队中..." : "Queueing..."}>
                  {isZh ? "运行元数据重试批次" : "Run metadata retry batch"}
                </SubmitButton>
              </form>
            </div>

            {attempted ? (
              <p className="admin-card-note">
                {isZh
                  ? `最近一次 runner 批次尝试 ${attempted} 个任务，成功 ${succeeded || "0"}，失败 ${failed || "0"}。`
                  : `Last runner batch attempted ${attempted} job(s), succeeded ${succeeded || "0"}, failed ${failed || "0"}.`}
              </p>
            ) : null}
            {queuedReindex ? <p className="admin-card-note">{isZh ? "已加入一次全量搜索重建任务。" : "Queued a full search reindex job."}</p> : null}
            {queuedMetadata ? <p className="admin-card-note">{isZh ? `已为 ${queuedMetadata} 个失败项加入元数据重试任务。` : `Queued metadata retry for ${queuedMetadata} failed item(s).`}</p> : null}
          </article>

          <section className="admin-board-grid admin-board-grid--ops">
            <article className="admin-stat-card">
              <span className="admin-stat-label">{isZh ? "排队中" : "Queued"}</span>
              <strong className="admin-stat-value">{taskSummary.queued}</strong>
              <p className="admin-stat-note">{isZh ? "等待下一次 runner 调用。" : "Waiting for the next runner invocation."}</p>
            </article>
            <article className="admin-stat-card">
              <span className="admin-stat-label">{isZh ? "执行中" : "Running"}</span>
              <strong className="admin-stat-value">{taskSummary.running}</strong>
              <p className="admin-stat-note">{isZh ? "已被 runner 领取并正在执行。" : "Claimed by the runner and currently executing."}</p>
            </article>
            <article className="admin-stat-card">
              <span className="admin-stat-label">{isZh ? "失败" : "Failed"}</span>
              <strong className="admin-stat-value">{taskSummary.failed}</strong>
              <p className="admin-stat-note">{isZh ? "重试后仍失败，或遇到不可恢复错误。" : "Stopped after retries or due to an unrecoverable error."}</p>
            </article>
            <article className="admin-card admin-card--muted">
              <div className="admin-card-copy">
                <p className="section-kicker">{isZh ? "执行说明" : "Runner recipe"}</p>
                <h3 className="admin-card-title">{isZh ? "Cron 调用目标" : "Cron target"}</h3>
                <p className="admin-card-note">
                  {isZh ? "用平台 cron 或手动请求带着共享密钥去调用内部 runner。" : "Use a platform cron or manual request to hit the internal runner with the shared secret header."}
                </p>
              </div>
              <pre className="admin-code-block">
                <code>{`POST ${runnerConfig.endpoint}?limit=${runnerConfig.batchLimit}\nAuthorization: Bearer $JOB_RUNNER_SECRET`}</code>
              </pre>
            </article>
          </section>

          <article className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-copy">
                <p className="section-kicker">{isZh ? "最近任务" : "Recent jobs"}</p>
                <h3 className="admin-card-title">{isZh ? "队列账本" : "Queue ledger"}</h3>
              </div>
              <span className="admin-record-count">{jobs.length} {isZh ? "条记录" : "records"}</span>
            </div>

            <div className="admin-stack-list">
              {jobs.map((job) => {
                const pillTone =
                  job.status === "succeeded"
                    ? "healthy"
                    : job.status === "failed"
                      ? "broken"
                      : job.status === "running"
                        ? "warning"
                        : "unknown";

                return (
                  <article key={job.id} className="admin-stack-item admin-ledger-item">
                    <div className="admin-stack-topline">
                      <div className="admin-card-copy">
                        <strong>{getTaskTypeLabel(job.type, locale)}</strong>
                        <span className="admin-domain-note">{getTaskPayloadSummary(job, locale)}</span>
                      </div>
                      <span className={`admin-status-pill is-${pillTone}`}>{getTaskStatusLabel(job.status, locale)}</span>
                    </div>

                    <div className="admin-ledger-grid">
                      <div className="admin-stack-list admin-stack-list--tight">
                        <small className="admin-domain-note">{isZh ? "尝试次数" : "Attempts"}</small>
                        <span className="admin-record-count">
                          {job.attemptCount}/{job.maxAttempts}
                        </span>
                      </div>
                      <div className="admin-stack-list admin-stack-list--tight">
                        <small className="admin-domain-note">{isZh ? "可执行时间" : "Available"}</small>
                        <span className="admin-record-count">{formatDateLabel(job.availableAt, locale)}</span>
                      </div>
                      <div className="admin-stack-list admin-stack-list--tight">
                        <small className="admin-domain-note">{isZh ? "开始时间" : "Started"}</small>
                        <span className="admin-record-count">{formatDateLabel(job.startedAt, locale)}</span>
                      </div>
                      <div className="admin-stack-list admin-stack-list--tight">
                        <small className="admin-domain-note">{isZh ? "结束时间" : "Finished"}</small>
                        <span className="admin-record-count">{formatDateLabel(job.finishedAt, locale)}</span>
                      </div>
                    </div>

                    <div className="admin-stack-list admin-stack-list--tight">
                      <small className="admin-domain-note">{isZh ? "最近错误" : "Last error"}</small>
                      <span className="admin-domain-note">{job.lastError ?? (isZh ? "无" : "None")}</span>
                    </div>

                    <div className="admin-row-actions">
                      {job.status === "failed" || job.status === "cancelled" ? (
                        <form action={retryTaskAction}>
                          <input type="hidden" name="id" value={job.id} />
                          <SubmitButton className="secondary-button" pendingLabel={isZh ? "重试中..." : "Retrying..."}>
                            {isZh ? "重试" : "Retry"}
                          </SubmitButton>
                        </form>
                      ) : null}
                      {job.status === "queued" ? (
                        <form action={cancelTaskAction}>
                          <input type="hidden" name="id" value={job.id} />
                          <SubmitButton className="danger-button" pendingLabel={isZh ? "取消中..." : "Cancelling..."}>
                            {isZh ? "取消" : "Cancel"}
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {!jobs.length ? <div className="admin-empty">{isZh ? "还没有任务。先触发健康检查或元数据刷新来填充队列。" : "No jobs yet. Queue health or metadata work to populate this ledger."}</div> : null}
            </div>
          </article>
        </>
      )}
    </div>
  );
}
