import { z } from "zod";
import type { EntityCitation } from "@/lib/citations/stable-identity";

/**
 * ATL-020 public-history projection contract. Raw DAT-016 snapshots are never
 * returned directly: this module projects only an allowlisted field set and
 * classifies the change from an explicit writer-supplied kind.
 */
export const ATLAS_CHANGE_HISTORY_SCHEMA_VERSION =
  "civica-atlas-change-history/v1" as const;

export const ATLAS_HISTORY_ENTITY_TYPES = [
  "fact",
  "institution",
  "office",
  "person",
  "election",
  "constitution-passage",
  "organization",
  "indicator",
] as const;

export type AtlasHistoryEntityType = (typeof ATLAS_HISTORY_ENTITY_TYPES)[number];
export type AtlasChangeKind =
  | "routine_refresh"
  | "substantive_revision"
  | "correction"
  | "retraction"
  | "methodology_change";

export const ATLAS_CHANGE_KINDS = [
  "routine_refresh",
  "substantive_revision",
  "correction",
  "retraction",
  "methodology_change",
] as const satisfies readonly AtlasChangeKind[];

export const ATLAS_CHANGE_OPERATIONS = [
  "insert",
  "update",
  "delete",
] as const;

export const ATLAS_CORRECTION_STATUSES = [
  "open",
  "in_review",
  "resolved_corrected",
  "resolved_no_change",
  "rejected",
] as const;

export type AtlasCorrectionStatus =
  (typeof ATLAS_CORRECTION_STATUSES)[number];

export const ATLAS_CHANGE_HISTORY_COVERAGE_NOTE =
  "Public release-mapped history begins with the ATL-020 contract. Earlier retained audit evidence is not shown unless it can be mapped to a documented release without inference.";

export const PUBLIC_HISTORY_FIELDS: Record<
  AtlasHistoryEntityType,
  readonly string[]
> = {
  fact: [
    "fact_value",
    "fact_value_numeric",
    "fact_unit",
    "fact_year",
    "value_status",
    "value_status_reason",
    "as_of",
    "source_id",
    "source_url",
    "upstream_vintage_label",
    "methodology_version",
    "status",
    "status_reason",
  ],
  institution: [
    "name",
    "body_type",
    "chamber_type",
    "total_seats",
    "branch",
    "wikidata_qid",
    "ipu_parline_id",
    "electoral_system_family",
    "electoral_subsystem",
    "source_id",
    "source_url",
  ],
  office: [
    "name",
    "office_type",
    "is_elected",
    "wikidata_qid",
    "reports_to_office_id",
    "display_order",
    "source_id",
    "source_url",
  ],
  person: [
    "name",
    "date_of_birth",
    "wikidata_qid",
    "photo_url",
    "photo_license",
    "photo_credit",
    "parline_person_code",
    "source_id",
    "source_url",
  ],
  election: [
    "election_name",
    "election_date",
    "election_type",
    "electoral_system",
    "body_id",
    "turnout_percent",
    "registered_voters",
    "total_valid_votes",
    "wikidata_qid",
    "date_confidence",
    "source_id",
    "source_url",
  ],
  "constitution-passage": [
    "heading_label",
    "plain_text",
    "source_id",
    "source_url",
    "language_code",
    "translation_status",
    "is_current",
  ],
  organization: [
    "name",
    "full_name",
    "type",
    "founded_year",
    "hq_country",
    "member_count",
    "wikidata_qid",
    "source_id",
    "source_url",
    "source_license",
    "upstream_vintage",
  ],
  indicator: [
    "value",
    "value_status",
    "value_status_reason",
    "rank",
    "total_ranked",
    "source_id",
    "source_url",
    "year",
  ],
};

export const ATLAS_HISTORY_ENTITY_TABLES: Record<AtlasHistoryEntityType, string> = {
  fact: "country_facts", institution: "government_bodies", office: "offices", person: "persons", election: "elections", "constitution-passage": "constitution_passages", organization: "organizations", indicator: "country_metrics",
};

export interface PublicHistoryFieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

const zPublicHistoryFieldChange = z
  .object({
    field: z.string().min(1),
    before: z.unknown(),
    after: z.unknown(),
  })
  .strict()
  .superRefine((change, context) => {
    if (!hasOwn(change, "before") || !hasOwn(change, "after")) {
      context.addIssue({
        code: "custom",
        message: "History changes require explicit before and after values",
      });
    }
    if (JSON.stringify(change.before) === JSON.stringify(change.after)) {
      context.addIssue({
        code: "custom",
        message: "History changes require distinct before and after values",
      });
    }
  });

