import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  getAllReferenceJurisdictions,
  getJurisdictionsBySlugs,
  getGovernmentStructure,
  getLegislatureComposition,
  getElectionsByJurisdiction,
  getInternationalMembershipsBySlugs,
  getIndicatorHistoryForCountry,
  getConditionsPublicRelease,
  getAllSources,
} from "@/lib/db/queries";
import {
  CompareCountrySelector,
  type SelectedCountryCard,
} from "./CompareCountrySelector";
import { CompareSectionNav } from "./CompareSectionNav";
import {
  CompareOverview,
  formatNumber,
} from "@/components/compare/CompareOverview";
import { GovernanceEvidenceTable } from "@/components/governance-evidence/GovernanceEvidenceTable";
import { Banner } from "@/components/editorial/Banner";
import { CompareChambers } from "@/components/compare/CompareChambers";
import {
  CompareElections,
  type CompareElectionAvailability,
} from "@/components/compare/CompareElections";
import { CompareInternational } from "@/components/compare/CompareInternational";
import { withOg } from "@/lib/og";
import { getCanonicalFactsForJurisdictions } from "@/lib/factbook/reconcile/api";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { PageHero } from "@/components/PageHero";
import { getGovernanceEvidence } from "@/lib/db/queries-governance-evidence";
import { CompareIndicatorHistory } from "@/components/compare/CompareIndicatorHistory";
import { CompareConditions } from "@/components/compare/CompareConditions";
import { SOURCE_RIGHTS } from "@/lib/rights/manifest";
import { captureAtlasSurfaceQuery } from "@/lib/atlas/surface-query-state";

export const revalidate = 0;

// Series colors resolve from the global :root block in globals.css.
// No fallback literals — the globals are always present.
const SERIES_VARS = ["var(--series-a)", "var(--series-b)", "var(--series-c)"];

