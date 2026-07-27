import { createHash } from "node:crypto";

import { zPulseSourceCoverageReport } from "@/lib/api/contract/schemas";
import { SOURCE_INPUT_SPECS } from "@/lib/data/source-input-manifest";
import { stableStringify } from "@/lib/data/frozen-vintage";
import { sourceRights } from "@/lib/rights/manifest";
import { CURRENT_PULSE_RUNTIME_METHOD } from "./runtime-contract";
import {
  PULSE_SOURCE_COVERAGE_SCHEMA_VERSION,
  type PulseFeedCoverage,
  type PulseSourceCoverageReport,
} from "./source-coverage";

export const PULSE_SOURCE_COVERAGE_AUDIT_VERSION =
  "pulse-source-coverage-audit/v1" as const;
export const PULSE_SOURCE_COVERAGE_AUDIT_SOURCE =
  "production_neon_read_only_pulse_source_coverage" as const;

export interface PulseSourceCoverageAuditBody {
  schemaVersion: typeof PULSE_SOURCE_COVERAGE_AUDIT_VERSION;
  capturedAt: string;
  runtimeMethodVersion: string;
  reportSchemaVersion: typeof PULSE_SOURCE_COVERAGE_SCHEMA_VERSION;
  auditSource: typeof PULSE_SOURCE_COVERAGE_AUDIT_SOURCE;
  readOnly: true;
  writesPerformedByAudit: 0;
  report: PulseSourceCoverageReport;
}

export interface PulseSourceCoverageAudit extends PulseSourceCoverageAuditBody {
  semanticSha256: string;
}

