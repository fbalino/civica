import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import {
  validateAtlasChangeDescriptor,
  type AtlasChangeDescriptor,
} from "@/lib/atlas/change-history-writer";
import type { CivicaDb } from "@/lib/db";
import { countryFacts } from "@/lib/db/schema";

export type CountryFactInsert = typeof countryFacts.$inferInsert;
export type CountryFactHistoryContext = Omit<
  AtlasChangeDescriptor,
  "operation"
>;

export interface CountryFactHistoryWrite {
  values: CountryFactInsert;
  history: CountryFactHistoryContext;
  /**
   * Source refreshes preserve reviewer-demoted status by default. The frozen
   * CIA seed owns numeric-envelope lifecycle state and opts out explicitly.
   */
  preserveReviewStatus?: boolean;
}

export interface CountryFactDemotionHistoryWrite {
  factId: string;
  statusReason: string;
  history: CountryFactHistoryContext;
}

export type CountryFactHistoryWriter = (
  database: Pick<CivicaDb, "execute">,
  input: CountryFactHistoryWrite,
) => Promise<void>;

export function resolveAtlasReleaseId(explicit?: string | null): string {
  const releaseId =
    explicit?.trim() || process.env.CIVICA_ATLAS_RELEASE_ID?.trim() || "";
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(releaseId)) {
    throw new Error(
      "A named Atlas release is required: pass atlasReleaseId or set CIVICA_ATLAS_RELEASE_ID.",
    );
  }
  return releaseId;
}

export function routineCountryFactHistory(
  values: Pick<
    CountryFactInsert,
    "sourceId" | "methodologyVersion"
  >,
  releaseId: string,
): CountryFactHistoryContext {
  const sourceId = values.sourceId?.trim() || "cia_factbook";
  return {
    changeKind: "routine_refresh",
    reason: `${sourceId} country-fact source refresh`,
    methodologyVersion:
      values.methodologyVersion?.trim() || "fact-reconciliation/v0.2-beta",
    releaseId,
  };
}

/**
 * One PostgreSQL statement serializes a fact's natural key, captures its old
 * row, upserts the current source observation, and appends the bounded public
 * history event. Neon HTTP has no interactive transactions, so the CTE is the
 * transaction boundary.
 *
 * `before_row` must read the statement snapshot WITHOUT `FOR UPDATE`: a
 * locking scan follows the tuple's update chain and silently skips a row this
 * same statement's `ON CONFLICT DO UPDATE` already modified, so the before
 * snapshot comes back empty and the event misreports an update as an insert
 * with null befores. Write serialization is owned by the advisory lock alone.
 */
