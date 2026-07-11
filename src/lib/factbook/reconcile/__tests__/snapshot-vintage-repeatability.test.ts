import assert from "node:assert/strict";
import test from "node:test";
import { snapshotCurrentVintage } from "../snapshot-vintage";

const pair = { jurisdictionId: "11111111-1111-4111-8111-111111111111", factKey: "population_total", slug: "canada", name: "Canada" };
const row = {
  id: "fact-1", jurisdictionId: pair.jurisdictionId, factKey: pair.factKey,
  factGroup: "B", category: "demographics", sourceId: "world_bank",
  sourceUrl: "https://data.worldbank.org/indicator/SP.POP.TOTL", wikidataQid: null,
  wikidataPid: null, wikidataRank: null, references: [], factValue: "41472081",
  factValueNumeric: 41472081, factUnit: "people", factYear: 2026, valueJson: null,
  asOf: "2026-01-01", dataVintageYear: 2026, retrievedAt: "2026-04-01T00:00:00.000Z",
  upstreamVintageLabel: "WDI 2026", methodologyVersion: "v0.1-beta", status: "active",
  statusReason: null, sourceNote: null, valueType: "measured", growthMethodology: null,
};

function harness() {
  const rows = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    insert: () => ({ values: (value: Record<string, unknown>) => ({ onConflictDoUpdate: async () => {
      const key = `${value.jurisdictionId}:${value.factKey}:${value.vintageLabel}`;
      rows.set(key, { ...structuredClone(value), snapshotAt: new Date() });
      writes++;
    } }) }),
  };
  return { db: db as never, rows, writes: () => writes };
}

function canonical(rows: Map<string, Record<string, unknown>>) {
  return [...rows.entries()].map(([key, value]) => {
    const copy = structuredClone(value);
    delete copy.snapshotAt;
    return [key, copy];
  });
}

const fixed = { vintageLabel: "Fixture 2026-Q1", cutDate: new Date("2026-04-15T04:00:00.000Z"), pairs: [pair], disputedKeys: new Set<string>(), readRows: async () => [row] as never };

test("vintage fixture applications converge on one canonical snapshot", async () => {
  const state = harness();
  await snapshotCurrentVintage(fixed, state.db);
  const first = structuredClone(canonical(state.rows));
  await snapshotCurrentVintage(fixed, state.db);
  assert.deepEqual(canonical(state.rows), first);
  assert.equal(state.rows.size, 1);
});

test("vintage dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const first = await snapshotCurrentVintage({ ...fixed, dryRun: true }, state.db);
  const second = await snapshotCurrentVintage({ ...fixed, dryRun: true }, state.db);
  assert.deepEqual(first, second);
  assert.equal(state.writes(), 0);
});

test("vintage malformed input fails loudly before writes", async () => {
  const state = harness();
  const result = await snapshotCurrentVintage({ ...fixed, readRows: async () => { throw new Error("fixture schema changed"); } }, state.db);
  assert.match(result.errors[0]?.error ?? "", /fixture schema changed/);
  assert.equal(result.snapshotted, 0);
  assert.equal(state.writes(), 0);
});
