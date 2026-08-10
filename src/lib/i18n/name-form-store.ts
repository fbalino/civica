import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import { entityNameForms } from "@/lib/db/schema";
import {
  entityNameFormSchema,
  type EntityNameForm,
  type EntityNameType,
} from "./name-forms";

type Db = typeof import("@/lib/db").db;

export interface StoredEntityNameForm extends EntityNameForm {
  id: string;
  isCurrent: boolean;
  supersededAt: string | null;
  createdAt: string;
}

export interface WriteEntityNameFormsOptions {
  dryRun?: boolean;
  recordedAt?: Date;
  markSynced?: typeof markSourcesSynced;
}

export interface EntityNameFormsWriteSummary {
  proposed: number;
  written: number;
  unchanged: number;
  sourcesStamped: string[];
}

const COMPARED_FIELDS = [
  "contractVersion",
  "entityType",
  "entityId",
  "value",
  "languageTag",
  "scriptCode",
  "nameRole",
  "sourceId",
  "sourceUrl",
  "upstreamVintage",
  "translationStatus",
  "transliterationStatus",
] as const satisfies readonly (keyof EntityNameForm)[];

export function entityNameFormIdentity(form: EntityNameForm): string {
  return [
    form.entityType,
    form.entityId,
    form.nameRole,
    form.languageTag,
    form.sourceId,
  ].join(":");
}

export function normalizeEntityNameForms(
  input: readonly unknown[],
): EntityNameForm[] {
  if (input.length === 0) {
    throw new Error("Entity name-form input produced zero rows");
  }
  const rows = input.map((row) => entityNameFormSchema.parse(row));
  const identities = new Set<string>();
  for (const row of rows) {
    const identity = entityNameFormIdentity(row);
    if (identities.has(identity)) {
      throw new Error(`Duplicate entity name-form identity: ${identity}`);
    }
    identities.add(identity);
  }
  return rows;
}

export function sameEntityNameForm(
  existing: Record<string, unknown>,
  proposed: EntityNameForm,
): boolean {
  if (
    !COMPARED_FIELDS.every((field) => existing[field] === proposed[field])
  ) {
    return false;
  }
  const existingRetrievedAt = existing.retrievedAt;
  const existingTime =
    existingRetrievedAt instanceof Date
      ? existingRetrievedAt.getTime()
      : new Date(String(existingRetrievedAt)).getTime();
  return existingTime === new Date(proposed.retrievedAt).getTime();
}

/**
 * Store source-backed name forms without overwriting history.
 *
 * A changed current identity is retired and replaced by ONE data-modifying
 * CTE statement — the Neon HTTP driver executes single statements as
 * non-interactive transactions and does not support an interactive
 * `db.transaction()` spanning separate awaits. The research-evidence trigger
 * captures the retired row. Identical replays write nothing and therefore
 * never advance source freshness; freshness is stamped only after every
 * proposed row has committed.
 */
