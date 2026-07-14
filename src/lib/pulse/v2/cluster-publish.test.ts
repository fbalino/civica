import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "@/lib/db/schema";
import {
  publishSemanticClusterPlan,
  type SemanticClusterPublishPlan,
} from "./cluster-publish";
import {
  PULSE_INCIDENT_ASSIGNMENT_ALGORITHM_VERSION,
  PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION,
  buildIncidentAssignmentKey,
  buildIncidentResolutionKey,
  type IncidentAssignmentPlan,
  type IncidentResolutionRecordPlan,
} from "./incident-store";
import { PULSE_INCIDENT_RESOLUTION_VERSION } from "./incident-resolution";

type Db = NeonHttpDatabase<typeof schema>;
type FailureBoundary =
  | "incident"
  | "assignment"
  | "raw_projection"
  | "evidence"
  | "resolution"
  | "finalization";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const CLASSIFICATION_RUN_ID = "22222222-2222-4222-8222-222222222222";
const NEW_INCIDENT_ID = "33333333-3333-4333-8333-333333333333";
const PERSISTED_INCIDENT_ID = "44444444-4444-4444-8444-444444444444";
const RAW_NEW_ID = "55555555-5555-4555-8555-555555555555";
const RAW_EVIDENCE_ID = "66666666-6666-4666-8666-666666666666";
const EVENT_ID = "77777777-7777-4777-8777-777777777777";
const NOW = "2026-07-14T12:00:00.000Z";

