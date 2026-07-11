import type { ReleaseQualityPolicy } from "./release-quality";

// These are release guardrails, not promises that every table is static. A
// deliberate release refresh updates the baseline and window in review.
export const RELEASE_QUALITY_POLICY: ReleaseQualityPolicy = {
  sourceMaxAgeDays: 180,
  minimumVintageYear: 1500,
  maximumFutureYears: 10,
  rowCounts: {
    jurisdictions: { baseline: 253, minimum: 250, maximum: 260 },
    sources: { baseline: 56, minimum: 50, maximum: 70 },
    country_facts: { baseline: 25_827, minimum: 20_000, maximum: 35_000 },
    country_fact_vintages: { baseline: 17_506, minimum: 15_000, maximum: 25_000 },
    statements: { baseline: 7_891, minimum: 6_000, maximum: 12_000 },
    elections: { baseline: 916, minimum: 750, maximum: 1_200 },
    constitutions: { baseline: 186, minimum: 175, maximum: 210 },
    legislature_parties: { baseline: 1_548, minimum: 1_200, maximum: 2_200 },
    terms: { baseline: 5_476, minimum: 4_500, maximum: 7_000 },
  },
};
