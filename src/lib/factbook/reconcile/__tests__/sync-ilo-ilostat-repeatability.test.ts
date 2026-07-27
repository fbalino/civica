import assert from "node:assert/strict";
import test from "node:test";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
import type { IloDataRow, IloIndicatorTocRow } from "../sync-ilo-ilostat";
import { syncIloIlostat } from "../sync-ilo-ilostat";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "fixtureland", iso3: "FIX" };
const observation: IloDataRow = { refArea: "FIX", source: "XA:1", indicator: "UNE_2EAP_SEX_AGE_RT_A", sex: "SEX_T", classif1: "AGE_YTHADULT_YGE15", time: 2025, obsValue: 5.2, obsStatus: null };
const tocRow: IloIndicatorTocRow = { id: "UNE_2EAP_SEX_AGE_RT_A", indicator: "UNE_2EAP_SEX_AGE_RT", indicatorLabel: "Unemployment", lastUpdate: "02/12/2025 16:36:06", database: "ILOEST" };

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
const fetchToc = async () => new Map([[tocRow.id, tocRow]]);

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("ILO fixture applications converge on one canonical fact", async () => {
  const state = harness();
  const options = { ...historyOptions, factKey: "unemployment_rate_pct", iloCode: observation.indicator, jurisdictions: [jurisdiction], fetchToc, fetchIndicator: async () => [observation], persistDisputes: noDisputes as never, markSynced: (async () => ["ilo_ilostat"]) as never };
  await syncIloIlostat(state.db, options);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncIloIlostat(state.db, options);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 1);
});

test("ILO dry-run is stable and performs zero database writes", async () => {
  const state = harness();
  const options = { factKey: "unemployment_rate_pct", iloCode: observation.indicator, jurisdictions: [jurisdiction], fetchToc, fetchIndicator: async () => [observation], persistDisputes: noDisputes as never, markSynced: (async () => []) as never, dryRun: true };
  const first = await syncIloIlostat(state.db, options);
  const second = await syncIloIlostat(state.db, options);
  assert.deepEqual(first.countersByFactKey, second.countersByFactKey);
  assert.equal(state.writes(), 0);
});

test("ILO upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stampedRows: number[] = [];
  const result = await syncIloIlostat(state.db, {
    ...historyOptions,
    factKey: "unemployment_rate_pct",
    iloCode: observation.indicator,
    jurisdictions: [jurisdiction],
    fetchToc,
    fetchIndicator: async () => { throw new Error("upstream schema changed"); },
    persistDisputes: noDisputes as never,
    markSynced: (async (_ids: unknown, options: { rowsWritten: number }) => { stampedRows.push(options.rowsWritten); return []; }) as never,
  });
  assert.match(result.errors.join(" "), /upstream schema changed/);
  assert.deepEqual(stampedRows, []);
  assert.equal(state.writes(), 0);
});
