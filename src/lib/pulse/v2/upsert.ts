/**
 * Phase 5.5 — atomic Pulse v2 staging publish.
 *
 * Every fetched connector batch is validated and identity-sealed before the
 * first database write. New raw events, duplicate-candidate evidence, source
 * freshness, and (for the scheduled production run) pipeline completion are
 * then committed by one PostgreSQL data-modifying CTE statement. A failure in
 * any later CTE rolls the earlier writes back with it.
 */

import { createHash, randomUUID } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import { markSourcesSyncedFromInsertedRowsCte } from "@/lib/db/source-freshness";
import type * as schema from "@/lib/db/schema";
import { buildPulseEvidenceIdentity } from "./evidence-identity";
import { PULSE_RUNTIME_METHOD_VERSION } from "./runtime-contract";
import type { RawEventInput } from "./types";

type Db = NeonHttpDatabase<typeof schema>;
type AtomicExecutor = Pick<Db, "execute">;

export type RawEventWriteOutcome = "inserted" | "duplicate";

export interface UpsertResult {
  inserted: number;
  /** Rows skipped because the retained source identity already exists. */
  skippedDuplicate: number;
  /** Source IDs stamped by the same atomic statement. */
  sourcesStamped: string[];
  /** One outcome per input row, in the original order. */
  rowOutcomes: RawEventWriteOutcome[];
}

export interface UpsertRawEventsOptions {
  /** Connector id parallel to each input row; used for persisted run counts. */
  connectorIds?: readonly string[];
  /**
   * When present, completion of this already-started run is part of the same
   * atomic statement. A missing/non-running run fails the entire publish.
   */
  finalizeRun?: {
    counts: Record<string, number>;
  };
  /** Deterministic fixture seam and shared commit/freshness timestamp. */
  committedAt?: Date;
}

interface PreparedRawEvent {
  ordinal: number;
  connectorId: string;
  rawEventId: string;
  sourceId: string;
  externalId: string | null;
  sourceUrl: string;
  sourceType: RawEventInput["sourceType"];
  jurisdictionId: string | null;
  rawCountryName: string | null;
  eventDate: string | null;
  title: string;
  body: string | null;
  raw: Record<string, unknown>;
  retrievedAt: string;
  evidenceIdentityKey: string;
  evidenceContentHash: string;
  evidenceLanguage: string;
  evidencePublisher: unknown;
  evidenceAttribution: unknown;
  evidenceRights: unknown;
  evidenceRetention: unknown;
  duplicateOutcomeKey: string;
  reasonCode: "source_external_id_duplicate" | "source_url_duplicate";
  reason: string;
  occurredAt: string;
}

const DUPLICATE_REASON = {
  external: {
    reasonCode: "source_external_id_duplicate" as const,
    reason:
      "The source and external identifier already resolve to a retained raw item.",
  },
  url: {
    reasonCode: "source_url_duplicate" as const,
    reason:
      "The source and canonical URL already resolve to a retained raw item.",
  },
};

export function rawEventInputErrors(row: RawEventInput): string[] {
  const errors: string[] = [];
  if (!row.sourceId.trim()) errors.push("sourceId is required");
  if (row.sourceType !== "specialist" && row.sourceType !== "news") {
    errors.push("sourceType must be specialist or news");
  }
  if (!row.title.trim()) errors.push("title is required");
  if (!row.sourceUrl?.trim()) {
    errors.push(
      "sourceUrl is required for evidence identity and idempotent ingestion",
    );
  } else {
    try {
      const url = new URL(row.sourceUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.push("sourceUrl must use http or https");
      }
    } catch {
      errors.push("sourceUrl must be an absolute URL");
    }
  }
  if (row.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.eventDate)) {
    errors.push("eventDate must use YYYY-MM-DD");
  }
  if (!row.raw || typeof row.raw !== "object" || Array.isArray(row.raw)) {
    errors.push("raw must be a JSON object");
  }
  return errors;
}

function duplicateOutcomeKey(
  ingestRunId: string,
  ordinal: number,
  evidenceIdentityKey: string,
): string {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: "pulse-ingest-duplicate-outcome-key/v1",
        ingestRunId,
        ordinal,
        evidenceIdentityKey,
      }),
    )
    .digest("hex");
  return `pulse-candidate-outcome/sha256:${digest}`;
}

