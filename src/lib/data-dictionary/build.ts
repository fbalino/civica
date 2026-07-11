import { createHash } from "node:crypto";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as dbSchema from "../db/schema";
import {
  DATA_DICTIONARY_VERSION,
  TABLE_POLICIES,
  type DeprecationStatus,
  type TablePolicy,
} from "./registry";

export interface DictionaryKey {
  primary: boolean;
  unique: boolean;
  indexed: boolean;
  foreignKey: string | null;
  indexGroups: string[];
  uniqueGroups: string[];
}

export interface DictionaryColumn {
  name: string;
  propertyName: string;
  definition: string;
  sqlType: string;
  nullable: boolean;
  nullableMeaning: string;
  hasDefault: boolean;
  unit: string;
  key: DictionaryKey;
  sourceOrDerivation: string;
  cadence: string;
  vintageSemantics: string;
  rights: string;
  deprecation: DeprecationStatus;
}

export interface DictionaryTable extends TablePolicy {
  name: string;
  exportName: string;
  columns: DictionaryColumn[];
}

export interface SchemaDataDictionary {
  version: string;
  reviewedAt: string;
  generatedFrom: string;
  schemaFingerprint: string;
  summary: {
    tables: number;
    columns: number;
    publicAtlasTables: number;
    researchBetaTables: number;
    supportTables: number;
    internalTables: number;
    privateTables: number;
    legacyTables: number;
  };
  nullSemanticsLimitation: string;
  tables: DictionaryTable[];
}

interface NamedColumn {
  name: string;
}

interface RuntimeColumn extends NamedColumn {
  primary: boolean;
  isUnique: boolean;
  notNull: boolean;
  hasDefault: boolean;
  getSQLType(): string;
}

interface RuntimeIndex {
  config: {
    name: string;
    unique: boolean;
    columns: unknown[];
  };
}

interface RuntimeForeignKey {
  reference(): {
    columns: NamedColumn[];
    foreignColumns: NamedColumn[];
    foreignTable: unknown;
  };
}

interface RuntimeTableConfig {
  name: string;
  columns: RuntimeColumn[];
  indexes: RuntimeIndex[];
  foreignKeys: RuntimeForeignKey[];
}