export const zAtlasEntityChangeHistoryDocument = z
  .object({
    schemaVersion: z.literal(ATLAS_CHANGE_HISTORY_SCHEMA_VERSION),
    entity: z
      .object({
        entityType: z.enum(ATLAS_HISTORY_ENTITY_TYPES),
        entityId: z.string().min(1),
        label: z.string().min(1),
        citationUrl: z.string().url(),
        readerUrl: z.string().url().nullable(),
      })
      .strict(),
    coverage: z
      .object({
        state: z.enum(["recorded_history", "no_recorded_history"]),
        note: z.literal(ATLAS_CHANGE_HISTORY_COVERAGE_NOTE),
      })
      .strict(),
    events: z.array(
      z
        .object({
          id: z.string().uuid(),
          entityType: z.enum(ATLAS_HISTORY_ENTITY_TYPES),
          entityId: z.string().min(1),
          operation: z.enum(ATLAS_CHANGE_OPERATIONS),
          changeKind: z.enum(ATLAS_CHANGE_KINDS),
          changes: z.array(zPublicHistoryFieldChange).min(1),
          reason: z.string().min(1),
          methodologyVersion: z.string().min(1),
          releaseId: z
            .string()
            .min(1)
            .max(96)
            .regex(/^[A-Za-z0-9._-]+$/),
          correction: z
            .object({
              id: z.string().uuid(),
              status: z.enum(ATLAS_CORRECTION_STATUSES),
            })
            .strict()
            .nullable(),
          recordedAt: z.string().datetime(),
        })
        .strict(),
    ),
    pagination: z
      .object({
        limit: z.number().int().min(1).max(100),
        offset: z.number().int().min(0),
        hasMore: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((document, context) => {
    for (const [eventIndex, event] of document.events.entries()) {
      if (
        event.entityType !== document.entity.entityType ||
        event.entityId !== document.entity.entityId
      ) {
        context.addIssue({
          code: "custom",
          path: ["events", eventIndex],
          message: "History event identity must match the document entity",
        });
      }
      const allowedFields = new Set(PUBLIC_HISTORY_FIELDS[event.entityType]);
      for (const [changeIndex, change] of event.changes.entries()) {
        if (!allowedFields.has(change.field)) {
          context.addIssue({
            code: "custom",
            path: ["events", eventIndex, "changes", changeIndex, "field"],
            message: `Unsupported public history field for ${event.entityType}`,
          });
        }
      }
    }
  });

export type AtlasEntityChangeHistoryDocument = z.infer<
  typeof zAtlasEntityChangeHistoryDocument
>;

export interface AtlasEntityChangeHistoryRow {
  id: string;
  operation: string;
  changeKind: string;
  changes: unknown;
  reason: string;
  methodologyVersion: string;
  releaseId: string;
  publicCorrectionId: string | null;
  publicCorrectionStatus: string | null;
  recordedAt: Date;
}

export function buildAtlasEntityChangeHistoryDocument(input: {
  citation: Pick<
    EntityCitation,
    "entityType" | "id" | "label" | "citationUrl" | "readerUrl"
  >;
  rows: readonly AtlasEntityChangeHistoryRow[];
  limit: number;
  offset: number;
}) {
  const hasMore = input.rows.length > input.limit;
  const events = input.rows.slice(0, input.limit).map((row) => ({
    id: row.id,
    entityType: input.citation.entityType,
    entityId: input.citation.id,
    operation: row.operation,
    changeKind: row.changeKind,
    changes: row.changes,
    reason: row.reason,
    methodologyVersion: row.methodologyVersion,
    releaseId: row.releaseId,
    correction:
      row.publicCorrectionId && row.publicCorrectionStatus
        ? {
            id: row.publicCorrectionId,
            status: row.publicCorrectionStatus,
          }
        : null,
    recordedAt: row.recordedAt.toISOString(),
  }));

  return zAtlasEntityChangeHistoryDocument.parse({
    schemaVersion: ATLAS_CHANGE_HISTORY_SCHEMA_VERSION,
    entity: {
      entityType: input.citation.entityType,
      entityId: input.citation.id,
      label: input.citation.label,
      citationUrl: input.citation.citationUrl,
      readerUrl: input.citation.readerUrl,
    },
    coverage: {
      state: events.length > 0 ? "recorded_history" : "no_recorded_history",
      note: ATLAS_CHANGE_HISTORY_COVERAGE_NOTE,
    },
    events,
    pagination: {
      limit: input.limit,
      offset: input.offset,
      hasMore,
    },
  });
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** Projects a safe, inspectable old/new diff. Unknown and internal keys are
 * excluded by construction; absence is represented as `null`, never omitted. */
export function projectPublicHistoryDiff(
  entityType: AtlasHistoryEntityType,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): PublicHistoryFieldChange[] {
  const oldRow = toAtlasPublicHistorySnapshot(entityType, before) ?? {};
  const newRow = toAtlasPublicHistorySnapshot(entityType, after) ?? {};
  return PUBLIC_HISTORY_FIELDS[entityType]
    .filter((field) => hasOwn(oldRow, field) || hasOwn(newRow, field))
    .map((field) => ({
      field,
      before: hasOwn(oldRow, field) ? oldRow[field] ?? null : null,
      after: hasOwn(newRow, field) ? newRow[field] ?? null : null,
    }))
    .filter((change) => JSON.stringify(change.before) !== JSON.stringify(change.after));
}

/**
 * Projects either a database-shaped snake_case row or a Drizzle camelCase row
 * into the one closed public snapshot contract. Unknown/internal keys are
 * discarded before diffing, and dates are serialized deterministically.
 */
export function toAtlasPublicHistorySnapshot(
  entityType: AtlasHistoryEntityType,
  snapshot: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!snapshot) return null;
  const projected: Record<string, unknown> = {};
  for (const field of PUBLIC_HISTORY_FIELDS[entityType]) {
    const camelField = snakeToCamel(field);
    if (hasOwn(snapshot, field)) {
      projected[field] = normalizePublicHistoryValue(snapshot[field]);
    } else if (hasOwn(snapshot, camelField)) {
      projected[field] = normalizePublicHistoryValue(snapshot[camelField]);
    }
  }
  return projected;
}

function normalizePublicHistoryValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, character: string) =>
    character.toUpperCase(),
  );
}

/** A writer must classify every event. The projection deliberately refuses to
 * infer a correction from changed data: that would turn ordinary refreshes
 * into an unsupported editorial judgment. */
export function isAtlasChangeKind(value: string): value is AtlasChangeKind {
  return (ATLAS_CHANGE_KINDS as readonly string[]).includes(value);
}