const DDL = `
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
  CREATE TABLE pulse_incidents (
    id uuid PRIMARY KEY,
    status text NOT NULL,
    merged_into_incident_id uuid,
    representative_title text NOT NULL,
    event_date_start date,
    event_date_end date,
    identity_version text NOT NULL,
    identity_key text NOT NULL,
    identity_tokens text[] NOT NULL,
    identity_anchors text[] NOT NULL,
    representative_embedding real[],
    created_run_id uuid NOT NULL,
    created_at timestamp NOT NULL DEFAULT NOW(),
    updated_at timestamp NOT NULL DEFAULT NOW()
  );
  CREATE TABLE raw_events (
    id uuid PRIMARY KEY,
    embedding real[],
    cluster_id uuid,
    incident_id uuid,
    clustered_at timestamp,
    cluster_run_id uuid,
    classification_disposition text NOT NULL DEFAULT 'pending',
    classification_reason text,
    classification_decision jsonb,
    classification_run_id uuid,
    classified_at timestamp
  );
  CREATE TABLE pulse_incident_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version text NOT NULL,
    assignment_key text NOT NULL UNIQUE,
    incident_id uuid NOT NULL,
    raw_event_id uuid NOT NULL UNIQUE,
    raw_cluster_id uuid NOT NULL,
    match_kind text NOT NULL,
    semantic_similarity real,
    token_similarity real NOT NULL,
    anchor_overlap real NOT NULL,
    exact_normalized_match boolean NOT NULL,
    algorithm_version text NOT NULL,
    embedding_model text,
    fallback_mode text NOT NULL,
    stage_run_id uuid NOT NULL,
    actor jsonb NOT NULL,
    rationale text NOT NULL,
    assigned_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT NOW()
  );
  CREATE TABLE pulse_events_v2 (
    id uuid PRIMARY KEY,
    incident_id uuid NOT NULL,
    projection_status text NOT NULL,
    classification_run_id uuid NOT NULL
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
  CREATE TABLE pulse_incident_resolutions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version text NOT NULL,
    resolution_key text NOT NULL UNIQUE,
    left_incident_id uuid NOT NULL,
    right_incident_id uuid NOT NULL,
    outcome text NOT NULL,
    canonical_incident_id uuid,
    signals jsonb NOT NULL,
    method_version text NOT NULL,
    stage_run_id uuid NOT NULL,
    actor jsonb NOT NULL,
    rationale text NOT NULL,
    evidence_refs text[] NOT NULL,
    decided_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT NOW()
  );
  INSERT INTO pulse_pipeline_runs
    (id, stage, status, version_key, versions)
  VALUES
    ('${RUN_ID}', 'cluster', 'running', 'fixture', '{}'::jsonb);
  INSERT INTO pulse_incidents
    (id, status, representative_title, identity_version, identity_key,
     identity_tokens, identity_anchors, created_run_id)
  VALUES
    ('${PERSISTED_INCIDENT_ID}', 'active', 'Persisted incident', 'fixture',
     'fixture', ARRAY['persisted'], ARRAY['persisted'], '${RUN_ID}');
  INSERT INTO raw_events (id) VALUES ('${RAW_NEW_ID}'), ('${RAW_EVIDENCE_ID}');
  INSERT INTO pulse_events_v2
    (id, incident_id, projection_status, classification_run_id)
  VALUES
    ('${EVENT_ID}', '${PERSISTED_INCIDENT_ID}', 'current',
     '${CLASSIFICATION_RUN_ID}');
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

function assignment(input: {
  rawEventId: string;
  incidentId: string;
  rationale: string;
}): IncidentAssignmentPlan {
  const payload = {
    incidentId: input.incidentId,
    rawEventId: input.rawEventId,
    rawClusterId: input.incidentId,
    matchKind:
      input.incidentId === NEW_INCIDENT_ID
        ? ("new" as const)
        : ("persisted_match" as const),
    semanticSimilarity: 0.99,
    tokenSimilarity: 0.95,
    anchorOverlap: 1,
    exactNormalizedMatch: true,
    algorithmVersion: PULSE_INCIDENT_ASSIGNMENT_ALGORITHM_VERSION,
    embeddingModel: "fixture-embedding",
    fallbackMode: "semantic" as const,
    stageRunId: RUN_ID,
    actor: { type: "pipeline", stage: "cluster" },
    rationale: input.rationale,
    assignedAt: NOW,
  };
  return {
    schemaVersion: PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION,
    assignmentKey: buildIncidentAssignmentKey(payload),
    ...payload,
  };
}

function publishPlan(boundary: FailureBoundary): SemanticClusterPublishPlan {
  const left = [NEW_INCIDENT_ID, PERSISTED_INCIDENT_ID].sort()[0];
  const right = [NEW_INCIDENT_ID, PERSISTED_INCIDENT_ID].sort()[1];
  const resolutionPayload = {
    leftIncidentId: left,
    rightIncidentId: right,
    outcome: "candidate" as const,
    canonicalIncidentId: null,
    signals: { reason: "fixture" },
    methodVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
    stageRunId: RUN_ID,
    actor: { type: "pipeline", stage: "post_cluster_collision" },
    rationale:
      boundary === "resolution" ? "FAIL_RESOLUTION" : "fixture resolution",
    evidenceRefs: [`incident:${left}`, `incident:${right}`],
    decidedAt: NOW,
  };
  const resolution: IncidentResolutionRecordPlan = {
    schemaVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
    resolutionKey: buildIncidentResolutionKey(resolutionPayload),
    ...resolutionPayload,
  };
  return {
    runId: RUN_ID,
    incidents: [
      {
        id: NEW_INCIDENT_ID,
        representativeTitle:
          boundary === "incident" ? "FAIL_INCIDENT" : "New incident",
        body: "Fixture body",
        eventDateStart: "2026-07-14",
        eventDateEnd: "2026-07-14",
        embedding: [1, 0],
        createdRunId: RUN_ID,
      },
    ],
    assignments: [
      {
        assignment: assignment({
          rawEventId: RAW_NEW_ID,
          incidentId: NEW_INCIDENT_ID,
          rationale:
            boundary === "assignment"
              ? "FAIL_ASSIGNMENT"
              : "fixture new assignment",
        }),
        embedding: boundary === "raw_projection" ? [999, 0] : [1, 0],
      },
      {
        assignment: assignment({
          rawEventId: RAW_EVIDENCE_ID,
          incidentId: PERSISTED_INCIDENT_ID,
          rationale: "fixture persisted assignment",
        }),
        embedding: [1, 0],
      },
    ],
    evidence: [
      {
        eventId: EVENT_ID,
        rawEventId: RAW_EVIDENCE_ID,
        sourceId: "fixture-source",
        sourceType: "news",
        sourceName:
          boundary === "evidence" ? "FAIL_EVIDENCE" : "Fixture source",
        sourceUrl: "https://example.test/evidence",
        stageRunId: RUN_ID,
        attachedAt: NOW,
        rationale: "fixture evidence attachment",
      },
    ],
    resolutions: [resolution],
    completion: {
      runId: RUN_ID,
      counts: { clustered: 2, clustersCreated: 1 },
      completedAt: NOW,
    },
  };
}

function failureConstraint(boundary: FailureBoundary): {
  name: string;
  table: string;
  expression: string;
} {
  switch (boundary) {
    case "incident":
      return {
        name: "fail_incident",
        table: "pulse_incidents",
        expression: "representative_title <> 'FAIL_INCIDENT'",
      };
    case "assignment":
      return {
        name: "fail_assignment",
        table: "pulse_incident_assignments",
        expression: "rationale <> 'FAIL_ASSIGNMENT'",
      };
    case "raw_projection":
      return {
        name: "fail_raw_projection",
        table: "raw_events",
        expression: "embedding IS NULL OR embedding[1] <> 999::real",
      };
    case "evidence":
      return {
        name: "fail_evidence",
        table: "pulse_sources",
        expression: "source_name <> 'FAIL_EVIDENCE'",
      };
    case "resolution":
      return {
        name: "fail_resolution",
        table: "pulse_incident_resolutions",
        expression: "rationale <> 'FAIL_RESOLUTION'",
      };
    case "finalization":
      return {
        name: "fail_finalization",
        table: "pulse_pipeline_runs",
        expression: "status <> 'completed'",
      };
  }
}

async function publishState(database: PGlite) {
  const rows = await database.query<{
    incident_count: number;
    assignment_count: number;
    projected_count: number;
    evidence_count: number;
    resolution_count: number;
    run_status: string;
  }>(`
    SELECT
      (SELECT count(*)::integer FROM pulse_incidents
       WHERE id = '${NEW_INCIDENT_ID}') AS incident_count,
      (SELECT count(*)::integer FROM pulse_incident_assignments) AS assignment_count,
      (SELECT count(*)::integer FROM raw_events
       WHERE cluster_id IS NOT NULL) AS projected_count,
      (SELECT count(*)::integer FROM pulse_sources) AS evidence_count,
      (SELECT count(*)::integer FROM pulse_incident_resolutions) AS resolution_count,
      (SELECT status FROM pulse_pipeline_runs WHERE id = '${RUN_ID}') AS run_status
  `);
  return rows.rows[0];
}

test("semantic cluster publish rolls back at every boundary and retry converges", async () => {
  const boundaries: FailureBoundary[] = [
    "incident",
    "assignment",
    "raw_projection",
    "evidence",
    "resolution",
    "finalization",
  ];
  for (const boundary of boundaries) {
    const database = new PGlite();
    try {
      await database.exec(DDL);
      const failure = failureConstraint(boundary);
      await database.exec(
        `ALTER TABLE ${failure.table} ADD CONSTRAINT ${failure.name} CHECK (${failure.expression})`,
      );
      const db = atomicDb(database);
      const plan = publishPlan(boundary);

      await assert.rejects(publishSemanticClusterPlan(db, plan));
      assert.deepEqual(await publishState(database), {
        incident_count: 0,
        assignment_count: 0,
        projected_count: 0,
        evidence_count: 0,
        resolution_count: 0,
        run_status: "running",
      });

      await database.exec(
        `ALTER TABLE ${failure.table} DROP CONSTRAINT ${failure.name}`,
      );
      await publishSemanticClusterPlan(db, plan);
      assert.deepEqual(await publishState(database), {
        incident_count: 1,
        assignment_count: 2,
        projected_count: 2,
        evidence_count: 1,
        resolution_count: 1,
        run_status: "completed",
      });
    } finally {
      await database.close();
    }
  }
});
