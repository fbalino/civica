import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/lib/db/schema";

type Db = NeonHttpDatabase<typeof schema>;

export interface FrozenClassificationCluster {
  clusterId: string;
  rawEventIds: string[];
}

export interface ClassificationRunFinalizationInput {
  runId: string;
  configHash: string;
  clusters: FrozenClassificationCluster[];
  completedAt?: Date;
}

export interface ClassificationRunFinalizationResult {
  status: "completed" | "partial";
  counts: Record<string, number>;
}

function rows(result: unknown): Record<string, unknown>[] {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: Record<string, unknown>[] }).rows ?? [])
  ) as Record<string, unknown>[];
}

function numericCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      Number.isFinite(Number(item)) ? Number(item) : 0,
    ]),
  );
}

function validateInput(input: ClassificationRunFinalizationInput): void {
  if (!input.runId.trim() || !input.configHash.trim()) {
    throw new Error(
      "classification run finalization requires run and config identity",
    );
  }
  const clusterIds = input.clusters.map(({ clusterId }) => clusterId);
  if (new Set(clusterIds).size !== clusterIds.length) {
    throw new Error(
      "classification run input snapshot contains duplicate clusters",
    );
  }
  const rawEventIds = input.clusters.flatMap(({ rawEventIds }) => rawEventIds);
  if (new Set(rawEventIds).size !== rawEventIds.length) {
    throw new Error(
      "classification run input snapshot contains duplicate raw events",
    );
  }
  for (const cluster of input.clusters) {
    if (!cluster.clusterId.trim() || cluster.rawEventIds.length === 0) {
      throw new Error(
        "classification run input snapshot contains an incomplete cluster",
      );
    }
    if (cluster.rawEventIds.some((id) => !id.trim())) {
      throw new Error(
        "classification run input snapshot contains a blank raw event",
      );
    }
  }
}

/**
 * Close a classify run only when every cluster in its immutable input snapshot
 * has terminal attempt evidence. Successful classified/none outcomes must also
 * have their complete atomic publication. Verification and the terminal run
 * update share one SQL statement, so a late database/transport failure cannot
 * produce a completed marker for an incomplete workset.
 *
 * Raw membership comes from the frozen run envelope. A later report may join
 * the same cluster, but it belongs to a later delivery and cannot silently
 * expand this run's publication or prevent its finalization.
 */
