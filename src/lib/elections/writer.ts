import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import {
  validateAtlasChangeDescriptor,
  type AtlasChangeDescriptor,
} from "@/lib/atlas/change-history-writer";
import type { CivicaDb } from "@/lib/db";
import { electionResults, elections } from "@/lib/db/schema";

type Db = typeof import("@/lib/db").db;
export type ElectionInput = typeof elections.$inferInsert;
export type ElectionResultInput = Omit<
  typeof electionResults.$inferInsert,
  "electionId"
>;
export type ElectionHistoryContext = Omit<
  AtlasChangeDescriptor,
  "operation"
>;

export interface ElectionProvenanceInput {
  predicate: string;
  objectValue: string;
  sourceId: string;
  sourceUrl: string;
  sourceLicense: string;
  confidence?: number;
}

interface ElectionMutationResult {
  id: string | null;
  inserted: number;
  updated: number;
  deleted: number;
  historyWritten: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function electionContestIdentityKey(input: ElectionInput) {
  if (input.wikidataQid) return `wikidata:${input.wikidataQid}`;
  return [
    "contest",
    input.jurisdictionId,
    input.bodyId ?? "unscoped",
    input.electionDate,
    input.electionType?.trim().toLowerCase(),
    input.dateConfidence ?? "unknown-basis",
  ].join("|");
}

function normalizeElection(input: ElectionInput) {
  if (!input.jurisdictionId || !input.electionDate || !input.electionType) {
    throw new Error("Malformed election fixture");
  }
  return {
    jurisdictionId: input.jurisdictionId,
    electionDate: input.electionDate,
    electionType: input.electionType.trim(),
    electionName: input.electionName ?? null,
    electoralSystem: input.electoralSystem ?? null,
    bodyId: input.bodyId ?? null,
    turnoutPercent: input.turnoutPercent ?? null,
    registeredVoters: input.registeredVoters ?? null,
    totalValidVotes: input.totalValidVotes ?? null,
    wikidataQid: input.wikidataQid?.trim() || null,
    dateConfidence: input.dateConfidence ?? null,
  };
}

function normalizeProvenance(input: ElectionProvenanceInput) {
  const predicate = input.predicate.trim();
  const sourceId = input.sourceId.trim();
  const sourceUrl = input.sourceUrl.trim();
  const sourceLicense = input.sourceLicense.trim();
  if (!predicate || !sourceId || !sourceUrl || !sourceLicense) {
    throw new Error("Election provenance is incomplete");
  }
  return {
    predicate,
    objectValue: input.objectValue,
    sourceId,
    sourceUrl,
    sourceLicense,
    confidence: input.confidence ?? 1,
  };
}

/**
 * One PostgreSQL statement serializes the election identity, locks/captures
 * the prior row, preserves its UUID, mutates the election and provenance, and
 * appends the bounded ATL-020 event.
 *
 * Non-QID elections use the retained publisher source URL as the stable
 * contest identity. This lets a publisher correct the date without forking the
 * UUID while still allowing the same chamber to hold a genuinely new election
 * under a different publisher contest URL. The legacy date/type key is used
 * only to adopt an exact pre-history row. Civica estimates use the separate
 * stable chamber-scoped helper below.
 */
export function buildElectionHistoryUpsertStatement(
  electionInput: ElectionInput,
  provenanceInput: ElectionProvenanceInput,
  history: ElectionHistoryContext,
  proposedId = electionInput.id ?? randomUUID(),
  identityMode: "source-contest" | "estimated-chamber" = "source-contest",
) {
  const election = normalizeElection(electionInput);
  const provenance = normalizeProvenance(provenanceInput);
  if (!UUID_PATTERN.test(proposedId)) {
    throw new Error("Election history upsert requires a stable proposed UUID");
  }
  const descriptor = validateAtlasChangeDescriptor({
    ...history,
    operation: "update",
  });
  const estimatedIdentity = identityMode === "estimated-chamber";
  const identityKey = estimatedIdentity
    ? `election:estimated:${election.jurisdictionId}|${election.bodyId}`
    : election.wikidataQid
      ? `election:wikidata:${election.wikidataQid}`
      : [
          "election:publisher-contest",
          provenance.sourceId,
          provenance.predicate,
          provenance.sourceUrl,
        ].join("|");
  const identityPredicate = estimatedIdentity
    ? sql`
        e.jurisdiction_id = ${election.jurisdictionId}::uuid
        AND e.body_id = ${election.bodyId}::uuid
        AND e.date_confidence = 'estimated'
      `
    : election.wikidataQid
      ? sql`e.wikidata_qid = ${election.wikidataQid}`
      : sql`
        e.jurisdiction_id = ${election.jurisdictionId}::uuid
        AND e.body_id IS NOT DISTINCT FROM ${election.bodyId}::uuid
        AND (
          EXISTS (
            SELECT 1
            FROM statements identity_statement
            WHERE identity_statement.subject_table = 'elections'
              AND identity_statement.subject_id = e.id
              AND identity_statement.predicate = ${provenance.predicate}
              AND identity_statement.source_id = ${provenance.sourceId}
              AND identity_statement.source_url = ${provenance.sourceUrl}
          )
          OR (
            e.election_date = ${election.electionDate}
            AND LOWER(e.election_type) = LOWER(${election.electionType})
            AND NOT EXISTS (
              SELECT 1
              FROM statements claimed_statement
              WHERE claimed_statement.subject_table = 'elections'
                AND claimed_statement.subject_id = e.id
                AND claimed_statement.predicate = ${provenance.predicate}
                AND claimed_statement.source_id = ${provenance.sourceId}
            )
          )
        )
      `;

  return sql`
    WITH lock_row AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${identityKey}, 0))
    ),
    before_row AS MATERIALIZED (
      SELECT e.*
      FROM elections e
      CROSS JOIN lock_row
      WHERE ${identityPredicate}
      LIMIT 1
      FOR UPDATE OF e
    ),
    before_provenance AS MATERIALIZED (
      SELECT s.source_id, s.source_url
      FROM statements s
      INNER JOIN before_row b
        ON s.subject_table = 'elections'
        AND s.subject_id = b.id
      WHERE s.predicate = ${provenance.predicate}
        AND s.source_id = ${provenance.sourceId}
      LIMIT 1
      FOR UPDATE OF s
    ),
    updated AS (
      UPDATE elections e
      SET
        jurisdiction_id = ${election.jurisdictionId}::uuid,
        election_date = ${election.electionDate},
        election_type = ${election.electionType},
        election_name = ${election.electionName},
        electoral_system = ${election.electoralSystem},
        body_id = ${election.bodyId}::uuid,
        turnout_percent = ${election.turnoutPercent},
        registered_voters = ${election.registeredVoters},
        total_valid_votes = ${election.totalValidVotes},
        wikidata_qid = ${election.wikidataQid},
        date_confidence = ${election.dateConfidence}
      WHERE e.id IN (SELECT id FROM before_row)
      RETURNING e.*
    ),
    inserted AS (
      INSERT INTO elections (
        id,
        jurisdiction_id,
        election_date,
        election_type,
        election_name,
        electoral_system,
        body_id,
        turnout_percent,
        registered_voters,
        total_valid_votes,
        wikidata_qid,
        date_confidence
      )
      SELECT
        ${proposedId}::uuid,
        ${election.jurisdictionId}::uuid,
        ${election.electionDate},
        ${election.electionType},
        ${election.electionName},
        ${election.electoralSystem},
        ${election.bodyId}::uuid,
        ${election.turnoutPercent},
        ${election.registeredVoters},
        ${election.totalValidVotes},
        ${election.wikidataQid},
        ${election.dateConfidence}
      WHERE NOT EXISTS (SELECT 1 FROM before_row)
      RETURNING *
    ),
    mutated AS (
      SELECT *, FALSE AS inserted FROM updated
      UNION ALL
      SELECT *, TRUE AS inserted FROM inserted
    ),
    provenance_write AS (
      INSERT INTO statements (
        subject_table,
        subject_id,
        predicate,
        object_value,
        source_id,
        source_url,
        source_license,
        retrieved_at,
        confidence
      )
      SELECT
        'elections',
        m.id,
        ${provenance.predicate},
        ${provenance.objectValue},
        ${provenance.sourceId},
        ${provenance.sourceUrl},
        ${provenance.sourceLicense},
        NOW(),
        ${provenance.confidence}
      FROM mutated m
      ON CONFLICT (subject_table, subject_id, predicate, source_id)
      DO UPDATE SET
        object_value = EXCLUDED.object_value,
        source_url = EXCLUDED.source_url,
        source_license = EXCLUDED.source_license,
        retrieved_at = EXCLUDED.retrieved_at,
        confidence = EXCLUDED.confidence
      RETURNING subject_id
    ),
    change_payload AS (
      SELECT
        m.id,
        m.inserted,
        (
          CASE WHEN b.election_name IS DISTINCT FROM m.election_name
            THEN jsonb_build_array(jsonb_build_object('field', 'election_name', 'before', b.election_name, 'after', m.election_name))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.election_date IS DISTINCT FROM m.election_date
            THEN jsonb_build_array(jsonb_build_object('field', 'election_date', 'before', b.election_date, 'after', m.election_date))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.election_type IS DISTINCT FROM m.election_type
            THEN jsonb_build_array(jsonb_build_object('field', 'election_type', 'before', b.election_type, 'after', m.election_type))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.electoral_system IS DISTINCT FROM m.electoral_system
            THEN jsonb_build_array(jsonb_build_object('field', 'electoral_system', 'before', b.electoral_system, 'after', m.electoral_system))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.body_id IS DISTINCT FROM m.body_id
            THEN jsonb_build_array(jsonb_build_object('field', 'body_id', 'before', b.body_id, 'after', m.body_id))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.turnout_percent IS DISTINCT FROM m.turnout_percent
            THEN jsonb_build_array(jsonb_build_object('field', 'turnout_percent', 'before', b.turnout_percent, 'after', m.turnout_percent))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.registered_voters IS DISTINCT FROM m.registered_voters
            THEN jsonb_build_array(jsonb_build_object('field', 'registered_voters', 'before', b.registered_voters, 'after', m.registered_voters))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.total_valid_votes IS DISTINCT FROM m.total_valid_votes
            THEN jsonb_build_array(jsonb_build_object('field', 'total_valid_votes', 'before', b.total_valid_votes, 'after', m.total_valid_votes))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.wikidata_qid IS DISTINCT FROM m.wikidata_qid
            THEN jsonb_build_array(jsonb_build_object('field', 'wikidata_qid', 'before', b.wikidata_qid, 'after', m.wikidata_qid))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.date_confidence IS DISTINCT FROM m.date_confidence
            THEN jsonb_build_array(jsonb_build_object('field', 'date_confidence', 'before', b.date_confidence, 'after', m.date_confidence))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN bp.source_id IS DISTINCT FROM ${provenance.sourceId}
            THEN jsonb_build_array(jsonb_build_object('field', 'source_id', 'before', bp.source_id, 'after', ${provenance.sourceId}::text))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN bp.source_url IS DISTINCT FROM ${provenance.sourceUrl}
            THEN jsonb_build_array(jsonb_build_object('field', 'source_url', 'before', bp.source_url, 'after', ${provenance.sourceUrl}::text))
            ELSE '[]'::jsonb END
        ) AS changes
      FROM mutated m
      LEFT JOIN before_row b ON b.id = m.id
      LEFT JOIN before_provenance bp ON TRUE
      CROSS JOIN provenance_write pw
      WHERE pw.subject_id = m.id
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
        'election',
        id::text,
        'elections',
        CASE WHEN inserted THEN 'insert' ELSE 'update' END,
        ${descriptor.changeKind},
        changes,
        ${descriptor.reason},
        ${descriptor.methodologyVersion},
        ${descriptor.releaseId},
        ${descriptor.correctionLogId}::uuid,
        ${descriptor.correctionStatus}::text
      FROM change_payload
      WHERE jsonb_array_length(changes) > 0
      RETURNING id
    )
    SELECT
      m.id,
      m.inserted,
      NOT m.inserted AS updated,
      EXISTS (SELECT 1 FROM history_event) AS history_written
    FROM mutated m
  `;
}

export interface ElectionTurnoutPatch {
  electionId: string;
  turnoutPercent: number;
  registeredVoters?: number | null;
  totalValidVotes?: number | null;
}

/** Atomic IDEA turnout mutation + provenance + bounded election history. */
export function buildElectionTurnoutHistoryStatement(
  patch: ElectionTurnoutPatch,
  provenanceInput: ElectionProvenanceInput,
  history: ElectionHistoryContext,
) {
  if (!UUID_PATTERN.test(patch.electionId)) {
    throw new Error("Election turnout history requires a stable election UUID");
  }
  if (!Number.isFinite(patch.turnoutPercent)) {
    throw new Error("Election turnout history requires a finite turnout");
  }
  const provenance = normalizeProvenance(provenanceInput);
  const descriptor = validateAtlasChangeDescriptor({
    ...history,
    operation: "update",
  });
  const registeredVoters = patch.registeredVoters ?? null;
  const totalValidVotes = patch.totalValidVotes ?? null;

  return sql`
    WITH before_row AS MATERIALIZED (
      SELECT *
      FROM elections
      WHERE id = ${patch.electionId}::uuid
      FOR UPDATE
    ),
    before_provenance AS MATERIALIZED (
      SELECT source_id, source_url
      FROM statements
      WHERE subject_table = 'elections'
        AND subject_id = ${patch.electionId}::uuid
        AND predicate = ${provenance.predicate}
        AND source_id = ${provenance.sourceId}
      LIMIT 1
      FOR UPDATE
    ),
    updated AS (
      UPDATE elections e
      SET
        turnout_percent = ${patch.turnoutPercent},
        registered_voters = COALESCE(${registeredVoters}, e.registered_voters),
        total_valid_votes = COALESCE(${totalValidVotes}, e.total_valid_votes)
      WHERE e.id IN (SELECT id FROM before_row)
      RETURNING e.*
    ),
    provenance_write AS (
      INSERT INTO statements (
        subject_table,
        subject_id,
        predicate,
        object_value,
        source_id,
        source_url,
        source_license,
        retrieved_at,
        confidence
      )
      SELECT
        'elections',
        u.id,
        ${provenance.predicate},
        ${provenance.objectValue},
        ${provenance.sourceId},
        ${provenance.sourceUrl},
        ${provenance.sourceLicense},
        NOW(),
        ${provenance.confidence}
      FROM updated u
      ON CONFLICT (subject_table, subject_id, predicate, source_id)
      DO UPDATE SET
        object_value = EXCLUDED.object_value,
        source_url = EXCLUDED.source_url,
        source_license = EXCLUDED.source_license,
        retrieved_at = EXCLUDED.retrieved_at,
        confidence = EXCLUDED.confidence
      RETURNING subject_id
    ),
    change_payload AS (
      SELECT
        u.id,
        (
          CASE WHEN b.turnout_percent IS DISTINCT FROM u.turnout_percent
            THEN jsonb_build_array(jsonb_build_object('field', 'turnout_percent', 'before', b.turnout_percent, 'after', u.turnout_percent))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.registered_voters IS DISTINCT FROM u.registered_voters
            THEN jsonb_build_array(jsonb_build_object('field', 'registered_voters', 'before', b.registered_voters, 'after', u.registered_voters))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.total_valid_votes IS DISTINCT FROM u.total_valid_votes
            THEN jsonb_build_array(jsonb_build_object('field', 'total_valid_votes', 'before', b.total_valid_votes, 'after', u.total_valid_votes))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN bp.source_id IS DISTINCT FROM ${provenance.sourceId}
            THEN jsonb_build_array(jsonb_build_object('field', 'source_id', 'before', bp.source_id, 'after', ${provenance.sourceId}::text))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN bp.source_url IS DISTINCT FROM ${provenance.sourceUrl}
            THEN jsonb_build_array(jsonb_build_object('field', 'source_url', 'before', bp.source_url, 'after', ${provenance.sourceUrl}::text))
            ELSE '[]'::jsonb END
        ) AS changes
      FROM updated u
      INNER JOIN before_row b ON b.id = u.id
      LEFT JOIN before_provenance bp ON TRUE
      CROSS JOIN provenance_write pw
      WHERE pw.subject_id = u.id
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
        'election',
        id::text,
        'elections',
        'update',
        ${descriptor.changeKind},
        changes,
        ${descriptor.reason},
        ${descriptor.methodologyVersion},
        ${descriptor.releaseId},
        ${descriptor.correctionLogId}::uuid,
        ${descriptor.correctionStatus}::text
      FROM change_payload
      WHERE jsonb_array_length(changes) > 0
      RETURNING id
    )
    SELECT
      u.id,
      TRUE AS updated,
      EXISTS (SELECT 1 FROM history_event) AS history_written
    FROM updated u
  `;
}

export interface EstimatedElectionMutation {
  jurisdictionId: string;
  bodyId: string;
  electionDate: string;
  electionType: string;
  electionName: string;
  electoralSystem: string | null;
}

/**
 * Estimated contests are explicitly mutable projections, so their stable
 * identity is jurisdiction + chamber + dateConfidence=estimated, never date.
 */
export function buildEstimatedElectionHistoryUpsertStatement(
  input: EstimatedElectionMutation,
  provenance: ElectionProvenanceInput,
  history: ElectionHistoryContext,
  proposedId = randomUUID(),
) {
  return buildElectionHistoryUpsertStatement(
    {
      id: proposedId,
      jurisdictionId: input.jurisdictionId,
      bodyId: input.bodyId,
      electionDate: input.electionDate,
      electionType: input.electionType,
      electionName: input.electionName,
      electoralSystem: input.electoralSystem,
      dateConfidence: "estimated",
    },
    provenance,
    history,
    proposedId,
    "estimated-chamber",
  );
}

/** Atomic removal of a superseded estimated election and its public event. */
export function buildEstimatedElectionDeleteHistoryStatement(
  identity: Pick<EstimatedElectionMutation, "jurisdictionId" | "bodyId">,
  history: ElectionHistoryContext,
) {
  if (
    !UUID_PATTERN.test(identity.jurisdictionId) ||
    !UUID_PATTERN.test(identity.bodyId)
  ) {
    throw new Error(
      "Estimated election deletion requires stable jurisdiction and body UUIDs",
    );
  }
  const descriptor = validateAtlasChangeDescriptor({
    ...history,
    operation: "delete",
  });
  const lockKey = `election:estimated:${identity.jurisdictionId}|${identity.bodyId}`;
  return sql`
    WITH lock_row AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    ),
    before_row AS MATERIALIZED (
      SELECT e.*
      FROM elections e
      CROSS JOIN lock_row
      WHERE e.jurisdiction_id = ${identity.jurisdictionId}::uuid
        AND e.body_id = ${identity.bodyId}::uuid
        AND e.date_confidence = 'estimated'
      LIMIT 1
      FOR UPDATE OF e
    ),
    before_provenance AS MATERIALIZED (
      SELECT source_id, source_url
      FROM statements
      WHERE subject_table = 'elections'
        AND subject_id IN (SELECT id FROM before_row)
        AND predicate = 'civica_estimated_next_election'
      LIMIT 1
      FOR UPDATE
    ),
    result_delete AS (
      DELETE FROM election_results
      WHERE election_id IN (SELECT id FROM before_row)
      RETURNING id
    ),
    provenance_delete AS (
      DELETE FROM statements
      WHERE subject_table = 'elections'
        AND subject_id IN (SELECT id FROM before_row)
      RETURNING id
    ),
    deleted AS (
      DELETE FROM elections
      WHERE id IN (SELECT id FROM before_row)
        AND (SELECT count(*) FROM result_delete) >= 0
        AND (SELECT count(*) FROM provenance_delete) >= 0
      RETURNING id
    ),
    change_payload AS (
      SELECT
        b.id,
        (
          CASE WHEN b.election_name IS NOT NULL
            THEN jsonb_build_array(jsonb_build_object('field', 'election_name', 'before', b.election_name, 'after', NULL))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.election_date IS NOT NULL
            THEN jsonb_build_array(jsonb_build_object('field', 'election_date', 'before', b.election_date, 'after', NULL))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.election_type IS NOT NULL
            THEN jsonb_build_array(jsonb_build_object('field', 'election_type', 'before', b.election_type, 'after', NULL))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.electoral_system IS NOT NULL
            THEN jsonb_build_array(jsonb_build_object('field', 'electoral_system', 'before', b.electoral_system, 'after', NULL))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.body_id IS NOT NULL
            THEN jsonb_build_array(jsonb_build_object('field', 'body_id', 'before', b.body_id, 'after', NULL))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.date_confidence IS NOT NULL
            THEN jsonb_build_array(jsonb_build_object('field', 'date_confidence', 'before', b.date_confidence, 'after', NULL))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN bp.source_id IS NOT NULL
            THEN jsonb_build_array(jsonb_build_object('field', 'source_id', 'before', bp.source_id, 'after', NULL))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN bp.source_url IS NOT NULL
            THEN jsonb_build_array(jsonb_build_object('field', 'source_url', 'before', bp.source_url, 'after', NULL))
            ELSE '[]'::jsonb END
        ) AS changes
      FROM before_row b
      INNER JOIN deleted d ON d.id = b.id
      LEFT JOIN before_provenance bp ON TRUE
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
        'election',
        id::text,
        'elections',
        'delete',
        ${descriptor.changeKind},
        changes,
        ${descriptor.reason},
        ${descriptor.methodologyVersion},
        ${descriptor.releaseId},
        ${descriptor.correctionLogId}::uuid,
        ${descriptor.correctionStatus}::text
      FROM change_payload
      WHERE jsonb_array_length(changes) > 0
      RETURNING id
    )
    SELECT
      d.id,
      TRUE AS deleted,
      EXISTS (SELECT 1 FROM history_event) AS history_written
    FROM deleted d
  `;
}

function executionRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return (
    (result as { rows?: Record<string, unknown>[] } | null)?.rows ?? []
  );
}

