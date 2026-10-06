import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { BILLS_SOURCE_LABELS } from "./coverage";
import { BILL_LAST_ACTION_REASONS } from "./last-action";
import {
  BILL_LAST_ACTION_DERIVATIONS,
  BillDateRepairPlanError,
  applyBillDateRepair,
  loadBillDateRepairState,
  planBillDateRepair,
  verifyBillDatePlanDigest,
  verifyBillDateRepair,
  type BillDateRepairExecutor,
} from "./last-action-repair";

const JURISDICTION = "11111111-1111-4111-8111-111111111111";
/** Every payload below was written on this day; retrieval uses this time. */
const WRITTEN = "2026-09-28 06:00:00";

interface Seed {
  id: string;
  source: string;
  date: string;
  introduced?: string | null;
  raw: unknown;
}

// Stored the way the former adapters stored them.
const SEEDS: Seed[] = [
  // Câmara list item: the adapter stored the write day.
  { id: "00000000-0000-4000-8000-000000000001", source: "camara_br", date: "2026-09-28", raw: { id: 401, siglaTipo: "PL" } },
  // Senado: DataUltimaAtualizacao.
  {
    id: "00000000-0000-4000-8000-000000000002",
    source: "senado_br",
    date: "2026-09-27",
    introduced: "2026-05-05",
    raw: {
      DadosBasicosMateria: { DataApresentacao: "2026-05-05" },
      AtualizacoesRecentes: { Atualizacao: [{ DataUltimaAtualizacao: "2026-09-27 10:00:00" }] },
    },
  },
  // DIP: aktualisiert as last action and datum as introduction.
  {
    id: "00000000-0000-4000-8000-000000000003",
    source: "bundestag_dip",
    date: "2026-09-28",
    introduced: "2026-06-30",
    raw: { id: "301", datum: "2026-06-30", aktualisiert: "2026-09-28T09:00:00+02:00" },
  },
  // UK: lastUpdate, with past and scheduled sittings.
  {
    id: "00000000-0000-4000-8000-000000000004",
    source: "uk_parliament",
    date: "2026-09-26",
    raw: {
      billId: 101,
      lastUpdate: "2026-09-26T10:00:00",
      currentStage: {
        stageSittings: [{ date: "2026-07-08T00:00:00" }, { date: "2026-10-20T00:00:00" }],
      },
    },
  },
  // UK: current stage has no sitting.
  {
    id: "00000000-0000-4000-8000-000000000005",
    source: "uk_parliament",
    date: "2026-09-28",
    raw: { billId: 102, lastUpdate: "2026-09-28T10:00:00", currentStage: { stageSittings: [] } },
  },
  // US: already correct.
  {
    id: "00000000-0000-4000-8000-000000000006",
    source: "congress_gov",
    date: "2026-07-10",
    raw: { updateDate: "2026-09-28", latestAction: { actionDate: "2026-07-10" } },
  },
  // US: updateDate substituted for a missing latest action.
  {
    id: "00000000-0000-4000-8000-000000000007",
    source: "congress_gov",
    date: "2026-09-28",
    raw: { updateDate: "2026-09-28" },
  },
  // Assemblée: acted on the write day — genuinely the last action.
  {
    id: "00000000-0000-4000-8000-000000000008",
    source: "data_assemblee_fr",
    date: "2026-09-28",
    raw: { actesLegislatifs: { acteLegislatif: { dateActe: "2026-09-28T00:00:00.000+02:00" } } },
  },
  // Assemblée: no dated act, today fallback.
  {
    id: "00000000-0000-4000-8000-000000000009",
    source: "data_assemblee_fr",
    date: "2026-09-28",
    raw: { actesLegislatifs: { acteLegislatif: { libelleActe: {} } } },
  },
  // Sénat: deposit date used as last action.
  {
    id: "00000000-0000-4000-8000-00000000000a",
    source: "senat_fr",
    date: "2026-02-03",
    introduced: "2026-02-03",
    raw: { dateInitiale: "03/02/2026", dateDecision: "", datePromulgation: "" },
  },
  // Sénat: promulgated, already correct.
  {
    id: "00000000-0000-4000-8000-00000000000b",
    source: "senat_fr",
    date: "2026-03-14",
    introduced: "2026-02-01",
    raw: { dateInitiale: "01/02/2026", dateDecision: "10/03/2026", datePromulgation: "14/03/2026" },
  },
  // LEGISinfo: already correct.
  {
    id: "00000000-0000-4000-8000-00000000000c",
    source: "legisinfo_ca",
    date: "2026-06-12",
    raw: { LatestBillEventDateTime: "2026-06-12T15:30:00" },
  },
];

