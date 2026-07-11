import { createHash } from "node:crypto";
import { stableStringify } from "@/lib/data/frozen-vintage";

export const CI_RESEARCH_PANEL_RELEASE_ID = "ci-research-panel-2000-2024-v1" as const;
export const CI_TOURNAMENT_PANEL_RELEASE_ID = "ci-research-panel-2000-2024-v2" as const;
export const CI_TOURNAMENT_PANEL_V3_RELEASE_ID = "ci-research-panel-2000-2024-v3" as const;
export const K4_PRACTICE_PANEL_RELEASE_ID = "ci-k4-practice-panel-2000-2024-v1" as const;
export const CI_RESEARCH_PANEL_SCHEMA_VERSION = "ci-research-panel/v1" as const;
export const CI_RESEARCH_PANEL_GENERATOR_VERSION = "ci-research-panel-generator/v1" as const;
export const CI_RESEARCH_PANEL_START_YEAR = 2000 as const;
export const CI_RESEARCH_PANEL_END_YEAR = 2024 as const;
export const CI_RESEARCH_PANEL_RIGHTS_POSTURE =
  "private_internal_research_only_pending_source_terms" as const;

export type PanelMissingReason =
  | "outside_comparable_series"
  | "outside_captured_release"
  | "source_not_published_for_period"
  | "source_no_observation_for_jurisdiction_period";

export interface PanelIndicatorContract {
  sourceId: string;
  sourceOwner: string;
  indicatorId: string;
  dimension: string;
  nativeUnit: string;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
  comparableStart: number;
  capturedEnd: number;
  retrievalPath: "owid_republisher" | "world_bank_api";
  uncertaintyStatus: string;
  revisionStatus: "revisable_current_harmonized_series";
  officialReference: string;
  expectedInYear(year: number): boolean;
}

export const CI_RESEARCH_PANEL_INDICATORS: readonly PanelIndicatorContract[] = Object.freeze([
  Object.freeze({
    sourceId: "vdem", sourceOwner: "V-Dem Institute", indicatorId: "v2x_libdem",
    dimension: "democratic_quality", nativeUnit: "V-Dem Liberal Democracy Index (0–1)",
    nativeMin: 0, nativeMax: 1, isInverted: false, comparableStart: 1789, capturedEnd: 2024,
    retrievalPath: "owid_republisher" as const,
    uncertaintyStatus: "credible_regions_available_upstream_not_retained",
    revisionStatus: "revisable_current_harmonized_series" as const,
    officialReference: "https://www.v-dem.net/about/v-dem-project/methodology/",
    expectedInYear: (year: number) => year >= 1789 && year <= 2024,
  }),
  Object.freeze({
    sourceId: "worldbank_wgi", sourceOwner: "World Bank Worldwide Governance Indicators", indicatorId: "rl.est",
    dimension: "rule_of_law", nativeUnit: "WGI estimate (approximately −2.5 to 2.5)",
    nativeMin: -2.5, nativeMax: 2.5, isInverted: false, comparableStart: 1996, capturedEnd: 2024,
    retrievalPath: "world_bank_api" as const,
    uncertaintyStatus: "standard_errors_available_upstream_not_retained",
    revisionStatus: "revisable_current_harmonized_series" as const,
    officialReference: "https://www.worldbank.org/content/dam/sites/govindicators/doc/The%20Worldwide%20Governance%20Indicators%202025%20Methodology%20Revision.pdf",
    expectedInYear: (year: number) => year === 2000 || (year >= 2002 && year <= 2024),
  }),
  Object.freeze({
    sourceId: "freedom_house", sourceOwner: "Freedom House", indicatorId: "fh_total_score",
    dimension: "freedom_rights", nativeUnit: "Freedom in the World total points (0–100)",
    nativeMin: 0, nativeMax: 100, isInverted: false, comparableStart: 2003, capturedEnd: 2024,
    retrievalPath: "owid_republisher" as const,
    uncertaintyStatus: "no_per_country_probability_distribution_published",
    revisionStatus: "revisable_current_harmonized_series" as const,
    officialReference: "https://freedomhouse.org/reports/freedom-world/freedom-world-research-methodology",
    expectedInYear: (year: number) => year >= 2003 && year <= 2024,
  }),
  Object.freeze({
    sourceId: "transparency_intl", sourceOwner: "Transparency International", indicatorId: "score",
    dimension: "corruption_control", nativeUnit: "Corruption Perceptions Index points (0–100)",
    nativeMin: 0, nativeMax: 100, isInverted: false, comparableStart: 2012, capturedEnd: 2024,
    retrievalPath: "owid_republisher" as const,
    uncertaintyStatus: "significance_metadata_available_upstream_not_retained",
    revisionStatus: "revisable_current_harmonized_series" as const,
    officialReference: "https://www.transparency.org/en/news/how-cpi-scores-are-calculated",
    expectedInYear: (year: number) => year >= 2012 && year <= 2024,
  }),
  Object.freeze({
    sourceId: "undp_hdi", sourceOwner: "United Nations Development Programme", indicatorId: "hdi",
    dimension: "human_development", nativeUnit: "Human Development Index (0–1)",
    nativeMin: 0, nativeMax: 1, isInverted: false, comparableStart: 1990, capturedEnd: 2023,
    retrievalPath: "owid_republisher" as const,
    uncertaintyStatus: "no_per_country_uncertainty_retained",
    revisionStatus: "revisable_current_harmonized_series" as const,
    officialReference: "https://hdr.undp.org/reports-and-publications/2020-human-development-report/data-readers-guide",
    expectedInYear: (year: number) => year >= 1990 && year <= 2023,
  }),
]);

export const CI_RESEARCH_PANEL_TEMPORAL_BREAKS = Object.freeze([
  Object.freeze({ sourceId: "vdem", kind: "release_revision", period: "every release", treatment: "current harmonized release only; never labeled as-published", reference: CI_RESEARCH_PANEL_INDICATORS[0].officialReference }),
  Object.freeze({ sourceId: "worldbank_wgi", kind: "cadence_break", period: "1996–2000 biennial; 2002 onward annual", treatment: "2001 is structural nonpublication, not imputed", reference: CI_RESEARCH_PANEL_INDICATORS[1].officialReference }),
  Object.freeze({ sourceId: "worldbank_wgi", kind: "methodology_revision", period: "2025 revision recalculated history to 1996", treatment: "current harmonized series only; prior editions are not reconstructed", reference: CI_RESEARCH_PANEL_INDICATORS[1].officialReference }),
  Object.freeze({ sourceId: "freedom_house", kind: "methodology_change", period: "2018 edition", treatment: "flagged; no mechanical adjustment or imputation", reference: CI_RESEARCH_PANEL_INDICATORS[2].officialReference }),
  Object.freeze({ sourceId: "transparency_intl", kind: "comparability_boundary", period: "2012", treatment: "pre-2012 periods are outside the comparable series", reference: CI_RESEARCH_PANEL_INDICATORS[3].officialReference }),
  Object.freeze({ sourceId: "undp_hdi", kind: "cross_edition_revision", period: "every report edition", treatment: "current internally consistent backcast only; not comparable to values printed in earlier editions", reference: CI_RESEARCH_PANEL_INDICATORS[4].officialReference }),
]);

export function panelMissingReason(contract: PanelIndicatorContract, year: number): PanelMissingReason {
  if (year < contract.comparableStart) return "outside_comparable_series";
  if (year > contract.capturedEnd) return "outside_captured_release";
  if (!contract.expectedInYear(year)) return "source_not_published_for_period";
  return "source_no_observation_for_jurisdiction_period";
}

export function researchPanelHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
