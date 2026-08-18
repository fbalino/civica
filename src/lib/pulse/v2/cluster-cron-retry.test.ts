import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import { pulsePipelineRuns } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import { runClustering, type CandidateRow } from "./cluster";
import type { SemanticClusterPublisher } from "./cluster-publish";

type Db = NeonHttpDatabase<typeof schema>;

const EXECUTION_KEY = "c".repeat(64);
const RETRY_EXECUTION_KEY = "d".repeat(64);
const RAW_ID = "11111111-1111-4111-8111-111111111111";
const INGEST_RUN_ID = "22222222-2222-4222-8222-222222222222";
const INCIDENT_ID = "33333333-3333-4333-8333-333333333333";
const LATER_RAW_ID = "44444444-4444-4444-8444-444444444444";
const LATER_INGEST_RUN_ID = "55555555-5555-4555-8555-555555555555";
const REPAIR_EVENT_ID = "66666666-6666-4666-8666-666666666666";
const REPAIR_RAW_ID = "77777777-7777-4777-8777-777777777777";
const REPAIR_INCIDENT_ID = "88888888-8888-4888-8888-888888888888";
const NOW = new Date("2026-07-14T12:00:00.000Z");

const candidate: CandidateRow = {
  id: RAW_ID,
  jurisdictionId: null,
  eventDate: "2026-07-14",
  title: "Court removes election commissioner",
  body: "The national court removed the election commissioner.",
  sourceId: "fixture-source",
  sourceType: "news",
  sourceUrl: "https://example.test/report",
  sourceFamilyId: "fixture-publisher",
  language: "en",
  ingestRunId: INGEST_RUN_ID,
};

async function harness() {
  const database = new PGlite();
  await database.exec(`
    CREATE TABLE pulse_pipeline_runs (
      id uuid PRIMARY KEY,
      stage text NOT NULL,
      status text NOT NULL,
      version_key text NOT NULL,
      versions jsonb NOT NULL,
      counts jsonb NOT NULL DEFAULT '{}'::jsonb,
      failures jsonb NOT NULL DEFAULT '[]'::jsonb,
      started_at timestamp NOT NULL DEFAULT NOW(),
      completed_at timestamp
    );
    CREATE FUNCTION test_guard_pipeline_run() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.status <> 'running' THEN
        RAISE EXCEPTION 'terminal pipeline run is immutable';
      END IF;
      IF NEW.status NOT IN ('completed', 'partial', 'failed')
         OR NEW.completed_at IS NULL THEN
        RAISE EXCEPTION 'running pipeline run may only close';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER test_pipeline_run_immutable
    BEFORE UPDATE ON pulse_pipeline_runs
    FOR EACH ROW EXECUTE FUNCTION test_guard_pipeline_run();
    CREATE TABLE raw_events (
      id uuid PRIMARY KEY,
      jurisdiction_id uuid,
      event_date date,
      title text NOT NULL,
      body text,
      source_id text NOT NULL,
      source_type text NOT NULL,
      source_url text NOT NULL,
      embedding real[],
      evidence_language text NOT NULL,
      evidence_publisher jsonb NOT NULL,
      ingest_run_id uuid NOT NULL,
      incident_id uuid,
      cluster_id uuid,
      classification_disposition text NOT NULL DEFAULT 'pending',
      classification_reason text,
      classification_decision jsonb,
      classification_run_id uuid,
      classified_at timestamp,
      created_at timestamp
    );
    CREATE TABLE pulse_events_v2 (
      id uuid PRIMARY KEY,
      incident_id uuid NOT NULL,
      projection_status text NOT NULL,
      classification_run_id uuid NOT NULL,
      updated_at timestamp NOT NULL
    );
    CREATE TABLE pulse_sources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL,
      source_id text NOT NULL,
      source_type text NOT NULL,
      source_name text NOT NULL,
      source_url text,
      raw_event_id uuid NOT NULL
    );
    CREATE UNIQUE INDEX idx_pulse_sources_raw_event_unique
      ON pulse_sources (raw_event_id) WHERE raw_event_id IS NOT NULL;
  `);
  return {
    database,
    db: drizzle(database, { schema }) as unknown as Db,
  };
}

function completingPublisher(calls: {
  count: number;
}): SemanticClusterPublisher {
  return async (db, plan) => {
    calls.count++;
    assert.ok(plan.completion);
    await db
      .update(pulsePipelineRuns)
      .set({
        status: "completed",
        counts: plan.completion.counts,
        failures: [],
        completedAt: new Date(plan.completion.completedAt),
      })
      .where(eq(pulsePipelineRuns.id, plan.completion.runId));
  };
}

