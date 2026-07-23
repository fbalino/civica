import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import type { CivicaDb } from "@/lib/db";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import {
  validateAtlasChangeDescriptor,
  type AtlasChangeDescriptor,
} from "@/lib/atlas/change-history-writer";

type Db = typeof import("@/lib/db").db;

export interface CountryMetricInput {
  jurisdictionId: string;
  metricId: string;
  year: number;
  value: number;
  rank?: number;
  totalRanked?: number;
  sourceId: string;
  sourceUrl: string | null;
}

export type CountryMetricHistoryContext = Pick<
  AtlasChangeDescriptor,
  "changeKind" | "reason" | "methodologyVersion" | "releaseId"
>;

type CountryMetricWrite = (
  database: Pick<CivicaDb, "execute">,
  row: CountryMetricInput,
  history: CountryMetricHistoryContext,
) => Promise<void>;

/**
 * Builds one statement that upserts an indicator observation and appends its
 * bounded public-history event. PostgreSQL commits or rolls back both CTEs
 * together. A rare concurrent insert that was not visible to `before_row`
 * still upserts safely but emits no event rather than fabricating a null
 * predecessor; production pipeline leases should make that branch exceptional.
 */
export function buildCountryMetricHistoryStatement(
  row: CountryMetricInput,
  history: CountryMetricHistoryContext,
  proposedId = randomUUID(),
) {
  const descriptor = validateAtlasChangeDescriptor({
    ...history,
    operation: "update",
  });
  const rank = row.rank ?? null;
  const totalRanked = row.totalRanked ?? null;

  return sql`
    WITH before_row AS (
      SELECT
        id,
        value,
        value_status,
        value_status_reason,
        rank,
        total_ranked,
        source_id,
        source_url,
        year
      FROM country_metrics
      WHERE jurisdiction_id = ${row.jurisdictionId}::uuid
        AND metric_id = ${row.metricId}
        AND year = ${row.year}
      FOR UPDATE
    ),
    upserted AS (
      INSERT INTO country_metrics (
        id,
        jurisdiction_id,
        metric_id,
        year,
        value,
        value_status,
        value_status_reason,
        rank,
        total_ranked,
        source_id,
        source_url,
        updated_at
      )
      VALUES (
        COALESCE((SELECT id FROM before_row), ${proposedId}::uuid),
        ${row.jurisdictionId}::uuid,
        ${row.metricId},
        ${row.year},
        ${row.value},
        'observed',
        NULL,
        ${rank},
        ${totalRanked},
        ${row.sourceId},
        ${row.sourceUrl},
        NOW()
      )
      ON CONFLICT (jurisdiction_id, metric_id, year) DO UPDATE SET
        value = EXCLUDED.value,
        value_status = EXCLUDED.value_status,
        value_status_reason = EXCLUDED.value_status_reason,
        rank = EXCLUDED.rank,
        total_ranked = EXCLUDED.total_ranked,
        source_id = EXCLUDED.source_id,
        source_url = EXCLUDED.source_url,
        updated_at = NOW()
      RETURNING
        id,
        value,
        value_status,
        value_status_reason,
        rank,
        total_ranked,
        source_id,
        source_url,
        year
    ),
    change_payload AS (
      SELECT
        u.id,
        b.id AS before_id,
        (
          CASE WHEN b.value IS DISTINCT FROM u.value
            THEN jsonb_build_array(jsonb_build_object('field', 'value', 'before', b.value, 'after', u.value))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.value_status IS DISTINCT FROM u.value_status
            THEN jsonb_build_array(jsonb_build_object('field', 'value_status', 'before', b.value_status, 'after', u.value_status))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.value_status_reason IS DISTINCT FROM u.value_status_reason
            THEN jsonb_build_array(jsonb_build_object('field', 'value_status_reason', 'before', b.value_status_reason, 'after', u.value_status_reason))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.rank IS DISTINCT FROM u.rank
            THEN jsonb_build_array(jsonb_build_object('field', 'rank', 'before', b.rank, 'after', u.rank))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.total_ranked IS DISTINCT FROM u.total_ranked
            THEN jsonb_build_array(jsonb_build_object('field', 'total_ranked', 'before', b.total_ranked, 'after', u.total_ranked))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.source_id IS DISTINCT FROM u.source_id
            THEN jsonb_build_array(jsonb_build_object('field', 'source_id', 'before', b.source_id, 'after', u.source_id))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.source_url IS DISTINCT FROM u.source_url
            THEN jsonb_build_array(jsonb_build_object('field', 'source_url', 'before', b.source_url, 'after', u.source_url))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.year IS DISTINCT FROM u.year
            THEN jsonb_build_array(jsonb_build_object('field', 'year', 'before', b.year, 'after', u.year))
            ELSE '[]'::jsonb END
        ) AS changes
      FROM upserted u
      LEFT JOIN before_row b ON TRUE
    ),
    history_event AS (
      INSERT INTO atlas_entity_change_history (
        entity_type,
        entity_id,
        entity_table,
        operation,
        change_kind,
        changes,
        reason,
        methodology_version,
        release_id
      )
      SELECT
        'indicator',
        id::text,
        'country_metrics',
        CASE WHEN before_id IS NULL THEN 'insert' ELSE 'update' END,
        ${descriptor.changeKind},
        changes,
        ${descriptor.reason},
        ${descriptor.methodologyVersion},
        ${descriptor.releaseId}
      FROM change_payload
      WHERE jsonb_array_length(changes) > 0
        AND (before_id IS NOT NULL OR id = ${proposedId}::uuid)
      RETURNING id
    )
    SELECT
      upserted.id,
      EXISTS (SELECT 1 FROM history_event) AS history_written
    FROM upserted
  `;
}

export async function upsertCountryMetricWithHistory(
  database: Pick<CivicaDb, "execute">,
  row: CountryMetricInput,
  history: CountryMetricHistoryContext,
): Promise<void> {
  await database.execute(buildCountryMetricHistoryStatement(row, history));
}

export async function writeCountryMetrics(
  database: Db,
  rows: CountryMetricInput[],
  options: {
    dryRun?: boolean;
    stampFreshness?: boolean;
    markSynced?: typeof markSourcesSynced;
    history?: CountryMetricHistoryContext;
    writeMetric?: CountryMetricWrite;
  } = {},
) {
  if (rows.length === 0) {
    throw new Error("Country metrics input produced zero rows");
  }
  const keys = new Set<string>();
  for (const row of rows) {
    const key = `${row.jurisdictionId}:${row.metricId}:${row.year}`;
    if (keys.has(key)) throw new Error(`Duplicate country metric: ${key}`);
    keys.add(key);
    if (!Number.isFinite(row.value) || !Number.isSafeInteger(row.year)) {
      throw new Error(`Invalid country metric: ${key}`);
    }
  }

  if (!options.dryRun && !options.history) {
    throw new Error(
      "Country metric writes require a named Atlas release history context",
    );
  }
  if (!options.dryRun) {
    const writer = options.writeMetric ?? upsertCountryMetricWithHistory;
    for (const row of rows) {
      await writer(database, row, options.history!);
    }
  }

  if (options.stampFreshness !== false) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.sourceId, (counts.get(row.sourceId) ?? 0) + 1);
    }
    for (const [sourceId, count] of counts) {
      await (options.markSynced ?? markSourcesSynced)(sourceId, {
        rowsWritten: count,
        dryRun: options.dryRun,
      });
    }
  }
  return { proposed: rows.length, written: options.dryRun ? 0 : rows.length };
}
