import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import { pulsePipelineRuns } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import {
  classifyClusters,
  classificationInputFingerprint,
  CURRENT_CLASSIFICATION_CONFIG_HASH,
  loadUnclassifiedClusters,
  type ClusterToClassify,
} from "./classify";
import { finalizeClassificationPipelineRun } from "./classification-run-finalizer";
import {
  createPulsePipelineRunRef,
  pulseCronStageRunId,
  pulseStageVersionKey,
} from "./pipeline-version";

type Db = NeonHttpDatabase<typeof schema>;

const EXECUTION_KEY = "d".repeat(64);
const PARTIAL_EXECUTION_KEY = "e".repeat(64);
const NEXT_EXECUTION_KEY = "f".repeat(64);
const WRONG_JOB_EXECUTION_KEY = "c".repeat(64);
const CRASH_EXECUTION_KEY = "b".repeat(64);
const CLUSTER_ID = "11111111-1111-4111-8111-111111111111";
const RAW_EVENT_ID = "22222222-2222-4222-8222-222222222222";
const LATE_RAW_EVENT_ID = "33333333-3333-4333-8333-333333333333";
const INCIDENT_ID = "44444444-4444-4444-8444-444444444444";
const EVENT_ID = "55555555-5555-4555-8555-555555555555";
const JURISDICTION_ID = "66666666-6666-4666-8666-666666666666";
const CLUSTER_RUN_ID = "77777777-7777-4777-8777-777777777777";
const TERMINAL_CLUSTER_ID = "88888888-8888-4888-8888-888888888888";
const TERMINAL_RAW_EVENT_ID = "99999999-9999-4999-8999-999999999999";
const NEW_PENDING_CLUSTER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NEW_PENDING_RAW_EVENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FROZEN_CONFIG_HASH = `pulse-classification-config/v1/sha256:${"a".repeat(64)}`;
const STARTED_AT = new Date("2026-07-14T23:59:00.000Z");

const DDL = `
  CREATE FUNCTION digest(value text, algorithm text) RETURNS bytea
  LANGUAGE sql IMMUTABLE AS $$
    SELECT decode(md5(value) || md5(value || algorithm), 'hex')
  $$;
  CREATE TABLE cron_job_executions (
    execution_key text PRIMARY KEY,
    job_id text NOT NULL
  );
  CREATE TABLE pulse_pipeline_runs (
    id uuid PRIMARY KEY,
    stage text NOT NULL,
    status text NOT NULL,
    version_key text NOT NULL,
    versions jsonb NOT NULL,
    counts jsonb NOT NULL DEFAULT '{}'::jsonb,
    failures jsonb NOT NULL DEFAULT '[]'::jsonb,
    started_at timestamp NOT NULL,
    completed_at timestamp
  );
  CREATE TABLE pulse_classification_delivery_bindings (
    execution_key text PRIMARY KEY REFERENCES cron_job_executions(execution_key) ON DELETE RESTRICT,
    classification_run_id uuid NOT NULL REFERENCES pulse_pipeline_runs(id) ON DELETE RESTRICT,
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
  );
  CREATE FUNCTION reject_pulse_classify_binding_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION 'pulse classification delivery bindings are immutable';
  END;
  $$;
  CREATE FUNCTION guard_pulse_classify_binding_insert() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM cron_job_executions
      WHERE execution_key = NEW.execution_key
        AND job_id = 'pulse.v2.classify'
    ) OR NOT EXISTS (
      SELECT 1 FROM pulse_pipeline_runs
      WHERE id = NEW.classification_run_id
        AND stage = 'classify'
    ) THEN
      RAISE EXCEPTION 'invalid pulse classification delivery binding';
    END IF;
    RETURN NEW;
  END;
  $$;
  CREATE TRIGGER pulse_classification_delivery_insert_guard
  BEFORE INSERT ON pulse_classification_delivery_bindings
  FOR EACH ROW EXECUTE FUNCTION guard_pulse_classify_binding_insert();
  CREATE TRIGGER pulse_classification_delivery_no_mutation
  BEFORE UPDATE OR DELETE ON pulse_classification_delivery_bindings
  FOR EACH ROW EXECUTE FUNCTION reject_pulse_classify_binding_mutation();
  CREATE TRIGGER pulse_classification_delivery_no_truncate
  BEFORE TRUNCATE ON pulse_classification_delivery_bindings
  FOR EACH STATEMENT EXECUTE FUNCTION reject_pulse_classify_binding_mutation();
  CREATE TABLE pulse_events_v2 (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL,
    projection_status text NOT NULL,
    classification_run_id uuid NOT NULL,
    published boolean NOT NULL
  );
  CREATE TABLE pulse_event_decisions (
    cluster_id uuid NOT NULL,
    event_id uuid,
    stage_run_id uuid NOT NULL,
    kind text NOT NULL,
    verdict text NOT NULL
  );
  CREATE TABLE pulse_sources (
    event_id uuid NOT NULL,
    raw_event_id uuid NOT NULL UNIQUE
  );
  CREATE TABLE raw_events (
    id uuid PRIMARY KEY,
    incident_id uuid,
    jurisdiction_id uuid,
    event_date date,
    title text NOT NULL,
    body text,
    source_id text NOT NULL,
    source_type text NOT NULL,
    source_url text,
    cluster_id uuid,
    cluster_run_id uuid,
    classification_disposition text NOT NULL DEFAULT 'pending',
    classification_run_id uuid,
    clustered_at timestamp,
    retrieved_at timestamp,
    created_at timestamp
  );
  CREATE TABLE pulse_cluster_classification_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version text NOT NULL DEFAULT 'pulse-classification-state/v1',
    cluster_id uuid NOT NULL,
    incident_id uuid,
    config_hash text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL,
    attempt_count integer NOT NULL,
    max_attempts integer NOT NULL DEFAULT 3,
    first_attempt_at timestamp NOT NULL DEFAULT NOW(),
    last_attempt_at timestamp NOT NULL DEFAULT NOW(),
    next_retry_at timestamp,
    terminal_at timestamp,
    lease_expires_at timestamp,
    last_error_code text,
    last_error_message text,
    last_run_id uuid NOT NULL,
    event_id uuid,
    created_at timestamp NOT NULL DEFAULT NOW(),
    updated_at timestamp NOT NULL DEFAULT NOW(),
    UNIQUE (cluster_id, config_hash)
  );
  CREATE TABLE pulse_classification_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version text NOT NULL DEFAULT 'pulse-classification-attempt/v1',
    attempt_key text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
    cluster_id uuid NOT NULL,
    incident_id uuid,
    config_hash text NOT NULL,
    ordinal integer NOT NULL,
    run_id uuid NOT NULL,
    outcome text NOT NULL,
    model_call_count integer NOT NULL,
    started_at timestamp NOT NULL DEFAULT NOW(),
    completed_at timestamp,
    next_retry_at timestamp,
    error_code text,
    error_message text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp NOT NULL DEFAULT NOW(),
    UNIQUE (cluster_id, config_hash, ordinal, outcome)
  );
  INSERT INTO cron_job_executions (execution_key, job_id) VALUES
    ('${EXECUTION_KEY}', 'pulse.v2.classify'),
    ('${PARTIAL_EXECUTION_KEY}', 'pulse.v2.classify'),
    ('${NEXT_EXECUTION_KEY}', 'pulse.v2.classify'),
    ('${CRASH_EXECUTION_KEY}', 'pulse.v2.classify'),
    ('${WRONG_JOB_EXECUTION_KEY}', 'pulse.v2.score');
`;