async function seededDatabase(seeds: Seed[] = SEEDS): Promise<PGlite> {
  const database = new PGlite();
  await database.exec(`
    CREATE TABLE sources (id text PRIMARY KEY, last_sync_at timestamp);
    CREATE TABLE bills (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      jurisdiction_id uuid NOT NULL,
      source_id text NOT NULL REFERENCES sources(id),
      external_id text NOT NULL,
      title text NOT NULL,
      introduced_date date,
      last_action_date date NOT NULL,
      raw jsonb,
      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW()
    );
    CREATE INDEX bills_jurisdiction_last_action_idx
      ON bills USING btree (jurisdiction_id, last_action_date);
  `);
  for (const source of new Set(seeds.map((seed) => seed.source))) {
    await database.query(
      "INSERT INTO sources (id, last_sync_at) VALUES ($1, '2026-09-28 06:00:00')",
      [source],
    );
  }
  for (const seed of seeds) {
    await database.query(
      `INSERT INTO bills (id, jurisdiction_id, source_id, external_id, title,
         introduced_date, last_action_date, raw, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $1::text, 'Fixture', $4, $5, $6::jsonb, $7::timestamp, $7::timestamp)`,
      [seed.id, JURISDICTION, seed.source, seed.introduced ?? null, seed.date, JSON.stringify(seed.raw), WRITTEN],
    );
  }
  for (const statement of readFileSync(
    "drizzle/authoritative/0052_bill_last_action_date_state.sql",
    "utf8",
  ).split("--> statement-breakpoint")) {
    if (statement.trim()) await database.exec(statement);
  }
  return database;
}

function executorFor(database: PGlite): BillDateRepairExecutor {
  const dialect = new PgDialect();
  const run = async (statements: SQL[]) =>
    database.transaction(async (tx) => {
      const results: Record<string, unknown>[][] = [];
      for (const statement of statements) {
        const query = dialect.sqlToQuery(statement);
        results.push(
          (await tx.query<Record<string, unknown>>(query.sql, query.params)).rows,
        );
      }
      return results;
    });
  return { read: run, write: run };
}

async function datesById(database: PGlite) {
  const rows = (
    await database.query<{
      id: string;
      date: string | null;
      status: string;
      reason: string | null;
      introduced: string | null;
    }>(
      `SELECT id::text AS id, last_action_date::text AS date, last_action_date_status AS status,
        last_action_date_reason AS reason, introduced_date::text AS introduced
       FROM bills ORDER BY id`,
    )
  ).rows;
  return Object.fromEntries(rows.map((row) => [row.id.slice(-1), row]));
}

test("every deployed bills source has exactly one registered derivation", () => {
  assert.deepEqual(
    Object.keys(BILL_LAST_ACTION_DERIVATIONS).sort(),
    Object.keys(BILLS_SOURCE_LABELS).sort(),
  );
});

test("the plan re-derives every date from the retained payload and writes nothing", async () => {
  const database = await seededDatabase();
  try {
    const executor = executorFor(database);
    const before = await datesById(database);
    const plan = planBillDateRepair(await loadBillDateRepairState(executor));
    assert.ok(verifyBillDatePlanDigest(plan));
    assert.equal(
      planBillDateRepair(await loadBillDateRepairState(executor)).planSha256,
      plan.planSha256,
      "a repeat plan over the same rows is byte-identical",
    );
    assert.equal(
      planBillDateRepair(await loadBillDateRepairState(executor, 5)).planSha256,
      plan.planSha256,
      "paged loading yields the same plan",
    );
    assert.deepEqual(await datesById(database), before, "plan wrote nothing");

    assert.equal(plan.rowsRead, 12);
    assert.deepEqual(plan.totals, {
      targets: 8,
      dateCleared: 6,
      dateReplaced: 2,
      absenceRelabelled: 0,
      introducedCleared: 1,
    });
    assert.deepEqual(
      plan.targets.map((target) => [target.id.slice(-1), target.categories]),
      [
        ["1", ["date_cleared"]],
        ["2", ["date_cleared"]],
        ["3", ["date_replaced", "introduced_cleared"]],
        ["4", ["date_replaced"]],
        ["5", ["date_cleared"]],
        ["7", ["date_cleared"]],
        ["9", ["date_cleared"]],
        ["a", ["date_cleared"]],
      ],
    );
    // The write-day heuristic both over- and under-counts: the Assemblée row
    // acted on its write day is genuine, and the UK/Senado/Sénat rows are
    // wrong without equalling it.
    assert.equal(plan.bySource.data_assemblee_fr.storedDateWasWriteDay, 2);
    assert.equal(plan.bySource.data_assemblee_fr.writeDayConfirmedByPayload, 1);
    assert.equal(plan.bySource.uk_parliament.storedDateWasWriteDay, 1);
    assert.equal(plan.bySource.uk_parliament.targets, 2);
  } finally {
    await database.close();
  }
});

