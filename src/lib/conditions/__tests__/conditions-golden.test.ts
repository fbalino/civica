/** QA-007 — Conditions golden: native components, no cross-dimension score. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CONDITIONS_ALIGNMENT_POLICY,
  conditionCalculationKey,
  type ConditionScoreInput,
} from "../contract";
import { writeConditionScores } from "../ingest";

function fixture(
  dimension: "human_development" | "peace_security",
  input: { rawValue: number; normalizedScore: number; sourceId: string; indicatorId: string },
): ConditionScoreInput {
  const componentId: "hdi" | "global_peace_index" = dimension === "human_development"
    ? "hdi"
    : "global_peace_index";
  const base = {
    jurisdictionId: "j-golden",
    dimension,
    quarter: "2024-Q4",
    normalizedScore: input.normalizedScore,
    rawValue: input.rawValue,
    sourceId: input.sourceId,
    datasetYear: 2024,
    methodologyVersion: "conditions-components/v1",
    referenceYear: 2024,
    alignmentPolicy: CONDITIONS_ALIGNMENT_POLICY,
    alignmentStatus: "aligned" as const,
    components: [
      {
        componentId,
        sourceId: input.sourceId,
        nativeValue: input.rawValue,
        nativeUnit: dimension === "human_development" ? "index_0_1" : "index_1_5_inverted",
        referenceYear: 2024,
        valueStatus: "observed" as const,
        valueStatusReason: null,
        inclusionDecision: "included" as const,
        indicatorId: input.indicatorId,
        upstreamRelease: "fixture",
        artifactHash: input.indicatorId.startsWith("h") ? "a".repeat(64) : "b".repeat(64),
        artifactKind: "normalized_batch" as const,
        temporalCoverage: "2024",
        licenseUrl: "https://example.test/terms",
        transformationId: "fixture-component/v1",
        substitutionReason: null,
        methodVersion: "conditions-components/v1",
      },
    ],
    indicatorId: input.indicatorId,
    upstreamRelease: "fixture",
    artifactHash: input.indicatorId.startsWith("h") ? "a".repeat(64) : "b".repeat(64),
    artifactKind: "normalized_batch" as const,
    temporalCoverage: "2024",
    licenseUrl: "https://example.test/terms",
    transformationId: "fixture-score/v1",
    substitutionReason: null,
    methodVersion: "conditions-components/v1",
  };
  return { ...base, calculationKey: conditionCalculationKey(base) };
}

const GOLDEN_INPUTS = [
  fixture("human_development", {
    rawValue: 0.929,
    normalizedScore: 92.9,
    sourceId: "undp_hdi",
    indicatorId: "hdi",
  }),
  fixture("peace_security", {
    rawValue: 3.34,
    normalizedScore: 41.5,
    sourceId: "global_peace_index",
    indicatorId: "GPI_SCORE",
  }),
];

function harness() {
  const scores = new Map<string, Record<string, unknown>>();
  const calculations = new Map<string, Record<string, unknown>>();
  const components = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoUpdate: async () => {
          const target = "componentId" in value
            ? components
            : "alignmentStatus" in value
              ? calculations
              : scores;
          const key = "componentId" in value
            ? `${value.calculationKey}:${value.componentId}`
            : "alignmentStatus" in value
              ? String(value.calculationKey)
              : `${value.jurisdictionId}:${value.dimension}:${value.quarter}:${value.methodologyVersion}:${value.sourceId}:${value.indicatorId}`;
          target.set(key, structuredClone(value));
          writes += 1;
        },
      }),
    }),
  };
  return { db: db as never, scores, calculations, components, writes: () => writes };
}

const markSynced = (async () => []) as never;

test("Conditions golden: each native component and normalized score is persisted verbatim", async () => {
  const state = harness();
  const summary = await writeConditionScores(state.db, GOLDEN_INPUTS, { markSynced });

  assert.equal(state.scores.size, 2);
  assert.equal(state.calculations.size, 2);
  assert.equal(state.components.size, 2);
  assert.equal(summary.proposed, 2);
  assert.equal(summary.written, 2);
  assert.equal(summary.componentsWritten, 2);

  const hdi = state.scores.get("j-golden:human_development:2024-Q4:conditions-components/v1:undp_hdi:hdi");
  const gpi = state.scores.get("j-golden:peace_security:2024-Q4:conditions-components/v1:global_peace_index:GPI_SCORE");
  assert.equal(hdi?.normalizedScore, 92.9);
  assert.equal(hdi?.rawValue, 0.929);
  assert.equal(gpi?.normalizedScore, 41.5);
  assert.equal(gpi?.rawValue, 3.34);
});

test("Conditions golden: the writer creates no cross-dimension composite", async () => {
  const state = harness();
  await writeConditionScores(state.db, GOLDEN_INPUTS, { markSynced });

  assert.deepEqual(
    [...state.scores.values()].map((row) => row.dimension).sort(),
    ["human_development", "peace_security"],
  );
  for (const row of state.scores.values()) {
    for (const forbidden of ["composite", "combined", "overall", "total", "aggregate", "conditionsScore"]) {
      assert.equal(Object.hasOwn(row, forbidden), false, `${forbidden} must not be stored`);
    }
  }
});

test("Conditions golden: reruns converge on the identical calculation and component rows", async () => {
  const state = harness();
  await writeConditionScores(state.db, GOLDEN_INPUTS, { markSynced });
  const first = structuredClone({
    scores: [...state.scores],
    calculations: [...state.calculations],
    components: [...state.components],
  });
  await writeConditionScores(state.db, GOLDEN_INPUTS, { markSynced });
  assert.deepEqual(
    {
      scores: [...state.scores],
      calculations: [...state.calculations],
      components: [...state.components],
    },
    first,
  );
});