async function harness() {
  const database = new PGlite();
  await database.exec(DDL);
  return {
    database,
    db: drizzle(database, { schema }) as unknown as Db,
  };
}

function clusterFixture(
  clusterId = CLUSTER_ID,
  rawEventId = RAW_EVENT_ID,
): ClusterToClassify {
  return {
    clusterId,
    incidentId: INCIDENT_ID,
    jurisdictionId: JURISDICTION_ID,
    eventDate: "2026-07-14",
    title: "Court removes election commissioner",
    body: "- Court removes election commissioner (Initial body)",
    rawEventIds: [rawEventId],
    sourceIds: ["fixture-source"],
    sourceTypes: ["news"],
    clusterRunIds: [CLUSTER_RUN_ID],
    attributions: [
      {
        sourceId: "fixture-source",
        sourceType: "news",
        sourceName: "fixture-source",
        sourceUrl: "https://example.test/initial",
        rawEventId,
      },
    ],
  };
}

function inputIds(
  clusters: readonly ClusterToClassify[],
  configHash = CURRENT_CLASSIFICATION_CONFIG_HASH,
): string[] {
  return [
    `classification-config:${configHash}`,
    ...clusters.flatMap((cluster) => [
      `cluster:${cluster.clusterId}`,
      ...cluster.rawEventIds.map(
        (rawEventId) => `cluster-raw:${cluster.clusterId}:${rawEventId}`,
      ),
    ]),
  ];
}

async function insertRun(
  db: Db,
  executionKey: string,
  clusters: readonly ClusterToClassify[],
  configHash = CURRENT_CLASSIFICATION_CONFIG_HASH,
) {
  const run = createPulsePipelineRunRef("classify", {
    id: pulseCronStageRunId(executionKey, "classify"),
    sourceIds: ["fixture-source"],
    upstreamRunIds: [CLUSTER_RUN_ID],
    inputIds: inputIds(clusters, configHash),
    inputFingerprint: classificationInputFingerprint(clusters),
  });
  await db.insert(pulsePipelineRuns).values({
    id: run.id,
    stage: "classify",
    status: "running",
    versionKey: run.versionKey,
    versions: run.versions,
    counts: {},
    failures: [],
    startedAt: STARTED_AT,
  });
  return run;
}

