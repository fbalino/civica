import assert from "node:assert/strict";
import test from "node:test";

import { buildPulseSourceCoverageReport } from "@/lib/pulse/v2/source-coverage";
import { zPulseSourceCoverageResponse } from "./schemas";

test("source-coverage API contract preserves explicit non-operating states", () => {
  const report = buildPulseSourceCoverageReport({
    generatedAt: "2026-07-11T00:00:00.000Z",
    connectors: [
      {
        feedId: "placeholder",
        connectorId: "placeholder",
        sourceIds: [],
        role: "specialist",
        status: "placeholder",
        defaultEnabled: true,
        observedInProduction: false,
        activation: "Fixture placeholder",
        blindSpots: ["Supplies no retrieval coverage."],
      },
    ],
    runs: [],
    evidence: [],
  });
  const response = zPulseSourceCoverageResponse.parse({ data: report });
  assert.equal(response.data.feeds[0].state, "inactive");
  assert.equal(response.data.feeds[0].retrieval.latestOutcome, "not_observed");
  assert.equal(
    response.data.standing,
    "operational_observability_not_retrieval_validation",
  );
  assert.equal(response.data.summary.operating, 0);
  assert.equal(response.data.feeds[0].evidence.retainedRows, 0);
  assert.equal(response.data.feeds[0].evidence.observedJurisdictions, 0);
  assert.deepEqual(response.data.feeds[0].evidence.jurisdictionIso3s, []);
  assert.equal(response.data.feeds[0].evidence.unresolvedJurisdictionRows, 0);
});
