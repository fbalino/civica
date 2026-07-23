import { sql } from "drizzle-orm";

import {
  validateAtlasChangeDescriptor,
  type AtlasChangeDescriptor,
} from "@/lib/atlas/change-history-writer";
import {
  CONSTITUTION_PASSAGE_LANGUAGE,
  CONSTITUTION_PASSAGE_LANGUAGE_BASIS,
  CONSTITUTION_PASSAGE_SCHEMA_VERSION,
  CONSTITUTION_PASSAGE_TRANSLATION_STATUS,
  CONSTITUTION_SEARCH_INDEX_VERSION,
  constituteDocumentUrl,
  constituteRetrievalUrl,
  prepareConstitutionPassages,
  type ConstitutionPassageSourceArticle,
} from "@/lib/constitution/passage-index";
import type { CivicaDb } from "@/lib/db";
import { resolveAtlasReleaseId } from "@/lib/factbook/country-fact-history-writer";

const CONSTITUTE_SOURCE_ID = "constitute_project";
const PASSAGE_DATABASE_ID_PATTERN =
  /^constitution-passage\/sha256:[a-f0-9]{64}$/;
const PASSAGE_DATABASE_ID_PREFIX = "constitution-passage/";

export type ConstitutionPassageHistoryContext = Omit<
  AtlasChangeDescriptor,
  "operation"
>;

export interface ConstitutionPassageProjectionInput {
  constitutionId: string;
  jurisdictionId: string;
  sourceDocumentId: string;
  retrievedAt: Date;
  articles: readonly ConstitutionPassageSourceArticle[];
  history: ConstitutionPassageHistoryContext;
}

export interface ConstitutionPassageProjectionResult {
  current: number;
  written: number;
  superseded: number;
}

interface ConstitutionPassageStatementRow {
  passage_id: string;
  schema_version: string;
  search_index_version: string;
  constitution_id: string;
  jurisdiction_id: string;
  source_document_id: string;
  source_section_id: string;
  section_order: number;
  anchor_id: string;
  heading_label: string | null;
  topic_keys: string[];
  plain_text: string;
  content_sha256: string;
  language_code: string;
  language_basis: string;
  translation_status: string;
  original_language_code: null;
  translator: null;
  source_id: string;
  source_url: string;
  retrieval_url: string;
  retrieved_at: string;
  is_current: true;
  superseded_at: null;
}

export function constitutionPassagePublicId(databaseId: string): string {
  if (!PASSAGE_DATABASE_ID_PATTERN.test(databaseId)) {
    throw new Error("Constitution passage history requires a digest-bound DB key");
  }
  return databaseId.slice(PASSAGE_DATABASE_ID_PREFIX.length);
}

export function routineConstitutionPassageHistory(
  releaseId?: string | null,
): ConstitutionPassageHistoryContext {
  return {
    changeKind: "routine_refresh",
    reason: "Constitute Project constitution-passage source refresh",
    methodologyVersion: "constitution-passage-index/v1",
    releaseId: resolveAtlasReleaseId(releaseId),
  };
}

