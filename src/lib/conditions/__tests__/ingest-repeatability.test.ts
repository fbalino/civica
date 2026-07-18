import assert from "node:assert/strict";
import test from "node:test";

import {
  CONDITIONS_ALIGNMENT_POLICY,
  conditionCalculationKey,
  type ConditionScoreInput,
} from "../contract";
import {
  buildEconomicConditionsCalculations,
  buildEconomicReferenceSets,
} from "../economic";
import { writeConditionScores } from "../ingest";
import {
  conditionsReleaseErrors,
  conditionsReleaseManifestSha256,
} from "../release";

function oneInput(): ConditionScoreInput {
  const base = {
    releaseId: "conditions-fixture-v1",
    jurisdictionId: "jurisdiction-1",
    dimension: "human_development" as const,
    quarter: "2024-Q4",
    normalizedScore: 92.9,
    rawValue: 0.929,
    sourceId: "undp_hdi",
    datasetYear: 2024,
    methodologyVersion: "conditions-components/v1",
    referenceYear: 2024,
    alignmentPolicy: CONDITIONS_ALIGNMENT_POLICY,
    alignmentStatus: "aligned" as const,
    components: [{
      componentId: "hdi" as const,
      sourceId: "undp_hdi",
      nativeValue: 0.929,
      nativeUnit: "index_0_1",
      referenceYear: 2024,
      valueStatus: "observed" as const,
      valueStatusReason: null,
      inclusionDecision: "included" as const,
      indicatorId: "hdi",
      upstreamRelease: "fixture",
      artifactHash: "a".repeat(64),
      artifactKind: "normalized_batch" as const,
      temporalCoverage: "2024",
      licenseUrl: "https://example.test/terms",
      transformationId: "fixture-component/v1",
      substitutionReason: null,
      methodVersion: "conditions-components/v1",
    }],
    indicatorId: "hdi",
    upstreamRelease: "fixture",
    artifactHash: "a".repeat(64),
    artifactKind: "normalized_batch" as const,
    temporalCoverage: "2024",
    licenseUrl: "https://example.test/terms",
    transformationId: "fixture-score/v1",
    substitutionReason: null,
    methodVersion: "conditions-components/v1",
  };
  return { ...base, calculationKey: conditionCalculationKey(base) };
}

function harness() {
  const rows = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoUpdate: async () => {
          const key = "componentId" in value
            ? `component:${value.calculationKey}:${value.componentId}`
            : "alignmentStatus" in value
              ? `calculation:${value.calculationKey}`
              : `score:${value.jurisdictionId}:${value.dimension}:${value.quarter}`;
          rows.set(key, structuredClone(value));
          writes += 1;
        },
      }),
    }),
  };
  return { db: db as never, rows, writes: () => writes };
}
const markSynced = (async () => []) as never;

test("Conditions fixture applications converge on one calculation, component, and score", async () => {
  const state = harness();
  const fixture = oneInput();
  await writeConditionScores(state.db, [fixture], { markSynced });
  const first = structuredClone([...state.rows]);
  await writeConditionScores(state.db, [fixture], { markSynced });
  assert.deepEqual([...state.rows], first);
  assert.equal(state.rows.size, 3);
});

test("Conditions dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const fixture = oneInput();
  const first = await writeConditionScores(state.db, [fixture], { dryRun: true, markSynced });
  const second = await writeConditionScores(state.db, [fixture], { dryRun: true, markSynced });
  assert.deepEqual(first, second);
  assert.equal(state.writes(), 0);
});

test("Conditions malformed or duplicate input fails before writes and freshness", async () => {
  const state = harness();
  let stamps = 0;
  const mark = (async () => { stamps += 1; return []; }) as never;
  const fixture = oneInput();
  await assert.rejects(
    writeConditionScores(state.db, [{ ...fixture, normalizedScore: Number.NaN }], { markSynced: mark }),
    /Invalid Conditions calculation/,
  );
  await assert.rejects(
    writeConditionScores(state.db, [fixture, fixture], { markSynced: mark }),
    /Duplicate Conditions calculation/,
  );
  assert.equal(state.writes(), 0);
  assert.equal(stamps, 0);
});

