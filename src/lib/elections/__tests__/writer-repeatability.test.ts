import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildElectionHistoryUpsertStatement,
  buildElectionTurnoutHistoryStatement,
  buildEstimatedElectionDeleteHistoryStatement,
  buildEstimatedElectionHistoryUpsertStatement,
  electionContestIdentityKey,
  writeElection,
} from "../writer";

const JURISDICTION_ID = "11111111-1111-4111-8111-111111111111";
const BODY_ID = "22222222-2222-4222-8222-222222222222";
const ELECTION_ID = "33333333-3333-4333-8333-333333333333";
const PROPOSED_ID = "44444444-4444-4444-8444-444444444444";

const input = {
  election: {
    jurisdictionId: JURISDICTION_ID,
    electionDate: "2025-04-28",
    electionType: "legislative",
    electionName: "Election",
    wikidataQid: "Q1",
  },
  results: [{ partyName: "Alpha", seatsWon: 10, isWinner: true }],
  provenance: {
    predicate: "wikidata_election_date",
    objectValue: "{}",
    sourceId: "wikidata",
    sourceUrl: "https://example.invalid",
    sourceLicense: "CC0",
  },
};

const history = {
  changeKind: "routine_refresh" as const,
  reason: "Fixture election refresh",
  methodologyVersion: "elections-fixture/v1",
  releaseId: "atlas-test",
};

function sqlText(query: ReturnType<typeof buildElectionHistoryUpsertStatement>) {
  return new PgDialect().sqlToQuery(query).sql;
}

async function electionDatabase() {
  const database = new PGlite();
  await database.exec(`
    CREATE TABLE elections (
      id uuid PRIMARY KEY,
      jurisdiction_id uuid NOT NULL,
      election_date date,
      election_type text,
      election_name text,
      electoral_system text,
      body_id uuid,
      turnout_percent real,
      registered_voters integer,
      total_valid_votes integer,
      wikidata_qid text,
      date_confidence text,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE election_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      election_id uuid NOT NULL,
      party_name text
    );
    CREATE TABLE statements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      subject_table text NOT NULL,
      subject_id uuid NOT NULL,
      predicate text NOT NULL,
      object_value text,
      source_id text NOT NULL,
      source_url text,
      source_license text,
      retrieved_at timestamp NOT NULL,
      confidence real,
      UNIQUE (subject_table, subject_id, predicate, source_id)
    );
    CREATE TABLE atlas_entity_change_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      entity_table text NOT NULL,
      operation text NOT NULL,
      change_kind text NOT NULL,
      changes jsonb NOT NULL,
      reason text NOT NULL,
      methodology_version text NOT NULL,
      release_id text NOT NULL,
      correction_log_id uuid,
      correction_status text,
      recorded_at timestamp DEFAULT now()
    );
  `);
  return database;
}

async function runStatement(
  database: PGlite,
  statement:
    | ReturnType<typeof buildElectionHistoryUpsertStatement>
    | ReturnType<typeof buildElectionTurnoutHistoryStatement>
    | ReturnType<typeof buildEstimatedElectionDeleteHistoryStatement>,
) {
  const query = new PgDialect().sqlToQuery(statement);
  return database.query<{
    id: string;
    inserted?: boolean;
    updated?: boolean;
    deleted?: boolean;
    history_written: boolean;
  }>(query.sql, query.params);
}

function harness() {
  let executes = 0;
  let resultRows: Array<Record<string, unknown>> = [];
  const db = {
    execute: async () => {
      executes++;
      return [
        executes === 1
          ? {
              id: ELECTION_ID,
              inserted: true,
              updated: false,
              history_written: true,
            }
          : {
              id: ELECTION_ID,
              inserted: false,
              updated: true,
              history_written: false,
            },
      ];
    },
    delete: () => ({
      where: async () => {
        resultRows = [];
      },
    }),
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        resultRows.push(structuredClone(row));
      },
    }),
  };
  return {
    db: db as never,
    state: () => structuredClone(resultRows),
    writes: () => executes,
  };
}

test("election fixture reruns converge on one stable election identity", async () => {
  const state = harness();
  await writeElection(state.db, input, { history });
  const first = state.state();
  await writeElection(state.db, input, { history });
  assert.deepEqual(state.state(), first);
  assert.equal(first.length, 1);
  assert.equal(first[0].electionId, ELECTION_ID);
});

