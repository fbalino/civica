import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeEconomicStabilityConstruct,
  economicStabilityConstructStudyErrors,
  type EconomicStabilityConstructStudyInput,
} from "../economic-construct";

function fixture(): EconomicStabilityConstructStudyInput {
  const jurisdictions = ["alpha", "bravo", "charlie", "delta"];
  const observations = jurisdictions.flatMap((jurisdiction, index) =>
    Array.from({ length: 10 }, (_, offset) => {
      const year = 2015 + offset;
      const recovery = jurisdiction === "alpha" ? [-5, -2, 1, 5, 6, 4, 3, 2, 2, 2][offset] : 0;
      const boom = jurisdiction === "bravo" ? [3, 5, 8, 11, 7, 3, 1, 4, 6, 2][offset] : 0;
      return {
        jurisdictionId: jurisdiction,
        year,
        inflation: 1.5 + index + (offset % 3) * 0.4,
        unemployment: 3 + index * 1.2 + (offset % 2) * 0.3,
        gdpGrowth: 1.5 + index * 0.4 + recovery + boom,
      };
    }),
  );
  return {
    schemaVersion: "economic-stability-construct-study/v1",
    studyId: "atl-028-fixture-v1",
    conditionsReleaseId: "conditions-economic-fixture-v1",
    conditionsReleaseManifestSha256: "a".repeat(64),
    sourceInputManifestSha256: "b".repeat(64),
    methodologyVersion: "conditions-components/v1",
    analysisYear: 2024,
    observations,
    nativeBaseline: {
      sourceId: "worldbank_economic",
      inflationIndicatorId: "FP.CPI.TOTL.ZG",
      unemploymentIndicatorId: "SL.UEM.TOTL.ZS",
      gdpGrowthIndicatorId: "NY.GDP.MKTP.KD.ZG",
    },
    externalVolatilityBaseline: {
      sourceId: "external-volatility-fixture",
      indicatorId: "growth-volatility",
      sourceUrl: "https://example.test/volatility",
      artifactHash: "c".repeat(64),
      values: [
        { jurisdictionId: "alpha", year: 2024, value: 4.2 },
        { jurisdictionId: "bravo", year: 2024, value: 3.7 },
        { jurisdictionId: "charlie", year: 2024, value: 0.4 },
        { jurisdictionId: "delta", year: 2024, value: 0.5 },
      ],
    },
    counterexamples: [
      { id: "fixture-recovery", jurisdictionId: "alpha", kind: "recovery", rationaleUrl: "https://example.test/recovery" },
      { id: "fixture-boom", jurisdictionId: "bravo", kind: "boom", rationaleUrl: "https://example.test/boom" },
    ],
  };
}

test("economic construct study is order-independent and never authorizes a composite", () => {
  const input = fixture();
  const first = analyzeEconomicStabilityConstruct(input);
  const second = analyzeEconomicStabilityConstruct({
    ...input,
    observations: [...input.observations].reverse(),
    counterexamples: [...input.counterexamples].reverse(),
  });

  assert.deepEqual(second, first);
  assert.equal(first.resolution.publicPresentation, "source_native_separate_indicators");
  assert.equal(first.resolution.compositeStatus, "not_authorized");
  assert.equal(first.coverage.currentYearJurisdictions, 4);
  assert.deepEqual(first.coverage.longitudinal, [
    { windowYears: 5, jurisdictions: 4 },
    { windowYears: 10, jurisdictions: 4 },
  ]);
  assert.equal(first.externalVolatilityComparison.status, "compared");
  assert.equal(first.counterexamples[0].growthVolatility5Year !== null, true);
  assert.equal(first.legacyAnnualBenchmark.rows.length, 4);
  assert.equal(first.legacyAnnualBenchmark.rankCorrelationWithCurrentGrowth !== null, true);
});

test("economic construct study refuses an undocumented counterexample set", () => {
  const input = fixture();
  const incomplete = { ...input, counterexamples: input.counterexamples.filter((row) => row.kind !== "boom") };
  assert.match(
    economicStabilityConstructStudyErrors(incomplete).join(" "),
    /documented boom counterexample/,
  );
  assert.throws(() => analyzeEconomicStabilityConstruct(incomplete), /Invalid economic stability construct study/);
});