test("completed cluster delivery retry is a no-op before rereading the queue", async () => {
  const state = await harness();
  const calls = { count: 0 };
  try {
    const first = await runClustering(state.db, {
      candidates: [candidate],
      persistedIncidents: [],
      embeddingResult: [[1, 0]],
      clusterIdFactory: () => INCIDENT_ID,
      now: NOW,
      cronExecutionKey: EXECUTION_KEY,
      persistRun: true,
      publishPlan: completingPublisher(calls),
    });
    const retry = await runClustering(state.db, {
      // The first publish consumed the real queue. A wrapper-finalization retry
      // must reuse the completed run before deriving a new empty-input version.
      candidates: [],
      persistedIncidents: [],
      embeddingResult: [],
      now: NOW,
      cronExecutionKey: EXECUTION_KEY,
      persistRun: true,
      publishPlan: completingPublisher(calls),
    });

    assert.equal(first.reused, false);
    assert.equal(retry.reused, true);
    assert.equal(retry.runId, first.runId);
    assert.equal(retry.versionKey, first.versionKey);
    assert.equal(retry.clustered, 1);
    assert.equal(calls.count, 1);
    const runs = await state.database.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM pulse_pipeline_runs",
    );
    assert.equal(runs.rows[0].count, 1);
  } finally {
    await state.database.close();
  }
});

test("publish failure and lexical fallback leave deterministic runs retryable", async () => {
  const state = await harness();
  let attempts = 0;
  const publisher: SemanticClusterPublisher = async (db, plan) => {
    attempts++;
    if (attempts === 1) throw new Error("injected publish failure");
    await completingPublisher({ count: 0 })(db, plan);
  };
  const options = {
    candidates: [candidate],
    persistedIncidents: [],
    clusterIdFactory: () => INCIDENT_ID,
    now: NOW,
    persistRun: true,
    publishPlan: publisher,
  };
  try {
    // The no-embedding path publishes nothing and finalizes its run row
    // honestly as terminal 'partial' — a row stuck at 'running' is how the
    // scheduler outage hid.
    const lexical = await runClustering(state.db, {
      ...options,
      cronExecutionKey: EXECUTION_KEY,
      embeddingResult: null,
    });
    assert.equal(lexical.status, "partial");
    assert.equal(lexical.clustered, 0);
    assert.equal(attempts, 0);

    // The partial run is terminal: the same delivery identity cannot be
    // resumed with embeddings later. Real clustering arrives under a fresh
    // delivery identity (the owner-Mac runner's own scheduled execution).
    await assert.rejects(
      runClustering(state.db, {
        ...options,
        cronExecutionKey: EXECUTION_KEY,
        embeddingResult: [[1, 0]],
      }),
      /Terminal Pulse pipeline run cannot be resumed/,
    );

    // Under the fresh identity, an injected publish failure leaves one
    // deterministic run retryable, and the retry completes it.
    await assert.rejects(
      runClustering(state.db, {
        ...options,
        cronExecutionKey: RETRY_EXECUTION_KEY,
        embeddingResult: [[1, 0]],
      }),
      /injected publish failure/,
    );
    const retry = await runClustering(state.db, {
      ...options,
      cronExecutionKey: RETRY_EXECUTION_KEY,
      embeddingResult: [[1, 0]],
    });
    assert.equal(retry.status, "completed");
    assert.equal(retry.reused, false);
    assert.equal(attempts, 2);

    const rows = await state.database.query<{
      status: string;
      count: number;
    }>(`
      SELECT status, count(*)::integer AS count
      FROM pulse_pipeline_runs
      GROUP BY status
      ORDER BY status
    `);
    assert.deepEqual(rows.rows, [
      { status: "completed", count: 1 },
      { status: "partial", count: 1 },
    ]);
  } finally {
    await state.database.close();
  }
});

