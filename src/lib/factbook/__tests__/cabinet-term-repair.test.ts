/**
 * DAT-037 one-time repair: candidate selection, determinism, atomic apply,
 * resume, drift abort, and fail-closed planning on real PostgreSQL semantics.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  CabinetRepairPlanError,
  applyCabinetTermRepair,
  loadCabinetRepairState,
  planCabinetTermRepair,
  verifyCabinetTermRepair,
  type CabinetRepairExecutor,
} from "../cabinet-term-repair";
import { syncCiaCabinets } from "../cia-cabinets-sync";
import { createCabinetFixture, type CabinetFixture } from "./cabinet-fixture-database";

const PAGE_BASE = "https://www.cia.gov/resources/world-leaders/foreign-governments";
const id = (group: number, n: number) =>
  `${String(group).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const J = { fix: id(1, 1), co: id(1, 2), fr: id(1, 3), uk: id(1, 4), us: id(1, 5) };
const B = { fix: id(2, 1), co: id(2, 2), fr: id(2, 3), uk: id(2, 4), us: id(2, 5) };
const O = {
  head: id(3, 1),
  hog: id(3, 2),
  fin: id(3, 3),
  def: id(3, 4),
  just: id(3, 5),
  vp: id(3, 6),
  trade: id(3, 7),
  pmCia: id(3, 8),
  co: id(3, 9),
  frHead: id(3, 10),
  ukFin: id(3, 11),
  ukForeign: id(3, 12),
  usState: id(3, 13),
};
const P = {
  pres: id(4, 1),
  pm: id(4, 2),
  jane: id(4, 3),
  john: id(4, 4),
  vacant: id(4, 5),
  mac: id(4, 6),
  ukFin: id(4, 7),
  lammy: id(4, 8),
  rubio: id(4, 9),
};
const T = {
  head: id(5, 1),
  justPres: id(5, 2),
  hog: id(5, 3),
  pmCia: id(5, 4),
  fin1: id(5, 5),
  fin2: id(5, 6),
  trade: id(5, 7),
  defJane: id(5, 8),
  john: id(5, 9),
  vacant: id(5, 10),
  frHead: id(5, 11),
  coMac: id(5, 12),
  ukFin: id(5, 13),
  lammy: id(5, 14),
  rubio: id(5, 15),
};

function executor(fx: CabinetFixture): CabinetRepairExecutor {
  const dialect = new PgDialect();
  const run = (statements: SQL[]) =>
    fx.pglite.transaction(async (transaction) => {
      const rows: Record<string, unknown>[][] = [];
      for (const statement of statements) {
        const query = dialect.sqlToQuery(statement);
        rows.push((await transaction.query<Record<string, unknown>>(query.sql, query.params)).rows);
      }
      return rows;
    });
  return { read: run, write: run };
}

async function seed(fx: CabinetFixture) {
  const q = fx.query;
  await q(
    `INSERT INTO jurisdictions (id, slug, name) VALUES
      ($1, 'fixturia', 'Fixturia'), ($2, 'coprincia', 'Coprincia'),
      ($3, 'franconia', 'Franconia'), ($4, 'unitedland', 'Unitedland'),
      ($5, 'usland', 'Usland')`,
    [J.fix, J.co, J.fr, J.uk, J.us],
  );
  for (const [key, jurisdiction] of Object.entries(J)) {
    await q(
      `INSERT INTO government_bodies (id, jurisdiction_id, name, body_type, branch, hierarchy_level)
       VALUES ($1, $2, $3, 'cabinet', 'executive', 0)`,
      [B[key as keyof typeof B], jurisdiction, `Executive of ${key}`],
    );
  }
  const offices: Array<[string, string, string, string, number | null]> = [
    [O.head, B.fix, "President of Fixturia", "head_of_state", null],
    [O.hog, B.fix, "Prime Minister of Fixturia", "head_of_government", null],
    [O.vp, B.fix, "Vice Pres.", "deputy_head", 0],
    [O.fin, B.fix, "Min. of Finance", "cabinet", 1],
    [O.def, B.fix, "Min. of Defense", "cabinet", 2],
    [O.just, B.fix, "Min. of Justice", "cabinet", 3],
    [O.trade, B.fix, "Min. of Trade", "cabinet", 4],
    [O.pmCia, B.fix, "Prime Minister, First Lord", "cabinet", 5],
    [O.co, B.co, "Co-Prince", "official", 0],
    [O.frHead, B.fr, "President of Franconia", "head_of_state", null],
    [O.ukFin, B.uk, "Min. of Finance", "cabinet", 0],
    [O.ukForeign, B.uk, "Foreign Secretary", "cabinet", null],
    [O.usState, B.us, "Secretary of State", "cabinet", null],
  ];
  for (const [officeId, bodyId, name, type, order] of offices) {
    await q(
      `INSERT INTO offices (id, body_id, name, office_type, is_elected, display_order)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [officeId, bodyId, name, type, order],
    );
  }
  const persons: Array<[string, string, string | null]> = [
    [P.pres, "Ana Presidente", "Q1"],
    [P.pm, "Keir Firstlord", "Q2"],
    [P.jane, "Jane Doe", null],
    [P.john, "John Roe", null],
    [P.vacant, "Vacant", null],
    [P.mac, "Emmanuel Coprince", "Q3"],
    [P.ukFin, "Uma Finance", null],
    [P.lammy, "David Oldhand", "Q4"],
    [P.rubio, "Marco Oldhand", "Q5"],
  ];
  for (const [personId, name, qid] of persons) {
    await q(`INSERT INTO persons (id, name, wikidata_qid) VALUES ($1, $2, $3)`, [personId, name, qid]);
  }
  const terms: Array<[string, string, string, boolean, string | null]> = [
    [T.head, O.head, P.pres, true, "2017-05-14"],
    [T.justPres, O.just, P.pres, true, "2026-07-01"],
    [T.hog, O.hog, P.pm, false, "2024-07-05"],
    [T.pmCia, O.pmCia, P.pm, true, "2026-07-01"],
    [T.fin1, O.fin, P.jane, true, "2026-07-01"],
    [T.fin2, O.fin, P.jane, false, "2026-02-06"],
    [T.trade, O.trade, P.jane, true, "2026-07-01"],
    [T.defJane, O.def, P.jane, true, "2026-07-01"],
    [T.john, O.def, P.john, true, "2026-07-01"],
    [T.vacant, O.vp, P.vacant, true, "2026-07-01"],
    [T.frHead, O.frHead, P.mac, true, "2017-05-14"],
    [T.coMac, O.co, P.mac, true, "2021-03-10"],
    [T.ukFin, O.ukFin, P.ukFin, true, "2026-07-23"],
    [T.lammy, O.ukForeign, P.lammy, true, "2024-07-05"],
    [T.rubio, O.usState, P.rubio, true, "2025-01-20"],
  ];
  for (const [termId, officeId, personId, current, start] of terms) {
    await q(
      `INSERT INTO terms (id, office_id, person_id, is_current, start_date) VALUES ($1, $2, $3, $4, $5)`,
      [termId, officeId, personId, current, start],
    );
  }
  const cia = (slug: string) => `${PAGE_BASE}/${slug}/`;
  const statements: Array<[string, string, string, string, string, string]> = [
    [T.head, "wikidata", "head_of_state", "Q1", "https://www.wikidata.org/wiki/Q1", "2026-08-10 00:00:00"],
    [T.head, "cia_world_leaders", "cabinet_member", "Min. of Justice", cia("fixturia"), "2026-07-01 00:00:00"],
    [T.justPres, "cia_world_leaders", "cabinet_member", "Min. of Justice", cia("fixturia"), "2026-07-01 00:00:00"],
    [T.pmCia, "cia_world_leaders", "cabinet_member", "Prime Minister, First Lord", cia("fixturia"), "2026-07-01 00:00:00"],
    [T.pmCia, "wikidata", "head_of_government", "Q2", "https://www.wikidata.org/wiki/Q2", "2026-07-08 00:00:00"],
    [T.fin1, "cia_world_leaders", "cabinet_member", "Min. of Finance", cia("fixturia"), "2026-07-01 00:00:00"],
    [T.fin2, "cia_world_leaders", "cabinet_member", "Min. of Finance", cia("fixturia"), "2026-02-10 00:00:00"],
    [T.trade, "cia_world_leaders", "cabinet_member", "Min. of Defense", cia("fixturia"), "2026-07-01 00:00:00"],
    [T.john, "cia_world_leaders", "cabinet_member", "Min. of Defense", cia("fixturia"), "2026-07-01 00:00:00"],
    [T.vacant, "cia_world_leaders", "cabinet_member", "Vice Pres.", cia("fixturia"), "2026-07-01 00:00:00"],
    [T.frHead, "wikidata", "head_of_state", "Q3", "https://www.wikidata.org/wiki/Q3", "2026-08-10 00:00:00"],
    [T.frHead, "cia_world_leaders", "cabinet_member", "Co-Prince", cia("coprincia"), "2026-07-02 00:00:00"],
    [T.coMac, "cia_world_leaders", "cabinet_member", "Co-Prince", cia("coprincia"), "2026-07-02 00:00:00"],
    [T.ukFin, "cia_world_leaders", "cabinet_member", "Min. of Finance", cia("unitedland"), "2026-09-01 00:00:00"],
  ];
  for (const [subject, source, predicate, value, url, retrieved] of statements) {
    await q(
      `INSERT INTO statements (subject_table, subject_id, predicate, object_value, source_id,
         source_url, source_license, retrieved_at)
       VALUES ('terms', $1, $2, $3, $4, $5, 'public_domain', $6)`,
      [subject, predicate, value, source, url, retrieved],
    );
  }
  for (const [bodyId, slug, stamp] of [
    [B.fix, "fixturia", "2026-07-01"],
    [B.co, "coprincia", "2021-03-10"],
    [B.uk, "unitedland", "2026-07-23"],
  ] as const) {
    await q(
      `INSERT INTO statements (subject_table, subject_id, predicate, object_value, source_id,
         source_url, source_license, retrieved_at, source_hash)
       VALUES ('government_bodies', $1, 'cabinet_roster_last_updated', $2, 'cia_world_leaders',
         $3, 'public_domain', '2026-09-29 00:00:00', 'fixture')`,
      [bodyId, stamp, cia(slug)],
    );
  }
}

// One PGlite instance per file, reset before every scenario.
let shared: CabinetFixture | undefined;
before(async () => {
  shared = await createCabinetFixture();
});
after(async () => {
  await shared?.close();
});

async function seeded(): Promise<CabinetFixture> {
  if (!shared) throw new Error("fixture database not initialized");
  await shared.reset();
  await seed(shared);
  return { ...shared, close: async () => {} };
}

test("repair plan selects every defect class deterministically and carries no names", async () => {
  const fx = await seeded();
  try {
    const plan = planCabinetTermRepair(await loadCabinetRepairState(executor(fx)));
    assert.deepEqual(plan.categories, {
      r1PlaceholderTerms: 1,
      r1PlaceholderStatements: 1,
      r2DuplicatePairs: 1,
      r2LoserTerms: 1,
      r2LoserStatements: 1,
      r2SurvivorReinstated: 0,
      r3CiaOnHeadDeleted: 2,
      r3CiaOnHeadRehomed: 0,
      r3CiaMisplacedDeleted: 0,
      r3CiaMisplacedRehomed: 1,
      r3WikidataDeleted: 0,
      r3WikidataRehomed: 1,
      r4LegacyRetired: 1,
      r5DatesCleared: 8,
    });
    assert.deepEqual(plan.observations.jurisdictionsWithoutRosterStatement, []);
    assert.equal(plan.observations.legacyCurrentTermsKept, 1);
    assert.equal(plan.observations.legacyDatedTermsKept, 0);
    assert.equal(plan.observations.ciaOwnedOfficesReleasedWithoutProvenance, 0);
    assert.equal(plan.observations.currentCiaOwnedTermsWithoutProvenance, 1);
    assert.deepEqual(
      plan.targets.statementRehomes
        .map(({ fromSubjectId, toSubjectId }) => `${fromSubjectId}>${toSubjectId}`)
        .sort(),
      [`${T.trade}>${T.defJane}`, `${T.pmCia}>${T.hog}`].sort(),
    );
    assert.deepEqual(
      plan.targets.termDeletes.map((row) => row.id).sort(),
      [T.fin2, T.vacant].sort(),
    );
    const serialized = JSON.stringify(plan);
    for (const name of ["Jane", "Vacant", "Presidente", "Oldhand", "Firstlord"]) {
      assert.equal(serialized.includes(name), false, `plan leaks ${name}`);
    }
    const again = planCabinetTermRepair(await loadCabinetRepairState(executor(fx)));
    assert.equal(again.planSha256, plan.planSha256);
  } finally {
    await fx.close();
  }
});

test("repair apply fixes every class atomically and leaves heads, US legacy rows, and freshness alone", async () => {
  const fx = await seeded();
  try {
    const run = executor(fx);
    const plan = planCabinetTermRepair(await loadCabinetRepairState(run));
    const headBefore = await fx.query(`SELECT * FROM terms WHERE id IN ($1, $2) ORDER BY id`, [T.head, T.frHead]);
    const wikidataHead = await fx.query(
      `SELECT * FROM statements WHERE subject_id IN ($1, $2) AND source_id = 'wikidata' ORDER BY id`,
      [T.head, T.frHead],
    );
    const usBefore = await fx.query(`SELECT * FROM terms WHERE id = $1`, [T.rubio]);
    const syncBefore = await fx.query(`SELECT last_sync_at FROM sources ORDER BY id`);
    const historyBefore = await fx.count("research_evidence_history");

    const applied = await applyCabinetTermRepair(run, plan);
    assert.equal(applied.rowsChanged, plan.expectedHistoryRows);
    assert.equal(
      (await fx.count("research_evidence_history")) - historyBefore,
      plan.expectedHistoryRows,
    );
    assert.deepEqual(
      await fx.query(`SELECT * FROM terms WHERE id IN ($1, $2) ORDER BY id`, [T.head, T.frHead]),
      headBefore,
    );
    assert.deepEqual(
      await fx.query(
        `SELECT * FROM statements WHERE subject_id IN ($1, $2) AND source_id = 'wikidata' ORDER BY id`,
        [T.head, T.frHead],
      ),
      wikidataHead,
    );
    assert.equal(
      await fx.count(
        "statements",
        "subject_id IN ($1, $2) AND source_id = 'cia_world_leaders'",
        [T.head, T.frHead],
      ),
      0,
    );
    assert.deepEqual(await fx.query(`SELECT * FROM terms WHERE id = $1`, [T.rubio]), usBefore);
    assert.deepEqual(await fx.query(`SELECT last_sync_at FROM sources ORDER BY id`), syncBefore);
    assert.equal(
      await fx.count("terms", "id = $1 AND is_current = false AND start_date = '2024-07-05'", [T.lammy]),
      1,
    );
    assert.equal(
      await fx.count("statements", "subject_id = $1 AND predicate = 'head_of_government'", [T.hog]),
      1,
    );
    assert.equal(
      await fx.count("statements", "subject_id = $1 AND object_value = 'Min. of Defense'", [T.defJane]),
      1,
    );
    assert.equal(await fx.count("terms", "id IN ($1, $2)", [T.fin2, T.vacant]), 0);
    assert.equal(await fx.count("persons", "id = $1", [P.vacant]), 1);

    const verification = await verifyCabinetTermRepair(run, {
      plan,
      transactionStartedAt: applied.transactionStartedAt,
    });
    for (const check of [
      "P1_rosterTermsWithCiaPageDates",
      "P2_duplicatePairs",
      "P4_ciaStatementsOnHeadTerms",
      "P4_wikidataStatementsOnCiaTerms",
      "P5_placeholderTerms",
      "P8_replanWrites",
      "P10_ciaSourceFreshnessUnchanged",
      "P11_historyRowsForTransaction",
    ]) {
      assert.equal(verification.checks[check]?.pass, true, check);
    }
    // The moved statement leaves Trade current without provenance until the
    // importer's convergence pass writes a fresh one; P3 reports it.
    assert.equal(verification.checks.P3_currentTermsWithoutExactProvenance.observed, 1);
    // The unsourced UK and US legacy rows keep their hand-entered dates.
    assert.equal(verification.checks.P1_legacyDatedRosterTerms_disclosed.observed, 2);
  } finally {
    await fx.close();
  }
});

test("a re-plan proposes nothing and replaying the same plan changes nothing", async () => {
  const fx = await seeded();
  try {
    const run = executor(fx);
    const plan = planCabinetTermRepair(await loadCabinetRepairState(run));
    await applyCabinetTermRepair(run, plan);
    const replan = planCabinetTermRepair(await loadCabinetRepairState(run));
    assert.equal(
      Object.values(replan.categories).reduce((sum, value) => sum + value, 0),
      0,
    );
    const history = await fx.count("research_evidence_history");
    const replay = await applyCabinetTermRepair(run, plan);
    assert.equal(replay.rowsChanged, 0);
    assert.equal(await fx.count("research_evidence_history"), history);
  } finally {
    await fx.close();
  }
});

test("drift in a planned row or any other cabinet row aborts the whole repair", async () => {
  for (const drift of [
    `UPDATE terms SET is_current = true WHERE id = '${T.fin2}'`,
    `UPDATE terms SET party_name = 'New Party' WHERE id = '${T.hog}'`,
    `UPDATE statements SET object_value = 'Q9' WHERE subject_id = '${T.head}' AND source_id = 'wikidata'`,
  ]) {
    const fx = await seeded();
    try {
      const run = executor(fx);
      const plan = planCabinetTermRepair(await loadCabinetRepairState(run));
      await fx.query(drift);
      const history = await fx.count("research_evidence_history");
      await assert.rejects(applyCabinetTermRepair(run, plan), /civica_assertion_failed:repair_/);
      assert.equal(await fx.count("research_evidence_history"), history);
      assert.equal(await fx.count("terms", "id = $1", [T.vacant]), 1);
    } finally {
      await fx.close();
    }
  }
});

test("a tampered plan is refused before any database write", async () => {
  const fx = await seeded();
  try {
    const run = executor(fx);
    const plan = planCabinetTermRepair(await loadCabinetRepairState(run));
    const tampered = {
      ...plan,
      targets: { ...plan.targets, termDeletes: [...plan.targets.termDeletes].slice(1) },
    };
    await assert.rejects(applyCabinetTermRepair(run, tampered), CabinetRepairPlanError);
    assert.equal(await fx.count("terms", "id = $1", [T.vacant]), 1);
  } finally {
    await fx.close();
  }
});

test("the plan fails closed on defects that need a human decision", async () => {
  const loser = await seeded();
  try {
    // A duplicate loser carrying another publisher's statement cannot be
    // deleted by rule.
    await loser.query(
      `INSERT INTO statements (subject_table, subject_id, predicate, object_value, source_id,
         source_url, source_license, retrieved_at)
       VALUES ('terms', $1, 'head_of_government', 'Q9', 'wikidata',
         'https://www.wikidata.org/wiki/Q9', 'CC0-1.0', '2026-07-08 00:00:00')`,
      [T.fin2],
    );
    const state = await loadCabinetRepairState(executor(loser));
    assert.throws(() => planCabinetTermRepair(state), CabinetRepairPlanError);
  } finally {
    await loser.close();
  }

  const orphan = await seeded();
  try {
    // A misplaced statement naming a title the person holds nowhere is never
    // relabelled.
    await orphan.query(
      `UPDATE statements SET object_value = 'Min. of Nothing'
       WHERE subject_id = $1 AND source_id = 'cia_world_leaders'`,
      [T.trade],
    );
    const state = await loadCabinetRepairState(executor(orphan));
    assert.throws(() => planCabinetTermRepair(state), CabinetRepairPlanError);
  } finally {
    await orphan.close();
  }
});

// ─── Offices the importer released, and legacy rows it adopted ──────────────
//
// These scenarios run the real importer against the fixture first, so the
// office release and adoption are recorded exactly as production records them
// (the importer's office write plus the DAT-016 retention trigger).

const FIXTURIA_PAGE = `${PAGE_BASE}/fixturia/`;

type RosterPosition = [title: string, holder: string | null];

function rosterPage(stamp: string, positions: readonly RosterPosition[]) {
  return `<html><h1>Fixturia</h1><h2>Leaders and Cabinet Members</h2>
    <div class="last-updated"><b>Last Updated</b>: <span>${stamp}</span></div>
    ${positions
      .map(
        ([title, holder]) =>
          `<div class="leader-info"><h4>${title}</h4>${holder === null ? "" : `<p>${holder}</p>`}</div>`,
      )
      .join("\n")}
    <h2>Explore Foreign Governments</h2></html>`;
}

async function importRoster(fx: CabinetFixture, html: string) {
  const result = await syncCiaCabinets({
    db: fx.db,
    slugs: ["fixturia"],
    crawlDelayMs: 0,
    atlasReleaseId: "atlas-test",
    fetchCountryPage: async () => ({ ok: true, status: 200, html }),
    retryWait: async () => {},
  });
  assert.deepEqual(result.skipped, []);
  return result;
}

async function freshFixturia(): Promise<CabinetFixture> {
  if (!shared) throw new Error("fixture database not initialized");
  await shared.reset();
  await shared.query(`INSERT INTO jurisdictions (id, slug, name) VALUES ($1, 'fixturia', 'Fixturia')`, [
    J.fix,
  ]);
  await shared.query(
    `INSERT INTO government_bodies (id, jurisdiction_id, name, body_type, branch, hierarchy_level)
     VALUES ($1, $2, 'Executive of Fixturia', 'cabinet', 'executive', 0)`,
    [B.fix, J.fix],
  );
  return { ...shared, close: async () => {} };
}

async function seedRows(
  fx: CabinetFixture,
  rows: {
    offices?: Array<[id: string, name: string, order: number | null]>;
    persons?: Array<[id: string, name: string, qid: string | null]>;
    terms?: Array<[id: string, office: string, person: string, current: boolean, start: string | null]>;
    ciaStatements?: Array<[term: string, title: string, retrievedAt: string]>;
  },
) {
  for (const [officeId, name, order] of rows.offices ?? []) {
    await fx.query(
      `INSERT INTO offices (id, body_id, name, office_type, is_elected, display_order)
       VALUES ($1, $2, $3, 'cabinet', false, $4)`,
      [officeId, B.fix, name, order],
    );
  }
  for (const [personId, name, qid] of rows.persons ?? []) {
    await fx.query(`INSERT INTO persons (id, name, wikidata_qid) VALUES ($1, $2, $3)`, [personId, name, qid]);
  }
  for (const [termId, officeId, personId, current, start] of rows.terms ?? []) {
    await fx.query(
      `INSERT INTO terms (id, office_id, person_id, is_current, start_date) VALUES ($1, $2, $3, $4, $5)`,
      [termId, officeId, personId, current, start],
    );
  }
  for (const [termId, title, retrievedAt] of rows.ciaStatements ?? []) {
    await fx.query(
      `INSERT INTO statements (subject_table, subject_id, predicate, object_value, source_id,
         source_url, source_license, retrieved_at)
       VALUES ('terms', $1, 'cabinet_member', $2, 'cia_world_leaders', $3, 'public_domain', $4)`,
      [termId, title, FIXTURIA_PAGE, retrievedAt],
    );
  }
}

const R = {
  finance: id(6, 1),
  water: id(6, 2),
  chancellor: id(6, 3),
  foreign: id(6, 4),
  jane: id(7, 1),
  walt: id(7, 2),
  vacant: id(7, 3),
  reeves: id(7, 4),
  lammy: id(7, 5),
  janeTerm: id(8, 1),
  waltTerm: id(8, 2),
  vacantTerm: id(8, 3),
  reevesTerm: id(8, 4),
  lammyTerm: id(8, 5),
};

test("an office the importer released stays in scope although no term on it carries CIA provenance", async () => {
  const fx = await freshFixturia();
  // Former importer state: every term carries the page date; DAT-028 left the
  // Water terms without a statement, and one of them is CIA's "Vacant".
  await seedRows(fx, {
    offices: [
      [R.finance, "Min. of Finance", 0],
      [R.water, "Min. of Water", 1],
    ],
    persons: [
      [R.jane, "Jane Doe", null],
      [R.walt, "Walt Waters", null],
      [R.vacant, "Vacant", null],
    ],
    terms: [
      [R.janeTerm, R.finance, R.jane, true, "2026-07-01"],
      [R.waltTerm, R.water, R.walt, true, "2026-07-01"],
      [R.vacantTerm, R.water, R.vacant, true, "2026-07-01"],
    ],
    ciaStatements: [[R.janeTerm, "Min. of Finance", "2026-07-01 00:00:00"]],
  });

  // The corrected importer's refresh no longer lists Water: it releases the
  // office's list position and retires both of its terms.
  const refresh = await importRoster(fx, rosterPage("8/1/2026", [["Min. of Finance", "Jane DOE"]]));
  assert.equal(refresh.officesReleased, 1);
  assert.deepEqual(await fx.query(`SELECT display_order FROM offices WHERE id = $1`, [R.water]), [
    { display_order: null },
  ]);
  assert.equal(
    await fx.count("statements", "subject_id IN ($1, $2)", [R.waltTerm, R.vacantTerm]),
    0,
  );

  const run = executor(fx);
  const plan = planCabinetTermRepair(await loadCabinetRepairState(run));
  assert.equal(plan.categories.r1PlaceholderTerms, 1);
  assert.deepEqual(
    plan.targets.termDeletes.map((row) => row.id),
    [R.vacantTerm],
  );
  assert.equal(
    plan.targets.termUpdates.some((row) => row.id === R.waltTerm && row.clearDates),
    true,
  );
  assert.equal(plan.observations.ciaOwnedOfficesReleasedWithoutProvenance, 1);

  const applied = await applyCabinetTermRepair(run, plan);
  assert.equal(await fx.count("terms", "id = $1", [R.vacantTerm]), 0);
  assert.equal(
    await fx.count("terms", "id = $1 AND start_date IS NULL AND is_current = false", [R.waltTerm]),
    1,
  );
  assert.equal(
    await fx.count("terms", "id = $1 AND start_date IS NULL AND is_current", [R.janeTerm]),
    1,
  );

  const verification = await verifyCabinetTermRepair(run, {
    plan,
    transactionStartedAt: applied.transactionStartedAt,
  });
  assert.equal(verification.pass, true, JSON.stringify(verification.checks));
  assert.equal(verification.checks.P1_rosterTermsWithCiaPageDates.observed, 0);
  assert.equal(verification.checks.P5_placeholderTerms.observed, 0);
  assert.equal(verification.checks.P2_duplicatePairs.observed, 0);
  assert.equal(verification.checks.P7_unlistedOfficesWithCurrentHolders.observed, 0);
  // The importer's next visit neither re-dates nor re-lists anything.
  const again = await importRoster(fx, rosterPage("8/1/2026", [["Min. of Finance", "Jane DOE"]]));
  assert.equal(again.totalRowsWritten, 0);
});

test("a hand-entered legacy row keeps its own date when the importer adopts its title", async () => {
  const fx = await freshFixturia();
  await seedRows(fx, {
    offices: [
      [R.finance, "Min. of Finance", 0],
      [R.chancellor, "Chancellor of the Exchequer", null],
      [R.foreign, "Foreign Secretary", null],
    ],
    persons: [
      [R.jane, "Jane Doe", null],
      [R.reeves, "Rachel Oldhand", "Q5045258"],
      [R.lammy, "David Oldhand", "Q333136"],
    ],
    terms: [
      [R.janeTerm, R.finance, R.jane, true, "2026-07-23"],
      [R.reevesTerm, R.chancellor, R.reeves, true, "2024-07-05"],
      [R.lammyTerm, R.foreign, R.lammy, true, "2024-07-05"],
    ],
    ciaStatements: [[R.janeTerm, "Min. of Finance", "2026-07-23 00:00:00"]],
  });
  await fx.query(
    `UPDATE terms SET party_name = 'Labour', party_color = 'fixture-party-color' WHERE id IN ($1, $2)`,
    [R.reevesTerm, R.lammyTerm],
  );

  // The roster now names the legacy Chancellor title with a different holder:
  // the importer adopts the office and retires the hand-entered row.
  await importRoster(
    fx,
    rosterPage("9/1/2026", [
      ["Min. of Finance", "Jane DOE"],
      ["Chancellor of the Exchequer", "John HEALEY"],
    ]),
  );
  assert.equal(await fx.count("offices", "id = $1 AND display_order = 1", [R.chancellor]), 1);
  assert.equal(await fx.count("terms", "id = $1 AND NOT is_current", [R.reevesTerm]), 1);

  const run = executor(fx);
  const plan = planCabinetTermRepair(await loadCabinetRepairState(run));
  assert.equal(
    plan.targets.termUpdates.some((row) => row.id === R.reevesTerm),
    false,
    "the adopted legacy row's own date is not a CIA page date",
  );
  assert.equal(plan.observations.legacyDatedTermsKept, 1);
  assert.equal(plan.categories.r4LegacyRetired, 1);
  assert.equal(plan.categories.r5DatesCleared, 1);

  const applied = await applyCabinetTermRepair(run, plan);
  assert.deepEqual(
    await fx.query(
      `SELECT id::text AS id, start_date::text AS start_date, is_current FROM terms
       WHERE id IN ($1, $2, $3) ORDER BY id`,
      [R.janeTerm, R.reevesTerm, R.lammyTerm],
    ),
    [
      { id: R.janeTerm, start_date: null, is_current: true },
      { id: R.reevesTerm, start_date: "2024-07-05", is_current: false },
      { id: R.lammyTerm, start_date: "2024-07-05", is_current: false },
    ],
  );
  const verification = await verifyCabinetTermRepair(run, {
    plan,
    transactionStartedAt: applied.transactionStartedAt,
  });
  assert.equal(verification.pass, true, JSON.stringify(verification.checks));
  assert.equal(verification.checks.P1_legacyDatedRosterTerms_disclosed.observed, 2);
});

test("a page-dated roster term outside the repair's reach fails the postflight", async () => {
  const fx = await freshFixturia();
  // An unlisted office with no recorded release and no provenance is outside
  // the repair's scope, but its term carries the country's page date and one
  // of its holders is CIA's placeholder. The postflight must not share that
  // blind spot.
  await seedRows(fx, {
    offices: [
      [R.finance, "Min. of Finance", 0],
      [R.water, "Min. of Water", null],
    ],
    persons: [
      [R.jane, "Jane Doe", null],
      [R.walt, "Walt Waters", null],
      [R.vacant, "Vacant", null],
    ],
    terms: [
      [R.janeTerm, R.finance, R.jane, true, "2026-07-01"],
      [R.waltTerm, R.water, R.walt, false, "2026-07-01"],
      [R.vacantTerm, R.water, R.vacant, false, "2026-07-01"],
    ],
    ciaStatements: [[R.janeTerm, "Min. of Finance", "2026-07-01 00:00:00"]],
  });
  const run = executor(fx);
  const plan = planCabinetTermRepair(await loadCabinetRepairState(run));
  const applied = await applyCabinetTermRepair(run, plan);
  const verification = await verifyCabinetTermRepair(run, {
    plan,
    transactionStartedAt: applied.transactionStartedAt,
  });
  assert.equal(verification.pass, false);
  assert.equal(verification.checks.P1_rosterTermsWithCiaPageDates.observed, 2);
  assert.equal(verification.checks.P5_placeholderTerms.observed, 1);
});
