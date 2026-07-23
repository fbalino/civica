import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { spreadsheetSafeCsvCell } from "@/lib/exports/csv";
import {
  ATLAS_QUERY_BULK_DOWNLOAD,
  ATLAS_QUERY_COLUMNS,
  ATLAS_QUERY_DEFAULT_FIELDS,
  ATLAS_QUERY_EXPORT_SCHEMA_VERSION,
  ATLAS_QUERY_MANIFEST_DOWNLOAD,
  ATLAS_QUERY_RELEASE_ID,
  ATLAS_QUERY_RIGHTS_MANIFEST,
  ATLAS_QUERY_SCHEMA_VERSION,
  ATLAS_QUERY_TABLES,
  type AtlasQueryTable,
} from "@/lib/exports/atlas-query-contract";

export {
  ATLAS_QUERY_BULK_DOWNLOAD,
  ATLAS_QUERY_COLUMNS,
  ATLAS_QUERY_DEFAULT_FIELDS,
  ATLAS_QUERY_EXPORT_SCHEMA_VERSION,
  ATLAS_QUERY_MANIFEST_DOWNLOAD,
  ATLAS_QUERY_RELEASE_ID,
  ATLAS_QUERY_RIGHTS_MANIFEST,
  ATLAS_QUERY_SCHEMA_VERSION,
  ATLAS_QUERY_TABLES,
  type AtlasQueryTable,
} from "@/lib/exports/atlas-query-contract";

export const ATLAS_QUERY_EXCLUSIONS = Object.freeze([
  {
    id: "civica-index",
    reason:
      "The Civica Index is a separate research experiment and is not part of the frozen Atlas reference export.",
  },
  {
    id: "civica-pulse",
    reason:
      "Pulse event evidence and experimental numeric outputs are outside the Atlas release.",
  },
  {
    id: "alternate-and-rejected-observations",
    reason:
      "The checked Q1 release retained canonical selections only; alternates, projections, and rejected rows are not reconstructed.",
  },
  {
    id: "restricted-sources",
    reason:
      "Rows whose source-specific rights do not permit public bulk export are excluded rather than reassigned.",
  },
  {
    id: "images-and-constitution-text",
    reason:
      "Images and constitution full text have separate rights and display contracts and are not redistributed here.",
  },
  {
    id: "raw-publisher-payloads",
    reason:
      "Raw publisher payloads are retained only where permitted and never enter this normalized public query surface.",
  },
] as const);

interface AtlasQueryManifestFile {
  path: string;
  semanticSha256: string;
  fileSha256: string;
}

interface AtlasQueryManifest {
  schemaVersion: string;
  releaseId: string;
  releaseDate: string;
  files: AtlasQueryManifestFile[];
}

export interface AtlasQueryRelease {
  schemaVersion: string;
  releaseId: string;
  releaseDate: string;
  vintageLabel: string;
  cutoffAt: string;
  generatedAt: string;
  scope: string;
  rightsManifest: string;
  tables: Record<AtlasQueryTable, Record<string, unknown>[]>;
  codebook: {
    columns: Record<AtlasQueryTable, Record<string, string>>;
    joins: Record<string, string>;
    ordering: Record<AtlasQueryTable, string>;
    [key: string]: unknown;
  };
  counts: Record<AtlasQueryTable, number>;
}

export interface AtlasQueryInput {
  table: AtlasQueryTable;
  fields?: string[];
  jurisdiction?: string[];
  factKey?: string[];
  source?: string[];
  status?: string[];
  valueStatus?: string[];
  yearFrom?: number;
  yearTo?: number;
  limit: number;
  offset: number;
}

export interface AtlasQueryRequestSelection {
  table: AtlasQueryTable;
  fields?: string[];
  jurisdiction?: string[];
  fact_key?: string[];
  source?: string[];
  status?: string[];
  value_status?: string[];
  year_from?: number;
  year_to?: number;
  limit: number;
  offset: number;
}

/** Keep the API route and frozen case-study replayer on one request mapping. */
export function atlasQueryInputFromRequest(
  query: AtlasQueryRequestSelection,
): AtlasQueryInput {
  return {
    table: query.table,
    fields: query.fields,
    jurisdiction: query.jurisdiction,
    factKey: query.fact_key,
    source: query.source,
    status: query.status,
    valueStatus: query.value_status,
    yearFrom: query.year_from,
    yearTo: query.year_to,
    limit: query.limit,
    offset: query.offset,
  };
}

