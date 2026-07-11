import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { FaoCsvRow } from "../sync-fao-faostat";
import { syncFaoFaostat } from "../sync-fao-faostat";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "brazil", iso3: "BRA" };
const observation: FaoCsvRow = { m49Code: 76, areaName: "Brazil", itemCode: 6610, elementCode: 7209, year: 2023, unit: "%", value: 28.33, flag: "A" };

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
const fetchArchive = async () => ({ rows: [observation], archiveBytes: 1234 });

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("FAO fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = { factKey: "agricultural_land_pct", jurisdictions: [jurisdiction], fetchArchive, persistDisputes: noDisputes as never, markSynced: (async () => ["fao_faostat"]) as never };
  await syncFaoFaostat(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncFaoFaostat(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("FAO dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = { factKey: "agricultural_land_pct", jurisdictions: [jurisdiction], fetchArchive, persistDisputes: noDisputes as never, markSynced: (async () => []) as never, dryRun: true };
  const first = await syncFaoFaostat(state.db, options);
  const second = await syncFaoFaostat(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("FAO upstream failure is loud before freshness", async () => {
  const state = harness();
  let stampCalls = 0;
  const result = await syncFaoFaostat(state.db, {
    factKey: "agricultural_land_pct",
    jurisdictions: [jurisdiction],
    fetchArchive: async () => { throw new Error("upstream schema changed"); },
    persistDisputes: noDisputes as never,
    markSynced: (async () => { stampCalls++; return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.equal(stampCalls, 0);
  assert.equal(state.writes(), 0);
});
