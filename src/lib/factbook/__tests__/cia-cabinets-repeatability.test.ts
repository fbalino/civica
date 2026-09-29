/**
 * DAT-037 — CIA World Leaders roster repeatability on real PostgreSQL
 * semantics (PGlite with the production keys, identity index, DAT-028 subject
 * trigger, Atlas history checks, and DAT-016 retention triggers). The former
 * fake client ignored WHERE clauses and could not observe identity churn.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { ciaCabinetSyncCronOutcome } from "../cron-outcomes";
import {
  classifyPosition,
  parseCountryHtml,
  syncCiaCabinets,
  type CabinetSyncOptions,
} from "../cia-cabinets-sync";
import { createCabinetFixture, type CabinetFixture } from "./cabinet-fixture-database";

const JURISDICTION = "10000000-0000-4000-8000-000000000001";
const OTHER_JURISDICTION = "10000000-0000-4000-8000-000000000002";
const PAGE = "https://www.cia.gov/resources/world-leaders/foreign-governments/fixturia/";

const u = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Position = [title: string, holder: string | null];

function page(stamp: string, positions: readonly Position[], name = "Fixturia") {
  return `<html><h1>${name}</h1><h2>Leaders and Cabinet Members</h2>
    <div class="last-updated"><b>Last Updated</b>: <span>${stamp}</span></div>
    ${positions
      .map(
        ([title, holder]) =>
          `<div class="leader-info"><h4>${title}</h4>${holder === null ? "" : `<p>${holder}</p>`}</div>`,
      )
      .join("\n")}
    <h2>Explore Foreign Governments</h2></html>`;
}

// One PGlite instance per file, reset before every test: repeated
// WebAssembly allocation under the parallel suite is avoided.
let shared: CabinetFixture | undefined;
before(async () => {
  shared = await createCabinetFixture();
});
after(async () => {
  await shared?.close();
});

async function fixture(): Promise<CabinetFixture> {
  if (!shared) throw new Error("fixture database not initialized");
  await shared.reset();
  await shared.query(
    `INSERT INTO jurisdictions (id, slug, name) VALUES ($1, 'fixturia', 'Fixturia'),
       ($2, 'otheria', 'Otheria')`,
    [JURISDICTION, OTHER_JURISDICTION],
  );
  return { ...shared, close: async () => {} };
}

async function run(
  fx: CabinetFixture,
  pages: Record<string, string> | string,
  extra: Partial<CabinetSyncOptions> = {},
) {
  const bySlug = typeof pages === "string" ? { fixturia: pages } : pages;
  return syncCiaCabinets({
    db: fx.db,
    slugs: Object.keys(bySlug),
    crawlDelayMs: 0,
    atlasReleaseId: "atlas-test",
    fetchCountryPage: async (slug) => ({
      ok: true,
      status: 200,
      html: bySlug[slug] ?? "",
    }),
    retryWait: async () => {},
    ...extra,
  });
}

async function seedBody(fx: CabinetFixture, id = u(1), jurisdictionId = JURISDICTION) {
  await fx.query(
    `INSERT INTO government_bodies (id, jurisdiction_id, name, body_type, branch, hierarchy_level)
     VALUES ($1, $2, 'Executive of Fixturia', 'cabinet', 'executive', 0)`,
    [id, jurisdictionId],
  );
  return id;
}

async function seedOffice(
  fx: CabinetFixture,
  id: string,
  name: string,
  order: number | null,
  type = "cabinet",
  bodyId = u(1),
) {
  await fx.query(
    `INSERT INTO offices (id, body_id, name, office_type, is_elected, display_order)
     VALUES ($1, $2, $3, $4, false, $5)`,
    [id, bodyId, name, type, order],
  );
}

async function seedPerson(
  fx: CabinetFixture,
  id: string,
  name: string,
  qid: string | null = null,
) {
  await fx.query(`INSERT INTO persons (id, name, wikidata_qid) VALUES ($1, $2, $3)`, [
    id,
    name,
    qid,
  ]);
}

async function seedTerm(
  fx: CabinetFixture,
  id: string,
  officeId: string,
  personId: string,
  current: boolean,
  start: string | null = null,
) {
  await fx.query(
    `INSERT INTO terms (id, office_id, person_id, is_current, start_date)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, officeId, personId, current, start],
  );
}

async function seedStatement(
  fx: CabinetFixture,
  termId: string,
  objectValue: string,
  retrievedAt: string,
  source = "cia_world_leaders",
  predicate = "cabinet_member",
  url = PAGE,
) {
  await fx.query(
    `INSERT INTO statements (subject_table, subject_id, predicate, object_value, source_id,
       source_url, source_license, retrieved_at)
     VALUES ('terms', $1, $2, $3, $4, $5, 'public_domain', $6)`,
    [termId, predicate, objectValue, source, url, retrievedAt],
  );
}

async function historyCount(fx: CabinetFixture, table?: string) {
  return table
    ? fx.count("research_evidence_history", "entity_table = $1", [table])
    : fx.count("research_evidence_history");
}

async function currentHolders(fx: CabinetFixture, officeName: string) {
  return (
    await fx.query<{ name: string }>(
      `SELECT p.name FROM terms t JOIN offices o ON o.id = t.office_id
       JOIN persons p ON p.id = t.person_id
       WHERE o.name = $1 AND t.is_current ORDER BY p.name`,
      [officeName],
    )
  ).map((row) => row.name);
}

async function lastSync(fx: CabinetFixture) {
  return (
    await fx.query<{ at: string | null }>(
      `SELECT last_sync_at::text AS at FROM sources WHERE id = 'cia_world_leaders'`,
    )
  )[0]?.at;
}

const BASE_ROSTER: Position[] = [
  ["President", "Ana PRESIDENTE"],
  ["Min. of Finance", "Jane DOE"],
  ["Min. of Defense", "John ROE"],
  ["Governor, Central Bank of Fixturia", "Kim LEE"],
  ["Ambassador to the US", "Pat ENVOY"],
];

test("parser treats CIA vacancy placeholders as no holder", () => {
  const parsed = parseCountryHtml(
    "fixturia",
    page("7/1/2026", [
      ["Min. of Health", "Vacant"],
      ["Min. of Labor", "(Vacant)"],
      ["Min. of Water", "Position Vacant"],
      ["Min. of Energy", "Vacant Position"],
      ["Min. of Sport", "Val VACANTI"],
    ]),
  );
  assert.deepEqual(
    parsed.positions.map((position) => position.rawName),
    [null, null, null, null, "Val VACANTI"],
  );
});

test("classifier keeps UK chancellor portfolios in the cabinet", () => {
  assert.equal(classifyPosition("Chancellor of the Exchequer"), "cabinet");
  assert.equal(
    classifyPosition("Chancellor of the Duchy of Lancaster"),
    "cabinet",
  );
  assert.equal(classifyPosition("Chancellor"), "head");
  assert.equal(classifyPosition("Federal Chancellor"), "head");
  assert.equal(classifyPosition("Pres., Central Bank"), "central_bank");
});

test("a stamp bump keeps one undated row per holder, and an identical rerun writes nothing", async () => {
  const fx = await fixture();
  try {
    const first = await run(fx, page("7/1/2026", BASE_ROSTER));
    assert.deepEqual(first.skipped, []);
    assert.equal(first.countriesApplied, 1);
    assert.equal(first.freshnessStamped, true);
    assert.equal(await fx.count("offices"), 3);
    assert.equal(await fx.count("offices", "office_type LIKE 'head%'"), 0);
    assert.equal(await fx.count("terms"), 3);
    assert.equal(await fx.count("terms", "is_current AND start_date IS NULL"), 3);
    assert.equal(
      await fx.count(
        "statements",
        "predicate = 'cabinet_member' AND source_url = $1",
        [PAGE],
      ),
      3,
    );
    const roster = await fx.query<{ object_value: string; source_hash: string | null }>(
      `SELECT object_value, source_hash FROM statements
       WHERE subject_table = 'government_bodies' AND predicate = 'cabinet_roster_last_updated'`,
    );
    assert.equal(roster.length, 1);
    assert.equal(roster[0].object_value, "2026-07-01");
    assert.match(roster[0].source_hash ?? "", /^[0-9a-f]{64}$/);
    assert.equal(first.diplomaticSkipped, 1);
    const termIds = (
      await fx.query<{ id: string }>(`SELECT id FROM terms ORDER BY id`)
    ).map((row) => row.id);

    const historyBefore = await historyCount(fx);
    const bumped = await run(fx, page("7/15/2026", BASE_ROSTER));
    assert.deepEqual(bumped.skipped, []);
    assert.equal(bumped.totalRowsWritten, 1);
    assert.equal(bumped.rosterStatementsWritten, 1);
    assert.equal(bumped.termsWritten, 0);
    assert.deepEqual(
      (await fx.query<{ id: string }>(`SELECT id FROM terms ORDER BY id`)).map(
        (row) => row.id,
      ),
      termIds,
    );
    assert.equal(await fx.count("terms", "is_current AND start_date IS NULL"), 3);
    assert.equal(await historyCount(fx, "terms"), 0);
    assert.equal(await historyCount(fx, "offices"), 0);
    assert.equal((await historyCount(fx)) - historyBefore, 1);
    assert.equal(
      (
        await fx.query<{ object_value: string }>(
          `SELECT object_value FROM statements WHERE predicate = 'cabinet_roster_last_updated'`,
        )
      )[0].object_value,
      "2026-07-15",
    );
    assert.equal(bumped.freshnessStamped, true);

    const syncedAt = await lastSync(fx);
    const historyAfterBump = await historyCount(fx);
    const atlasEvents = await fx.count("atlas_entity_change_history");
    const rerun = await run(fx, page("7/15/2026", BASE_ROSTER));
    assert.deepEqual(rerun.skipped, []);
    assert.equal(rerun.totalRowsWritten, 0);
    assert.equal(rerun.countriesVerified, 1);
    assert.equal(rerun.countriesUnchanged, 1);
    assert.equal(rerun.freshnessStamped, false);
    assert.equal(await historyCount(fx), historyAfterBump);
    assert.equal(await fx.count("atlas_entity_change_history"), atlasEvents);
    assert.equal(await lastSync(fx), syncedAt);
    assert.deepEqual(ciaCabinetSyncCronOutcome(rerun), {
      ok: true,
      outcome: "completed",
      healthOk: true,
      httpStatus: 200,
    });
  } finally {
    await fx.close();
  }
});

test("an existing executive body is never renamed by the roster import", async () => {
  const fx = await fixture();
  try {
    await fx.query(
      `INSERT INTO government_bodies (id, jurisdiction_id, name, body_type, branch, hierarchy_level)
       VALUES ($1, $2, 'Executive of the Republic of Fixturia', 'cabinet', 'executive', 0)`,
      [u(1), JURISDICTION],
    );
    const result = await run(fx, page("7/1/2026", [["Min. of Finance", "Jane DOE"]]));
    assert.deepEqual(result.skipped, []);
    assert.equal(result.bodiesWritten, 0);
    assert.deepEqual(
      await fx.query(`SELECT name FROM government_bodies WHERE id = $1`, [u(1)]),
      [{ name: "Executive of the Republic of Fixturia" }],
    );
    assert.equal(await historyCount(fx, "government_bodies"), 0);
  } finally {
    await fx.close();
  }
});

test("a title listed for several people keeps every listed holder current", async () => {
  const fx = await fixture();
  try {
    const ministers: Position[] = Array.from({ length: 12 }, (_, index) => [
      "Min. of State",
      `Minister${String.fromCharCode(65 + index)} STATE`,
    ]);
    const roster: Position[] = [["Min. of Finance", "Jane DOE"], ...ministers];
    await run(fx, page("9/15/2022", roster));
    const offices = await fx.query<{ display_order: number }>(
      `SELECT display_order FROM offices WHERE name = 'Min. of State'`,
    );
    assert.deepEqual(offices, [{ display_order: 1 }]);
    assert.equal((await currentHolders(fx, "Min. of State")).length, 12);

    const history = await historyCount(fx);
    const rerun = await run(fx, page("9/15/2022", roster));
    assert.equal(rerun.totalRowsWritten, 0);
    assert.equal(await historyCount(fx), history);
    assert.equal((await currentHolders(fx, "Min. of State")).length, 12);
  } finally {
    await fx.close();
  }
});

test("a head term with a stray CIA statement and a real start date is never touched", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    await seedOffice(fx, u(10), "President of Fixturia", null, "head_of_state");
    await seedPerson(fx, u(20), "Ana Presidente", "Q1");
    await seedTerm(fx, u(30), u(10), u(20), true, "2017-05-14");
    await seedStatement(
      fx,
      u(30),
      "head_of_state",
      "2026-08-10 00:00:00",
      "wikidata",
      "head_of_state",
      "https://www.wikidata.org/wiki/Q1",
    );
    await seedStatement(fx, u(30), "Min. of Justice", "2026-07-01 00:00:00");
    const before = await fx.query(`SELECT * FROM terms WHERE id = $1`, [u(30)]);
    const statementsBefore = await fx.query(
      `SELECT * FROM statements WHERE subject_id = $1 ORDER BY source_id`,
      [u(30)],
    );

    const result = await run(
      fx,
      page("7/1/2026", [
        ["President", "Ana PRESIDENTE"],
        ["Min. of Justice", "Bo JUSTICE"],
      ]),
    );
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(await fx.query(`SELECT * FROM terms WHERE id = $1`, [u(30)]), before);
    assert.deepEqual(
      await fx.query(
        `SELECT * FROM statements WHERE subject_id = $1 ORDER BY source_id`,
        [u(30)],
      ),
      statementsBefore,
    );
    assert.equal(
      await fx.count(
        "research_evidence_history",
        "entity_id IN ($1, $2)",
        [u(30), u(10)],
      ),
      0,
    );
    assert.deepEqual(await currentHolders(fx, "Min. of Justice"), ["Bo Justice"]);
  } finally {
    await fx.close();
  }
});

test("an orphan term is reused, a misplaced statement is corrected, and stored dates stay", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    await seedOffice(fx, u(10), "Min. of Finance", 0);
    await seedOffice(fx, u(11), "Min. of Trade", 1);
    await seedPerson(fx, u(20), "Jane Doe");
    // DAT-028 fallout: the Finance term lost its statement; the Trade term
    // carries a statement naming Finance.
    await seedTerm(fx, u(30), u(10), u(20), true, "2026-02-06");
    await seedTerm(fx, u(31), u(11), u(20), true, "2026-02-06");
    await seedStatement(fx, u(31), "Min. of Finance", "2026-07-01 00:00:00");

    const result = await run(
      fx,
      page("7/1/2026", [
        ["Min. of Finance", "Jane DOE"],
        ["Min. of Trade", "Jane DOE"],
      ]),
    );
    assert.deepEqual(result.skipped, []);
    assert.equal(result.termsInserted, 0);
    assert.equal(result.statementsInserted, 1);
    assert.equal(result.statementsUpdated, 1);
    assert.equal(await fx.count("terms"), 2);
    assert.equal(
      await fx.count("terms", "is_current AND start_date = '2026-02-06'"),
      2,
    );
    const provenance = await fx.query<{ subject_id: string; object_value: string }>(
      `SELECT subject_id, object_value FROM statements
       WHERE predicate = 'cabinet_member' ORDER BY object_value`,
    );
    assert.deepEqual(provenance, [
      { subject_id: u(30), object_value: "Min. of Finance" },
      { subject_id: u(31), object_value: "Min. of Trade" },
    ]);
  } finally {
    await fx.close();
  }
});

test("a title the roster no longer lists releases its position and retires its holder", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    await seedOffice(fx, u(10), "Min. of Finance", 0);
    await seedOffice(fx, u(11), "Min. of Tourism", 1);
    await seedPerson(fx, u(20), "Jane Doe");
    await seedPerson(fx, u(21), "Old Minister");
    await seedTerm(fx, u(30), u(10), u(20), true);
    await seedTerm(fx, u(31), u(11), u(21), true);
    await seedStatement(fx, u(30), "Min. of Finance", "2026-07-01 00:00:00");
    await seedStatement(fx, u(31), "Min. of Tourism", "2026-07-01 00:00:00");

    const result = await run(fx, page("8/1/2026", [["Min. of Finance", "Jane DOE"]]));
    assert.deepEqual(result.skipped, []);
    assert.equal(result.officesReleased, 1);
    assert.equal(result.termsRetired, 1);
    assert.deepEqual(
      await fx.query(`SELECT display_order FROM offices WHERE id = $1`, [u(11)]),
      [{ display_order: null }],
    );
    assert.equal(await fx.count("terms", "id = $1 AND is_current = false", [u(31)]), 1);
    assert.equal(
      await fx.count(
        "atlas_entity_change_history",
        "entity_id = $1 AND reason = 'No longer listed in the CIA World Leaders roster'",
        [u(11)],
      ),
      1,
    );
  } finally {
    await fx.close();
  }
});

test("a replaced holder is retired and the new holder becomes current", async () => {
  const fx = await fixture();
  try {
    await run(fx, page("7/1/2026", [["Min. of Finance", "Jane DOE"]]));
    await run(fx, page("8/1/2026", [["Min. of Finance", "Omar NEW"]]));
    assert.deepEqual(await currentHolders(fx, "Min. of Finance"), ["Omar New"]);
    assert.equal(await fx.count("terms"), 2);
    assert.equal(await fx.count("persons", "name = 'Jane Doe'"), 1);
  } finally {
    await fx.close();
  }
});

test("a renamed title in a stale list position is released and inserted without a conflict", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    await seedOffice(fx, u(10), "Min. of Finance", 0);
    await seedOffice(fx, u(11), "Min. of Communication", 1);
    await seedPerson(fx, u(20), "Jane Doe");
    await seedPerson(fx, u(21), "Tala Comms");
    await seedTerm(fx, u(30), u(10), u(20), true);
    await seedTerm(fx, u(31), u(11), u(21), true);
    await seedStatement(fx, u(30), "Min. of Finance", "2026-07-01 00:00:00");
    await seedStatement(fx, u(31), "Min. of Communication", "2026-07-01 00:00:00");

    const result = await run(
      fx,
      page("8/27/2026", [
        ["Min. of Finance", "Jane DOE"],
        ["Min. of Communications &amp; Information Technology", "Tala COMMS"],
      ]),
    );
    assert.deepEqual(result.skipped, []);
    assert.equal(result.officesReleased, 1);
    assert.equal(result.officesInserted, 1);
    const renamed = await fx.query<{ display_order: number | null }>(
      `SELECT display_order FROM offices
       WHERE name = 'Min. of Communications & Information Technology'`,
    );
    assert.deepEqual(renamed, [{ display_order: 1 }]);
    assert.deepEqual(
      await fx.query(`SELECT display_order FROM offices WHERE id = $1`, [u(11)]),
      [{ display_order: null }],
    );
    assert.deepEqual(
      await currentHolders(fx, "Min. of Communications & Information Technology"),
      ["Tala Comms"],
    );
    assert.equal(await fx.count("persons", "name = 'Tala Comms'"), 1);
    assert.equal(await fx.count("terms", "id = $1 AND is_current = false", [u(31)]), 1);
  } finally {
    await fx.close();
  }
});

test("CIA's Vacant placeholder creates no person and retires the previous holder", async () => {
  const fx = await fixture();
  try {
    await run(fx, page("7/1/2026", [["Min. of Health", "Hana HEALTH"]]));
    const result = await run(fx, page("8/1/2026", [["Min. of Health", "Vacant"]]));
    assert.deepEqual(result.skipped, []);
    assert.equal(result.vacantOffices, 1);
    assert.equal(await fx.count("persons", "name ~* 'vacant'"), 0);
    assert.deepEqual(await currentHolders(fx, "Min. of Health"), []);
    assert.equal(
      await fx.count("offices", "name = 'Min. of Health' AND display_order = 0"),
      1,
    );
  } finally {
    await fx.close();
  }
});

test("pre-existing duplicate rows keep one deterministic survivor and gain no rows", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    await seedOffice(fx, u(10), "Min. of Finance", 0);
    await seedPerson(fx, u(20), "Jane Doe");
    await seedTerm(fx, u(30), u(10), u(20), false, "2026-02-06");
    await seedTerm(fx, u(31), u(10), u(20), true, "2026-07-01");
    await seedTerm(fx, u(32), u(10), u(20), true, "2026-05-01");
    await seedStatement(fx, u(30), "Min. of Finance", "2026-06-01 00:00:00");
    await seedStatement(fx, u(31), "Min. of Finance", "2026-07-01 00:00:00");

    const result = await run(fx, page("7/1/2026", [["Min. of Finance", "Jane DOE"]]));
    assert.deepEqual(result.skipped, []);
    assert.equal(result.termsInserted, 0);
    assert.equal(result.termsRetired, 1);
    assert.equal(await fx.count("terms"), 3);
    assert.deepEqual(
      (
        await fx.query<{ id: string }>(
          `SELECT id FROM terms WHERE is_current ORDER BY id`,
        )
      ).map((row) => row.id),
      [u(31)],
    );
  } finally {
    await fx.close();
  }
});

test("a legacy hand-entered office with the exact CIA title is adopted and its holder retired", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    await seedOffice(fx, u(10), "Chancellor of the Exchequer", null);
    await seedOffice(fx, u(11), "Foreign Secretary", null);
    await seedPerson(fx, u(20), "Rachel Reeves", "Q5045258");
    await seedPerson(fx, u(21), "David Lammy", "Q333136");
    await seedTerm(fx, u(30), u(10), u(20), true, "2024-07-05");
    await seedTerm(fx, u(31), u(11), u(21), true, "2024-07-05");

    const result = await run(
      fx,
      page("7/23/2026", [
        ["King", "Charles III"],
        ["Chancellor of the Exchequer", "John HEALEY"],
      ]),
    );
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(
      await fx.query(`SELECT display_order FROM offices WHERE id = $1`, [u(10)]),
      [{ display_order: 1 }],
    );
    assert.deepEqual(
      await currentHolders(fx, "Chancellor of the Exchequer"),
      ["John Healey"],
    );
    assert.equal(
      await fx.count(
        "terms",
        "id = $1 AND is_current = false AND start_date = '2024-07-05'",
        [u(30)],
      ),
      1,
    );
    // A legacy office the roster does not name is outside the importer's scope.
    assert.equal(await fx.count("terms", "id = $1 AND is_current", [u(31)]), 1);
  } finally {
    await fx.close();
  }
});

test("person matching prefers the holder of the office and fails closed when ambiguous", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    await seedOffice(fx, u(10), "Premier of Fixturia", null, "head_of_government");
    await seedOffice(fx, u(11), "Premier, Executive Yuan", 0, "official");
    await seedPerson(fx, u(20), "Cho Jung-tai", "Q5116472");
    await seedPerson(fx, u(21), "Cho Jung-tai");
    await seedTerm(fx, u(30), u(10), u(20), true, "2024-05-20");
    await seedTerm(fx, u(31), u(11), u(21), true);
    await seedStatement(fx, u(31), "Premier, Executive Yuan", "2026-07-14 00:00:00");

    const roster: Position[] = [
      ["Premier, Executive Yuan", "CHO Jung-tai"],
      ["Min. without Portfolio", "CHO Jung-tai"],
    ];
    const first = await run(fx, page("7/14/2026", roster));
    assert.deepEqual(first.skipped, []);
    assert.equal(first.personsIdlessCreated, 0);
    const holders = await fx.query<{ person_id: string }>(
      `SELECT DISTINCT t.person_id FROM terms t JOIN offices o ON o.id = t.office_id
       WHERE o.office_type IN ('official', 'cabinet') AND t.is_current`,
    );
    assert.deepEqual(holders, [{ person_id: u(21) }]);
    const history = await historyCount(fx);
    const rerun = await run(fx, page("7/14/2026", roster));
    assert.equal(rerun.totalRowsWritten, 0);
    assert.equal(await historyCount(fx), history);

    await seedPerson(fx, u(22), "Sam Same");
    await seedPerson(fx, u(23), "Sam Same");
    const writes = await historyCount(fx);
    const ambiguous = await run(
      fx,
      page("7/14/2026", [...roster, ["Min. of Sport", "Sam SAME"]]),
    );
    assert.deepEqual(
      ambiguous.skipped.map((failure) => failure.code),
      ["person_identity_ambiguous"],
    );
    assert.equal(await historyCount(fx), writes);
    assert.equal(ambiguous.freshnessStamped, false);
  } finally {
    await fx.close();
  }
});

test("identity guards fail closed without writing", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    await seedOffice(fx, u(10), "President of Fixturia", null, "head_of_state");
    const headCollision = await run(
      fx,
      page("7/1/2026", [["President of Fixturia", "Ana X"]]),
    );
    // "President of ..." is a head title, so it never reaches the roster.
    assert.deepEqual(headCollision.skipped, []);
    const collision = await run(
      fx,
      page("7/1/2026", [["Secretary General", "Ana X"]]),
    );
    assert.deepEqual(collision.skipped, []);
    await fx.query(
      `UPDATE offices SET name = 'Secretary of the Presidency' WHERE id = $1`,
      [u(10)],
    );
    const renamedHead = await run(
      fx,
      page("7/2/2026", [["Secretary of the Presidency", "Ana X"]]),
    );
    assert.deepEqual(
      renamedHead.skipped.map((f) => f.code),
      ["office_identity_conflict"],
    );

    await seedOffice(fx, u(11), "Min. of Finance", 5);
    await seedOffice(fx, u(12), "Min. of Finance", 6);
    const history = await historyCount(fx);
    const duplicate = await run(fx, page("7/2/2026", [["Min. of Finance", "Jane DOE"]]));
    assert.deepEqual(
      duplicate.skipped.map((f) => f.code),
      ["office_identity_conflict"],
    );
    assert.equal(await historyCount(fx), history);
    assert.equal(await fx.count("persons", "name = 'Jane Doe'"), 0);
  } finally {
    await fx.close();
  }
});

test("contraction and stamp-regression guards fail closed without writing", async () => {
  const fx = await fixture();
  try {
    const roster: Position[] = Array.from({ length: 10 }, (_, index) => [
      `Min. of Portfolio ${index}`,
      `Holder${String.fromCharCode(65 + index)} HOLDER`,
    ]);
    await run(fx, page("8/1/2026", roster));
    const history = await historyCount(fx);

    const contraction = await run(fx, page("8/2/2026", roster.slice(0, 3)));
    assert.deepEqual(
      contraction.skipped.map((f) => f.code),
      ["roster_contraction_guard"],
    );

    const sameStampChurn = await run(
      fx,
      page("8/1/2026", [
        ...roster.slice(0, 4),
        ...Array.from(
          { length: 6 },
          (_, index): Position => [
            `Renamed Ministry ${index}`,
            `Holder${String.fromCharCode(70 + index)} HOLDER`,
          ],
        ),
      ]),
    );
    assert.deepEqual(
      sameStampChurn.skipped.map((f) => f.code),
      ["roster_contraction_guard"],
    );

    const regressed = await run(fx, page("7/1/2026", roster));
    assert.deepEqual(
      regressed.skipped.map((f) => f.code),
      ["roster_stamp_regressed"],
    );
    assert.equal(await historyCount(fx), history);
    assert.equal(regressed.freshnessStamped, false);
  } finally {
    await fx.close();
  }
});

test("a failed country write rolls back that country only and blocks freshness", async () => {
  const fx = await fixture();
  try {
    await fx.query(
      `ALTER TABLE statements ADD CONSTRAINT fixture_block
         CHECK (object_value IS DISTINCT FROM 'Min. of Doom')`,
    );
    const before = await lastSync(fx);
    const result = await run(fx, {
      fixturia: page("7/1/2026", [
        ["Min. of Finance", "Jane DOE"],
        ["Min. of Doom", "Dora DOOM"],
      ]),
      otheria: page("7/1/2026", [["Min. of Otherness", "Olly OTHER"]], "Otheria"),
    });
    assert.deepEqual(
      result.skipped.map((failure) => [failure.slug, failure.code]),
      [["fixturia", "persistence_error"]],
    );
    assert.equal(
      await fx.count("government_bodies", "jurisdiction_id = $1", [JURISDICTION]),
      0,
    );
    assert.equal(
      await fx.count("persons", "name IN ('Jane Doe', 'Dora Doom')"),
      0,
    );
    assert.deepEqual(await currentHolders(fx, "Min. of Otherness"), ["Olly Other"]);
    assert.equal(result.freshnessStamped, false);
    assert.equal(await lastSync(fx), before);
  } finally {
    await fx.close();
  }
});

test("a blocked office insert rolls the whole country back through the batch assertion", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    // A non-roster office already occupying list position 1 makes the shared
    // writer's same-position rename guard refuse the new vacant title.
    await seedOffice(fx, u(10), "Ambassador to the UN", 1, "diplomatic");
    const history = await historyCount(fx);
    const result = await run(
      fx,
      page("7/1/2026", [
        ["Min. of Finance", "Jane DOE"],
        ["Min. of Planning", null],
      ]),
    );
    assert.deepEqual(
      result.skipped.map((failure) => failure.code),
      ["office_identity_conflict"],
    );
    assert.equal(await fx.count("offices"), 1);
    assert.equal(await fx.count("persons"), 0);
    assert.equal(await fx.count("statements"), 0);
    assert.equal(await historyCount(fx), history);
  } finally {
    await fx.close();
  }
});

test("a dry run plans the same changes as the apply and writes nothing", async () => {
  const fx = await fixture();
  try {
    await seedBody(fx);
    await seedOffice(fx, u(10), "Min. of Tourism", 0);
    await seedPerson(fx, u(20), "Old Minister");
    await seedTerm(fx, u(30), u(10), u(20), true, "2026-02-06");
    await seedStatement(fx, u(30), "Min. of Tourism", "2026-07-01 00:00:00");
    const snapshot = async () =>
      JSON.stringify(
        await fx.query(
          `SELECT (SELECT count(*) FROM offices) o, (SELECT count(*) FROM terms) t,
                  (SELECT count(*) FROM statements) s, (SELECT count(*) FROM persons) p,
                  (SELECT count(*) FROM research_evidence_history) h,
                  (SELECT count(*) FROM atlas_entity_change_history) a`,
        ),
      );
    const before = await snapshot();
    const html = page("8/1/2026", BASE_ROSTER);
    const planned = await run(fx, html, { dryRun: true });
    assert.equal(await snapshot(), before);
    assert.equal(planned.freshnessStamped, false);
    const applied = await run(fx, html);
    const counts = (summary: typeof planned) => {
      const {
        startedAt: _startedAt,
        finishedAt: _finishedAt,
        durationMs: _durationMs,
        dryRun: _dryRun,
        freshnessStamped: _freshnessStamped,
        ...rest
      } = summary;
      return rest;
    };
    assert.deepEqual(counts(planned), counts(applied));
    assert.ok(applied.totalRowsWritten > 0);
  } finally {
    await fx.close();
  }
});
