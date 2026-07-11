import assert from "node:assert/strict";
import test from "node:test";
import { ciMethodologyVersions, ciSourceIngestions, jurisdictions } from "@/lib/db/schema";
import { runIngestion } from "../ingest";
import type { IngestionResult } from "../types";

const fixture: IngestionResult = { sourceId: "vdem", dimension: "democratic_quality", datasetYear: 2024, globalMinObserved: 0, globalMaxObserved: 1, records: [{ iso3: "CAN", year: 2024, dimension: "democratic_quality", indicator: "v2x_libdem", rawValue: 0.8, nativeMin: 0, nativeMax: 1, isInverted: false }] };

function harness() {
  const ingestions = new Map<string, Record<string, unknown>>();
  const scores = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    select: () => ({ from: (table: unknown) => {
      if (table === jurisdictions) return { where: async () => [{ id: "jurisdiction-1", iso3: "CAN" }] };
      if (table === ciMethodologyVersions) return { orderBy: () => ({ limit: async () => [{ id: "ci-v2-beta" }] }) };
      throw new Error("unexpected select");
    } }),
    insert: (table: unknown) => ({ values: (value: Record<string, unknown>) => ({ onConflictDoUpdate: () => {
      const target = table === ciSourceIngestions ? ingestions : scores;
      const key = table === ciSourceIngestions ? `${value.sourceId}:${value.dimension}:${value.datasetYear}` : `${value.jurisdictionId}:${value.dimension}:${value.quarter}:${value.methodologyVersion}`;
      const row = { id: target.get(key)?.id ?? `row-${target.size + 1}`, ...structuredClone(value) };
      target.set(key, row); writes++;
      return { returning: async () => [{ id: row.id }], then: (resolve: (value: unknown) => void) => resolve(undefined) };
    } }) }),
  };
  return { db: db as never, ingestions, scores, writes: () => writes };
}

const markSynced = (async () => []) as never;

test("Index fixture applications converge without duplicate ingestion or score rows", async () => {
  const state = harness();
  await runIngestion(state.db, fixture, { markSynced });
  const first = structuredClone({ ingestions: [...state.ingestions], scores: [...state.scores] });
  await runIngestion(state.db, fixture, { markSynced });
  assert.deepEqual({ ingestions: [...state.ingestions], scores: [...state.scores] }, first);
  assert.equal(state.ingestions.size, 1);
  assert.equal(state.scores.size, 1);
});

test("Index dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const first = await runIngestion(state.db, fixture, { dryRun: true, markSynced });
  const second = await runIngestion(state.db, fixture, { dryRun: true, markSynced });
  assert.deepEqual(first, second);
  assert.equal(state.writes(), 0);
});

test("Index empty upstream fails loudly before writes or freshness", async () => {
  const state = harness();
  let freshnessCalls = 0;
  await assert.rejects(runIngestion(state.db, { ...fixture, records: [] }, { markSynced: (async () => { freshnessCalls++; return []; }) as never }), /zero records/);
  assert.equal(state.writes(), 0);
  assert.equal(freshnessCalls, 0);
});
