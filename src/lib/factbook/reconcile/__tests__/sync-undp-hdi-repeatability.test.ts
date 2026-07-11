import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import { syncUndpHdi } from "../sync-undp-hdi";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "fixtureland", iso3: "FIX" };

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
const fetchCsv = async () => ({ columnIndex: new Map([["iso3", 0], ["hdi_2023", 1]]), countryRows: [["FIX", "0.91"]] });

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("UNDP HDI fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = {
    factKey: "hdi_score",
    undpCode: "hdi",
    jurisdictions: [jurisdiction],
    fetchCsv,
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["undp_hdi"]) as never,
  };
  await syncUndpHdi(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncUndpHdi(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("UNDP HDI dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = {
    factKey: "hdi_score",
    undpCode: "hdi",
    jurisdictions: [jurisdiction],
    fetchCsv,
    persistDisputes: noDisputes as never,
    markSynced: (async () => []) as never,
    dryRun: true,
  };
  const first = await syncUndpHdi(state.db, options);
  const second = await syncUndpHdi(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("UNDP HDI upstream failure is loud before freshness", async () => {
  const state = harness();
  let stampCalls = 0;
  const result = await syncUndpHdi(state.db, {
    factKey: "hdi_score",
    undpCode: "hdi",
    jurisdictions: [jurisdiction],
    fetchCsv: async () => { throw new Error("upstream schema changed"); },
    persistDisputes: noDisputes as never,
    markSynced: (async () => { stampCalls++; return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.equal(stampCalls, 0);
  assert.equal(state.writes(), 0);
});