function prepareRows(
  rows: readonly RawEventInput[],
  connectorIds: readonly string[],
  ingestRunId: string,
): PreparedRawEvent[] {
  return rows.map((original, index) => {
    const externalId = original.externalId?.trim() || null;
    const row = { ...original, externalId };
    const retrievedAt = new Date();
    const identity = buildPulseEvidenceIdentity(row, retrievedAt);
    const duplicateReason = externalId
      ? DUPLICATE_REASON.external
      : DUPLICATE_REASON.url;
    return {
      ordinal: index + 1,
      connectorId: connectorIds[index],
      rawEventId: randomUUID(),
      sourceId: row.sourceId,
      externalId,
      sourceUrl: row.sourceUrl!,
      sourceType: row.sourceType,
      jurisdictionId: row.jurisdictionId ?? null,
      rawCountryName: row.rawCountryName ?? null,
      eventDate: row.eventDate ?? null,
      title: row.title,
      body: row.body ?? null,
      raw: row.raw,
      retrievedAt: retrievedAt.toISOString(),
      evidenceIdentityKey: identity.evidenceIdentityKey,
      evidenceContentHash: identity.evidenceContentHash,
      evidenceLanguage: identity.evidenceLanguage,
      evidencePublisher: identity.evidencePublisher,
      evidenceAttribution: identity.evidenceAttribution,
      evidenceRights: identity.evidenceRights,
      evidenceRetention: identity.evidenceRetention,
      duplicateOutcomeKey: duplicateOutcomeKey(
        ingestRunId,
        index,
        identity.evidenceIdentityKey,
      ),
      ...duplicateReason,
      occurredAt: retrievedAt.toISOString(),
    };
  });
}

/**
 * SQL half of `persistPulseCandidateOutcomes`: duplicate evidence is inserted
 * from the canonical rows selected by the same statement that inserts new raw
 * events. `canonicalCandidateId` and `occurredAt` therefore cannot drift from
 * the retained row or commit on their own.
 */
function persistPulseCandidateOutcomesAtomically(ingestRunId: string): SQL {
  return sql`duplicate_outcomes AS (
    INSERT INTO pulse_candidate_outcomes (
      schema_version,
      outcome_key,
      candidate_kind,
      candidate_id,
      outcome,
      reason_code,
      reason,
      actor,
      method_version,
      stage_run_id,
      decision_key,
      canonical_candidate_id,
      evidence_refs,
      metadata,
      occurred_at
    )
    SELECT
      'pulse-candidate-outcome/v1',
      candidate."duplicateOutcomeKey",
      'raw_item',
      candidate."evidenceIdentityKey",
      'duplicate',
      candidate."reasonCode",
      candidate.reason,
      jsonb_build_object(
        'type', 'classifier',
        'provider', 'civica',
        'model', 'ingest-deduplicator',
        'reviewerId', NULL
      ),
      ${PULSE_RUNTIME_METHOD_VERSION},
      ${ingestRunId},
      NULL,
      candidate."canonicalCandidateId",
      ARRAY[
        candidate."evidenceIdentityKey",
        'raw-event:' || candidate."canonicalRowId"::text
      ]::text[],
      CASE
        WHEN candidate."externalId" IS NOT NULL THEN
          jsonb_build_object(
            'sourceId', candidate."sourceId",
            'externalId', candidate."externalId"
          )
        ELSE
          jsonb_build_object(
            'sourceId', candidate."sourceId",
            'sourceUrl', candidate."sourceUrl"
          )
      END,
      candidate."occurredAt"
    FROM canonicalized_rows candidate
    WHERE candidate.row_outcome = 'duplicate'
    ON CONFLICT (outcome_key) DO NOTHING
    RETURNING id
  )`;
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed;
  }
  return [];
}

function parseTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (
    typeof value === "string" &&
    value.startsWith("{") &&
    value.endsWith("}")
  ) {
    return value.slice(1, -1).split(",").filter(Boolean);
  }
  return [];
}

/**
 * Atomically insert raw events, retain duplicate evidence, stamp only sources
 * that gained a raw row, and optionally finalize the scheduled pipeline run.
 */