export async function finalizeClassificationPipelineRun(
  db: Db,
  input: ClassificationRunFinalizationInput,
): Promise<ClassificationRunFinalizationResult | null> {
  validateInput(input);
  const completedAt = input.completedAt ?? new Date();
  const inputJson = JSON.stringify(input.clusters);
  const result = await db.execute(sql`
    WITH input_clusters AS (
      SELECT
        (entry->>'clusterId')::uuid AS cluster_id,
        entry->'rawEventIds' AS raw_event_ids
      FROM jsonb_array_elements(${inputJson}::jsonb) AS entry
    ), outcomes AS (
      SELECT
        i.cluster_id,
        s.status,
        e.id AS event_id,
        COALESCE(e.published, false) AS published,
        COALESCE((
          SELECT SUM(a.model_call_count)::integer
          FROM pulse_classification_attempts a
          WHERE a.cluster_id = i.cluster_id
            AND a.config_hash = ${input.configHash}
            AND a.run_id = ${input.runId}::uuid
            AND a.outcome <> 'started'
        ), 0) AS model_calls,
        (
          jsonb_array_length(i.raw_event_ids) > 0
          AND (
            SELECT COUNT(*)
            FROM raw_events r
            WHERE r.id IN (
              SELECT value::uuid
              FROM jsonb_array_elements_text(i.raw_event_ids)
            )
              AND r.cluster_id = i.cluster_id
          ) = jsonb_array_length(i.raw_event_ids)
          AND EXISTS (
            SELECT 1
            FROM pulse_classification_attempts a
            WHERE a.cluster_id = i.cluster_id
              AND a.config_hash = ${input.configHash}
              AND a.ordinal = s.attempt_count
              AND a.run_id = ${input.runId}::uuid
              AND a.outcome = s.status
              AND a.completed_at IS NOT NULL
          )
          AND (
            (
              s.status = 'classified'
              AND e.id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM pulse_event_decisions d
                WHERE d.cluster_id = i.cluster_id
                  AND d.event_id = e.id
                  AND d.stage_run_id = ${input.runId}::uuid
                  AND d.kind = 'event_existence'
                  AND d.verdict = 'affirmed'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(i.raw_event_ids) expected(value)
                WHERE NOT EXISTS (
                  SELECT 1 FROM raw_events r
                  WHERE r.id = expected.value::uuid
                    AND r.cluster_id = i.cluster_id
                    AND r.classification_disposition = 'event'
                    AND r.classification_run_id = ${input.runId}::uuid
                    AND EXISTS (
                      SELECT 1 FROM pulse_sources ps
                      WHERE ps.raw_event_id = r.id AND ps.event_id = e.id
                    )
                )
              )
            )
            OR (
              s.status = 'none'
              AND s.event_id IS NULL
              AND EXISTS (
                SELECT 1 FROM pulse_event_decisions d
                WHERE d.cluster_id = i.cluster_id
                  AND d.event_id IS NULL
                  AND d.stage_run_id = ${input.runId}::uuid
                  AND d.kind = 'event_existence'
                  AND d.verdict = 'refuted'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(i.raw_event_ids) expected(value)
                WHERE NOT EXISTS (
                  SELECT 1 FROM raw_events r
                  WHERE r.id = expected.value::uuid
                    AND r.cluster_id = i.cluster_id
                    AND r.classification_disposition = 'non_governance'
                    AND r.classification_run_id = ${input.runId}::uuid
                )
              )
            )
            OR (
              s.status = 'terminal_failure'
              AND s.event_id IS NULL
            )
          )
        ) AS valid
      FROM input_clusters i
      LEFT JOIN pulse_cluster_classification_states s
        ON s.cluster_id = i.cluster_id
       AND s.config_hash = ${input.configHash}
       AND s.last_run_id = ${input.runId}::uuid
      LEFT JOIN pulse_events_v2 e
        ON e.id = s.event_id
       AND e.cluster_id = i.cluster_id
       AND e.classification_run_id = ${input.runId}::uuid
       AND e.projection_status = 'current'
    ), aggregate AS (
      SELECT
        COUNT(*)::integer AS input_count,
        COUNT(*) FILTER (WHERE valid)::integer AS valid_count,
        COUNT(*) FILTER (WHERE valid AND status = 'classified')::integer AS classified,
        COUNT(*) FILTER (WHERE valid AND status = 'classified' AND published)::integer AS published_auto,
        COUNT(*) FILTER (WHERE valid AND status = 'classified' AND NOT published)::integer AS flagged_for_review,
        COUNT(*) FILTER (WHERE valid AND status = 'none')::integer AS non_governance,
        COUNT(*) FILTER (WHERE valid AND status = 'terminal_failure')::integer AS terminal_failures,
        COALESCE(SUM(model_calls) FILTER (WHERE valid), 0)::integer AS model_calls
      FROM outcomes
    ), closed AS (
      UPDATE pulse_pipeline_runs p
      SET
        status = CASE
          WHEN a.terminal_failures > 0 THEN 'partial'
          ELSE 'completed'
        END,
        counts = jsonb_build_object(
          'clustersExamined', a.input_count,
          'classified', a.classified,
          'publishedAuto', a.published_auto,
          'flaggedForReview', a.flagged_for_review,
          'nonGovernance', a.non_governance,
          'failed', a.terminal_failures,
          'modelCalls', a.model_calls,
          'retryableFailures', 0,
          'terminalFailures', a.terminal_failures,
          'claimsSkipped', 0
        ),
        failures = CASE
          WHEN a.terminal_failures > 0 THEN jsonb_build_array(jsonb_build_object(
            'component', 'classification',
            'message', a.terminal_failures || ' cluster(s) exhausted classification retries.'
          ))
          ELSE '[]'::jsonb
        END,
        completed_at = ${completedAt}
      FROM aggregate a
      WHERE p.id = ${input.runId}::uuid
        AND p.stage = 'classify'
        AND p.status = 'running'
        AND a.input_count = ${input.clusters.length}
        AND a.valid_count = ${input.clusters.length}
      RETURNING p.status, p.counts
    )
    SELECT status, counts FROM closed
  `);
  const closed = rows(result)[0];
  if (closed) {
    return {
      status: closed.status as "completed" | "partial",
      counts: numericCounts(closed.counts),
    };
  }

  // Another retry may have won the close race. Terminal completed/partial
  // evidence is safe to reuse; a running row means an input is incomplete.
  const existing = await db.execute(sql`
    SELECT status, counts
    FROM pulse_pipeline_runs
    WHERE id = ${input.runId}::uuid AND stage = 'classify'
    LIMIT 1
  `);
  const row = rows(existing)[0];
  if (row?.status !== "completed" && row?.status !== "partial") return null;
  return {
    status: row.status,
    counts: numericCounts(row.counts),
  };
}
