import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  getAllJurisdictions,
  getJurisdictionsBySlugs,
  getGovernmentStructure,
  getLegislatureComposition,
  getElectionsByJurisdiction,
  compareCICountries,
  getCICountryHistory,
  getInternationalMembershipsBySlugs,
} from "@/lib/db/queries";
import { CompareCountrySelector, type SelectedCountryCard } from "./CompareCountrySelector";
import { CompareSectionNav } from "./CompareSectionNav";
import { CompareOverview } from "@/components/compare/CompareOverview";
import { CompareCivicaIndex } from "@/components/compare/CompareCivicaIndex";
import { CompareChambers } from "@/components/compare/CompareChambers";
import { CompareElections } from "@/components/compare/CompareElections";
import { CompareInternational } from "@/components/compare/CompareInternational";

const SERIES_VARS = [
  "var(--series-a, oklch(72% 0.15 35))",
  "var(--series-b, oklch(68% 0.13 220))",
  "var(--series-c, oklch(72% 0.14 150))",
];

function parseSlugs(
  raw: string | string[] | undefined
): string[] {
  const arr: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.filter((s): s is string => typeof s === "string" && s.length > 0).slice(0, 3);
}

function fmtPop(pop: number | null): string | null {
  if (!pop || pop <= 0) return null;
  if (pop >= 1_000_000_000) return `${(pop / 1_000_000_000).toFixed(1)}B`;
  if (pop >= 1_000_000) return `${Math.round(pop / 1_000_000)}M`;
  if (pop >= 1_000) return `${Math.round(pop / 1_000)}K`;
  return `${pop}`;
}

