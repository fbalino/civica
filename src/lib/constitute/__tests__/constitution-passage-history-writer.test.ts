import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildConstitutionPassageHistoryStatement,
  constitutionPassagePublicId,
  prepareConstitutionPassageStatementRows,
  replaceConstitutionPassageProjectionWithHistory,
  type ConstitutionPassageProjectionInput,
} from "../constitution-passage-history-writer";
import { replaceCurrentConstitutionPassages } from "../sync-constitutions";

const CONSTITUTION_ID = "11111111-1111-4111-8111-111111111111";
const JURISDICTION_ID = "22222222-2222-4222-8222-222222222222";
const RELEASE_ID = "atlas-constitution-history-test";

function input(
  plainText: string,
  retrievedAt = new Date("2026-07-23T12:00:00.000Z"),
): ConstitutionPassageProjectionInput {
  return {
    constitutionId: CONSTITUTION_ID,
    jurisdictionId: JURISDICTION_ID,
    sourceDocumentId: "Testland_2026",
    retrievedAt,
    articles: [
      {
        sectionId: "section/1",
        headingLabel: "Article 1",
        topics: ["rights"],
        html: `<p>${plainText}</p>`,
      },
    ],
    history: {
      changeKind: "routine_refresh",
      reason: "Constitute Project constitution-passage source refresh",
      methodologyVersion: "constitution-passage-index/v1",
      releaseId: RELEASE_ID,
    },
  };
}

