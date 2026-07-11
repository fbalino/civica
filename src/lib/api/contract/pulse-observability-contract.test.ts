import assert from "node:assert/strict";
import test from "node:test";

import { zPulseDimensionsData } from "./schemas";

function fixture() {
  return {
    jurisdiction: {
      id: "jur-jpn",
      slug: "japan",
      name: "Japan",
      iso3: "JPN",
    },
    dimensions: {
      stability: {
        dimension: "stability",
        delta: null,
        contributingEventIds: [],
        drivingEvents: [],
        evidence: {
          nEvents: 0,
          maxConfidence: 0,
          minSources: 0,
          maxSources: 0,
          allSingleSource: false,
        },
        limitedSignal: false,
        limitedReason: null,
        versionIdentity: null,
      },
    },
    lastComputedAt: null,
    totalEvents: 0,
    observability: {
      schemaVersion: "pulse-observability/country-period-v1",
      period: {
        start: "2025-07-11",
        end: "2026-07-11",
        basis: "retrieval_time",
      },
      observationState: "sufficient_observation",
      eventObservation: "no_qualifying_event_observed",
      stateReason: "fixture",
      evidence: {
        operatingFeeds: 4,
        degradedFeeds: 0,
        observedFeedFamilies: ["gdelt", "hrw"],
        retainedDocuments: 7,
        qualifyingEvents: 0,
        informationEnvironment: null,
      },
      thresholds: {
        minimumObservedFeedFamilies: 2,
        minimumRetainedDocuments: 5,
      },
      numericEffect: "withheld",
      countryQualityInference: "prohibited",
      limitations: ["fixture"],
    },
    informationEnvironmentContext: {
      schemaVersion: "pulse-information-environment-context/v1",
      valueStatus: "missing",
      score: null,
      tier: null,
      sourceId: null,
      sourceUrl: null,
      upstreamRelease: null,
      observationYear: null,
      retrievedAt: null,
      contentSha256: null,
      sourceCoverage: {
        publisherRows: null,
        matchedJurisdictions: null,
        supportedJurisdictions: null,
      },
      rightsStatus: "not_registered",
      useStatus: "not_available",
      missingReason: "fixture",
    },
    versionSet: {
      state: "empty",
      versionKeys: [],
      containsLegacy: false,
      comparableAsSingleSeries: false,
    },
  };
}

test("a sufficiently observed no-event period remains nonnumeric", () => {
  assert.equal(zPulseDimensionsData.safeParse(fixture()).success, true);
});

test("missing information context cannot contain a substituted score", () => {
  const input = structuredClone(fixture());
  (input.informationEnvironmentContext as { score: number | null }).score = 50;
  const result = zPulseDimensionsData.safeParse(input);
  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error?.issues), /substituted observation/);
});

test("an absent event cannot leak a zero delta", () => {
  const input = structuredClone(fixture());
  (input.dimensions.stability as { delta: number | null }).delta = 0;
  const result = zPulseDimensionsData.safeParse(input);
  assert.equal(result.success, false);
  assert.match(
    JSON.stringify(result.error?.issues),
    /cannot emit a numeric delta/,
  );
});

test("low observation cannot claim no qualifying event observed", () => {
  const input = structuredClone(fixture());
  (input.observability as { observationState: string }).observationState =
    "low_coverage";
  const result = zPulseDimensionsData.safeParse(input);
  assert.equal(result.success, false);
  assert.match(
    JSON.stringify(result.error?.issues),
    /requires sufficient observation/,
  );
});
