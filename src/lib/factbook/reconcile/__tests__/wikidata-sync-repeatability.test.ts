import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import { syncFactbookWikidata } from "../wikidata-sync";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "canada", name: "Canada", wikidataQid: "Q16" };
const claim = {
  statementIri: "http://www.wikidata.org/entity/statement/Q16-population",
  valueRaw: "41472081",
  valueUnitQid: "Q199",
  pointInTime: "2026-01-01T00:00:00Z",
  rank: "preferred" as const,
  refStatedInQid: "Q21540096",
  refStatedInLabel: "World Bank",
  refUrl: "https://data.worldbank.org/indicator/SP.POP.TOTL",
};

function harness() {
  const snapshots = new Map<string, Record<string, unknown>>();
  const facts = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    insert: (table: unknown) => ({ values: (value: Record<string, unknown>) => ({
      onConflictDoNothing: () => ({ returning: async () => {
        if (table !== factSnapshots || snapshots.has(String(value.payloadHash))) return [];
        const row = { id: `snapshot-${snapshots.size + 1}`, ...structuredClone(value) };
        snapshots.set(String(value.payloadHash), row);
        writes++;
        return [{ id: row.id }];
      } }),
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
    jurisdictions: [jurisdiction],
    getClaims: async () => [claim],
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["wikidata"]) as never,
  };
}

test("Wikidata fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = fixtureOptions();
  await syncFactbookWikidata(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncFactbookWikidata(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("Wikidata dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const options = { ...fixtureOptions(), dryRun: true };
  const first = await syncFactbookWikidata(state.db, options);
  const second = await syncFactbookWikidata(state.db, options);
  assert.deepEqual(first.factCountersByKey, second.factCountersByKey);
  assert.equal(state.writes(), 0);
});

test("Wikidata upstream failure is reported and cannot stamp freshness", async () => {
  const state = harness();
  const stamped: number[] = [];
  const result = await syncFactbookWikidata(state.db, {
    ...fixtureOptions(),
    getClaims: async () => { throw new Error("SPARQL schema changed"); },
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stamped.push(options.rowsWritten); return []; }) as never,
  });
  assert.match(result.errors.join(" "), /SPARQL schema changed/);
  assert.deepEqual(stamped, [0]);
  assert.equal(state.writes(), 0);
});
