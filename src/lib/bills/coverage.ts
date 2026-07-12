/**
 * ATL-013 — single source of truth for which jurisdictions the bills /
 * legislative-activity pipeline actually covers, and the display labels
 * for its source ids.
 *
 * Derived directly from the six deployed cron routes under
 * `src/app/api/cron/bills/{us,uk,ca,de,fr,br}/route.ts` (each calls
 * `runBillsSync` with a fixed `jurisdictionSlug`/`iso2`) — not a guess.
 * `src/lib/bills/__tests__/atl-013-bills-coverage.test.ts` reads those six
 * route files as text and asserts this list matches them, so drift between
 * "what the crons actually sync" and "what we tell readers is covered"
 * fails a test instead of silently rotting.
 *
 * Consumers:
 *  - `src/components/factbook/FactbookBills.tsx` — supported-country
 *    coverage note + chamber/source chips on the Civica Data → Bills
 *    section.
 *  - `src/app/api/countries/[slug]/bills/route.ts` — the public bills API;
 *    returns an explicit `coverage` object (not a bare empty array) for
 *    jurisdictions outside this list.
 */

export interface BillsSupportedJurisdiction {
  /** `jurisdictions.slug` — matches the cron's `jurisdictionSlug` option. */
  slug: string;
  /** `jurisdictions.iso2` — matches the cron's `iso2` option. */
  iso2: string;
  name: string;
  /** `bills.source_id` values this jurisdiction's cron(s) write. */
  sourceIds: string[];
}

export const BILLS_SUPPORTED_JURISDICTIONS: readonly BillsSupportedJurisdiction[] =
  [
    {
      slug: "united-states",
      iso2: "US",
      name: "United States",
      sourceIds: ["congress_gov"],
    },
    {
      slug: "united-kingdom",
      iso2: "GB",
      name: "United Kingdom",
      sourceIds: ["uk_parliament"],
    },
    {
      slug: "canada",
      iso2: "CA",
      name: "Canada",
      sourceIds: ["legisinfo_ca"],
    },
    {
      slug: "germany",
      iso2: "DE",
      name: "Germany",
      sourceIds: ["bundestag_dip"],
    },
    {
      slug: "france",
      iso2: "FR",
      name: "France",
      sourceIds: ["data_assemblee_fr", "senat_fr"],
    },
    {
      slug: "brazil",
      iso2: "BR",
      name: "Brazil",
      sourceIds: ["camara_br", "senado_br"],
    },
  ];

export const BILLS_SUPPORTED_JURISDICTION_NAMES: readonly string[] =
  BILLS_SUPPORTED_JURISDICTIONS.map((j) => j.name);

export function isBillsSupportedSlug(slug: string): boolean {
  return BILLS_SUPPORTED_JURISDICTIONS.some((j) => j.slug === slug);
}

/** Publisher-facing label for each `bills.source_id`. */
export const BILLS_SOURCE_LABELS: Record<string, string> = {
  congress_gov: "U.S. Congress",
  uk_parliament: "UK Parliament",
  legisinfo_ca: "Parliament of Canada",
  camara_br: "Câmara dos Deputados",
  senado_br: "Senado Federal",
  bundestag_dip: "Bundestag",
  data_assemblee_fr: "Assemblée Nationale",
  senat_fr: "Sénat",
};

/**
 * The 0–4 normalised stage scale every source adapter maps onto (see
 * `src/lib/bills/stage.ts`). Kept alongside the jurisdiction list because
 * both are "how to read a bill row" taxonomy published to readers.
 */
export const BILLS_STAGE_LABELS: readonly string[] = [
  "Draft",
  "Committee",
  "Lower Floor",
  "Upper House",
  "Enacted",
];

/**
 * For an UNSUPPORTED jurisdiction: explains the gap instead of leaving a
 * bare empty bills list. Used by the public API route's `coverage.message`.
 */
export function billsCoverageMessage(countryName?: string): string {
  const names = BILLS_SUPPORTED_JURISDICTION_NAMES.join(", ");
  const subject = countryName ? `${countryName} is` : "This jurisdiction is";
  return `Civica's bills and legislative-activity tracking currently covers six jurisdictions: ${names}. ${subject} not yet in that set — this is a coverage gap, not a claim that no legislation is being considered.`;
}

/**
 * For a SUPPORTED jurisdiction whose bills ARE rendering: states the same
 * six-jurisdiction scope without implying the current country is missing
 * from it. Used by `FactbookBills.tsx`, which only ever renders for a
 * supported country (see the Bills done-when note in that file).
 */
export function billsSupportedCoverageNote(): string {
  const names = BILLS_SUPPORTED_JURISDICTION_NAMES.join(", ");
  return `Civica's bills and legislative-activity tracking currently covers six jurisdictions: ${names}.`;
}
