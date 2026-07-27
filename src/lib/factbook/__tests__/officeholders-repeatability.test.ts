import assert from "node:assert/strict";
import test from "node:test";
import { governmentBodies, jurisdictions, offices, persons, statements, terms } from "@/lib/db/schema";
import {
  resolveOfficeholderBindings,
  syncFactbookOfficeholders,
  type EnrichmentPlan,
} from "../officeholders-sync";

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
          hierarchyLevel: input.hierarchyLevel,
        });
      }
      return row.id as string;
    },
    upsertOffice: async (_db: never, input: Record<string, unknown>) => {
      const list = rows.get(offices)!;
      let row = list.find(
        (candidate) =>
          candidate.id === input.stableId ||
          (candidate.bodyId === input.bodyId &&
            candidate.officeType === input.officeType),
      );
      if (!row) {
        row = insert(offices, {
          id: "20000000-0000-4000-8000-000000000001",
          bodyId: input.bodyId,
          name: input.name,
          officeType: input.officeType,
          isElected: input.isElected,
          wikidataQid: input.wikidataQid,
        });
      } else {
        Object.assign(row, {
          name: input.name,
          officeType: input.officeType,
          isElected: input.isElected,
          ...(input.wikidataQid ? { wikidataQid: input.wikidataQid } : {}),
        });
      }
      return row.id as string;
    },
    mutatePerson: async (_db: never, input: {
      stableId?: string;
      identityQid?: string;
      insertName: string;
      values: Record<string, unknown>;
    }) => {
      const list = rows.get(persons)!;
      let row = list.find(
        (candidate) =>
          candidate.id === input.stableId ||
          candidate.wikidataQid === input.identityQid,
      );
      if (!row) {
        row = insert(persons, {
          id: input.stableId ?? "30000000-0000-4000-8000-000000000001",
          name: input.insertName,
          ...structuredClone(input.values),
        });
      } else {
        Object.assign(row, structuredClone(input.values));
      }
      return row.id as string;
    },
  };
  return {
    db: db as never,
    entityWriters: entityWriters as never,
    rows,
    writes: () => writes,
  };
}

function semantic(rows: Map<unknown, Array<Record<string, unknown>>>) {
  return [...rows.values()].flat().map((row) => { const copy = structuredClone(row); delete copy.retrievedAt; return copy; });
}

const personPass = async () => ({
  status: "completed" as const,
  candidates: 0,
  portraitsWritten: 0,
  birthdatesWritten: 0,
  writeFailures: 0,
});
const options = {
  bindings: [binding] as never,
  findJurisdictionId: async () => "jurisdiction-1",
  enrichmentPlan: emptyPlan,
  enrichPersons: personPass as never,
  markSynced: (async () => ["wikidata"]) as never,
  retirePrincipalTerms: async () => 0,
  atlasReleaseId: "atlas-test",
};

const rank = (name: "PreferredRank" | "NormalRank" | "DeprecatedRank") => ({
  type: "uri",
  value: `http://wikiba.se/ontology#${name}`,
});

test("officeholder resolution is order-independent and preferred rank wins", () => {
  const stale = {
    ...binding,
    headOfState: {
      type: "uri",
      value: "http://www.wikidata.org/entity/Q-old",
    },
    headOfStateLabel: { type: "literal", value: "Old officeholder" },
    hosRank: rank("NormalRank"),
  };
  const current = {
    ...binding,
    headOfState: {
      type: "uri",
      value: "http://www.wikidata.org/entity/Q-new",
    },
    headOfStateLabel: { type: "literal", value: "Current officeholder" },
    hosRank: rank("PreferredRank"),
  };
  const forward = resolveOfficeholderBindings([stale, current] as never);
  const reverse = resolveOfficeholderBindings([current, stale] as never);
  assert.deepEqual(forward, reverse);
  assert.deepEqual(
    forward[0].headOfState.map((row) => row.personName),
    ["Current officeholder"],
  );
});

test("multiple preferred officeholders remain explicit co-leadership", () => {
  const first = {
    ...binding,
    headOfState: {
      type: "uri",
      value: "http://www.wikidata.org/entity/Q100",
    },
    headOfStateLabel: { type: "literal", value: "Co-leader A" },
    hosRank: rank("PreferredRank"),
  };
  const second = {
    ...binding,
    headOfState: {
      type: "uri",
      value: "http://www.wikidata.org/entity/Q200",
    },
    headOfStateLabel: { type: "literal", value: "Co-leader B" },
    hosRank: rank("PreferredRank"),
  };
  const [resolved] = resolveOfficeholderBindings([second, first] as never);
  assert.deepEqual(
    resolved.headOfState.map((row) => row.personName),
    ["Co-leader A", "Co-leader B"],
  );
  assert.deepEqual(resolved.ambiguousRoles, []);
});

test("multiple normal-rank current claims fail closed", () => {
  const first = {
    ...binding,
    headOfState: {
      type: "uri",
      value: "http://www.wikidata.org/entity/Q100",
    },
    hosRank: rank("NormalRank"),
  };
  const second = {
    ...binding,
    headOfState: {
      type: "uri",
      value: "http://www.wikidata.org/entity/Q200",
    },
    hosRank: rank("NormalRank"),
  };
  const [resolved] = resolveOfficeholderBindings([first, second] as never);
  assert.deepEqual(resolved.headOfState, []);
  assert.deepEqual(resolved.ambiguousRoles, ["head_of_state"]);
});

test("deprecated officeholder statements never enter the resolved set", () => {
  const deprecated = {
    ...binding,
    hosRank: rank("DeprecatedRank"),
  };
  const [resolved] = resolveOfficeholderBindings([deprecated] as never);
  assert.deepEqual(resolved.headOfState, []);
});