test("apply runs the exact plan once; replay and a new plan change nothing; verify passes", async () => {
  const database = await seededDatabase();
  try {
    const executor = executorFor(database);
    const plan = planBillDateRepair(await loadBillDateRepairState(executor));
    const updatedAtBefore = (
      await database.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM bills WHERE updated_at::text = $1",
        [WRITTEN],
      )
    ).rows[0].n;

    const applied = await applyBillDateRepair(executor, plan);
    assert.equal(applied.rowsUpdated, 8);
    assert.equal(applied.targetsAlreadyRepaired, 0);

    const after = await datesById(database);
    assert.deepEqual(
      Object.fromEntries(Object.entries(after).map(([id, row]) => [id, row.date])),
      {
        "1": null,
        "2": null,
        "3": "2026-06-30",
        "4": "2026-07-08",
        "5": null,
        "6": "2026-07-10",
        "7": null,
        "8": "2026-09-28",
        "9": null,
        a: null,
        b: "2026-03-14",
        c: "2026-06-12",
      },
    );
    assert.deepEqual(after["1"], {
      id: after["1"].id,
      date: null,
      status: "missing",
      reason: BILL_LAST_ACTION_REASONS.camaraListFeed,
      introduced: null,
    });
    assert.equal(after["3"].introduced, null);
    assert.equal(after["a"].status, "not_observed");
    assert.equal(after["a"].introduced, "2026-02-03");
    assert.equal(
      (
        await database.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM bills WHERE updated_at::text = $1",
          [WRITTEN],
        )
      ).rows[0].n,
      updatedAtBefore,
      "the repair keeps updated_at as the payload write time",
    );

    const replay = await applyBillDateRepair(executor, plan);
    assert.equal(replay.rowsUpdated, 0);
    assert.equal(replay.targetsAlreadyRepaired, 8);

    const verification = await verifyBillDateRepair(executor, { plan });
    assert.equal(verification.pass, true, JSON.stringify(verification.checks));
    assert.equal(
      planBillDateRepair(await loadBillDateRepairState(executor)).targets.length,
      0,
    );
    assert.deepEqual(verification.statusBySource.camara_br, { missing: 1 });
  } finally {
    await database.close();
  }
});

test("apply rolls back when a target or any other bill changed after the plan", async () => {
  for (const drift of [
    // A sync rewrote a target row's payload.
    `UPDATE bills SET raw = '{"id": 402}'::jsonb, updated_at = '2026-09-29 06:00:00'
      WHERE id = '00000000-0000-4000-8000-000000000001'`,
    // A sync touched a row the plan leaves alone.
    `UPDATE bills SET updated_at = '2026-09-29 06:00:00'
      WHERE id = '00000000-0000-4000-8000-000000000006'`,
  ]) {
    const database = await seededDatabase();
    try {
      const executor = executorFor(database);
      const plan = planBillDateRepair(await loadBillDateRepairState(executor));
      await database.exec(drift);
      const before = await datesById(database);
      await assert.rejects(
        applyBillDateRepair(executor, plan),
        /civica_assertion_failed:bill_date_repair_(drift|non_target_drift_before)/,
      );
      assert.deepEqual(await datesById(database), before, "nothing was written");
    } finally {
      await database.close();
    }
  }
});

test("apply refuses a plan whose contents no longer match its SHA-256", async () => {
  const database = await seededDatabase();
  try {
    const executor = executorFor(database);
    const plan = planBillDateRepair(await loadBillDateRepairState(executor));
    const tampered = {
      ...plan,
      targets: plan.targets.map((target, index) =>
        index === 0
          ? { ...target, after: { ...target.after, lastActionDate: "2026-01-01" } }
          : target,
      ),
    };
    await assert.rejects(applyBillDateRepair(executor, tampered), BillDateRepairPlanError);
  } finally {
    await database.close();
  }
});

test("the plan fails closed on an unregistered source or a payload it cannot read", async () => {
  const unknown = await seededDatabase([
    { id: "00000000-0000-4000-8000-0000000000f1", source: "new_source", date: "2026-09-28", raw: {} },
  ]);
  try {
    await assert.rejects(
      (async () => planBillDateRepair(await loadBillDateRepairState(executorFor(unknown))))(),
      /no registered derivation for source new_source/,
    );
  } finally {
    await unknown.close();
  }
  const noPayload = await seededDatabase([
    { id: "00000000-0000-4000-8000-0000000000f2", source: "uk_parliament", date: "2026-09-28", raw: null },
  ]);
  try {
    await assert.rejects(
      (async () => planBillDateRepair(await loadBillDateRepairState(executorFor(noPayload))))(),
      /has no retained payload/,
    );
  } finally {
    await noPayload.close();
  }
});