export function pulseSourceCoverageAuditSemanticSha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function buildPulseSourceCoverageAudit(
  report: PulseSourceCoverageReport,
): PulseSourceCoverageAudit {
  const body: PulseSourceCoverageAuditBody = {
    schemaVersion: PULSE_SOURCE_COVERAGE_AUDIT_VERSION,
    capturedAt: report.generatedAt,
    runtimeMethodVersion: CURRENT_PULSE_RUNTIME_METHOD.version,
    reportSchemaVersion: PULSE_SOURCE_COVERAGE_SCHEMA_VERSION,
    auditSource: PULSE_SOURCE_COVERAGE_AUDIT_SOURCE,
    readOnly: true,
    writesPerformedByAudit: 0,
    report,
  };
  return {
    ...body,
    semanticSha256: pulseSourceCoverageAuditSemanticSha256(body),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
  errors: string[],
): void {
  const expectedSet = new Set(expected);
  for (const key of expected) {
    if (!(key in value)) errors.push(`${label} is missing ${key}`);
  }
  for (const key of Object.keys(value)) {
    if (!expectedSet.has(key))
      errors.push(`${label} has unexpected field ${key}`);
  }
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
}

function isUniqueSorted(values: readonly string[]): boolean {
  return (
    new Set(values).size === values.length &&
    values.every((value, index) => index === 0 || values[index - 1] < value)
  );
}

function expectedRights(sourceId: string): PulseFeedCoverage["rights"][number] {
  const record = sourceRights(sourceId);
  const spec = SOURCE_INPUT_SPECS.find((row) => row.sourceId === sourceId);
  if (!record || !spec) {
    return {
      sourceId,
      licenseId: "unregistered",
      termsUrl: null,
      reviewStatus: "missing",
      publicExport: "blocked",
      redistributionPosture: "unregistered",
      restrictions: ["No source-input and rights contract is registered."],
    };
  }
  return {
    sourceId,
    licenseId: record.licenseId,
    termsUrl: record.termsUrl,
    reviewStatus: record.reviewStatus,
    publicExport: record.publicExport,
    redistributionPosture: spec.redistributionPosture,
    restrictions: [...record.restrictions],
  };
}

function expectedState(feed: PulseFeedCoverage): {
  state: PulseFeedCoverage["state"];
  reason: string;
} {
  const connector = CURRENT_PULSE_RUNTIME_METHOD.feeds.connectors.find(
    (row) => row.feedId === feed.feedId,
  );
  if (!connector) return { state: "inactive", reason: "unknown connector" };
  const declaredOperating =
    connector.status === "active_observed" && connector.observedInProduction;
  const rightsComplete = connector.sourceIds.every(
    (sourceId) =>
      sourceRights(sourceId) &&
      SOURCE_INPUT_SPECS.some((row) => row.sourceId === sourceId),
  );
  if (!declaredOperating) {
    return { state: "inactive", reason: connector.activation };
  }
  if (feed.retrieval.observedRuns === 0) {
    return {
      state: "degraded",
      reason: "No connector-level retrieval telemetry has been retained yet.",
    };
  }
  if (feed.retrieval.latestOutcome === "failed") {
    return {
      state: "degraded",
      reason: "The latest observed connector retrieval failed.",
    };
  }
  if (!rightsComplete) {
    return {
      state: "degraded",
      reason: "A complete source-input and rights contract is missing.",
    };
  }
  if (feed.evidence.retainedRows === 0) {
    return {
      state: "degraded",
      reason:
        "The connector ran, but no retained evidence rows establish coverage.",
    };
  }
  return {
    state: "operating",
    reason:
      "The latest connector attempt succeeded and retained evidence exists.",
  };
}

export function pulseSourceCoverageReportErrors(value: unknown): string[] {
  const parsed = zPulseSourceCoverageReport.safeParse(value);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (issue) =>
        `source-coverage report ${issue.path.join(".") || "root"}: ${issue.message}`,
    );
  }

  const report = parsed.data as PulseSourceCoverageReport;
  const errors: string[] = [];
  const connectors = [...CURRENT_PULSE_RUNTIME_METHOD.feeds.connectors].sort(
    (a, b) => a.feedId.localeCompare(b.feedId),
  );
  const feedIds = report.feeds.map((feed) => feed.feedId);
  const expectedFeedIds = connectors.map((connector) => connector.feedId);
  if (!isUniqueSorted(feedIds)) {
    errors.push("feed IDs must be unique and canonically ordered");
  }
  if (stableStringify(feedIds) !== stableStringify(expectedFeedIds)) {
    errors.push("feed IDs do not exactly match the runtime connector registry");
  }

  const generatedAt = Date.parse(report.generatedAt);
  for (const feed of report.feeds) {
    const connector = connectors.find((row) => row.feedId === feed.feedId);
    if (!connector) continue;
    for (const [label, actual, expected] of [
      ["connectorId", feed.connectorId, connector.connectorId],
      ["sourceIds", feed.sourceIds, connector.sourceIds],
      ["role", feed.role, connector.role],
      ["activation", feed.activation, connector.activation],
      ["blindSpots", feed.blindSpots, connector.blindSpots],
    ] as const) {
      if (stableStringify(actual) !== stableStringify(expected)) {
        errors.push(
          `${feed.feedId} ${label} drifted from the runtime contract`,
        );
      }
    }

    const rights = connector.sourceIds.map(expectedRights);
    if (stableStringify(feed.rights) !== stableStringify(rights)) {
      errors.push(`${feed.feedId} rights/source-input posture drifted`);
    }

    const expected = expectedState(feed);
    if (feed.state !== expected.state || feed.stateReason !== expected.reason) {
      errors.push(
        `${feed.feedId} state must derive as ${expected.state} from current evidence`,
      );
    }

    const retrieval = feed.retrieval;
    if (
      retrieval.successfulRuns + retrieval.failedRuns !==
      retrieval.observedRuns
    ) {
      errors.push(`${feed.feedId} retrieval run counts do not reconcile`);
    }
    const latestMetrics = [
      retrieval.latestFetched,
      retrieval.latestYield,
      retrieval.latestInserted,
      retrieval.latestSkippedDuplicate,
      retrieval.latestUnmatchedCountry,
    ];
    if (retrieval.observedRuns === 0) {
      if (
        retrieval.successfulRuns !== 0 ||
        retrieval.failedRuns !== 0 ||
        retrieval.latestAttemptAt !== null ||
        retrieval.latestOutcome !== "not_observed" ||
        latestMetrics.some((value) => value !== null)
      ) {
        errors.push(`${feed.feedId} zero-run telemetry is contradictory`);
      }
    } else {
      if (
        !isCanonicalIsoTimestamp(retrieval.latestAttemptAt) ||
        retrieval.latestOutcome === "not_observed" ||
        latestMetrics.some((value) => value === null)
      ) {
        errors.push(`${feed.feedId} observed-run telemetry is incomplete`);
      }
      if (
        retrieval.latestOutcome === "successful" &&
        retrieval.successfulRuns === 0
      ) {
        errors.push(`${feed.feedId} latest success has no successful run`);
      }
      if (retrieval.latestOutcome === "failed" && retrieval.failedRuns === 0) {
        errors.push(`${feed.feedId} latest failure has no failed run`);
      }
    }

    const evidence = feed.evidence;
    if ((evidence.retainedRows === 0) !== (evidence.lastDataAt === null)) {
      errors.push(`${feed.feedId} retained rows and last-data time disagree`);
    }
    if (evidence.unresolvedJurisdictionRows > evidence.retainedRows) {
      errors.push(`${feed.feedId} unresolved rows exceed retained evidence`);
    }
    if (evidence.observedJurisdictions !== evidence.jurisdictionIso3s.length) {
      errors.push(`${feed.feedId} observed-jurisdiction count drifted`);
    }
    if (!isUniqueSorted(evidence.languages)) {
      errors.push(`${feed.feedId} languages are not unique and ordered`);
    }
    if (
      !isUniqueSorted(evidence.jurisdictionIso3s) ||
      evidence.jurisdictionIso3s.some((iso3) => !/^[A-Z0-9]{3}$/.test(iso3))
    ) {
      errors.push(
        `${feed.feedId} jurisdiction ISO3 values are invalid or unordered`,
      );
    }
    for (const [label, timestamp] of [
      ["latestAttemptAt", retrieval.latestAttemptAt],
      ["lastDataAt", evidence.lastDataAt],
    ] as const) {
      if (
        timestamp !== null &&
        (!isCanonicalIsoTimestamp(timestamp) ||
          Date.parse(timestamp) > generatedAt)
      ) {
        errors.push(
          `${feed.feedId} ${label} is invalid or after report generation`,
        );
      }
    }
  }

  const summary = {
    operating: report.feeds.filter((feed) => feed.state === "operating").length,
    degraded: report.feeds.filter((feed) => feed.state === "degraded").length,
    inactive: report.feeds.filter((feed) => feed.state === "inactive").length,
  };
  if (stableStringify(report.summary) !== stableStringify(summary)) {
    errors.push("summary does not reconcile with feed states");
  }
  return errors;
}

