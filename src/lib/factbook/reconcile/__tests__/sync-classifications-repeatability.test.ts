import assert from "node:assert/strict";
import test from "node:test";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
import { countryFacts, factSnapshots } from "@/lib/db/schema";
import {
  syncMonarchyAndGovernmentForm,
  syncVdemRow,
  syncWorldBankClassifications,
  type WbCountry,
} from "../sync-classifications";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "canada", iso3: "CAN" };
const governmentJurisdiction = { id: jurisdiction.id, slug: "canada", governmentTypeDetail: "a parliamentary democracy under a constitutional monarchy", governmentType: "parliamentary democracy" };
const wbCountry: WbCountry = { id: "CAN", iso2Code: "CA", name: "Canada", region: { id: "NAC", iso2code: "XU", value: "North America" }, incomeLevel: { id: "HIC", iso2code: "XD", value: "High income" } };

function harness() {
  const snapshots = new Map<string, Record<string, unknown>>();
  const facts = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    insert: (table: unknown) => ({ values: (value: Record<string, unknown>) => ({
      onConflictDoNothing: async () => {
        if (table === factSnapshots && !snapshots.has(String(value.payloadHash))) {
          snapshots.set(String(value.payloadHash), structuredClone(value));
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
  };
  const writeFact: CountryFactHistoryWriter = async (_database, { values }) => {
    await db.insert(countryFacts).values(values as unknown as Record<string, unknown>).onConflictDoUpdate();
  };
  return { db: db as never, facts, writeFact, writes: () => writes };
}

function canonicalFacts(facts: Map<string, Record<string, unknown>>) {
  return [...facts.entries()].map(([key, value]) => {
    const canonical = structuredClone(value);
    delete canonical.retrievedAt;
    delete canonical.updatedAt;
    return [key, canonical];
  });
}

test("classification fixtures converge on canonical rows", async () => {
  const state = harness();
  const markSynced = (async () => []) as never;
  const wb = { jurisdictions: [jurisdiction], fetchCountries: async () => [wbCountry], markSynced, atlasReleaseId: "atlas-test", writeFact: state.writeFact };
  const vdem = { jurisdictions: [jurisdiction], fetchRows: async () => new Map([["CAN", { iso3: "CAN", v2xRegime: 3 }]]), markSynced, atlasReleaseId: "atlas-test", writeFact: state.writeFact };
  const monarchy = { jurisdictions: [governmentJurisdiction], markSynced, atlasReleaseId: "atlas-test", writeFact: state.writeFact };
  await syncWorldBankClassifications(state.db, wb);
  await syncVdemRow(state.db, vdem);
  await syncMonarchyAndGovernmentForm(state.db, monarchy);
  const first = structuredClone(canonicalFacts(state.facts));
  await syncWorldBankClassifications(state.db, wb);
  await syncVdemRow(state.db, vdem);
  await syncMonarchyAndGovernmentForm(state.db, monarchy);
  assert.deepEqual(canonicalFacts(state.facts), first);
  assert.equal(state.facts.size, 5);
});

test("classification dry-runs are stable and perform zero writes", async () => {
  const state = harness();
  const markSynced = (async () => []) as never;
  const wbOptions = { jurisdictions: [jurisdiction], fetchCountries: async () => [wbCountry], markSynced, dryRun: true };
  const vdemOptions = { jurisdictions: [jurisdiction], fetchRows: async () => new Map([["CAN", { iso3: "CAN", v2xRegime: 3 }]]), markSynced, dryRun: true };
  const monarchyOptions = { jurisdictions: [governmentJurisdiction], markSynced, dryRun: true };
  const firstWb = await syncWorldBankClassifications(state.db, wbOptions);
  const secondWb = await syncWorldBankClassifications(state.db, wbOptions);
  assert.deepEqual(
    { matched: firstWb.jurisdictionsMatched, region: firstWb.regionRowsWritten, income: firstWb.incomeRowsWritten, errors: firstWb.errors },
    { matched: secondWb.jurisdictionsMatched, region: secondWb.regionRowsWritten, income: secondWb.incomeRowsWritten, errors: secondWb.errors },
  );
  const firstVdem = await syncVdemRow(state.db, vdemOptions);
  const secondVdem = await syncVdemRow(state.db, vdemOptions);
  assert.deepEqual(
    { matched: firstVdem.jurisdictionsMatched, written: firstVdem.rowsWritten, errors: firstVdem.errors },
    { matched: secondVdem.jurisdictionsMatched, written: secondVdem.rowsWritten, errors: secondVdem.errors },
  );
  const firstMonarchy = await syncMonarchyAndGovernmentForm(state.db, monarchyOptions);
  const secondMonarchy = await syncMonarchyAndGovernmentForm(state.db, monarchyOptions);
  assert.deepEqual(firstMonarchy.monarchyBuckets, secondMonarchy.monarchyBuckets);
  assert.equal(state.writes(), 0);
});

test("classification upstream failures cannot stamp freshness", async () => {
  const state = harness();
  const stamped: number[] = [];
  const markSynced = (async (_ids: unknown, options: { rowsWritten: number }) => { stamped.push(options.rowsWritten); return []; }) as never;
  const wb = await syncWorldBankClassifications(state.db, { jurisdictions: [jurisdiction], fetchCountries: async () => { throw new Error("WB schema changed"); }, markSynced, atlasReleaseId: "atlas-test", writeFact: state.writeFact });
  const vdem = await syncVdemRow(state.db, { jurisdictions: [jurisdiction], fetchRows: async () => { throw new Error("QoG schema changed"); }, markSynced, atlasReleaseId: "atlas-test", writeFact: state.writeFact });
  assert.match(wb.errors.join(" "), /WB schema changed/);
  assert.match(vdem.errors.join(" "), /QoG schema changed/);
  assert.deepEqual(stamped, []);
  assert.equal(state.writes(), 0);
});
