import assert from "node:assert/strict";
import test from "node:test";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { StatCanObservation } from "../sync-statcan-ca";
import { STATCAN_INDICATORS, syncStatCanCa } from "../sync-statcan-ca";

const jurisdiction = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "canada",
  iso2: "CA",
  iso3: "CAN",
};
const observation: StatCanObservation = {
  refPer: "2026-Q1",
  refPerRaw: "2026-01-01",
  value: 41472081,
  releaseTime: "2026-04-01",
  frequencyCode: 12,
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

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("StatCan fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = {
    factKey: "population_total",
    jurisdiction,
    fetchObservations: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["statcan_ca"]) as never,
    atlasReleaseId: "atlas-test",
    writeFact: state.writeFact,
  };
  await syncStatCanCa(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncStatCanCa(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("StatCan dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = {
    factKey: "population_total",
    jurisdiction,
    fetchObservations: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => []) as never,
    dryRun: true,
  };
  const first = await syncStatCanCa(state.db, options);
  const second = await syncStatCanCa(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("StatCan upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncStatCanCa(state.db, {
    factKey: "population_total",
    jurisdiction,
    fetchObservations: async () => {
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

test("StatCan sibling output cannot hide an unusable required target", async () => {
  const state = harness();
  const targets = STATCAN_INDICATORS.slice(0, 2);
  const emptyTarget = targets[1]!;
  let stampCalls = 0;
  const result = await syncStatCanCa(state.db, {
    targets,
    jurisdiction,
    fetchObservations: async (vectorId) =>
      vectorId === targets[0]!.vectorId ? [observation] : [],
    persistDisputes: noDisputes as never,
    markSynced: (async () => {
      stampCalls++;
      return ["statcan_ca"];
    }) as never,
    dryRun: true,
  });

  assert.equal(result.totalWritten, 1);
  assert.ok(result.errors.some((error) => error.includes(emptyTarget.factKey)));
  assert.equal(stampCalls, 0);
});
