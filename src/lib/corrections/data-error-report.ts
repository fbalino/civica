import { createHash } from "node:crypto";

export const ATLAS_DATA_ERROR_CATEGORY = "atlas_data_error" as const;
export const DATA_ERROR_REPORT_CONTRACT =
  "civica-atlas-data-error-report/v1" as const;
export const DATA_ERROR_REPORT_NOTICE_VERSION =
  "civica-data-error-report-notice/2026-07-23" as const;

export const REPORTABLE_ATLAS_ENTITY_TYPES = [
  "fact",
  "institution",
  "office",
  "person",
  "election",
  "constitution-passage",
  "organization",
  "indicator",
] as const;

export type ReportableAtlasEntityType =
  (typeof REPORTABLE_ATLAS_ENTITY_TYPES)[number];

export const CORRECTION_TRIAGE_STATUSES = [
  "open",
  "in_review",
  "resolved_corrected",
  "resolved_no_change",
  "rejected",
] as const;

export type CorrectionTriageStatus =
  (typeof CORRECTION_TRIAGE_STATUSES)[number];

export function dataErrorReceiptCode(id: string): string {
  const digest = createHash("sha256").update(id).digest("hex");
  return `CA-${digest.slice(0, 12).toUpperCase()}`;
}

export function isTerminalCorrectionStatus(
  status: CorrectionTriageStatus,
): boolean {
  return (
    status === "resolved_corrected" ||
    status === "resolved_no_change" ||
    status === "rejected"
  );
}

export function correctionTriageErrors(input: {
  status: CorrectionTriageStatus;
  disposition: string | null;
  linkedChangeCount: number;
}): string[] {
  const errors: string[] = [];
  if (
    isTerminalCorrectionStatus(input.status) &&
    (input.disposition?.trim().length ?? 0) < 10
  ) {
    errors.push("terminal correction states require a public disposition");
  }
  if (
    input.status === "resolved_corrected" &&
    input.linkedChangeCount < 1
  ) {
    errors.push(
      "resolved_corrected requires an ATL-020 change-history event linked to this report",
    );
  }
  return errors;
}
