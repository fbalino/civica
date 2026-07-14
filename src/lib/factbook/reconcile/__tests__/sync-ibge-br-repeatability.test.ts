import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { IbgeDataRow } from "../sync-ibge-br";
import { syncIbgeBr } from "../sync-ibge-br";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "brazil", iso2: "BR", iso3: "BRA" };
const latest: IbgeDataRow = { V: "203000000", MC: "45", MN: "Pessoas", dimensions: [{ position: 3, code: "2025", name: "2025" }] };
const fetchIndicator = async () => ({ rows: [latest], latest, periodCode: "2025", periodName: "2025", periodHeaderLabel: "Ano" });

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

test("IBGE fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = { factKey: "population_total", tableId: "6579", jurisdiction, fetchIndicator: fetchIndicator as never, persistDisputes: noDisputes as never, markSynced: (async () => ["ibge_br"]) as never };
  await syncIbgeBr(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncIbgeBr(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("IBGE dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = { factKey: "population_total", tableId: "6579", jurisdiction, fetchIndicator: fetchIndicator as never, persistDisputes: noDisputes as never, markSynced: (async () => []) as never, dryRun: true };
  const first = await syncIbgeBr(state.db, options);
  const second = await syncIbgeBr(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("IBGE upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncIbgeBr(state.db, {
    factKey: "population_total",
    tableId: "6579",
    jurisdiction,
    fetchIndicator: (async () => { throw new Error("upstream schema changed"); }) as never,
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stampedRows.push(options.rowsWritten); return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, []);
  assert.equal(state.writes(), 0);
});
