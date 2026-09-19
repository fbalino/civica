import assert from "node:assert/strict";
import test from "node:test";
import { governmentBodies, offices, persons, statements, terms } from "@/lib/db/schema";
import { syncCiaCabinets, type CabinetPlan } from "../cia-cabinets-sync";

const plan: CabinetPlan = {
  failed: [],
  countries: [{ slug: "canada", countryName: "Canada", jurisdictionId: "jurisdiction-1", jurisdictionName: "Canada", lastUpdated: "7/1/2026", fetchStatus: 200, parseFailed: false, jurisdictionMatched: true, positions: [{ title: "Minister of Finance", rawName: "Jane DOE", normalizedName: "Jane Doe", order: 0, category: "cabinet", officeType: "cabinet", personPath: "new", qid: null, personId: "30000000-0000-4000-8000-000000000001" }] }],
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
    select: () => ({ from: (table: unknown) => ({ where: () => {
      const selected = rows.get(table) ?? [];
      return {
        limit: async () => selected.slice(0, 1),
        then: (resolve: (value: Array<Record<string, unknown>>) => void) => resolve(selected),
      };
    } }) }),
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
  const entityWriters = {
    upsertBody: async (_db: never, input: Record<string, unknown>) => {
      const list = rows.get(governmentBodies)!;
      let row = list.find(
        (candidate) =>
          candidate.jurisdictionId === input.jurisdictionId &&
          candidate.branch === input.branch,
      );
      if (!row) {
        row = insert(governmentBodies, {
          id: "10000000-0000-4000-8000-000000000001",
          jurisdictionId: input.jurisdictionId,
          name: input.name,
          bodyType: input.bodyType,
          branch: input.branch,
        });
      }
      return row.id as string;
    },
    upsertOffice: async (_db: never, input: Record<string, unknown>) => {
      const list = rows.get(offices)!;
      let row = list.find(
        (candidate) =>
          candidate.id === input.stableId ||
          (candidate.bodyId === input.bodyId && candidate.name === input.name),
      );
      if (!row) {
        const occupiedOrder = list.find(
          (candidate) =>
            candidate.bodyId === input.bodyId &&
            candidate.displayOrder === input.displayOrder,
        );
        if (occupiedOrder) {
          throw new Error(
            "Office mutation did not resolve one stable row; identity is ambiguous or unsafe",
          );
        }
        row = insert(offices, {
          id: `office-${list.length + 1}`,
          bodyId: input.bodyId,
          name: input.name,
          officeType: input.officeType,
          isElected: input.isElected,
          displayOrder: input.displayOrder,
        });
      } else {
        Object.assign(row, {
          name: input.name,
          officeType: input.officeType,
          displayOrder: input.displayOrder,
        });
      }
      return row.id as string;
    },
    mutatePerson: async (_db: never, input: {
      stableId?: string;
      insertName: string;
      values: Record<string, unknown>;
    }) => {
      const list = rows.get(persons)!;
      let row = list.find((candidate) => candidate.id === input.stableId);
      if (!row) {
        row = insert(persons, {
          id: input.stableId,
          name: input.insertName,
          ...structuredClone(input.values),
        });
      } else {
        Object.assign(row, structuredClone(input.values));
      }
      return row.id as string;
    },
  };
  return { db: db as never, entityWriters: entityWriters as never, rows, writes: () => writes };
}

function semantic(rows: Map<unknown, Array<Record<string, unknown>>>) {
  return [...rows.values()].flat().map((row) => {
    const copy = structuredClone(row);
    delete copy.retrievedAt;
    return copy;
  });
}

const baseOptions = { slugs: ["canada"], plan, crawlDelayMs: 0, markSynced: (async () => ["cia_world_leaders"]) as never, atlasReleaseId: "atlas-test" };

function planWithPositions(
  positions: CabinetPlan["countries"][number]["positions"],
): CabinetPlan {
  return {
    ...plan,
    countries: [{ ...plan.countries[0], positions }],
    stats: {
      ...plan.stats,
      positionsTotal: positions.length,
      positionsIngested: positions.length,
      named: positions.filter((position) => position.rawName).length,
      vacant: positions.filter((position) => !position.rawName).length,
      byCategory: {
        head: 0,
        deputy: 0,
        cabinet: positions.length,
        central_bank: 0,
        diplomatic: 0,
        other: 0,
      },
    },
  };
}

