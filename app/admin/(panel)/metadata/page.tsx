import { MetadataManagementWorkspace } from "@/components/admin/metadata-management-workspace";
import { getAdminLocale } from "@/lib/admin-locale-server";
import { getAdminMetadataPageData } from "@/lib/queries";

type AdminMetadataPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminMetadataPage({ searchParams }: AdminMetadataPageProps) {
  const locale = await getAdminLocale();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { advancedEnabled, filters, rows, summary } = await getAdminMetadataPageData(resolvedSearchParams);
  const queuedValue = resolvedSearchParams.queued;
  const queuedCount = typeof queuedValue === "string" && queuedValue.trim() ? Number(queuedValue) : Array.isArray(queuedValue) ? Number(queuedValue[0] ?? "") : null;
  const retriedValue = resolvedSearchParams.retried;
  const retriedCount = typeof retriedValue === "string" && retriedValue.trim() ? Number(retriedValue) : Array.isArray(retriedValue) ? Number(retriedValue[0] ?? "") : null;

  return (
    <MetadataManagementWorkspace
      advancedEnabled={advancedEnabled}
      filters={filters}
      locale={locale}
      queuedCount={Number.isFinite(queuedCount) ? queuedCount : null}
      retriedCount={Number.isFinite(retriedCount) ? retriedCount : null}
      rows={rows}
      summary={summary}
    />
  );
}