export function pulseSourceCoverageAuditErrors(value: unknown): string[] {
  const errors: string[] = [];
  const audit = asRecord(value);
  if (!audit) return ["source-coverage audit must be an object"];
  exactKeys(
    audit,
    [
      "schemaVersion",
      "capturedAt",
      "runtimeMethodVersion",
      "reportSchemaVersion",
      "auditSource",
      "readOnly",
      "writesPerformedByAudit",
      "report",
      "semanticSha256",
    ],
    "source-coverage audit",
    errors,
  );
  if (audit.schemaVersion !== PULSE_SOURCE_COVERAGE_AUDIT_VERSION) {
    errors.push("source-coverage audit schema version drifted");
  }
  if (audit.runtimeMethodVersion !== CURRENT_PULSE_RUNTIME_METHOD.version) {
    errors.push("source-coverage audit runtime method version drifted");
  }
  if (audit.reportSchemaVersion !== PULSE_SOURCE_COVERAGE_SCHEMA_VERSION) {
    errors.push("source-coverage audit report schema version drifted");
  }
  if (audit.auditSource !== PULSE_SOURCE_COVERAGE_AUDIT_SOURCE) {
    errors.push(
      "source-coverage audit source is not the read-only production audit",
    );
  }
  if (audit.readOnly !== true || audit.writesPerformedByAudit !== 0) {
    errors.push(
      "source-coverage audit must be read-only and perform zero writes",
    );
  }
  if (!isCanonicalIsoTimestamp(audit.capturedAt)) {
    errors.push("source-coverage audit capture time is invalid");
  }
  const report = asRecord(audit.report);
  if (report && audit.capturedAt !== report.generatedAt) {
    errors.push(
      "source-coverage capture time must equal report generation time",
    );
  }
  errors.push(...pulseSourceCoverageReportErrors(audit.report));

  const { semanticSha256, ...body } = audit;
  if (
    typeof semanticSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(semanticSha256)
  ) {
    errors.push("source-coverage audit semantic hash is invalid");
  } else if (semanticSha256 !== pulseSourceCoverageAuditSemanticSha256(body)) {
    errors.push("source-coverage audit semantic hash drifted");
  }
  return [...new Set(errors)];
}
