import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import { syncFactbookWikidata } from "../wikidata-sync";
import { WIKIDATA_FACT_MAPPING } from "../wikidata-fact-mapping";

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

function harness(options: { snapshotFailures?: number } = {}) {
  const snapshots = new Map<string, Record<string, unknown>>();
  const facts = new Map<string, Record<string, unknown>>();
  let writes = 0;
  let remainingSnapshotFailures = options.snapshotFailures ?? 0;
  const db = {
    insert: (table: unknown) => ({ values: (value: Record<string, unknown>) => ({
      onConflictDoNothing: () => ({ returning: async () => {
        if (table === factSnapshots && remainingSnapshotFailures > 0) {
          remainingSnapshotFailures--;
          throw new Error("snapshot ledger unavailable");
        }
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
  assert.deepEqual(stamped, []);
  assert.equal(state.writes(), 0);
});

test("Wikidata dispute failure blocks freshness and a successful retry stamps once", async () => {
  const state = harness();
  const stamps: Array<{ sourceIds: unknown; rowsWritten: number }> = [];
  let rejectDisputes = true;
  const options = {
    ...fixtureOptions(),
    persistDisputes: (async () => {
      if (rejectDisputes) throw new Error("dispute ledger unavailable");
      return noDisputes();
    }) as never,
    markSynced: (async (
      sourceIds: unknown,
      markOptions: { rowsWritten: number },
    ) => {
      stamps.push({ sourceIds, rowsWritten: markOptions.rowsWritten });
      return ["wikidata"];
    }) as never,
  };

  const failed = await syncFactbookWikidata(state.db, options);
  assert.match(failed.errors.join(" "), /dispute ledger unavailable/);
  assert.deepEqual(stamps, []);

  rejectDisputes = false;
  const retried = await syncFactbookWikidata(state.db, options);
  assert.deepEqual(retried.errors, []);
  assert.deepEqual(stamps, [
    { sourceIds: "wikidata", rowsWritten: retried.totalAdmitted },
  ]);
});

test("Wikidata returned dispute errors block freshness", async () => {
  const state = harness();
  let stampCalls = 0;
  const result = await syncFactbookWikidata(state.db, {
    ...fixtureOptions(),
    persistDisputes: (async () => ({
      ...(await noDisputes()),
      errors: ["dispute insert rejected"],
    })) as never,
    markSynced: (async () => {
      stampCalls++;
      return ["wikidata"];
    }) as never,
  });

  assert.match(result.errors.join(" "), /disputes: dispute insert rejected/);
  assert.equal(stampCalls, 0);
});

test("Wikidata snapshot failure makes a mixed write partial and withholds freshness", async () => {
  const state = harness({ snapshotFailures: 1 });
  let stampCalls = 0;
  const result = await syncFactbookWikidata(state.db, {
    ...fixtureOptions(),
    jurisdictions: [
      jurisdiction,
      {
        ...jurisdiction,
        id: "22222222-2222-4222-8222-222222222222",
        slug: "uruguay",
        name: "Uruguay",
        wikidataQid: "Q77",
      },
    ],
    markSynced: (async () => {
      stampCalls++;
      return ["wikidata"];
    }) as never,
  });

  assert.match(result.errors.join(" "), /snapshot ledger unavailable/);
  assert.equal(state.facts.size, 1);
  assert.equal(stampCalls, 0);
});

test("Wikidata registry drift makes a mixed write partial and withholds freshness", async () => {
  const state = harness();
  let stampCalls = 0;
  const population = WIKIDATA_FACT_MAPPING.find(
    ({ factKey }) => factKey === "population_total",
  )!;
  const result = await syncFactbookWikidata(state.db, {
    ...fixtureOptions(),
    factMappings: [
      population,
      { factKey: "missing_registry_key", pid: "P999999" },
    ],
    factKey: undefined,
    markSynced: (async () => {
      stampCalls++;
      return ["wikidata"];
    }) as never,
  });

  assert.match(result.errors.join(" "), /missing_registry_key/);
  assert.equal(state.facts.size, 1);
  assert.equal(stampCalls, 0);
});
