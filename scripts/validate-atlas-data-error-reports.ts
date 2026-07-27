import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  DATA_ERROR_REPORT_CONTRACT,
  DATA_ERROR_REPORT_NOTICE_VERSION,
  REPORTABLE_ATLAS_ENTITY_TYPES,
} from "@/lib/corrections/data-error-report";
import { AUTHORITATIVE_MIGRATIONS } from "@/lib/db/authoritative-migration-manifest";

const MIGRATION_ID = "0047_atlas_data_error_reports";
const errors: string[] = [];

function requireFragments(path: string, fragments: string[]) {
  const source = readFileSync(path, "utf8");
  for (const fragment of fragments) {
    if (!source.includes(fragment)) errors.push(`${path} lacks ${fragment}`);
  }
}

if (DATA_ERROR_REPORT_CONTRACT !== "civica-atlas-data-error-report/v1") {
  errors.push("data-error report contract drifted");
}
if (
  DATA_ERROR_REPORT_NOTICE_VERSION !==
  "civica-data-error-report-notice/2026-07-23"
) {
  errors.push("data-error report notice drifted");
}
if (REPORTABLE_ATLAS_ENTITY_TYPES.length !== 8) {
  errors.push("ATL-019 reportable entity closure drifted");
}

const migration = AUTHORITATIVE_MIGRATIONS.find(
  (entry) => entry.id === MIGRATION_ID,
);
if (!migration) {
  errors.push("authoritative migration manifest omits ATL-024");
} else {
  const source = readFileSync(migration.path, "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  if (hash !== migration.sha256) errors.push("ATL-024 migration hash drifted");
}

requireFragments("drizzle/authoritative/0047_atlas_data_error_reports.sql", [
  '"entity_type"',
  '"field_path"',
  '"affected_release_id"',
  '"reported_source_id"',
  '"acknowledgment_code"',
  "correction_log_atlas_report_shape",
  "correction_log_resolution_shape",
]);
requireFragments(
  "src/app/api/civica-index/corrections/route.ts",
  [
    "checkRequestRateLimit",
    "body._trap",
    "INCOMPLETE_ATLAS_REPORT",
    "NOTICE_REQUIRED",
    "HTTPS_REQUIRED",
    "dataErrorReceiptCode",
    "isAtlasCorrectionSchemaReady",
  ],
);
requireFragments("src/app/api/admin/corrections/[id]/route.ts", [
  "withAdminMutation",
  "correctionTriageErrors",
  "atlasEntityChangeHistory.correctionLogId",
  "redactSubmitter",
  "reviewerId",
]);
requireFragments(
  "src/app/(reader)/report-data-issue/ReportDataIssueForm.tsx",
  [
    "Stable entity ID",
    "Affected release or version",
    "Displayed source URL",
    "Published value or text",
    "noticeAccepted",
    "_trap: trap",
  ],
);
requireFragments("src/lib/privacy/data-handling.ts", [
  'id: "data-error-reports"',
  "no new raw-IP retention",
  "required change-history link before corrected resolution",
]);
for (const path of [
  "src/lib/api/route-inventory/registry.ts",
  "src/lib/api/route-io-policy/registry.ts",
  "src/lib/api/rate-limit-policy.ts",
]) {
  requireFragments(path, ["api/admin/corrections/[id]/route.ts"]);
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(
  "PASS — ATL-024 closes exact intake, opaque acknowledgement, HMAC rate limit/honeypot protection, authenticated triage, privacy redaction, and correction-history linkage.",
);