export interface AtlasQueryResult {
  schemaVersion: typeof ATLAS_QUERY_SCHEMA_VERSION;
  release: {
    id: string;
    date: string;
    vintageLabel: string;
    cutoffAt: string;
    exportSchemaVersion: string;
    semanticSha256: string;
    bulkDownload: typeof ATLAS_QUERY_BULK_DOWNLOAD;
    manifestDownload: typeof ATLAS_QUERY_MANIFEST_DOWNLOAD;
  };
  query: {
    table: AtlasQueryTable;
    fields: string[];
    filters: {
      jurisdiction: string[];
      factKey: string[];
      source: string[];
      status: string[];
      valueStatus: string[];
      yearFrom: number | null;
      yearTo: number | null;
    };
  };
  data: Record<string, unknown>[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
    previousOffset: number | null;
  };
  schema: {
    table: AtlasQueryTable;
    columns: Record<string, string>;
    joins: Record<string, string>;
    ordering: string;
  };
  rights: {
    manifest: typeof ATLAS_QUERY_RIGHTS_MANIFEST;
    policy: "frozen-release-allowlist";
    note: string;
    sources: Record<string, unknown>[];
  };
  exclusions: typeof ATLAS_QUERY_EXCLUSIONS;
}

export interface LoadedAtlasQueryRelease {
  release: AtlasQueryRelease;
  semanticSha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseManifest(value: unknown): AtlasQueryManifest {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("Atlas query manifest is malformed");
  }
  const files = value.files.filter(isRecord).map((file) => ({
    path: String(file.path ?? ""),
    semanticSha256: String(file.semanticSha256 ?? ""),
    fileSha256: String(file.fileSha256 ?? ""),
  }));
  const manifest = {
    schemaVersion: String(value.schemaVersion ?? ""),
    releaseId: String(value.releaseId ?? ""),
    releaseDate: String(value.releaseDate ?? ""),
    files,
  };
  if (
    manifest.releaseId !== ATLAS_QUERY_RELEASE_ID ||
    !manifest.releaseDate ||
    files.length !== 1 ||
    files[0].path !== "atlas-export.v1.json.gz" ||
    !/^[a-f0-9]{64}$/.test(files[0].semanticSha256) ||
    !/^[a-f0-9]{64}$/.test(files[0].fileSha256)
  ) {
    throw new Error("Atlas query manifest identity drifted");
  }
  return manifest;
}

function parseRelease(value: unknown): AtlasQueryRelease {
  if (!isRecord(value) || !isRecord(value.tables) || !isRecord(value.codebook)) {
    throw new Error("Atlas query release is malformed");
  }
  const release = value as unknown as AtlasQueryRelease;
  if (
    release.schemaVersion !== ATLAS_QUERY_EXPORT_SCHEMA_VERSION ||
    release.releaseId !== ATLAS_QUERY_RELEASE_ID ||
    typeof release.releaseDate !== "string" ||
    typeof release.vintageLabel !== "string" ||
    typeof release.cutoffAt !== "string" ||
    typeof release.generatedAt !== "string" ||
    typeof release.scope !== "string" ||
    release.rightsManifest !== ATLAS_QUERY_RIGHTS_MANIFEST ||
    !isRecord(release.codebook.columns) ||
    !isRecord(release.codebook.joins) ||
    !isRecord(release.codebook.ordering) ||
    !isRecord(release.counts)
  ) {
    throw new Error("Atlas query release identity drifted");
  }

  for (const table of ATLAS_QUERY_TABLES) {
    const rows = release.tables[table];
    const columns = release.codebook.columns[table];
    if (
      !Array.isArray(rows) ||
      !isRecord(columns) ||
      release.counts[table] !== rows.length
    ) {
      throw new Error(`Atlas query ${table} table contract drifted`);
    }
    const expectedColumns = ATLAS_QUERY_COLUMNS[table];
    const expectedColumnSet = new Set<string>(expectedColumns);
    if (
      expectedColumns.some((column) => !(column in columns)) ||
      rows.some(
        (row) =>
          !isRecord(row) ||
          Object.keys(row).some((column) => !expectedColumnSet.has(column)),
      )
    ) {
      throw new Error(`Atlas query ${table} column allowlist drifted`);
    }
  }
  if (
    release.tables.sources.some(
      (source) =>
        source.reviewStatus !== "verified" || source.publicExport !== "allowed",
    )
  ) {
    throw new Error("Atlas query release contains a blocked source");
  }
  return release;
}

