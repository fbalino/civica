/**
 * Growth-methodology labeling — Option E (owner-adopted).
 *
 * Resolution: `~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md`
 *
 * Different publishers report GDP growth on different measurement bases.
 * The raw numbers are NOT directly comparable across bases, so every
 * `gdp_real_growth_rate` source row carries a `growth_methodology`
 * discriminator (a `country_facts` column). This module is the single
 * source of truth for:
 *
 *   - the controlled vocabulary (`GrowthMethodology`, re-exported from the
 *     schema so DB + app agree),
 *   - the per-source default basis (`GROWTH_METHODOLOGY_BY_SOURCE`) used by
 *     the backfill and by sync scripts at write time,
 *   - the human-readable tooltip/InfoTip copy (`growthMethodologyTooltip`)
 *     and short label (`growthMethodologyLabel`),
 *   - the resolver predicate (`isAnnualYoy`) for the Q3 canonical rule.
 */

import type { GrowthMethodology } from "@/lib/db/schema";

export type { GrowthMethodology } from "@/lib/db/schema";

/** The five controlled-vocabulary values, as a runtime set for coercion. */
const GROWTH_METHODOLOGY_VALUES = new Set<GrowthMethodology>([
  "annual_yoy",
  "four_quarter_accumulated_yoy",
  "qoq_seasonally_adjusted",
  "annualized_qoq",
  "unspecified",
]);

/**
 * Coerce a raw DB value (possibly null / a legacy string) into a valid
 * `GrowthMethodology`, or `null` when absent. Unknown non-null strings
 * fall back to `"unspecified"` so a stray value never crashes the UI.
 */
export function coerceGrowthMethodology(
  raw: string | null | undefined,
): GrowthMethodology | null {
  if (raw == null) return null;
  return GROWTH_METHODOLOGY_VALUES.has(raw as GrowthMethodology)
    ? (raw as GrowthMethodology)
    : "unspecified";
}

/**
 * Per-source default growth-methodology basis for `gdp_real_growth_rate`
 * (and its `gdp_growth_rate` legacy alias). From the resolution's
 * per-publisher table:
 *
 *   - Stats SA (P0441): quarter-on-quarter, seasonally adjusted.
 *   - IBGE / Brazil (table 5932): four-quarter accumulated YoY.
 *   - World Bank / IMF / Eurostat / CIA / ONS-UK / INSEE-FR and most
 *     national statistics offices: annual year-on-year.
 *
 * A source absent from this map falls back to `"unspecified"`.
 */
export const GROWTH_METHODOLOGY_BY_SOURCE: Record<string, GrowthMethodology> = {
  stats_sa: "qoq_seasonally_adjusted",
  ibge_br: "four_quarter_accumulated_yoy",
  world_bank: "annual_yoy",
  imf_weo: "annual_yoy",
  eurostat: "annual_yoy",
  cia_factbook: "annual_yoy",
  ons_uk: "annual_yoy",
  insee_fr: "annual_yoy",
  statcan_ca: "annual_yoy",
};

/** The growth fact-keys the methodology label is meaningful on. */
const GROWTH_FACT_KEYS = new Set(["gdp_real_growth_rate", "gdp_growth_rate"]);

/**
 * Resolve a row's growth methodology for use by the resolver and UI.
 *
 * The stored `country_facts.growth_methodology` column (set by the backfill
 * and, going forward, by sync scripts at write time) is authoritative. When
 * it is NULL — e.g. a brand-new country's growth row inserted before the
 * next backfill — we fall back to the per-source default so the resolver's
 * comparability rule and the UI stay correct without waiting on a re-label.
 * Returns NULL on non-growth fact-keys.
 */
export function resolveGrowthMethodology(
  stored: string | null | undefined,
  sourceId: string,
  factKey: string,
): GrowthMethodology | null {
  if (!GROWTH_FACT_KEYS.has(factKey)) return null;
  const coerced = coerceGrowthMethodology(stored);
  if (coerced != null) return coerced;
  return GROWTH_METHODOLOGY_BY_SOURCE[sourceId] ?? "unspecified";
}

/** The comparable default: annual year-on-year growth. */
export function isAnnualYoy(m: GrowthMethodology | null | undefined): boolean {
  return m === "annual_yoy";
}

/** Short human label for a methodology basis (sentence-case, no period). */
export function growthMethodologyLabel(m: GrowthMethodology): string {
  switch (m) {
    case "annual_yoy":
      return "Annual, year-on-year";
    case "four_quarter_accumulated_yoy":
      return "Four-quarter accumulated, year-on-year";
    case "qoq_seasonally_adjusted":
      return "Quarter-on-quarter, seasonally adjusted";
    case "annualized_qoq":
      return "Quarter-on-quarter, annualized";
    case "unspecified":
      return "Basis not specified";
  }
}

/**
 * Plain-words tooltip copy for the InfoTip shown beside a growth figure.
 * States the basis and, when it is not the comparable annual default,
 * flags that the figure is not directly comparable to annual figures.
 * Returns `null` for the annual default and for unspecified — an InfoTip
 * is only warranted when the basis genuinely differs from the reader's
 * expectation of an annual figure.
 */
export function growthMethodologyTooltip(
  m: GrowthMethodology | null | undefined,
): string | null {
  switch (m) {
    case "four_quarter_accumulated_yoy":
      return (
        "Four-quarter accumulated growth — the cumulative rate over the " +
        "last four quarters versus the same period a year earlier. Close " +
        "to an annual figure but built from the latest quarterly data."
      );
    case "qoq_seasonally_adjusted":
      return (
        "Quarter-on-quarter, seasonally adjusted — growth from the " +
        "previous quarter, not directly comparable to annual figures."
      );
    case "annualized_qoq":
      return (
        "Quarter-on-quarter annualized — the latest quarter's growth " +
        "projected out to a full year, not directly comparable to " +
        "measured annual figures."
      );
    case "annual_yoy":
    case "unspecified":
    case null:
    case undefined:
      return null;
  }
}
