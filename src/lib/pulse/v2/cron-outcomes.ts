import type { ClassifySummary } from "./classify";
import type { ClusterRunSummary } from "./cluster";
import type { IngestSummary } from "./ingest";
import type { PulseReviewSlaReport } from "./review-sla-store";

export interface PulseCronOutcome {
  ok: boolean;
  outcome: "completed" | "completed_with_findings" | "partial" | "blocked";
  httpStatus: 200 | 502 | 503;
}

export interface PulseIngestCronOutcome extends PulseCronOutcome {
  failedConnectors: string[];
}

export function pulseV2IngestCronOutcome(
  summary: Pick<IngestSummary, "reports">,
): PulseIngestCronOutcome {
  const failedConnectors = summary.reports
    .filter((report) => report.error !== undefined)
    .map((report) => report.source)
    .sort();
  return failedConnectors.length > 0
    ? { ok: false, outcome: "partial", httpStatus: 502, failedConnectors }
    : { ok: true, outcome: "completed", httpStatus: 200, failedConnectors };
}

export function pulseV2ClusterCronOutcome(
  summary: Pick<ClusterRunSummary, "status">,
): PulseCronOutcome {
  return summary.status === "partial"
    ? { ok: false, outcome: "partial", httpStatus: 503 }
    : { ok: true, outcome: "completed", httpStatus: 200 };
}

export interface PulseClassifyCronOutcome extends PulseCronOutcome {
  reason?: "provider_key_absent" | "classification_failures";
}

export function pulseV2ClassifyCronOutcome(input: {
  missingProviders?: readonly string[];
  summary?: Pick<ClassifySummary, "failed">;
}): PulseClassifyCronOutcome {
  if (input.missingProviders?.length) {
    return {
      ok: false,
      outcome: "blocked",
      httpStatus: 503,
      reason: "provider_key_absent",
    };
  }
  if (!input.summary) {
    throw new Error(
      "A classification summary is required when provider credentials are present",
    );
  }
  return input.summary.failed > 0
    ? {
        ok: false,
        outcome: "partial",
        httpStatus: 502,
        reason: "classification_failures",
      }
    : { ok: true, outcome: "completed", httpStatus: 200 };
}

export interface PulseReviewSlaCronOutcome extends PulseCronOutcome {
  ok: true;
  healthOk: boolean;
  httpStatus: 200;
}

export function pulseV2ReviewSlaCronOutcome(
  report: Pick<
    PulseReviewSlaReport,
    "breachedUnexcepted" | "breachedExcepted" | "escalationDue"
  >,
): PulseReviewSlaCronOutcome {
  const healthOk =
    report.breachedUnexcepted === 0 &&
    report.breachedExcepted === 0 &&
    report.escalationDue === 0;
  return {
    ok: true,
    outcome: healthOk ? "completed" : "completed_with_findings",
    healthOk,
    httpStatus: 200,
  };
}