export async function upsertRawEvents(
  db: AtomicExecutor,
  rows: RawEventInput[],
  ingestRunId: string,
  options: UpsertRawEventsOptions = {},
): Promise<UpsertResult> {
  if (!ingestRunId.trim()) throw new Error("ingestRunId is required");
  if (rows.length === 0 && !options.finalizeRun) {
    return {
      inserted: 0,
      skippedDuplicate: 0,
      sourcesStamped: [],
      rowOutcomes: [],
    };
  }

  for (const [index, row] of rows.entries()) {
    const errors = rawEventInputErrors(row);
    if (errors.length) {
      throw new Error(
        `Invalid raw event at index ${index}: ${errors.join("; ")}`,
      );
    }
  }

  const connectorIds = options.connectorIds ?? rows.map((row) => row.sourceId);
  if (connectorIds.length !== rows.length) {
    throw new Error("connectorIds must contain one id per raw event");
  }
  for (const connectorId of connectorIds) {
    if (!/^[a-z0-9_-]+$/.test(connectorId)) {
      throw new Error(`Invalid Pulse connector id: ${connectorId}`);
    }
  }
  for (const value of Object.values(options.finalizeRun?.counts ?? {})) {
    if (!Number.isFinite(value)) {
      throw new Error("pipeline run counts must be finite numbers");
    }
  }

  const committedAt = options.committedAt ?? new Date();
  if (!Number.isFinite(committedAt.getTime())) {
    throw new RangeError("Pulse ingest commit timestamp is invalid");
  }
  const prepared = prepareRows(rows, connectorIds, ingestRunId);
  const duplicateOutcomeCte =
    persistPulseCandidateOutcomesAtomically(ingestRunId);
  const freshnessCte = markSourcesSyncedFromInsertedRowsCte(committedAt);
  const requiresFinalization = options.finalizeRun !== undefined;
  const baseCounts = JSON.stringify(options.finalizeRun?.counts ?? {});

  const result = await db.execute(sql`
    WITH input_rows AS (
      SELECT *
      FROM jsonb_to_recordset(${JSON.stringify(prepared)}::jsonb) AS input(
        ordinal integer,
        "connectorId" text,
        "rawEventId" uuid,
        "sourceId" text,
        "externalId" text,
        "sourceUrl" text,
        "sourceType" text,
        "jurisdictionId" uuid,
        "rawCountryName" text,
        "eventDate" date,
        title text,
        body text,
        raw jsonb,
        "retrievedAt" timestamp,
        "evidenceIdentityKey" text,
        "evidenceContentHash" text,
        "evidenceLanguage" text,
        "evidencePublisher" jsonb,
        "evidenceAttribution" jsonb,
        "evidenceRights" jsonb,
        "evidenceRetention" jsonb,
        "duplicateOutcomeKey" text,
        "reasonCode" text,
        reason text,
        "occurredAt" timestamp
      )
    ), ranked_rows AS (
      SELECT
        input.*,
        row_number() OVER (
          PARTITION BY
            input."sourceId",
            CASE
              WHEN input."externalId" IS NOT NULL
                THEN 'external:' || input."externalId"
              ELSE 'url:' || input."sourceUrl"
            END
          ORDER BY input.ordinal
        ) AS input_position
      FROM input_rows input
    ), resolved_rows AS (
      SELECT
        input.*,
        existing.id AS existing_row_id,
        existing.evidence_identity_key AS existing_evidence_identity_key
      FROM ranked_rows input
      LEFT JOIN LATERAL (
        SELECT retained.id, retained.evidence_identity_key
        FROM raw_events retained
        WHERE retained.source_id = input."sourceId"
          AND (
            (
              input."externalId" IS NOT NULL
              AND retained.external_id = input."externalId"
            ) OR (
              input."externalId" IS NULL
              AND retained.source_url = input."sourceUrl"
            )
          )
        ORDER BY retained.retrieved_at, retained.id
        LIMIT 1
      ) existing ON TRUE
    ), inserted_raw_events AS (
      INSERT INTO raw_events (
        id,
        source_id,
        external_id,
        source_url,
        source_type,
        jurisdiction_id,
        raw_country_name,
        event_date,
        retrieved_at,
        title,
        body,
        raw,
        evidence_identity_key,
        evidence_content_hash,
        evidence_language,
        evidence_publisher,
        evidence_attribution,
        evidence_rights,
        evidence_retention,
        ingest_run_id
      )
      SELECT
        input."rawEventId",
        input."sourceId",
        input."externalId",
        input."sourceUrl",
        input."sourceType",
        input."jurisdictionId",
        input."rawCountryName",
        input."eventDate",
        input."retrievedAt",
        input.title,
        input.body,
        input.raw,
        input."evidenceIdentityKey",
        input."evidenceContentHash",
        input."evidenceLanguage",
        input."evidencePublisher",
        input."evidenceAttribution",
        input."evidenceRights",
        input."evidenceRetention",
        ${ingestRunId}
      FROM resolved_rows input
      WHERE input.existing_row_id IS NULL
        AND input.input_position = 1
      ON CONFLICT (source_id, external_id)
        WHERE external_id IS NOT NULL
        DO NOTHING
      RETURNING
        id,
        source_id,
        external_id,
        source_url,
        evidence_identity_key
    ), canonicalized_rows AS (
      SELECT
        input.*,
        COALESCE(
          input.existing_row_id,
          inserted.id
        ) AS "canonicalRowId",
        COALESCE(
          input.existing_evidence_identity_key,
          inserted.evidence_identity_key
        ) AS "canonicalCandidateId",
        CASE
          WHEN input.existing_row_id IS NOT NULL OR input.input_position > 1
            THEN 'duplicate'
          WHEN inserted.id IS NOT NULL AND input.input_position = 1
            THEN 'inserted'
          ELSE 'unresolved'
        END AS row_outcome
      FROM resolved_rows input
      LEFT JOIN inserted_raw_events inserted
        ON inserted.source_id = input."sourceId"
        AND (
          (
            input."externalId" IS NOT NULL
            AND inserted.external_id = input."externalId"
          ) OR (
            input."externalId" IS NULL
            AND inserted.source_url = input."sourceUrl"
          )
        )
    ), unresolved_rows AS (
      SELECT ordinal
      FROM canonicalized_rows
      WHERE row_outcome = 'unresolved'
    ), ${duplicateOutcomeCte}, inserted_source_rows AS (
      SELECT DISTINCT source_id
      FROM inserted_raw_events
    ), ${freshnessCte}, row_outcomes AS (
      SELECT ordinal, "connectorId", row_outcome
      FROM canonicalized_rows
      WHERE row_outcome IN ('inserted', 'duplicate')
    ), connector_metrics AS (
      SELECT COALESCE(jsonb_object_agg(metric, value), '{}'::jsonb) AS values
      FROM (
        SELECT
          'connector.' || "connectorId" || '.inserted' AS metric,
          count(*) FILTER (WHERE row_outcome = 'inserted')::integer AS value
        FROM row_outcomes
        GROUP BY "connectorId"
        UNION ALL
        SELECT
          'connector.' || "connectorId" || '.skippedDuplicate' AS metric,
          count(*) FILTER (WHERE row_outcome = 'duplicate')::integer AS value
        FROM row_outcomes
        GROUP BY "connectorId"
      ) metrics
    ), finalized_run AS (
      UPDATE pulse_pipeline_runs run
      SET
        status = 'completed',
        counts = ${baseCounts}::jsonb
          || jsonb_build_object(
            'inserted', (
              SELECT count(*)::integer
              FROM row_outcomes
              WHERE row_outcome = 'inserted'
            ),
            'skipped', (
              SELECT count(*)::integer
              FROM row_outcomes
              WHERE row_outcome = 'duplicate'
            )
          )
          || (SELECT values FROM connector_metrics),
        failures = '[]'::jsonb,
        completed_at = ${committedAt}
      WHERE run.id = ${ingestRunId}
        AND run.status = 'running'
        AND ${requiresFinalization}
      RETURNING run.id
    ), atomic_guard AS (
      SELECT 1 / CASE
        WHEN NOT EXISTS (SELECT 1 FROM unresolved_rows)
          AND (
            NOT ${requiresFinalization}
            OR EXISTS (SELECT 1 FROM finalized_run)
          )
          THEN 1
        ELSE 0
      END AS ok
    )
    SELECT
      (
        SELECT count(*)::integer
        FROM row_outcomes
        WHERE row_outcome = 'inserted'
      ) AS inserted,
      (
        SELECT count(*)::integer
        FROM row_outcomes
        WHERE row_outcome = 'duplicate'
      ) AS skipped_duplicate,
      (
        SELECT COALESCE(
          jsonb_agg(row_outcome ORDER BY ordinal),
          '[]'::jsonb
        )
        FROM row_outcomes
      ) AS row_outcomes,
      COALESCE(
        ARRAY(SELECT id FROM stamped_sources ORDER BY id),
        ARRAY[]::text[]
      ) AS sources_stamped,
      (SELECT ok FROM atomic_guard) AS guard_ok
  `);

  const resultRows = ((result as unknown as { rows?: unknown[] }).rows ??
    result) as Array<Record<string, unknown>>;
  const summary = resultRows[0] ?? {};
  const rowOutcomes = parseJsonArray(summary.row_outcomes).filter(
    (value): value is RawEventWriteOutcome =>
      value === "inserted" || value === "duplicate",
  );

  return {
    inserted: Number(summary.inserted ?? 0),
    skippedDuplicate: Number(summary.skipped_duplicate ?? 0),
    sourcesStamped: parseTextArray(summary.sources_stamped),
    rowOutcomes,
  };
}
