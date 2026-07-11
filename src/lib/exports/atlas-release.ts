import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SOURCE_RIGHTS } from "@/lib/rights/manifest";
import { parseAtlasVintageLabel } from "@/lib/data/frozen-vintage";

export const ATLAS_EXPORT_SCHEMA_VERSION = "civica-atlas-export/v2" as const;
export const ATLAS_EXPORT_RELEASE_ID = "atlas-2026-07-11" as const;
export const ATLAS_EXPORT_RELEASE_DATE = "2026-07-11" as const;
export const ATLAS_EXPORT_VINTAGE_LABEL = "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1" as const;

export const ATLAS_EXPORT_ALLOWED_SOURCE_IDS = SOURCE_RIGHTS.filter(
  (row) => row.reviewStatus === "verified" && row.publicExport === "allowed",
)
  .map((row) => row.sourceId)
  .sort();

export interface AtlasExportInput {
  jurisdictions: Record<string, unknown>[];
  facts: Record<string, unknown>[];
}

export function buildAtlasExport(input: AtlasExportInput) {
  const jurisdictions = [...input.jurisdictions].sort((a, b) =>
    String(a.slug).localeCompare(String(b.slug)),
  );
  const facts = [...input.facts].sort((a, b) =>
    [a.jurisdiction_id, a.fact_key, a.source_id, a.id]
      .map(String)
      .join("\u0000")
      .localeCompare(
        [b.jurisdiction_id, b.fact_key, b.source_id, b.id]
          .map(String)
          .join("\u0000"),
      ),
  );
  const usedSourceIds = [
    ...new Set(facts.map((row) => String(row.source_id))),
  ].sort();
  const identity = parseAtlasVintageLabel(ATLAS_EXPORT_VINTAGE_LABEL);
  const invalidVintageRows = facts.filter((row) =>
    row.vintage_label !== ATLAS_EXPORT_VINTAGE_LABEL ||
    row.civica_publication_version !== ATLAS_EXPORT_VINTAGE_LABEL ||
    row.methodology_version !== identity.methodologyVersion ||
    typeof row.content_hash !== "string" || !/^[a-f0-9]{64}$/.test(row.content_hash),
  );
  if (invalidVintageRows.length) {
    throw new Error(`Atlas export contains ${invalidVintageRows.length} row(s) outside the frozen vintage/version/hash contract.`);
  }
  const cutTimes = [...new Set(facts.map((row) => String(row.cut_at_timestamp)))];
  if (cutTimes.length !== 1 || cutTimes[0] === "null" || cutTimes[0] === "undefined") {
    throw new Error(`Atlas export requires one frozen cutoff; found ${cutTimes.join(", ") || "none"}.`);
  }
  const jurisdictionIds = new Set(jurisdictions.map((row) => String(row.id)));
  const orphanJurisdictionIds = [
    ...new Set(
      facts
        .map((row) => String(row.jurisdiction_id))
        .filter((id) => !jurisdictionIds.has(id)),
    ),
  ].sort();
  if (orphanJurisdictionIds.length) {
    throw new Error(
      `Atlas export contains facts for missing jurisdictions: ${orphanJurisdictionIds.join(", ")}`,
    );
  }
  const blocked = usedSourceIds.filter(
    (sourceId) => !ATLAS_EXPORT_ALLOWED_SOURCE_IDS.includes(sourceId),
  );
  if (blocked.length) {
    throw new Error(`Atlas export contains blocked sources: ${blocked.join(", ")}`);
  }
  const sources = SOURCE_RIGHTS.filter((row) =>
    usedSourceIds.includes(row.sourceId),
  ).sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  return {
    schemaVersion: ATLAS_EXPORT_SCHEMA_VERSION,
    releaseId: ATLAS_EXPORT_RELEASE_ID,
    releaseDate: ATLAS_EXPORT_RELEASE_DATE,
    vintageLabel: ATLAS_EXPORT_VINTAGE_LABEL,
    cutoffAt: cutTimes[0],
    generatedAt: `${ATLAS_EXPORT_RELEASE_DATE}T00:00:00.000Z`,
    scope:
      "Frozen canonical Atlas reference records from the named Q1 snapshot only. Civica Index, Pulse, alternates, restricted source rows, images, and publisher payloads are excluded.",
    rightsManifest: "/api/rights-manifest",
    tables: { jurisdictions, facts, sources },
    codebook: {
      jurisdictions:
        "Stable Civica jurisdiction identity and sourced status classification.",
      facts:
        "As-published canonical selections copied from the immutable named vintage; current post-cut values and alternate observations are excluded.",
      sources:
        "Source-specific license, terms, attribution, and restriction records for every emitted fact row.",
      joins: {
        "facts.jurisdiction_id": "jurisdictions.id",
        "facts.source_id": "sources.sourceId",
      },
      ordering: {
        jurisdictions: "slug ascending",
        facts: "jurisdiction_id, fact_key, source_id, id ascending",
        sources: "sourceId ascending",
      },
      columns: {
        jurisdictions: {
          id: "Stable Civica UUID.", slug: "Stable URL identifier.", name: "Display name.", type: "Closed jurisdiction-status/v1 class.",
          iso2: "ISO alpha-2 code when assigned.", iso3: "ISO alpha-3 code when assigned.", wikidata_qid: "Wikidata entity identifier when linked.",
          status_source_ids: "Source registry keys supporting the status classification.", status_reviewed_at: "Date Civica reviewed the status classification.",
          status_note: "Neutral scope and classification note.", administering_jurisdiction_iso3: "Administering jurisdiction ISO3 where applicable.", status_disputed: "Whether the territorial/status record is disputed.",
        },
        facts: {
          id: "Stable frozen-vintage row UUID.", canonical_fact_id: "Source-observation row selected at the cutoff.", jurisdiction_id: "Foreign key to jurisdictions.id.", fact_key: "Stable Civica fact identifier.", fact_group: "Reconciliation group A, B, or C.", category: "Reader-facing fact category.",
          source_id: "Foreign key to sources.sourceId.", source_url: "Direct upstream record URL when captured.", fact_value: "Source display value.", fact_value_numeric: "Numeric form when available; zero is observed, not missing.", fact_unit: "Unit attached to the value.", value_json: "Structured value when scalar columns are insufficient.",
          value_status: "Closed data-value-state/v1 status.", value_status_reason: "Required explanation for non-observed states.", as_of: "Upstream observation/reference date.", observation_reference_year: "Year the observation describes; never an ingestion or release year.", upstream_dataset_release: "Publisher/distributor dataset edition, distinct from observation year.", source_retrieved_at: "When Civica retrieved the selected source row, when retained at or before the cut.", civica_publication_version: "Civica's named publication handle.", methodology_version: "Published Civica method version.", value_type: "Measured or projected source value.", growth_methodology: "Growth-rate basis where applicable.", vintage_label: "Immutable Civica citation handle.", cut_at_timestamp: "Shared Civica publication cutoff for the vintage.", content_hash: "SHA-256 of the frozen value, source, date, and method recipe.", is_disputed_at_cut: "Whether the canonical selection was disputed when frozen.", supersedes_vintage_label: "Earlier release replaced by this version, when applicable.",
        },
        sources: {
          sourceId: "Stable source identifier.", licenseId: "Source license or legal designation.", termsUrl: "Publisher terms URL.", reviewStatus: "Civica rights-review status.", reviewedAt: "Rights review date.", publicExport: "Bulk-export permission decision.", commercialUse: "Whether source terms allow commercial use.", derivatives: "Whether source terms allow derivatives.", attributionRequired: "Whether source terms require attribution.", shareAlikeRequired: "Whether share-alike applies.", restrictions: "Source-specific cautions and conditions.",
        },
      },
    },
    counts: {
      jurisdictions: jurisdictions.length,
      facts: facts.length,
      sources: sources.length,
    },
  };
}

