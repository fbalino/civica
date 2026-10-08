import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
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
  const options = { ...historyOptions, factKey: "fiscal_balance_pct_gdp", jurisdictions: [jurisdiction], fetchIndicator: fetchIndicator as never, persistDisputes: noDisputes as never, markSynced: (async () => ["oecd_stat"]) as never };
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
    ...historyOptions,
    factKey: "fiscal_balance_pct_gdp",
    jurisdictions: [jurisdiction],
    fetchIndicator: (async () => { throw new Error("upstream schema changed"); }) as never,
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stampedRows.push(options.rowsWritten); return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, []);
  assert.equal(state.writes(), 0);
});

test("OECD health uses populated SHA 1.1 while retaining GDP units and partner coverage", async (t) => {
  // OECD metadata retrieved 2026-10-08: SHA 1.0 has zero observations;
  // SHA 1.1 retains the same dimensions. Values below are its USA/BRA rows.
  const state = harness();
  const requested: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requested.push(url);
    if (!url.pathname.includes(",DSD_SHA@DF_SHA,1.1/")) {
      return new Response("No Records Found", { status: 404 });
    }
    return Response.json({ data: {
      structure: { dimensions: { observation: [
        { id: "REF_AREA", values: [{ id: "USA" }, { id: "BRA" }] },
        { id: "TIME_PERIOD", values: [{ id: "2022" }, { id: "2024" }] },
      ] } },
      dataSets: [{ observations: { "0:0": [16.744], "0:1": [17.202], "1:0": [9.387] } }],
    } });
  });
  const result = await syncOecdStat(state.db, {
    ...historyOptions, factKey: "health_expenditure_pct_gdp",
    jurisdictions: [jurisdiction, { id: "22222222-2222-4222-8222-222222222222", slug: "brazil", iso3: "BRA" }],
    persistDisputes: noDisputes as never, markSynced: (async () => []) as never,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(requested.length, 1);
  assert.equal(requested[0].pathname.split("/").at(-1), ".A.EXP_HEALTH.PT_B1GQ._T.._T._T._T...");
  assert.equal(requested[0].searchParams.get("dimensionAtObservation"), "AllDimensions");
  assert.equal(result.countersByFactKey.health_expenditure_pct_gdp.jurisdictions_with_value, 2);
  const values = [...state.facts.values()];
  assert.equal(values.find(row => row.jurisdictionId === jurisdiction.id)?.factValue, "17.202");
  assert.equal(values.find(row => row.jurisdictionId !== jurisdiction.id)?.factValue, "9.387");
});