export function buildCountryFactHistoryStatement(
  input: CountryFactHistoryWrite,
  proposedId = input.values.id ?? randomUUID(),
) {
  const values = normalizeCountryFactInsert(input.values);
  const descriptor = validateAtlasChangeDescriptor({
    ...input.history,
    operation: "update",
  });
  const preserveReviewStatus = input.preserveReviewStatus !== false;
  const reviewStatusUpdate = preserveReviewStatus
    ? sql``
    : sql`,
        status = EXCLUDED.status,
        status_reason = EXCLUDED.status_reason`;
  const referencesJson =
    values.references === null ? null : JSON.stringify(values.references);
  const valueJson =
    values.valueJson === null ? null : JSON.stringify(values.valueJson);
  const lockKey = `${values.jurisdictionId}\u001f${values.factKey}\u001f${values.sourceId}`;

  return sql`
    WITH lock_row AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    ),
    before_row AS MATERIALIZED (
      SELECT cf.*
      FROM country_facts cf
      CROSS JOIN lock_row
      WHERE cf.jurisdiction_id = ${values.jurisdictionId}::uuid
        AND cf.fact_key = ${values.factKey}
        AND cf.source_id = ${values.sourceId}
    ),
    before_marker AS (
      SELECT EXISTS (SELECT 1 FROM before_row) AS existed
    ),
    upserted AS (
      INSERT INTO country_facts (
        id,
        jurisdiction_id,
        fact_key,
        fact_group,
        category,
        source_id,
        source_url,
        wikidata_qid,
        wikidata_pid,
        wikidata_rank,
        "references",
        source_hash,
        fact_value,
        fact_value_numeric,
        fact_unit,
        fact_year,
        value_json,
        value_status,
        value_status_reason,
        as_of,
        data_vintage_year,
        retrieved_at,
        upstream_vintage_label,
        methodology_version,
        status,
        status_reason,
        snapshot_id,
        source_note,
        value_type,
        growth_methodology,
        updated_at
      )
      SELECT
        ${proposedId}::uuid,
        ${values.jurisdictionId}::uuid,
        ${values.factKey},
        ${values.factGroup},
        ${values.category},
        ${values.sourceId},
        ${values.sourceUrl},
        ${values.wikidataQid},
        ${values.wikidataPid},
        ${values.wikidataRank},
        ${referencesJson}::jsonb,
        ${values.sourceHash},
        ${values.factValue},
        ${values.factValueNumeric},
        ${values.factUnit},
        ${values.factYear},
        ${valueJson}::jsonb,
        ${values.valueStatus},
        ${values.valueStatusReason},
        ${values.asOf},
        ${values.dataVintageYear},
        ${values.retrievedAt},
        ${values.upstreamVintageLabel},
        ${values.methodologyVersion},
        ${values.status},
        ${values.statusReason},
        ${values.snapshotId}::uuid,
        ${values.sourceNote},
        ${values.valueType},
        ${values.growthMethodology},
        NOW()
      FROM before_marker
      ON CONFLICT (jurisdiction_id, fact_key, source_id) DO UPDATE SET
        fact_group = EXCLUDED.fact_group,
        category = EXCLUDED.category,
        source_url = EXCLUDED.source_url,
        wikidata_qid = EXCLUDED.wikidata_qid,
        wikidata_pid = EXCLUDED.wikidata_pid,
        wikidata_rank = EXCLUDED.wikidata_rank,
        "references" = EXCLUDED."references",
        source_hash = EXCLUDED.source_hash,
        fact_value = EXCLUDED.fact_value,
        fact_value_numeric = EXCLUDED.fact_value_numeric,
        fact_unit = EXCLUDED.fact_unit,
        fact_year = EXCLUDED.fact_year,
        value_json = EXCLUDED.value_json,
        value_status = EXCLUDED.value_status,
        value_status_reason = EXCLUDED.value_status_reason,
        as_of = EXCLUDED.as_of,
        data_vintage_year = EXCLUDED.data_vintage_year,
        retrieved_at = EXCLUDED.retrieved_at,
        upstream_vintage_label = EXCLUDED.upstream_vintage_label,
        methodology_version = EXCLUDED.methodology_version,
        snapshot_id = EXCLUDED.snapshot_id,
        source_note = EXCLUDED.source_note,
        value_type = EXCLUDED.value_type,
        growth_methodology = EXCLUDED.growth_methodology,
        updated_at = NOW()
        ${reviewStatusUpdate}
      RETURNING *
    ),
    change_payload AS (
      SELECT
        u.id,
        b.id AS before_id,
        (
          CASE WHEN b.fact_value IS DISTINCT FROM u.fact_value
            THEN jsonb_build_array(jsonb_build_object('field', 'fact_value', 'before', b.fact_value, 'after', u.fact_value))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.fact_value_numeric IS DISTINCT FROM u.fact_value_numeric
            THEN jsonb_build_array(jsonb_build_object('field', 'fact_value_numeric', 'before', b.fact_value_numeric, 'after', u.fact_value_numeric))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.fact_unit IS DISTINCT FROM u.fact_unit
            THEN jsonb_build_array(jsonb_build_object('field', 'fact_unit', 'before', b.fact_unit, 'after', u.fact_unit))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.fact_year IS DISTINCT FROM u.fact_year
            THEN jsonb_build_array(jsonb_build_object('field', 'fact_year', 'before', b.fact_year, 'after', u.fact_year))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.value_json IS DISTINCT FROM u.value_json
            THEN jsonb_build_array(jsonb_build_object('field', 'value_json', 'before', b.value_json, 'after', u.value_json))
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
          CASE WHEN b.as_of IS DISTINCT FROM u.as_of
            THEN jsonb_build_array(jsonb_build_object('field', 'as_of', 'before', b.as_of, 'after', u.as_of))
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
          CASE WHEN b.upstream_vintage_label IS DISTINCT FROM u.upstream_vintage_label
            THEN jsonb_build_array(jsonb_build_object('field', 'upstream_vintage_label', 'before', b.upstream_vintage_label, 'after', u.upstream_vintage_label))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.methodology_version IS DISTINCT FROM u.methodology_version
            THEN jsonb_build_array(jsonb_build_object('field', 'methodology_version', 'before', b.methodology_version, 'after', u.methodology_version))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.status IS DISTINCT FROM u.status
            THEN jsonb_build_array(jsonb_build_object('field', 'status', 'before', b.status, 'after', u.status))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.status_reason IS DISTINCT FROM u.status_reason
            THEN jsonb_build_array(jsonb_build_object('field', 'status_reason', 'before', b.status_reason, 'after', u.status_reason))
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
        release_id,
        correction_log_id,
        correction_status
      )
      SELECT
        'fact',
        id::text,
        'country_facts',
        CASE WHEN before_id IS NULL THEN 'insert' ELSE 'update' END,
        ${descriptor.changeKind},
        changes,
        ${descriptor.reason},
        ${descriptor.methodologyVersion},
        ${descriptor.releaseId},
        ${descriptor.correctionLogId}::uuid,
        ${descriptor.correctionStatus}
      FROM change_payload
      WHERE jsonb_array_length(changes) > 0
      RETURNING id
    )
    SELECT
      upserted.id,
      EXISTS (SELECT 1 FROM history_event) AS history_written
    FROM upserted
  `;
}

