import { randomUUID } from "node:crypto";

import { desc, eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import {
  pulseDriftAlerts,
  pulseDriftBaselines,
  pulseDriftObservations,
  pulsePipelineRuns,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

import {
  assessPulseDrift,
  buildPulseDriftSnapshot,
  pulseDriftAlertKey,
  pulseDriftBaselineEligibility,
  pulseDriftBaselineKey,
  pulseDriftObservationKey,
  PULSE_DRIFT_ALERT_SCHEMA_VERSION,
  PULSE_DRIFT_BASELINE_SCHEMA_VERSION,
  PULSE_DRIFT_METRICS,
  PULSE_DRIFT_MONITOR_VERSION,
  PULSE_DRIFT_OBSERVATION_SCHEMA_VERSION,
  PULSE_DRIFT_WINDOW_DAYS,
  type PulseDriftAlertCandidate,
  type PulseDriftBaseline,
  type PulseDriftBucketInput,
  type PulseDriftMetric,
  type PulseDriftSnapshot,
} from "./drift-monitor";
import { PULSE_RUNTIME_METHOD_VERSION } from "./runtime-contract";

type Db = NeonHttpDatabase<typeof schema>;

export interface PulseDriftMonitoringResult {
  observationId: string | null;
  baselineId: string | null;
  snapshot: PulseDriftSnapshot;
  standing:
    | "no_baseline"
    | "insufficient_evidence"
    | "within_threshold"
    | "alerts_open";
  alertCount: number;
  alerts: PulseDriftAlertCandidate[];
  reused: boolean;
}

function resultRows(result: unknown): Array<Record<string, unknown>> {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Array<Record<string, unknown>>;
}

function asCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Pulse drift query returned invalid count: ${String(value)}`);
  }
  return count;
}

function asIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).filter(Boolean).sort().slice(0, 20)
    : [];
}

function metricRows(
  result: unknown,
  relation: string,
): PulseDriftBucketInput[] {
  return resultRows(result).map((row) => ({
    key: String(row.bucket),
    count: asCount(row.count),
    rowRef: { relation, ids: asIds(row.ids) },
  }));
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Pulse drift database timestamp is invalid: ${String(value)}`);
  }
  return date.toISOString();
}

function snapshotFromRow(row: {
  id: string;
  baselineKey: string;
  runtimeMethodVersion: string;
  snapshot: PulseDriftSnapshot;
  createdAt: Date;
}): PulseDriftBaseline {
  return {
    id: row.id,
    baselineKey: row.baselineKey,
    runtimeMethodVersion: row.runtimeMethodVersion,
    snapshot: row.snapshot,
    createdAt: iso(row.createdAt),
  };
}

/** Read a bounded, aggregate-only trailing snapshot. Every source table is
 * joined through its stage run so mixed historical methods cannot contribute
 * to a current-method baseline or observation. */
