import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  pulseSourceCoverageAuditErrors,
  pulseSourceCoverageAuditSemanticSha256,
  type PulseSourceCoverageAudit,
} from "./source-coverage-audit";

const CHECKED_PATH =
  "plan/evidence/PUL-040/source-coverage-audit-2026-08-17.json";
const checked = JSON.parse(
  readFileSync(CHECKED_PATH, "utf8"),
) as PulseSourceCoverageAudit;

function clone(): PulseSourceCoverageAudit {
  return structuredClone(checked);
}

function reseal(audit: PulseSourceCoverageAudit): PulseSourceCoverageAudit {
  const body = { ...audit } as Record<string, unknown>;
  delete body.semanticSha256;
  audit.semanticSha256 = pulseSourceCoverageAuditSemanticSha256(body);
  return audit;
}

function rejected(audit: PulseSourceCoverageAudit, fragment: string): void {
  assert.ok(
    pulseSourceCoverageAuditErrors(audit).some((error) =>
      error.includes(fragment),
    ),
    `expected an error containing ${JSON.stringify(fragment)}`,
  );
}

test("the checked dated source-coverage audit is internally valid", () => {
  assert.deepEqual(pulseSourceCoverageAuditErrors(checked), []);
});

test("an ordinary mutation fails the semantic hash", () => {
  const audit = clone();
  audit.report.summary.operating += 1;
  rejected(audit, "semantic hash drifted");
});

test("resealing cannot hide extra fields or wrapper provenance drift", () => {
  const extra = clone();
  (extra.report as unknown as Record<string, unknown>).invented = true;
  rejected(reseal(extra), "Unrecognized key");

  for (const mutate of [
    (audit: PulseSourceCoverageAudit) => {
      audit.readOnly = false as true;
    },
    (audit: PulseSourceCoverageAudit) => {
      audit.writesPerformedByAudit = 1 as 0;
    },
    (audit: PulseSourceCoverageAudit) => {
      audit.runtimeMethodVersion = "pulse-v0-invented";
    },
    (audit: PulseSourceCoverageAudit) => {
      audit.auditSource = "unknown" as typeof audit.auditSource;
    },
  ]) {
    const audit = clone();
    mutate(audit);
    assert.ok(pulseSourceCoverageAuditErrors(reseal(audit)).length > 0);
  }
});

test("duplicate feeds cannot replace a missing runtime connector", () => {
  const audit = clone();
  audit.report.feeds[audit.report.feeds.length - 1] = structuredClone(
    audit.report.feeds[0],
  );
  rejected(reseal(audit), "feed IDs");
});

test("runtime connector and exact rights posture drift fail closed", () => {
  const connector = clone();
  connector.report.feeds.find(
    (feed) => feed.feedId === "amnesty",
  )!.connectorId = "substitute";
  rejected(reseal(connector), "connectorId drifted");

  const rights = clone();
  rights.report.feeds.find(
    (feed) => feed.feedId === "amnesty",
  )!.rights[0].restrictions = ["invented permission"];
  rejected(reseal(rights), "rights/source-input posture drifted");
});

test("state, telemetry, evidence, summary, and time contradictions fail", () => {
  const state = clone();
  const hrw = state.report.feeds.find((feed) => feed.feedId === "hrw")!;
  hrw.state = "degraded";
  hrw.stateReason =
    "No connector-level retrieval telemetry has been retained yet.";
  rejected(reseal(state), "state must derive as operating");

  const retrieval = clone();
  retrieval.report.feeds.find(
    (feed) => feed.feedId === "hrw",
  )!.retrieval.latestFetched = null;
  rejected(reseal(retrieval), "observed-run telemetry is incomplete");

  const evidence = clone();
  evidence.report.feeds.find(
    (feed) => feed.feedId === "hrw",
  )!.evidence.retainedRows = 0;
  rejected(reseal(evidence), "retained rows and last-data time disagree");

  const summary = clone();
  summary.report.summary.degraded += 1;
  rejected(reseal(summary), "summary does not reconcile");

  const time = clone();
  time.capturedAt = "2026-07-01T00:00:00.000Z";
  time.report.generatedAt = time.capturedAt;
  rejected(reseal(time), "after report generation");
});

test("a coherent later live state may differ from the dated snapshot", () => {
  const audit = clone();
  const gdelt = audit.report.feeds.find((feed) => feed.feedId === "gdelt")!;
  gdelt.retrieval.successfulRuns = gdelt.retrieval.observedRuns;
  gdelt.retrieval.failedRuns = 0;
  gdelt.retrieval.latestOutcome = "successful";
  gdelt.state = "operating";
  gdelt.stateReason =
    "The latest connector attempt succeeded and retained evidence exists.";
  audit.report.summary.operating += 1;
  audit.report.summary.degraded -= 1;

  assert.deepEqual(pulseSourceCoverageAuditErrors(reseal(audit)), []);
});
