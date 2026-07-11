import assert from "node:assert/strict";
import test from "node:test";
import { governmentBodies, offices, persons, statements, terms } from "@/lib/db/schema";
import { syncCiaCabinets, type CabinetPlan } from "../cia-cabinets-sync";

const plan: CabinetPlan = {
  failed: [],
  countries: [{ slug: "canada", countryName: "Canada", jurisdictionId: "jurisdiction-1", jurisdictionName: "Canada", lastUpdated: "7/1/2026", fetchStatus: 200, parseFailed: false, jurisdictionMatched: true, positions: [{ title: "Minister of Finance", rawName: "Jane DOE", normalizedName: "Jane Doe", order: 0, category: "cabinet", officeType: "cabinet", personPath: "new", qid: null, personId: null }] }],
  stats: { countriesFetched: 1, countriesParsed: 1, countriesUnmatched: 0, countriesFetchFailed: 0, countriesSkipped: 0, positionsTotal: 1, headsSkipped: 0, positionsIngested: 1, named: 1, vacant: 0, byCategory: { head: 0, deputy: 0, cabinet: 1, central_bank: 0, diplomatic: 0, other: 0 }, personExisting: 0, personQid: 0, personNew: 1, distinctNewPersons: 1, distinctQidPersons: 0 },
};

function harness() {
  const rows = new Map<unknown, Array<Record<string, unknown>>>([[governmentBodies, []], [offices, []], [persons, []], [terms, []], [statements, []]]);
  let writes = 0;
  function insert(table: unknown, value: Record<string, unknown>) {
    const list = rows.get(table)!;
    const row = { id: `${String((table as { _: { name: string } })._?.name ?? "row")}-${list.length + 1}`, ...structuredClone(value) };
    list.push(row);
    writes++;
    return row;
  }
  const db = {
    select: () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => (rows.get(table) ?? []).slice(0, 1) }) }) }),
    insert: (table: unknown) => ({ values: (value: Record<string, unknown>) => {
      let inserted: Record<string, unknown> | null = null;
      const run = () => inserted ??= insert(table, value);
      return { returning: async () => [{ id: run().id }], then: (resolve: (value: unknown) => void) => resolve(run()) };
    } }),
    update: (table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: async () => {
      const first = rows.get(table)?.[0];
      if (first) Object.assign(first, structuredClone(value));
      writes++;
    } }) }),
  };
  return { db: db as never, rows, writes: () => writes };
}

function semantic(rows: Map<unknown, Array<Record<string, unknown>>>) {
  return [...rows.values()].flat().map((row) => {
    const copy = structuredClone(row);
    delete copy.retrievedAt;
    return copy;
  });
}

const baseOptions = { slugs: ["canada"], plan, crawlDelayMs: 0, markSynced: (async () => ["cia_world_leaders"]) as never };

test("CIA cabinet fixture applications create no duplicate canonical rows", async () => {
  const state = harness();
  await syncCiaCabinets({ ...baseOptions, db: state.db });
  const first = semantic(state.rows);
  await syncCiaCabinets({ ...baseOptions, db: state.db });
  assert.deepEqual(semantic(state.rows), first);
  assert.equal(state.rows.get(governmentBodies)?.length, 1);
  assert.equal(state.rows.get(offices)?.length, 1);
  assert.equal(state.rows.get(persons)?.length, 1);
  assert.equal(state.rows.get(terms)?.length, 1);
  assert.equal(state.rows.get(statements)?.length, 1);
  assert.equal(state.rows.get(statements)?.[0].subjectTable, "terms");
  assert.equal(state.rows.get(statements)?.[0].subjectId, state.rows.get(terms)?.[0].id);
});

test("CIA cabinet dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const first = await syncCiaCabinets({ ...baseOptions, db: state.db, dryRun: true });
  const second = await syncCiaCabinets({ ...baseOptions, db: state.db, dryRun: true });
  assert.deepEqual({ applied: first.countriesApplied, rows: first.totalRowsWritten }, { applied: second.countriesApplied, rows: second.totalRowsWritten });
  assert.equal(state.writes(), 0);
});

test("CIA cabinet partial upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stamped: number[] = [];
  const failedPlan = { ...plan, failed: [{ slug: "canada", reason: "HTML schema changed" }] };
  const result = await syncCiaCabinets({ ...baseOptions, db: state.db, plan: failedPlan, markSynced: (async (_id: unknown, options: { rowsWritten: number }) => { stamped.push(options.rowsWritten); return []; }) as never });
  assert.equal(result.skipped[0]?.reason, "HTML schema changed");
  assert.deepEqual(stamped, [0]);
});
