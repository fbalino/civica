import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { legacyDerivationVersionEnvelope } from "@/lib/research/derivation-version";
import { corroborateEvents, type EventRow, type SourceCounts } from "./corroborate";
import { pulseCronStageRunId } from "./pipeline-version";
import { missingInformationEnvironmentContext } from "./press-freedom";
import { calculateDimensionalDeltas, type PublishedEvent } from "./score";

type Db = NeonHttpDatabase<typeof schema>;

const PIPELINE_DDL = `
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
`;

function atomicDb(database: PGlite): Db {
  const db = drizzle(database, { schema }) as unknown as {
    batch: (queries: readonly unknown[]) => Promise<unknown[]>;
  };
  db.batch = async (queries: readonly unknown[]) =>
    database.transaction(async (tx) => {
      const results: unknown[] = [];
      for (const query of queries as Array<{
        toSQL(): { sql: string; params: unknown[] };
      }>) {
        const compiled = query.toSQL();
        results.push(await tx.query(compiled.sql, compiled.params));
      }
      return results;
    });
  return db as unknown as Db;
}

test("corroboration publish rolls back, retries one stable run, and then becomes a no-op", async () => {
  const database = new PGlite();
  const executionKey = "c".repeat(64);
  const eventId = "11111111-1111-4111-8111-111111111111";
  const clusterId = "22222222-2222-4222-8222-222222222222";
  try {
    await database.exec(`${PIPELINE_DDL}
      CREATE TABLE pulse_events_v2 (
        id uuid PRIMARY KEY,
        corroboration_confidence real,
        updated_at timestamp,
        corroboration_run_id uuid
      );
      CREATE TABLE pulse_event_decisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        schema_version text NOT NULL,
        decision_key text NOT NULL UNIQUE,
        cluster_id uuid NOT NULL,
        event_id uuid,
        kind text NOT NULL,
        verdict text NOT NULL,
        payload jsonb NOT NULL,
        actor jsonb NOT NULL,
        stage_run_id uuid NOT NULL,
        method_version text NOT NULL,
        rationale text NOT NULL,
        evidence_refs text[] NOT NULL,
        supersedes_decision_key text,
        decided_at timestamp NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT force_publish_failure CHECK (false)
      );
      INSERT INTO pulse_events_v2 (id) VALUES ('${eventId}');
    `);
    const db = atomicDb(database);
    const event: EventRow = {
      id: eventId,
      clusterId,
      jurisdictionId: "33333333-3333-4333-8333-333333333333",
      iso3: "URY",
      severityTier: "moderate_neg",
      classifierAgreement: "all",
      category: "judicial_purge",
      classificationRunId: "44444444-4444-4444-8444-444444444444",
    };
    const sourceCounts = new Map<string, SourceCounts>([
      [
        eventId,
        {
          specialist: new Set(["specialist-1"]),
          news: new Set(["news-1"]),
          sourceIds: new Set(["amnesty", "gdelt"]),
          reportCount: 2,
        },
      ],
    ]);
    const options = {
      events: [event],
      sourceCounts,
      informationContexts: new Map([
        [eventId, missingInformationEnvironmentContext("fixture")],
      ]),
      now: new Date("2026-07-14T08:00:00.000Z"),
      cronExecutionKey: executionKey,
      persistRun: true,
    };

    await assert.rejects(corroborateEvents(db, options));
    const runId = pulseCronStageRunId(executionKey, "corroborate");
    assert.deepEqual(
      (
        await database.query<{
          status: string;
          confidence: number | null;
          decisions: number;
        }>(`
          SELECT
            r.status,
            e.corroboration_confidence AS confidence,
            (SELECT count(*)::integer FROM pulse_event_decisions) AS decisions
          FROM pulse_pipeline_runs r
          CROSS JOIN pulse_events_v2 e
          WHERE r.id = $1
        `, [runId])
      ).rows[0],
      { status: "running", confidence: null, decisions: 0 },
    );

    await database.exec(
      "ALTER TABLE pulse_event_decisions DROP CONSTRAINT force_publish_failure",
    );
    await assert.rejects(
      corroborateEvents(db, {
        ...options,
        events: [{ ...event, category: "media_crackdown" }],
      }),
      /input values changed/,
    );
    const laterEvent: EventRow = {
      ...event,
      id: "99999999-9999-4999-8999-999999999999",
      clusterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    const changedInputRetry = {
      ...options,
      events: [event, laterEvent],
      // A retry after midnight must retain the first attempt's exact input
      // membership and decision timestamp.
      now: new Date("2026-07-15T08:00:00.000Z"),
    };
    const retried = await corroborateEvents(db, changedInputRetry);
    assert.equal(retried.reused, false);
    assert.equal(retried.runId, runId);
    const completedState = (
      await database.query<{
        status: string;
        decisions: number;
        corroboration_run_id: string;
        completion_ordered: boolean;
      }>(`
        SELECT
          r.status,
          r.completed_at >= r.started_at AS completion_ordered,
          (SELECT count(*)::integer FROM pulse_event_decisions) AS decisions,
          e.corroboration_run_id::text
        FROM pulse_pipeline_runs r
        CROSS JOIN pulse_events_v2 e
        WHERE r.id = $1
      `, [runId])
    ).rows[0];
    assert.deepEqual(completedState, {
      status: "completed",
      decisions: 1,
      corroboration_run_id: runId,
      completion_ordered: true,
    });

    const duplicate = await corroborateEvents(db, changedInputRetry);
    assert.equal(duplicate.reused, true);
    assert.deepEqual(
      (
        await database.query<{ decisions: number }>(
          "SELECT count(*)::integer AS decisions FROM pulse_event_decisions",
        )
      ).rows[0],
      { decisions: 1 },
    );
  } finally {
    await database.close();
  }
});

test("score publish rolls back, retries one stable run, and never duplicates history", async () => {
  const database = new PGlite();
  const executionKey = "d".repeat(64);
  const jurisdictionId = "55555555-5555-4555-8555-555555555555";
  const priorRunId = "44444444-4444-4444-8444-444444444444";
  try {
    await database.exec(`${PIPELINE_DDL}
      CREATE TABLE pulse_dimensional_delta_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        schema_version text NOT NULL,
        jurisdiction_id uuid NOT NULL,
        dimension text NOT NULL,
        delta_value real NOT NULL,
        contributing_event_ids uuid[] NOT NULL,
        derivation_version_key text NOT NULL,
        derivation_versions jsonb NOT NULL,
        computation_run_id uuid NOT NULL,
        score_as_of date NOT NULL,
        window_start date NOT NULL,
        window_days integer NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW(),
        UNIQUE (computation_run_id, jurisdiction_id, dimension),
        CONSTRAINT force_score_failure CHECK (false)
      );
      CREATE TABLE pulse_dimensional_deltas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        jurisdiction_id uuid NOT NULL,
        dimension text NOT NULL,
        delta_value real NOT NULL,
        contributing_event_ids uuid[] NOT NULL,
        derivation_version_key text NOT NULL,
        derivation_versions jsonb NOT NULL,
        computation_run_id uuid NOT NULL,
        score_as_of date NOT NULL,
        window_start date NOT NULL,
        window_days integer NOT NULL,
        last_computed_at timestamp NOT NULL DEFAULT NOW(),
        UNIQUE (jurisdiction_id, dimension)
      );
      CREATE TABLE pulse_score_publication_pointers (
        product text PRIMARY KEY,
        computation_run_id uuid NOT NULL UNIQUE,
        version_key text NOT NULL,
        score_as_of date NOT NULL,
        published_at timestamp NOT NULL DEFAULT NOW()
      );
      INSERT INTO pulse_pipeline_runs (
        id, stage, status, version_key, versions, completed_at
      ) VALUES (
        '${priorRunId}',
        'score',
        'completed',
        'pulse-stage/sha256:${"a".repeat(64)}',
        '{}'::jsonb,
        '2026-07-13T08:00:00.000Z'
      );
      INSERT INTO pulse_score_publication_pointers (
        product, computation_run_id, version_key, score_as_of, published_at
      ) VALUES (
        'pulse_dimensions',
        '${priorRunId}',
        'pulse-stage/sha256:${"a".repeat(64)}',
        '2026-07-13',
        '2026-07-13T08:00:00.000Z'
      );
    `);
    const db = atomicDb(database);
    const event: PublishedEvent = {
      id: "66666666-6666-4666-8666-666666666666",
      jurisdictionId,
      dimension: "rule_of_law",
      category: "judicial_purge",
      projectionStatus: "current",
      published: true,
      reviewStatus: "approved",
      severityTier: "moderate_neg",
      severityValue: -4,
      corroborationConfidence: 0.8,
      eventDate: "2026-07-01",
      derivationVersions: legacyDerivationVersionEnvelope("fixture event"),
      sourceIds: ["amnesty"],
      publicationRunId: "77777777-7777-4777-8777-777777777777",
      corroborationRunId: "88888888-8888-4888-8888-888888888888",
      absorptionDecisionKey: null,
      absorptionOutcome: null,
    };
    const options = {
      events: [event],
      existingJurisdictionIds: [],
      now: new Date("2026-07-14T08:00:00.000Z"),
      cronExecutionKey: executionKey,
      persistRun: true,
    };

    await assert.rejects(calculateDimensionalDeltas(db, options));
    const runId = pulseCronStageRunId(executionKey, "score");
    assert.deepEqual(
      (
        await database.query<{
          status: string;
          history_rows: number;
          projection_rows: number;
          published_run_id: string;
        }>(`
          SELECT
            status,
            (SELECT count(*)::integer FROM pulse_dimensional_delta_history) AS history_rows,
            (SELECT count(*)::integer FROM pulse_dimensional_deltas) AS projection_rows,
            (SELECT computation_run_id::text FROM pulse_score_publication_pointers
              WHERE product = 'pulse_dimensions') AS published_run_id
          FROM pulse_pipeline_runs
          WHERE id = $1
        `, [runId])
      ).rows[0],
      {
        status: "running",
        history_rows: 0,
        projection_rows: 0,
        published_run_id: priorRunId,
      },
    );

    await database.exec(
      "ALTER TABLE pulse_dimensional_delta_history DROP CONSTRAINT force_score_failure",
    );
    await assert.rejects(
      calculateDimensionalDeltas(db, {
        ...options,
        events: [{ ...event, severityValue: -8 }],
      }),
      /input values changed/,
    );
    const laterEvent: PublishedEvent = {
      ...event,
      id: "99999999-9999-4999-8999-999999999999",
      jurisdictionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      publicationRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      corroborationRunId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      eventDate: "2026-07-15",
    };
    const changedInputRetry = {
      ...options,
      events: [event, laterEvent],
      existingJurisdictionIds: [laterEvent.jurisdictionId],
      now: new Date("2026-07-15T08:00:00.000Z"),
    };
    const retried = await calculateDimensionalDeltas(db, changedInputRetry);
    assert.equal(retried.reused, false);
    assert.equal(retried.dimensionRowsWritten, 5);
    assert.equal(retried.runId, runId);
    assert.equal(retried.eventsConsidered, 1);
    assert.ok(retried.planned.every((plan) => plan.scoreAsOf === "2026-07-14"));

    const duplicate = await calculateDimensionalDeltas(db, changedInputRetry);
    assert.equal(duplicate.reused, true);
    assert.deepEqual(
      (
        await database.query<{
          status: string;
          history_rows: number;
          projection_rows: number;
          published_run_id: string;
          completion_ordered: boolean;
          publication_matches_completion: boolean;
        }>(`
          SELECT
            status,
            completed_at >= started_at AS completion_ordered,
            (SELECT count(*)::integer FROM pulse_dimensional_delta_history) AS history_rows,
            (SELECT count(*)::integer FROM pulse_dimensional_deltas) AS projection_rows,
            (SELECT computation_run_id::text FROM pulse_score_publication_pointers
              WHERE product = 'pulse_dimensions') AS published_run_id,
            (SELECT published_at = pulse_pipeline_runs.completed_at
              FROM pulse_score_publication_pointers
              WHERE product = 'pulse_dimensions') AS publication_matches_completion
          FROM pulse_pipeline_runs
          WHERE id = $1
        `, [runId])
      ).rows[0],
      {
        status: "completed",
        history_rows: 5,
        projection_rows: 5,
        published_run_id: runId,
        completion_ordered: true,
        publication_matches_completion: true,
      },
    );
  } finally {
    await database.close();
  }
});
