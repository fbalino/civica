import { and, asc, eq } from "drizzle-orm";
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
 * A changed current identity is retired and replaced inside one transaction;
 * the research-evidence trigger captures the retired row. Identical replays
 * write nothing and therefore never advance source freshness.
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

  return database.transaction(async (transaction) => {
    const executor = transaction as unknown as Db;
    let written = 0;
    let unchanged = 0;
    const writtenSourceIds = new Set<string>();

    for (const row of rows) {
      const current = await executor
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

      if (current[0]) {
        await executor
          .update(entityNameForms)
          .set({ isCurrent: false, supersededAt: recordedAt })
          .where(eq(entityNameForms.id, current[0].id));
      }

      await executor.insert(entityNameForms).values({
        ...row,
        retrievedAt: new Date(row.retrievedAt),
      });
      written += 1;
      writtenSourceIds.add(row.sourceId);
    }

    const sourcesStamped = await (options.markSynced ?? markSourcesSynced)(
      [...writtenSourceIds],
      {
        rowsWritten: written,
        at: recordedAt,
        executor: transaction,
      },
    );

    return {
      proposed: rows.length,
      written,
      unchanged,
      sourcesStamped,
    };
  });
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

  return rows.map((row) => ({
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
  }));
}
