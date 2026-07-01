"use client";

import type { TierKey } from "@/lib/ci/tiers";

/* ── Filter model ───────────────────────────────────────────────────────
   Four advanced-filter categories layered over the region quick-filter that
   already lives in the hero. Each category filters the almanac list by a
   Phase F peer-grouping canonical fact (region / income group / regime) or
   the Civica Index tier. Logic is AND across categories, OR within a
   category (a country matches if it satisfies at least one selected value
   in every active category). All values are the human-readable canonical
   strings written by Phase F — no snake_case slugs. */

/** A category the user can filter by. */
export type FilterCategory = "region" | "income" | "regime" | "tier";

/** The selected values per category (empty set = category inactive). */
export type FilterState = Record<FilterCategory, Set<string>>;

export const EMPTY_FILTER_STATE: FilterState = {
  region: new Set(),
  income: new Set(),
  regime: new Set(),
  tier: new Set(),
};

interface FilterOption {
  /** Canonical value stored on the country row (the match key). */
  value: string;
  /** Reader-facing label. */
  label: string;
  /** editorial-chip tonal modifier applied when the chip is active. */
  tone: string;
}

interface FilterGroupDef {
  category: FilterCategory;
  /** Small-caps group label. */
  legend: string;
  options: FilterOption[];
}

/* World Bank region — canonical labels verbatim from Phase F (see
   lens-metadata.ts). Labels shortened for the chip where the canonical
   string is long; the `value` still matches the stored fact verbatim. */
const REGION_OPTIONS: FilterOption[] = [
  { value: "East Asia & Pacific", label: "East Asia & Pacific", tone: "editorial-chip--blue" },
  { value: "Europe & Central Asia", label: "Europe & Central Asia", tone: "editorial-chip--blue" },
  { value: "Latin America & Caribbean", label: "Latin America & Caribbean", tone: "editorial-chip--accent" },
  {
    value: "Middle East, North Africa, Afghanistan & Pakistan",
    label: "Middle East & North Africa",
    tone: "editorial-chip--sand",
  },
  { value: "North America", label: "North America", tone: "editorial-chip--sage" },
  { value: "South Asia", label: "South Asia", tone: "editorial-chip--blue" },
  { value: "Sub-Saharan Africa", label: "Sub-Saharan Africa", tone: "editorial-chip--sand" },
];

/* World Bank income group — canonical sentence-case labels. */
const INCOME_OPTIONS: FilterOption[] = [
  { value: "Low income", label: "Low income", tone: "editorial-chip--rose" },
  { value: "Lower middle income", label: "Lower middle income", tone: "editorial-chip--sand" },
  { value: "Upper middle income", label: "Upper middle income", tone: "editorial-chip--sage" },
  { value: "High income", label: "High income", tone: "editorial-chip--blue" },
];

/* V-Dem Regimes of the World — canonical Title Case labels. */
const REGIME_OPTIONS: FilterOption[] = [
  { value: "Closed Autocracy", label: "Closed Autocracy", tone: "editorial-chip--rose" },
  { value: "Electoral Autocracy", label: "Electoral Autocracy", tone: "editorial-chip--sand" },
  { value: "Electoral Democracy", label: "Electoral Democracy", tone: "editorial-chip--sage" },
  { value: "Liberal Democracy", label: "Liberal Democracy", tone: "editorial-chip--sage" },
];

/* Civica Index tier — the ciTier() keys. Values match TierKey exactly. */
const TIER_OPTIONS: Array<FilterOption & { value: TierKey }> = [
  { value: "exceptional", label: "Exceptional", tone: "editorial-chip--sage" },
  { value: "strong", label: "Strong", tone: "editorial-chip--sage" },
  { value: "mixed", label: "Mixed", tone: "editorial-chip--sand" },
  { value: "weak", label: "Weak", tone: "editorial-chip--sand" },
  { value: "failed", label: "Failed", tone: "editorial-chip--rose" },
];

const FILTER_GROUPS: FilterGroupDef[] = [
  { category: "region", legend: "Region", options: REGION_OPTIONS },
  { category: "income", legend: "Income group", options: INCOME_OPTIONS },
  { category: "regime", legend: "Regime type", options: REGIME_OPTIONS },
  { category: "tier", legend: "Civica Index tier", options: TIER_OPTIONS },
];

/** True when a country satisfies the active filters (AND across categories,
 *  OR within a category). A country with a `null` value for an active
 *  category never matches that category — it's filtered out. */
export function countryMatchesFilters(
  country: {
    region: string | null;
    incomeGroup: string | null;
    regimeType: string | null;
    ciTier: string | null;
  },
  filters: FilterState,
): boolean {
  if (filters.region.size > 0 && !(country.region && filters.region.has(country.region)))
    return false;
  if (
    filters.income.size > 0 &&
    !(country.incomeGroup && filters.income.has(country.incomeGroup))
  )
    return false;
  if (
    filters.regime.size > 0 &&
    !(country.regimeType && filters.regime.has(country.regimeType))
  )
    return false;
  if (filters.tier.size > 0 && !(country.ciTier && filters.tier.has(country.ciTier)))
    return false;
  return true;
}

export function totalActiveFilters(filters: FilterState): number {
  return (
    filters.region.size +
    filters.income.size +
    filters.regime.size +
    filters.tier.size
  );
}

export function AlmanacFilters({
  filters,
  onToggle,
  onClear,
  matchCount,
}: {
  filters: FilterState;
  /** Toggle one value in one category. */
  onToggle: (category: FilterCategory, value: string) => void;
  onClear: () => void;
  /** How many countries currently match — shown in the status line. */
  matchCount: number;
}) {
  const activeCount = totalActiveFilters(filters);

  return (
    <section className="almanac-filters" aria-label="Filter countries">
      <div className="almanac-filters__head">
        <h3 className="almanac-filters__title">Refine the index</h3>
        <p className="almanac-filters__status" aria-live="polite">
          {activeCount === 0
            ? "All countries shown. Combine filters to narrow the list."
            : `${matchCount} ${matchCount === 1 ? "country" : "countries"} match ${activeCount} ${
                activeCount === 1 ? "filter" : "filters"
              }.`}
        </p>
      </div>

      <div className="almanac-filters__groups">
        {FILTER_GROUPS.map((group) => {
          const selected = filters[group.category];
          return (
            <fieldset key={group.category} className="almanac-filter-group">
              <legend className="almanac-filter-group__legend">
                {group.legend}
              </legend>
              <div
                className="almanac-filter-group__chips"
                role="group"
                aria-label={`Filter by ${group.legend.toLowerCase()}`}
              >
                {group.options.map((opt) => {
                  const active = selected.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={[
                        "editorial-chip",
                        "almanac-filter-chip",
                        active ? "editorial-chip--active" : "",
                        active ? opt.tone : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-pressed={active}
                      onClick={() => onToggle(group.category, opt.value)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {activeCount > 0 ? (
        <div className="almanac-filters__actions">
          <button
            type="button"
            className="btn btn--text almanac-filters__clear"
            onClick={onClear}
          >
            Clear filters
            <span className="almanac-filters__clear-count">{activeCount}</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
