import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import type { RawEventInput } from "./types";
import { rawEventInputErrors, upsertRawEvents } from "./upsert";

const RUN_1 = "11111111-1111-4111-8111-111111111111";
const RUN_2 = "22222222-2222-4222-8222-222222222222";
const RUN_3 = "33333333-3333-4333-8333-333333333333";

const fixture: RawEventInput = {
  sourceId: "gdelt",
  externalId: "fixture-1",
  sourceUrl: "https://example.test/fixture-1",
  sourceType: "news",
  eventDate: "2026-07-10",
  title: "Fixture event",
  raw: { fixture: true },
};

async function harness() {
  const database = new PGlite();
  await database.exec(`
    CREATE TABLE sources (
      id text PRIMARY KEY,
      last_sync_at timestamp
    );
    CREATE TABLE pulse_pipeline_runs (
      id uuid PRIMARY KEY,
      status text NOT NULL,
      counts jsonb NOT NULL DEFAULT '{}'::jsonb,
      failures jsonb NOT NULL DEFAULT '[]'::jsonb,
      completed_at timestamp
    );
    CREATE TABLE raw_events (
      id uuid PRIMARY KEY,
      source_id text NOT NULL,
      external_id text,
      source_url text NOT NULL,
      source_type text NOT NULL,
      jurisdiction_id uuid,
      raw_country_name text,
      event_date date,
      retrieved_at timestamp NOT NULL,
      title text NOT NULL,
      body text,
      raw jsonb NOT NULL,
      evidence_identity_key text NOT NULL UNIQUE,
      evidence_content_hash text NOT NULL,
      evidence_language text NOT NULL,
      evidence_publisher jsonb NOT NULL,
      evidence_attribution jsonb NOT NULL,
      evidence_rights jsonb NOT NULL,
      evidence_retention jsonb NOT NULL,
      ingest_run_id uuid NOT NULL
    );
    CREATE UNIQUE INDEX raw_events_external_unique
      ON raw_events (source_id, external_id)
      WHERE external_id IS NOT NULL;
    CREATE TABLE pulse_candidate_outcomes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      schema_version text NOT NULL,
      outcome_key text NOT NULL UNIQUE,
      candidate_kind text NOT NULL,
      candidate_id text NOT NULL,
      outcome text NOT NULL,
      reason_code text NOT NULL,
      reason text NOT NULL,
      actor jsonb NOT NULL,
      method_version text NOT NULL,
      stage_run_id uuid NOT NULL,
      decision_key text,
      canonical_candidate_id text,
      evidence_refs text[] NOT NULL,
      metadata jsonb NOT NULL,
      occurred_at timestamp NOT NULL
    );
    INSERT INTO sources (id) VALUES ('gdelt'), ('amnesty');
    INSERT INTO pulse_pipeline_runs (id, status)
    VALUES
      ('${RUN_1}', 'running'),
      ('${RUN_2}', 'running'),
      ('${RUN_3}', 'running');
  `);
  return { database, db: drizzle(database) };
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  // PGlite returns `timestamp without time zone` as a bare SQL timestamp;
  // Civica stores these values as UTC-naive, matching the production schema.
  const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(text)
    ? `${text.replace(" ", "T")}Z`
    : text;
  return new Date(utc).toISOString();
}