test("CIA cabinet fixture applications create no duplicate canonical rows", async () => {
  const state = harness();
  await syncCiaCabinets({ ...baseOptions, db: state.db, entityWriters: state.entityWriters });
  const first = semantic(state.rows);
  await syncCiaCabinets({ ...baseOptions, db: state.db, entityWriters: state.entityWriters });
  assert.deepEqual(semantic(state.rows), first);
  assert.equal(state.rows.get(governmentBodies)?.length, 1);
  assert.equal(state.rows.get(offices)?.length, 1);
  assert.equal(state.rows.get(persons)?.length, 1);
  assert.equal(state.rows.get(terms)?.length, 1);
  assert.equal(state.rows.get(statements)?.length, 1);
  assert.equal(state.rows.get(statements)?.[0].subjectTable, "terms");
  assert.equal(state.rows.get(statements)?.[0].subjectId, state.rows.get(terms)?.[0].id);
});

test("CIA cabinet inserts a new office before an unchanged office without changing the retained identity", async () => {
  const state = harness();
  const bodyId = "10000000-0000-4000-8000-000000000001";
  const financeOfficeId = "20000000-0000-4000-8000-000000000001";
  const financePersonId = "30000000-0000-4000-8000-000000000001";
  state.rows.get(governmentBodies)?.push({
    id: bodyId,
    jurisdictionId: "jurisdiction-1",
    name: "Executive of Canada",
    bodyType: "cabinet",
    branch: "executive",
  });
  state.rows.get(offices)?.push({
    id: financeOfficeId,
    bodyId,
    name: "Minister of Finance",
    officeType: "cabinet",
    isElected: false,
    displayOrder: 15,
  });
  state.rows.get(persons)?.push({ id: financePersonId, name: "Jane Doe" });

  const insertionPlan = planWithPositions([
    {
      title: "Minister of Environment",
      rawName: null,
      normalizedName: null,
      order: 15,
      category: "cabinet",
      officeType: "cabinet",
      personPath: null,
      qid: null,
      personId: null,
    },
    {
      title: "Minister of Finance",
      rawName: "Jane DOE",
      normalizedName: "Jane Doe",
      order: 16,
      category: "cabinet",
      officeType: "cabinet",
      personPath: "existing",
      qid: null,
      personId: financePersonId,
    },
  ]);
  const options = {
    ...baseOptions,
    plan: insertionPlan,
    db: state.db,
    entityWriters: state.entityWriters,
  };

  const first = await syncCiaCabinets(options);
  const financeAfterFirst = state.rows
    .get(offices)
    ?.find((row) => row.name === "Minister of Finance");
  const environmentAfterFirst = state.rows
    .get(offices)
    ?.find((row) => row.name === "Minister of Environment");
  const firstTermId = state.rows.get(terms)?.[0]?.id;
  const firstStatementId = state.rows.get(statements)?.[0]?.id;

  assert.deepEqual(first.skipped, []);
  assert.equal(financeAfterFirst?.id, financeOfficeId);
  assert.equal(financeAfterFirst?.displayOrder, 16);
  assert.equal(environmentAfterFirst?.displayOrder, 15);
  assert.notEqual(environmentAfterFirst?.id, financeOfficeId);
  assert.equal(state.rows.get(terms)?.length, 1);
  assert.equal(state.rows.get(statements)?.length, 1);
  assert.equal(state.rows.get(statements)?.[0]?.subjectId, firstTermId);
  assert.equal(state.rows.get(statements)?.[0]?.sourceId, "cia_world_leaders");

  const second = await syncCiaCabinets(options);
  assert.deepEqual(second.skipped, []);
  assert.equal(
    state.rows.get(offices)?.find((row) => row.name === "Minister of Finance")?.id,
    financeOfficeId,
  );
  assert.equal(state.rows.get(offices)?.length, 2);
  assert.equal(state.rows.get(terms)?.length, 1);
  assert.equal(state.rows.get(terms)?.[0]?.id, firstTermId);
  assert.equal(state.rows.get(statements)?.length, 1);
  assert.equal(state.rows.get(statements)?.[0]?.id, firstStatementId);
});

test("CIA cabinet still rejects a genuine same-slot title rename", async () => {
  const state = harness();
  const bodyId = "10000000-0000-4000-8000-000000000001";
  state.rows.get(governmentBodies)?.push({
    id: bodyId,
    jurisdictionId: "jurisdiction-1",
    name: "Executive of Canada",
    bodyType: "cabinet",
    branch: "executive",
  });
  state.rows.get(offices)?.push({
    id: "20000000-0000-4000-8000-000000000001",
    bodyId,
    name: "Old Ministry Title",
    officeType: "cabinet",
    isElected: false,
    displayOrder: 15,
  });
  const stamped: number[] = [];
  const renamePlan = planWithPositions([
    {
      title: "New Ministry Title",
      rawName: null,
      normalizedName: null,
      order: 15,
      category: "cabinet",
      officeType: "cabinet",
      personPath: null,
      qid: null,
      personId: null,
    },
  ]);

  const result = await syncCiaCabinets({
    ...baseOptions,
    plan: renamePlan,
    db: state.db,
    entityWriters: state.entityWriters,
    markSynced: (async (_id: unknown, options: { rowsWritten: number }) => {
      stamped.push(options.rowsWritten);
      return [];
    }) as never,
  });

  assert.equal(result.countriesSkipped, 1);
  assert.deepEqual(result.skipped, [
    {
      slug: "canada",
      code: "office_identity_conflict",
      reason: "Office identity is ambiguous or unsafe",
    },
  ]);
  assert.deepEqual(renamePlan.failed, []);
  assert.equal(state.rows.get(offices)?.length, 1);
  assert.equal(state.rows.get(offices)?.[0]?.name, "Old Ministry Title");
  assert.deepEqual(stamped, [0]);
  assert.equal(result.freshnessStamped, false);
});

