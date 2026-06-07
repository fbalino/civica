import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getJurisdictionBySlug,
  getFactbookSections,
  getFactbookCountryOptions,
  getCICountryDetail,
  getGovernmentStructure,
  getLeaderTimeline,
  getSource,
  getBillsForJurisdiction,
} from "@/lib/db/queries";
import { getPulseV2ForCountry } from "@/lib/db/queries-pulse-v2";
import { reconciliation } from "@/lib/content/site-state";
import { getLegislatureForJurisdiction } from "@/lib/factbook/legislature";
import { jsonbToFields } from "@/lib/data/factbook-fields";
import { sectionDataHasNormalizableGeographicName } from "@/lib/data/geographic-name-normalization";
import { FactbookSection } from "@/components/FactbookSection";
import { Banner } from "@/components/editorial/Banner";
import { FactbookHeaderStrip } from "@/components/factbook/FactbookHeaderStrip";
import {
  FactbookSidebar,
  type FactbookSidebarItem,
} from "@/components/factbook/FactbookSidebar";
import { FactbookStickyCountrySearch } from "@/components/factbook/FactbookStickyCountrySearch";
import {
  FactbookRightRail,
  type SubsectionEntry,
} from "@/components/factbook/FactbookRightRail";
import { CivicaAIDrawer } from "@/components/factbook/CivicaAIDrawer";
import type { LightboxImage } from "@/components/factbook/FactbookLightbox";
import { FactbookGovOrgChart } from "@/components/factbook/FactbookGovOrgChart";
import { buildOrgChartFromGovernmentStructure } from "@/lib/factbook/gov-org-chart";
import { FactbookLegislature } from "@/components/factbook/FactbookLegislature";
import { FactbookLeaders } from "@/components/factbook/FactbookLeaders";
import { FactbookBills } from "@/components/factbook/FactbookBills";
import {
  FactbookAdditionalIndicators,
  hasAdditionalIndicators,
} from "@/components/factbook/FactbookAdditionalIndicators";
import { ScoresAndRankings } from "@/components/scores/ScoresAndRankings";
import { getScoresForJurisdiction } from "@/lib/db/queries-scores";
import {
  getCanonicalFactsForJurisdiction,
  getDistinctActiveSourcesForJurisdiction,
  FACTBOOK_RECONCILIATION_META,
} from "@/lib/factbook/reconcile/api";
import { CiteAccordion } from "@/components/cite/CiteAccordion";

export const revalidate = 3600;
// Outcomes section is intentionally NOT imported. The dense peer-band
// graph at <FactbookOutcomes>/<FactbookOutcomesGraph> is shipped in the
// repo but the underlying peer-comparison methodology needs work before
// we ship comparisons to readers — see
// `~/civica/plan/outcomes-methodology-postponed.md` for the full plan.
import { classifyGovernment } from "@/lib/data/government-category";
import { formatGovernmentType } from "@/lib/text/clean";
import { humanizeSectionLabel } from "@/lib/data/humanize-label";
import { getCountryGallery, wikimediaUrl } from "@/lib/data/country-photos";
import { slugify } from "@/lib/text/slugify";

type SectionPlan =
  | { kind: "factbook"; id: string; label: string; sourceKey: string }
  | { kind: "factbook+civica-gov"; id: string; label: string; sourceKey: string }
  | { kind: "civica"; id: string; label: string };