export async function loadPulseDriftSnapshot(
  db: Db,
  input: {
    now?: Date;
    windowDays?: number;
    runtimeMethodVersion?: string;
  } = {},
): Promise<PulseDriftSnapshot> {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? PULSE_DRIFT_WINDOW_DAYS;
  const method = input.runtimeMethodVersion ?? PULSE_RUNTIME_METHOD_VERSION;
  if (!Number.isSafeInteger(windowDays) || windowDays < 1 || windowDays > 365) {
    throw new Error("Pulse drift windowDays must be an integer between 1 and 365");
  }
  if (!Number.isFinite(now.getTime())) throw new Error("Pulse drift now is invalid");
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000);

  const [sourceMix, languageMix, modelVersions, taxonomyLabels, corroborationWeight, abstention, reviewOverturns] =
    await Promise.all([
      db.execute(sql`
        SELECT raw.source_id AS bucket, count(*)::int AS count,
          (array_agg(raw.id::text ORDER BY raw.id::text))[1:20] AS ids
        FROM raw_events raw
        JOIN pulse_pipeline_runs run ON run.id = raw.ingest_run_id
        WHERE raw.retrieved_at >= ${windowStart}
          AND raw.retrieved_at <= ${now}
          AND run.stage = 'ingest'
          AND run.versions->'methodology'->>'id' = ${method}
        GROUP BY raw.source_id
        ORDER BY raw.source_id
      `),
      db.execute(sql`
        SELECT raw.evidence_language AS bucket, count(*)::int AS count,
          (array_agg(raw.id::text ORDER BY raw.id::text))[1:20] AS ids
        FROM raw_events raw
        JOIN pulse_pipeline_runs run ON run.id = raw.ingest_run_id
        WHERE raw.retrieved_at >= ${windowStart}
          AND raw.retrieved_at <= ${now}
          AND run.stage = 'ingest'
          AND run.versions->'methodology'->>'id' = ${method}
        GROUP BY raw.evidence_language
        ORDER BY raw.evidence_language
      `),
      db.execute(sql`
        SELECT concat(
          coalesce(model->>'role', 'unknown'), ':',
          coalesce(model->>'provider', 'unknown'), '/',
          coalesce(model->>'model', 'unknown')
        ) AS bucket,
          count(DISTINCT run.id)::int AS count,
          (array_agg(DISTINCT run.id::text ORDER BY run.id::text))[1:20] AS ids
        FROM pulse_pipeline_runs run
        CROSS JOIN LATERAL jsonb_array_elements(run.versions->'models') model
        WHERE run.stage = 'classify'
          AND run.status = 'completed'
          AND run.completed_at >= ${windowStart}
          AND run.completed_at <= ${now}
          AND run.versions->'methodology'->>'id' = ${method}
        GROUP BY 1
        ORDER BY 1
      `),
      db.execute(sql`
        SELECT event.category AS bucket, count(*)::int AS count,
          (array_agg(event.id::text ORDER BY event.id::text))[1:20] AS ids
        FROM pulse_events_v2 event
        JOIN pulse_pipeline_runs run ON run.id = event.classification_run_id
        WHERE event.created_at >= ${windowStart}
          AND event.created_at <= ${now}
          AND run.stage = 'classify'
          AND run.versions->'methodology'->>'id' = ${method}
        GROUP BY event.category
        ORDER BY event.category
      `),
      db.execute(sql`
        SELECT CASE
          WHEN event.corroboration_confidence < 0.2 THEN '0.0-0.2'
          WHEN event.corroboration_confidence < 0.4 THEN '0.2-0.4'
          WHEN event.corroboration_confidence < 0.6 THEN '0.4-0.6'
          WHEN event.corroboration_confidence < 0.8 THEN '0.6-0.8'
          ELSE '0.8-1.0'
        END AS bucket,
          count(*)::int AS count,
          (array_agg(event.id::text ORDER BY event.id::text))[1:20] AS ids
        FROM pulse_events_v2 event
        JOIN pulse_pipeline_runs run ON run.id = event.classification_run_id
        WHERE event.created_at >= ${windowStart}
          AND event.created_at <= ${now}
          AND run.stage = 'classify'
          AND run.versions->'methodology'->>'id' = ${method}
        GROUP BY 1
        ORDER BY 1
      `),
      db.execute(sql`
        SELECT CASE WHEN decision.verdict = 'abstained'
          THEN 'abstained' ELSE 'not_abstained' END AS bucket,
          count(*)::int AS count,
          (array_agg(decision.id::text ORDER BY decision.id::text))[1:20] AS ids
        FROM pulse_event_decisions decision
        JOIN pulse_pipeline_runs run ON run.id = decision.stage_run_id
        WHERE decision.kind = 'event_existence'
          AND decision.decided_at >= ${windowStart}
          AND decision.decided_at <= ${now}
          AND run.versions->'methodology'->>'id' = ${method}
        GROUP BY 1
        ORDER BY 1
      `),
      db.execute(sql`
        SELECT CASE WHEN review.action IN ('edit', 'reject')
          THEN 'overturned' ELSE 'confirmed' END AS bucket,
          count(*)::int AS count,
          (array_agg(review.id::text ORDER BY review.id::text))[1:20] AS ids
        FROM pulse_review_audit_log review
        JOIN pulse_pipeline_runs run ON run.id = review.run_id
        WHERE review.created_at >= ${windowStart}
          AND review.created_at <= ${now}
          AND run.versions->'methodology'->>'id' = ${method}
        GROUP BY 1
        ORDER BY 1
      `),
    ]);

  const rows: Record<PulseDriftMetric, PulseDriftBucketInput[]> = {
    source_mix: metricRows(sourceMix, "raw_events"),
    language_mix: metricRows(languageMix, "raw_events"),
    model_versions: metricRows(modelVersions, "pulse_pipeline_runs"),
    taxonomy_labels: metricRows(taxonomyLabels, "pulse_events_v2"),
    corroboration_weight: metricRows(corroborationWeight, "pulse_events_v2"),
    abstention: metricRows(abstention, "pulse_event_decisions"),
    review_overturns: metricRows(reviewOverturns, "pulse_review_audit_log"),
  };
  return buildPulseDriftSnapshot({
    runtimeMethodVersion: method,
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    metricRows: rows,
  });
}