test("passage history statement locks, projects, supersedes, upserts, and appends atomically", () => {
  const query = new PgDialect().sqlToQuery(
    buildConstitutionPassageHistoryStatement(input("Everyone has rights.")),
  );

  assert.match(query.sql, /^\s*WITH lock_row AS MATERIALIZED/i);
  assert.match(query.sql, /pg_advisory_xact_lock/i);
  assert.match(query.sql, /locked_rows AS MATERIALIZED/i);
  assert.match(query.sql, /current_rows AS MATERIALIZED/i);
  assert.match(query.sql, /FOR UPDATE OF cp/i);
  assert.match(query.sql, /UPDATE constitution_passages cp/i);
  assert.match(query.sql, /INSERT INTO constitution_passages/i);
  assert.match(query.sql, /ON CONFLICT \(passage_id\) DO UPDATE/i);
  assert.match(query.sql, /INSERT INTO atlas_entity_change_history/i);
  assert.match(
    query.sql,
    /regexp_replace\(\s*after_row\.passage_id,\s*'\^constitution-passage\/'/i,
  );
  for (const field of [
    "heading_label",
    "plain_text",
    "source_id",
    "source_url",
    "language_code",
    "translation_status",
    "is_current",
  ]) {
    assert.match(query.sql, new RegExp(`'field', '${field}'`));
  }
  assert.equal(query.sql.includes("'field', 'retrieved_at'"), false);
  assert.ok(query.params.includes(RELEASE_ID));
});

test("public passage identity strips exactly the database-only prefix", () => {
  const databaseId = `constitution-passage/sha256:${"a".repeat(64)}`;
  assert.equal(
    constitutionPassagePublicId(databaseId),
    `sha256:${"a".repeat(64)}`,
  );
  assert.throws(
    () => constitutionPassagePublicId(`sha256:${"a".repeat(64)}`),
    /digest-bound DB key/,
  );
  assert.throws(
    () => constitutionPassagePublicId("constitution-passage/sha256:short"),
    /digest-bound DB key/,
  );
});

test("planning is release-independent but an apply call fails before execute without history", async () => {
  const plannedInput = input("Everyone has rights.");
  assert.equal(
    prepareConstitutionPassageStatementRows({
      constitutionId: plannedInput.constitutionId,
      jurisdictionId: plannedInput.jurisdictionId,
      sourceDocumentId: plannedInput.sourceDocumentId,
      retrievedAt: plannedInput.retrievedAt,
      articles: plannedInput.articles,
    }).length,
    1,
  );

  let executes = 0;
  const database = {
    execute: async () => {
      executes += 1;
      return [];
    },
  };
  await assert.rejects(
    replaceCurrentConstitutionPassages(database as never, {
      constitutionId: CONSTITUTION_ID,
      jurisdictionId: JURISDICTION_ID,
      sourceDocumentId: "Testland_2026",
      retrievedAt: new Date("2026-07-23T12:00:00.000Z"),
      articles: [...input("Everyone has rights.").articles],
    }),
    /named Atlas release history context/,
  );
  assert.equal(executes, 0);
});

async function passageDatabase(): Promise<PGlite> {
  const database = new PGlite();
  await database.exec(`
    CREATE TABLE constitution_passages (
      passage_id text PRIMARY KEY,
      schema_version text NOT NULL,
      search_index_version text NOT NULL,
      constitution_id uuid NOT NULL,
      jurisdiction_id uuid NOT NULL,
      source_document_id text NOT NULL,
      source_section_id text NOT NULL,
      section_order integer NOT NULL,
      anchor_id text NOT NULL,
      heading_label text,
      topic_keys jsonb NOT NULL,
      plain_text text NOT NULL,
      content_sha256 text NOT NULL,
      language_code text NOT NULL,
      language_basis text NOT NULL,
      translation_status text NOT NULL,
      original_language_code text,
      translator text,
      source_id text NOT NULL,
      source_url text NOT NULL,
      retrieval_url text NOT NULL,
      retrieved_at timestamp NOT NULL,
      is_current boolean NOT NULL,
      superseded_at timestamp,
      created_at timestamp NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX constitution_passages_current_section_fixture
      ON constitution_passages (constitution_id, source_section_id)
      WHERE is_current = true;

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
      recorded_at timestamp NOT NULL DEFAULT NOW()
    );
  `);
  return database;
}

test("PostgreSQL reruns converge and content reversion reactivates the stable digest", async () => {
  const database = await passageDatabase();
  const db = drizzle(database);
  try {
    const firstInput = input(
      "Everyone has rights.",
      new Date("2026-07-23T12:00:00.000Z"),
    );
    assert.deepEqual(
      await replaceConstitutionPassageProjectionWithHistory(
        db as never,
        firstInput,
      ),
      { current: 1, written: 1, superseded: 0 },
    );
    const [firstRow] = prepareConstitutionPassageStatementRows(firstInput);
    const firstPublicId = constitutionPassagePublicId(firstRow.passage_id);

    const secondResult = await replaceConstitutionPassageProjectionWithHistory(
        db as never,
        input(
          "Everyone has rights.",
          new Date("2026-07-23T13:00:00.000Z"),
        ),
      );
    assert.deepEqual(secondResult, { current: 1, written: 0, superseded: 0 });
    let state = await database.query<{
      current_count: number;
      history_count: number;
      retrieved_at: string;
    }>(`
      SELECT
        count(*) FILTER (WHERE is_current)::integer AS current_count,
        (SELECT count(*)::integer FROM atlas_entity_change_history) AS history_count,
        max(retrieved_at)::text AS retrieved_at
      FROM constitution_passages
    `);
    assert.equal(state.rows[0].current_count, 1);
    assert.equal(state.rows[0].history_count, 1);
    assert.match(state.rows[0].retrieved_at, /2026-07-23 13:00:00/);

    const revisedInput = input(
      "Every person has equal rights.",
      new Date("2026-07-23T14:00:00.000Z"),
    );
    assert.deepEqual(
      await replaceConstitutionPassageProjectionWithHistory(
        db as never,
        revisedInput,
      ),
      { current: 1, written: 1, superseded: 1 },
    );
    const [revisedRow] = prepareConstitutionPassageStatementRows(revisedInput);
    const revisedPublicId = constitutionPassagePublicId(revisedRow.passage_id);
    assert.notEqual(revisedPublicId, firstPublicId);

    const revisionEvents = await database.query<{
      entity_id: string;
      operation: string;
      changes: Array<{ field: string; before: unknown; after: unknown }>;
    }>(`
      SELECT entity_id, operation, changes
      FROM atlas_entity_change_history
      ORDER BY recorded_at, entity_id
    `);
    assert.equal(revisionEvents.rows.length, 3);
    assert.ok(
      revisionEvents.rows.some(
        (event) =>
          event.entity_id === firstPublicId &&
          event.operation === "update" &&
          event.changes.some(
            (change) =>
              change.field === "is_current" &&
              change.before === true &&
              change.after === false,
          ),
      ),
    );
    assert.ok(
      revisionEvents.rows.some(
        (event) =>
          event.entity_id === revisedPublicId && event.operation === "insert",
      ),
    );
    assert.equal(
      revisionEvents.rows.some((event) =>
        event.changes.some((change) => change.field === "retrieved_at"),
      ),
      false,
    );

    assert.deepEqual(
      await replaceConstitutionPassageProjectionWithHistory(
        db as never,
        input(
          "Everyone has rights.",
          new Date("2026-07-23T15:00:00.000Z"),
        ),
      ),
      { current: 1, written: 1, superseded: 1 },
    );
    state = await database.query<{
      current_count: number;
      history_count: number;
      retrieved_at: string;
    }>(`
      SELECT
        count(*) FILTER (WHERE is_current)::integer AS current_count,
        (SELECT count(*)::integer FROM atlas_entity_change_history) AS history_count,
        max(retrieved_at)::text AS retrieved_at
      FROM constitution_passages
    `);
    assert.equal(state.rows[0].current_count, 1);
    assert.equal(state.rows[0].history_count, 5);
    const current = await database.query<{ passage_id: string }>(`
      SELECT passage_id
      FROM constitution_passages
      WHERE is_current = true
    `);
    assert.equal(current.rows[0].passage_id, firstRow.passage_id);
  } finally {
    await database.close();
  }
});