const FIELD_DEFINITIONS: Readonly<Record<string, string>> = {
  id: "Stable row identifier.",
  jurisdiction_id: "Identifier of the jurisdiction represented by this row.",
  source_id:
    "Identifier of the registered source responsible for this observation or record.",
  source_url: "Direct upstream URL captured for this record when available.",
  source_hash:
    "Stable hash of the captured upstream payload/value used for change detection and replay.",
  created_at: "Timestamp when Civica created this row.",
  updated_at: "Timestamp when Civica last updated this row.",
  retrieved_at: "Timestamp when Civica retrieved the upstream material.",
  fetched_at: "Timestamp when Civica fetched the upstream material.",
  last_sync_at:
    "Timestamp of the latest successful positive-row sync for this source.",
  last_synced_at:
    "Timestamp when this record was last refreshed by its source adapter.",
  methodology_version:
    "Version of the Civica method that produced or interprets this row.",
  derivation_version_key:
    "Stable content-derived identifier for the complete row-level derivation-version envelope.",
  derivation_versions:
    "Structured row-level versions for methodology, algorithm, prompt, taxonomy, and source basket, including explicit legacy or not-applicable states.",
  version_key:
    "Content-addressed identifier for the immutable Pulse stage-version envelope.",
  versions:
    "Structured Pulse stage identity covering method, ontology, pipeline, algorithm, prompt, provider/model set, source basket, and upstream runs.",
  ingest_run_id: "Immutable Pulse ingest-stage run that created this raw item.",
  cluster_run_id:
    "Write-once Pulse cluster-stage run that assigned this raw item to a cluster.",
  classification_run_id:
    "Immutable Pulse classification-stage run that produced or rejected this event candidate.",
  corroboration_run_id:
    "Latest versioned Pulse corroboration-stage run applied to this event.",
  publication_run_id:
    "Pulse classification or review run responsible for the event's current publication state.",
  computation_run_id:
    "Pulse score-stage run responsible for the stored computed output.",
  run_id: "Immutable Pulse pipeline-stage run linked to this audit action.",
  evidence_identity_key:
    "Content-addressed identity binding the Pulse source snapshot, retrieval time, language, publisher, attribution evidence, and captured rights posture.",
  evidence_content_hash:
    "SHA-256 identity of the exact source payload and extracted evidence retained for the Pulse raw item.",
  evidence_language:
    "BCP 47 language code declared by the source, or und when unavailable.",
  evidence_publisher:
    "Ingest-time publisher, source-family, canonical-source, item-host, and source-type snapshot.",
  evidence_attribution:
    "Ingest-time jurisdiction resolution status, raw country label, resolved jurisdiction, evidence, and resolver version.",
  evidence_rights:
    "Ingest-time source terms, review status, redistribution posture, and public-export restriction snapshot.",
  evidence_retention:
    "Private snapshot storage, hashing, link-rot protection, and public-payload distribution policy.",
  counts:
    "Structured terminal row and outcome counts recorded for the pipeline run.",
  failures: "Structured component failures retained for the pipeline run.",
  source_version:
    "Publisher release/version identifier captured for the source input.",
  data_year: "Reference or observation year of the source data.",
  data_vintage_year:
    "Underlying measurement/reference year used for freshness comparison.",
  fact_year: "Year label assigned to the fact by its upstream publisher.",
  upstream_vintage_label:
    "Publisher-supplied release or vintage label retained verbatim.",
  as_of: "Upstream effective or observation date for the value.",
  status:
    "Current workflow or record status under this table's declared contract.",
  status_reason: "Reason recorded for the current status.",
  name: "Human-readable name of the entity or record.",
  slug: "Stable URL-safe Civica identifier.",
  iso2: "ISO-style two-letter geographic code when assigned.",
  iso3: "ISO-style three-letter geographic code when assigned.",
  wikidata_qid: "Wikidata entity identifier retained for source linkage.",
  wikidata_pid: "Wikidata property identifier retained for claim linkage.",
  license:
    "Declared source license label; authoritative reuse posture is resolved through the rights manifest.",
  fact_key: "Stable Civica identifier for the asserted fact concept.",
  fact_value: "Human-readable representation of the source observation.",
  fact_value_numeric:
    "Numeric representation of the source observation when the concept is numeric.",
  fact_unit: "Unit declared for the fact value.",
  value_json:
    "Structured representation used when a scalar text or numeric value is insufficient.",
  value_type:
    "Whether the observation is measured, projected, estimated, or another declared value class.",
  value_status:
    "Closed data-availability state: observed, missing, unknown, not applicable, not observed, disputed, or withheld.",
  value_status_reason:
    "Required explanation for every non-observed data-availability state; null only for observed values.",
  references: "Structured upstream references captured with the source claim.",
  event_date: "Date on which the represented event occurred.",
  published_at: "Publisher timestamp for the source item.",
  ingested_at: "Timestamp when the item entered the Civica pipeline.",
  calculated_at: "Timestamp when Civica calculated the derived value.",
  completed_at: "Timestamp when the operation completed.",
  started_at: "Timestamp when the operation started.",
  effective_from:
    "Beginning of the record or methodology's effective interval.",
  effective_to: "End of the record or methodology's effective interval.",
  valid_from: "Beginning of the assertion's declared validity interval.",
  valid_to: "End of the assertion's declared validity interval.",
  content_hash:
    "Hash of the captured content used for deduplication and replay identity.",
  raw_payload:
    "Structured source payload retained for audit or replay subject to source rights.",
  metadata: "Structured metadata governed by this table's row contract.",
  notes: "Free-text notes recorded for review or interpretation.",
  reason: "Recorded reason for the associated action or decision.",
};

function isTable(value: unknown): boolean {
  try {
    const config = getTableConfig(value as never);
    return Array.isArray(config.columns) && config.columns.length > 0;
  } catch {
    return false;
  }
}