const SECTION_PLAN: SectionPlan[] = [
  { kind: "factbook", id: "overview", label: "Overview", sourceKey: "introduction" },
  { kind: "factbook", id: "geography", label: "Geography", sourceKey: "geography" },
  { kind: "factbook", id: "people", label: "People & Society", sourceKey: "people_and_society" },
  { kind: "factbook+civica-gov", id: "government", label: "Government", sourceKey: "government" },
  // Civica governance sections (legislature, leaders, bills) sit between
  // Government and the CIA-sourced sections. Each is hidden upfront when
  // its data fetch returns empty (see visibleSections filter below) so
  // the sidebar + right rail don't list phantom anchors.
  { kind: "civica", id: "legislature", label: "Legislature" },
  { kind: "civica", id: "leaders", label: "Leaders" },
  { kind: "civica", id: "bills", label: "Bills" },
  // Outcomes section postponed pending methodology project — see
  // `~/civica/plan/outcomes-methodology-postponed.md`. Slot kept as a
  // comment so we remember where it goes when we resume.
  // { kind: "civica", id: "outcomes", label: "Outcomes" },
  { kind: "factbook", id: "economy", label: "Economy", sourceKey: "economy" },
  { kind: "factbook", id: "energy", label: "Energy", sourceKey: "energy" },
  { kind: "factbook", id: "communications", label: "Communications", sourceKey: "communications" },
  { kind: "factbook", id: "transport", label: "Transport", sourceKey: "transportation" },
  { kind: "factbook", id: "environment", label: "Environment", sourceKey: "environment" },
  { kind: "factbook", id: "military", label: "Military & Security", sourceKey: "military_and_security" },
  // Terrorism section — 102 countries have data; auto-hidden when empty.
  { kind: "factbook", id: "terrorism", label: "Terrorism", sourceKey: "terrorism" },
  { kind: "factbook", id: "space", label: "Space", sourceKey: "space" },
  { kind: "factbook", id: "transnational", label: "Transnational Issues", sourceKey: "transnational_issues" },
  // Scores & Rankings sits near the end — the long-tail reference data
  // above stays organized while the curated Civica scores anchor the
  // conclusion of the page.
  { kind: "civica", id: "scores", label: "Scores & Rankings" },
  // R.13 — Additional Indicators is the bottom-of-page home for any
  // Civica-curated reader-facing fact-key that does NOT map to a CIA
  // Factbook prose group. First row: median household income for the
  // United States (US Census ACS 1-Year). Future R.14–R.20 NSOs and
  // any new Civica-asserted fact-keys land here. Visibility is gated
  // on `hasAdditionalIndicators(headerFacts)` so the section + sidebar
  // entry only appear when a row has data. Per
  // `~/civica/plan/us-census-resolution-v1.md` §3 + user 2026-05-05.
  { kind: "civica", id: "additional-indicators", label: "Additional Indicators" },
];

const FACTBOOK_RETRIEVED_AT = "2026-01-23";

function galleryCaption(p: { caption: string; license?: string }): string {
  const license = p.license && p.license !== "Wikimedia Commons" ? ` · ${p.license}` : "";
  return `${p.caption}${license} · Wikimedia Commons`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) return { title: "Country Not Found" };
  const govLabel =
    formatGovernmentType(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType
    ) || "sovereign state";
  const title = `${jurisdiction.name} Factbook — Government, Geography, People`;
  const description = `Reference factbook for ${jurisdiction.name}: ${govLabel.toLowerCase()} government, geography, people and economy. Sourced from the CIA World Factbook with Civica governance overlays.`;
  const url = `https://civicaatlas.org/factbook/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Civica`,
      description,
      url,
      type: "website",
    },
  };
}

