import {
  QUALITY_CATEGORIES,
  RELEASE_QUALITY_SCHEMA,
  type ReleaseQualityPolicy,
  type ReleaseQualityReport,
} from "./release-quality";

export function releaseQualityReportErrors(
  report: ReleaseQualityReport,
  policy: ReleaseQualityPolicy,
) {
  const errors: string[] = [];
  if (report.schemaVersion !== RELEASE_QUALITY_SCHEMA) errors.push("schema version does not match release-data-quality/v1");
  if (!Number.isFinite(Date.parse(report.generatedAt))) errors.push("generatedAt is not an ISO timestamp");
  const categories = report.checks.map((check) => check.category);
  if (new Set(categories).size !== QUALITY_CATEGORIES.length || QUALITY_CATEGORIES.some((category) => !categories.includes(category))) {
    errors.push("checks do not cover every required quality category exactly once");
  }
  for (const check of report.checks) {
    const issueCount = report.issues.filter((issue) => issue.category === check.category && issue.severity === "error").length;
    if (check.issueCount !== issueCount) errors.push(`${check.category} issueCount does not match its error issues`);
    if (check.status !== (issueCount ? "fail" : "pass")) errors.push(`${check.category} status does not match its issue count`);
  }
  const expectedStatus = report.checks.some((check) => check.status === "fail") ? "fail" : "pass";
  if (report.status !== expectedStatus) errors.push("overall status does not match check statuses");
  for (const issue of report.issues) {
    if (!issue.checkId.trim() || !issue.entity.trim() || !issue.detail.trim()) errors.push("an issue is missing its check ID, entity, or detail");
    if (!issue.remediation.trim()) errors.push(`${issue.checkId} has no remediation`);
    if (!QUALITY_CATEGORIES.includes(issue.category)) errors.push(`${issue.checkId} uses an unknown category`);
  }
  if (report.policy.sourceMaxAgeDays !== policy.sourceMaxAgeDays || report.policy.minimumVintageYear !== policy.minimumVintageYear || report.policy.maximumFutureYears !== policy.maximumFutureYears) {
    errors.push("checked report policy does not match the executable policy");
  }
  for (const table of Object.keys(policy.rowCounts)) {
    if (!Number.isSafeInteger(report.rowCounts[table])) errors.push(`checked report is missing row count ${table}`);
  }
  return errors;
}
