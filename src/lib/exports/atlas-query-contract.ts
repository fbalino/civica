export const ATLAS_QUERY_SCHEMA_VERSION = "civica-atlas-query/v1" as const;
export const ATLAS_QUERY_RELEASE_ID = "atlas-2026-07-11" as const;
export const ATLAS_QUERY_EXPORT_SCHEMA_VERSION =
  "civica-atlas-export/v3" as const;
export const ATLAS_QUERY_BULK_DOWNLOAD =
  "/downloads/civica-atlas-2026-07-11.json.gz" as const;
export const ATLAS_QUERY_MANIFEST_DOWNLOAD =
  "/downloads/civica-atlas-2026-07-11.manifest.json" as const;
export const ATLAS_QUERY_RIGHTS_MANIFEST = "/api/rights-manifest" as const;

export const ATLAS_QUERY_TABLES = [
  "jurisdictions",
  "facts",
  "sources",
] as const;
export type AtlasQueryTable = (typeof ATLAS_QUERY_TABLES)[number];

export const ATLAS_QUERY_COLUMNS = {
  jurisdictions: [
    "id",
    "slug",
    "name",
    "type",
    "iso2",
    "iso3",
    "wikidata_qid",
    "status_source_ids",
    "status_reviewed_at",
    "status_note",
    "administering_jurisdiction_iso3",
    "status_disputed",
  ],
  facts: [
    "id",
    "canonical_fact_id",
    "jurisdiction_id",
    "fact_key",
    "fact_group",
    "category",
    "source_id",
    "source_url",
    "fact_value",
    "fact_value_numeric",
    "fact_unit",
    "value_json",
    "value_status",
    "value_status_reason",
    "as_of",
    "observation_reference_year",
    "upstream_dataset_release",
    "source_retrieved_at",
    "civica_publication_version",
    "methodology_version",
    "value_type",
    "growth_methodology",
    "vintage_label",
    "cut_at_timestamp",
    "content_hash",
    "is_disputed_at_cut",
    "supersedes_vintage_label",
  ],
  sources: [
    "sourceId",
    "licenseId",
    "termsUrl",
    "reviewStatus",
    "reviewedAt",
    "publicExport",
    "commercialUse",
    "derivatives",
    "attributionRequired",
    "shareAlikeRequired",
    "restrictions",
  ],
} as const satisfies Record<AtlasQueryTable, readonly string[]>;

export const ATLAS_QUERY_DEFAULT_FIELDS = {
  jurisdictions: ["id", "slug", "name", "type", "iso2", "iso3", "status_disputed"],
  facts: [
    "id",
    "jurisdiction_id",
    "fact_key",
    "fact_value",
    "fact_value_numeric",
    "fact_unit",
    "value_status",
    "observation_reference_year",
    "source_id",
    "source_url",
    "upstream_dataset_release",
    "vintage_label",
    "content_hash",
  ],
  sources: [...ATLAS_QUERY_COLUMNS.sources],
} as const satisfies Record<AtlasQueryTable, readonly string[]>;