test("atomic Pulse upsert is idempotent and duplicate-only reruns do not stamp freshness", async () => {
  const state = await harness();
  try {
    const firstAt = new Date("2026-07-14T10:00:00.000Z");
    const first = await upsertRawEvents(state.db as never, [fixture], RUN_1, {
      committedAt: firstAt,
    });
    assert.deepEqual(first, {
      inserted: 1,
      skippedDuplicate: 0,
      sourcesStamped: ["gdelt"],
      rowOutcomes: ["inserted"],
    });

    const second = await upsertRawEvents(state.db as never, [fixture], RUN_2, {
      committedAt: new Date("2026-07-14T11:00:00.000Z"),
    });
    assert.deepEqual(second, {
      inserted: 0,
      skippedDuplicate: 1,
      sourcesStamped: [],
      rowOutcomes: ["duplicate"],
    });

    const counts = await state.database.query<{
      raw_count: number;
      outcome_count: number;
      last_sync_at: unknown;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM raw_events) AS raw_count,
        (SELECT count(*)::integer FROM pulse_candidate_outcomes) AS outcome_count,
        (SELECT to_char(last_sync_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         FROM sources WHERE id = 'gdelt') AS last_sync_at
    `);
    assert.equal(counts.rows[0].raw_count, 1);
    assert.equal(counts.rows[0].outcome_count, 1);
    assert.equal(iso(counts.rows[0].last_sync_at), firstAt.toISOString());
  } finally {
    await state.database.close();
  }
});

test("one successful PostgreSQL publish stamps every source that gained a row", async () => {
  const state = await harness();
  try {
    const amnesty: RawEventInput = {
      ...fixture,
      sourceId: "amnesty",
      externalId: "amnesty-fixture-1",
      sourceUrl: "https://example.test/amnesty-fixture-1",
      sourceType: "specialist",
      title: "Amnesty fixture event",
    };
    const result = await upsertRawEvents(
      state.db as never,
      [fixture, amnesty],
      RUN_1,
      {
        connectorIds: ["gdelt", "amnesty"],
        committedAt: new Date("2026-07-14T10:00:00.000Z"),
      },
    );
    assert.equal(result.inserted, 2);
    assert.deepEqual(result.sourcesStamped.toSorted(), ["amnesty", "gdelt"]);
    assert.deepEqual(result.rowOutcomes, ["inserted", "inserted"]);

    const stamped = await state.database.query<{ total: number }>(`
      SELECT count(*)::integer AS total
      FROM sources
      WHERE last_sync_at IS NOT NULL
    `);
    assert.equal(stamped.rows[0].total, 2);
  } finally {
    await state.database.close();
  }
});

test("empty input is a no-op and malformed input fails before the atomic statement", async () => {
  assert.deepEqual(await upsertRawEvents({} as never, [], RUN_1), {
    inserted: 0,
    skippedDuplicate: 0,
    sourcesStamped: [],
    rowOutcomes: [],
  });

  const malformed = { ...fixture, externalId: null, sourceUrl: null };
  assert.match(rawEventInputErrors(malformed).join(" "), /evidence identity/);
  await assert.rejects(
    upsertRawEvents({} as never, [malformed], RUN_1),
    /sourceUrl is required/,
  );
});

test("a later duplicate-evidence failure rolls back new rows and freshness, then retry converges", async () => {
  const state = await harness();
  try {
    const initialAt = new Date("2026-07-14T09:00:00.000Z");
    await upsertRawEvents(state.db as never, [fixture], RUN_1, {
      committedAt: initialAt,
    });
    await state.database.exec(`
      ALTER TABLE pulse_candidate_outcomes
      ADD CONSTRAINT reject_external_duplicate_fixture
      CHECK (reason_code <> 'source_external_id_duplicate');
    `);

    const newRow: RawEventInput = {
      ...fixture,
      externalId: "fixture-2",
      sourceUrl: "https://example.test/fixture-2",
      title: "Second fixture event",
    };
    await assert.rejects(
      upsertRawEvents(state.db as never, [newRow, fixture], RUN_2, {
        committedAt: new Date("2026-07-14T10:00:00.000Z"),
      }),
    );

    const afterFailure = await state.database.query<{
      raw_count: number;
      outcome_count: number;
      last_sync_at: unknown;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM raw_events) AS raw_count,
        (SELECT count(*)::integer FROM pulse_candidate_outcomes) AS outcome_count,
        (SELECT to_char(last_sync_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         FROM sources WHERE id = 'gdelt') AS last_sync_at
    `);
    assert.equal(afterFailure.rows[0].raw_count, 1);
    assert.equal(afterFailure.rows[0].outcome_count, 0);
    assert.equal(
      iso(afterFailure.rows[0].last_sync_at),
      initialAt.toISOString(),
    );

    await state.database.exec(`
      ALTER TABLE pulse_candidate_outcomes
      DROP CONSTRAINT reject_external_duplicate_fixture;
    `);
    const retryAt = new Date("2026-07-14T11:00:00.000Z");
    const retried = await upsertRawEvents(
      state.db as never,
      [newRow, fixture],
      RUN_2,
      { committedAt: retryAt },
    );
    assert.deepEqual(retried, {
      inserted: 1,
      skippedDuplicate: 1,
      sourcesStamped: ["gdelt"],
      rowOutcomes: ["inserted", "duplicate"],
    });

    const afterRetry = await state.database.query<{
      raw_count: number;
      outcome_count: number;
      last_sync_at: unknown;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM raw_events) AS raw_count,
        (SELECT count(*)::integer FROM pulse_candidate_outcomes) AS outcome_count,
        (SELECT to_char(last_sync_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         FROM sources WHERE id = 'gdelt') AS last_sync_at
    `);
    assert.equal(afterRetry.rows[0].raw_count, 2);
    assert.equal(afterRetry.rows[0].outcome_count, 1);
    assert.equal(iso(afterRetry.rows[0].last_sync_at), retryAt.toISOString());
  } finally {
    await state.database.close();
  }
});

test("pipeline finalization failure rolls back raw rows and freshness with no completed status", async () => {
  const state = await harness();
  try {
    await state.database.exec(`
      ALTER TABLE pulse_pipeline_runs
      ADD CONSTRAINT reject_completion_fixture CHECK (status <> 'completed');
    `);
    await assert.rejects(
      upsertRawEvents(state.db as never, [fixture], RUN_3, {
        connectorIds: ["gdelt"],
        finalizeRun: {
          counts: {
            fetched: 1,
            inserted: 0,
            skipped: 0,
            unmatched: 0,
            wouldWrite: 1,
            "connector.gdelt.inserted": 0,
            "connector.gdelt.skippedDuplicate": 0,
          },
        },
        committedAt: new Date("2026-07-14T12:00:00.000Z"),
      }),
    );

    const failed = await state.database.query<{
      raw_count: number;
      last_sync_at: unknown;
      status: string;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM raw_events) AS raw_count,
        (SELECT to_char(last_sync_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         FROM sources WHERE id = 'gdelt') AS last_sync_at,
        (SELECT status FROM pulse_pipeline_runs WHERE id = '${RUN_3}') AS status
    `);
    assert.equal(failed.rows[0].raw_count, 0);
    assert.equal(failed.rows[0].last_sync_at, null);
    assert.equal(failed.rows[0].status, "running");

    await state.database.exec(`
      ALTER TABLE pulse_pipeline_runs DROP CONSTRAINT reject_completion_fixture;
    `);
    const retried = await upsertRawEvents(state.db as never, [fixture], RUN_3, {
      connectorIds: ["gdelt"],
      finalizeRun: {
        counts: {
          fetched: 1,
          inserted: 0,
          skipped: 0,
          unmatched: 0,
          wouldWrite: 1,
          "connector.gdelt.inserted": 0,
          "connector.gdelt.skippedDuplicate": 0,
        },
      },
      committedAt: new Date("2026-07-14T13:00:00.000Z"),
    });
    assert.equal(retried.inserted, 1);

    const completed = await state.database.query<{
      status: string;
      inserted: number;
      connector_inserted: number;
    }>(`
      SELECT
        status,
        (counts->>'inserted')::integer AS inserted,
        (counts->>'connector.gdelt.inserted')::integer AS connector_inserted
      FROM pulse_pipeline_runs
      WHERE id = '${RUN_3}'
    `);
    assert.deepEqual(completed.rows[0], {
      status: "completed",
      inserted: 1,
      connector_inserted: 1,
    });

    // Reusing a completed run cannot silently commit duplicate evidence. The
    // finalization guard raises and rolls that later CTE back as well.
    await assert.rejects(
      upsertRawEvents(state.db as never, [fixture], RUN_3, {
        connectorIds: ["gdelt"],
        finalizeRun: {
          counts: {
            fetched: 1,
            inserted: 0,
            skipped: 0,
            unmatched: 0,
            wouldWrite: 1,
          },
        },
      }),
    );
    const retainedOutcomes = await state.database.query<{ total: number }>(`
      SELECT count(*)::integer AS total FROM pulse_candidate_outcomes
    `);
    assert.equal(retainedOutcomes.rows[0].total, 0);
  } finally {
    await state.database.close();
  }
});