export function serializeAtlasExport(value: ReturnType<typeof buildAtlasExport>) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function atlasExportSha256(serialized: string) {
  return createHash("sha256").update(serialized).digest("hex");
}

export function buildAtlasReleaseBom(input: {
  release: ReturnType<typeof buildAtlasExport>;
  serialized: string;
  compressed: Uint8Array;
  codeCommit: string;
  tools: Record<string, string>;
}) {
  const { release, serialized, compressed } = input;
  const sourceInputs = release.tables.sources.map((source) => {
    const rows = release.tables.facts.filter(
      (fact) => fact.source_id === source.sourceId,
    );
    const labels = [...new Set(rows.map((row) => row.upstream_dataset_release).filter(Boolean).map(String))].sort();
    const years = rows.map((row) => row.observation_reference_year).filter((value): value is number => typeof value === "number");
    const retrieved = rows.map((row) => row.source_retrieved_at).filter(Boolean).map(String).sort();
    return {
      sourceId: source.sourceId,
      rowCount: rows.length,
      upstreamVintageLabels: labels,
      observationYearMin: years.length ? Math.min(...years) : null,
      observationYearMax: years.length ? Math.max(...years) : null,
      retrievedThrough: retrieved.at(-1) ?? null,
      semanticSha256: createHash("sha256")
        .update(JSON.stringify(rows))
        .digest("hex"),
    };
  });
  return {
    schemaVersion: "civica-release-bom/v1",
    releaseId: release.releaseId,
    releaseDate: release.releaseDate,
    exportSourceCommit: input.codeCommit,
    schemas: {
      export: release.schemaVersion,
      rights: "rights-manifest/v1",
      jurisdictionStatus: "jurisdiction-status/v1",
      dataValueState: "data-value-state/v1",
    },
    tools: Object.fromEntries(Object.entries(input.tools).sort(([a], [b]) => a.localeCompare(b))),
    files: [
      {
        role: "normalized-export",
        path: "atlas-export.v1.json.gz",
        encoding: "gzip",
        semanticSha256: atlasExportSha256(serialized),
        uncompressedByteLength: Buffer.byteLength(serialized),
        fileSha256: createHash("sha256").update(compressed).digest("hex"),
        fileByteLength: compressed.byteLength,
      },
    ],
    rowCounts: release.counts,
    sourceInputs,
    publicDownload: `/downloads/civica-${release.releaseId}.json.gz`,
  };
}

