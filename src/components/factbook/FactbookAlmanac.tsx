"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
import { HeroReveal, HeroRevealItem } from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { CountryDirectory } from "@/components/country/CountryDirectory";
import {
  AlmanacFilters,
  EMPTY_FILTER_STATE,
  countryMatchesFilters,
  totalActiveFilters,
  type FilterCategory,
  type FilterState,
} from "@/components/factbook/AlmanacFilters";
import type { JurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";

/** One country row as fed to the almanac. */
export interface FactbookAlmanacCountry {
  id: string | number;
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  capital: string | null;
  /** Raw DB continent (Asia, Africa, Europe, North America, South America, Oceania, ...). */
  continent: string | null;
  /** Phase F World Bank region — canonical human-readable string. */
  region?: string | null;
  /** Phase F World Bank income group — canonical human-readable string. */
  incomeGroup?: string | null;
  /** Phase F V-Dem Regimes of the World — canonical human-readable string. */
  regimeType?: string | null;
  status: JurisdictionStatusPresentation;
}

/* ── Region model ──────────────────────────────────────────────────────
   The DB stores 7 continents; the picker collapses them into the five
   reader-facing regions from mockup C (N+S America → "Americas"; the
   handful of Antarctic territories fold into Oceania). Each region owns a
   colored dot token used both on the quick-filter chips and per-row. */
type RegionKey = "all" | "africa" | "americas" | "asia" | "europe" | "oceania";

interface RegionDef {
  key: RegionKey;
  label: string;
  /** CSS var driving the chip + row dot color. */
  dotVar: string;
  /** editorial-chip tonal modifier for the active state wash. */
  chipTone: string;
}

const REGIONS: RegionDef[] = [
  { key: "all", label: "All regions", dotVar: "", chipTone: "" },
  { key: "africa", label: "Africa", dotVar: "var(--color-status-warning)", chipTone: "editorial-chip--sand" },
  { key: "americas", label: "Americas", dotVar: "var(--color-accent)", chipTone: "editorial-chip--accent" },
  { key: "asia", label: "Asia", dotVar: "var(--color-status-info)", chipTone: "editorial-chip--blue" },
  { key: "europe", label: "Europe", dotVar: "var(--color-status-success)", chipTone: "editorial-chip--sage" },
  { key: "oceania", label: "Oceania", dotVar: "var(--gov-semi)", chipTone: "" },
];

/** Map a raw DB continent to one of the five picker regions. */
function continentToRegion(continent: string | null): RegionKey {
  switch (continent) {
    case "Africa":
      return "africa";
    case "North America":
    case "South America":
      return "americas";
    case "Asia":
      return "asia";
    case "Europe":
      return "europe";
    case "Oceania":
    case "Antarctica":
      return "oceania";
    default:
      return "all";
  }
}

/** First-letter bucket for the index. Non A–Z names land under "#". */
function indexLetter(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

/* ── URL <-> filter state ────────────────────────────────────────────────
   Filters sync to the query string so a filtered view is shareable and
   survives reload (finding #29). The hero region quick-filter uses `?region=`
   (a RegionKey); each advanced-filter category uses a repeated param whose
   values are the canonical human-readable strings (they contain commas, so
   repeated params — not comma-joined — is the safe encoding). */
const VALID_REGION_KEYS: ReadonlySet<RegionKey> = new Set([
  "all",
  "africa",
  "americas",
  "asia",
  "europe",
  "oceania",
]);

/** Query-param name per advanced-filter category. */
const FILTER_PARAM: Record<FilterCategory, string> = {
  region: "f_region",
  income: "f_income",
  regime: "f_regime",
};
const FILTER_CATEGORIES: FilterCategory[] = [
  "region",
  "income",
  "regime",
];

/** Parse repeated `?region=` params into a Set (empty = all regions). */
function regionsFromParams(params: URLSearchParams): Set<RegionKey> {
  const next = new Set<RegionKey>();
  for (const raw of params.getAll("region")) {
    if (raw !== "all" && VALID_REGION_KEYS.has(raw as RegionKey)) {
      next.add(raw as RegionKey);
    }
  }
  return next;
}

/** Parse the repeated advanced-filter params into a FilterState. */
function filtersFromParams(params: URLSearchParams): FilterState {
  const next: FilterState = {
    region: new Set(params.getAll(FILTER_PARAM.region)),
    income: new Set(params.getAll(FILTER_PARAM.income)),
    regime: new Set(params.getAll(FILTER_PARAM.regime)),
  };
  return next;
}

/** Serialize regions + filters into a query string (stable order). */
function buildQuery(regions: Set<RegionKey>, filters: FilterState): string {
  const params = new URLSearchParams();
  for (const r of REGIONS) {
    if (r.key !== "all" && regions.has(r.key)) params.append("region", r.key);
  }
  for (const cat of FILTER_CATEGORIES) {
    for (const value of filters[cat]) params.append(FILTER_PARAM[cat], value);
  }
  return params.toString();
}

export function FactbookAlmanac({
  countries,
  catalogAvailable,
}: {
  countries: ReadonlyArray<FactbookAlmanacCountry>;
  catalogAvailable: boolean;
}) {
  const router = useRouter();

  // SSR/static HTML renders the FULL unfiltered index (SEO: /country is a
  // statically-exported page and must ship all 253 entries in the HTML).
  // Shareable URL state is seeded CLIENT-SIDE from window.location on mount —
  // deliberately NOT useSearchParams(), which forces a Suspense/CSR bailout
  // that would put only a fallback into the static shell (broke `next build`).
  const [regions, setRegions] = useState<Set<RegionKey>>(new Set());
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER_STATE);

  // Seed once from the URL (deep links / reloads). Declared BEFORE the
  // write-back effect so mount ordering guarantees the seeded state never
  // rewrites the URL it came from (the write-back equality check no-ops).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length === 0) return;
    const seededRegions = regionsFromParams(params);
    const seededFilters = filtersFromParams(params);
    if (seededRegions.size > 0) setRegions(seededRegions);
    if (totalActiveFilters(seededFilters) > 0) setFilters(seededFilters);
  }, []);

  // Write region/filter changes back to the URL (replace, no scroll jump, no
  // history spam). Skip the very first run so we don't rewrite the URL the
  // state was just seeded from.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const query = buildQuery(regions, filters);
    const current = new URLSearchParams(window.location.search).toString();
    if (query === current) return;
    router.replace(query ? `?${query}` : "?", { scroll: false });
    // Intentionally exclude router from deps: this effect fires on
    // user-driven region/filter changes only, and reads the current URL
    // directly from window.location at fire time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions, filters]);

  const toggleFilter = useCallback(
    (category: FilterCategory, value: string) => {
      setFilters((prev) => {
        const nextSet = new Set(prev[category]);
        if (nextSet.has(value)) nextSet.delete(value);
        else nextSet.add(value);
        return { ...prev, [category]: nextSet };
      });
    },
    [],
  );

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTER_STATE), []);

  const activeFilterCount = totalActiveFilters(filters);

  // Country list scoped to the active region quick-filter AND the advanced
  // filter bar. The hero region chip and the advanced filters both narrow
  // the same underlying set; they compose.
  const inRegion = useMemo(() => {
    const regionScoped =
      regions.size === 0
        ? countries
        : countries.filter((c) => regions.has(continentToRegion(c.continent)));
    if (activeFilterCount === 0) return regionScoped;
    return regionScoped.filter((c) =>
      countryMatchesFilters(
        {
          region: c.region ?? null,
          incomeGroup: c.incomeGroup ?? null,
          regimeType: c.regimeType ?? null,
        },
        filters,
      ),
    );
  }, [countries, regions, filters, activeFilterCount]);

  // Combobox options always search the full set (search ignores the chip).
  const searchOptions = useMemo(
    () =>
      countries.map((c) => ({
        slug: c.slug,
        name: c.name,
        iso2: c.iso2,
        iso3: c.iso3,
        capital: c.capital,
        status: c.status,
      })),
    [countries],
  );

  // Group the (region-scoped) list into A–Z buckets, alphabetically.
  const groups = useMemo(() => {
    const byLetter = new Map<string, FactbookAlmanacCountry[]>();
    for (const c of [...inRegion].sort((a, b) => a.name.localeCompare(b.name))) {
      const letter = indexLetter(c.name);
      const bucket = byLetter.get(letter);
      if (bucket) bucket.push(c);
      else byLetter.set(letter, [c]);
    }
    return [...byLetter.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, items]) => ({ letter, items }));
  }, [inRegion]);

  const presentLetters = useMemo(
    () => new Set(groups.map((g) => g.letter)),
    [groups],
  );
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <div className="factbook-landing">
      {/* ── Full-bleed engraving hero with centered typeahead ── */}
      <section className="factbook-landing-hero" aria-labelledby="factbook-hero-title">
        <ParallaxImage
          className="factbook-hero-art"
          src="/engravings/pages/countries.webp"
          darkSrc="/engravings/pages/countries-dark.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="factbook-hero-scrim" aria-hidden="true" />
        <HeroReveal className="factbook-hero-inner">
          <HeroRevealItem className="factbook-hero-eyebrow">
            Countries &amp; areas
          </HeroRevealItem>
          <HeroRevealItem as="h1" id="factbook-hero-title" className="factbook-hero-title">
            Every country and area, in full.
          </HeroRevealItem>
          <HeroRevealItem as="p" className="factbook-hero-dek">
            Start typing &mdash; or browse the complete index below. Every entry is
            sourced, structured, and ready to cite.
          </HeroRevealItem>

          <HeroRevealItem className="factbook-hero-search">
            <CountrySearchCombobox
              countries={searchOptions}
              countryPathPrefix="/country"
              placeholder="Search any country or area&hellip;"
              ariaLabel="Search countries and areas"
            />
          </HeroRevealItem>

          <HeroRevealItem className="factbook-hero-chips" role="group" aria-label="Filter by region">
            {REGIONS.map((r) => {
              const active =
                r.key === "all" ? regions.size === 0 : regions.has(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  className={[
                    "editorial-chip",
                    "factbook-region-chip",
                    active ? "editorial-chip--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={active}
                  onClick={() =>
                    setRegions((prev) => {
                      if (r.key === "all") return new Set();
                      const next = new Set(prev);
                      if (next.has(r.key)) next.delete(r.key);
                      else next.add(r.key);
                      return next;
                    })
                  }
                >
                  {r.dotVar ? (
                    <span
                      className="factbook-region-chip__dot"
                      style={{ background: r.dotVar }}
                      aria-hidden="true"
                    />
                  ) : null}
                  {r.label}
                </button>
              );
            })}
          </HeroRevealItem>

          {/* Advanced filters live WITH the region chips (owner direction):
              dropdown pills right under the hero chips, selections as
              removable pills. The almanac sub-line is the live match count. */}
          <HeroRevealItem>
            <AlmanacFilters
              filters={filters}
              onToggle={toggleFilter}
              onClear={clearFilters}
            />
          </HeroRevealItem>
        </HeroReveal>
      </section>

      {/* ── Almanac index ── */}
      <div className="factbook-almanac">
        <div className="factbook-almanac-head">
          <h2 className="factbook-almanac-title">The complete index</h2>
          <p className="factbook-almanac-sub" aria-live="polite">
            {!catalogAvailable
              ? "Countries and territories are temporarily unavailable."
              : regions.size === 0 && activeFilterCount === 0
              ? `${countries.length} countries and territories, A to Z. Jump to a letter or pick from the list.`
              : `${inRegion.length} ${inRegion.length === 1 ? "entry" : "entries"} match your filters. Jump to a letter or pick from the list.`}
          </p>
        </div>


        <nav className="factbook-alpha-rail" aria-label="Jump to letter">
          {alphabet.map((letter) => {
            const present = presentLetters.has(letter);
            return present ? (
              <a key={letter} href={`#country-letter-${letter}`} className="factbook-alpha">
                {letter}
              </a>
            ) : (
              <span
                key={letter}
                className="factbook-alpha factbook-alpha--empty"
                aria-hidden="true"
              >
                {letter}
              </span>
            );
          })}
        </nav>

        {groups.length === 0 ? (
          activeFilterCount > 0 ? (
            <div className="factbook-almanac-empty" role="status">
              <p className="factbook-almanac-empty__title">
                No countries match these filters.
              </p>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <p className="factbook-almanac-empty">No countries in this region.</p>
          )
        ) : (
          <CountryDirectory
            countries={inRegion}
            hrefPrefix="/country"
            animated
          />
        )}
      </div>
    </div>
  );
}
