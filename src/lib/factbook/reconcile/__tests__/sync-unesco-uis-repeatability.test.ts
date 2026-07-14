import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { UisDataPoint } from "../sync-unesco-uis";
import { syncUnescoUis } from "../sync-unesco-uis";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "fixtureland", iso3: "FIX" };
const observation: UisDataPoint = { indicatorId: "LR.AG15T99", geoUnit: "FIX", year: 2024, value: 91.2, magnitude: null, qualifier: null };

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
const fetchVersion = async () => ({ handle: "fixture-version", label: "UIS Fixture 2026" });

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("UNESCO UIS fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = {
    factKey: "literacy_rate",
    uisCode: "LR.AG15T99",
    jurisdictions: [jurisdiction],
    fetchVersion,
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["unesco_uis"]) as never,
    updateSourceLicense: async () => {},
  };
  await syncUnescoUis(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncUnescoUis(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("UNESCO UIS dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = {
    factKey: "literacy_rate",
    uisCode: "LR.AG15T99",
    jurisdictions: [jurisdiction],
    fetchVersion,
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => []) as never,
    updateSourceLicense: async () => {},
    dryRun: true,
  };
  const first = await syncUnescoUis(state.db, options);
  const second = await syncUnescoUis(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("UNESCO UIS upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncUnescoUis(state.db, {
    factKey: "literacy_rate",
    uisCode: "LR.AG15T99",
    jurisdictions: [jurisdiction],
    fetchVersion,
    fetchIndicator: async () => { throw new Error("upstream schema changed"); },
    persistDisputes: noDisputes as never,
    updateSourceLicense: async () => {},
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stampedRows.push(options.rowsWritten); return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, []);
  assert.equal(state.writes(), 0);
});