export async function upsertCountryFactWithHistory(
  database: Pick<CivicaDb, "execute">,
  input: CountryFactHistoryWrite,
): Promise<void> {
  await database.execute(buildCountryFactHistoryStatement(input));
}

export function buildCountryFactDemotionHistoryStatement(
  input: CountryFactDemotionHistoryWrite,
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.factId,
    )
  ) {
    throw new Error("Country fact demotion requires a stable fact UUID");
  }
  const statusReason = input.statusReason.trim();
  if (!statusReason) {
    throw new Error("Country fact demotion requires a public status reason");
  }
  const descriptor = validateAtlasChangeDescriptor({
    ...input.history,
    operation: "update",
  });

  return sql`
    WITH before_row AS MATERIALIZED (
      SELECT *
      FROM country_facts
      WHERE id = ${input.factId}::uuid
        AND status = 'active'
      FOR UPDATE
    ),
    updated AS (
      UPDATE country_facts
      SET
        status = 'demoted',
        status_reason = ${statusReason},
        updated_at = NOW()
      WHERE id IN (SELECT id FROM before_row)
      RETURNING *
    ),
    change_payload AS (
      SELECT
        u.id,
        (
          CASE WHEN b.status IS DISTINCT FROM u.status
            THEN jsonb_build_array(jsonb_build_object('field', 'status', 'before', b.status, 'after', u.status))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.status_reason IS DISTINCT FROM u.status_reason
            THEN jsonb_build_array(jsonb_build_object('field', 'status_reason', 'before', b.status_reason, 'after', u.status_reason))
            ELSE '[]'::jsonb END
        ) AS changes
      FROM updated u
      INNER JOIN before_row b ON b.id = u.id
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
        release_id,
        correction_log_id,
        correction_status
      )
      SELECT
        'fact',
        id::text,
        'country_facts',
        'update',
        ${descriptor.changeKind},
        changes,
        ${descriptor.reason},
        ${descriptor.methodologyVersion},
        ${descriptor.releaseId},
        ${descriptor.correctionLogId}::uuid,
        ${descriptor.correctionStatus}
      FROM change_payload
      WHERE jsonb_array_length(changes) > 0
      RETURNING id
    )
    SELECT
      count(*)::integer AS demoted_count,
      count(*) = (SELECT count(*) FROM history_event) AS history_complete
    FROM updated
  `;
}

export async function demoteCountryFactWithHistory(
  database: Pick<CivicaDb, "execute">,
  input: CountryFactDemotionHistoryWrite,
): Promise<number> {
  const result = await database.execute(
    buildCountryFactDemotionHistoryStatement(input),
  );
  const rows = (
    Array.isArray(result)
      ? result
      : ((result as unknown as { rows?: Record<string, unknown>[] }).rows ?? [])
  ) as Record<string, unknown>[];
  const summary = rows[0] ?? {};
  if (summary.history_complete === false) {
    throw new Error("Country fact demotion history append was incomplete");
  }
  return Number(summary.demoted_count ?? 0);
}

function normalizeCountryFactInsert(values: CountryFactInsert) {
  if (!values.jurisdictionId || !values.factKey || !values.category) {
    throw new Error("Country fact history upsert requires its stable natural key");
  }
  return {
    jurisdictionId: values.jurisdictionId,
    factKey: values.factKey,
    factGroup: values.factGroup ?? "B",
    category: values.category,
    sourceId: values.sourceId ?? "cia_factbook",
    sourceUrl: values.sourceUrl ?? null,
    wikidataQid: values.wikidataQid ?? null,
    wikidataPid: values.wikidataPid ?? null,
    wikidataRank: values.wikidataRank ?? null,
    references: values.references ?? null,
    sourceHash: values.sourceHash ?? null,
    factValue: values.factValue ?? null,
    factValueNumeric: values.factValueNumeric ?? null,
    factUnit: values.factUnit ?? null,
    factYear: values.factYear ?? null,
    valueJson: values.valueJson ?? null,
    valueStatus: values.valueStatus ?? "observed",
    valueStatusReason: values.valueStatusReason ?? null,
    asOf: values.asOf ?? null,
    dataVintageYear: values.dataVintageYear ?? null,
    retrievedAt: values.retrievedAt ?? new Date(),
    upstreamVintageLabel: values.upstreamVintageLabel ?? null,
    methodologyVersion: values.methodologyVersion ?? "v0.2-beta",
    status: values.status ?? "active",
    statusReason: values.statusReason ?? null,
    snapshotId: values.snapshotId ?? null,
    sourceNote: values.sourceNote ?? null,
    valueType: values.valueType ?? "measured",
    growthMethodology: values.growthMethodology ?? null,
  };
}
