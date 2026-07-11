import assert from "node:assert/strict";
import test from "node:test";

import { pulseConnectorMetricKey } from "./ingest";
import type { PulseConnectorFact } from "./runtime-contract";
import { buildPulseSourceCoverageReport } from "./source-coverage";

const connector = (
  input: Partial<PulseConnectorFact> &
    Pick<PulseConnectorFact, "feedId" | "connectorId" | "sourceIds">,
): PulseConnectorFact => ({
  role: "news",
  status: "active_observed",
  defaultEnabled: true,
  observedInProduction: true,
  activation: "fixture",
  blindSpots: ["fixture limitation"],
  ...input,
});

const counts = (
  connectorId: string,
  values: Partial<
    Record<
      | "fetched"
      | "wouldWrite"
      | "inserted"
      | "skippedDuplicate"
      | "unmatchedCountry"
      | "failed",
      number
    >
  >,
) =>
  Object.fromEntries(
    Object.entries(values).map(([metric, value]) => [
      pulseConnectorMetricKey(
        connectorId,
        metric as Parameters<typeof pulseConnectorMetricKey>[1],
      ),
      value,
    ]),
  );

test("operating, degraded, and inactive states require retrieval evidence", () => {
  const report = buildPulseSourceCoverageReport({
    generatedAt: "2026-07-11T00:00:00.000Z",
    connectors: [
      connector({
        feedId: "gdelt",
        connectorId: "gdelt",
        sourceIds: ["gdelt"],
      }),
      connector({
        feedId: "hrw",
        connectorId: "hrw",
        sourceIds: ["hrw"],
        role: "specialist",
      }),
      connector({
        feedId: "acled",
        connectorId: "acled",
        sourceIds: ["acled"],
        status: "access_gated",
        defaultEnabled: false,
        observedInProduction: false,
      }),
    ],
    runs: [
      {
        id: "run-1",
        status: "partial",
        startedAt: "2026-07-11T00:00:00.000Z",
        completedAt: "2026-07-11T00:01:00.000Z",
        counts: {
          ...counts("gdelt", {
            fetched: 10,
            wouldWrite: 8,
            inserted: 3,
            skippedDuplicate: 5,
            unmatchedCountry: 1,
            failed: 0,
          }),
          ...counts("hrw", { failed: 1 }),
          ...counts("acled", { fetched: 0, failed: 0 }),
        },
      },
    ],
    evidence: [
      {
        sourceId: "gdelt",
        retainedRows: 20,
        lastDataAt: "2026-07-11T00:00:00.000Z",
        languages: ["en", "es"],
        jurisdictionIso3s: ["JPN", "URY"],
        unresolvedJurisdictionRows: 1,
      },
      {
        sourceId: "hrw",
        retainedRows: 4,
        lastDataAt: "2026-07-10T00:00:00.000Z",
        languages: ["und"],
        jurisdictionIso3s: ["JPN"],
        unresolvedJurisdictionRows: 0,
      },
    ],
  });

  assert.deepEqual(report.summary, { operating: 1, degraded: 1, inactive: 1 });
  assert.equal(
    report.feeds.find(({ feedId }) => feedId === "gdelt")?.state,
    "operating",
  );
  const gdelt = report.feeds.find(({ feedId }) => feedId === "gdelt")!;
  assert.deepEqual(gdelt.evidence, {
    retainedRows: 20,
    lastDataAt: "2026-07-11T00:00:00.000Z",
    languages: ["en", "es"],
    observedJurisdictions: 2,
    jurisdictionIso3s: ["JPN", "URY"],
    unresolvedJurisdictionRows: 1,
  });
  assert.equal(
    report.feeds.find(({ feedId }) => feedId === "hrw")?.state,
    "degraded",
  );
  const inactive = report.feeds.find(({ feedId }) => feedId === "acled")!;
  assert.equal(inactive.state, "inactive");
  assert.equal(inactive.retrieval.latestOutcome, "not_observed");
  assert.equal(inactive.retrieval.observedRuns, 0);
});

test("an active connector without telemetry cannot appear operating", () => {
  const report = buildPulseSourceCoverageReport({
    generatedAt: "2026-07-11T00:00:00.000Z",
    connectors: [
      connector({
        feedId: "gdelt",
        connectorId: "gdelt",
        sourceIds: ["gdelt"],
      }),
    ],
    runs: [],
    evidence: [
      {
        sourceId: "gdelt",
        retainedRows: 20,
        lastDataAt: "2026-07-11T00:00:00.000Z",
        languages: ["en"],
        jurisdictionIso3s: ["JPN"],
        unresolvedJurisdictionRows: 0,
      },
    ],
  });
  assert.equal(report.feeds[0].state, "degraded");
  assert.equal(report.feeds[0].retrieval.latestOutcome, "not_observed");
});
