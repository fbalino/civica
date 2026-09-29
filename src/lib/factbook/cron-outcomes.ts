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

/**
 * DAT-037: a CIA roster run succeeds when every crawled country was verified
 * without a skip, even when nothing changed. Unchanged rosters write zero rows
 * and correctly leave freshness alone; only a run that changed rows must also
 * have stamped freshness.
 */
export function ciaCabinetSyncCronOutcome(
  summary: Pick<
    CiaCabinetSyncSummary,
    | "skipped"
    | "totalRowsWritten"
    | "freshnessStamped"
    | "dryRun"
    | "countriesVerified"
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
  if (summary.countriesVerified === 0) {
    return {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "no_rows",
    };
  }
  if (
    !summary.dryRun &&
    summary.totalRowsWritten > 0 &&
    !summary.freshnessStamped
  ) {
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
  if (report.overallStatus === "pass") {
    return {
      ok: true,
      outcome: "completed",
      healthOk: true,
      httpStatus: 200,
    };
  }
  if (report.overallStatus === "warn") {
    // The pre-launch verifier defines warnings as advisory findings. Preserve
    // that unhealthy signal without turning a completed check into a failed
    // execution; strict release-quality validation remains a separate gate.
    return {
      ok: true,
      outcome: "completed_with_findings",
      healthOk: false,
      httpStatus: 200,
      reason: "verification_findings",
    };
  }
  return {
    ok: false,
    outcome: "completed_with_findings",
    healthOk: false,
    httpStatus: 503,
    reason: "verification_findings",
  };
}
