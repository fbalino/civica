import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { FetchedPdf, StatsSaExtraction } from "../sync-stats-sa";
import { syncStatsSa } from "../sync-stats-sa";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "south-africa", iso2: "ZA", iso3: "ZAF" };
const pdf: FetchedPdf = { url: "https://fixture.invalid/P03022026.pdf", status: 200, bytes: 1024, totalPages: 8, pagesSent: 8, base64: "fixture", truncated: false };
const extraction: StatsSaExtraction = { value: 63100000, asOfPeriodLabel: "2026", asOfYear: 2026, asOfMonth: null, asOfQuarter: null, rawQuote: "The mid-year population is estimated at 63,100,000 people.", tableReference: "Summary" };

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

function fixtureOptions() {
  return {
    factKey: "population_total",
    jurisdiction,
    ensureSource: async () => false,
    fetchPdf: async () => pdf,
    extractPdf: async () => extraction,
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["stats_sa"]) as never,
  };
}

test("Stats SA fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = fixtureOptions();
  await syncStatsSa(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncStatsSa(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("Stats SA dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = { ...fixtureOptions(), dryRun: true };
  const first = await syncStatsSa(state.db, options);
  const second = await syncStatsSa(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("Stats SA upstream failure is loud and cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  await assert.rejects(
    syncStatsSa(state.db, {
      ...fixtureOptions(),
      fetchPdf: async () => { throw new Error("upstream PDF changed"); },
      markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stampedRows.push(options.rowsWritten); return []; }) as never,
    }),
    /upstream PDF changed/,
  );
  assert.deepEqual(stampedRows, []);
  assert.equal(state.writes(), 0);
});
