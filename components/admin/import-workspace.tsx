"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { applyImportBatchAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AdminLocale } from "@/lib/admin-locale";
import { getAdminIntlLocale } from "@/lib/admin-locale";
import { parseBookmarksHtmlText, parseJsonImportText } from "@/lib/import-utils";
import type { CategoryWithLinks, ImportBatchRecord, LinkRecord } from "@/lib/types";

type ImportWorkspaceProps = {
  categories: CategoryWithLinks[];
  links: LinkRecord[];
  batches: ImportBatchRecord[];
  locale: AdminLocale;
};

function formatDateLabel(value: string, locale: AdminLocale) {
  return new Intl.DateTimeFormat(getAdminIntlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ImportWorkspace({ categories, links, batches, locale }: ImportWorkspaceProps) {
  const [previewItems, setPreviewItems] = useState<ReturnType<typeof parseJsonImportText>>([]);
  const [sourceType, setSourceType] = useState<"json" | "bookmarks-html">("json");
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [conflictMode, setConflictMode] = useState<"skip" | "overwrite" | "duplicate">("skip");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const isZh = locale === "zh";

  const existingUrls = useMemo(() => new Set(links.map((link) => link.url)), [links]);
  const sourceCategories = useMemo(() => [...new Set(previewItems.map((item) => item.sourceCategory))], [previewItems]);
  const duplicateCount = useMemo(() => previewItems.filter((item) => existingUrls.has(item.url)).length, [existingUrls, previewItems]);

  useEffect(() => {
    setMappings((current) => {
      const next: Record<string, string> = {};

      for (const sourceCategory of sourceCategories) {
        const exactMatch = categories.find((category) => category.name.toLowerCase() === sourceCategory.toLowerCase());
        next[sourceCategory] = current[sourceCategory] ?? (exactMatch ? `existing:${exactMatch.id}` : `create:${sourceCategory}`);
      }

      return next;
    });
  }, [categories, sourceCategories]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const detectedSourceType = file.name.toLowerCase().endsWith(".html") ? "bookmarks-html" : "json";
      const items = detectedSourceType === "bookmarks-html" ? parseBookmarksHtmlText(text) : parseJsonImportText(text);

      setSourceType(detectedSourceType);
      setPreviewItems(items);
      setFilename(file.name);
      setError(items.length ? "" : isZh ? "文件已读取，但没有解析出可导入的网站。" : "The file was read, but no importable sites were parsed.");
    } catch (nextError) {
      setPreviewItems([]);
      setFilename(file.name);
      setError(nextError instanceof Error ? nextError.message : isZh ? "无法解析这个导入文件。" : "Could not parse this import file.");
    }
  };

  return (
    <div className="admin-view-stack">
      <section className="admin-page-header">
        <div className="admin-page-copy">
          <p className="section-kicker">{isZh ? "导入" : "Import"}</p>
          <h2 className="admin-page-title">{isZh ? "导入中心" : "Import center"}</h2>
          <p className="admin-page-note">{isZh ? "先在浏览器里预览文件，再映射分类和冲突策略，最后才提交到后台。" : "Preview the file first, then map categories and conflict rules before writing anything into the directory."}</p>
        </div>
        <div className="admin-header-meta">
          <span className="admin-data-chip">{batches.length} {isZh ? "个批次" : "batches"}</span>
          <a href="/api/admin/export" className="secondary-button">
            {isZh ? "导出 JSON" : "Export JSON"}
          </a>
        </div>
      </section>

      <section className="admin-workspace-grid">
        <article className="admin-card">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "载入文件" : "Load file"}</p>
            <h3 className="admin-card-title">{isZh ? "上传导入文件" : "Upload import file"}</h3>
            <p className="admin-card-note">{isZh ? "支持项目 JSON 和浏览器 bookmarks HTML。文件先在本地预览，确认后才会真正提交。" : "Supports project JSON and browser bookmark HTML. The file is previewed locally first, then submitted only after confirmation."}</p>
          </div>

          <label className="field-stack">
            <span className="field-label">{isZh ? "选择文件" : "Choose file"}</span>
            <input
              id="admin-import-file"
              name="importFile"
              form="admin-import-form"
              type="file"
              accept=".json,.html,.htm"
              className="admin-upload-input"
              onChange={handleFileChange}
            />
          </label>

          <label className="field-stack">
            <span className="field-label">{isZh ? "冲突策略" : "Conflict mode"}</span>
            <select value={conflictMode} onChange={(event) => setConflictMode(event.target.value as typeof conflictMode)} className="field-input">
              <option value="skip">{isZh ? "已有 URL 则跳过" : "Skip existing URLs"}</option>
              <option value="overwrite">{isZh ? "已有 URL 则覆盖" : "Overwrite existing URLs"}</option>
              <option value="duplicate">{isZh ? "保留重复副本" : "Keep duplicates"}</option>
            </select>
          </label>

          {error ? <div className="form-error">{error}</div> : null}
          {filename ? <div className="admin-empty admin-mono">{filename}</div> : null}
        </article>

        <article className="admin-card admin-card--muted">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "预览摘要" : "Preview summary"}</p>
            <h3 className="admin-card-title">{isZh ? "导入概览" : "Import overview"}</h3>
          </div>
          <div className="admin-callout-list">
            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "待导入站点" : "Incoming sites"}</span>
              <span className="admin-card-note">{previewItems.length} {isZh ? "条" : "items"}</span>
            </div>
            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "来源分类" : "Source categories"}</span>
              <span className="admin-card-note">{sourceCategories.length} {isZh ? "个" : "groups"}</span>
            </div>
            <div className="admin-callout">
              <span className="admin-callout-title">{isZh ? "重复 URL" : "Duplicate URLs"}</span>
              <span className="admin-card-note">{duplicateCount} {isZh ? "条" : "items"}</span>
            </div>
          </div>
        </article>
      </section>

      {previewItems.length ? (
        <form id="admin-import-form" action={applyImportBatchAction} className="admin-card">
          <input type="hidden" name="sourceType" value={sourceType} />
          <input type="hidden" name="filename" value={filename} />
          <input type="hidden" name="conflictMode" value={conflictMode} />
          <input type="hidden" name="mappings" value={JSON.stringify(mappings)} />

          <div className="admin-card-header">
            <div className="admin-card-copy">
              <p className="section-kicker">{isZh ? "映射关系" : "Mappings"}</p>
              <h3 className="admin-card-title">{isZh ? "分类映射" : "Category mapping"}</h3>
            </div>
            <SubmitButton className="primary-button" pendingLabel={isZh ? "导入中..." : "Importing..."}>
              {isZh ? `导入 ${previewItems.length} 个站点` : `Import ${previewItems.length} site(s)`}
            </SubmitButton>
          </div>

          <div className="admin-import-map">
            {sourceCategories.map((sourceCategory) => (
              <div key={sourceCategory} className="admin-import-map-row">
                <div className="admin-card-copy">
                  <strong>{sourceCategory}</strong>
                  <span className="admin-record-count">
                    {previewItems.filter((item) => item.sourceCategory === sourceCategory).length} {isZh ? "个站点" : "sites"}
                  </span>
                </div>
                <select
                  className="field-input"
                  value={mappings[sourceCategory] ?? `create:${sourceCategory}`}
                  onChange={(event) => setMappings((current) => ({ ...current, [sourceCategory]: event.target.value }))}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={`existing:${category.id}`}>
                      {isZh ? `归入 ${category.name}` : `Map to ${category.name}`}
                    </option>
                  ))}
                  <option value={`create:${sourceCategory}`}>{isZh ? "创建同名分类" : "Create matching category"}</option>
                </select>
              </div>
            ))}
          </div>

          <div className="admin-stack-list">
            {previewItems.slice(0, 10).map((item) => (
              <div key={`${item.sourceCategory}-${item.url}`} className="admin-stack-item">
                <div className="admin-stack-topline">
                  <span className="admin-stack-title">{item.title}</span>
                  <span className="admin-record-count">{item.sourceCategory}</span>
                </div>
                <div className="admin-stack-subline">
                  <span>{item.url}</span>
                  {existingUrls.has(item.url) ? <span>{isZh ? "重复" : "duplicate"}</span> : <span>{isZh ? "新站点" : "new"}</span>}
                </div>
                {item.description ? <p className="admin-card-note">{item.description}</p> : null}
              </div>
            ))}
          </div>
        </form>
      ) : null}

      <article className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-copy">
            <p className="section-kicker">{isZh ? "导入历史" : "Import history"}</p>
            <h3 className="admin-card-title">{isZh ? "导入批次" : "Import batches"}</h3>
          </div>
          <span className="admin-record-count">{batches.length} {isZh ? "条记录" : "records"}</span>
        </div>

        <div className="admin-stack-list">
          {batches.length ? (
            batches.map((batch) => (
              <div key={batch.id} className="admin-stack-item">
                <div className="admin-stack-topline">
                  <span className="admin-stack-title">{batch.filename ?? batch.sourceType}</span>
                  <span className="admin-record-count">{formatDateLabel(batch.createdAt, locale)}</span>
                </div>
                <div className="admin-stack-subline">
                  <span>{batch.itemCount} {isZh ? "条" : "items"}</span>
                  <span>{batch.importedCount} {isZh ? "条已导入" : "imported"}</span>
                  <span>{batch.skippedCount} {isZh ? "条已跳过" : "skipped"}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="admin-empty">{isZh ? "还没有导入批次记录。" : "No import history yet."}</div>
          )}
        </div>
      </article>
    </div>
  );
}
