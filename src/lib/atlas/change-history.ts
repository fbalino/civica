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

export const PUBLIC_HISTORY_FIELDS: Record<AtlasHistoryEntityType, readonly string[]> = {
  fact: ["fact_value", "fact_value_numeric", "fact_unit", "fact_year", "value_status", "value_status_reason", "source_id", "source_url", "upstream_vintage_label", "methodology_version", "status", "status_reason"],
  institution: ["name", "body_type", "status", "wikidata_qid", "ipu_parline_id"],
  office: ["name", "office_type", "status", "wikidata_qid", "ipu_parline_id"],
  person: ["full_name", "role", "status", "wikidata_qid"],
  election: ["election_name", "election_date", "status", "election_type", "source_id", "source_url"],
  "constitution-passage": ["heading_label", "plain_text", "source_id", "source_url", "language_code", "translation_status", "is_current"],
  organization: ["name", "organization_type", "status", "source_id", "source_url", "upstream_vintage"],
  indicator: ["value", "value_status", "value_status_reason", "rank", "total_ranked", "source_id", "source_url", "year"],
};

export interface PublicHistoryFieldChange {
  field: string;
  before: unknown;
  after: unknown;
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
  const oldRow = before ?? {};
  const newRow = after ?? {};
  return PUBLIC_HISTORY_FIELDS[entityType]
    .filter((field) => hasOwn(oldRow, field) || hasOwn(newRow, field))
    .map((field) => ({
      field,
      before: hasOwn(oldRow, field) ? oldRow[field] ?? null : null,
      after: hasOwn(newRow, field) ? newRow[field] ?? null : null,
    }))
    .filter((change) => JSON.stringify(change.before) !== JSON.stringify(change.after));
}

/** A writer must classify every event. The projection deliberately refuses to
 * infer a correction from changed data: that would turn ordinary refreshes
 * into an unsupported editorial judgment. */
export function isAtlasChangeKind(value: string): value is AtlasChangeKind {
  return [
    "routine_refresh",
    "substantive_revision",
    "correction",
    "retraction",
    "methodology_change",
  ].includes(value);
}
