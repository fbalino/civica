import assert from "node:assert/strict";
import test from "node:test";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { OnsYearPoint } from "../sync-ons-uk";
import { ONS_INDICATORS, syncOnsUk } from "../sync-ons-uk";

const jurisdiction = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "united-kingdom",
  iso2: "GB",
  iso3: "GBR",
};
const latest: OnsYearPoint = {
  year: 2025,
  value: 69000000,
  updateDate: "2026-01-01",
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
const fetchIndicator = async () => ({
  latest,
  observationCount: 1,
  rejectedNoValue: 0,
  upstreamReleaseDate: "2026-01-01",
});

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("ONS fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = {
    factKey: "population_total",
    jurisdiction,
    ensureSource: (async () => false) as never,
    fetchIndicator: fetchIndicator as never,
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["ons_uk"]) as never,
    atlasReleaseId: "atlas-test",
    writeFact: state.writeFact,
  };
  await syncOnsUk(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncOnsUk(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("ONS dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = {
    factKey: "population_total",
    jurisdiction,
    ensureSource: (async () => false) as never,
    fetchIndicator: fetchIndicator as never,
    persistDisputes: noDisputes as never,
    markSynced: (async () => []) as never,
    dryRun: true,
  };
  const first = await syncOnsUk(state.db, options);
  const second = await syncOnsUk(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("ONS upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncOnsUk(state.db, {
    factKey: "population_total",
    jurisdiction,
    ensureSource: (async () => false) as never,
    fetchIndicator: (async () => {
      throw new Error("upstream schema changed");
    }) as never,
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

test("ONS sibling output cannot hide a required target with no usable point", async () => {
  const state = harness();
  const targets = ONS_INDICATORS.slice(0, 2);
  const emptyTarget = targets[1]!;
  let stampCalls = 0;
  const result = await syncOnsUk(state.db, {
    targets,
    jurisdiction,
    fetchIndicator: (async (config: (typeof targets)[number]) =>
      config.cdid === targets[0]!.cdid
        ? fetchIndicator()
        : {
            latest: null,
            observationCount: 1,
            rejectedNoValue: 1,
            upstreamReleaseDate: "2026-01-01",
          }) as never,
    persistDisputes: noDisputes as never,
    markSynced: (async () => {
      stampCalls++;
      return ["ons_uk"];
    }) as never,
    dryRun: true,
  });

  assert.equal(result.totalWritten, 1);
  assert.ok(result.errors.some((error) => error.includes(emptyTarget.factKey)));
  assert.equal(stampCalls, 0);
});
