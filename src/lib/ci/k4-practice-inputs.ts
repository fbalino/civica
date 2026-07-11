import { K4_PRACTICE_PANEL_RELEASE_ID } from "./research-panel";

export const K4_PRACTICE_INPUT_SCHEMA_VERSION = "ci-k4-practice-inputs/v1" as const;
export const K4_VDEM_ARCHIVE_URL = "https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip" as const;
export const K4_VDEM_ARCHIVE_SHA256 = "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b" as const;

/** Frozen before K4 outcomes are calculated. A broad country composite is never an allowed substitute. */
export const K4_PRACTICE_INDICATORS = Object.freeze([
  Object.freeze({
    constructId: "expression_in_practice", constitutionalTopicKeys: ["express", "press", "opinion"],
    sourceId: "vdem", indicatorId: "v2x_freexp_altinf", dimension: "freedom_of_expression_practice",
    definition: "Government respect for press and media freedom, ordinary people's political discussion, and academic and cultural expression.",
    nativeUnit: "V-Dem interval index, low to high (0–1)", nativeMin: 0, nativeMax: 1,
    uncertaintyColumns: ["v2x_freexp_altinf_codelow", "v2x_freexp_altinf_codehigh"],
    semanticLimit: "This practice construct is broader than any one constitutional excerpt; it is not a measure of whether the text itself is strong.",
  }),
  Object.freeze({
    constructId: "high_court_independence_in_practice", constitutionalTopicKeys: ["judind"],
    sourceId: "vdem", indicatorId: "v2juhcind", dimension: "high_court_independence_practice",
    definition: "How often the high court avoids merely reflecting government wishes in salient cases regardless of its sincere view of the legal record.",
    nativeUnit: "V-Dem ordinal response converted to interval by its measurement model", nativeMin: -5, nativeMax: 5,
    uncertaintyColumns: ["v2juhcind_codelow", "v2juhcind_codehigh"],
    semanticLimit: "Measures high-court decisional autonomy, not appointment design, lower courts, access to justice, or judicial capacity.",
  }),
  Object.freeze({
    constructId: "clean_elections_in_practice", constitutionalTopicKeys: ["freeelec"],
    sourceId: "vdem", indicatorId: "v2xel_frefair", dimension: "clean_elections_practice",
    definition: "Absence of registration fraud, systematic irregularities, government intimidation, vote buying, and election violence.",
    nativeUnit: "V-Dem interval index, low to high (0–1)", nativeMin: 0, nativeMax: 1,
    uncertaintyColumns: ["v2xel_frefair_codelow", "v2xel_frefair_codehigh"],
    semanticLimit: "Election-year estimates are repeated within election-regime periods and may be backfilled before the first recorded election; a country-year is not necessarily a fresh election observation.",
  }),
] as const);

export const K4_PRACTICE_TEMPORAL_BREAKS = Object.freeze([
  Object.freeze({ sourceId: "vdem", period: "release 15, through 2024", treatment: "current harmonized backcast; never label values as originally published in a historical year" }),
  Object.freeze({ sourceId: "vdem", indicatorId: "v2xel_frefair", period: "within election-regime periods", treatment: "retain publisher repetition/backfill and disclose it; do not interpret each year as a new election" }),
  Object.freeze({ sourceId: "vdem", period: "future releases", treatment: "new release requires a new Civica release id and hashes; completed v1 remains immutable" }),
]);

export const K4_PRACTICE_INPUT_CONTRACT = Object.freeze({
  schemaVersion: K4_PRACTICE_INPUT_SCHEMA_VERSION,
  releaseId: K4_PRACTICE_PANEL_RELEASE_ID,
  period: { start: 2000, end: 2024 },
  upstream: { owner: "V-Dem Institute", version: "Country-Year Core v15", archiveUrl: K4_VDEM_ARCHIVE_URL, archiveSha256: K4_VDEM_ARCHIVE_SHA256, retrievedAt: "2026-07-11T10:06:09Z", codebookPath: "codebook.pdf", codebookSha256: "2cc3da9b641bbca47d75524555c3631bc4585d18d61cbb003061a0aad4863175", valuesPath: "V-Dem-CY-Core-v15.csv" },
  rights: { posture: "private_internal_research_only_pending_public_redistribution_review", publicBulkValues: false, citationRequired: true },
  missingness: { imputation: "none", state: "source_no_observation_for_jurisdiction_period" },
  seriesType: "current_harmonized_backcast_not_as_published",
  indicators: K4_PRACTICE_INDICATORS,
  temporalBreaks: K4_PRACTICE_TEMPORAL_BREAKS,
});
