import type { OfficeholderSyncSummary } from "./officeholders-sync";
import type { CiaCabinetSyncSummary } from "./cia-cabinets-sync";
import type { VerificationReport } from "./reconcile/verify-reconciliation-v1";

export interface FactbookCronOutcome {
  ok: boolean;
  outcome: "completed" | "completed_with_findings" | "partial";
  healthOk: boolean;
  httpStatus: 200 | 502 | 503;
  reason?:
    | "incomplete_stage"
    | "no_rows"
    | "source_freshness_not_stamped"
    | "verification_findings";
}

export function ciaCabinetSyncCronOutcome(
  summary: Pick<
    CiaCabinetSyncSummary,
    "skipped" | "totalRowsWritten" | "freshnessStamped" | "dryRun"
  >,
): FactbookCronOutcome {
  if (summary.skipped.length > 0) {
    return {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "incomplete_stage",
    };
  }
  if (summary.totalRowsWritten === 0) {
    return {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "no_rows",
    };
  }
  if (!summary.dryRun && !summary.freshnessStamped) {
    return {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "source_freshness_not_stamped",
    };
  }
  return {
    ok: true,
    outcome: "completed",
    healthOk: true,
    httpStatus: 200,
  };
}

export function officeholderSyncCronOutcome(
  summary: Pick<
    OfficeholderSyncSummary,
    "status" | "countriesSynced" | "totalRowsWritten"
  >,
): FactbookCronOutcome {
  if (summary.status === "partial") {
    return {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "incomplete_stage",
    };
  }
  if (summary.countriesSynced === 0 || summary.totalRowsWritten === 0) {
    return {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "no_rows",
    };
  }
  return {
    ok: true,
    outcome: "completed",
    healthOk: true,
    httpStatus: 200,
  };
}

export function reconciliationVerificationCronOutcome(
  report: Pick<VerificationReport, "overallStatus">,
): FactbookCronOutcome {
  return report.overallStatus === "pass"
    ? {
        ok: true,
        outcome: "completed",
        healthOk: true,
        httpStatus: 200,
      }
    : {
        ok: false,
        outcome: "completed_with_findings",
        healthOk: false,
        httpStatus: 503,
        reason: "verification_findings",
      };
}