export default async function FactbookCountryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // .catch(() => null) collapses both "not found" and DB-down cases to a
  // 404. Don't swallow other errors silently — let them bubble to the
  // Next.js error boundary so they appear in logs.
  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) notFound();

  // Fetch civica-section visibility flags alongside the existing data.
  // Each component refetches when rendered, so these are cheap presence
  // checks (Drizzle Neon-HTTP queries run in parallel and return in
  // <100ms typical). Refactoring the components to accept pre-fetched
  // data as props is a bigger change that we'll do if profiling shows
  // it matters.
  const [
    sections,
    govStructure,
    ciDetail,
    pulseV2,
    leadersRows,
    legislatureData,
    billsResult,
    scoresRows,
    countryOptions,
    headerFacts,
    citeSources,
    wikidataSource,
  ] = await Promise.all([
    getFactbookSections(jurisdiction.id),
    getGovernmentStructure(jurisdiction.id),
    getCICountryDetail(slug).catch(() => null),
    getPulseV2ForCountry(slug).catch(() => null),
    getLeaderTimeline(jurisdiction.id).catch(() => []),
    getLegislatureForJurisdiction(jurisdiction.id).catch(() => null),
    getBillsForJurisdiction(slug, 1).catch(() => null),
    getScoresForJurisdiction(jurisdiction.id).catch(() => []),
    getFactbookCountryOptions().catch(() => []),
    // Phase F.4 — resolver-direct fetch.
    // Used by:
    //   - Header strip (Pop + GDP pills) → uses population_total +
    //     gdp_ppp_usd_billions.
    //   - Structured sections (FactbookSection LeafRow) → keyed off
    //     `LABEL_TO_FACT_KEY` (single-shot leaves) and
    //     `MULTI_YEAR_GROUP_TO_FACT_KEY` (multi-year groups, augmented
    //     with a "Civica canonical (reconciled)" row at the top per
    //     `~/civica/plan/factbook-multi-year-rendering-v1.md`).
    // One batch query covers all surfaces — keeps the page server-
    // round-trip count flat.
    getCanonicalFactsForJurisdiction(jurisdiction.id, [
      // Identity / society leaves (also feed header strip).
      "population_total",
      "gdp_ppp_usd_billions",
      "capital",
      "official_languages",
      "currency_code",
      // Single-shot economy + demographics leaves.
      "birth_rate",
      "death_rate",
      "population_growth_rate",
      "fertility_rate",
      "gdp_nominal_usd_billions",
      // Multi-year groups — augmented with reconciled canonical row.
      // (`gdp_ppp_usd_billions` is already in the list above for the
      // header strip; reused here for the structured-section group.)
      "gdp_per_capita_usd",
      "gdp_real_growth_rate",
      "inflation_rate",
      "public_debt_pct_gdp",
      // R.14 — Public Sector Net Debt (excl. PSB), ONS-UK only. Renders
      // as a sibling row to the Maastricht-style `public_debt_pct_gdp`
      // canonical inside the "Public debt" group via
      // `MULTI_YEAR_GROUP_TO_AUX_FACT_KEYS`. Non-UK pages skip the row
      // silently because no `ons_uk` row exists for them. Per
      // `~/civica/plan/ons-uk-resolution-v1.md` §6 Q3.
      "public_debt_psnd_pct_gdp",
      "unemployment_rate_pct",
      "current_account_balance_usd",
      "exports_goods_services_usd",
      "imports_goods_services_usd",
      "military_expenditure_pct_gdp",
      // R.13 — Additional Indicators section. Fact-keys consumed by
      // <FactbookAdditionalIndicators>. Add to this batch when adding
      // a row to ADDITIONAL_INDICATOR_ROWS.
      "median_household_income_usd",
    ]).catch(
      () => ({}) as Record<string, import("@/lib/factbook/reconcile/types").ResolverOutput>
    ),
    // Per-country distinct active sources for the page-bottom
    // <CiteAccordion>. Soft-fail to [] so a Neon hiccup doesn't 500
    // the whole page; the accordion renders fine without source names.
    // Methodology: ~/civica/plan/cite-accordion-rollout-v1.md §4.
    getDistinctActiveSourcesForJurisdiction(jurisdiction.id).catch(
      () => [] as Array<{ id: string; name: string }>
    ),
    getSource("wikidata").catch(() => null),
  ]);

  const hasLegislature = !!legislatureData;
  const hasLeaders = leadersRows.length > 0;
  const hasBills = !!billsResult && billsResult.rows.length > 0;
  const hasScores = scoresRows.length > 0;
  // R.13 — visibility gate for the Additional Indicators section. True
  // when at least one row in ADDITIONAL_INDICATOR_ROWS has a canonical
  // resolver row for this jurisdiction. The component reuses
  // `headerFacts` from the resolver batch above, so this is a cheap
  // synchronous check.
  const hasAdditional = hasAdditionalIndicators(headerFacts);

  const sectionDataMap = new Map(
    sections.map((s) => [s.sectionName, s.sectionData])
  );

  const visibleSections = SECTION_PLAN.filter((s) => {
    if (s.kind === "civica") {
      // Civica sections each have their own data check — hide when empty
      // so the sidebar + right rail don't list phantom anchors.
      if (s.id === "legislature") return hasLegislature;
      if (s.id === "leaders") return hasLeaders;
      if (s.id === "bills") return hasBills;
      if (s.id === "scores") return hasScores;
      if (s.id === "additional-indicators") return hasAdditional;
      return true;
    }
    const data = sectionDataMap.get(s.sourceKey);
    // Government section always renders Civica's gov-structure diagram
    // even when CIA data is missing.
    if (!data) return s.kind === "factbook+civica-gov";
    if (typeof data !== "object") return false;
    // Empty section objects (e.g. Space with only null-valued keys)
    // produce zero renderable fields. Hide them rather than render a
    // bare "No data available" stub.
    return jsonbToFields(data).length > 0;
  });

  const sidebarItems: FactbookSidebarItem[] = [
    ...visibleSections.map((s) => ({
      id: s.id,
      label: s.label,
    })),
    // Cite anchor sits below all data sections — methodology:
    // ~/civica/plan/cite-accordion-rollout-v1.md §5.
    { id: "cite", label: "Cite this page" },
  ];

  const ciScore =
    ciDetail?.composite?.score != null
      ? Number(ciDetail.composite.score)
      : null;

  // Pulse delta: pick the largest-magnitude dimension as the headline.
  // Always show CP when pulseV2 returned (zero-flat is a meaningful state).
  let cpDelta: number | null = null;
  let cpTrend: "up" | "down" | "flat" | null = null;
  if (pulseV2 && pulseV2.dimensions) {
    const allDims = Object.values(pulseV2.dimensions);
    const sorted = [...allDims].sort(
      (a, b) =>
        Math.abs(Number(b.delta ?? 0)) - Math.abs(Number(a.delta ?? 0))
    );
    const top = sorted[0];
    const d = Number(top?.delta ?? 0);
    cpDelta = d;
    cpTrend = d > 0.5 ? "up" : d < -0.5 ? "down" : "flat";
  }

  const govLabel =
    formatGovernmentType(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType
    ) ||
    classifyGovernment(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType
    ).label;

  // Gallery: Wikimedia photos + map assets. Slug lookup covers media for
  // territory pages without changing reconciliation identity fields.
  const gallery = getCountryGallery({
    iso3: jurisdiction.iso3,
    slug: jurisdiction.slug,
  });
  const mapImages: LightboxImage[] = gallery
    ? gallery.mapImages.map((p) => ({
        src: wikimediaUrl(p.file, 1200),
        alt: p.caption,
        caption: galleryCaption(p),
      }))
    : [];
  const photos: LightboxImage[] = gallery
    ? gallery.photos.map((p) => ({
        src: wikimediaUrl(p.file, 1200),
        alt: p.caption,
        caption: galleryCaption(p),
      }))
    : [];
  // Build the sources list shown in the right rail.
  const sources = [
    { name: "CIA Factbook", date: FACTBOOK_RETRIEVED_AT },
    ...(gallery ? [{ name: "Wikimedia Commons", date: "2026-04-30" }] : []),
    ...(govStructure.offices.length > 0
      ? [{ name: "Civica internal", date: "2026-04-12" }]
      : []),
  ];

  // Build the per-section subsection map for the right rail.
  // The factbook field tree's top-level groups become subsections, each
  // with a unique DOM id of the form `<section>--<slug>` matching the
  // ids emitted by FactbookSection's GroupBlock heading.
  const subsectionsBySection: Record<string, SubsectionEntry[]> = {};
  for (const section of visibleSections) {
    const subs: SubsectionEntry[] = [];
    if (section.kind === "factbook+civica-gov" && govStructure.offices.length > 0) {
      subs.push({ id: `${section.id}--structure`, label: "Structure" });
    }
    const data =
      section.kind === "civica"
        ? null
        : sectionDataMap.get((section as { sourceKey: string }).sourceKey);
    if (data) {
      const fields = jsonbToFields(data);
      for (const f of fields) {
        if (f.kind === "group") {
          // Title case for TOC entries — matches the heading the link
          // jumps to (FactbookSection's GroupBlock uses the same).
          const label = humanizeSectionLabel(f.label);
          subs.push({
            id: `${section.id}--${slugify(label)}`,
            label,
          });
        }
      }
    }
    subsectionsBySection[section.id] = subs.slice(0, 12);
  }

  return (
    <>
      <FactbookHeaderStrip
        slug={slug}
        countryName={jurisdiction.name}
        iso2={jurisdiction.iso2}
        governmentTypeLabel={govLabel}
        population={jurisdiction.population}
        gdp={
          jurisdiction.gdpBillions
            ? jurisdiction.gdpBillions * 1_000_000_000
            : null
        }
        populationResolver={headerFacts["population_total"] ?? null}
        gdpResolver={headerFacts["gdp_ppp_usd_billions"] ?? null}
        ciScore={ciScore}
        cpDelta={cpDelta}
        cpTrend={cpTrend}
        mapImages={mapImages}
        photos={photos}
        inAtlas={jurisdiction.type === "sovereign_state"}
      />

      {/* Phase F.4 — show a one-line reconciliation disclosure
       *  whenever at least one header fact has a non-CIA canonical
       *  source (i.e. the resolver actually swapped in fresher
       *  data). Quiet when only CIA values render. */}
      {(headerFacts["population_total"]?.canonical &&
        headerFacts["population_total"].canonical.sourceId !== "cia_factbook") ||
      (headerFacts["gdp_ppp_usd_billions"]?.canonical &&
        headerFacts["gdp_ppp_usd_billions"].canonical.sourceId !==
          "cia_factbook") ? (
        <div className="factbook-reconciliation-notice">
          <div className="factbook-reconciliation-notice__inner">
            Some figures reconciled across multiple sources via Civica&apos;s
            methodology ({reconciliation.version.replace(/-beta$/, "")}
            {reconciliation.status === "beta" ? (
              <>
                {" "}
                <span className="factbook-reconciliation-notice__beta">
                  BETA
                </span>
              </>
            ) : null}
            ).{" "}
            <Link
              href="/factbook/methodology/reconciliation"
              className="factbook-reconciliation-notice__link"
            >
              Methodology →
            </Link>
          </div>
        </div>
      ) : null}

      <div id="factbook-header-sentinel" aria-hidden="true" />

      <FactbookStickyCountrySearch
        country={{ name: jurisdiction.name, iso2: jurisdiction.iso2 }}
        countries={countryOptions}
        sentinelId="factbook-header-sentinel"
      />

      <div className="factbook-body">
        <FactbookSidebar items={sidebarItems} countries={countryOptions} />

        <div className="factbook-main">
          {visibleSections.map((section) => {
            const data =
              section.kind === "civica"
                ? null
                : sectionDataMap.get(
                    (section as { sourceKey: string }).sourceKey
                  );
            const fields = data ? jsonbToFields(data) : [];

            return (
              <section
                key={section.id}
                id={section.id}
                className="factbook-section"
              >
                <header className="factbook-section-header">
                  <h2 className="factbook-section-title">{section.label}</h2>
                </header>

                {/* Geographic-name provenance note. Shown ONLY when this
                 *  section's raw CIA prose actually contains a phrase we
                 *  normalize for display (today: "Gulf of America" →
                 *  "Gulf of Mexico", which appears in the Geography
                 *  sections of the US, Mexico, and Canada). Quiet on every
                 *  other section and country. The stored CIA JSONB is left
                 *  verbatim; this discloses the house naming convention.
                 *  See `src/lib/data/geographic-name-normalization.ts`. */}
                {data != null &&
                  sectionDataHasNormalizableGeographicName(data) && (
                    <Banner variant="info">
                      <strong>Naming:</strong>{" "}
                      Civica uses &ldquo;Gulf of Mexico,&rdquo; the name
                      recognized by the International Hydrographic Organization
                      and the United Nations. The source data (CIA World
                      Factbook) adopted &ldquo;Gulf of America&rdquo; following
                      a U.S. executive order in January 2025.
                    </Banner>
                  )}

                {section.kind === "factbook+civica-gov" && (() => {
                  const orgChart = buildOrgChartFromGovernmentStructure(
                    govStructure.bodies,
                    govStructure.offices,
                    govStructure.currentTerms
                  );
                  if (!orgChart) return null;
                  return (
                    <div
                      id={`${section.id}--structure`}
                      style={{
                        marginBottom: "var(--space-7)",
                        scrollMarginTop: "calc(56px + var(--space-5))",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-10)",
                          letterSpacing: "var(--tracking-wider)",
                          textTransform: "uppercase",
                          color: "var(--color-accent)",
                          margin: "0 0 var(--space-3)",
                        }}
                      >
                        Civica · structure
                      </p>
                      <h3
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "var(--text-20)",
                          fontWeight: 400,
                          margin: "0 0 var(--space-4)",
                        }}
                      >
                        How power is organised
                      </h3>
                      <FactbookGovOrgChart
                        chart={orgChart}
                        countryName={jurisdiction.name}
                      />
                    </div>
                  );
                })()}

                {/* Civica section bodies — each component does its own
                    data fetch and renders nothing if empty (we already
                    filtered empties out above, so this just renders). */}
                {section.kind === "civica" && section.id === "legislature" && (
                  <FactbookLegislature
                    jurisdictionId={jurisdiction.id}
                    countryName={jurisdiction.name}
                  />
                )}
                {section.kind === "civica" && section.id === "leaders" && (
                  <FactbookLeaders
                    jurisdictionId={jurisdiction.id}
                    countryName={jurisdiction.name}
                    retrievedAt={
                      wikidataSource?.lastSyncAt
                        ? wikidataSource.lastSyncAt.toISOString()
                        : null
                    }
                  />
                )}
                {section.kind === "civica" && section.id === "bills" && (
                  <FactbookBills
                    countrySlug={slug}
                    countryName={jurisdiction.name}
                  />
                )}
                {section.kind === "civica" && section.id === "scores" && (
                  <ScoresAndRankings
                    jurisdictionId={jurisdiction.id}
                    countryName={jurisdiction.name}
                    variant="factbook"
                  />
                )}
                {section.kind === "civica" &&
                  section.id === "additional-indicators" && (
                    <FactbookAdditionalIndicators resolverFacts={headerFacts} />
                  )}

                {fields.length > 0 ? (
                  <FactbookSection
                    sectionName={humanizeSectionLabel(section.label)}
                    fields={fields}
                    source="cia_factbook"
                    retrievedAt={FACTBOOK_RETRIEVED_AT}
                    idPrefix={section.id}
                    resolverFacts={headerFacts}
                  />
                ) : section.kind === "factbook+civica-gov" ||
                  section.kind === "civica" ? null : (
                  <p
                    style={{
                      color: "var(--color-text-40)",
                      fontSize: "var(--text-14)",
                    }}
                  >
                    No data available for this section.
                  </p>
                )}
              </section>
            );
          })}

          {/* Per-country citation footer. Sits at the bottom of the
              main content column, below all data sections, above the
              AI drawer overlay. Sidebar TOC anchors to #cite via
              sidebarItems above. Methodology:
              ~/civica/plan/cite-accordion-rollout-v1.md §3.3 + §5. */}
          <section
            id="cite"
            className="editorial-section"
            aria-labelledby="cite-heading"
          >
            <h2 id="cite-heading">Cite this page</h2>
            <CiteAccordion
              subject={`Civica Atlas — ${jurisdiction.name} — vintage ${
                FACTBOOK_RECONCILIATION_META.vintage.split("vintage ")[1] ?? ""
              }`}
              pageTitle={`${jurisdiction.name} factbook`}
              url={`https://civicaatlas.org/factbook/${slug}`}
              downloadSlug={slug}
              sourceNames={citeSources.map((s) => s.name)}
            />
          </section>
        </div>

        <FactbookRightRail
          subsectionsBySection={subsectionsBySection}
          sources={sources}
        />
      </div>

      <CivicaAIDrawer
        countryName={jurisdiction.name}
        threadKey={`factbook:${slug}`}
        suggestions={[
          `How does ${jurisdiction.name}'s government work?`,
          "Recent Pulse events",
          "When's the next election?",
        ]}
      />
    </>
  );
}