test("shared election SQL locks before state and appends history atomically", () => {
  const query = sqlText(
    buildElectionHistoryUpsertStatement(
      input.election,
      input.provenance,
      history,
      PROPOSED_ID,
    ),
  );
  assert.match(query, /pg_advisory_xact_lock/i);
  assert.match(query, /before_row AS MATERIALIZED/i);
  assert.match(query, /FOR UPDATE OF e/i);
  assert.match(query, /UPDATE elections/i);
  assert.match(query, /INSERT INTO elections/i);
  assert.match(query, /INSERT INTO statements/i);
  assert.match(query, /INSERT INTO atlas_entity_change_history/i);
  assert.match(query, /jsonb_array_length\(changes\) > 0/i);
});

test("PostgreSQL fixture preserves UUIDs and emits history only for real diffs", async () => {
  const database = await electionDatabase();
  try {
    const first = await runStatement(
      database,
      buildElectionHistoryUpsertStatement(
        input.election,
        input.provenance,
        history,
        PROPOSED_ID,
      ),
    );
    const second = await runStatement(
      database,
      buildElectionHistoryUpsertStatement(
        input.election,
        input.provenance,
        history,
        "55555555-5555-4555-8555-555555555555",
      ),
    );
    assert.equal(first.rows[0]?.id, PROPOSED_ID);
    assert.equal(second.rows[0]?.id, PROPOSED_ID);
    assert.equal(second.rows[0]?.history_written, false);

    await runStatement(
      database,
      buildElectionHistoryUpsertStatement(
        {
          ...input.election,
          electionName: "Corrected election label",
        },
        input.provenance,
        history,
        "66666666-6666-4666-8666-666666666666",
      ),
    );
    const state = await database.query<{
      election_count: number;
      history_count: number;
      election_id: string;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM elections) AS election_count,
        (SELECT count(*)::integer FROM atlas_entity_change_history) AS history_count,
        (SELECT id::text FROM elections LIMIT 1) AS election_id
    `);
    assert.deepEqual(state.rows, [
      {
        election_count: 1,
        history_count: 2,
        election_id: PROPOSED_ID,
      },
    ]);
  } finally {
    await database.close();
  }
});

test("non-QID contests use publisher URL identity while estimates key by chamber", () => {
  const contestSql = sqlText(
    buildElectionHistoryUpsertStatement(
      {
        ...input.election,
        bodyId: BODY_ID,
        wikidataQid: null,
      },
      { ...input.provenance, sourceId: "ipu_parline" },
      history,
      PROPOSED_ID,
    ),
  );
  assert.match(contestSql, /identity_statement\.source_url/i);
  assert.match(contestSql, /claimed_statement/i);
  assert.doesNotMatch(contestSql, /mutable_date_identity_conflict/i);

  const estimateSql = sqlText(
    buildEstimatedElectionHistoryUpsertStatement(
      {
        jurisdictionId: JURISDICTION_ID,
        bodyId: BODY_ID,
        electionDate: "2029-04-28",
        electionType: "legislative",
        electionName: "Next election (estimated)",
        electoralSystem: null,
      },
      {
        ...input.provenance,
        predicate: "civica_estimated_next_election",
        sourceId: "ipu_parline",
      },
      history,
      PROPOSED_ID,
    ),
  );
  assert.match(estimateSql, /e\.date_confidence = 'estimated'/i);
  assert.doesNotMatch(
    estimateSql,
    /e\.election_date = \$\d+[\s\S]*LOWER\(e\.election_type\)/i,
  );
});

test("turnout and estimated deletion use bounded atomic history statements", () => {
  const turnoutSql = new PgDialect().sqlToQuery(
    buildElectionTurnoutHistoryStatement(
      {
        electionId: ELECTION_ID,
        turnoutPercent: 72.5,
        registeredVoters: 1000,
        totalValidVotes: 700,
      },
      {
        ...input.provenance,
        predicate: "idea_voter_turnout",
        sourceId: "international_idea",
      },
      history,
    ),
  ).sql;
  assert.match(turnoutSql, /before_row AS MATERIALIZED/i);
  assert.match(turnoutSql, /FOR UPDATE/i);
  assert.match(turnoutSql, /UPDATE elections/i);
  assert.match(turnoutSql, /INSERT INTO statements/i);
  assert.match(turnoutSql, /INSERT INTO atlas_entity_change_history/i);

  const deleteSql = new PgDialect().sqlToQuery(
    buildEstimatedElectionDeleteHistoryStatement(
      { jurisdictionId: JURISDICTION_ID, bodyId: BODY_ID },
      { ...history, changeKind: "substantive_revision" },
    ),
  ).sql;
  assert.match(deleteSql, /FOR UPDATE OF e/i);
  assert.match(deleteSql, /DELETE FROM elections/i);
  assert.match(deleteSql, /'delete'/i);
  assert.match(deleteSql, /INSERT INTO atlas_entity_change_history/i);
});

test("PostgreSQL fixture executes turnout and estimated upsert/delete atomically", async () => {
  const database = await electionDatabase();
  try {
    await runStatement(
      database,
      buildElectionHistoryUpsertStatement(
        input.election,
        input.provenance,
        history,
        PROPOSED_ID,
      ),
    );
    const turnout = await runStatement(
      database,
      buildElectionTurnoutHistoryStatement(
        {
          electionId: PROPOSED_ID,
          turnoutPercent: 72.5,
          registeredVoters: 1000,
          totalValidVotes: 700,
        },
        {
          ...input.provenance,
          predicate: "idea_voter_turnout",
          sourceId: "international_idea",
        },
        history,
      ),
    );
    assert.equal(turnout.rows[0]?.id, PROPOSED_ID);
    assert.equal(turnout.rows[0]?.history_written, true);

    const estimateInput = {
      jurisdictionId: JURISDICTION_ID,
      bodyId: BODY_ID,
      electionDate: "2029-04-28",
      electionType: "legislative",
      electionName: "Next election (estimated)",
      electoralSystem: null,
    };
    const estimateProvenance = {
      ...input.provenance,
      predicate: "civica_estimated_next_election",
      sourceId: "ipu_parline",
    };
    const estimateId = "77777777-7777-4777-8777-777777777777";
    const estimateFirst = await runStatement(
      database,
      buildEstimatedElectionHistoryUpsertStatement(
        estimateInput,
        estimateProvenance,
        history,
        estimateId,
      ),
    );
    const estimateSecond = await runStatement(
      database,
      buildEstimatedElectionHistoryUpsertStatement(
        { ...estimateInput, electionDate: "2030-04-28" },
        estimateProvenance,
        history,
        "88888888-8888-4888-8888-888888888888",
      ),
    );
    assert.equal(estimateFirst.rows[0]?.id, estimateId);
    assert.equal(estimateSecond.rows[0]?.id, estimateId);
    assert.equal(estimateSecond.rows[0]?.history_written, true);

    const deleted = await runStatement(
      database,
      buildEstimatedElectionDeleteHistoryStatement(
        { jurisdictionId: JURISDICTION_ID, bodyId: BODY_ID },
        { ...history, changeKind: "substantive_revision" },
      ),
    );
    assert.equal(deleted.rows[0]?.id, estimateId);
    assert.equal(deleted.rows[0]?.history_written, true);
    const remaining = await database.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM elections WHERE id = $1`,
      [estimateId],
    );
    assert.equal(remaining.rows[0]?.count, 0);
  } finally {
    await database.close();
  }
});

