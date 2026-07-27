/**
 * Keep operational counters while removing provider and database details from
 * cron response bodies. Full error objects remain available in server logs.
 */
export function summarizeCronReports<T extends { error?: unknown }>(
  reports: readonly T[],
) {
  return reports.map(({ error, ...report }) => ({
    ...report,
    failed: error !== undefined,
  }));
}