async function insertRaw(
  database: PGlite,
  input: {
    id: string;
    clusterId: string;
    disposition?: "pending" | "event" | "non_governance";
    runId?: string | null;
    title?: string;
    body?: string;
    sourceUrl?: string;
    eventDate?: string | null;
  },
) {
  await database.query(
    `INSERT INTO raw_events (
       id, incident_id, jurisdiction_id, event_date, title, body, source_id,
       source_type, source_url, cluster_id, cluster_run_id,
       classification_disposition, classification_run_id, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, 'fixture-source', 'news', $7, $8,
       $9, $10, $11, '2026-07-14T22:00:00.000Z')`,
    [
      input.id,
      INCIDENT_ID,
      JURISDICTION_ID,
      input.eventDate ?? null,
      input.title ?? "Court removes election commissioner",
      input.body ?? "Initial body",
      input.sourceUrl ?? "https://example.test/initial",
      input.clusterId,
      CLUSTER_RUN_ID,
      input.disposition ?? "pending",
      input.runId ?? null,
    ],
  );
}

async function seedClassifiedPublication(
  database: PGlite,
  runId: string,
  input: {
    clusterId?: string;
    rawEventId?: string;
    eventId?: string;
    configHash?: string;
  } = {},
) {
  const clusterId = input.clusterId ?? CLUSTER_ID;
  const rawEventId = input.rawEventId ?? RAW_EVENT_ID;
  const eventId = input.eventId ?? EVENT_ID;
  const configHash = input.configHash ?? CURRENT_CLASSIFICATION_CONFIG_HASH;
  await insertRaw(database, {
    id: rawEventId,
    clusterId,
    disposition: "event",
    runId,
  });
  await database.query(
    `INSERT INTO pulse_events_v2
       (id, cluster_id, projection_status, classification_run_id, published)
     VALUES ($1, $2, 'current', $3, true)`,
    [eventId, clusterId, runId],
  );
  await database.query(
    `INSERT INTO pulse_event_decisions
       (cluster_id, event_id, stage_run_id, kind, verdict)
     VALUES ($1, $2, $3, 'event_existence', 'affirmed')`,
    [clusterId, eventId, runId],
  );
  await database.query(
    "INSERT INTO pulse_sources (event_id, raw_event_id) VALUES ($1, $2)",
    [eventId, rawEventId],
  );
  await database.query(
    `INSERT INTO pulse_cluster_classification_states
       (id, cluster_id, config_hash, status, attempt_count, last_run_id, event_id)
     VALUES (gen_random_uuid(), $1, $2, 'classified', 1, $3, $4)`,
    [clusterId, configHash, runId, eventId],
  );
  await database.query(
    `INSERT INTO pulse_classification_attempts
       (cluster_id, config_hash, ordinal, run_id, outcome, model_call_count, completed_at)
     VALUES ($1, $2, 1, $3, 'classified', 1, '2026-07-14T23:58:00.000Z')`,
    [clusterId, configHash, runId],
  );
}

async function seedTerminalFailure(
  database: PGlite,
  runId: string,
  clusterId = TERMINAL_CLUSTER_ID,
  rawEventId = TERMINAL_RAW_EVENT_ID,
) {
  await insertRaw(database, { id: rawEventId, clusterId });
  await database.query(
    `INSERT INTO pulse_cluster_classification_states
       (id, cluster_id, config_hash, status, attempt_count, last_run_id, event_id)
     VALUES (gen_random_uuid(), $1, $2, 'terminal_failure', 3, $3, NULL)`,
    [clusterId, CURRENT_CLASSIFICATION_CONFIG_HASH, runId],
  );
  await database.query(
    `INSERT INTO pulse_classification_attempts
       (cluster_id, config_hash, ordinal, run_id, outcome, model_call_count, completed_at)
     VALUES ($1, $2, 3, $3, 'terminal_failure', 1, '2026-07-14T23:58:00.000Z')`,
    [clusterId, CURRENT_CLASSIFICATION_CONFIG_HASH, runId],
  );
}

test("stage version keys survive a PostgreSQL jsonb round trip", async () => {
  const state = await harness();
  try {
    const run = await insertRun(state.db, EXECUTION_KEY, [clusterFixture()]);
    const persisted = await state.database.query<{
      version_key: string;
      versions: typeof run.versions;
    }>("SELECT version_key, versions FROM pulse_pipeline_runs WHERE id = $1", [
      run.id,
    ]);
    assert.equal(
      pulseStageVersionKey(persisted.rows[0].versions),
      persisted.rows[0].version_key,
    );
  } finally {
    await state.database.close();
  }
});

