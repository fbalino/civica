import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
import type { WbDataPoint } from "../sync-wdi";
import { syncWorldBankWdi } from "../sync-wdi";

const jurisdiction = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "fixtureland",
  iso3: "FIX",
};

const observation: WbDataPoint = {
  country: { id: "FX", value: "Fixtureland" },
  countryiso3code: "FIX",
  date: "2025",
  value: 2.5,
  indicator: { id: "FP.CPI.TOTL.ZG", value: "Inflation" },
};

function harness() {
  const snapshots = new Map<string, Record<string, unknown>>();
  const facts = new Map<string, Record<string, unknown>>();
  let writes = 0;
  let selectedTable: unknown;
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
      from: (table: unknown) => {
        selectedTable = table;
        return {
          where: () => ({
            limit: async () =>
              selectedTable === factSnapshots
                ? [{ id: [...snapshots.values()][0]?.id }]
                : [],
          }),
        };
      },
    }),
  };
  return { db: db as never, facts, writes: () => writes };
}

const fixtureFactWriter: CountryFactHistoryWriter = async (database, write) => {
  const fixtureDb = database as unknown as {
    insert: (table: unknown) => {
      values: (value: Record<string, unknown>) => {
        onConflictDoUpdate: () => Promise<unknown>;
      };
    };
  };
  await fixtureDb
    .insert(countryFacts)
    .values(write.values as Record<string, unknown>)
    .onConflictDoUpdate();
};

const historyOptions = {
  atlasReleaseId: "atlas-test",
  writeFact: fixtureFactWriter,
};

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

test("WDI fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = {
    ...historyOptions,
    factKey: "inflation_rate",
    wbCode: "FP.CPI.TOTL.ZG",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["world_bank"]) as never,
  };
  await syncWorldBankWdi(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncWorldBankWdi(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("WDI rejects missing release context before any database write", async () => {
  const state = harness();
  const previousReleaseId = process.env.CIVICA_ATLAS_RELEASE_ID;
  delete process.env.CIVICA_ATLAS_RELEASE_ID;
  try {
    await assert.rejects(
      syncWorldBankWdi(state.db, {
        factKey: "inflation_rate",
        wbCode: "FP.CPI.TOTL.ZG",
        jurisdictions: [jurisdiction],
        fetchIndicator: async () => [observation],
        persistDisputes: noDisputes as never,
        markSynced: (async () => ["world_bank"]) as never,
      }),
      /named Atlas release/,
    );
    assert.equal(state.writes(), 0);
  } finally {
    if (previousReleaseId === undefined) {
      delete process.env.CIVICA_ATLAS_RELEASE_ID;
    } else {
      process.env.CIVICA_ATLAS_RELEASE_ID = previousReleaseId;
    }
  }
});

test("WDI dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = {
    factKey: "inflation_rate",
    wbCode: "FP.CPI.TOTL.ZG",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => []) as never,
    dryRun: true,
  };
  const first = await syncWorldBankWdi(state.db, options);
  const second = await syncWorldBankWdi(state.db, options);
  assert.equal(first.totalWritten, second.totalWritten);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("WDI upstream failure reports loudly and cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncWorldBankWdi(state.db, {
    ...historyOptions,
    factKey: "inflation_rate",
    wbCode: "FP.CPI.TOTL.ZG",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => {
      throw new Error("upstream schema changed");
    },
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => {
      stampedRows.push(options.rowsWritten);
      return [];
    }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, []);
  assert.equal(state.writes(), 0);
});