export function prepareConstitutionPassageStatementRows(
  input: Omit<ConstitutionPassageProjectionInput, "history">,
): ConstitutionPassageStatementRow[] {
  if (!input.constitutionId || !input.jurisdictionId) {
    throw new Error(
      "Constitution passage history requires constitution and jurisdiction IDs",
    );
  }
  if (!input.sourceDocumentId.trim()) {
    throw new Error(
      "Constitution passage history requires a source document identity",
    );
  }
  if (Number.isNaN(input.retrievedAt.getTime())) {
    throw new Error("Constitution passage history requires a valid retrieval time");
  }

  const sourceDocumentId = input.sourceDocumentId.trim();
  const sourceUrl = constituteDocumentUrl(sourceDocumentId);
  const retrievalUrl = constituteRetrievalUrl(sourceDocumentId);
  return prepareConstitutionPassages(sourceDocumentId, input.articles).map(
    (passage) => {
      constitutionPassagePublicId(passage.passageId);
      return {
        passage_id: passage.passageId,
        schema_version: CONSTITUTION_PASSAGE_SCHEMA_VERSION,
        search_index_version: CONSTITUTION_SEARCH_INDEX_VERSION,
        constitution_id: input.constitutionId,
        jurisdiction_id: input.jurisdictionId,
        source_document_id: sourceDocumentId,
        source_section_id: passage.sourceSectionId,
        section_order: passage.sectionOrder,
        anchor_id: passage.anchorId,
        heading_label: passage.headingLabel,
        topic_keys: passage.topicKeys,
        plain_text: passage.plainText,
        content_sha256: passage.contentSha256,
        language_code: CONSTITUTION_PASSAGE_LANGUAGE,
        language_basis: CONSTITUTION_PASSAGE_LANGUAGE_BASIS,
        translation_status: CONSTITUTION_PASSAGE_TRANSLATION_STATUS,
        original_language_code: null,
        translator: null,
        source_id: CONSTITUTE_SOURCE_ID,
        source_url: sourceUrl,
        retrieval_url: retrievalUrl,
        retrieved_at: input.retrievedAt.toISOString(),
        is_current: true,
        superseded_at: null,
      };
    },
  );
}

/**
 * Neon HTTP cannot hold an interactive transaction. This one PostgreSQL
 * statement is therefore the complete projection-and-public-history unit:
 *
 * - an advisory lock serializes even an initially empty constitution;
 * - current and possible reactivation rows are captured before mutation;
 * - removed current IDs are superseded before desired IDs are upserted; and
 * - every event-producing public change is appended from bounded columns.
 *
 * `retrieved_at` is refreshed on a rerun but is intentionally absent from the
 * public diff, so retrieval-only refreshes do not manufacture history.
 */