function parseSlugs(raw: string | string[] | undefined): string[] {
  const arr: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .slice(0, 3);
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

  // Default (no selection) uses the canonical page-type template. When two or
  // three countries are selected, front-load their names.
  let title = "Compare Countries — Government, Economy & Governance";
  try {
    if (slugs.length > 0) {
      const rows = await getJurisdictionsBySlugs(slugs);
      const ordered = slugs
        .map((s) => rows.find((r) => r.slug === s))
        .filter(Boolean) as typeof rows;
      if (ordered.length > 0) {
        title = `${ordered.map((c) => c.name).join(" vs. ")} — Compare Countries`;
      }
    }
  } catch {
    /* ignore — fall back to generic title */
  }

  const canonical =
    slugs.length > 0
      ? `https://civicaatlas.org/compare?${slugs.map((s) => `c=${encodeURIComponent(s)}`).join("&")}`
      : "https://civicaatlas.org/compare";

  return {
    title,
    description:
      "Compare any two or three countries side by side: source-native governance evidence, factbook overview, parliamentary chambers, recent elections, and international memberships.",
    alternates: { canonical },
    openGraph: withOg({
      title: `${title} · Civica Atlas`,
      description:
        "Compare source-native governance evidence, chambers, elections, and global memberships for any two or three countries.",
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
  const countryCatalogResult = await captureAtlasSurfaceQuery(
    getAllReferenceJurisdictions,
  );
  const allCountries =
    countryCatalogResult.status === "available" ? countryCatalogResult.value : [];
  const countryList = allCountries.map((c) => ({
    slug: c.slug,
    name: c.name,
    iso2: c.iso2,
    status: c.jurisdictionStatus,
  }));

  // Resolve selected slugs → full jurisdiction rows (+ IDs) in requested order
  const selectedJurisdictions = validSlugs
    .map((slug) => allCountries.find((c) => c.slug === slug))
    .filter(Boolean) as typeof allCountries;

  const ids = selectedJurisdictions.map((j) => j.id);

  // Phase 2 — fetch ALL section data in parallel
  let governanceEvidence: Array<
    Awaited<ReturnType<typeof getGovernanceEvidence>>
  > = [];
  let govStructures: Array<Awaited<ReturnType<typeof getGovernmentStructure>>> =
    [];
  let chambersArr: Array<
    Awaited<ReturnType<typeof getLegislatureComposition>>
  > = [];
  let electionAvailabilityArr: CompareElectionAvailability[] = [];
  let memberships: Awaited<
    ReturnType<typeof getInternationalMembershipsBySlugs>
  > = [];
  let indicatorHistories: Array<
    Awaited<ReturnType<typeof getIndicatorHistoryForCountry>>
  > = [];
  let indicatorHistoryUnavailable = false;
  let sourceFreshness: Record<string, string | null> | null = null;
  let conditionsRelease: Awaited<ReturnType<typeof getConditionsPublicRelease>> =
    null;
  const unavailableSections: string[] = [];

  if (selectedJurisdictions.length > 0) {
    const [
      governanceEvidenceResult,
      govStructuresResult,
      chambersResult,
      membershipsResult,
      indicatorHistoriesResult,
      conditionsReleaseResult,
      sourcesResult,
    ] = await Promise.all([
      captureAtlasSurfaceQuery(() =>
        Promise.all(selectedJurisdictions.map(({ slug }) => getGovernanceEvidence(slug))),
      ),
      captureAtlasSurfaceQuery(() =>
        Promise.all(ids.map((id) => getGovernmentStructure(id))),
      ),
      captureAtlasSurfaceQuery(() =>
        Promise.all(ids.map((id) => getLegislatureComposition(id))),
      ),
      captureAtlasSurfaceQuery(() => getInternationalMembershipsBySlugs(ids)),
      captureAtlasSurfaceQuery(() =>
        Promise.all(selectedJurisdictions.map(({ slug }) => getIndicatorHistoryForCountry(slug))),
      ),
      captureAtlasSurfaceQuery(getConditionsPublicRelease),
      captureAtlasSurfaceQuery(getAllSources),
    ]);
    if (governanceEvidenceResult.status === "available") {
      governanceEvidence = governanceEvidenceResult.value;
    } else {
      unavailableSections.push("governance evidence");
    }
    if (govStructuresResult.status === "available") {
      govStructures = govStructuresResult.value;
    } else {
      unavailableSections.push("overview");
    }
    if (chambersResult.status === "available") {
      chambersArr = chambersResult.value;
    } else {
      unavailableSections.push("chambers");
    }
    if (membershipsResult.status === "available") {
      memberships = membershipsResult.value;
    } else {
      unavailableSections.push("international memberships");
    }
    if (indicatorHistoriesResult.status === "available") {
      indicatorHistories = indicatorHistoriesResult.value;
    } else {
      indicatorHistoryUnavailable = true;
      unavailableSections.push("longitudinal indicators");
    }
    if (conditionsReleaseResult.status === "available") {
      conditionsRelease = conditionsReleaseResult.value;
    } else {
      unavailableSections.push("Conditions");
    }
    if (sourcesResult.status === "available") {
      sourceFreshness = Object.fromEntries(
        sourcesResult.value.map((source) => [
          source.id,
          source.lastSyncAt?.toISOString() ?? null,
        ]),
      );
    } else {
      unavailableSections.push("source freshness");
    }
    const electionResults = await Promise.allSettled(
      ids.map((id) => getElectionsByJurisdiction(id)),
    );
    electionAvailabilityArr = electionResults.map((result, index) => {
      if (result.status === "fulfilled") {
        return { status: "available", rows: result.value };
      }
      console.error(
        `[/compare] election fetch failed for ${validSlugs[index]}`,
        result.reason,
      );
      return { status: "temporarily_unavailable" };
    });
  }

  // Phase F.4 — multi-country resolver fetch. Pulls every in-scope
  // reconciled fact-key for every selected country in a single batch
  // query. The overview row renders `<FactValueDot>` inline when the
  // resolver has a canonical row; the picker cards above read the same
  // resolver-canonical population so the two never disagree on a value.
  let factsByJurisdiction: Awaited<
    ReturnType<typeof getCanonicalFactsForJurisdictions>
  > = {};
  if (ids.length > 0) {
    const factsResult = await captureAtlasSurfaceQuery(() =>
      getCanonicalFactsForJurisdictions(ids, [
      "population_total",
      "gdp_ppp_usd_billions",
      "area_total_km2",
      "capital",
      "official_languages",
      "currency_code",
      ]),
    );
    if (factsResult.status === "available") {
      factsByJurisdiction = factsResult.value;
    } else {
      unavailableSections.push("canonical overview facts");
    }
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

  const selectedCards: Array<SelectedCountryCard | null> = [0, 1, 2].map(
    (i) => {
      const jurisdiction = selectedJurisdictions[i];
      if (!jurisdiction) return null;
      // Phase 3e (structural_family removal) — prefer the pretty-printed
      // BR/CGV regime type label from the taxonomy layer (e.g.
      // "Parliamentary democracy", "Civilian dictatorship") over the raw
      // DB `government_type` factbook string. The legacy
      // `structuralFamilyLabel` was retired with the heuristic taxonomy
      // per the 2026-05-02 peer-grouping resolution.
      const classification = jurisdiction.governmentClassification;
      const prettyGov =
        classification?.regimeTypeLabel ??
        govShort(jurisdiction.governmentType);
      const popN = resolvedPopulation(jurisdiction);
      return {
        slug: jurisdiction.slug,
        name: jurisdiction.name,
        iso2: jurisdiction.iso2 ?? null,
        status: jurisdiction.jurisdictionStatus,
        governmentType: prettyGov,
        continent: jurisdiction.continent ?? null,
        populationLabel: popN != null && popN > 0 ? formatNumber(popN) : null,
      };
    },
  );

  const seriesColorFor = (index: number) =>
    SERIES_VARS[index] ?? SERIES_VARS[0];

  const overviewCountries = selectedJurisdictions.map((jurisdiction, i) => ({
    jurisdiction,
    govStructure: govStructures[i] ?? {
      bodies: [],
      offices: [],
      currentTerms: [],
    },
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
    electionAvailability: electionAvailabilityArr[i] ?? {
      status: "temporarily_unavailable",
    },
    seriesColor: seriesColorFor(i),
  }));

  const internationalCountries = selectedJurisdictions.map(
    (jurisdiction, i) => ({
      jurisdiction: {
        id: jurisdiction.id,
        slug: jurisdiction.slug,
        name: jurisdiction.name,
        iso2: jurisdiction.iso2,
      },
      seriesColor: seriesColorFor(i),
    }),
  );

  const countryLabels = selectedJurisdictions.map((c) => c.name);
  const indicatorHistoryCountries = selectedJurisdictions.map(
    (country, index) => ({
      slug: country.slug,
      name: country.name,
      colorVar: seriesColorFor(index),
      series: indicatorHistories[index] ?? [],
    }),
  );
  const conditionsCountries = selectedJurisdictions.map((jurisdiction, index) => ({
    jurisdiction: {
      id: jurisdiction.id,
      slug: jurisdiction.slug,
      name: jurisdiction.name,
      iso2: jurisdiction.iso2,
    },
    seriesColor: seriesColorFor(index),
  }));
  const downloadableSourceIds = SOURCE_RIGHTS.filter(
    (rights) => rights.publicExport === "allowed",
  ).map((rights) => rights.sourceId);

  const hasEnough = selectedJurisdictions.length >= 2;
  const hasInvalidSelection =
    validSlugs.length > 0 && selectedJurisdictions.length !== validSlugs.length;

  return (
    <>
      {/* Canonical full-bleed page hero (shared PageHero shell). */}
      <PageHero
        eyebrow="Compare"
        titleId="compare-hero-title"
        title={
          countryLabels.length === 0
            ? "Compare countries, side by side."
            : countryLabels.join(" vs. ")
        }
        description={
          <>
            Overview, source-native governance evidence, chambers, elections,
            and international memberships &mdash; any two or three countries in
            one view.
          </>
        }
        engraving={{
          src: "/engravings/hero.webp",
          darkSrc: "/engravings/hero-dark.webp",
        }}
      />

      <EditorialPage width="full">
        <section className="picker-row" aria-label="Country selection">
          <Suspense fallback={null}>
            <CompareCountrySelector
              countries={countryList}
              selectedCards={selectedCards}
            />
          </Suspense>
        </section>

        {countryCatalogResult.status === "unavailable" ? (
          <Banner variant="warn">
            The country catalog is temporarily unavailable. This does not mean
            that Civica has no country records.
          </Banner>
        ) : null}

        {hasInvalidSelection && countryCatalogResult.status === "available" ? (
          <Banner variant="warn">
            One or more requested country records are no longer available for
            comparison. Choose two listed countries to continue.
          </Banner>
        ) : null}

        {validSlugs.length === 0 && (
          <div className="compare-empty">
            <p className="compare-empty-title">
              Choose two or three countries above to begin comparing.
            </p>
            <p className="compare-empty-sub">
              You&apos;ll see an overview, source-native governance evidence,
              parliamentary chambers side-by-side, recent elections, and
              international memberships.
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

            {unavailableSections.length > 0 ? (
              <Banner variant="warn">
                Some comparison data is temporarily unavailable: {unavailableSections.join(", ")}. This does not mean the selected countries have no records in those sections.
              </Banner>
            ) : null}

            <section id="overview" className="compare-section">
              <div className="compare-section-eyebrow">I · OVERVIEW</div>
              <h2 className="compare-section-heading">
                The shape of each country.
              </h2>
              <CompareOverview countries={overviewCountries} />
            </section>

            <section id="governance-evidence" className="compare-section">
              <div className="compare-section-eyebrow">
                II · GOVERNANCE EVIDENCE
              </div>
              <h2 className="compare-section-heading">
                What established sources report.
              </h2>
              <Banner variant="info">
                Each source keeps its native scale. Civica does not average the
                rows or turn them into a country-quality ranking.
              </Banner>
              {governanceEvidence.length === 0 ? (
                <div className="editorial-empty">
                  No source-native governance observations are currently
                  compiled for the selected countries. This is a coverage gap,
                  not a country-quality finding.
                </div>
              ) : governanceEvidence.flatMap((evidence) =>
                evidence
                  ? [
                      <div
                        key={evidence.country.slug}
                        className="editorial-section"
                      >
                        <h3>{evidence.country.name}</h3>
                        <GovernanceEvidenceTable
                          countryName={evidence.country.name}
                          rows={evidence.rows}
                        />
                      </div>,
                    ]
                  : [],
              )}
            </section>

            <section id="longitudinal" className="compare-section">
              <div className="compare-section-eyebrow">
                III · LONGITUDINAL INDICATORS
              </div>
              <h2 className="compare-section-heading">
                How the same published measure changes over time.
              </h2>
              <Banner variant="info">
                Choose one source-native indicator, then toggle countries or the
                time range. The chart uses one visual 0–100 axis while hover and
                downloads retain the publisher&apos;s original units.
              </Banner>
              {indicatorHistoryUnavailable ? (
                <Banner variant="warn">
                  Longitudinal comparison is temporarily unavailable. A data
                  outage does not mean that the selected countries have no
                  history.
                </Banner>
              ) : (
                <CompareIndicatorHistory
                  countries={indicatorHistoryCountries}
                  downloadableSourceIds={downloadableSourceIds}
                  sourceFreshness={sourceFreshness}
                />
              )}
            </section>

            <section id="conditions" className="compare-section">
              <div className="compare-section-eyebrow">IV · CONDITIONS</div>
              <h2 className="compare-section-heading">
                Material indicators, without a hidden composite.
              </h2>
                <CompareConditions
                  countries={conditionsCountries}
                  release={conditionsRelease}
                  releaseUnavailable={unavailableSections.includes("Conditions")}
                />
            </section>

            <section id="chambers" className="compare-section">
              <div className="compare-section-eyebrow">V · CHAMBERS</div>
              <h2 className="compare-section-heading">
                Who sits in the legislature?
              </h2>
              <CompareChambers countries={chamberCountries} />
            </section>

            <section id="elections" className="compare-section">
              <div className="compare-section-eyebrow">VI · ELECTIONS</div>
              <h2 className="compare-section-heading">
                When and how they vote.
              </h2>
              <CompareElections countries={electionCountries} />
            </section>

            <section id="international" className="compare-section">
              <div className="compare-section-eyebrow">VII · INTERNATIONAL</div>
              <h2 className="compare-section-heading">
                How they show up in the world.
              </h2>
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
              <Link href="/governance-evidence">Governance Evidence →</Link>
              <span className="compare-footer-meta">
                Source-native observations · no Civica country-quality composite
              </span>
            </footer>
          </>
        )}
      </EditorialPage>
    </>
  );
}