function mutationResult(result: unknown): ElectionMutationResult {
  const row = executionRows(result)[0];
  if (!row) {
    return {
      id: null,
      inserted: 0,
      updated: 0,
      deleted: 0,
      historyWritten: false,
    };
  }
  return {
    id: typeof row.id === "string" ? row.id : null,
    inserted: row.inserted === true ? 1 : 0,
    updated: row.updated === true ? 1 : 0,
    deleted: row.deleted === true ? 1 : 0,
    historyWritten: row.history_written === true,
  };
}

export async function upsertEstimatedElectionWithHistory(
  database: Pick<CivicaDb, "execute">,
  input: EstimatedElectionMutation,
  provenance: ElectionProvenanceInput,
  history: ElectionHistoryContext,
) {
  return mutationResult(
    await database.execute(
      buildEstimatedElectionHistoryUpsertStatement(input, provenance, history),
    ),
  );
}

export async function deleteEstimatedElectionWithHistory(
  database: Pick<CivicaDb, "execute">,
  identity: Pick<EstimatedElectionMutation, "jurisdictionId" | "bodyId">,
  history: ElectionHistoryContext,
) {
  return mutationResult(
    await database.execute(
      buildEstimatedElectionDeleteHistoryStatement(identity, history),
    ),
  );
}