test("WDI sibling writes cannot hide an empty required target", async () => {
  const state = harness();
  let stampCalls = 0;
  const result = await syncWorldBankWdi(state.db, {
    targets: [
      {
        factKey: "inflation_rate",
        wbCode: "FP.CPI.TOTL.ZG",
        label: "Inflation",
        docUrl: "https://example.test/inflation",
      },
      {
        factKey: "unemployment_rate_pct",
        wbCode: "SL.UEM.TOTL.ZS",
        label: "Unemployment",
        docUrl: "https://example.test/unemployment",
      },
    ],
    jurisdictions: [jurisdiction],
    fetchIndicator: async (wbCode) =>
      wbCode === "FP.CPI.TOTL.ZG" ? [observation] : [],
    persistDisputes: noDisputes as never,
    markSynced: (async () => {
      stampCalls++;
      return ["world_bank"];
    }) as never,
    dryRun: true,
  });

  assert.equal(result.totalWritten, 1);
  assert.match(
    result.errors.join(" "),
    /required subfeed 'unemployment_rate_pct \(SL\.UEM\.TOTL\.ZS\)' produced no usable rows/,
  );
  assert.equal(stampCalls, 0);
});

test("WDI sibling writes cannot hide an all-unmappable required target", async () => {
  const state = harness();
  let stampCalls = 0;
  const result = await syncWorldBankWdi(state.db, {
    targets: [
      {
        factKey: "inflation_rate",
        wbCode: "FP.CPI.TOTL.ZG",
        label: "Inflation",
        docUrl: "https://example.test/inflation",
      },
      {
        factKey: "unemployment_rate_pct",
        wbCode: "SL.UEM.TOTL.ZS",
        label: "Unemployment",
        docUrl: "https://example.test/unemployment",
      },
    ],
    jurisdictions: [jurisdiction],
    fetchIndicator: async (wbCode) =>
      wbCode === "FP.CPI.TOTL.ZG"
        ? [observation]
        : [{ ...observation, countryiso3code: "ZZZ" }],
    persistDisputes: noDisputes as never,
    markSynced: (async () => {
      stampCalls++;
      return ["world_bank"];
    }) as never,
    dryRun: true,
  });

  assert.equal(result.totalWritten, 1);
  assert.match(
    result.errors.join(" "),
    /required subfeed 'unemployment_rate_pct \(SL\.UEM\.TOTL\.ZS\)' produced no usable rows/,
  );
  assert.equal(stampCalls, 0);
});

test("WDI dispute failure blocks freshness and a successful retry stamps once", async () => {
  const state = harness();
  const stamps: Array<{ sourceIds: unknown; rowsWritten: number }> = [];
  let rejectDisputes = true;
  const options = {
    ...historyOptions,
    factKey: "inflation_rate",
    wbCode: "FP.CPI.TOTL.ZG",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: (async () => {
      if (rejectDisputes) throw new Error("dispute ledger unavailable");
      return noDisputes();
    }) as never,
    markSynced: (async (
      sourceIds: unknown,
      markOptions: { rowsWritten: number },
    ) => {
      stamps.push({ sourceIds, rowsWritten: markOptions.rowsWritten });
      return ["world_bank"];
    }) as never,
  };

  const failed = await syncWorldBankWdi(state.db, options);
  assert.match(failed.errors.join(" "), /dispute ledger unavailable/);
  assert.deepEqual(stamps, []);

  rejectDisputes = false;
  const retried = await syncWorldBankWdi(state.db, options);
  assert.deepEqual(retried.errors, []);
  assert.deepEqual(stamps, [
    { sourceIds: "world_bank", rowsWritten: retried.totalWritten },
  ]);
});

test("WDI returned dispute errors block freshness", async () => {
  const state = harness();
  let stampCalls = 0;
  const result = await syncWorldBankWdi(state.db, {
    ...historyOptions,
    factKey: "inflation_rate",
    wbCode: "FP.CPI.TOTL.ZG",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: (async () => ({
      ...(await noDisputes()),
      errors: ["dispute insert rejected"],
    })) as never,
    markSynced: (async () => {
      stampCalls++;
      return ["world_bank"];
    }) as never,
  });

  assert.match(result.errors.join(" "), /disputes: dispute insert rejected/);
  assert.equal(stampCalls, 0);
});