export async function loadLatestPulseDriftBaseline(
  db: Db,
  runtimeMethodVersion = PULSE_RUNTIME_METHOD_VERSION,
): Promise<PulseDriftBaseline | null> {
  const rows = await db
    .select({
      id: pulseDriftBaselines.id,
      baselineKey: pulseDriftBaselines.baselineKey,
      runtimeMethodVersion: pulseDriftBaselines.runtimeMethodVersion,
      snapshot: pulseDriftBaselines.snapshot,
      createdAt: pulseDriftBaselines.createdAt,
    })
    .from(pulseDriftBaselines)
    .where(eq(pulseDriftBaselines.runtimeMethodVersion, runtimeMethodVersion))
    .orderBy(desc(pulseDriftBaselines.createdAt))
    .limit(1);
  const row = rows[0];
  return row ? snapshotFromRow(row) : null;
}

export async function capturePulseDriftBaseline(
  db: Db,
  input: {
    now?: Date;
    windowDays?: number;
    write?: boolean;
  } = {},
): Promise<{
  baseline: PulseDriftBaseline | null;
  snapshot: PulseDriftSnapshot;
  eligible: boolean;
  reasons: string[];
  wrote: boolean;
}> {
  const now = input.now ?? new Date();
  const snapshot = await loadPulseDriftSnapshot(db, {
    now,
    windowDays: input.windowDays,
  });
  const eligibility = pulseDriftBaselineEligibility(snapshot);
  if (!eligibility.eligible || !input.write) {
    return {
      baseline: null,
      snapshot,
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      wrote: false,
    };
  }
  const baselineKey = pulseDriftBaselineKey(snapshot);
  const inserted = await db
    .insert(pulseDriftBaselines)
    .values({
      schemaVersion: PULSE_DRIFT_BASELINE_SCHEMA_VERSION,
      baselineKey,
      runtimeMethodVersion: snapshot.runtimeMethodVersion,
      windowStart: new Date(snapshot.windowStart),
      windowEnd: new Date(snapshot.windowEnd),
      snapshot,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({
      id: pulseDriftBaselines.id,
      baselineKey: pulseDriftBaselines.baselineKey,
      runtimeMethodVersion: pulseDriftBaselines.runtimeMethodVersion,
      snapshot: pulseDriftBaselines.snapshot,
      createdAt: pulseDriftBaselines.createdAt,
    });
  if (inserted[0]) {
    return {
      baseline: snapshotFromRow(inserted[0]),
      snapshot,
      eligible: true,
      reasons: [],
      wrote: true,
    };
  }
  const existing = await db
    .select({
      id: pulseDriftBaselines.id,
      baselineKey: pulseDriftBaselines.baselineKey,
      runtimeMethodVersion: pulseDriftBaselines.runtimeMethodVersion,
      snapshot: pulseDriftBaselines.snapshot,
      createdAt: pulseDriftBaselines.createdAt,
    })
    .from(pulseDriftBaselines)
    .where(eq(pulseDriftBaselines.baselineKey, baselineKey))
    .limit(1);
  if (!existing[0]) throw new Error("Pulse drift baseline insert did not persist");
  return {
    baseline: snapshotFromRow(existing[0]),
    snapshot,
    eligible: true,
    reasons: [],
    wrote: false,
  };
}

async function assertCompletedCurrentScoreRun(db: Db, scoreRunId: string): Promise<void> {
  const rows = await db
    .select({
      stage: pulsePipelineRuns.stage,
      status: pulsePipelineRuns.status,
      versions: pulsePipelineRuns.versions,
    })
    .from(pulsePipelineRuns)
    .where(eq(pulsePipelineRuns.id, scoreRunId))
    .limit(1);
  const row = rows[0];
  if (!row || row.stage !== "score" || row.status !== "completed") {
    throw new Error("Pulse drift monitoring requires a completed score run");
  }
  if (row.versions.methodology.state !== "versioned" || row.versions.methodology.id !== PULSE_RUNTIME_METHOD_VERSION) {
    throw new Error("Pulse drift monitoring refuses a score run from another method");
  }
}

function persistedAlert(input: {
  observationKey: string;
  alert: PulseDriftAlertCandidate;
}): {
  schemaVersion: typeof PULSE_DRIFT_ALERT_SCHEMA_VERSION;
  alertKey: string;
  metric: PulseDriftAlertCandidate["metric"];
  reason: PulseDriftAlertCandidate["reason"];
  comparison: Record<string, unknown>;
  affectedRowRefs: Array<Record<string, unknown>>;
  remediationPath: string;
} {
  return {
    schemaVersion: PULSE_DRIFT_ALERT_SCHEMA_VERSION,
    alertKey: pulseDriftAlertKey(input),
    metric: input.alert.metric,
    reason: input.alert.reason,
    comparison: {
      distance: input.alert.distance,
      threshold: input.alert.threshold,
      affectedBuckets: input.alert.affectedBuckets.map((bucket) => ({
        key: bucket.key,
        baselineShare: bucket.baselineShare,
        observedShare: bucket.observedShare,
      })),
    },
    affectedRowRefs: input.alert.affectedBuckets.map((bucket) => ({
      bucket: bucket.key,
      relation: bucket.rowRef.relation,
      ids: bucket.rowRef.ids,
    })),
    remediationPath: input.alert.remediationPath,
  };
}

/** Persist one outcome after score publication. Inserts are a single Neon
 * batch so a retry sees either the whole observation plus alerts or no record
 * at all. */
export async function recordPulseDriftObservation(
  db: Db,
  input: { scoreRunId: string; now?: Date },
): Promise<PulseDriftMonitoringResult> {
  await assertCompletedCurrentScoreRun(db, input.scoreRunId);
  const existing = await db
    .select({
      id: pulseDriftObservations.id,
      baselineId: pulseDriftObservations.baselineId,
      snapshot: pulseDriftObservations.snapshot,
      standing: pulseDriftObservations.standing,
      alertCount: pulseDriftObservations.alertCount,
    })
    .from(pulseDriftObservations)
    .where(eq(pulseDriftObservations.scoreRunId, input.scoreRunId))
    .limit(1);
  if (existing[0]) {
    return {
      observationId: existing[0].id,
      baselineId: existing[0].baselineId,
      snapshot: existing[0].snapshot,
      standing: existing[0].standing,
      alertCount: existing[0].alertCount,
      alerts: [],
      reused: true,
    };
  }

  const now = input.now ?? new Date();
  const [baseline, snapshot] = await Promise.all([
    loadLatestPulseDriftBaseline(db),
    loadPulseDriftSnapshot(db, { now }),
  ]);
  const assessment = assessPulseDrift({
    baseline: baseline?.snapshot ?? null,
    observed: snapshot,
  });
  const observationId = randomUUID();
  const observationKey = pulseDriftObservationKey({
    scoreRunId: input.scoreRunId,
    baselineId: baseline?.id ?? null,
    snapshot,
  });
  const observation = db
    .insert(pulseDriftObservations)
    .values({
      id: observationId,
      schemaVersion: PULSE_DRIFT_OBSERVATION_SCHEMA_VERSION,
      observationKey,
      scoreRunId: input.scoreRunId,
      baselineId: baseline?.id ?? null,
      runtimeMethodVersion: snapshot.runtimeMethodVersion,
      windowStart: new Date(snapshot.windowStart),
      windowEnd: new Date(snapshot.windowEnd),
      snapshot,
      standing: assessment.standing,
      alertCount: assessment.alerts.length,
      observedAt: now,
      createdAt: now,
    });
  const alerts = baseline
    ? assessment.alerts.map((alert) => {
        const persisted = persistedAlert({ observationKey, alert });
        return db.insert(pulseDriftAlerts).values({
          id: randomUUID(),
          ...persisted,
          observationId,
          baselineId: baseline.id,
          createdAt: now,
        });
      })
    : [];
  await db.batch([observation, ...alerts] as Parameters<typeof db.batch>[0]);
  return {
    observationId,
    baselineId: baseline?.id ?? null,
    snapshot,
    standing: assessment.standing,
    alertCount: assessment.alerts.length,
    alerts: assessment.alerts,
    reused: false,
  };
}

/** A dry-run-compatible read-only preview. It deliberately has no score-run
 * validation or persistence because the score dry-run has no completed run. */
export async function previewPulseDriftObservation(
  db: Db,
  input: { now?: Date } = {},
): Promise<PulseDriftMonitoringResult> {
  const [baseline, snapshot] = await Promise.all([
    loadLatestPulseDriftBaseline(db),
    loadPulseDriftSnapshot(db, input),
  ]);
  const assessment = assessPulseDrift({
    baseline: baseline?.snapshot ?? null,
    observed: snapshot,
  });
  return {
    observationId: null,
    baselineId: baseline?.id ?? null,
    snapshot,
    standing: assessment.standing,
    alertCount: assessment.alerts.length,
    alerts: assessment.alerts,
    reused: false,
  };
}

export const PULSE_DRIFT_MONITORED_METRICS = PULSE_DRIFT_METRICS;