export function buildConstitutionPassageHistoryStatement(
  input: ConstitutionPassageProjectionInput,
) {
  const rows = prepareConstitutionPassageStatementRows(input);
  const descriptor = validateAtlasChangeDescriptor({
    ...input.history,
    operation: "update",
  });
  const rowsJson = JSON.stringify(rows);
  const lockKey = `constitution-passages\u001f${input.constitutionId}`;

  return sql`
    WITH lock_row AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    ),
    desired_rows AS MATERIALIZED (
      SELECT desired.*
      FROM jsonb_to_recordset(${rowsJson}::jsonb) AS desired(
        passage_id text,
        schema_version text,
        search_index_version text,
        constitution_id uuid,
        jurisdiction_id uuid,
        source_document_id text,
        source_section_id text,
        section_order integer,
        anchor_id text,
        heading_label text,
        topic_keys jsonb,
        plain_text text,
        content_sha256 text,
        language_code text,
        language_basis text,
        translation_status text,
        original_language_code text,
        translator text,
        source_id text,
        source_url text,
        retrieval_url text,
        retrieved_at timestamp,
        is_current boolean,
        superseded_at timestamp
      )
    ),
    locked_rows AS MATERIALIZED (
      SELECT cp.*
      FROM constitution_passages cp
      CROSS JOIN lock_row
      WHERE cp.constitution_id = ${input.constitutionId}::uuid
        OR cp.passage_id IN (
          SELECT desired.passage_id
          FROM desired_rows desired
        )
      FOR UPDATE OF cp
    ),
    current_rows AS MATERIALIZED (
      SELECT *
      FROM locked_rows
      WHERE constitution_id = ${input.constitutionId}::uuid
        AND is_current = true
    ),
    desired_before_rows AS MATERIALIZED (
      SELECT before_row.*
      FROM locked_rows before_row
      INNER JOIN desired_rows desired
        ON desired.passage_id = before_row.passage_id
    ),
    captured_rows AS MATERIALIZED (
      SELECT
        (SELECT count(*) FROM current_rows) AS current_count,
        (SELECT count(*) FROM desired_before_rows) AS desired_before_count
    ),
    superseded AS (
      UPDATE constitution_passages cp
      SET
        is_current = false,
        superseded_at = ${input.retrievedAt}
      FROM current_rows before_row
      CROSS JOIN captured_rows
      WHERE cp.passage_id = before_row.passage_id
        AND NOT EXISTS (
          SELECT 1
          FROM desired_rows desired
          WHERE desired.passage_id = before_row.passage_id
        )
      RETURNING cp.*
    ),
    superseded_payload AS MATERIALIZED (
      SELECT
        regexp_replace(
          after_row.passage_id,
          '^constitution-passage/',
          ''
        ) AS entity_id,
        'update'::text AS operation,
        jsonb_build_array(
          jsonb_build_object(
            'field',
            'is_current',
            'before',
            true,
            'after',
            false
          )
        ) AS changes
      FROM superseded after_row
    ),
    superseded_barrier AS MATERIALIZED (
      SELECT count(*) AS superseded_count
      FROM superseded
    ),
    upserted AS (
      INSERT INTO constitution_passages (
        passage_id,
        schema_version,
        search_index_version,
        constitution_id,
        jurisdiction_id,
        source_document_id,
        source_section_id,
        section_order,
        anchor_id,
        heading_label,
        topic_keys,
        plain_text,
        content_sha256,
        language_code,
        language_basis,
        translation_status,
        original_language_code,
        translator,
        source_id,
        source_url,
        retrieval_url,
        retrieved_at,
        is_current,
        superseded_at
      )
      SELECT
        desired.passage_id,
        desired.schema_version,
        desired.search_index_version,
        desired.constitution_id,
        desired.jurisdiction_id,
        desired.source_document_id,
        desired.source_section_id,
        desired.section_order,
        desired.anchor_id,
        desired.heading_label,
        desired.topic_keys,
        desired.plain_text,
        desired.content_sha256,
        desired.language_code,
        desired.language_basis,
        desired.translation_status,
        desired.original_language_code,
        desired.translator,
        desired.source_id,
        desired.source_url,
        desired.retrieval_url,
        desired.retrieved_at,
        true,
        NULL
      FROM desired_rows desired
      CROSS JOIN superseded_barrier
      ON CONFLICT (passage_id) DO UPDATE SET
        schema_version = EXCLUDED.schema_version,
        search_index_version = EXCLUDED.search_index_version,
        constitution_id = EXCLUDED.constitution_id,
        jurisdiction_id = EXCLUDED.jurisdiction_id,
        source_document_id = EXCLUDED.source_document_id,
        source_section_id = EXCLUDED.source_section_id,
        section_order = EXCLUDED.section_order,
        anchor_id = EXCLUDED.anchor_id,
        heading_label = EXCLUDED.heading_label,
        topic_keys = EXCLUDED.topic_keys,
        plain_text = EXCLUDED.plain_text,
        content_sha256 = EXCLUDED.content_sha256,
        language_code = EXCLUDED.language_code,
        language_basis = EXCLUDED.language_basis,
        translation_status = EXCLUDED.translation_status,
        original_language_code = EXCLUDED.original_language_code,
        translator = EXCLUDED.translator,
        source_id = EXCLUDED.source_id,
        source_url = EXCLUDED.source_url,
        retrieval_url = EXCLUDED.retrieval_url,
        retrieved_at = EXCLUDED.retrieved_at,
        is_current = true,
        superseded_at = NULL
      RETURNING *
    ),
    desired_payload AS MATERIALIZED (
      SELECT
        regexp_replace(
          after_row.passage_id,
          '^constitution-passage/',
          ''
        ) AS entity_id,
        CASE
          WHEN before_row.passage_id IS NULL THEN 'insert'
          ELSE 'update'
        END AS operation,
        (
          CASE
            WHEN before_row.heading_label IS DISTINCT FROM after_row.heading_label
              THEN jsonb_build_array(jsonb_build_object(
                'field', 'heading_label',
                'before', before_row.heading_label,
                'after', after_row.heading_label
              ))
            ELSE '[]'::jsonb
          END
          ||
          CASE
            WHEN before_row.plain_text IS DISTINCT FROM after_row.plain_text
              THEN jsonb_build_array(jsonb_build_object(
                'field', 'plain_text',
                'before', before_row.plain_text,
                'after', after_row.plain_text
              ))
            ELSE '[]'::jsonb
          END
          ||
          CASE
            WHEN before_row.source_id IS DISTINCT FROM after_row.source_id
              THEN jsonb_build_array(jsonb_build_object(
                'field', 'source_id',
                'before', before_row.source_id,
                'after', after_row.source_id
              ))
            ELSE '[]'::jsonb
          END
          ||
          CASE
            WHEN before_row.source_url IS DISTINCT FROM after_row.source_url
              THEN jsonb_build_array(jsonb_build_object(
                'field', 'source_url',
                'before', before_row.source_url,
                'after', after_row.source_url
              ))
            ELSE '[]'::jsonb
          END
          ||
          CASE
            WHEN before_row.language_code IS DISTINCT FROM after_row.language_code
              THEN jsonb_build_array(jsonb_build_object(
                'field', 'language_code',
                'before', before_row.language_code,
                'after', after_row.language_code
              ))
            ELSE '[]'::jsonb
          END
          ||
          CASE
            WHEN before_row.translation_status IS DISTINCT FROM after_row.translation_status
              THEN jsonb_build_array(jsonb_build_object(
                'field', 'translation_status',
                'before', before_row.translation_status,
                'after', after_row.translation_status
              ))
            ELSE '[]'::jsonb
          END
          ||
          CASE
            WHEN before_row.is_current IS DISTINCT FROM after_row.is_current
              THEN jsonb_build_array(jsonb_build_object(
                'field', 'is_current',
                'before', before_row.is_current,
                'after', after_row.is_current
              ))
            ELSE '[]'::jsonb
          END
        ) AS changes
      FROM upserted after_row
      LEFT JOIN desired_before_rows before_row
        ON before_row.passage_id = after_row.passage_id
    ),
    history_payload AS MATERIALIZED (
      SELECT entity_id, operation, changes
      FROM superseded_payload
      UNION ALL
      SELECT entity_id, operation, changes
      FROM desired_payload
      WHERE jsonb_array_length(changes) > 0
    ),
    history_events AS (
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
        'constitution-passage',
        payload.entity_id,
        'constitution_passages',
        payload.operation,
        ${descriptor.changeKind},
        payload.changes,
        ${descriptor.reason},
        ${descriptor.methodologyVersion},
        ${descriptor.releaseId},
        ${descriptor.correctionLogId}::uuid,
        ${descriptor.correctionStatus}
      FROM history_payload payload
      RETURNING id
    )
    SELECT
      (SELECT count(*)::integer FROM desired_rows) AS current,
      (
        SELECT count(*)::integer
        FROM desired_payload
        WHERE jsonb_array_length(changes) > 0
      ) AS written,
      (SELECT superseded_count::integer FROM superseded_barrier) AS superseded,
      (SELECT count(*)::integer FROM history_events) AS history_written
  `;
}

export async function replaceConstitutionPassageProjectionWithHistory(
  database: Pick<CivicaDb, "execute">,
  input: ConstitutionPassageProjectionInput,
): Promise<ConstitutionPassageProjectionResult> {
  const result = await database.execute(
    buildConstitutionPassageHistoryStatement(input),
  );
  const rows = (
    Array.isArray(result)
      ? result
      : ((result as unknown as { rows?: Record<string, unknown>[] }).rows ?? [])
  ) as Record<string, unknown>[];
  const summary = rows[0] ?? {};
  const current = Number(summary.current ?? 0);
  const written = Number(summary.written ?? 0);
  const superseded = Number(summary.superseded ?? 0);
  const historyWritten = Number(summary.history_written ?? 0);
  if (historyWritten !== written + superseded) {
    throw new Error(
      "Constitution passage projection history append was incomplete",
    );
  }
  return { current, written, superseded };
}
