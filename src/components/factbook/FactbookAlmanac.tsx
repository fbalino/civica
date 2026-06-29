"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
import { CountryFlag } from "@/components/CountryFlag";
import { Reveal, HeroReveal, HeroRevealItem } from "@/components/motion/Reveal";

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

const REGION_DOT: Record<RegionKey, string> = {
  all: "var(--color-text-30)",
  africa: "var(--color-status-warning)",
  americas: "var(--color-accent)",
  asia: "var(--color-status-info)",
  europe: "var(--color-status-success)",
  oceania: "var(--gov-semi)",
};

/** First-letter bucket for the index. Non A–Z names land under "#". */
function indexLetter(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

export function FactbookAlmanac({
  countries,
}: {
  countries: ReadonlyArray<FactbookAlmanacCountry>;
}) {
  const [region, setRegion] = useState<RegionKey>("all");

  // Country list scoped to the active region quick-filter.
  const inRegion = useMemo(() => {
    if (region === "all") return countries;
    return countries.filter((c) => continentToRegion(c.continent) === region);
  }, [countries, region]);

  // Combobox options always search the full set (search ignores the chip).
  const searchOptions = useMemo(
    () =>
      countries.map((c) => ({
        slug: c.slug,
        name: c.name,
        iso2: c.iso2,
        iso3: c.iso3,
        capital: c.capital,
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="factbook-hero-art"
          src="/engravings/hero.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="factbook-hero-scrim" aria-hidden="true" />
        <HeroReveal className="factbook-hero-inner">
          <HeroRevealItem className="factbook-hero-eyebrow">
            The Civica Factbook
          </HeroRevealItem>
          <HeroRevealItem as="h1" id="factbook-hero-title" className="factbook-hero-title">
            Every country, in full.
          </HeroRevealItem>
          <HeroRevealItem as="p" className="factbook-hero-dek">
            Start typing &mdash; or browse the complete index below. Every entry is
            sourced, structured, and ready to cite.
          </HeroRevealItem>

          <HeroRevealItem className="factbook-hero-search">
            <CountrySearchCombobox
              countries={searchOptions}
              countryPathPrefix="/factbook"
              placeholder="Search any country&hellip;"
              ariaLabel="Search countries"
            />
          </HeroRevealItem>

          <HeroRevealItem className="factbook-hero-chips" role="group" aria-label="Filter by region">
            {REGIONS.map((r) => {
              const active = region === r.key;
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
                  onClick={() => setRegion(r.key)}
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
        </HeroReveal>
      </section>

      {/* ── Almanac index ── */}
      <div className="factbook-almanac">
        <div className="factbook-almanac-head">
          <h2 className="factbook-almanac-title">The complete index</h2>
          <p className="factbook-almanac-sub" aria-live="polite">
            {region === "all"
              ? `${countries.length} countries and territories, A to Z. Jump to a letter or pick from the list.`
              : `${inRegion.length} ${inRegion.length === 1 ? "entry" : "entries"} in ${
                  REGIONS.find((r) => r.key === region)?.label
                }. Jump to a letter or pick from the list.`}
          </p>
        </div>

        <nav className="factbook-alpha-rail" aria-label="Jump to letter">
          {alphabet.map((letter) => {
            const present = presentLetters.has(letter);
            return present ? (
              <a key={letter} href={`#fb-letter-${letter}`} className="factbook-alpha">
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
          <p className="factbook-almanac-empty">No countries in this region.</p>
        ) : (
          // NB: this is a CSS multi-column masonry (`column-count`). A transform
          // on each .factbook-letter-group would yank it out of the column flow
          // and glitch the masonry, so we reveal the whole index as one block
          // rather than per-letter stagger.
          <Reveal className="factbook-index-cols" amount={0.05}>
            {groups.map(({ letter, items }) => (
              <section
                key={letter}
                id={`fb-letter-${letter}`}
                className="factbook-letter-group"
                aria-label={`Countries starting with ${letter}`}
              >
                <div className="factbook-letter-head">
                  <span className="factbook-letter-drop">{letter}</span>
                  <span className="factbook-letter-count">
                    {items.length} {items.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                {items.map((c) => (
                  <Link
                    key={c.id}
                    href={`/factbook/${c.slug}`}
                    className="factbook-idx-item"
                  >
                    <span className="factbook-idx-flag" aria-hidden="true">
                      <CountryFlag iso2={c.iso2} size={21} />
                    </span>
                    <span className="factbook-idx-name">{c.name}</span>
                    <span
                      className="factbook-idx-dot"
                      style={{ background: REGION_DOT[continentToRegion(c.continent)] }}
                      title={c.continent ?? undefined}
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </section>
            ))}
          </Reveal>
        )}
      </div>
    </div>
  );
}