export async function writeEntityNameForms(
  database: Db,
  input: readonly unknown[],
  options: WriteEntityNameFormsOptions = {},
): Promise<EntityNameFormsWriteSummary> {
  const rows = normalizeEntityNameForms(input);
  if (options.dryRun) {
    return {
      proposed: rows.length,
      written: 0,
      unchanged: 0,
      sourcesStamped: [],
    };
  }

  const recordedAt = options.recordedAt ?? new Date();
  if (!Number.isFinite(recordedAt.getTime())) {
    throw new RangeError("Entity name-form recordedAt must be a valid date");
  }

  let written = 0;
  let unchanged = 0;
  const writtenSourceIds = new Set<string>();

  for (const row of rows) {
    const current = await database
      .select()
      .from(entityNameForms)
      .where(
        and(
          eq(entityNameForms.entityType, row.entityType),
          eq(entityNameForms.entityId, row.entityId),
          eq(entityNameForms.nameRole, row.nameRole),
          eq(entityNameForms.languageTag, row.languageTag),
          eq(entityNameForms.sourceId, row.sourceId),
          eq(entityNameForms.isCurrent, true),
        ),
      )
      .limit(1);

    if (current[0] && sameEntityNameForm(current[0], row)) {
      unchanged += 1;
      continue;
    }

    // Supersede-and-insert atomically: one statement, one implicit
    // transaction. The partial unique index on the current identity makes a
    // concurrent duplicate insert fail instead of forking history.
    await database.execute(sql`
      WITH superseded AS (
        UPDATE entity_name_forms
        SET is_current = false, superseded_at = ${recordedAt.toISOString()}::timestamp
        WHERE entity_type = ${row.entityType}
          AND entity_id = ${row.entityId}::uuid
          AND name_role = ${row.nameRole}
          AND language_tag = ${row.languageTag}
          AND source_id = ${row.sourceId}
          AND is_current = true
      )
      INSERT INTO entity_name_forms (
        contract_version, entity_type, entity_id, value, language_tag,
        script_code, name_role, source_id, source_url, retrieved_at,
        upstream_vintage, translation_status, transliteration_status,
        is_current
      ) VALUES (
        ${row.contractVersion}, ${row.entityType}, ${row.entityId}::uuid,
        ${row.value}, ${row.languageTag}, ${row.scriptCode},
        ${row.nameRole}, ${row.sourceId}, ${row.sourceUrl},
        ${new Date(row.retrievedAt).toISOString()}::timestamp,
        ${row.upstreamVintage}, ${row.translationStatus},
        ${row.transliterationStatus}, true
      )
    `);
    written += 1;
    writtenSourceIds.add(row.sourceId);
  }

  const sourcesStamped = await (options.markSynced ?? markSourcesSynced)(
    [...writtenSourceIds],
    {
      rowsWritten: written,
      at: recordedAt,
      executor: database,
    },
  );

  return {
    proposed: rows.length,
    written,
    unchanged,
    sourcesStamped,
  };
}

/** Read only the current, explicit name forms for one canonical entity. */
export async function getCurrentEntityNameForms(
  database: Db,
  entityType: EntityNameType,
  entityId: string,
): Promise<StoredEntityNameForm[]> {
  const rows = await database
    .select()
    .from(entityNameForms)
    .where(
      and(
        eq(entityNameForms.entityType, entityType),
        eq(entityNameForms.entityId, entityId),
        eq(entityNameForms.isCurrent, true),
      ),
    )
    .orderBy(
      asc(entityNameForms.nameRole),
      asc(entityNameForms.languageTag),
      asc(entityNameForms.sourceId),
    );

  return rows.map(storedRow);
}

/** Bulk variant: current explicit forms for many entities of one type. */
export async function getCurrentEntityNameFormsForEntities(
  database: Db,
  entityType: EntityNameType,
  entityIds: readonly string[],
): Promise<Map<string, StoredEntityNameForm[]>> {
  const byEntity = new Map<string, StoredEntityNameForm[]>();
  if (entityIds.length === 0) return byEntity;
  const rows = await database
    .select()
    .from(entityNameForms)
    .where(
      and(
        eq(entityNameForms.entityType, entityType),
        inArray(entityNameForms.entityId, [...new Set(entityIds)]),
        eq(entityNameForms.isCurrent, true),
      ),
    )
    .orderBy(
      asc(entityNameForms.nameRole),
      asc(entityNameForms.languageTag),
      asc(entityNameForms.sourceId),
    );
  for (const row of rows) {
    const mapped = storedRow(row);
    const list = byEntity.get(mapped.entityId) ?? [];
    list.push(mapped);
    byEntity.set(mapped.entityId, list);
  }
  return byEntity;
}

function storedRow(
  row: typeof entityNameForms.$inferSelect,
): StoredEntityNameForm {
  return {
    contractVersion: entityNameFormSchema.shape.contractVersion.parse(
      row.contractVersion,
    ),
    entityType: entityNameFormSchema.shape.entityType.parse(row.entityType),
    entityId: row.entityId,
    value: row.value,
    languageTag: row.languageTag,
    scriptCode: row.scriptCode,
    nameRole: entityNameFormSchema.shape.nameRole.parse(row.nameRole),
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    retrievedAt: row.retrievedAt.toISOString(),
    upstreamVintage: row.upstreamVintage,
    translationStatus: entityNameFormSchema.shape.translationStatus.parse(
      row.translationStatus,
    ),
    transliterationStatus:
      entityNameFormSchema.shape.transliterationStatus.parse(
        row.transliterationStatus,
      ),
    id: row.id,
    isCurrent: row.isCurrent,
    supersededAt: row.supersededAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
