import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "@/lib/db/schema";
import type { PulseDecisionInput } from "./decision-ledger";
import {
  publishClassifiedCluster,
  publishNonGovernanceCluster,
  type ClassifiedClusterPublicationPlan,
  type NonGovernanceClusterPublicationPlan,
} from "./classification-publication";
import {
  settleClassificationAttempt,
  type ClaimedClassificationAttempt,
} from "./classification-state-store";
import { pulseEventVersionEnvelope } from "./versioning";

type Db = NeonHttpDatabase<typeof schema>;
type ClassifiedBoundary =
  | "event"
  | "decision"
  | "source"
  | "raw_disposition"
  | "state_settlement"
  | "attempt_evidence";
type NonGovernanceBoundary =
  "decision" | "raw_disposition" | "state_settlement" | "attempt_evidence";

const CLUSTER_ID = "11111111-1111-4111-8111-111111111111";
const INCIDENT_ID = "22222222-2222-4222-8222-222222222222";
const RAW_EVENT_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";
const RUN_ID = "55555555-5555-4555-8555-555555555555";
const CONFIG_HASH = `pulse-classification-config/v1/sha256:${"6".repeat(64)}`;
const STARTED_AT = new Date("2026-07-14T12:00:00.000Z");
const COMPLETED_AT = "2026-07-14T12:01:00.000Z";
const SOURCE_ID = "fixture-source";

const claim: ClaimedClassificationAttempt = {
  clusterId: CLUSTER_ID,
  incidentId: INCIDENT_ID,
  configHash: CONFIG_HASH,
  ordinal: 1,
  runId: RUN_ID,
  startedAt: STARTED_AT,
};

const DDL = `
  CREATE TABLE pulse_events_v2 (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL UNIQUE,
    incident_id uuid NOT NULL,
    projection_status text NOT NULL DEFAULT 'current',
    jurisdiction_id uuid NOT NULL,
    event_date date NOT NULL,
    category text NOT NULL,
    dimension text NOT NULL,
    severity_tier text NOT NULL,
    severity_value real NOT NULL,
    corroboration_confidence real NOT NULL,
    classifier_runs jsonb NOT NULL,
    classifier_agreement text NOT NULL,
    derivation_version_key text NOT NULL,
    derivation_versions jsonb NOT NULL,
    classification_run_id uuid NOT NULL,
    publication_run_id uuid,
    corroboration_run_id uuid,
    human_reviewed boolean NOT NULL DEFAULT false,
    reviewer_id text,
    review_notes text,
    review_status text NOT NULL DEFAULT 'pending',
    published boolean NOT NULL DEFAULT false,
    headline text NOT NULL,
    description text NOT NULL,
    ai_summary text,
    press_freedom_score_at_classification real,
    created_at timestamp NOT NULL DEFAULT NOW(),
    updated_at timestamp NOT NULL DEFAULT NOW()
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
    created_at timestamp NOT NULL DEFAULT NOW()
  );
  CREATE TABLE pulse_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL,
    source_id text NOT NULL,
    source_type text NOT NULL,
    source_name text NOT NULL,
    source_url text,
    raw_event_id uuid NOT NULL UNIQUE,
    created_at timestamp DEFAULT NOW()
  );
  CREATE TABLE raw_events (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL,
    classification_disposition text NOT NULL DEFAULT 'pending',
    classification_reason text,
    classification_decision jsonb,
    classified_at timestamp,
    classification_run_id uuid
  );
  CREATE TABLE pulse_cluster_classification_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version text NOT NULL,
    cluster_id uuid NOT NULL,
    incident_id uuid,
    config_hash text NOT NULL,
    config jsonb NOT NULL,
    status text NOT NULL,
    attempt_count integer NOT NULL,
    max_attempts integer NOT NULL,
    first_attempt_at timestamp NOT NULL,
    last_attempt_at timestamp NOT NULL,
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
    schema_version text NOT NULL,
    attempt_key text NOT NULL UNIQUE,
    cluster_id uuid NOT NULL,
    incident_id uuid,
    config_hash text NOT NULL,
    ordinal integer NOT NULL,
    run_id uuid NOT NULL,
    outcome text NOT NULL,
    model_call_count integer NOT NULL,
    started_at timestamp NOT NULL,
    completed_at timestamp,
    next_retry_at timestamp,
    error_code text,
    error_message text,
    metadata jsonb NOT NULL,
    created_at timestamp NOT NULL DEFAULT NOW(),
    UNIQUE (cluster_id, config_hash, ordinal, outcome)
  );
  INSERT INTO raw_events (id, cluster_id)
  VALUES ('${RAW_EVENT_ID}', '${CLUSTER_ID}');
  INSERT INTO pulse_cluster_classification_states (
    schema_version, cluster_id, incident_id, config_hash, config, status,
    attempt_count, max_attempts, first_attempt_at, last_attempt_at,
    next_retry_at, lease_expires_at, last_error_code, last_error_message,
    last_run_id
  ) VALUES (
    'pulse-classification-state/v1', '${CLUSTER_ID}', '${INCIDENT_ID}',
    '${CONFIG_HASH}', '{}'::jsonb, 'retryable_failure', 1, 3,
    '${STARTED_AT.toISOString()}', '${STARTED_AT.toISOString()}',
    '${STARTED_AT.toISOString()}', '2026-07-14T12:30:00.000Z',
    'attempt_in_progress', 'Classifier attempt is in progress.', '${RUN_ID}'
  );
  INSERT INTO pulse_classification_attempts (
    schema_version, attempt_key, cluster_id, incident_id, config_hash,
    ordinal, run_id, outcome, model_call_count, started_at, metadata
  ) VALUES (
    'pulse-classification-attempt/v1', 'started-fixture', '${CLUSTER_ID}',
    '${INCIDENT_ID}', '${CONFIG_HASH}', 1, '${RUN_ID}', 'started', 0,
    '${STARTED_AT.toISOString()}', '{}'::jsonb
  );
`;