test("frozen classify membership excludes a late same-cluster report and detects value drift", async () => {
  const state = await harness();
  try {
    await insertRaw(state.database, {
      id: RAW_EVENT_ID,
      clusterId: CLUSTER_ID,
    });
    await insertRaw(state.database, {
      id: LATE_RAW_EVENT_ID,
      clusterId: CLUSTER_ID,
      title: "Later report in the same cluster",
    });

    const loadFrozen = (fallbackEventDate: string) =>
      loadUnclassifiedClusters(
        state.db,
        1,
        CURRENT_CLASSIFICATION_CONFIG_HASH,
        {
          clusterIds: [CLUSTER_ID],
          rawEventIds: [RAW_EVENT_ID],
          includeSettled: true,
          fallbackEventDate,
        },
      );
    const original = await loadFrozen("2026-07-14");
    assert.deepEqual(original[0].rawEventIds, [RAW_EVENT_ID]);
    assert.equal(original[0].eventDate, "2026-07-14");
    const originalFingerprint = classificationInputFingerprint(original);

    // A retry after midnight still supplies the run's persisted start date.
    const afterMidnight = await loadFrozen("2026-07-14");
    assert.equal(
      classificationInputFingerprint(afterMidnight),
      originalFingerprint,
    );
    const wrongWallClockFallback = await loadFrozen("2026-07-15");
    assert.notEqual(
      classificationInputFingerprint(wrongWallClockFallback),
      originalFingerprint,
    );

    await state.database.query(
      `UPDATE raw_events
       SET title = 'Changed title', body = 'Changed body',
           source_url = 'https://example.test/changed'
       WHERE id = $1`,
      [RAW_EVENT_ID],
    );
    const changed = await loadFrozen("2026-07-14");
    assert.notEqual(
      classificationInputFingerprint(changed),
      originalFingerprint,
    );
  } finally {
    await state.database.close();
  }
});

