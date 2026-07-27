import assert from "node:assert/strict";
import test from "node:test";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { InseeSeries } from "../sync-insee-fr";
import { syncInseeFr } from "../sync-insee-fr";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "france", iso2: "FR", iso3: "FRA" };
const series: InseeSeries = { idbank: "001760077", freq: "A", refArea: "FE", unitMeasure: "PS", unitMult: 0, lastUpdate: "2026-01-01", titleEn: "Population", titleFr: "Population", decimals: 0, obs: [{ timePeriod: "2025", value: 68000000, obsStatus: null }] };

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
  const writeFact: CountryFactHistoryWriter = async (_database, { values }) => {
    await db.insert(countryFacts).values(values as unknown as Record<string, unknown>).onConflictDoUpdate();
  };
  return { db: db as never, facts, writeFact, writes: () => writes };
}

const noDisputes = async () => ({ jurisdictionsScanned: 1, pairsScanned: 1, proposedTotal: 0, inserted: 0, skippedDuplicate: 0, skippedNoFactGroup: 0, errors: [] });
const fetchIndicator = async () => ({ series, latest: series.obs[0], observationCount: 1 });

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("INSEE fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = { factKey: "population_total", idbank: series.idbank, jurisdiction, fetchIndicator: fetchIndicator as never, persistDisputes: noDisputes as never, markSynced: (async () => ["insee_fr"]) as never, atlasReleaseId: "atlas-test", writeFact: state.writeFact };
  await syncInseeFr(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncInseeFr(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("INSEE dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = { factKey: "population_total", idbank: series.idbank, jurisdiction, fetchIndicator: fetchIndicator as never, persistDisputes: noDisputes as never, markSynced: (async () => []) as never, dryRun: true };
  const first = await syncInseeFr(state.db, options);
  const second = await syncInseeFr(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("INSEE upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncInseeFr(state.db, {
    factKey: "population_total",
    idbank: series.idbank,
    jurisdiction,
    fetchIndicator: (async () => { throw new Error("upstream schema changed"); }) as never,
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stampedRows.push(options.rowsWritten); return []; }) as never,
    atlasReleaseId: "atlas-test",
    writeFact: state.writeFact,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, []);
  assert.equal(state.writes(), 0);
});