function atomicDb(database: PGlite): Db {
  const base = drizzle(database, { schema });
  const batch = async (queries: readonly unknown[]) =>
    database.transaction(async (transaction) => {
      const results: unknown[] = [];
      for (const query of queries as ReadonlyArray<{
        toSQL(): { sql: string; params: unknown[] };
      }>) {
        const compiled = query.toSQL();
        results.push(await transaction.query(compiled.sql, compiled.params));
      }
      return results;
    });
  return Object.assign(base, { batch }) as unknown as Db;
}

function decision(
  eventId: string | null,
  rationale: string,
  verdict: "affirmed" | "refuted",
): PulseDecisionInput {
  return {
    clusterId: CLUSTER_ID,
    eventId,
    kind: "event_existence",
    verdict,
    payload: { disposition: eventId ? "event" : "non_event" },
    actor: {
      type: "classifier",
      provider: "fixture",
      model: "fixture-model",
      reviewerId: null,
    },
    stageRunId: RUN_ID,
    methodVersion: "pulse-v2.15-beta",
    rationale,
    evidenceRefs: [`raw-event:${RAW_EVENT_ID}`],
    decidedAt: STARTED_AT.toISOString(),
  };
}

function classifiedPlan(
  boundary: ClassifiedBoundary,
): ClassifiedClusterPublicationPlan {
  const versions = pulseEventVersionEnvelope([SOURCE_ID]);
  return {
    event: {
      id: EVENT_ID,
      clusterId: CLUSTER_ID,
      incidentId: INCIDENT_ID,
      projectionStatus: "current",
      jurisdictionId: "77777777-7777-4777-8777-777777777777",
      eventDate: "2026-07-14",
      category: "judicial_purge",
      dimension: "rule_of_law",
      severityTier: "moderate_neg",
      severityValue: -4,
      corroborationConfidence: 0.4,
      classifierRuns: [],
      classifierAgreement: "none",
      derivationVersionKey: versions.key,
      derivationVersions: versions.envelope,
      classificationRunId: RUN_ID,
      publicationRunId: null,
      reviewStatus: "pending",
      published: false,
      headline: boundary === "event" ? "FAIL_EVENT" : "Fixture event",
      description: "Fixture event description",
    },
    decisions: [
      decision(
        EVENT_ID,
        boundary === "decision" ? "FAIL_DECISION" : "Fixture decision",
        "affirmed",
      ),
    ],
    attributions: [
      {
        sourceId: SOURCE_ID,
        sourceType: "news",
        sourceName: boundary === "source" ? "FAIL_SOURCE" : "Fixture source",
        sourceUrl: "https://example.test/report",
        rawEventId: RAW_EVENT_ID,
      },
    ],
    disposition: {
      clusterId: CLUSTER_ID,
      rawEventIds: [RAW_EVENT_ID],
      disposition: "event",
      reason: "classification admitted as a Pulse event",
      decision: { category: "judicial_purge" },
      classificationRunId: RUN_ID,
      completedAt: COMPLETED_AT,
    },
    settlement: { claim, outcome: "classified", modelCallCount: 1 },
  };
}