export async function updateElectionTurnoutWithHistory(
  database: Pick<CivicaDb, "execute">,
  patch: ElectionTurnoutPatch,
  provenance: ElectionProvenanceInput,
  history: ElectionHistoryContext,
) {
  return mutationResult(
    await database.execute(
      buildElectionTurnoutHistoryStatement(patch, provenance, history),
    ),
  );
}

export async function writeElection(
  db: Db,
  input: {
    election: ElectionInput;
    results?: ElectionResultInput[];
    provenance: ElectionProvenanceInput;
  },
  options: {
    dryRun?: boolean;
    history?: ElectionHistoryContext;
  } = {},
) {
  normalizeElection(input.election);
  normalizeProvenance(input.provenance);
  const resultNames = new Set<string>();
  for (const result of input.results ?? []) {
    if (!result.partyName || resultNames.has(result.partyName)) {
      throw new Error(
        `Duplicate/malformed election result: ${result.partyName}`,
      );
    }
    resultNames.add(result.partyName);
  }
  if (options.dryRun) {
    return {
      inserted: 1,
      updated: 0,
      resultsWritten: input.results?.length ?? 0,
      written: 0,
      historyWritten: false,
    };
  }
  if (!options.history) {
    throw new Error(
      "Election writes require a named Atlas release history context",
    );
  }

  const mutation = mutationResult(
    await db.execute(
      buildElectionHistoryUpsertStatement(
        input.election,
        input.provenance,
        options.history,
      ),
    ),
  );
  if (!mutation.id) {
    throw new Error("Election history mutation returned no stable election ID");
  }

  if (input.results) {
    await db
      .delete(electionResults)
      .where(eq(electionResults.electionId, mutation.id));
    for (const result of input.results) {
      await db
        .insert(electionResults)
        .values({ electionId: mutation.id, ...result });
    }
  }

  return {
    inserted: mutation.inserted,
    updated: mutation.updated,
    resultsWritten: input.results?.length ?? 0,
    written: 1,
    historyWritten: mutation.historyWritten,
  };
}