function economicLineages() {
  const common = {
    upstreamRelease: "fixture",
    artifactHash: "c".repeat(64),
    artifactKind: "normalized_batch" as const,
    temporalCoverage: "2023/2024",
    licenseUrl: "https://example.test/terms",
    substitutionReason: null,
    methodVersion: "conditions-components/v1",
  };
  return {
    score: {
      ...common,
      indicatorId: "FP.CPI.TOTL.ZG+SL.UEM.TOTL.ZS+NY.GDP.MKTP.KD.ZG",
      transformationId: "economic-score-fixture/v1",
    },
    components: {
      inflation: { ...common, indicatorId: "FP.CPI.TOTL.ZG", transformationId: "economic-component-fixture/v1" },
      unemployment: { ...common, indicatorId: "SL.UEM.TOTL.ZS", transformationId: "economic-component-fixture/v1" },
      gdp_growth: { ...common, indicatorId: "NY.GDP.MKTP.KD.ZG", transformationId: "economic-component-fixture/v1" },
    },
  };
}

test("Economic Conditions refuses mixed-year component inputs instead of labelling by the newest year", () => {
  const rows = buildEconomicConditionsCalculations({
    releaseId: "conditions-fixture-v1",
    methodologyVersion: "conditions-components/v1",
    lineages: economicLineages(),
    observations: [{
      jurisdictionId: "mixed-year",
      inflation: { value: 3.1, referenceYear: 2024, valueStatus: "observed", valueStatusReason: null },
      unemployment: { value: 5.2, referenceYear: 2023, valueStatus: "observed", valueStatusReason: null },
      gdpGrowth: { value: 2.4, referenceYear: 2024, valueStatus: "observed", valueStatusReason: null },
    }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].alignmentStatus, "mixed_year_refused");
  assert.equal(rows[0].normalizedScore, null);
  assert.equal(rows[0].referenceYear, null);
  assert.deepEqual(
    rows[0].components.map((component) => component.inclusionDecision),
    ["refused_mixed_year", "refused_mixed_year", "refused_mixed_year"],
  );
});

test("Economic Conditions retains an absent component and withholds the score", () => {
  const rows = buildEconomicConditionsCalculations({
    releaseId: "conditions-fixture-v1",
    methodologyVersion: "conditions-components/v1",
    lineages: economicLineages(),
    observations: [{
      jurisdictionId: "missing-component",
      inflation: { value: 3.1, referenceYear: 2024, valueStatus: "observed", valueStatusReason: null },
      unemployment: { value: null, referenceYear: null, valueStatus: "not_observed", valueStatusReason: "No published value" },
      gdpGrowth: { value: 2.4, referenceYear: 2024, valueStatus: "observed", valueStatusReason: null },
    }],
  });
  assert.equal(rows[0].alignmentStatus, "missing_component");
  assert.equal(rows[0].normalizedScore, null);
  assert.equal(rows[0].components[1].valueStatus, "not_observed");
  assert.equal(rows[0].components[1].valueStatusReason, "No published value");
});

test("Economic Conditions freezes separate source-native populations per year without a score transform", () => {
  const observations = [
    {
      jurisdictionId: "y2023-a",
      inflation: { value: 2, referenceYear: 2023, valueStatus: "observed" as const, valueStatusReason: null },
      unemployment: { value: 4, referenceYear: 2023, valueStatus: "observed" as const, valueStatusReason: null },
      gdpGrowth: { value: 1, referenceYear: 2023, valueStatus: "observed" as const, valueStatusReason: null },
    },
    {
      jurisdictionId: "y2023-b",
      inflation: { value: 6, referenceYear: 2023, valueStatus: "observed" as const, valueStatusReason: null },
      unemployment: { value: 8, referenceYear: 2023, valueStatus: "observed" as const, valueStatusReason: null },
      gdpGrowth: { value: 3, referenceYear: 2023, valueStatus: "observed" as const, valueStatusReason: null },
    },
    {
      jurisdictionId: "y2024-a",
      inflation: { value: 20, referenceYear: 2024, valueStatus: "observed" as const, valueStatusReason: null },
      unemployment: { value: 10, referenceYear: 2024, valueStatus: "observed" as const, valueStatusReason: null },
      gdpGrowth: { value: 5, referenceYear: 2024, valueStatus: "observed" as const, valueStatusReason: null },
    },
  ];
  const referenceSets = buildEconomicReferenceSets(observations);
  assert.deepEqual(referenceSets.map((set) => set.referencePeriod), ["2023-Q4", "2024-Q4"]);
  assert.deepEqual(referenceSets[0].jurisdictionIds, ["y2023-a", "y2023-b"]);
  assert.deepEqual(referenceSets[1].jurisdictionIds, ["y2024-a"]);
  assert.deepEqual(
    referenceSets[0].parameters.map((parameter) => ({
      direction: parameter.direction,
      transformationId: parameter.transformationId,
      mean: parameter.mean,
      standardDeviation: parameter.standardDeviation,
    })),
    [
      { direction: "not_ranked", transformationId: "conditions-economic-source-native/v1", mean: null, standardDeviation: null },
      { direction: "not_ranked", transformationId: "conditions-economic-source-native/v1", mean: null, standardDeviation: null },
      { direction: "not_ranked", transformationId: "conditions-economic-source-native/v1", mean: null, standardDeviation: null },
    ],
  );
});

test("Economic Conditions preserves aligned source inputs while withholding an unvalidated score", () => {
  const rows = buildEconomicConditionsCalculations({
    releaseId: "conditions-economic-fixture-v1",
    methodologyVersion: "conditions-components/v1",
    lineages: economicLineages(),
    observations: [{
      jurisdictionId: "aligned-source-native",
      inflation: { value: 3.1, referenceYear: 2024, valueStatus: "observed", valueStatusReason: null },
      unemployment: { value: 5.2, referenceYear: 2024, valueStatus: "observed", valueStatusReason: null },
      gdpGrowth: { value: 2.4, referenceYear: 2024, valueStatus: "observed", valueStatusReason: null },
    }],
  });
  assert.equal(rows[0].alignmentStatus, "aligned");
  assert.equal(rows[0].normalizedScore, null);
  assert.equal(rows[0].rawValue, null);
  assert.equal(rows[0].referenceYear, 2024);
});

test("Conditions release manifest is order-independent and rejects an unbound calculation", () => {
  const observations = [
    {
      jurisdictionId: "release-fixture",
      inflation: { value: 3, referenceYear: 2024, valueStatus: "observed" as const, valueStatusReason: null },
      unemployment: { value: 5, referenceYear: 2024, valueStatus: "observed" as const, valueStatusReason: null },
      gdpGrowth: { value: 2, referenceYear: 2024, valueStatus: "observed" as const, valueStatusReason: null },
    },
  ];
  const calculations = buildEconomicConditionsCalculations({
    releaseId: "conditions-economic-fixture-v1",
    methodologyVersion: "conditions-components/v1",
    lineages: economicLineages(),
    observations,
  });
  const release = {
    releaseId: "conditions-economic-fixture-v1",
    methodologyVersion: "conditions-components/v1",
    referenceSets: buildEconomicReferenceSets(observations),
  } as const;
  assert.deepEqual(conditionsReleaseErrors(release, calculations), []);
  assert.equal(
    conditionsReleaseManifestSha256(release, calculations),
    conditionsReleaseManifestSha256(release, [...calculations].reverse()),
  );
  assert.match(
    conditionsReleaseErrors(
      release,
      calculations.map((calculation) => ({ ...calculation, releaseId: "conditions-other-v1" })),
    ).join(" "),
    /releaseId does not match/,
  );
});
