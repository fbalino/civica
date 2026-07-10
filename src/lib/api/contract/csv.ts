/**
 * CLM-012 — CSV contract for `/api/countries/:slug/export?format=csv`.
 *
 * Single source of truth for the CSV header row and the citation
 * comment-block template, shared by the real export route handler
 * (`src/app/api/countries/[slug]/export/route.ts`) and by
 * `contract/registry.ts` / the docs / tests. Preserves the exact
 * current runtime output byte-for-byte — this is a refactor, not a
 * format change.
 */

export const COUNTRY_EXPORT_CSV_COLUMNS = [
  "category",
  "key",
  "value",
  "numeric_value",
  "unit",
  "year",
] as const;

export const COUNTRY_EXPORT_CSV_HEADER = COUNTRY_EXPORT_CSV_COLUMNS.join(",");

export interface CountryExportCsvFact {
  category: string | null;
  key: string;
  value: string | null;
  numericValue: number | null;
  unit: string | null;
  year: number | null;
}

export interface CountryExportCsvCitationInput {
  countryName: string;
  reconciliationStatus: string;
  reconciliationVersion: string;
  reconciliationVintage: string;
  reconciliationReference: string;
}

/** One CSV data row per fact, matching `COUNTRY_EXPORT_CSV_COLUMNS` order. */
export function buildCountryExportCsvRow(fact: CountryExportCsvFact): string {
  return [
    fact.category,
    fact.key,
    `"${(fact.value ?? "").replace(/"/g, '""')}"`,
    fact.numericValue ?? "",
    fact.unit ?? "",
    fact.year ?? "",
  ].join(",");
}

// PUBLIC_CLAIM: export.provenance-coverage
/** Self-describing citation comment block prepended to the CSV body. */
export function buildCountryExportCsvCitation(
  input: CountryExportCsvCitationInput,
): string {
  return [
    `# Civica Atlas country export — ${input.countryName}`,
    `# Reconciliation: ${input.reconciliationStatus} ${input.reconciliationVersion}`,
    `# Vintage: ${input.reconciliationVintage}`,
    `# Methodology: ${input.reconciliationReference}`,
    `# JSON adds provenance for supported headline fields; facts[] rows remain without per-row provenance.`,
  ].join("\n");
}

export function buildCountryExportCsv(
  citation: CountryExportCsvCitationInput,
  facts: CountryExportCsvFact[],
): string {
  return [
    buildCountryExportCsvCitation(citation),
    COUNTRY_EXPORT_CSV_HEADER,
    ...facts.map(buildCountryExportCsvRow),
  ].join("\n");
}
