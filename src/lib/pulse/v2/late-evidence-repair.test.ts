import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/lib/db/schema";
import {
  CURRENT_CLASSIFICATION_CONFIG_HASH,
  loadUnclassifiedClusters,
} from "./classify";
import { repairAssignedEvidenceForCurrentEvents } from "./incident-store";

type Db = NeonHttpDatabase<typeof schema>;

const INCIDENT_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const CLASSIFY_RUN_ID = "33333333-3333-4333-8333-333333333333";
const FROZEN_RAW_ID = "44444444-4444-4444-8444-444444444444";
const LATE_RAW_ID = "55555555-5555-4555-8555-555555555555";
const CLUSTER_RUN_ID = "66666666-6666-4666-8666-666666666666";
const JURISDICTION_ID = "77777777-7777-4777-8777-777777777777";

async function harness() {
  const database = new PGlite();
  await database.exec(`
    CREATE TABLE raw_events (
      id uuid PRIMARY KEY,
      source_id text NOT NULL,
      source_type text NOT NULL,
      source_url text NOT NULL,
      incident_id uuid,
      jurisdiction_id uuid,
      event_date date,
      title text NOT NULL,
      body text,
      cluster_id uuid,
      cluster_run_id uuid,
      classification_disposition text NOT NULL DEFAULT 'pending',
      classification_reason text,
      classification_decision jsonb,
      classification_run_id uuid,
      classified_at timestamp,
      clustered_at timestamp,
      retrieved_at timestamp,
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
    CREATE TABLE pulse_cluster_classification_states (
      id uuid PRIMARY KEY,
      cluster_id uuid NOT NULL,
      config_hash text NOT NULL,
      status text NOT NULL,
      next_retry_at timestamp
    );
  `);
  return {
    database,
    db: drizzle(database) as unknown as Db,
  };
}

test("a late assigned report converges into the current event without reclassification", async () => {
  const state = await harness();
  try {
    await state.database.query(
      `INSERT INTO raw_events
         (id, source_id, source_type, source_url, incident_id, jurisdiction_id,
          event_date, title, body, cluster_id, cluster_run_id,
          classification_disposition, clustered_at, retrieved_at, created_at)
       VALUES ($1, 'frozen-source', 'news', 'https://example.test/frozen', $2,
               $3, '2026-07-14', 'Court removes election commissioner',
               'The initial report selected for classification.', $2, $4,
               'pending', '2026-07-14T23:55:00.000Z',
               '2026-07-14T23:54:00.000Z', '2026-07-14T23:54:00.000Z')`,
      [FROZEN_RAW_ID, INCIDENT_ID, JURISDICTION_ID, CLUSTER_RUN_ID],
    );
    const frozenSelection = await loadUnclassifiedClusters(
      state.db,
      10,
      CURRENT_CLASSIFICATION_CONFIG_HASH,
      {
        fallbackEventDate: "2026-07-14",
        eligibilityNow: new Date("2026-07-14T23:56:00.000Z"),
      },
    );
    assert.equal(frozenSelection.length, 1);
    assert.deepEqual(frozenSelection[0].rawEventIds, [FROZEN_RAW_ID]);

    // This assignment lands after the classifier has frozen its input but
    // before publication commits the current event projection.
    await state.database.query(
      `INSERT INTO raw_events
         (id, source_id, source_type, source_url, incident_id, jurisdiction_id,
          event_date, title, body, cluster_id, cluster_run_id,
          classification_disposition, clustered_at, retrieved_at, created_at)
       VALUES ($1, 'late-source', 'news', 'https://example.test/late', $2,
               $3, '2026-07-14', 'Later report for the same event',
               'Evidence assigned after frozen classification selection.', $2,
               $4, 'pending', '2026-07-14T23:58:00.000Z',
               '2026-07-14T23:57:00.000Z', '2026-07-14T23:57:00.000Z')`,
      [LATE_RAW_ID, INCIDENT_ID, JURISDICTION_ID, CLUSTER_RUN_ID],
    );

    // Publication settles only the genuinely frozen model input.
    await state.database.query(
      `INSERT INTO pulse_events_v2
         (id, incident_id, projection_status, classification_run_id, updated_at)
       VALUES ($1, $2, 'current', $3, '2026-07-14T23:59:00.000Z')`,
      [EVENT_ID, INCIDENT_ID, CLASSIFY_RUN_ID],
    );
    await state.database.query(
      `INSERT INTO pulse_sources
         (event_id, source_id, source_type, source_name, source_url, raw_event_id)
       VALUES ($1, 'frozen-source', 'news', 'frozen-source',
               'https://example.test/frozen', $2)`,
      [EVENT_ID, FROZEN_RAW_ID],
    );
    await state.database.query(
      `UPDATE raw_events
       SET classification_disposition = 'event',
           classification_run_id = $1,
           classified_at = '2026-07-14T23:59:00.000Z'
       WHERE id = $2`,
      [CLASSIFY_RUN_ID, FROZEN_RAW_ID],
    );

    const attached = await repairAssignedEvidenceForCurrentEvents(state.db, {
      attachedAt: new Date("2026-07-15T00:01:00.000Z"),
    });
    const duplicate = await repairAssignedEvidenceForCurrentEvents(state.db, {
      attachedAt: new Date("2026-07-15T00:02:00.000Z"),
    });

    const remainingClassificationWork = await loadUnclassifiedClusters(
      state.db,
      10,
      CURRENT_CLASSIFICATION_CONFIG_HASH,
      {
        fallbackEventDate: "2026-07-14",
        eligibilityNow: new Date("2026-07-15T00:03:00.000Z"),
      },
    );

    assert.equal(attached, 1);
    assert.equal(duplicate, 0);
    assert.deepEqual(remainingClassificationWork, []);

    const evidence = await state.database.query<{
      disposition: string;
      classification_run_id: string;
      event_id: string;
      source_count: number;
      total_source_count: number;
      repaired: boolean;
      attached_without_reclassification: boolean;
      classified_at: string;
    }>(`
      SELECT
        r.classification_disposition AS disposition,
        r.classification_run_id,
        ps.event_id,
        (SELECT COUNT(*)::integer FROM pulse_sources
         WHERE raw_event_id = '${LATE_RAW_ID}') AS source_count,
        (SELECT COUNT(*)::integer FROM pulse_sources
         WHERE event_id = '${EVENT_ID}') AS total_source_count,
        (r.classification_decision->>'repair')::boolean AS repaired,
        (r.classification_decision->>'attachedWithoutReclassification')::boolean
          AS attached_without_reclassification,
        to_char(r.classified_at, 'YYYY-MM-DD HH24:MI:SS') AS classified_at
      FROM raw_events r
      JOIN pulse_sources ps ON ps.raw_event_id = r.id
      WHERE r.id = '${LATE_RAW_ID}'
    `);
    assert.deepEqual(evidence.rows[0], {
      disposition: "event",
      classification_run_id: CLASSIFY_RUN_ID,
      event_id: EVENT_ID,
      source_count: 1,
      total_source_count: 2,
      repaired: true,
      attached_without_reclassification: true,
      classified_at: "2026-07-15 00:01:00",
    });
  } finally {
    await state.database.close();
  }
});