test("a finalization outage is closed by the same delivery without republishing", async () => {
  const state = await harness();
  let modelCalls = 0;
  try {
    const frozenCluster = clusterFixture();
    const run = await insertRun(state.db, EXECUTION_KEY, [frozenCluster]);
    await seedClassifiedPublication(state.database, run.id);
    await insertRaw(state.database, {
      id: LATE_RAW_EVENT_ID,
      clusterId: CLUSTER_ID,
      title: "Later report in the already classified cluster",
    });
    await state.database.exec(`
      ALTER TABLE pulse_pipeline_runs
      ADD CONSTRAINT fail_classification_finalize CHECK (status <> 'completed');
    `);

    const options = {
      cronExecutionKey: EXECUTION_KEY,
      classify: async () => {
        modelCalls++;
        return { category: "none" as const };
      },
    };

    // Even though publication is fully settled, input drift must be detected
    // before the finalizer is allowed to close the running batch.
    await state.database.query(
      `UPDATE raw_events
       SET title = 'Mutated after publication', body = 'Mutated body',
           source_url = 'https://example.test/mutated'
       WHERE id = $1`,
      [RAW_EVENT_ID],
    );
    await assert.rejects(
      classifyClusters(state.db, options),
      /retry input values changed/,
    );
    assert.equal(modelCalls, 0);
    const afterDrift = await state.database.query<{ status: string }>(
      "SELECT status FROM pulse_pipeline_runs WHERE id = $1",
      [run.id],
    );
    assert.equal(afterDrift.rows[0].status, "running");

    await state.database.query(
      `UPDATE raw_events
       SET title = 'Court removes election commissioner', body = 'Initial body',
           source_url = 'https://example.test/initial'
       WHERE id = $1`,
      [RAW_EVENT_ID],
    );
    await assert.rejects(classifyClusters(state.db, options), /Failed query/);
    assert.equal(modelCalls, 0);
    const running = await state.database.query<{ status: string }>(
      "SELECT status FROM pulse_pipeline_runs WHERE id = $1",
      [run.id],
    );
    assert.equal(running.rows[0].status, "running");

    await state.database.exec(`
      ALTER TABLE pulse_pipeline_runs DROP CONSTRAINT fail_classification_finalize;
    `);
    const retry = await classifyClusters(state.db, options);
    const duplicateRetry = await classifyClusters(state.db, options);
    assert.equal(retry.reused, true);
    assert.equal(duplicateRetry.reused, true);
    assert.equal(retry.runId, run.id);
    assert.equal(retry.classified, 1);
    assert.equal(modelCalls, 0);

    const evidence = await state.database.query<{
      events: number;
      decisions: number;
      sources: number;
      attempts: number;
      late_disposition: string;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM pulse_events_v2) AS events,
        (SELECT count(*)::integer FROM pulse_event_decisions) AS decisions,
        (SELECT count(*)::integer FROM pulse_sources) AS sources,
        (SELECT count(*)::integer FROM pulse_classification_attempts) AS attempts,
        (SELECT classification_disposition FROM raw_events
         WHERE id = '${LATE_RAW_EVENT_ID}') AS late_disposition
    `);
    assert.deepEqual(evidence.rows[0], {
      events: 1,
      decisions: 1,
      sources: 1,
      attempts: 1,
      late_disposition: "pending",
    });
  } finally {
    await state.database.close();
  }
});

test("settled old-config work finalizes before current-config enforcement", async () => {
  const state = await harness();
  let modelCalls = 0;
  try {
    const frozenCluster = clusterFixture();
    const run = await insertRun(
      state.db,
      EXECUTION_KEY,
      [frozenCluster],
      FROZEN_CONFIG_HASH,
    );
    await seedClassifiedPublication(state.database, run.id, {
      configHash: FROZEN_CONFIG_HASH,
    });

    const options = {
      cronExecutionKey: EXECUTION_KEY,
      classify: async () => {
        modelCalls++;
        return { category: "none" as const };
      },
    };
    const recovered = await classifyClusters(state.db, options);
    const terminalRetry = await classifyClusters(state.db, options);
    assert.equal(recovered.reused, true);
    assert.equal(terminalRetry.reused, true);
    assert.equal(recovered.configHash, FROZEN_CONFIG_HASH);
    assert.equal(terminalRetry.configHash, FROZEN_CONFIG_HASH);
    assert.equal(modelCalls, 0);
  } finally {
    await state.database.close();
  }
});

test("terminal reuse rejects a malformed frozen envelope", async () => {
  const state = await harness();
  try {
    const frozenCluster = clusterFixture();
    const run = await insertRun(state.db, EXECUTION_KEY, [frozenCluster]);
    await state.database.query(
      `UPDATE pulse_pipeline_runs
       SET status = 'completed', completed_at = NOW(),
           counts = '{"clustersExamined":1}'::jsonb,
           versions = versions - 'inputFingerprint'
       WHERE id = $1`,
      [run.id],
    );
    await assert.rejects(
      classifyClusters(state.db, { cronExecutionKey: EXECUTION_KEY }),
      /invalid input fingerprint/,
    );
  } finally {
    await state.database.close();
  }
});

test("a running delivery fails closed on frozen-value drift before a model call", async () => {
  const state = await harness();
  let modelCalls = 0;
  try {
    const frozenCluster = clusterFixture();
    const run = await insertRun(state.db, EXECUTION_KEY, [frozenCluster]);
    await insertRaw(state.database, {
      id: RAW_EVENT_ID,
      clusterId: CLUSTER_ID,
    });
    await state.database.query(
      `INSERT INTO pulse_cluster_classification_states
         (id, cluster_id, config_hash, status, attempt_count, next_retry_at,
          last_run_id, event_id)
       VALUES (gen_random_uuid(), $1, $2, 'retryable_failure', 1,
               '2026-07-14T23:00:00.000Z', $3, NULL)`,
      [CLUSTER_ID, CURRENT_CLASSIFICATION_CONFIG_HASH, run.id],
    );
    await state.database.query(
      `UPDATE raw_events
       SET title = 'Changed after first attempt',
           body = 'Changed body and model context',
           source_url = 'https://example.test/changed-attribution'
       WHERE id = $1`,
      [RAW_EVENT_ID],
    );

    await assert.rejects(
      classifyClusters(state.db, {
        cronExecutionKey: EXECUTION_KEY,
        classify: async () => {
          modelCalls++;
          return { category: "none" as const };
        },
      }),
      /retry input values changed/,
    );
    assert.equal(modelCalls, 0);
    const runState = await state.database.query<{ status: string }>(
      "SELECT status FROM pulse_pipeline_runs WHERE id = $1",
      [run.id],
    );
    assert.equal(runState.rows[0].status, "running");
  } finally {
    await state.database.close();
  }
});

test("a crash after starting a new run but before binding recovers the exact run", async () => {
  const state = await harness();
  let modelCalls = 0;
  try {
    await insertRaw(state.database, {
      id: NEW_PENDING_RAW_EVENT_ID,
      clusterId: NEW_PENDING_CLUSTER_ID,
    });
    await state.database.exec(`
      ALTER TABLE pulse_classification_delivery_bindings
      ADD CONSTRAINT fail_new_binding CHECK (false);
    `);
    const classify = async () => {
      modelCalls++;
      return { category: "none" as const };
    };
    const writeNonEvent = async (
      _db: Db,
      cluster: ClusterToClassify,
      classificationRunId: string,
    ) => {
      await state.database.query(
        `UPDATE raw_events
         SET classification_disposition = 'non_governance',
             classification_run_id = $1
         WHERE id = $2`,
        [classificationRunId, cluster.rawEventIds[0]],
      );
      await state.database.query(
        `INSERT INTO pulse_event_decisions
           (cluster_id, event_id, stage_run_id, kind, verdict)
         VALUES ($1, NULL, $2, 'event_existence', 'refuted')`,
        [cluster.clusterId, classificationRunId],
      );
    };

    await assert.rejects(
      classifyClusters(state.db, {
        cronExecutionKey: CRASH_EXECUTION_KEY,
        now: STARTED_AT,
        classify,
        writeNonEvent,
      }),
      /Failed query/,
    );
    assert.equal(modelCalls, 0);
    const interrupted = await state.database.query<{
      runs: number;
      status: string;
      bindings: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM pulse_pipeline_runs) AS runs,
        (SELECT status FROM pulse_pipeline_runs LIMIT 1) AS status,
        (SELECT count(*)::integer FROM pulse_classification_delivery_bindings) AS bindings
    `);
    assert.deepEqual(interrupted.rows[0], {
      runs: 1,
      status: "running",
      bindings: 0,
    });

    await state.database.exec(`
      ALTER TABLE pulse_classification_delivery_bindings
      DROP CONSTRAINT fail_new_binding;
    `);
    const recovered = await classifyClusters(state.db, {
      cronExecutionKey: CRASH_EXECUTION_KEY,
      now: new Date("2026-07-15T00:01:00.000Z"),
      classify,
      writeNonEvent,
    });
    assert.equal(
      recovered.runId,
      pulseCronStageRunId(CRASH_EXECUTION_KEY, "classify"),
    );
    assert.equal(recovered.noneCategory, 1);
    assert.equal(modelCalls, 1);
    const closed = await state.database.query<{
      runs: number;
      status: string;
      bindings: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM pulse_pipeline_runs) AS runs,
        (SELECT status FROM pulse_pipeline_runs LIMIT 1) AS status,
        (SELECT count(*)::integer FROM pulse_classification_delivery_bindings) AS bindings
    `);
    assert.deepEqual(closed.rows[0], {
      runs: 1,
      status: "completed",
      bindings: 1,
    });
  } finally {
    await state.database.close();
  }
});

test("an expired third claim becomes terminal evidence and closes the run", async () => {
  const state = await harness();
  let modelCalls = 0;
  try {
    const run = await insertRun(state.db, EXECUTION_KEY, [clusterFixture()]);
    await insertRaw(state.database, {
      id: RAW_EVENT_ID,
      clusterId: CLUSTER_ID,
    });
    await state.database.query(
      `INSERT INTO pulse_cluster_classification_states (
         id, cluster_id, incident_id, config_hash, config, status,
         attempt_count, max_attempts, first_attempt_at, last_attempt_at,
         next_retry_at, lease_expires_at, last_error_code, last_error_message,
         last_run_id
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, '{}'::jsonb, 'retryable_failure',
         3, 3, '2026-07-14T20:00:00.000Z', '2026-07-14T23:00:00.000Z',
         '2026-07-14T23:30:00.000Z', '2026-07-14T23:30:00.000Z',
         'attempt_in_progress', 'Classifier attempt is in progress.', $4
       )`,
      [CLUSTER_ID, INCIDENT_ID, CURRENT_CLASSIFICATION_CONFIG_HASH, run.id],
    );
    await state.database.query(
      `INSERT INTO pulse_classification_attempts (
         attempt_key, cluster_id, incident_id, config_hash, ordinal, run_id,
         outcome, model_call_count, started_at
       ) VALUES (
         'started-third-claim', $1, $2, $3, 3, $4, 'started', 0,
         '2026-07-14T23:00:00.000Z'
       )`,
      [CLUSTER_ID, INCIDENT_ID, CURRENT_CLASSIFICATION_CONFIG_HASH, run.id],
    );

    const summary = await classifyClusters(state.db, {
      cronExecutionKey: EXECUTION_KEY,
      now: new Date("2026-07-15T00:01:00.000Z"),
      classify: async () => {
        modelCalls++;
        return { category: "none" as const };
      },
    });
    assert.equal(summary.failed, 1);
    assert.equal(summary.terminalFailures, 1);
    assert.equal(modelCalls, 0);
    const recovered = await state.database.query<{
      run_status: string;
      state_status: string;
      terminal_attempts: number;
    }>(`
      SELECT
        (SELECT status FROM pulse_pipeline_runs WHERE id = '${run.id}') AS run_status,
        (SELECT status FROM pulse_cluster_classification_states
         WHERE cluster_id = '${CLUSTER_ID}') AS state_status,
        (SELECT count(*)::integer FROM pulse_classification_attempts
         WHERE cluster_id = '${CLUSTER_ID}' AND ordinal = 3
           AND outcome = 'terminal_failure') AS terminal_attempts
    `);
    assert.deepEqual(recovered.rows[0], {
      run_status: "partial",
      state_status: "terminal_failure",
      terminal_attempts: 1,
    });
  } finally {
    await state.database.close();
  }
});

test("a later schedule slot adopts a not-yet-due running classify run", async () => {
  const state = await harness();
  let modelCalls = 0;
  try {
    const run = await insertRun(state.db, EXECUTION_KEY, [clusterFixture()]);
    await insertRaw(state.database, {
      id: RAW_EVENT_ID,
      clusterId: CLUSTER_ID,
    });
    await state.database.query(
      `INSERT INTO pulse_cluster_classification_states (
         id, cluster_id, incident_id, config_hash, config, status,
         attempt_count, max_attempts, first_attempt_at, last_attempt_at,
         next_retry_at, lease_expires_at, last_error_code, last_error_message,
         last_run_id
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, '{}'::jsonb, 'retryable_failure',
         1, 3, '2026-07-14T23:59:00.000Z', '2026-07-14T23:59:00.000Z',
         '2026-07-15T00:15:00.000Z', NULL, 'provider_timeout',
         'Provider request timed out.', $4
       )`,
      [CLUSTER_ID, INCIDENT_ID, CURRENT_CLASSIFICATION_CONFIG_HASH, run.id],
    );
    await state.database.query(
      `INSERT INTO pulse_classification_attempts (
         attempt_key, cluster_id, incident_id, config_hash, ordinal, run_id,
         outcome, model_call_count, started_at, completed_at, next_retry_at,
         error_code, error_message
       ) VALUES (
         'retryable-first-attempt', $1, $2, $3, 1, $4,
         'retryable_failure', 1, '2026-07-14T23:59:00.000Z',
         '2026-07-15T00:00:00.000Z', '2026-07-15T00:15:00.000Z',
         'provider_timeout', 'Provider request timed out.'
       )`,
      [CLUSTER_ID, INCIDENT_ID, CURRENT_CLASSIFICATION_CONFIG_HASH, run.id],
    );
    const classify = async () => {
      modelCalls++;
      return { category: "none" as const };
    };
    const writeNonEvent = async (
      _db: Db,
      cluster: ClusterToClassify,
      classificationRunId: string,
    ) => {
      await state.database.query(
        `UPDATE raw_events
         SET classification_disposition = 'non_governance',
             classification_run_id = $1
         WHERE id = $2`,
        [classificationRunId, cluster.rawEventIds[0]],
      );
      await state.database.query(
        `INSERT INTO pulse_event_decisions
           (cluster_id, event_id, stage_run_id, kind, verdict)
         VALUES ($1, NULL, $2, 'event_existence', 'refuted')`,
        [cluster.clusterId, classificationRunId],
      );
    };

    await assert.rejects(
      classifyClusters(state.db, {
        cronExecutionKey: EXECUTION_KEY,
        now: new Date("2026-07-15T00:05:00.000Z"),
        classify,
        writeNonEvent,
      }),
      /remains incomplete/,
    );
    assert.equal(modelCalls, 0);
    const earlyState = await state.database.query<{
      last_run_id: string;
      attempt_count: number;
    }>(
      `SELECT last_run_id, attempt_count
       FROM pulse_cluster_classification_states WHERE cluster_id = $1`,
      [CLUSTER_ID],
    );
    assert.deepEqual(earlyState.rows[0], {
      last_run_id: run.id,
      attempt_count: 1,
    });

    const nextSlot = await classifyClusters(state.db, {
      cronExecutionKey: NEXT_EXECUTION_KEY,
      now: new Date("2026-07-16T08:40:00.000Z"),
      classify,
      writeNonEvent,
    });
    assert.equal(nextSlot.runId, run.id);
    assert.equal(nextSlot.noneCategory, 1);
    assert.equal(modelCalls, 1);

    // Simulate B completing A while the outer cron finalization for B is
    // lost. A same-key retry must follow B's durable binding back to the
    // already terminal A run, even though genuinely new work is now queued.
    await insertRaw(state.database, {
      id: NEW_PENDING_RAW_EVENT_ID,
      clusterId: NEW_PENDING_CLUSTER_ID,
      title: "New event queued after the adopted run closed",
    });
    const sameDeliveryRetry = await classifyClusters(state.db, {
      cronExecutionKey: NEXT_EXECUTION_KEY,
      now: new Date("2026-07-16T08:45:00.000Z"),
      classify,
      writeNonEvent,
    });
    assert.equal(sameDeliveryRetry.reused, true);
    assert.equal(sameDeliveryRetry.runId, run.id);
    assert.equal(modelCalls, 1);
    const finalState = await state.database.query<{
      runs: number;
      run_status: string;
      last_run_id: string;
      bindings: number;
      later_binding_run_id: string;
      new_disposition: string;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM pulse_pipeline_runs) AS runs,
        (SELECT status FROM pulse_pipeline_runs WHERE id = '${run.id}') AS run_status,
        (SELECT last_run_id FROM pulse_cluster_classification_states
         WHERE cluster_id = '${CLUSTER_ID}') AS last_run_id,
        (SELECT count(*)::integer FROM pulse_classification_delivery_bindings) AS bindings,
        (SELECT classification_run_id FROM pulse_classification_delivery_bindings
         WHERE execution_key = '${NEXT_EXECUTION_KEY}') AS later_binding_run_id,
        (SELECT classification_disposition FROM raw_events
         WHERE id = '${NEW_PENDING_RAW_EVENT_ID}') AS new_disposition
    `);
    assert.deepEqual(finalState.rows[0], {
      runs: 1,
      run_status: "completed",
      last_run_id: run.id,
      bindings: 2,
      later_binding_run_id: run.id,
      new_disposition: "pending",
    });

    const conflictingRun = await insertRun(state.db, PARTIAL_EXECUTION_KEY, [
      clusterFixture(NEW_PENDING_CLUSTER_ID, NEW_PENDING_RAW_EVENT_ID),
    ]);
    await assert.rejects(
      state.database.query(
        `INSERT INTO pulse_classification_delivery_bindings
           (execution_key, classification_run_id)
         VALUES ($1, $2)`,
        [NEXT_EXECUTION_KEY, conflictingRun.id],
      ),
      /duplicate key|unique constraint/i,
    );
    await assert.rejects(
      state.database.query(
        `UPDATE pulse_classification_delivery_bindings
         SET classification_run_id = $1 WHERE execution_key = $2`,
        [conflictingRun.id, NEXT_EXECUTION_KEY],
      ),
      /immutable/,
    );
    await assert.rejects(
      state.database.query(
        `INSERT INTO pulse_classification_delivery_bindings
           (execution_key, classification_run_id)
         VALUES ($1, $2)`,
        [WRONG_JOB_EXECUTION_KEY, run.id],
      ),
      /invalid pulse classification delivery binding/,
    );
    const scoreRun = createPulsePipelineRunRef("score");
    await state.db.insert(pulsePipelineRuns).values({
      id: scoreRun.id,
      stage: "score",
      status: "running",
      versionKey: scoreRun.versionKey,
      versions: scoreRun.versions,
      counts: {},
      failures: [],
      startedAt: STARTED_AT,
    });
    await assert.rejects(
      state.database.query(
        `INSERT INTO pulse_classification_delivery_bindings
           (execution_key, classification_run_id)
         VALUES ($1, $2)`,
        [PARTIAL_EXECUTION_KEY, scoreRun.id],
      ),
      /invalid pulse classification delivery binding/,
    );
    await assert.rejects(
      state.database.query(
        `DELETE FROM pulse_classification_delivery_bindings
         WHERE execution_key = $1`,
        [NEXT_EXECUTION_KEY],
      ),
      /immutable/,
    );
    await assert.rejects(
      state.database.exec("TRUNCATE pulse_classification_delivery_bindings"),
      /immutable/,
    );
  } finally {
    await state.database.close();
  }
});

