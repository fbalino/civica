import assert from "node:assert/strict";
import test from "node:test";
import { writeConditionScores, type ConditionScoreInput } from "../ingest";

const fixture: ConditionScoreInput = { jurisdictionId: "jurisdiction-1", dimension: "human_development", quarter: "2024-Q4", normalizedScore: 92.9, rawValue: 0.929, sourceId: "undp_hdi", datasetYear: 2024, methodologyVersion: "beta", indicatorId:"hdi",upstreamRelease:"fixture",artifactHash:"a".repeat(64),artifactKind:"normalized_batch",temporalCoverage:"2024",licenseUrl:"https://example.test/terms",transformationId:"fixture/v1",substitutionReason:null,methodVersion:"beta" };

function harness() {
  const rows = new Map<string, Record<string, unknown>>(); let writes = 0;
  const db = { insert: () => ({ values: (value: Record<string, unknown>) => ({ onConflictDoUpdate: async () => { const key = `${value.jurisdictionId}:${value.dimension}:${value.quarter}:${value.methodologyVersion}:${value.sourceId}:${value.indicatorId}`; rows.set(key, structuredClone(value)); writes++; } }) }) };
  return { db: db as never, rows, writes: () => writes };
}
const markSynced = (async () => []) as never;

test("Conditions fixture applications converge on one canonical row", async () => {
  const state = harness(); await writeConditionScores(state.db, [fixture], { markSynced }); const first = structuredClone([...state.rows]); await writeConditionScores(state.db, [fixture], { markSynced }); assert.deepEqual([...state.rows], first); assert.equal(state.rows.size, 1);
});
test("Conditions dry-run is stable and performs zero writes", async () => {
  const state = harness(); const first = await writeConditionScores(state.db, [fixture], { dryRun: true, markSynced }); const second = await writeConditionScores(state.db, [fixture], { dryRun: true, markSynced }); assert.deepEqual(first, second); assert.equal(state.writes(), 0);
});
test("Conditions malformed or duplicate input fails before writes and freshness", async () => {
  const state = harness(); let stamps = 0; const mark = (async () => { stamps++; return []; }) as never;
  await assert.rejects(writeConditionScores(state.db, [{ ...fixture, normalizedScore: Number.NaN }], { markSynced: mark }), /Invalid Conditions score/);
  await assert.rejects(writeConditionScores(state.db, [fixture, fixture], { markSynced: mark }), /Duplicate Conditions row/);
  assert.equal(state.writes(), 0); assert.equal(stamps, 0);
});
