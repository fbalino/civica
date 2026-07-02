"use client";

import { useEffect, useRef, useState } from "react";
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

/* The hero's multi-select region chips are the region filter; the WB-region
   dropdown was a near-duplicate lens and is intentionally NOT rendered (the
   'region' FilterCategory stays in the model for URL compat). */
const FILTER_GROUPS: FilterGroupDef[] = [
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

/** One dropdown: a compact trigger + a multi-select checklist popover. */
function FilterDropdown({
  group,
  selected,
  open,
  onOpenChange,
  onToggle,
}: {
  group: FilterGroupDef;
  selected: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Close on outside click / Escape (Escape returns focus to the trigger).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className="almanac-dd" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`almanac-dd__trigger${selected.size > 0 ? " is-active" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {group.legend}
        {selected.size > 0 && (
          <span className="almanac-dd__count">{selected.size}</span>
        )}
        <span className="almanac-dd__caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          className="almanac-dd__menu"
          role="listbox"
          aria-multiselectable="true"
          aria-label={`Filter by ${group.legend.toLowerCase()}`}
        >
          {group.options.map((opt) => {
            const active = selected.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`almanac-dd__option${active ? " is-selected" : ""}`}
                onClick={() => onToggle(opt.value)}
              >
                <span className="almanac-dd__check" aria-hidden>
                  {active ? "✓" : ""}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AlmanacFilters({
  filters,
  onToggle,
  onClear,
}: {
  filters: FilterState;
  /** Toggle one value in one category. */
  onToggle: (category: FilterCategory, value: string) => void;
  onClear: () => void;
}) {
  const activeCount = totalActiveFilters(filters);
  // One dropdown open at a time.
  const [openCategory, setOpenCategory] = useState<FilterCategory | null>(null);

  // Active selections flattened (category order) for the removable-pill row.
  const activePills = FILTER_GROUPS.flatMap((group) =>
    group.options
      .filter((opt) => filters[group.category].has(opt.value))
      .map((opt) => ({ ...opt, category: group.category })),
  );

  return (
    <section className="almanac-filters" aria-label="Filter countries">
      <div className="almanac-filters__bar">
        {FILTER_GROUPS.map((group) => (
          <FilterDropdown
            key={group.category}
            group={group}
            selected={filters[group.category]}
            open={openCategory === group.category}
            onOpenChange={(next) =>
              setOpenCategory(next ? group.category : null)
            }
            onToggle={(value) => onToggle(group.category, value)}
          />
        ))}
      </div>

      {activePills.length > 0 && (
        <div className="almanac-filters__pills">
          {activePills.map((pill) => (
            <span
              key={`${pill.category}:${pill.value}`}
              className={`editorial-chip ${pill.tone} almanac-filter-pill`}
            >
              {pill.label}
              <button
                type="button"
                className="almanac-filter-pill__x"
                aria-label={`Remove ${pill.label} filter`}
                onClick={() => onToggle(pill.category, pill.value)}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className="btn btn--text almanac-filters__clear"
            onClick={onClear}
          >
            Clear all
          </button>
        </div>
      )}
    </section>
  );
}
