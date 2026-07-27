/**
 * QA-007 — Conditions golden: identity passthrough, NO composite.
 *
 * The Civica Conditions transform (`writeConditionScores` in
 * `src/lib/conditions/ingest.ts`) is an identity passthrough: it validates
 * per-indicator lineage and the 0–100 normalized bound, then persists each
 * row's `normalizedScore` verbatim. It deliberately produces NO combined /
 * composite Conditions score. This golden pins that contract so a future
 * silent composite, rescale, or dropped field is caught deterministically.
 *
 * DB-free: the DB and freshness stamp are captured through an in-memory
 * harness, exactly like `ingest-repeatability.test.ts`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { writeConditionScores, type ConditionScoreInput } from "../ingest";

// Fixed synthetic input — two indicators for one jurisdiction/quarter. The
// two normalized scores must survive as-is; nothing may combine them.
const GOLDEN_INPUTS: ConditionScoreInput[] = [
  {
    jurisdictionId: "j-golden", dimension: "human_development", quarter: "2024-Q4",
    normalizedScore: 92.9, rawValue: 0.929, sourceId: "undp_hdi", datasetYear: 2024,
    methodologyVersion: "beta", indicatorId: "hdi", upstreamRelease: "fixture",
    artifactHash: "a".repeat(64), artifactKind: "normalized_batch", temporalCoverage: "2024",
    licenseUrl: "https://example.test/terms", transformationId: "fixture/v1",
    substitutionReason: null, methodVersion: "beta",
  },
  {
    jurisdictionId: "j-golden", dimension: "material_wellbeing", quarter: "2024-Q4",
    normalizedScore: 41.5, rawValue: 12750, sourceId: "worldbank_wdi", datasetYear: 2024,
    methodologyVersion: "beta", indicatorId: "gni_pc", upstreamRelease: "fixture",
    artifactHash: "b".repeat(64), artifactKind: "normalized_batch", temporalCoverage: "2024",
    licenseUrl: "https://example.test/terms", transformationId: "fixture/v1",
    substitutionReason: null, methodVersion: "beta",
  },
];

function harness() {
  const rows = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoUpdate: async () => {
          const key = `${value.jurisdictionId}:${value.dimension}:${value.quarter}:${value.methodologyVersion}:${value.sourceId}:${value.indicatorId}`;
          rows.set(key, structuredClone(value));
          writes++;
        },
      }),
    }),
  };
  return { db: db as never, rows, writes: () => writes };
}
const markSynced = (async () => []) as never;

test("Conditions golden: each normalized score is persisted verbatim (identity passthrough)", async () => {
  const state = harness();
  const summary = await writeConditionScores(state.db, GOLDEN_INPUTS, { markSynced });

  // One stored row per input — no aggregation collapsed them together.
  assert.equal(state.rows.size, 2);
  assert.equal(summary.proposed, 2);
  assert.equal(summary.written, 2);

  // GOLDEN: normalizedScore is stored exactly, not rescaled or recomputed.
  const hd = state.rows.get("j-golden:human_development:2024-Q4:beta:undp_hdi:hdi");
  const mw = state.rows.get("j-golden:material_wellbeing:2024-Q4:beta:worldbank_wdi:gni_pc");
  assert.ok(hd && mw, "expected both indicator rows to be stored");
  assert.equal(hd!.normalizedScore, 92.9);
  assert.equal(hd!.rawValue, 0.929);
  assert.equal(mw!.normalizedScore, 41.5);
  assert.equal(mw!.rawValue, 12750);
});

test("Conditions golden: the transform emits NO combined / composite score", async () => {
  const state = harness();
  await writeConditionScores(state.db, GOLDEN_INPUTS, { markSynced });

  // No row invents a cross-dimension composite field, and there is no
  // extra "combined"/"overall" row beyond the two per-indicator rows.
  for (const [, row] of state.rows) {
    for (const forbidden of ["composite", "combined", "overall", "total", "aggregate", "conditionsScore"]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(row, forbidden),
        false,
        `Conditions row must not carry a ${forbidden} field`,
      );
    }
  }
  // Exactly the two dimensions we fed — nothing rolled them into one.
  const dimensions = new Set([...state.rows.values()].map((row) => row.dimension));
  assert.deepEqual([...dimensions].sort(), ["human_development", "material_wellbeing"]);
});

test("Conditions golden: reruns of the fixed input converge on the identical canonical rows", async () => {
  const state = harness();
  await writeConditionScores(state.db, GOLDEN_INPUTS, { markSynced });
  const first = structuredClone([...state.rows]);
  await writeConditionScores(state.db, GOLDEN_INPUTS, { markSynced });
  assert.deepEqual([...state.rows], first);
  assert.equal(state.rows.size, 2);
});