test("missing release context fails before any election write", async () => {
  const state = harness();
  await assert.rejects(writeElection(state.db, input), /named Atlas release/);
  assert.equal(state.writes(), 0);
});

test("production election scripts resolve release context before write code", () => {
  for (const path of [
    "scripts/sync-elections-ipu.ts",
    "scripts/sync-elections-wikidata.ts",
    "scripts/sync-elections-turnout-idea.ts",
  ]) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    const releaseResolution = source.indexOf("const ATLAS_RELEASE_ID");
    const mainFunction = source.indexOf("async function main()");
    assert.ok(
      releaseResolution >= 0 && releaseResolution < mainFunction,
      `${path} must fail closed on release context before main can write`,
    );
    assert.match(source, /resolveAtlasReleaseId/);
  }
});

test("election dry-run is stable, release-independent, and writes nothing", async () => {
  const state = harness();
  assert.deepEqual(
    await writeElection(state.db, input, { dryRun: true }),
    await writeElection(state.db, input, { dryRun: true }),
  );
  assert.equal(state.writes(), 0);
});

test("malformed and duplicate results fail before writes", async () => {
  const state = harness();
  await assert.rejects(
    writeElection(
      state.db,
      { ...input, results: [input.results[0], input.results[0]] },
      { history },
    ),
    /Duplicate/,
  );
  assert.equal(state.writes(), 0);
});

test("natural identity keeps same-day chamber contests separate", () => {
  const base = {
    jurisdictionId: JURISDICTION_ID,
    electionDate: "2025-04-28",
    electionType: "legislative",
    dateConfidence: "confirmed",
  };
  assert.notEqual(
    electionContestIdentityKey({ ...base, bodyId: BODY_ID }),
    electionContestIdentityKey({
      ...base,
      bodyId: "55555555-5555-4555-8555-555555555555",
    }),
  );
  assert.notEqual(
    electionContestIdentityKey({ ...base, bodyId: BODY_ID }),
    electionContestIdentityKey({ ...base, bodyId: null }),
  );
});
