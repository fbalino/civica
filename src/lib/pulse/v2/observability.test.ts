import assert from "node:assert/strict";
import test from "node:test";

import type { PulseFeedCoverage } from "./source-coverage";
import { buildPulseCountryPeriodObservability } from "./observability";

function feed(
  feedId: string,
  state: PulseFeedCoverage["state"],
  latestOutcome: PulseFeedCoverage["retrieval"]["latestOutcome"] = state ===
  "operating"
    ? "successful"
    : "not_observed",
): PulseFeedCoverage {
  return {
    feedId,
    connectorId: feedId,
    sourceIds: [feedId],
    role: "news",
    state,
    stateReason: "fixture",
    retrieval: {
      observedRuns: latestOutcome === "not_observed" ? 0 : 1,
      successfulRuns: latestOutcome === "successful" ? 1 : 0,
      failedRuns: latestOutcome === "failed" ? 1 : 0,
      latestAttemptAt: null,
      latestOutcome,
      latestFetched: null,
      latestYield: null,
      latestInserted: null,
      latestSkippedDuplicate: null,
      latestUnmatchedCountry: null,
    },
    evidence: {
      retainedRows: 1,
      lastDataAt: null,
      languages: ["en"],
      observedJurisdictions: 1,
      jurisdictionIso3s: ["JPN"],
      unresolvedJurisdictionRows: 0,
    },
    rights: [],
    activation: "fixture",
    blindSpots: ["fixture"],
  };
}

const base = {
  periodStart: "2026-01-01",
  periodEnd: "2026-07-11",
  feeds: [feed("gdelt", "operating"), feed("hrw", "operating")],
  sourceCounts: [
    { sourceId: "gdelt", retainedDocuments: 4 },
    { sourceId: "hrw", retainedDocuments: 1 },
  ],
  qualifyingEvents: 0,
};

test("sufficient observation can state no qualifying event without a numeric effect", () => {
  const result = buildPulseCountryPeriodObservability(base);
  assert.equal(result.observationState, "sufficient_observation");
  assert.equal(result.eventObservation, "no_qualifying_event_observed");
  assert.equal(result.numericEffect, "withheld");
  assert.equal(result.countryQualityInference, "prohibited");
});

test("low country-period coverage remains not assessable", () => {
  const result = buildPulseCountryPeriodObservability({
    ...base,
    sourceCounts: [{ sourceId: "gdelt", retainedDocuments: 20 }],
  });
  assert.equal(result.observationState, "low_coverage");
  assert.equal(result.eventObservation, "not_assessable");
  assert.equal(result.numericEffect, "withheld");
});

test("a failed source basket is an outage, not an empty stable period", () => {
  const result = buildPulseCountryPeriodObservability({
    ...base,
    feeds: [feed("gdelt", "degraded", "failed")],
    sourceCounts: [],
  });
  assert.equal(result.observationState, "source_outage");
  assert.equal(result.eventObservation, "not_assessable");
});

test("restricted information requires explicit sourced context", () => {
  const result = buildPulseCountryPeriodObservability({
    ...base,
    informationEnvironment: {
      state: "restricted",
      sourceId: "future-official-context",
      sourceUrl: "https://example.org/context",
      upstreamVersion: "2026",
      observationYear: 2026,
      retrievedAt: "2026-07-01T00:00:00.000Z",
    },
  });
  assert.equal(result.observationState, "restricted_information_environment");
  assert.equal(result.eventObservation, "not_assessable");
});

test("an observed event remains event evidence even under low coverage", () => {
  const result = buildPulseCountryPeriodObservability({
    ...base,
    sourceCounts: [{ sourceId: "gdelt", retainedDocuments: 1 }],
    qualifyingEvents: 1,
  });
  assert.equal(result.observationState, "low_coverage");
  assert.equal(result.eventObservation, "qualifying_event_observed");
  assert.equal(result.numericEffect, "event_evidence_only");
  assert.equal(result.countryQualityInference, "prohibited");
});
