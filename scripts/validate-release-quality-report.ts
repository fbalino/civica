import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReleaseQualityReport } from "../src/lib/data-quality/release-quality";
import { RELEASE_QUALITY_POLICY } from "../src/lib/data-quality/release-quality-policy";
import { releaseQualityReportErrors } from "../src/lib/data-quality/release-quality-validation";

const path = resolve(process.cwd(), "data/release-quality-report.v1.json");
const report = JSON.parse(readFileSync(path, "utf8")) as ReleaseQualityReport;
const errors = releaseQualityReportErrors(report, RELEASE_QUALITY_POLICY);

console.log("=== DAT-014 release data quality ===\n");
console.log(`Live report status: ${report.status.toUpperCase()}`);
for (const check of report.checks) {
  console.log(`${check.status === "pass" ? "PASS" : "FAIL"} ${check.category}: ${check.issueCount}`);
}
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log("\nPASS — report structure, category closure, counts, policy, and remediation fields agree.");