function humanize(name: string): string {
  return name.replaceAll("_", " ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isNamedColumn(value: unknown): value is NamedColumn {
  return Boolean(
    value &&
    typeof value === "object" &&
    "name" in value &&
    typeof (value as { name?: unknown }).name === "string",
  );
}

function nullableMeaningFor(table: string, column: string) {
  const stateful = new Set([
    "country_facts",
    "indicator_history",
    "country_metrics",
  ]);
  if (
    stateful.has(table) &&
    ["fact_value", "fact_value_numeric", "value_json", "value"].includes(column)
  ) {
    return "Null is interpreted through value_status and value_status_reason; it is never a substitute for zero or an unlabeled unknown value.";
  }
  if (stateful.has(table) && column === "value_status_reason") {
    return "Null is permitted only when value_status is observed; every other state requires a non-empty reason.";
  }
  return "Null means no value is stored. This column has no data-availability companion; interpret absence only under its table/field contract.";
}

function definitionFor(
  name: string,
  policy: TablePolicy,
  key: DictionaryKey,
): string {
  if (FIELD_DEFINITIONS[name]) return FIELD_DEFINITIONS[name];
  if (key.foreignKey) {
    return `${capitalize(humanize(name))}; relational link to ${key.foreignKey}.`;
  }
  const grain = policy.rowGrain.replace(/^One /, "the ").replace(/\.$/, "");
  return `${capitalize(humanize(name))} recorded for ${grain}.`;
}

function unitFor(name: string, sqlType: string): string {
  if (name === "gdp_billions") return "billions of current US dollars";
  if (name === "area_sq_km") return "square kilometres";
  if (name.includes("percent") || name.endsWith("_pct"))
    return "percentage points (0–100 unless source documentation states otherwise)";
  if (
    name.includes("probability") ||
    name.includes("confidence") ||
    name.includes("score") ||
    name.includes("index") ||
    name.includes("weight") ||
    name.includes("delta")
  ) {
    return "dimensionless; scale defined by the linked methodology or source";
  }
  if (
    name.endsWith("_year") ||
    name === "year" ||
    name.endsWith("_year_updated")
  )
    return "Gregorian calendar year";
  if (sqlType === "date") return "ISO 8601 calendar date";
  if (sqlType.startsWith("timestamp"))
    return "UTC timestamp (database type currently omits timezone)";
  if (name.includes("duration") || name.endsWith("_ms"))
    return name.endsWith("_ms")
      ? "milliseconds"
      : "duration in the unit declared by the producer";
  if (
    /(^|_)(count|seats|votes|population|total|rank|order|limit)$/.test(name) ||
    /_(count|seats|votes|population|total|rank|order)$/.test(name)
  )
    return "count";
  if (name === "fact_value_numeric") return "record-specific; see fact_unit";
  return "not applicable";
}

function temporalSemantics(name: string, policy: TablePolicy): string {
  if (name === "created_at")
    return "Civica row-creation time; not an observation or publisher vintage.";
  if (name === "updated_at")
    return "Civica row-update time; not an observation or publisher vintage.";
  if (
    name === "retrieved_at" ||
    name === "fetched_at" ||
    name === "ingested_at" ||
    name === "last_synced_at" ||
    name === "last_sync_at"
  ) {
    return "Civica retrieval/processing time; distinct from source observation and release vintage.";
  }
  if (
    name.includes("methodology_version") ||
    name === "method_version" ||
    name === "version"
  ) {
    return "Interpretation/version identifier; not a source observation date.";
  }
  if (
    name.includes("vintage") ||
    name.endsWith("_year") ||
    name === "year" ||
    name === "as_of" ||
    name.includes("date") ||
    name.endsWith("_at")
  ) {
    return `${capitalize(humanize(name))} follows this table contract. ${policy.vintageSemantics}`;
  }
  return policy.vintageSemantics;
}

function sourceFor(
  name: string,
  policy: TablePolicy,
  key: DictionaryKey,
): string {
  if (key.primary && name === "id")
    return "Civica-generated database identifier.";
  if (key.foreignKey)
    return `Relational identifier referencing ${key.foreignKey}; substantive provenance follows this table's source contract.`;
  if (name === "created_at" || name === "updated_at" || name.endsWith("_at")) {
    return `Civica processing metadata. Substantive row origin: ${policy.sourceOrDerivation}`;
  }
  if (
    name.startsWith("source_") ||
    name === "references" ||
    name.startsWith("wikidata_")
  ) {
    return `Captured source-lineage metadata. ${policy.sourceOrDerivation}`;
  }
  return policy.sourceOrDerivation;
}

function columnDeprecation(
  tableName: string,
  columnName: string,
  policy: TablePolicy,
): DeprecationStatus {
  if (policy.deprecation.status === "legacy") return policy.deprecation;
  if (
    tableName === "jurisdictions" &&
    [
      "capital",
      "population",
      "gdp_billions",
      "area_sq_km",
      "languages",
      "currency",
      "democracy_index",
    ].includes(columnName)
  ) {
    return {
      status: "legacy",
      replacement: "country_facts resolver and statement-level provenance",
      note: "Denormalized read cache retained for list/search performance; not a canonical research observation.",
    };
  }
  return { status: "active" };
}

export function buildSchemaDataDictionary(): SchemaDataDictionary {
  const tables: DictionaryTable[] = [];
  const seenPolicies = new Set<string>();

  for (const [exportName, table] of Object.entries(dbSchema).filter(
    ([, value]) => isTable(value),
  )) {
    const config = getTableConfig(
      table as never,
    ) as unknown as RuntimeTableConfig;
    const policy = TABLE_POLICIES[config.name];
    if (!policy)
      throw new Error(
        `data dictionary missing table policy for ${config.name}`,
      );
    seenPolicies.add(config.name);

    const indexed = new Map<string, string[]>();
    const unique = new Map<string, string[]>();
    const individuallyUnique = new Set<string>();
    for (const index of config.indexes) {
      const columnsInIndex = (index.config.columns ?? []).filter(isNamedColumn);
      if (index.config.unique && columnsInIndex.length === 1) {
        individuallyUnique.add(columnsInIndex[0].name);
      }
      for (const column of columnsInIndex) {
        if (!column?.name) continue;
        indexed.set(column.name, [
          ...(indexed.get(column.name) ?? []),
          index.config.name,
        ]);
        if (index.config.unique)
          unique.set(column.name, [
            ...(unique.get(column.name) ?? []),
            index.config.name,
          ]);
      }
    }
    const foreign = new Map<string, string>();
    for (const foreignKey of config.foreignKeys) {
      const reference = foreignKey.reference();
      const foreignConfig = getTableConfig(reference.foreignTable as never);
      reference.columns.forEach((column, index) => {
        foreign.set(
          column.name,
          `${foreignConfig.name}.${reference.foreignColumns[index]?.name ?? "id"}`,
        );
      });
    }

    const propertyByColumn = new Map<string, string>();
    for (const [propertyName, column] of Object.entries(
      table as unknown as Record<string, unknown>,
    )) {
      if (column && typeof column === "object" && "name" in column) {
        propertyByColumn.set((column as { name: string }).name, propertyName);
      }
    }

    const columns = config.columns.map((column) => {
      const key: DictionaryKey = {
        primary: Boolean(column.primary),
        unique: Boolean(column.isUnique || individuallyUnique.has(column.name)),
        indexed: indexed.has(column.name),
        foreignKey: foreign.get(column.name) ?? null,
        indexGroups: indexed.get(column.name) ?? [],
        uniqueGroups: unique.get(column.name) ?? [],
      };
      const sqlType = column.getSQLType();
      const nullable = !column.notNull;
      return {
        name: column.name,
        propertyName: propertyByColumn.get(column.name) ?? column.name,
        definition: definitionFor(column.name, policy, key),
        sqlType,
        nullable,
        nullableMeaning: nullable
          ? nullableMeaningFor(config.name, column.name)
          : "Not nullable; every stored row must supply this field or a database default.",
        hasDefault: Boolean(column.hasDefault),
        unit: unitFor(column.name, sqlType),
        key,
        sourceOrDerivation: sourceFor(column.name, policy, key),
        cadence: policy.cadence,
        vintageSemantics: temporalSemantics(column.name, policy),
        rights: policy.rights,
        deprecation: columnDeprecation(config.name, column.name, policy),
      } satisfies DictionaryColumn;
    });

    tables.push({ name: config.name, exportName, ...policy, columns });
  }

  const orphanPolicies = Object.keys(TABLE_POLICIES).filter(
    (name) => !seenPolicies.has(name),
  );
  if (orphanPolicies.length) {
    throw new Error(
      `data dictionary policies do not map to schema tables: ${orphanPolicies.join(", ")}`,
    );
  }

  tables.sort((a, b) => a.name.localeCompare(b.name));
  for (const table of tables)
    table.columns.sort((a, b) => a.name.localeCompare(b.name));

  const structuralShape = tables.map((table) => ({
    name: table.name,
    columns: table.columns.map((column) => ({
      name: column.name,
      propertyName: column.propertyName,
      sqlType: column.sqlType,
      nullable: column.nullable,
      hasDefault: column.hasDefault,
      key: column.key,
    })),
  }));
  const schemaFingerprint = createHash("sha256")
    .update(JSON.stringify(structuralShape))
    .digest("hex");

  const count = (scope: TablePolicy["releaseScope"]) =>
    tables.filter((table) => table.releaseScope === scope).length;
  return {
    version: DATA_DICTIONARY_VERSION,
    reviewedAt: "2026-07-10",
    generatedFrom: "src/lib/db/schema.ts + src/lib/data-dictionary/registry.ts",
    schemaFingerprint,
    summary: {
      tables: tables.length,
      columns: tables.reduce((sum, table) => sum + table.columns.length, 0),
      publicAtlasTables: count("atlas_public"),
      researchBetaTables: count("research_beta"),
      supportTables: count("public_support"),
      internalTables: count("internal_operational"),
      privateTables: count("private_submission"),
      legacyTables: tables.filter(
        (table) => table.deprecation.status === "legacy",
      ).length,
    },
    nullSemanticsLimitation:
      "Country facts, indicator history, and country metrics use the closed value_status/value_status_reason contract. Other nullable fields retain field-specific meanings and must not be inferred as zero, unknown, or not applicable without an explicit companion contract.",
    tables,
  };
}

export function dictionaryValidationErrors(
  dictionary: SchemaDataDictionary,
): string[] {
  const errors: string[] = [];
  if (dictionary.summary.tables !== dictionary.tables.length)
    errors.push("summary table count does not match table inventory");
  const columns = dictionary.tables.flatMap((table) => table.columns);
  if (dictionary.summary.columns !== columns.length)
    errors.push("summary column count does not match column inventory");
  for (const table of dictionary.tables) {
    for (const field of [
      "definition",
      "rowGrain",
      "sourceOrDerivation",
      "cadence",
      "vintageSemantics",
      "rights",
    ] as const) {
      if (!table[field]?.trim())
        errors.push(`${table.name} is missing ${field}`);
    }
    if (!table.columns.length)
      errors.push(`${table.name} has no documented columns`);
    for (const column of table.columns) {
      for (const field of [
        "definition",
        "sqlType",
        "nullableMeaning",
        "unit",
        "sourceOrDerivation",
        "cadence",
        "vintageSemantics",
        "rights",
      ] as const) {
        if (!String(column[field] ?? "").trim())
          errors.push(`${table.name}.${column.name} is missing ${field}`);
      }
      if (/\b(TODO|TBD)\b/i.test(JSON.stringify(column)))
        errors.push(
          `${table.name}.${column.name} contains placeholder metadata`,
        );
    }
  }
  return errors;
}

export function canonicalDictionaryJson(
  dictionary: SchemaDataDictionary,
): string {
  return `${JSON.stringify(dictionary, null, 2)}\n`;
}

// Retained as a small pure seam for seeded drift tests.
export function sameDictionary(
  left: SchemaDataDictionary,
  right: SchemaDataDictionary,
): boolean {
  return canonicalDictionaryJson(left) === canonicalDictionaryJson(right);
}