export function parseAtlasQueryArtifact(
  compressed: Uint8Array,
  manifestSource: string,
): LoadedAtlasQueryRelease {
  const manifest = parseManifest(JSON.parse(manifestSource));
  const file = manifest.files[0];
  if (sha256(compressed) !== file.fileSha256) {
    throw new Error("Atlas query compressed artifact hash mismatch");
  }
  const serialized = gunzipSync(compressed).toString("utf8");
  if (sha256(serialized) !== file.semanticSha256) {
    throw new Error("Atlas query semantic artifact hash mismatch");
  }
  const release = parseRelease(JSON.parse(serialized));
  if (release.releaseDate !== manifest.releaseDate) {
    throw new Error("Atlas query release date differs from its manifest");
  }
  return { release, semanticSha256: file.semanticSha256 };
}

const ARTIFACT = resolve(
  process.cwd(),
  "data/releases/atlas-2026-07-11/atlas-export.v1.json.gz",
);
const MANIFEST = resolve(
  process.cwd(),
  "data/releases/atlas-2026-07-11/manifest.v1.json",
);

let loadedRelease: Promise<LoadedAtlasQueryRelease> | null = null;

export function loadAtlasQueryRelease(): Promise<LoadedAtlasQueryRelease> {
  loadedRelease ??= Promise.all([readFile(ARTIFACT), readFile(MANIFEST, "utf8")])
    .then(([artifact, manifest]) => parseAtlasQueryArtifact(artifact, manifest))
    .catch((error) => {
      loadedRelease = null;
      throw error;
    });
  return loadedRelease;
}

export function atlasQueryCompatibilityError(
  input: AtlasQueryInput,
): string | null {
  const fields = input.fields?.length
    ? input.fields
    : [...ATLAS_QUERY_DEFAULT_FIELDS[input.table]];
  const allowed = new Set<string>(ATLAS_QUERY_COLUMNS[input.table]);
  const invalid = fields.filter((field) => !allowed.has(field));
  if (invalid.length) {
    return `Unknown ${input.table} field(s): ${invalid.join(", ")}`;
  }
  if (
    input.yearFrom !== undefined &&
    input.yearTo !== undefined &&
    input.yearFrom > input.yearTo
  ) {
    return "year_from must be less than or equal to year_to";
  }
  const incompatible: string[] = [];
  if (input.table === "jurisdictions") {
    if (input.factKey?.length) incompatible.push("fact_key");
    if (input.source?.length) incompatible.push("source");
    if (input.valueStatus?.length) incompatible.push("value_status");
    if (input.yearFrom !== undefined) incompatible.push("year_from");
    if (input.yearTo !== undefined) incompatible.push("year_to");
  } else if (input.table === "sources") {
    if (input.jurisdiction?.length) incompatible.push("jurisdiction");
    if (input.factKey?.length) incompatible.push("fact_key");
    if (input.status?.length) incompatible.push("status");
    if (input.valueStatus?.length) incompatible.push("value_status");
    if (input.yearFrom !== undefined) incompatible.push("year_from");
    if (input.yearTo !== undefined) incompatible.push("year_to");
  }
  return incompatible.length
    ? `Filter(s) not available for ${input.table}: ${incompatible.join(", ")}`
    : null;
}

function lowerSet(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.toLowerCase()));
}

function projectRow(
  row: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
}