test("running delivery retry keeps its ordered cutoff when later input arrives", async () => {
  const state = await harness();
  let attempts = 0;
  const publishedRawIds: string[][] = [];
  const publisher: SemanticClusterPublisher = async (db, plan) => {
    attempts++;
    publishedRawIds.push(
      plan.assignments.map(({ assignment }) => assignment.rawEventId),
    );
    if (attempts === 1) throw new Error("injected publish failure");
    await completingPublisher({ count: 0 })(db, plan);
  };
  try {
    await state.database.exec(`
      INSERT INTO raw_events
        (id, event_date, title, body, source_id, source_type, source_url,
         evidence_language, evidence_publisher, ingest_run_id, created_at)
      VALUES
        ('${RAW_ID}', '2026-07-14', 'Initial report', 'Initial body',
         'source-a', 'news', 'https://example.test/initial', 'en',
         '{"sourceFamilyId":"publisher-a"}'::jsonb,
         '${INGEST_RUN_ID}', '2026-07-14 10:00:00');
    `);
    const baseOptions = {
      persistedIncidents: [],
      embeddingResult: [[1, 0]],
      clusterIdFactory: () => INCIDENT_ID,
      cronExecutionKey: EXECUTION_KEY,
      publishPlan: publisher,
    };
    await assert.rejects(
      runClustering(state.db, {
        ...baseOptions,
        now: new Date("2026-07-14T12:00:00.000Z"),
      }),
      /injected publish failure/,
    );

    await state.database.exec(`
      INSERT INTO raw_events
        (id, event_date, title, body, source_id, source_type, source_url,
         evidence_language, evidence_publisher, ingest_run_id, created_at)
      VALUES
        ('${LATER_RAW_ID}', '2026-07-14', 'Later report', 'Later body',
         'source-b', 'news', 'https://example.test/later', 'en',
         '{"sourceFamilyId":"publisher-b"}'::jsonb,
         '${LATER_INGEST_RUN_ID}', '2026-07-14 13:00:00');
    `);
    const retry = await runClustering(state.db, {
      ...baseOptions,
      now: new Date("2026-07-14T14:00:00.000Z"),
    });

    assert.equal(retry.status, "completed");
    assert.equal(retry.candidates, 1);
    assert.deepEqual(publishedRawIds, [[RAW_ID], [RAW_ID]]);
    const runRows = await state.database.query<{
      started_at: string;
      status: string;
    }>(
      "SELECT to_char(started_at, 'YYYY-MM-DD HH24:MI:SS') AS started_at, status FROM pulse_pipeline_runs",
    );
    assert.equal(runRows.rows[0].status, "completed");
    assert.equal(runRows.rows[0].started_at, "2026-07-14 12:00:00");
  } finally {
    await state.database.close();
  }
});

test("production late-evidence repair records repair time, not the frozen queue cutoff", async () => {
  const state = await harness();
  const historicalCutoff = new Date("2000-01-01T00:00:00.000Z");
  try {
    await state.database.exec(`
      INSERT INTO pulse_events_v2
        (id, incident_id, projection_status, classification_run_id, updated_at)
      VALUES
        ('${REPAIR_EVENT_ID}', '${REPAIR_INCIDENT_ID}', 'current',
         '${INGEST_RUN_ID}', '2026-07-14 11:59:00');
      INSERT INTO raw_events
        (id, title, source_id, source_type, source_url, evidence_language,
         evidence_publisher, ingest_run_id, incident_id, cluster_id,
         classification_disposition, created_at)
      VALUES
        ('${REPAIR_RAW_ID}', 'Late evidence', 'late-source', 'news',
         'https://example.test/late-evidence', 'en',
         '{"sourceFamilyId":"late-publisher"}'::jsonb, '${INGEST_RUN_ID}',
         '${REPAIR_INCIDENT_ID}', '${REPAIR_INCIDENT_ID}', 'pending',
         '2026-07-14 11:58:00');
    `);

    const summary = await runClustering(state.db, {
      now: historicalCutoff,
      cronExecutionKey: "e".repeat(64),
      persistRun: true,
    });
    assert.equal(summary.candidates, 0);

    const repaired = await state.database.query<{
      disposition: string;
      classification_run_id: string;
      repair_after_cutoff: boolean;
      source_count: number;
    }>(`
      SELECT
        r.classification_disposition AS disposition,
        r.classification_run_id,
        r.classified_at > p.started_at AS repair_after_cutoff,
        (SELECT count(*)::integer FROM pulse_sources
         WHERE raw_event_id = r.id) AS source_count
      FROM raw_events r
      CROSS JOIN pulse_pipeline_runs p
      WHERE r.id = '${REPAIR_RAW_ID}'
    `);
    assert.deepEqual(repaired.rows[0], {
      disposition: "event",
      classification_run_id: INGEST_RUN_ID,
      repair_after_cutoff: true,
      source_count: 1,
    });
  } finally {
    await state.database.close();
  }
});
