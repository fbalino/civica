import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
import type { UnDataRow } from "../sync-un-data";
import { syncUnData, UN_WPP_BULK_URL } from "../sync-un-data";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "nigeria", iso3: "NGA" };
const observation: UnDataRow = { countryCode: 566, countryName: "Nigeria", year: 2024, variant: "Medium", value: 232679.478 };

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
  return { db: db as never, facts, snapshots, writes: () => writes };
}

const fixtureFactWriter: CountryFactHistoryWriter = async (database, write) => {
  const fixtureDb = database as unknown as {
    insert: (table: unknown) => {
      values: (value: Record<string, unknown>) => {
        onConflictDoUpdate: () => Promise<unknown>;
      };
    };
  };
  await fixtureDb.insert(countryFacts).values(write.values as Record<string, unknown>).onConflictDoUpdate();
};

const historyOptions = { atlasReleaseId: "atlas-test", writeFact: fixtureFactWriter };

const noDisputes = async () => ({ jurisdictionsScanned: 1, pairsScanned: 1, proposedTotal: 0, inserted: 0, skippedDuplicate: 0, skippedNoFactGroup: 0, errors: [] });

const BULK_HEADER = [
  "LocID",
  "ISO3_code",
  "Location",
  "Variant",
  "Time",
  "TPopulation1July",
  "PopGrowthRate",
  "TFR",
  "CBR",
  "CDR",
  "LEx",
  "LExMale",
  "IMR",
].join(",");

function bulkFixture(...rows: string[]) {
  return gzipSync(`\uFEFF${BULK_HEADER}\n${rows.join("\n")}\n`);
}

const nigeriaBulkRow =
  "566,NGA,Nigeria,Medium,2024,232679.478,2.07,4.3818,32.493,11.641,54.6349,54.3266,68.4611";
const uruguayBulkRow =
  "858,URY,Uruguay,Medium,2024,3386.588,-0.053,1.3973,9.802,9.933,78.2865,74.3838,5.9213";

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("UN Data fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = {
    ...historyOptions,
    factKey: "population_total",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => ["un_data"]) as never,
  };
  await syncUnData(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncUnData(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("UN Data dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = {
    factKey: "population_total",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => [observation],
    persistDisputes: noDisputes as never,
    markSynced: (async () => []) as never,
    dryRun: true,
  };
  const first = await syncUnData(state.db, options);
  const second = await syncUnData(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("UN Data upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncUnData(state.db, {
    ...historyOptions,
    factKey: "population_total",
    jurisdictions: [jurisdiction],
    fetchIndicator: async () => { throw new Error("upstream schema changed"); },
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stampedRows.push(options.rowsWritten); return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, []);
  assert.equal(state.writes(), 0);
});

test("UN WPP bulk source fetches once and maps the official 2024 fields", async () => {
  const state = harness();
  let fetches = 0;
  const stampedRows: number[] = [];
  const archive = bulkFixture(nigeriaBulkRow, uruguayBulkRow);
  const result = await syncUnData(state.db, {
    ...historyOptions,
    jurisdictions: [
      jurisdiction,
      {
        id: "22222222-2222-4222-8222-222222222222",
        slug: "uruguay",
        iso3: "URY",
      },
    ],
    fetchBulk: async () => {
      fetches++;
      return archive;
    },
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => {
      stampedRows.push(options.rowsWritten);
      return ["un_data"];
    }) as never,
  });

  assert.equal(fetches, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalWritten, 14);
  assert.deepEqual(stampedRows, [14]);

  const nigeriaPopulation = state.facts.get(
    `${jurisdiction.id}:population_total:un_data`,
  );
  assert.equal(nigeriaPopulation?.factValue, "232679478");
  assert.equal(nigeriaPopulation?.factYear, 2024);
  assert.equal(nigeriaPopulation?.asOf, "2024-01-01");
  assert.equal(nigeriaPopulation?.sourceUrl, UN_WPP_BULK_URL);

  const uruguayPopulation = state.facts.get(
    "22222222-2222-4222-8222-222222222222:population_total:un_data",
  );
  assert.equal(uruguayPopulation?.factValue, "3386588");

  const uruguayLifeExpectancy = state.facts.get(
    "22222222-2222-4222-8222-222222222222:life_expectancy_years:un_data",
  );
  assert.equal(uruguayLifeExpectancy?.factValueNumeric, 78.2865);
  assert.notEqual(uruguayLifeExpectancy?.factValueNumeric, 74.3838);
  assert.equal(uruguayLifeExpectancy?.factUnit, "years");

  const lifeSnapshot = [...state.snapshots.values()].find(
    (snapshot) =>
      (snapshot.payload as Record<string, unknown>).sourceColumn === "LEx" &&
      (snapshot.payload as Record<string, unknown>).iso3 === "URY",
  );
  assert.ok(lifeSnapshot);
  const lifePayload = lifeSnapshot.payload as Record<string, unknown>;
  assert.equal(lifePayload.endpoint, UN_WPP_BULK_URL);
  assert.equal(lifePayload.sourceColumn, "LEx");
  assert.equal(lifePayload.legacyUnDataVariableId, 66);
  assert.equal(lifePayload.unVarId, undefined);
  assert.equal(
    lifePayload.inputSha256,
    createHash("sha256").update(archive).digest("hex"),
  );
});

test("UN WPP invalid bulk payloads fail closed without writes or freshness", async (t) => {
  const invalidCases = [
    {
      name: "former endpoint HTML",
      archive: Buffer.from("<!doctype html><title>UN Data Commons</title>"),
      error: /did not return a gzip payload/,
    },
    {
      name: "empty 2024 subfeed",
      archive: bulkFixture(),
      error: /no ISO3 country observations for 2024/,
    },
    {
      name: "duplicate country-year",
      archive: bulkFixture(nigeriaBulkRow, nigeriaBulkRow),
      error: /duplicate country-year NGA:2024/,
    },
    {
      name: "malformed selected value",
      archive: bulkFixture(
        nigeriaBulkRow.replace(",4.3818,", ",not-a-number,"),
      ),
      error: /TFR is not a finite number/,
    },
    {
      name: "missing required header",
      archive: gzipSync(
        `${BULK_HEADER.replace(",IMR", "")}\n${nigeriaBulkRow
          .split(",")
          .slice(0, -1)
          .join(",")}\n`,
      ),
      error: /missing required headers: IMR/,
    },
  ];

  for (const invalid of invalidCases) {
    await t.test(invalid.name, async () => {
      const state = harness();
      const stampedRows: number[] = [];
      const result = await syncUnData(state.db, {
        ...historyOptions,
        factKey: "population_total",
        jurisdictions: [jurisdiction],
        fetchBulk: async () => invalid.archive,
        persistDisputes: noDisputes as never,
        markSynced: (async (
          _ids: unknown,
          options: { rowsWritten: number },
        ) => {
          stampedRows.push(options.rowsWritten);
          return [];
        }) as never,
      });
      assert.match(result.errors.join(" "), invalid.error);
      assert.equal(result.totalWritten, 0);
      assert.equal(state.writes(), 0);
      assert.deepEqual(stampedRows, []);
    });
  }
});