test("CIA cabinet dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const first = await syncCiaCabinets({ ...baseOptions, db: state.db, entityWriters: state.entityWriters, dryRun: true });
  const second = await syncCiaCabinets({ ...baseOptions, db: state.db, entityWriters: state.entityWriters, dryRun: true });
  assert.deepEqual({ applied: first.countriesApplied, rows: first.totalRowsWritten }, { applied: second.countriesApplied, rows: second.totalRowsWritten });
  assert.equal(state.writes(), 0);
});

test("CIA cabinet dry-run rejects an invalid release before reads or fetches", async () => {
  let databaseReads = 0;
  let fetches = 0;
  const db = {
    select: () => {
      databaseReads++;
      throw new Error("database must not be read");
    },
  };

  await assert.rejects(
    syncCiaCabinets({
      atlasReleaseId: "release with spaces",
      db: db as never,
      slugs: ["canada"],
      dryRun: true,
      fetchCountryPage: async () => {
        fetches++;
        return { ok: true, status: 200, html: "" };
      },
    }),
    /named Atlas release/,
  );
  assert.equal(databaseReads, 0);
  assert.equal(fetches, 0);
});

test("CIA cabinet apply fails closed before entity writes without a named release", async () => {
  const state = harness();
  await assert.rejects(
    syncCiaCabinets({
      ...baseOptions,
      atlasReleaseId: "release with spaces",
      db: state.db,
      entityWriters: state.entityWriters,
    }),
    /named Atlas release/,
  );
  assert.equal(state.rows.get(governmentBodies)?.length, 0);
  assert.equal(state.rows.get(offices)?.length, 0);
  assert.equal(state.rows.get(persons)?.length, 0);
});

test("CIA cabinet partial upstream failure cannot stamp freshness", async () => {
  const state = harness();
  const stamped: number[] = [];
  const failedPlan: CabinetPlan = {
    ...plan,
    failed: [{ slug: "ghana", code: "upstream_http_error", reason: "CIA World Leaders returned HTTP 503" }],
    stats: {
      ...plan.stats,
      countriesFetched: 2,
      countriesFetchFailed: 1,
      countriesSkipped: 1,
    },
  };
  const result = await syncCiaCabinets({ ...baseOptions, db: state.db, entityWriters: state.entityWriters, plan: failedPlan, markSynced: (async (_id: unknown, options: { rowsWritten: number }) => { stamped.push(options.rowsWritten); return []; }) as never });
  assert.equal(result.totalRowsWritten, 3);
  assert.equal(result.countriesSkipped, 1);
  assert.equal(result.skipped[0]?.reason, "CIA World Leaders returned HTTP 503");
  assert.deepEqual(stamped, [0]);
  assert.equal(result.freshnessStamped, false);
});

test("CIA cabinet expected 404 does not block freshness for successful countries", async () => {
  const state = harness();
  const stamped: number[] = [];
  const planWithExpectedAbsence: CabinetPlan = {
    ...plan,
    countries: [
      ...plan.countries,
      {
        slug: "united-states",
        countryName: null,
        jurisdictionId: null,
        jurisdictionName: null,
        lastUpdated: null,
        fetchStatus: 404,
        parseFailed: true,
        jurisdictionMatched: false,
        positions: [],
      },
    ],
    stats: {
      ...plan.stats,
      countriesFetched: 2,
      countriesFetchFailed: 1,
    },
  };
  const result = await syncCiaCabinets({
    ...baseOptions,
    db: state.db,
    entityWriters: state.entityWriters,
    plan: planWithExpectedAbsence,
    markSynced: (async (_id: unknown, options: { rowsWritten: number }) => {
      stamped.push(options.rowsWritten);
      return options.rowsWritten > 0 ? ["cia_world_leaders"] : [];
    }) as never,
  });

  assert.deepEqual(result.skipped, []);
  assert.deepEqual(stamped, [3]);
  assert.equal(result.freshnessStamped, true);
});
