import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import { syncOecdStat } from "../sync-oecd-stat";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "united-states", iso3: "USA" };

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
const fetchIndicator = async () => ({ latestByIso3: new Map([["USA", { year: 2024, value: -6.2 }]]), observationCount: 1, nonMemberCount: 0 });

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("OECD fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = { factKey: "fiscal_balance_pct_gdp", jurisdictions: [jurisdiction], fetchIndicator: fetchIndicator as never, persistDisputes: noDisputes as never, markSynced: (async () => ["oecd_stat"]) as never };
  await syncOecdStat(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncOecdStat(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("OECD dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = { factKey: "fiscal_balance_pct_gdp", jurisdictions: [jurisdiction], fetchIndicator: fetchIndicator as never, persistDisputes: noDisputes as never, markSynced: (async () => []) as never, dryRun: true };
  const first = await syncOecdStat(state.db, options);
  const second = await syncOecdStat(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("OECD upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncOecdStat(state.db, {
    factKey: "fiscal_balance_pct_gdp",
    jurisdictions: [jurisdiction],
    fetchIndicator: (async () => { throw new Error("upstream schema changed"); }) as never,
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stampedRows.push(options.rowsWritten); return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, [0]);
  assert.equal(state.writes(), 0);
});
