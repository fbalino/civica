import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { WtoCsvRow } from "../sync-wto-stats";
import { syncWtoStats } from "../sync-wto-stats";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "fixtureland", iso3: "FIX" };
const observation: WtoCsvRow = { iso3: "FIX", reporterName: "Fixtureland", partnerCode: "000", productCode: "TO", indicatorCode: "ITS_MTV_AX", year: 2025, unitCode: "USM", valueFlag: "", value: 100 };

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
const noMigration = async () => ({ expectedFactKeysRemoved: [], rowsMigrated: 0, rowsRoleFlipped: 0, licenseTightened: false });
const fetchArchive = async () => ({ rows: [observation], archiveBytes: 1234 });

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("WTO fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = { factKey: "exports_merchandise_usd", jurisdictions: [jurisdiction], runMigration: noMigration as never, fetchArchive, persistDisputes: noDisputes as never, markSynced: (async () => ["wto_stats"]) as never };
  await syncWtoStats(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncWtoStats(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("WTO dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = { factKey: "exports_merchandise_usd", jurisdictions: [jurisdiction], runMigration: noMigration as never, fetchArchive, persistDisputes: noDisputes as never, markSynced: (async () => []) as never, dryRun: true };
  const first = await syncWtoStats(state.db, options);
  const second = await syncWtoStats(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("WTO upstream failure is loud before freshness", async () => {
  const state = harness();
  let stampCalls = 0;
  const result = await syncWtoStats(state.db, {
    factKey: "exports_merchandise_usd",
    jurisdictions: [jurisdiction],
    runMigration: noMigration as never,
    fetchArchive: async () => { throw new Error("upstream schema changed"); },
    persistDisputes: noDisputes as never,
    markSynced: (async () => { stampCalls++; return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.equal(stampCalls, 0);
  assert.equal(state.writes(), 0);
});
