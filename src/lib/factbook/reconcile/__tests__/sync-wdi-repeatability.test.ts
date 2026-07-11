import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { WbDataPoint } from "../sync-wdi";
import { syncWorldBankWdi } from "../sync-wdi";

const jurisdiction = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "fixtureland",
  iso3: "FIX",
};

const observation: WbDataPoint = {
  country: { id: "FX", value: "Fixtureland" },
  countryiso3code: "FIX",
  date: "2025",
  value: 2.5,
  indicator: { id: "FP.CPI.TOTL.ZG", value: "Inflation" },
};

function harness() {
  const snapshots = new Map<string, Record<string, unknown>>();
  const facts = new Map<string, Record<string, unknown>>();
  let writes = 0;
  let selectedTable: unknown;
  const db = {
    insert: (table: unknown) => ({
      values: (value: Record<string, unknown>) => ({
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
      }),
    }),
    select: () => ({
      from: (table: unknown) => {
        selectedTable = table;
        return {
          where: () => ({
            limit: async () => selectedTable === factSnapshots
              ? [{ id: [...snapshots.values()][0]?.id }]
              : [],
          }),
        };
      },
    }),
  };
  return { db: db as never, facts, writes: () => writes };
}

const noDisputes = async () => ({
  jurisdictionsScanned: 1,
  pairsScanned: 1,
  proposedTotal: 0,
  inserted: 0,
  skippedDuplicate: 0,
  skippedNoFactGroup: 0,
  errors: [],
});

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("WDI fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = {
    factKey: "inflation_rate",
    wbCode: "FP.CPI.TOTL.ZG",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["world_bank"]) as never,
  };
  await syncWorldBankWdi(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncWorldBankWdi(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("WDI dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = {
    factKey: "inflation_rate",
    wbCode: "FP.CPI.TOTL.ZG",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => []) as never,
    dryRun: true,
  };
  const first = await syncWorldBankWdi(state.db, options);
  const second = await syncWorldBankWdi(state.db, options);
  assert.equal(first.totalWritten, second.totalWritten);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("WDI upstream failure reports loudly and cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncWorldBankWdi(state.db, {
    factKey: "inflation_rate",
    wbCode: "FP.CPI.TOTL.ZG",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => { throw new Error("upstream schema changed"); },
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => {
      stampedRows.push(options.rowsWritten);
      return [];
    }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, [0]);
  assert.equal(state.writes(), 0);
});
