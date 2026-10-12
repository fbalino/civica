import assert from "node:assert/strict";
import test from "node:test";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import { syncUsCensus, US_CENSUS_INDICATORS } from "../sync-us-census";

const jurisdiction = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "united-states",
  iso2: "US",
  iso3: "USA",
};

function harness() {
  const snapshots = new Map<string, Record<string, unknown>>();
  const facts = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    insert: (table: unknown) => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoNothing: async () => {
          if (
            table === factSnapshots &&
            !snapshots.has(String(value.payloadHash))
          ) {
            snapshots.set(String(value.payloadHash), {
              id: `snapshot-${snapshots.size + 1}`,
              ...structuredClone(value),
            });
            writes++;
          }
        },
        onConflictDoUpdate: async () => {
          if (table === countryFacts) {
            const key = `${value.jurisdictionId}:${value.factKey}:${value.sourceId}`;
            facts.set(key, {
              id: facts.get(key)?.id ?? `fact-${facts.size + 1}`,
              ...structuredClone(value),
            });
            writes++;
          }
        },
      }),
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () =>
            table === factSnapshots
              ? [{ id: [...snapshots.values()][0]?.id }]
              : [],
        }),
      }),
    }),
  };
  const writeFact: CountryFactHistoryWriter = async (_database, { values }) => {
    await db.insert(countryFacts).values(values as unknown as Record<string, unknown>).onConflictDoUpdate();
  };
  return {
    db: db as never,
    facts,
    snapshots,
    writeFact,
    writes: () => writes,
  };
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

test("US Census fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = {
    factKey: "population_total",
    jurisdiction,
    fetchValues: async () => [340000000],
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["us_census"]) as never,
    atlasReleaseId: "atlas-test",
    writeFact: state.writeFact,
  };
  await syncUsCensus(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncUsCensus(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("US Census dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = {
    factKey: "population_total",
    jurisdiction,
    fetchValues: async () => [340000000],
    persistDisputes: noDisputes as never,
    markSynced: (async () => []) as never,
    dryRun: true,
  };
  const first = await syncUsCensus(state.db, options);
  const second = await syncUsCensus(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("US Census upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncUsCensus(state.db, {
    factKey: "population_total",
    jurisdiction,
    fetchValues: async () => {
      throw new Error("upstream schema changed");
    },
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => {
      stampedRows.push(options.rowsWritten);
      return [];
    }) as never,
    atlasReleaseId: "atlas-test",
    writeFact: state.writeFact,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, []);
  assert.equal(state.writes(), 0);
});

test("US Census sibling output cannot hide an unusable required target", async () => {
  const state = harness();
  const targets = US_CENSUS_INDICATORS.slice(0, 2);
  const emptyTarget = targets[1]!;
  let stampCalls = 0;
  const result = await syncUsCensus(state.db, {
    targets,
    jurisdiction,
    fetchValues: async (_dataset, _vintage, variables) =>
      variables[0] === targets[0]!.variables[0] ? [340_000_000] : [Number.NaN],
    persistDisputes: noDisputes as never,
    markSynced: (async () => {
      stampCalls++;
      return ["us_census"];
    }) as never,
    dryRun: true,
  });

  assert.equal(result.totalWritten, 1);
  assert.ok(result.errors.some((error) => error.includes(emptyTarget.factKey)));
  assert.equal(stampCalls, 0);
});

test("Census sends its configured key only to the publisher, never retained provenance", async (t) => {
  const state = harness();
  const key = "fixture-census-credential";
  const prior = process.env.CENSUS_API_KEY;
  process.env.CENSUS_API_KEY = key;
  t.after(() => { if (prior === undefined) delete process.env.CENSUS_API_KEY; else process.env.CENSUS_API_KEY = prior; });
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.searchParams.get("key") !== key) return new Response("Missing Key", { status: 403 });
    return Response.json([["NAME", "DP05_0001E", "us"], ["United States", "340110988", "1"]]);
  });
  const result = await syncUsCensus(state.db, {
    factKey: "population_total", jurisdiction, atlasReleaseId: "atlas-test",
    writeFact: state.writeFact, persistDisputes: noDisputes as never,
    markSynced: (async () => ["us_census"]) as never,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalWritten, 1);
  assert.equal(urls.length, 1);
  assert.equal(urls[0].origin, "https://api.census.gov");
  assert.doesNotMatch(JSON.stringify({ facts: [...state.facts.values()], snapshots: [...state.snapshots.values()] }), /fixture-census-credential/);
});

test("Census missing credentials fail without network requests or freshness", async (t) => {
  const state = harness();
  const prior = process.env.CENSUS_API_KEY;
  delete process.env.CENSUS_API_KEY;
  t.after(() => { if (prior !== undefined) process.env.CENSUS_API_KEY = prior; });
  let fetches = 0;
  let stamps = 0;
  t.mock.method(globalThis, "fetch", async () => { fetches++; throw new Error("network must not run"); });
  const result = await syncUsCensus(state.db, {
    factKey: "population_total", jurisdiction, dryRun: true,
    markSynced: (async () => { stamps++; return []; }) as never,
  });
  assert.match(result.errors.join(" "), /requires CENSUS_API_KEY/);
  assert.equal(fetches, 0);
  assert.equal(stamps, 0);
  assert.equal(state.writes(), 0);
});

test("Census transport failures cannot expose authenticated URLs", async (t) => {
  const state = harness();
  const prior = process.env.CENSUS_API_KEY;
  process.env.CENSUS_API_KEY = "fixture-private-key";
  t.after(() => { if (prior === undefined) delete process.env.CENSUS_API_KEY; else process.env.CENSUS_API_KEY = prior; });
  t.mock.method(globalThis, "fetch", async (input: unknown, options: RequestInit) => {
    assert.equal(options.redirect, "error");
    assert.ok(options.signal);
    throw new Error(`provider echoed ${String(input)}`);
  });
  const result = await syncUsCensus(state.db, { factKey: "population_total", jurisdiction, dryRun: true });
  assert.match(result.errors.join(" "), /US Census source request failed/);
  assert.doesNotMatch(JSON.stringify(result), /fixture-private-key|key=/);
  assert.equal(state.writes(), 0);
});
