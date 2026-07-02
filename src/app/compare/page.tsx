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
import { CompareOverview, formatNumber } from "@/components/compare/CompareOverview";
import { CompareCivicaIndex } from "@/components/compare/CompareCivicaIndex";
import { CompareChambers } from "@/components/compare/CompareChambers";
import { CompareElections } from "@/components/compare/CompareElections";
import { CompareInternational } from "@/components/compare/CompareInternational";
import { withOg } from "@/lib/og";
import { getCanonicalFactsForJurisdictions } from "@/lib/factbook/reconcile/api";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { HeroReveal, HeroRevealItem } from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { civicaIndex } from "@/lib/content/site-state";

export const revalidate = 3600;

// Series colors resolve from the global :root block in globals.css.
// No fallback literals — the globals are always present.
const SERIES_VARS = [
  "var(--series-a)",
  "var(--series-b)",
  "var(--series-c)",
];

function parseSlugs(
  raw: string | string[] | undefined
): string[] {
  const arr: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.filter((s): s is string => typeof s === "string" && s.length > 0).slice(0, 3);
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
    openGraph: withOg({
      title,
      description:
        "Compare the governance, scoring, chambers, elections, and global memberships of any two or three countries.",
      url: canonical,
    }),
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

  // Phase F.4 — multi-country resolver fetch. Pulls every in-scope
  // reconciled fact-key for every selected country in a single batch
  // query. The overview row renders `<FactValueDot>` inline when the
  // resolver has a canonical row; the picker cards above read the same
  // resolver-canonical population so the two never disagree on a value.
  let factsByJurisdiction: Awaited<
    ReturnType<typeof getCanonicalFactsForJurisdictions>
  > = {};
  if (ids.length > 0) {
    factsByJurisdiction = await getCanonicalFactsForJurisdictions(ids, [
      "population_total",
      "gdp_ppp_usd_billions",
      "area_total_km2",
      "capital",
      "official_languages",
      "currency_code",
    ]).catch(() => ({}));
  }

  // Resolver-canonical population (canonical → legacy cache fallback),
  // mirroring CompareOverview's precedence so picker + row agree.
  const resolvedPopulation = (
    jurisdiction: (typeof selectedJurisdictions)[number],
  ): number | null =>
    factsByJurisdiction[jurisdiction.id]?.["population_total"]?.canonical
      ?.factValueNumeric ??
    jurisdiction.population ??
    null;

  const selectedCards: Array<SelectedCountryCard | null> = [0, 1, 2].map((i) => {
    const ciRow = orderedCI[i];
    if (!ciRow) return null;
    // Phase 3e (structural_family removal) — prefer the pretty-printed
    // BR/CGV regime type label from the taxonomy layer (e.g.
    // "Parliamentary democracy", "Civilian dictatorship") over the raw
    // DB `government_type` factbook string. The legacy
    // `structuralFamilyLabel` was retired with the heuristic taxonomy
    // per the 2026-05-02 peer-grouping resolution.
    const classification = ciRow.jurisdiction.governmentClassification;
    const prettyGov =
      classification?.regimeTypeLabel ??
      govShort(ciRow.jurisdiction.governmentType);
    const popN = resolvedPopulation(ciRow.jurisdiction);
    return {
      slug: ciRow.jurisdiction.slug,
      name: ciRow.jurisdiction.name,
      iso2: ciRow.jurisdiction.iso2 ?? null,
      score: ciRow.composite?.score != null ? Number(ciRow.composite.score) : null,
      rank: ciRow.composite?.rank ?? null,
      governmentType: prettyGov,
      continent: ciRow.jurisdiction.continent ?? null,
      populationLabel: popN != null && popN > 0 ? formatNumber(popN) : null,
    };
  });

  const seriesColorFor = (index: number) =>
    SERIES_VARS[index] ?? SERIES_VARS[0];

  const overviewCountries = selectedJurisdictions.map((jurisdiction, i) => ({
    jurisdiction,
    govStructure: govStructures[i] ?? { bodies: [], offices: [], currentTerms: [] },
    seriesColor: seriesColorFor(i),
    facts: factsByJurisdiction[jurisdiction.id] ?? {},
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
    <>
      {/* Full-bleed engraving hero (homepage idiom). Rendered as a sibling
          before <EditorialPage> — matching /about — so the 100vw breakout
          reaches the viewport edges with no top-padding gap. Reuses the
          canonical .factbook-hero-* class family (eyebrow → title → dek). */}
      <section
        className="factbook-landing-hero"
        aria-labelledby="compare-hero-title"
      >
        <ParallaxImage
          className="factbook-hero-art"
          src="/engravings/hero.webp"
          darkSrc="/engravings/hero-dark.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="factbook-hero-scrim" aria-hidden="true" />
        <HeroReveal className="factbook-hero-inner">
          <HeroRevealItem className="factbook-hero-eyebrow">
            Compare
          </HeroRevealItem>
          <HeroRevealItem
            as="h1"
            id="compare-hero-title"
            className="factbook-hero-title"
          >
            {countryLabels.length === 0
              ? "Compare countries, side by side."
              : `${countryLabels.join(" vs. ")}`}
          </HeroRevealItem>
          <HeroRevealItem as="p" className="factbook-hero-dek">
            Overview, Civica Index, chambers, elections, and international
            memberships &mdash; any two or three countries in one view.
          </HeroRevealItem>
        </HeroReveal>
      </section>

      <EditorialPage width="full">
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
              <Link key={c.slug} href={`/country/${c.slug}`}>
                {c.name} profile →
              </Link>
            ))}
            <Link href="/civica-index/methodology">Methodology →</Link>
            <span className="compare-footer-meta">
              Civica Index{civicaIndex.status === "beta" ? " (Beta)" : ""} · weighted composite of governance dimensions
            </span>
          </footer>
        </>
      )}
      </EditorialPage>
    </>
  );
}
