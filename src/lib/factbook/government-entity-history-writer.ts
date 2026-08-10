import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import {
  validateAtlasChangeDescriptor,
  type AtlasChangeDescriptor,
} from "@/lib/atlas/change-history-writer";
import type { CivicaDb } from "@/lib/db";

export type GovernmentEntityHistoryContext = Omit<
  AtlasChangeDescriptor,
  "operation"
>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${label} requires a stable UUID`);
  }
  return value;
}

function rowsFromExecute(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return (
    (result as { rows?: Record<string, unknown>[] } | null)?.rows ?? []
  );
}

export interface GovernmentBodyHistoryWrite {
  jurisdictionId: string;
  name: string;
  bodyType: string;
  branch: string;
  chamberType?: string | null;
  totalSeats?: number | null;
  wikidataQid?: string | null;
  ipuParlineId?: string | null;
  electoralSystemFamily?: string | null;
  electoralSubsystem?: string | null;
  hierarchyLevel?: number | null;
  stableId?: string | null;
  /**
   * External IDs and stableId always take precedence. `branch` is appropriate
   * for the one executive body; multi-chamber importers should use a publisher
   * ID or exact-name planning match rather than collapsing every legislature.
   */
  identityMode?: "branch" | "exact_name";
  history: GovernmentEntityHistoryContext;
}

export function buildGovernmentBodyHistoryStatement(
  input: GovernmentBodyHistoryWrite,
  proposedId = input.stableId ?? randomUUID(),
) {
  requireUuid(input.jurisdictionId, "Government-body jurisdiction");
  requireUuid(proposedId, "Government body");
  if (input.stableId) requireUuid(input.stableId, "Government body");
  const name = input.name.trim();
  const bodyType = input.bodyType.trim();
  const branch = input.branch.trim();
  if (!name || !bodyType || !branch) {
    throw new Error("Government-body history write requires name, type, and branch");
  }
  const descriptor = validateAtlasChangeDescriptor({
    ...input.history,
    operation: "update",
  });
  const has = (key: keyof GovernmentBodyHistoryWrite) =>
    Object.prototype.hasOwnProperty.call(input, key);
  const identityPredicate = input.stableId
    ? sql`gb.id = ${input.stableId}::uuid`
    : input.ipuParlineId
      ? sql`gb.ipu_parline_id = ${input.ipuParlineId}`
      : input.wikidataQid
        ? sql`gb.wikidata_qid = ${input.wikidataQid}`
        : input.identityMode === "exact_name"
          ? sql`gb.jurisdiction_id = ${input.jurisdictionId}::uuid
              AND gb.name = ${name}`
          : sql`gb.jurisdiction_id = ${input.jurisdictionId}::uuid
              AND gb.branch = ${branch}`;
  const lockKey = `government-body\u001f${
    input.stableId ??
    input.ipuParlineId ??
    input.wikidataQid ??
    `${input.jurisdictionId}\u001f${
      input.identityMode === "exact_name" ? name : branch
    }`
  }`;

  return sql`
    WITH lock_row AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    ),
    before_row AS MATERIALIZED (
      SELECT gb.*
      FROM government_bodies gb
      CROSS JOIN lock_row
      WHERE ${identityPredicate}
      FOR UPDATE OF gb
    ),
    upserted AS (
      INSERT INTO government_bodies (
        id, jurisdiction_id, name, body_type, chamber_type, total_seats,
        branch, wikidata_qid, ipu_parline_id, hierarchy_level,
        electoral_system_family, electoral_subsystem
      )
      VALUES (
        COALESCE((SELECT id FROM before_row), ${proposedId}::uuid),
        ${input.jurisdictionId}::uuid,
        ${name},
        ${bodyType},
        ${input.chamberType ?? null},
        ${input.totalSeats ?? null},
        ${branch},
        ${input.wikidataQid ?? null},
        ${input.ipuParlineId ?? null},
        ${input.hierarchyLevel ?? null},
        ${input.electoralSystemFamily ?? null},
        ${input.electoralSubsystem ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        body_type = EXCLUDED.body_type,
        chamber_type = CASE WHEN ${has("chamberType")} THEN EXCLUDED.chamber_type ELSE government_bodies.chamber_type END,
        total_seats = CASE WHEN ${has("totalSeats")} THEN EXCLUDED.total_seats ELSE government_bodies.total_seats END,
        branch = EXCLUDED.branch,
        wikidata_qid = CASE WHEN ${has("wikidataQid")} THEN EXCLUDED.wikidata_qid ELSE government_bodies.wikidata_qid END,
        ipu_parline_id = CASE WHEN ${has("ipuParlineId")} THEN EXCLUDED.ipu_parline_id ELSE government_bodies.ipu_parline_id END,
        hierarchy_level = CASE WHEN ${has("hierarchyLevel")} THEN EXCLUDED.hierarchy_level ELSE government_bodies.hierarchy_level END,
        electoral_system_family = CASE WHEN ${has("electoralSystemFamily")} THEN EXCLUDED.electoral_system_family ELSE government_bodies.electoral_system_family END,
        electoral_subsystem = CASE WHEN ${has("electoralSubsystem")} THEN EXCLUDED.electoral_subsystem ELSE government_bodies.electoral_subsystem END
      RETURNING *
    ),
    change_payload AS (
      SELECT
        u.id,
        b.id AS before_id,
        (
          CASE WHEN b.name IS DISTINCT FROM u.name
            THEN jsonb_build_array(jsonb_build_object('field', 'name', 'before', b.name, 'after', u.name))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.body_type IS DISTINCT FROM u.body_type
            THEN jsonb_build_array(jsonb_build_object('field', 'body_type', 'before', b.body_type, 'after', u.body_type))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.chamber_type IS DISTINCT FROM u.chamber_type
            THEN jsonb_build_array(jsonb_build_object('field', 'chamber_type', 'before', b.chamber_type, 'after', u.chamber_type))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.total_seats IS DISTINCT FROM u.total_seats
            THEN jsonb_build_array(jsonb_build_object('field', 'total_seats', 'before', b.total_seats, 'after', u.total_seats))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.branch IS DISTINCT FROM u.branch
            THEN jsonb_build_array(jsonb_build_object('field', 'branch', 'before', b.branch, 'after', u.branch))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.wikidata_qid IS DISTINCT FROM u.wikidata_qid
            THEN jsonb_build_array(jsonb_build_object('field', 'wikidata_qid', 'before', b.wikidata_qid, 'after', u.wikidata_qid))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.ipu_parline_id IS DISTINCT FROM u.ipu_parline_id
            THEN jsonb_build_array(jsonb_build_object('field', 'ipu_parline_id', 'before', b.ipu_parline_id, 'after', u.ipu_parline_id))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.electoral_system_family IS DISTINCT FROM u.electoral_system_family
            THEN jsonb_build_array(jsonb_build_object('field', 'electoral_system_family', 'before', b.electoral_system_family, 'after', u.electoral_system_family))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.electoral_subsystem IS DISTINCT FROM u.electoral_subsystem
            THEN jsonb_build_array(jsonb_build_object('field', 'electoral_subsystem', 'before', b.electoral_subsystem, 'after', u.electoral_subsystem))
            ELSE '[]'::jsonb END
        ) AS changes
      FROM upserted u
      LEFT JOIN before_row b ON TRUE
    ),
    history_event AS (
      INSERT INTO atlas_entity_change_history (
        entity_type, entity_id, entity_table, operation, change_kind, changes,
        reason, methodology_version, release_id, correction_log_id,
        correction_status
      )
      SELECT
        'institution', id::text, 'government_bodies',
        CASE WHEN before_id IS NULL THEN 'insert' ELSE 'update' END,
        ${descriptor.changeKind}, changes, ${descriptor.reason},
        ${descriptor.methodologyVersion}, ${descriptor.releaseId},
        ${descriptor.correctionLogId}::uuid, ${descriptor.correctionStatus}
      FROM change_payload
      WHERE jsonb_array_length(changes) > 0
      RETURNING id
    )
    SELECT upserted.id,
      EXISTS (SELECT 1 FROM history_event) AS history_written
    FROM upserted
  `;
}

export interface OfficeHistoryWrite {
  bodyId: string;
  name: string;
  officeType: string;
  isElected: boolean;
  wikidataQid?: string | null;
  displayOrder?: number | null;
  stableId?: string | null;
  /**
   * The Wikidata spine has a stable semantic role key. CIA offices do not:
   * those are matched by an explicitly supplied UUID or exact current title.
   */
  identityMode: "office_type" | "exact_title";
  history: GovernmentEntityHistoryContext;
}

export function buildOfficeHistoryStatement(
  input: OfficeHistoryWrite,
  proposedId = input.stableId ?? randomUUID(),
) {
  requireUuid(input.bodyId, "Office body");
  requireUuid(proposedId, "Office");
  if (input.stableId) requireUuid(input.stableId, "Office");
  const name = input.name.trim();
  const officeType = input.officeType.trim();
  if (!name || !officeType) {
    throw new Error("Office history write requires name and office type");
  }
  const descriptor = validateAtlasChangeDescriptor({
    ...input.history,
    operation: "update",
  });
  const hasWikidataQid = Object.prototype.hasOwnProperty.call(
    input,
    "wikidataQid",
  );
  const hasDisplayOrder = Object.prototype.hasOwnProperty.call(
    input,
    "displayOrder",
  );
  const identityPredicate = input.stableId
    ? sql`o.id = ${input.stableId}::uuid`
    : input.identityMode === "office_type"
      ? sql`o.body_id = ${input.bodyId}::uuid AND o.office_type = ${officeType}`
      : sql`o.body_id = ${input.bodyId}::uuid AND o.name = ${name}`;
  const lockKey =
    input.stableId ??
    `${input.bodyId}\u001f${
      input.identityMode === "office_type" ? officeType : name
    }`;

  return sql`
    WITH lock_row AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${"office\u001f" + lockKey}, 0))
    ),
    before_row AS MATERIALIZED (
      SELECT o.*
      FROM offices o
      CROSS JOIN lock_row
      WHERE ${identityPredicate}
      FOR UPDATE OF o
    ),
    possible_title_rename AS (
      SELECT o.id
      FROM offices o
      WHERE ${input.identityMode}::text = 'exact_title'
        AND ${input.stableId ?? null}::uuid IS NULL
        AND NOT EXISTS (SELECT 1 FROM before_row)
        AND ${input.displayOrder ?? null}::integer IS NOT NULL
        AND o.body_id = ${input.bodyId}::uuid
        AND o.display_order = ${input.displayOrder ?? null}
      LIMIT 1
    ),
    upserted AS (
      INSERT INTO offices (
        id, body_id, name, office_type, is_elected, wikidata_qid, display_order
      )
      SELECT
        COALESCE((SELECT id FROM before_row), ${proposedId}::uuid),
        ${input.bodyId}::uuid,
        ${name},
        ${officeType},
        ${input.isElected},
        ${input.wikidataQid ?? null},
        ${input.displayOrder ?? null}
      WHERE NOT EXISTS (SELECT 1 FROM possible_title_rename)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        office_type = EXCLUDED.office_type,
        is_elected = EXCLUDED.is_elected,
        wikidata_qid = CASE WHEN ${hasWikidataQid} THEN EXCLUDED.wikidata_qid ELSE offices.wikidata_qid END,
        display_order = CASE WHEN ${hasDisplayOrder} THEN EXCLUDED.display_order ELSE offices.display_order END
      RETURNING *
    ),
    change_payload AS (
      SELECT
        u.id,
        b.id AS before_id,
        (
          CASE WHEN b.name IS DISTINCT FROM u.name
            THEN jsonb_build_array(jsonb_build_object('field', 'name', 'before', b.name, 'after', u.name))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.office_type IS DISTINCT FROM u.office_type
            THEN jsonb_build_array(jsonb_build_object('field', 'office_type', 'before', b.office_type, 'after', u.office_type))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.is_elected IS DISTINCT FROM u.is_elected
            THEN jsonb_build_array(jsonb_build_object('field', 'is_elected', 'before', b.is_elected, 'after', u.is_elected))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.wikidata_qid IS DISTINCT FROM u.wikidata_qid
            THEN jsonb_build_array(jsonb_build_object('field', 'wikidata_qid', 'before', b.wikidata_qid, 'after', u.wikidata_qid))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.reports_to_office_id IS DISTINCT FROM u.reports_to_office_id
            THEN jsonb_build_array(jsonb_build_object('field', 'reports_to_office_id', 'before', b.reports_to_office_id, 'after', u.reports_to_office_id))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.display_order IS DISTINCT FROM u.display_order
            THEN jsonb_build_array(jsonb_build_object('field', 'display_order', 'before', b.display_order, 'after', u.display_order))
            ELSE '[]'::jsonb END
        ) AS changes
      FROM upserted u
      LEFT JOIN before_row b ON TRUE
    ),
    history_event AS (
      INSERT INTO atlas_entity_change_history (
        entity_type, entity_id, entity_table, operation, change_kind, changes,
        reason, methodology_version, release_id, correction_log_id,
        correction_status
      )
      SELECT
        'office', id::text, 'offices',
        CASE WHEN before_id IS NULL THEN 'insert' ELSE 'update' END,
        ${descriptor.changeKind}, changes, ${descriptor.reason},
        ${descriptor.methodologyVersion}, ${descriptor.releaseId},
        ${descriptor.correctionLogId}::uuid, ${descriptor.correctionStatus}
      FROM change_payload
      WHERE jsonb_array_length(changes) > 0
      RETURNING id
    )
    SELECT upserted.id,
      EXISTS (SELECT 1 FROM history_event) AS history_written
    FROM upserted
  `;
}

export interface PersonHistoryValues {
  name?: string;
  dateOfBirth?: string | null;
  wikidataQid?: string | null;
  photoUrl?: string | null;
  photoLicense?: string | null;
  photoCredit?: string | null;
  parlinePersonCode?: string | null;
}

export interface PersonHistoryWrite {
  /** Required for QID-less identity and recommended whenever a row is known. */
  stableId?: string | null;
  /** Stable publisher identity used when the row UUID is not yet known. */
  identityQid?: string | null;
  /** Required when the mutation may insert a new row. */
  insertName?: string;
  values: PersonHistoryValues;
  history: GovernmentEntityHistoryContext;
}

export function buildPersonHistoryStatement(
  input: PersonHistoryWrite,
  proposedId = input.stableId ?? randomUUID(),
) {
  if (input.stableId) requireUuid(input.stableId, "Person");
  requireUuid(proposedId, "Person");
  const identityQid = input.identityQid?.trim() || null;
  if (!identityQid && !input.stableId) {
    throw new Error(
      "QID-less person history writes require an explicit stable person UUID",
    );
  }
  if (identityQid && !/^Q\d+$/.test(identityQid)) {
    throw new Error("Person history identity QID is invalid");
  }
  const insertName = input.insertName?.trim() || input.values.name?.trim() || "";
  if (!insertName) {
    throw new Error("Person history write requires an insert name");
  }
  if (input.values.name !== undefined && !input.values.name.trim()) {
    throw new Error("Person history name cannot be empty");
  }
  const descriptor = validateAtlasChangeDescriptor({
    ...input.history,
    operation: "update",
  });
  const has = (key: keyof PersonHistoryValues) =>
    Object.prototype.hasOwnProperty.call(input.values, key);
  const lockKey = `person\u001f${input.stableId ?? identityQid}`;

  return sql`
    WITH lock_row AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    ),
    identity_rows AS MATERIALIZED (
      SELECT p.*
      FROM persons p
      CROSS JOIN lock_row
      WHERE ${
        input.stableId && identityQid
          ? sql`p.id = ${input.stableId}::uuid OR p.wikidata_qid = ${identityQid}`
          : input.stableId
            ? sql`p.id = ${input.stableId}::uuid`
            : sql`p.wikidata_qid = ${identityQid}`
      }
      FOR UPDATE OF p
    ),
    identity_guard AS (
      SELECT count(*) AS match_count FROM identity_rows
    ),
    before_row AS MATERIALIZED (
      SELECT * FROM identity_rows LIMIT 1
    ),
    upserted AS (
      INSERT INTO persons (
        id, name, date_of_birth, wikidata_qid, photo_url, photo_license,
        photo_credit, parline_person_code
      )
      SELECT
        COALESCE((SELECT id FROM before_row), ${proposedId}::uuid),
        ${insertName},
        ${has("dateOfBirth") ? input.values.dateOfBirth ?? null : null},
        ${has("wikidataQid") ? input.values.wikidataQid ?? null : identityQid},
        ${has("photoUrl") ? input.values.photoUrl ?? null : null},
        ${has("photoLicense") ? input.values.photoLicense ?? null : null},
        ${has("photoCredit") ? input.values.photoCredit ?? null : null},
        ${has("parlinePersonCode") ? input.values.parlinePersonCode ?? null : null}
      FROM identity_guard
      WHERE match_count <= 1
      ON CONFLICT (id) DO UPDATE SET
        name = CASE WHEN ${has("name")} THEN ${input.values.name ?? null} ELSE persons.name END,
        date_of_birth = CASE WHEN ${has("dateOfBirth")} THEN ${input.values.dateOfBirth ?? null}::date ELSE persons.date_of_birth END,
        wikidata_qid = CASE WHEN ${has("wikidataQid")} THEN ${input.values.wikidataQid ?? null} ELSE persons.wikidata_qid END,
        photo_url = CASE WHEN ${has("photoUrl")} THEN ${input.values.photoUrl ?? null} ELSE persons.photo_url END,
        photo_license = CASE WHEN ${has("photoLicense")} THEN ${input.values.photoLicense ?? null} ELSE persons.photo_license END,
        photo_credit = CASE WHEN ${has("photoCredit")} THEN ${input.values.photoCredit ?? null} ELSE persons.photo_credit END,
        parline_person_code = CASE WHEN ${has("parlinePersonCode")} THEN ${input.values.parlinePersonCode ?? null} ELSE persons.parline_person_code END
      RETURNING *
    ),
    change_payload AS (
      SELECT
        u.id,
        b.id AS before_id,
        (
          CASE WHEN b.name IS DISTINCT FROM u.name
            THEN jsonb_build_array(jsonb_build_object('field', 'name', 'before', b.name, 'after', u.name))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.date_of_birth IS DISTINCT FROM u.date_of_birth
            THEN jsonb_build_array(jsonb_build_object('field', 'date_of_birth', 'before', b.date_of_birth, 'after', u.date_of_birth))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.wikidata_qid IS DISTINCT FROM u.wikidata_qid
            THEN jsonb_build_array(jsonb_build_object('field', 'wikidata_qid', 'before', b.wikidata_qid, 'after', u.wikidata_qid))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.photo_url IS DISTINCT FROM u.photo_url
            THEN jsonb_build_array(jsonb_build_object('field', 'photo_url', 'before', b.photo_url, 'after', u.photo_url))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.photo_license IS DISTINCT FROM u.photo_license
            THEN jsonb_build_array(jsonb_build_object('field', 'photo_license', 'before', b.photo_license, 'after', u.photo_license))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.photo_credit IS DISTINCT FROM u.photo_credit
            THEN jsonb_build_array(jsonb_build_object('field', 'photo_credit', 'before', b.photo_credit, 'after', u.photo_credit))
            ELSE '[]'::jsonb END
          ||
          CASE WHEN b.parline_person_code IS DISTINCT FROM u.parline_person_code
            THEN jsonb_build_array(jsonb_build_object('field', 'parline_person_code', 'before', b.parline_person_code, 'after', u.parline_person_code))
            ELSE '[]'::jsonb END
        ) AS changes
      FROM upserted u
      LEFT JOIN before_row b ON TRUE
    ),
    history_event AS (
      INSERT INTO atlas_entity_change_history (
        entity_type, entity_id, entity_table, operation, change_kind, changes,
        reason, methodology_version, release_id, correction_log_id,
        correction_status
      )
      SELECT
        'person', id::text, 'persons',
        CASE WHEN before_id IS NULL THEN 'insert' ELSE 'update' END,
        ${descriptor.changeKind}, changes, ${descriptor.reason},
        ${descriptor.methodologyVersion}, ${descriptor.releaseId},
        ${descriptor.correctionLogId}::uuid, ${descriptor.correctionStatus}
      FROM change_payload
      WHERE jsonb_array_length(changes) > 0
      RETURNING id
    )
    SELECT upserted.id,
      EXISTS (SELECT 1 FROM history_event) AS history_written
    FROM upserted
  `;
}

async function executeEntityStatement(
  database: Pick<CivicaDb, "execute">,
  statement: ReturnType<typeof sql>,
  label: string,
): Promise<string> {
  const rows = rowsFromExecute(await database.execute(statement));
  const id = rows[0]?.id;
  if (typeof id !== "string") {
    throw new Error(
      `${label} mutation did not resolve one stable row; identity is ambiguous or unsafe`,
    );
  }
  return id;
}

export async function upsertGovernmentBodyWithHistory(
  database: Pick<CivicaDb, "execute">,
  input: GovernmentBodyHistoryWrite,
) {
  return executeEntityStatement(
    database,
    buildGovernmentBodyHistoryStatement(input),
    "Government body",
  );
}

export async function upsertOfficeWithHistory(
  database: Pick<CivicaDb, "execute">,
  input: OfficeHistoryWrite,
) {
  return executeEntityStatement(
    database,
    buildOfficeHistoryStatement(input),
    "Office",
  );
}

export async function mutatePersonWithHistory(
  database: Pick<CivicaDb, "execute">,
  input: PersonHistoryWrite,
) {
  return executeEntityStatement(
    database,
    buildPersonHistoryStatement(input),
    "Person",
  );
}

export interface GovernmentEntityHistoryWriters {
  upsertBody: typeof upsertGovernmentBodyWithHistory;
  upsertOffice: typeof upsertOfficeWithHistory;
  mutatePerson: typeof mutatePersonWithHistory;
}

export const governmentEntityHistoryWriters: GovernmentEntityHistoryWriters = {
  upsertBody: upsertGovernmentBodyWithHistory,
  upsertOffice: upsertOfficeWithHistory,
  mutatePerson: mutatePersonWithHistory,
};