export function runAtlasQuery(
  loaded: LoadedAtlasQueryRelease,
  input: AtlasQueryInput,
): AtlasQueryResult {
  const compatibilityError = atlasQueryCompatibilityError(input);
  if (compatibilityError) throw new Error(compatibilityError);

  const { release } = loaded;
  const fields = input.fields?.length
    ? [...input.fields]
    : [...ATLAS_QUERY_DEFAULT_FIELDS[input.table]];
  const jurisdictionTokens = lowerSet(input.jurisdiction);
  const factKeys = lowerSet(input.factKey);
  const sourceIds = lowerSet(input.source);
  const statuses = lowerSet(input.status);
  const valueStatuses = lowerSet(input.valueStatus);
  const jurisdictionById = new Map(
    release.tables.jurisdictions.map((row) => [String(row.id), row]),
  );
  const matchingJurisdictionIds = new Set(
    release.tables.jurisdictions
      .filter((row) => {
        if (!jurisdictionTokens.size) return true;
        return [row.id, row.slug, row.iso2, row.iso3]
          .filter((value) => typeof value === "string")
          .some((value) => jurisdictionTokens.has(String(value).toLowerCase()));
      })
      .filter(
        (row) =>
          !statuses.size || statuses.has(String(row.type).toLowerCase()),
      )
      .map((row) => String(row.id)),
  );

  const filtered = release.tables[input.table].filter((row) => {
    if (input.table === "jurisdictions") {
      return matchingJurisdictionIds.has(String(row.id));
    }
    if (input.table === "sources") {
      return !sourceIds.size || sourceIds.has(String(row.sourceId).toLowerCase());
    }
    const jurisdiction = jurisdictionById.get(String(row.jurisdiction_id));
    if (!jurisdiction || !matchingJurisdictionIds.has(String(jurisdiction.id))) {
      return false;
    }
    if (factKeys.size && !factKeys.has(String(row.fact_key).toLowerCase())) {
      return false;
    }
    if (sourceIds.size && !sourceIds.has(String(row.source_id).toLowerCase())) {
      return false;
    }
    if (
      valueStatuses.size &&
      !valueStatuses.has(String(row.value_status).toLowerCase())
    ) {
      return false;
    }
    const year =
      typeof row.observation_reference_year === "number"
        ? row.observation_reference_year
        : null;
    if (input.yearFrom !== undefined && (year === null || year < input.yearFrom)) {
      return false;
    }
    if (input.yearTo !== undefined && (year === null || year > input.yearTo)) {
      return false;
    }
    return true;
  });

  const page = filtered
    .slice(input.offset, input.offset + input.limit)
    .map((row) => projectRow(row, fields));
  const pageSourceIds =
    input.table === "facts"
      ? new Set(
          filtered
            .slice(input.offset, input.offset + input.limit)
            .map((row) => String(row.source_id)),
        )
      : input.table === "sources"
        ? new Set(page.map((row) => String(row.sourceId)))
        : new Set<string>();
  const sourceRights = release.tables.sources.filter((source) =>
    pageSourceIds.has(String(source.sourceId)),
  );
  const nextOffset =
    input.offset + input.limit < filtered.length
      ? input.offset + input.limit
      : null;
  const previousOffset =
    input.offset > 0 ? Math.max(0, input.offset - input.limit) : null;

  return {
    schemaVersion: ATLAS_QUERY_SCHEMA_VERSION,
    release: {
      id: release.releaseId,
      date: release.releaseDate,
      vintageLabel: release.vintageLabel,
      cutoffAt: release.cutoffAt,
      exportSchemaVersion: release.schemaVersion,
      semanticSha256: loaded.semanticSha256,
      bulkDownload: ATLAS_QUERY_BULK_DOWNLOAD,
      manifestDownload: ATLAS_QUERY_MANIFEST_DOWNLOAD,
    },
    query: {
      table: input.table,
      fields,
      filters: {
        jurisdiction: input.jurisdiction ?? [],
        factKey: input.factKey ?? [],
        source: input.source ?? [],
        status: input.status ?? [],
        valueStatus: input.valueStatus ?? [],
        yearFrom: input.yearFrom ?? null,
        yearTo: input.yearTo ?? null,
      },
    },
    data: page,
    meta: {
      total: filtered.length,
      limit: input.limit,
      offset: input.offset,
      hasMore: nextOffset !== null,
      nextOffset,
      previousOffset,
    },
    schema: {
      table: input.table,
      columns: Object.fromEntries(
        fields.map((field) => [
          field,
          release.codebook.columns[input.table][field],
        ]),
      ),
      joins: release.codebook.joins,
      ordering: release.codebook.ordering[input.table],
    },
    rights: {
      manifest: ATLAS_QUERY_RIGHTS_MANIFEST,
      policy: "frozen-release-allowlist",
      note:
        input.table === "jurisdictions"
          ? "Jurisdiction rows are Civica-normalized status classifications; status_source_ids are citation identifiers, not redistribution licenses. Consult the rights manifest before reusing underlying publisher material."
          : input.table === "sources"
            ? "These rows are the frozen release's source-specific rights metadata."
            : "Every source represented on this fact page has a matching frozen source-rights row below.",
      sources: sourceRights,
    },
    exclusions: ATLAS_QUERY_EXCLUSIONS,
  };
}

export function atlasQueryCsv(result: AtlasQueryResult): string {
  const rows = [
    result.query.fields,
    ...result.data.map((row) =>
      result.query.fields.map((field) => row[field] ?? null),
    ),
  ];
  return `${rows
    .map((row) => row.map(spreadsheetSafeCsvCell).join(","))
    .join("\n")}\n`;
}