function nonGovernancePlan(
  boundary: NonGovernanceBoundary,
): NonGovernanceClusterPublicationPlan {
  return {
    clusterId: CLUSTER_ID,
    decisions: [
      decision(
        null,
        boundary === "decision" ? "FAIL_DECISION" : "Fixture non-event",
        "refuted",
      ),
    ],
    disposition: {
      clusterId: CLUSTER_ID,
      rawEventIds: [RAW_EVENT_ID],
      disposition: "non_governance",
      reason: "classifier returned category none",
      decision: { category: "none" },
      classificationRunId: RUN_ID,
      completedAt: COMPLETED_AT,
    },
    settlement: { claim, outcome: "none", modelCallCount: 1 },
  };
}

function failureConstraint(
  boundary: ClassifiedBoundary | NonGovernanceBoundary,
  outcome: "classified" | "none",
): { name: string; table: string; expression: string } {
  switch (boundary) {
    case "event":
      return {
        name: "fail_event",
        table: "pulse_events_v2",
        expression: "headline <> 'FAIL_EVENT'",
      };
    case "decision":
      return {
        name: "fail_decision",
        table: "pulse_event_decisions",
        expression: "rationale <> 'FAIL_DECISION'",
      };
    case "source":
      return {
        name: "fail_source",
        table: "pulse_sources",
        expression: "source_name <> 'FAIL_SOURCE'",
      };
    case "raw_disposition":
      return {
        name: "fail_raw_disposition",
        table: "raw_events",
        expression:
          outcome === "classified"
            ? "classification_disposition <> 'event'"
            : "classification_disposition <> 'non_governance'",
      };
    case "state_settlement":
      return {
        name: "fail_state_settlement",
        table: "pulse_cluster_classification_states",
        expression: `status <> '${outcome === "classified" ? "classified" : "none"}'`,
      };
    case "attempt_evidence":
      return {
        name: "fail_attempt_evidence",
        table: "pulse_classification_attempts",
        expression: `outcome <> '${outcome === "classified" ? "classified" : "none"}'`,
      };
  }
}

async function publicationState(database: PGlite) {
  const result = await database.query<{
    event_count: number;
    decision_count: number;
    source_count: number;
    final_attempt_count: number;
    disposition: string;
    status: string;
    state_event_id: string | null;
  }>(`
    SELECT
      (SELECT count(*)::integer FROM pulse_events_v2) AS event_count,
      (SELECT count(*)::integer FROM pulse_event_decisions) AS decision_count,
      (SELECT count(*)::integer FROM pulse_sources) AS source_count,
      (SELECT count(*)::integer FROM pulse_classification_attempts
       WHERE outcome <> 'started') AS final_attempt_count,
      (SELECT classification_disposition FROM raw_events
       WHERE id = '${RAW_EVENT_ID}') AS disposition,
      (SELECT status FROM pulse_cluster_classification_states
       WHERE cluster_id = '${CLUSTER_ID}') AS status,
      (SELECT event_id::text FROM pulse_cluster_classification_states
       WHERE cluster_id = '${CLUSTER_ID}') AS state_event_id
  `);
  return result.rows[0];
}