test("officeholder fixture applications create no duplicate canonical rows", async () => {
  const state = harness();
  await syncFactbookOfficeholders({ ...options, db: state.db, entityWriters: state.entityWriters });
  const first = semantic(state.rows);
  await syncFactbookOfficeholders({ ...options, db: state.db, entityWriters: state.entityWriters });
  assert.deepEqual(semantic(state.rows), first);
  assert.equal(state.rows.get(persons)?.length, 1);
  assert.equal(state.rows.get(terms)?.length, 1);
  assert.equal(state.rows.get(statements)?.length, 1);
  assert.equal(state.rows.get(statements)?.[0].subjectTable, "terms");
  assert.equal(state.rows.get(statements)?.[0].subjectId, state.rows.get(terms)?.[0].id);
});

test("officeholder dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const first = await syncFactbookOfficeholders({ ...options, db: state.db, entityWriters: state.entityWriters, dryRun: true });
  const second = await syncFactbookOfficeholders({ ...options, db: state.db, entityWriters: state.entityWriters, dryRun: true });
  assert.deepEqual({ countries: first.countriesSynced, rows: first.totalRowsWritten }, { countries: second.countriesSynced, rows: second.totalRowsWritten });
  assert.equal(state.writes(), 0);
});

test("officeholder apply fails closed before entity writes without a named release", async () => {
  const state = harness();
  await assert.rejects(
    syncFactbookOfficeholders({
      ...options,
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

test("malformed officeholder input fails before freshness", async () => {
  const state = harness();
  const stamped: number[] = [];
  await assert.rejects(syncFactbookOfficeholders({ ...options, db: state.db, entityWriters: state.entityWriters, bindings: [{}] as never, markSynced: (async (_id: unknown, value: { rowsWritten: number }) => { stamped.push(value.rowsWritten); return []; }) as never }));
  assert.deepEqual(stamped, []);
});

test("an empty officeholder primary feed fails before enrichment or freshness", async () => {
  const state = harness();
  let stampCalls = 0;
  await assert.rejects(
    syncFactbookOfficeholders({
      ...options,
      db: state.db,
      entityWriters: state.entityWriters,
      bindings: [],
      enrichmentPlan: {
        ...emptyPlan,
        titles: [
          {
            officeId: "existing-office",
            bodyId: "existing-body",
            country: "Canada",
            role: "head_of_government",
            oldName: "Head of Government",
            newName: "Prime Minister",
            positionQid: "Q14211",
          },
        ],
      },
      markSynced: (async () => {
        stampCalls++;
        return ["wikidata"];
      }) as never,
    }),
    /primary feed returned no usable bindings/,
  );
  assert.equal(state.writes(), 0);
  assert.equal(stampCalls, 0);
});

test("state-only officeholder bindings fail before enrichment or freshness", async () => {
  const state = harness();
  let stampCalls = 0;
  const stateOnly = {
    state: binding.state,
    stateLabel: binding.stateLabel,
    iso2: binding.iso2,
    iso3: binding.iso3,
  };
  await assert.rejects(
    syncFactbookOfficeholders({
      ...options,
      db: state.db,
      entityWriters: state.entityWriters,
      bindings: [stateOnly] as never,
      enrichmentPlan: {
        ...emptyPlan,
        titles: [
          {
            officeId: "existing-office",
            bodyId: "existing-body",
            country: "Canada",
            role: "head_of_government",
            oldName: "Head of Government",
            newName: "Prime Minister",
            positionQid: "Q14211",
          },
        ],
      },
      markSynced: (async () => {
        stampCalls++;
        return ["wikidata"];
      }) as never,
    }),
    /no usable leadership bindings/,
  );
  assert.equal(state.writes(), 0);
  assert.equal(stampCalls, 0);
});

test("unmapped leadership cannot be masked by enrichment writes", async () => {
  const state = harness();
  let stampCalls = 0;
  let personEnrichmentCalls = 0;
  await assert.rejects(
    syncFactbookOfficeholders({
      ...options,
      db: state.db,
      entityWriters: state.entityWriters,
      findJurisdictionId: async () => null,
      enrichmentPlan: {
        ...emptyPlan,
        titles: [
          {
            officeId: "existing-office",
            bodyId: "existing-body",
            country: "Canada",
            role: "head_of_government",
            oldName: "Head of Government",
            newName: "Prime Minister",
            positionQid: "Q14211",
          },
        ],
      },
      enrichPersons: (async () => {
        personEnrichmentCalls++;
        return {
          status: "completed" as const,
          candidates: 1,
          portraitsWritten: 1,
          birthdatesWritten: 0,
          writeFailures: 0,
        };
      }) as never,
      markSynced: (async () => {
        stampCalls++;
        return ["wikidata"];
      }) as never,
    }),
    /primary feed matched zero Civica jurisdictions/,
  );
  assert.equal(state.writes(), 0);
  assert.equal(personEnrichmentCalls, 0);
  assert.equal(stampCalls, 0);
});

test("a failed wider person backfill reports partial and never advances freshness", async () => {
  const state = harness();
  const stamped: number[] = [];
  const summary = await syncFactbookOfficeholders({
    ...options,
    db: state.db,
    entityWriters: state.entityWriters,
    enrichPersons: (async () => {
      throw new Error("portrait provider unavailable");
    }) as never,
    markSynced: (async (_id: unknown, value: { rowsWritten: number }) => {
      stamped.push(value.rowsWritten);
      return ["wikidata"];
    }) as never,
  });

  assert.equal(summary.status, "partial");
  assert.equal(summary.personPortraitBackfillFailed, true);
  assert.ok(summary.totalRowsWritten > 0);
  assert.equal(summary.freshnessStamped, false);
  assert.deepEqual(stamped, []);
});