test("mixed terminal and successful clusters close once as an honest partial", async () => {
  const state = await harness();
  let modelCalls = 0;
  try {
    const classified = clusterFixture();
    const terminal = clusterFixture(TERMINAL_CLUSTER_ID, TERMINAL_RAW_EVENT_ID);
    const run = await insertRun(state.db, PARTIAL_EXECUTION_KEY, [
      classified,
      terminal,
    ]);
    await seedClassifiedPublication(state.database, run.id);
    await seedTerminalFailure(state.database, run.id);

    const finalized = await finalizeClassificationPipelineRun(state.db, {
      runId: run.id,
      configHash: CURRENT_CLASSIFICATION_CONFIG_HASH,
      clusters: [
        { clusterId: CLUSTER_ID, rawEventIds: [RAW_EVENT_ID] },
        {
          clusterId: TERMINAL_CLUSTER_ID,
          rawEventIds: [TERMINAL_RAW_EVENT_ID],
        },
      ],
      completedAt: new Date("2026-07-15T00:01:00.000Z"),
    });
    assert.equal(finalized?.status, "partial");
    assert.equal(finalized?.counts.classified, 1);
    assert.equal(finalized?.counts.terminalFailures, 1);
    assert.equal(finalized?.counts.failed, 1);

    const retry = await classifyClusters(state.db, {
      cronExecutionKey: PARTIAL_EXECUTION_KEY,
      classify: async () => {
        modelCalls++;
        return { category: "none" as const };
      },
    });
    assert.equal(retry.reused, true);
    assert.equal(retry.failed, 1);
    assert.equal(retry.classified, 1);
    assert.equal(modelCalls, 0);
    const runState = await state.database.query<{ status: string }>(
      "SELECT status FROM pulse_pipeline_runs WHERE id = $1",
      [run.id],
    );
    assert.equal(runState.rows[0].status, "partial");
  } finally {
    await state.database.close();
  }
});
