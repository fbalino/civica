import assert from "node:assert/strict";
import test from "node:test";
import { governmentBodies, jurisdictions, offices, persons, statements, terms } from "@/lib/db/schema";
import { syncFactbookOfficeholders, type EnrichmentPlan } from "../officeholders-sync";

const binding = {
  state: { type: "uri", value: "http://www.wikidata.org/entity/Q16" },
  stateLabel: { type: "literal", value: "Canada" },
  iso2: { type: "literal", value: "CA" }, iso3: { type: "literal", value: "CAN" },
  headOfState: { type: "uri", value: "http://www.wikidata.org/entity/Q100" },
  headOfStateLabel: { type: "literal", value: "Jane Doe" },
  hosStart: { type: "literal", value: "2026-01-01T00:00:00Z" },
};

const emptyPlan: EnrichmentPlan = {
  titles: [], parties: [], portraits: [], birthdates: [], skippedPortraits: [], noImage: [], stayGeneric: [],
  stats: { spineRows: 0, titleResolved: 0, titleStaysGeneric: 0, partylessConsidered: 0, partyResolved: 0, colorFromWikidata: 0, colorFromLegislature: 0, colorMissing: 0, mediaPersons: 0, portraitFound: 0, portraitFree: 0, portraitSkippedNonFree: 0, portraitNoImage: 0, portraitAlreadyCurrent: 0, dobFound: 0, dobAlreadyCurrent: 0 },
};

function harness() {
  const rows = new Map<unknown, Array<Record<string, unknown>>>([[jurisdictions, [{ id: "jurisdiction-1", slug: "canada" }]], [governmentBodies, []], [offices, []], [persons, []], [terms, []], [statements, []]]);
  let writes = 0;
  function insert(table: unknown, value: Record<string, unknown>) {
    const list = rows.get(table)!;
    const row = { id: `row-${list.length + 1}`, ...structuredClone(value) };
    list.push(row); writes++; return row;
  }
  const db = {
    select: () => ({ from: (table: unknown) => {
      const query = {
        where: () => ({ limit: async () => (rows.get(table) ?? []).slice(0, 1) }),
        then: (resolve: (value: unknown) => void) => resolve(rows.get(table) ?? []),
      };
      return query;
    } }),
    insert: (table: unknown) => ({ values: (value: Record<string, unknown>) => {
      let inserted: Record<string, unknown> | null = null;
      const run = () => inserted ??= insert(table, value);
      return { returning: async () => [{ id: run().id }], then: (resolve: (value: unknown) => void) => resolve(run()) };
    } }),
    update: (table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: async () => {
      const first = rows.get(table)?.[0]; if (first) Object.assign(first, structuredClone(value)); writes++;
    } }) }),
  };
  return { db: db as never, rows, writes: () => writes };
}

function semantic(rows: Map<unknown, Array<Record<string, unknown>>>) {
  return [...rows.values()].flat().map((row) => { const copy = structuredClone(row); delete copy.retrievedAt; return copy; });
}

const personPass = async () => ({ candidates: 0, portraitsWritten: 0, birthdatesWritten: 0 });
const options = { bindings: [binding] as never, findJurisdictionId: async () => "jurisdiction-1", enrichmentPlan: emptyPlan, enrichPersons: personPass as never, markSynced: (async () => ["wikidata"]) as never };

test("officeholder fixture applications create no duplicate canonical rows", async () => {
  const state = harness();
  await syncFactbookOfficeholders({ ...options, db: state.db });
  const first = semantic(state.rows);
  await syncFactbookOfficeholders({ ...options, db: state.db });
  assert.deepEqual(semantic(state.rows), first);
  assert.equal(state.rows.get(persons)?.length, 1);
  assert.equal(state.rows.get(terms)?.length, 1);
  assert.equal(state.rows.get(statements)?.length, 1);
});

test("officeholder dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const first = await syncFactbookOfficeholders({ ...options, db: state.db, dryRun: true });
  const second = await syncFactbookOfficeholders({ ...options, db: state.db, dryRun: true });
  assert.deepEqual({ countries: first.countriesSynced, rows: first.totalRowsWritten }, { countries: second.countriesSynced, rows: second.totalRowsWritten });
  assert.equal(state.writes(), 0);
});

test("malformed officeholder input fails before freshness", async () => {
  const state = harness();
  const stamped: number[] = [];
  await assert.rejects(syncFactbookOfficeholders({ ...options, db: state.db, bindings: [{}] as never, markSynced: (async (_id: unknown, value: { rowsWritten: number }) => { stamped.push(value.rowsWritten); return []; }) as never }));
  assert.deepEqual(stamped, []);
});
