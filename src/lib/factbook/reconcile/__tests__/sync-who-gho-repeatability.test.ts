import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { WhoGhoDataPoint } from "../sync-who-gho";
import { syncWhoGho } from "../sync-who-gho";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "fixtureland", iso3: "FIX" };
const observation: WhoGhoDataPoint = {
  Id: 1,
  IndicatorCode: "WHOSIS_000001",
  SpatialDimType: "COUNTRY",
  SpatialDim: "FIX",
  TimeDimType: "YEAR",
  TimeDim: 2024,
  Dim1Type: "SEX",
  Dim1: "SEX_BTSX",
  Dim2Type: null,
  Dim2: null,
  Dim3Type: null,
  Dim3: null,
  Value: "72.5",
  NumericValue: 72.5,
  Low: null,
  High: null,
  Comments: null,
  Date: "2025-01-01T00:00:00Z",
  TimeDimensionValue: "2024",
  TimeDimensionBegin: "2024-01-01",
  TimeDimensionEnd: "2024-12-31",
};

function harness() {
  const snapshots = new Map<string, Record<string, unknown>>();
  const facts = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    insert: (table: unknown) => ({ values: (value: Record<string, unknown>) => ({
      onConflictDoNothing: async () => {
        if (table === factSnapshots && !snapshots.has(String(value.payloadHash))) {
          snapshots.set(String(value.payloadHash), { id: `snapshot-${snapshots.size + 1}`, ...structuredClone(value) });
          writes++;
        }
      },
      onConflictDoUpdate: async () => {
        if (table === countryFacts) {
          const key = `${value.jurisdictionId}:${value.factKey}:${value.sourceId}`;
          facts.set(key, { id: facts.get(key)?.id ?? `fact-${facts.size + 1}`, ...structuredClone(value) });
          writes++;
        }
      },
    }) }),
    select: () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => table === factSnapshots ? [{ id: [...snapshots.values()][0]?.id }] : [] }) }) }),
  };
  return { db: db as never, facts, writes: () => writes };
}

const noDisputes = async () => ({ jurisdictionsScanned: 1, pairsScanned: 1, proposedTotal: 0, inserted: 0, skippedDuplicate: 0, skippedNoFactGroup: 0, errors: [] });

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("WHO GHO fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = {
    factKey: "life_expectancy_years",
    whoCode: "WHOSIS_000001",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["who_gho"]) as never,
  };
  await syncWhoGho(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncWhoGho(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("WHO GHO dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = {
    factKey: "life_expectancy_years",
    whoCode: "WHOSIS_000001",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => []) as never,
    dryRun: true,
  };
  const first = await syncWhoGho(state.db, options);
  const second = await syncWhoGho(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("WHO GHO upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncWhoGho(state.db, {
    factKey: "life_expectancy_years",
    whoCode: "WHOSIS_000001",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => { throw new Error("upstream schema changed"); },
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stampedRows.push(options.rowsWritten); return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, [0]);
  assert.equal(state.writes(), 0);
});