const pendingState = {
  event_count: 0,
  decision_count: 0,
  source_count: 0,
  final_attempt_count: 0,
  disposition: "pending",
  status: "retryable_failure",
  state_event_id: null,
};

test("classified publication rolls back at every boundary and retry converges", async () => {
  const boundaries: ClassifiedBoundary[] = [
    "event",
    "decision",
    "source",
    "raw_disposition",
    "state_settlement",
    "attempt_evidence",
  ];
  for (const boundary of boundaries) {
    const database = new PGlite();
    try {
      await database.exec(DDL);
      const failure = failureConstraint(boundary, "classified");
      await database.exec(
        `ALTER TABLE ${failure.table} ADD CONSTRAINT ${failure.name} CHECK (${failure.expression})`,
      );
      const db = atomicDb(database);
      const plan = classifiedPlan(boundary);

      await assert.rejects(publishClassifiedCluster(db, plan));
      assert.deepEqual(await publicationState(database), pendingState);

      await database.exec(
        `ALTER TABLE ${failure.table} DROP CONSTRAINT ${failure.name}`,
      );
      await publishClassifiedCluster(db, plan);
      await publishClassifiedCluster(db, plan);
      assert.deepEqual(await publicationState(database), {
        event_count: 1,
        decision_count: 1,
        source_count: 1,
        final_attempt_count: 1,
        disposition: "event",
        status: "classified",
        state_event_id: EVENT_ID,
      });

      const terminalStatus = await settleClassificationAttempt(
        db,
        claim,
        {
          outcome: "failure",
          error: new Error("response lost after commit"),
          modelCallCount: 1,
        },
        new Date("2026-07-14T12:02:00.000Z"),
      );
      assert.equal(terminalStatus, "classified");
      assert.equal((await publicationState(database)).status, "classified");
    } finally {
      await database.close();
    }
  }
});

test("non-governance publication rolls back at every boundary and retry converges", async () => {
  const boundaries: NonGovernanceBoundary[] = [
    "decision",
    "raw_disposition",
    "state_settlement",
    "attempt_evidence",
  ];
  for (const boundary of boundaries) {
    const database = new PGlite();
    try {
      await database.exec(DDL);
      const failure = failureConstraint(boundary, "none");
      await database.exec(
        `ALTER TABLE ${failure.table} ADD CONSTRAINT ${failure.name} CHECK (${failure.expression})`,
      );
      const db = atomicDb(database);
      const plan = nonGovernancePlan(boundary);

      await assert.rejects(publishNonGovernanceCluster(db, plan));
      assert.deepEqual(await publicationState(database), pendingState);

      await database.exec(
        `ALTER TABLE ${failure.table} DROP CONSTRAINT ${failure.name}`,
      );
      await publishNonGovernanceCluster(db, plan);
      await publishNonGovernanceCluster(db, plan);
      assert.deepEqual(await publicationState(database), {
        event_count: 0,
        decision_count: 1,
        source_count: 0,
        final_attempt_count: 1,
        disposition: "non_governance",
        status: "none",
        state_event_id: null,
      });

      const terminalStatus = await settleClassificationAttempt(
        db,
        claim,
        {
          outcome: "failure",
          error: new Error("response lost after commit"),
          modelCallCount: 1,
        },
        new Date("2026-07-14T12:02:00.000Z"),
      );
      assert.equal(terminalStatus, "none");
      assert.equal((await publicationState(database)).status, "none");
    } finally {
      await database.close();
    }
  }
});