function resultRows(result: unknown): Record<string, unknown>[] {
  return (Array.isArray(result)
    ? result
    : ((result as { rows?: Record<string, unknown>[] }).rows ?? [])) as Record<
    string,
    unknown
  >[];
}

/**
 * Maps a database join to the public row. Every citation-defining field comes
 * from the immutable snapshot aliases; mutable source-row fields are limited
 * to descriptive metadata that the vintage schema did not yet copy.
 */
export function frozenSnapshotExportFact(row: Record<string, unknown>) {
  return {
    id: row.snapshot_id,
    canonical_fact_id: row.canonical_fact_id,
    jurisdiction_id: row.jurisdiction_id,
    fact_key: row.fact_key,
    fact_group: row.fact_group,
    category: row.category,
    source_id: row.snapshot_source_id,
    source_url: row.source_url,
    fact_value: row.snapshot_value_text,
    fact_value_numeric: row.snapshot_value_numeric,
    fact_unit: row.snapshot_value_unit,
    value_json: row.snapshot_value_json,
    value_status: row.value_status,
    value_status_reason: row.value_status_reason,
    as_of: row.snapshot_as_of,
    observation_reference_year: row.observation_reference_year,
    upstream_dataset_release: row.upstream_dataset_release,
    source_retrieved_at: row.source_retrieved_at,
    civica_publication_version: row.civica_publication_version,
    methodology_version: row.snapshot_methodology_version,
    value_type: row.value_type,
    growth_methodology: row.growth_methodology,
    vintage_label: row.vintage_label,
    cut_at_timestamp: row.cut_at_timestamp,
    content_hash: row.content_hash,
    is_disputed_at_cut: row.is_disputed_at_cut,
    supersedes_vintage_label: row.supersedes_vintage_label,
  };
}

export async function loadAtlasExportInput(): Promise<AtlasExportInput> {
  const allowed = ATLAS_EXPORT_ALLOWED_SOURCE_IDS;
  const [jurisdictionResult, factResult] = await Promise.all([
    db.execute(sql`
      SELECT id, slug, name, type, iso2, iso3, wikidata_qid,
             status_source_ids, status_reviewed_at, status_note,
             administering_jurisdiction_iso3, status_disputed
      FROM jurisdictions
      ORDER BY slug
    `),
    db.execute(sql`
      SELECT v.id AS snapshot_id, v.canonical_fact_id, v.jurisdiction_id, v.fact_key,
             cf.fact_group, cf.category, v.source_id AS snapshot_source_id, cf.source_url,
             v.value_text AS snapshot_value_text,
             v.value_numeric AS snapshot_value_numeric,
             v.value_unit AS snapshot_value_unit,
             v.value_json AS snapshot_value_json,
             cf.value_status, cf.value_status_reason, v.as_of AS snapshot_as_of,
             v.observation_reference_year, v.upstream_dataset_release,
             v.source_retrieved_at, v.civica_publication_version,
             v.methodology_version AS snapshot_methodology_version,
             cf.value_type, cf.growth_methodology,
             v.vintage_label, v.cut_at_timestamp, v.content_hash,
             v.is_disputed_at_cut, v.supersedes_vintage_label
      FROM country_fact_vintages v
      JOIN country_facts cf ON cf.id = v.canonical_fact_id
      WHERE v.vintage_label = ${ATLAS_EXPORT_VINTAGE_LABEL}
        AND v.source_id IN ${allowed}
      ORDER BY v.jurisdiction_id, v.fact_key, v.source_id, v.id
    `),
  ]);
  return {
    jurisdictions: resultRows(jurisdictionResult),
    facts: resultRows(factResult).map(frozenSnapshotExportFact),
  };
}