function govShort(g: string | null): string | null {
  if (!g) return null;
  const t = g.toLowerCase();
  if (t.includes("parliamentary")) return "Parliamentary";
  if (t.includes("semi-presidential")) return "Semi-presidential";
  if (t.includes("presidential")) return "Presidential";
  if (t.includes("constitutional monarchy")) return "Const. monarchy";
  if (t.includes("monarchy")) return "Monarchy";
  if (t.includes("one-party")) return "One-party";
  if (t.includes("military")) return "Military";
  return g.length > 20 ? g.slice(0, 20) + "…" : g;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const slugs = parseSlugs(sp?.c);

  let titleBase = "Compare Countries";
  try {
    if (slugs.length > 0) {
      const rows = await getJurisdictionsBySlugs(slugs);
      const ordered = slugs
        .map((s) => rows.find((r) => r.slug === s))
        .filter(Boolean) as typeof rows;
      if (ordered.length > 0) {
        titleBase = `${ordered.map((c) => c.name).join(" vs. ")}`;
      }
    }
  } catch {
    /* ignore — fall back to generic title */
  }

  const title = `${titleBase} — Compare | Civica`;
  const canonical = slugs.length > 0
    ? `https://civicaatlas.org/compare?${slugs.map((s) => `c=${encodeURIComponent(s)}`).join("&")}`
    : "https://civicaatlas.org/compare";

  return {
    title,
    description:
      "Side-by-side country comparison: factbook overview, Civica Index scores, parliamentary chambers, recent elections, and international organization memberships.",
    alternates: { canonical },
    openGraph: {
      title,
      description:
        "Compare the governance, scoring, chambers, elections, and global memberships of any two or three countries.",
      url: canonical,
    },
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const validSlugs = parseSlugs(sp?.c);

  // Phase 1 — country list for the selector (also gives us jurisdiction IDs
  // for anything selected, avoiding a second round-trip)
  let allCountries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    allCountries = await getAllJurisdictions();
  } catch {
    /* ignore — empty state will render */
  }
  const countryList = allCountries.map((c) => ({
    slug: c.slug,
    name: c.name,
    iso2: c.iso2,
  }));

  // Resolve selected slugs → full jurisdiction rows (+ IDs) in requested order
  const selectedJurisdictions = validSlugs
    .map((slug) => allCountries.find((c) => c.slug === slug))
    .filter(Boolean) as typeof allCountries;

  const ids = selectedJurisdictions.map((j) => j.id);

  // Phase 2 — fetch ALL section data in parallel
  let compareCI: Awaited<ReturnType<typeof compareCICountries>> = [];
  let histories: Array<Awaited<ReturnType<typeof getCICountryHistory>>> = [];
  let govStructures: Array<Awaited<ReturnType<typeof getGovernmentStructure>>> = [];
  let chambersArr: Array<Awaited<ReturnType<typeof getLegislatureComposition>>> = [];
  let electionsArr: Array<Awaited<ReturnType<typeof getElectionsByJurisdiction>>> = [];
  let memberships: Awaited<ReturnType<typeof getInternationalMembershipsBySlugs>> = [];

  if (validSlugs.length > 0) {
    try {
      [
        compareCI,
        histories,
        govStructures,
        chambersArr,
        electionsArr,
        memberships,
      ] = await Promise.all([
        compareCICountries(validSlugs),
        Promise.all(validSlugs.map((s) => getCICountryHistory(s))),
        Promise.all(ids.map((id) => getGovernmentStructure(id))),
        Promise.all(ids.map((id) => getLegislatureComposition(id))),
        Promise.all(ids.map((id) => getElectionsByJurisdiction(id))),
        getInternationalMembershipsBySlugs(ids),
      ]);
    } catch (err) {
      console.error("[/compare] section data fetch failed:", err);
    }
  }

  // Re-order CI result to match user-entered slug order
  const orderedCI = validSlugs
    .map((slug) => compareCI.find((c) => c.jurisdiction.slug === slug))
    .filter(Boolean) as typeof compareCI;

  const selectedCards: Array<SelectedCountryCard | null> = [0, 1, 2].map((i) => {
    const ciRow = orderedCI[i];
    if (!ciRow) return null;
    // Prefer the pretty-printed structural family from the taxonomy layer
    // (e.g. "Federal Republic", "Parliamentary Democracy") over the raw DB
    // `government_type` which is often a long snake_case factbook string.
    const classification = ciRow.jurisdiction.governmentClassification;
    const prettyGov =
      classification?.structuralFamilyLabel ??
      govShort(ciRow.jurisdiction.governmentType);
    return {
      slug: ciRow.jurisdiction.slug,
      name: ciRow.jurisdiction.name,
      iso2: ciRow.jurisdiction.iso2 ?? null,
      score: ciRow.composite?.score != null ? Number(ciRow.composite.score) : null,
      rank: ciRow.composite?.rank ?? null,
      governmentType: prettyGov,
      continent: ciRow.jurisdiction.continent ?? null,
      populationLabel: fmtPop(ciRow.jurisdiction.population),
    };
  });

  const seriesColorFor = (index: number) =>
    SERIES_VARS[index] ?? SERIES_VARS[0];

  const overviewCountries = selectedJurisdictions.map((jurisdiction, i) => ({
    jurisdiction,
    govStructure: govStructures[i] ?? { bodies: [], offices: [], currentTerms: [] },
    seriesColor: seriesColorFor(i),
  }));

  const chamberCountries = selectedJurisdictions.map((jurisdiction, i) => ({
    jurisdiction: {
      slug: jurisdiction.slug,
      name: jurisdiction.name,
      iso2: jurisdiction.iso2,
    },
    chambers: chambersArr[i] ?? [],
    seriesColor: seriesColorFor(i),
  }));

  const electionCountries = selectedJurisdictions.map((jurisdiction, i) => ({
    jurisdiction: {
      slug: jurisdiction.slug,
      name: jurisdiction.name,
      iso2: jurisdiction.iso2,
    },
    elections: electionsArr[i] ?? [],
    seriesColor: seriesColorFor(i),
  }));

  const internationalCountries = selectedJurisdictions.map((jurisdiction, i) => ({
    jurisdiction: {
      id: jurisdiction.id,
      slug: jurisdiction.slug,
      name: jurisdiction.name,
      iso2: jurisdiction.iso2,
    },
    seriesColor: seriesColorFor(i),
  }));

  const countryLabels = selectedJurisdictions.map((c) => c.name);

  const hasEnough = validSlugs.length >= 2;

  return (
    <div className="civica-compare-page">
      <section className="page-hero">
        <h1 className="page-title">
          {countryLabels.length === 0
            ? "Compare countries, side by side."
            : `${countryLabels.join(" vs. ")}`}
        </h1>
        <p className="page-lede">
          Overview, Civica Index, chambers, elections, and international
          memberships — everything about any two or three countries in one
          view.
        </p>
      </section>

      <section className="picker-row" aria-label="Country selection">
        <Suspense fallback={null}>
          <CompareCountrySelector
            countries={countryList}
            selectedCards={selectedCards}
          />
        </Suspense>
      </section>

      {validSlugs.length === 0 && (
        <div className="compare-empty">
          <p className="compare-empty-title">Choose two or three countries above to begin comparing.</p>
          <p className="compare-empty-sub">
            You&apos;ll see an overview, Civica Index scoring with a shared
            timeline, parliamentary chambers side-by-side, recent elections,
            and international memberships.
          </p>
        </div>
      )}

      {validSlugs.length === 1 && (
        <div className="compare-empty">
          <p className="compare-empty-title">
            Pick one more country to start the comparison.
          </p>
        </div>
      )}

      {hasEnough && (
        <>
          <CompareSectionNav countryLabels={countryLabels} />

          <section id="overview" className="compare-section">
            <div className="compare-section-eyebrow">I · OVERVIEW</div>
            <h2 className="compare-section-heading">The shape of each country.</h2>
            <CompareOverview countries={overviewCountries} />
          </section>

          <section id="civica-index" className="compare-section">
            <div className="compare-section-eyebrow">II · CIVICA INDEX</div>
            <h2 className="compare-section-heading">How well are they governed?</h2>
            <CompareCivicaIndex
              ordered={orderedCI}
              histories={validSlugs.map((s) =>
                histories[validSlugs.indexOf(s)] ?? []
              )}
              seriesColors={SERIES_VARS}
            />
          </section>

          <section id="chambers" className="compare-section">
            <div className="compare-section-eyebrow">III · CHAMBERS</div>
            <h2 className="compare-section-heading">Who sits in the legislature?</h2>
            <CompareChambers countries={chamberCountries} />
          </section>

          <section id="elections" className="compare-section">
            <div className="compare-section-eyebrow">IV · ELECTIONS</div>
            <h2 className="compare-section-heading">When and how they vote.</h2>
            <CompareElections countries={electionCountries} />
          </section>

          <section id="international" className="compare-section">
            <div className="compare-section-eyebrow">V · INTERNATIONAL</div>
            <h2 className="compare-section-heading">How they show up in the world.</h2>
            <CompareInternational
              countries={internationalCountries}
              memberships={memberships}
            />
          </section>

          <footer className="compare-page-footer">
            {selectedJurisdictions.map((c) => (
              <Link key={c.slug} href={`/countries/${c.slug}`}>
                {c.name} profile →
              </Link>
            ))}
            <Link href="/civica-index/methodology">Methodology →</Link>
            <span className="compare-footer-meta">
              Civica Index (Beta) · weighted composite of governance dimensions
            </span>
          </footer>
        </>
      )}

      {/* Page-scoped styles — the compare sections share an editorial visual
          language. These were originally authored inside /civica-index/compare;
          keeping them here so the legacy route's inline style block can be
          deleted. */}
      <style>{`
        .civica-compare-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px var(--spacing-page-x, 40px) 64px;
          color: var(--color-text-primary);
        }
        .page-hero { padding: 32px 0 32px; }
        .page-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 56px;
          font-weight: 400;
          letter-spacing: -0.04em;
          line-height: 1.02;
          margin-bottom: 12px;
        }
        .page-lede {
          font-size: 17px;
          color: var(--color-text-60);
          max-width: 700px;
          line-height: 1.55;
          margin: 0;
        }
        .picker-row { margin: 40px 0 24px; }
        .compare-selector-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .ci-compare-picker-card {
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-top: 3px solid var(--series-a);
          border-radius: 4px;
          padding: 20px 22px;
          min-height: 196px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ci-compare-picker-slot {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--color-text-30);
        }
        .ci-compare-picker-name {
          font-family: var(--font-heading);
          font-size: 22px;
          line-height: 1.15;
          color: var(--color-text-primary);
          display: flex; align-items: center; gap: 10px;
        }
        .ci-compare-picker-score {
          display: flex; align-items: baseline; gap: 8px;
        }
        .ci-compare-picker-score-val {
          font-family: var(--font-heading);
          font-size: 32px;
          line-height: 1;
          font-weight: 500;
        }
        .ci-compare-picker-score-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-30);
        }
        .ci-compare-picker-meta {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-30);
          letter-spacing: 0.04em;
        }
        .ci-compare-picker-remove {
          margin-top: auto;
          align-self: flex-start;
          background: transparent;
          border: 1px solid var(--color-card-border);
          color: var(--color-text-30);
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 6px 10px;
          border-radius: 3px;
          cursor: pointer;
        }
        .ci-compare-picker-remove:hover { color: var(--color-text-primary); }
        .ci-compare-picker-search {
          font-family: var(--font-body-sans);
          font-size: 14px;
          padding: 10px 12px;
          background: var(--color-surface-elevated, var(--color-bg));
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          color: var(--color-text-primary);
          width: 100%;
        }
        .ci-compare-picker-option {
          display: flex; align-items: center; gap: 10px;
          width: 100%;
          padding: 10px 14px;
          background: transparent;
          border: none;
          font-family: var(--font-body-sans);
          font-size: 14px;
          color: var(--color-text-primary);
          cursor: pointer;
          text-align: left;
        }
        .ci-compare-picker-option:hover {
          background: var(--color-grid-cell-hover, var(--color-card-bg));
        }
        .ci-compare-picker-empty {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-25);
          letter-spacing: 0.08em;
        }

        .compare-section-nav {
          position: sticky;
          top: 0;
          z-index: 40;
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-card-border);
          margin: 24px 0 32px;
        }
        .compare-section-nav-inner {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
        }
        .compare-section-nav-countries {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--color-text-30);
        }
        .compare-section-nav-links {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .compare-section-nav-link {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-text-30);
          text-decoration: none;
          padding: 4px 0;
          border-bottom: 2px solid transparent;
        }
        .compare-section-nav-link:hover {
          color: var(--color-text-primary);
        }
        .compare-section-nav-link.is-active {
          color: var(--color-accent);
          border-bottom-color: var(--color-accent);
          font-weight: 500;
        }

        .compare-section {
          scroll-margin-top: 80px;
          padding: 32px 0;
        }
        .compare-section-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 8px;
        }
        .compare-section-heading {
          font-family: var(--font-heading);
          font-size: 28px;
          font-weight: 400;
          letter-spacing: -0.02em;
          line-height: 1.15;
          margin: 0 0 20px 0;
        }

        .compare-empty {
          text-align: center;
          padding: 80px 0;
          color: var(--color-text-40);
        }
        .compare-empty-title {
          font-family: var(--font-heading);
          font-size: 24px;
          color: var(--color-text-primary);
          margin-bottom: 8px;
        }
        .compare-empty-sub {
          font-family: var(--font-body-sans);
          font-size: 14px;
          color: var(--color-text-40);
          max-width: 560px;
          margin: 0 auto;
          line-height: 1.55;
        }

        /* Column-header shared across sections */
        .compare-col-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 10px;
          border-bottom: 3px solid var(--series-a);
          margin-bottom: 12px;
        }
        .compare-col-header-name {
          font-family: var(--font-heading);
          font-size: 18px;
          color: var(--color-text-primary);
          text-decoration: none;
          line-height: 1.2;
        }

        /* CI section cards + dimension grid */
        .compare-ci-score-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        .compare-ci-card {
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-top: 3px solid var(--series-a);
          border-radius: 4px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .compare-ci-card-country {
          font-family: var(--font-heading);
          font-size: 22px;
          color: var(--color-text-primary);
        }
        .compare-ci-card-score {
          font-family: var(--font-heading);
          font-size: 44px;
          font-weight: 500;
          line-height: 1;
        }
        .compare-ci-card-meta {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-30);
        }
        .compare-ci-card-placeholder {
          font-family: var(--font-body-sans);
          font-size: 14px;
          color: var(--color-text-40);
          line-height: 1.4;
        }
        .compare-ci-timeline {
          margin: 32px 0;
          padding: 24px;
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
        }
        .compare-ci-eyebrow {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 8px;
        }
        .compare-ci-heading {
          font-family: var(--font-heading);
          font-size: 22px;
          font-weight: 400;
          letter-spacing: -0.01em;
          margin: 0 0 16px 0;
        }
        .compare-ci-legend {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-40);
          margin-top: 12px;
          letter-spacing: 0.04em;
        }
        .compare-ci-legend-swatch {
          display: inline-block;
          width: 10px; height: 10px; border-radius: 50%;
          margin-right: 8px;
          vertical-align: middle;
        }

        .dim-compare {
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          overflow: hidden;
          margin-top: 16px;
        }
        .dim-compare-header, .dim-compare-row {
          display: grid;
          grid-template-columns: 1.6fr repeat(3, 1fr) 60px;
          gap: 12px;
          align-items: center;
          padding: 14px 18px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-40);
        }
        .dim-compare-header {
          background: var(--color-card-bg);
          color: var(--color-text-30);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: 10px;
          border-bottom: 1px solid var(--color-card-border);
        }
        .dim-compare-header .hdr-dot {
          display: inline-block;
          width: 8px; height: 8px; border-radius: 50%;
          margin-left: 6px; vertical-align: middle;
        }
        .dim-compare-row { border-bottom: 1px solid var(--color-card-border); }
        .dim-compare-row:last-child { border-bottom: none; }
        .dim-compare-row .dim-name {
          font-family: var(--font-body-sans);
          font-size: 13px;
          color: var(--color-text-primary);
        }
        .dim-compare-cell {
          display: flex; flex-direction: column; gap: 6px;
        }
        .dim-compare-cell .val {
          font-family: var(--font-heading);
          font-size: 16px;
          line-height: 1;
        }
        .dim-compare-cell .bar {
          height: 3px;
          background: var(--color-card-border);
          border-radius: 2px;
          overflow: hidden;
        }
        .dim-compare-cell .bar span {
          display: block;
          height: 100%;
          transition: width 0.3s;
        }
        .dim-wt {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-30);
          text-align: right;
        }

        .h2h {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin: 32px 0;
        }
        .h2h-card {
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          padding: 22px;
        }
        .h2h-eyebrow {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--color-accent);
          margin-bottom: 8px;
        }
        .h2h-body {
          font-family: var(--font-body-sans);
          font-size: 15px;
          color: var(--color-text-primary);
          line-height: 1.55;
        }
        .h2h-body em {
          font-style: normal;
          color: var(--color-text-50);
        }

        /* Chamber column layout */
        .compare-chamber-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .compare-chamber-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .compare-chamber-eyebrow {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 4px;
        }
        .compare-chamber-meta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-40);
        }
        .compare-chamber-placeholder {
          padding: 48px 20px;
          background: var(--color-grid-cell);
          border: 1px dashed var(--color-card-border);
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-30);
          text-align: center;
        }

        /* Elections column layout */
        .compare-elections-grid {
          align-items: stretch;
        }
        .compare-elections-col {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .compare-elections-col > .compare-elections-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .compare-elections-block { display: flex; flex-direction: column; gap: 8px; }
        .compare-elections-eyebrow {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 4px;
        }
        .compare-election-card {
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .compare-election-title {
          font-family: var(--font-heading);
          font-size: 16px;
          color: var(--color-text-primary);
        }
        .compare-election-sub {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-30);
          letter-spacing: 0.04em;
        }
        .compare-election-system {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-40);
        }
        .compare-election-results { display: flex; flex-direction: column; gap: 6px; }
        .compare-election-result-row {
          display: grid;
          grid-template-columns: 1fr 100px 52px;
          gap: 10px;
          align-items: center;
          font-family: var(--font-mono);
          font-size: 11px;
        }
        .compare-election-result-name {
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .compare-election-winner {
          color: var(--color-accent);
          margin-left: 4px;
        }
        .compare-election-result-bar {
          height: 4px;
          background: var(--color-card-border);
          border-radius: 2px;
          overflow: hidden;
        }
        .compare-election-result-bar span {
          display: block;
          height: 100%;
        }
        .compare-election-result-pct {
          text-align: right;
          color: var(--color-text-40);
        }
        .compare-election-noresults {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-25);
          font-style: italic;
        }
        .compare-elections-placeholder {
          padding: 48px 20px;
          background: var(--color-grid-cell);
          border: 1px dashed var(--color-card-border);
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-30);
          text-align: center;
        }

        /* International section */
        .compare-international-empty {
          padding: 48px 20px;
          background: var(--color-grid-cell);
          border: 1px dashed var(--color-card-border);
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-30);
          text-align: center;
        }
        .compare-intl-cell {
          padding: 12px 16px;
          background: var(--color-bg);
        }
        .compare-intl-headcell { background: var(--color-card-bg); }
        .compare-intl-section-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-accent);
          background: var(--color-card-bg);
          padding: 16px;
          border-top: 1px solid var(--color-card-border);
        }
        .compare-intl-orgname {
          font-family: var(--font-heading);
          font-size: 15px;
          color: var(--color-text-primary);
        }
        .compare-intl-org-primary { display: inline; }
        .compare-intl-shared-tag {
          display: inline-block;
          margin-left: 8px;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-accent);
          padding: 2px 6px;
          border: 1px solid var(--color-accent);
          border-radius: 2px;
          vertical-align: middle;
        }
        .compare-intl-member {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-primary);
        }
        .compare-intl-nonmember {
          color: var(--color-text-25);
        }

        /* Page footer */
        .compare-page-footer {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          padding-top: 40px;
          margin-top: 40px;
          border-top: 1px solid var(--color-card-border);
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-40);
          align-items: center;
        }
        .compare-page-footer a {
          color: var(--color-accent);
          text-decoration: none;
        }
        .compare-page-footer a:hover { text-decoration: underline; }
        .compare-footer-meta {
          color: var(--color-text-25);
          margin-left: auto;
          letter-spacing: 0.04em;
        }

        /* Series color CSS vars fallback — scoped to this page so we don't
           pollute globals, and using the plain oklch values so the selector
           cards' border-top renders even without the (optional) design-system
           override. */
        .civica-compare-page {
          --series-a: oklch(72% 0.15 35);
          --series-b: oklch(68% 0.13 220);
          --series-c: oklch(72% 0.14 150);
        }

        @media (max-width: 900px) {
          .compare-selector-grid,
          .h2h {
            grid-template-columns: 1fr;
          }
          .dim-compare-header, .dim-compare-row {
            grid-template-columns: 1.2fr repeat(3, 1fr) 48px;
            gap: 8px;
            padding: 10px 12px;
          }
        }
        @media (max-width: 640px) {
          .page-title { font-size: 36px; }
          .dim-compare-header, .dim-compare-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}
