import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SOURCE_RIGHTS } from "@/lib/rights/manifest";

export const ATLAS_EXPORT_SCHEMA_VERSION = "civica-atlas-export/v1" as const;
export const ATLAS_EXPORT_RELEASE_ID = "atlas-2026-07-11" as const;
export const ATLAS_EXPORT_RELEASE_DATE = "2026-07-11" as const;

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
    generatedAt: `${ATLAS_EXPORT_RELEASE_DATE}T00:00:00.000Z`,
    scope:
      "Permitted Atlas reference records only. Civica Index, Pulse, restricted source rows, images, and publisher payloads are excluded.",
    rightsManifest: "/api/rights-manifest",
    tables: { jurisdictions, facts, sources },
    codebook: {
      jurisdictions:
        "Stable Civica jurisdiction identity and sourced status classification.",
      facts:
        "Active source observations from verified bulk-export sources; rows are not presented as a canonical selection.",
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
          id: "Stable source-observation UUID.", jurisdiction_id: "Foreign key to jurisdictions.id.", fact_key: "Stable Civica fact identifier.", fact_group: "Reconciliation group A, B, or C.", category: "Reader-facing fact category.",
          source_id: "Foreign key to sources.sourceId.", source_url: "Direct upstream record URL when captured.", fact_value: "Source display value.", fact_value_numeric: "Numeric form when available; zero is observed, not missing.", fact_unit: "Unit attached to the value.", fact_year: "Year stated by the publisher.", value_json: "Structured value when scalar columns are insufficient.",
          value_status: "Closed data-value-state/v1 status.", value_status_reason: "Required explanation for non-observed states.", as_of: "Upstream observation/reference date.", data_vintage_year: "Underlying measurement year when different from the publisher stamp.", retrieved_at: "Civica retrieval timestamp.", upstream_vintage_label: "Publisher dataset/version label.", methodology_version: "Civica admission-method version.", value_type: "Measured or projected source value.", growth_methodology: "Growth-rate basis where applicable.",
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
    const labels = [...new Set(rows.map((row) => row.upstream_vintage_label).filter(Boolean).map(String))].sort();
    const years = rows.flatMap((row) => [row.data_vintage_year, row.fact_year]).filter((value): value is number => typeof value === "number");
    const retrieved = rows.map((row) => String(row.retrieved_at)).sort();
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
      SELECT id, jurisdiction_id, fact_key, fact_group, category,
             source_id, source_url, fact_value, fact_value_numeric,
             fact_unit, fact_year, value_json, value_status,
             value_status_reason, as_of, data_vintage_year, retrieved_at,
             upstream_vintage_label, methodology_version, value_type,
             growth_methodology
      FROM country_facts
      WHERE status = 'active' AND source_id IN ${allowed}
      ORDER BY jurisdiction_id, fact_key, source_id, id
    `),
  ]);
  return {
    jurisdictions: resultRows(jurisdictionResult),
    facts: resultRows(factResult),
  };
}
