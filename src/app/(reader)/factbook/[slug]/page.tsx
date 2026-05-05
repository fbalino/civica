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
  getBillsForJurisdiction,
} from "@/lib/db/queries";
import { getPulseV2ForCountry } from "@/lib/db/queries-pulse-v2";
import { getLegislatureForJurisdiction } from "@/lib/factbook/legislature";
import { jsonbToFields } from "@/lib/data/factbook-fields";
import { FactbookSection } from "@/components/FactbookSection";
import { FactbookHeaderStrip } from "@/components/factbook/FactbookHeaderStrip";
import {
  FactbookSidebar,
  type FactbookSidebarItem,
} from "@/components/factbook/FactbookSidebar";
import { FactbookMobileSubheader } from "@/components/factbook/FactbookMobileSubheader";
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
import { ScoresAndRankings } from "@/components/scores/ScoresAndRankings";
import { getScoresForJurisdiction } from "@/lib/db/queries-scores";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
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
  // Scores & Rankings sits at the very end — the long-tail reference data
  // above stays organized while the curated Civica scores anchor the
  // conclusion of the page.
  { kind: "civica", id: "scores", label: "Scores & Rankings" },
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
    //   - Structured sections (FactbookSection LeafRow) → also keys off
    //     capital / official_languages / currency_code so leaves whose
    //     human label matches `LABEL_TO_FACT_KEY` swap their generic
    //     CIA-Factbook SourceDot for a clickable FactValueDot.
    // One batch query covers both surfaces — keeps the page server-
    // round-trip count flat.
    getCanonicalFactsForJurisdiction(jurisdiction.id, [
      "population_total",
      "gdp_ppp_usd_billions",
      "capital",
      "official_languages",
      "currency_code",
    ]).catch(
      () => ({}) as Record<string, import("@/lib/factbook/reconcile/types").ResolverOutput>
    ),
  ]);

  const hasLegislature = !!legislatureData;
  const hasLeaders = leadersRows.length > 0;
  const hasBills = !!billsResult && billsResult.rows.length > 0;
  const hasScores = scoresRows.length > 0;

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

  const sidebarItems: FactbookSidebarItem[] = visibleSections.map((s) => ({
    id: s.id,
    label: s.label,
  }));

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
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-11)",
            color: "var(--color-text-40)",
            letterSpacing: "var(--tracking-wide)",
            padding: "var(--space-2) 0 var(--space-3)",
            borderBottom: "1px solid var(--color-border-default)",
            marginBottom: "var(--space-3)",
          }}
        >
          Some figures reconciled across multiple sources via Civica&apos;s
          methodology (v0.1{" "}
          <span style={{ color: "var(--color-status-warning)" }}>BETA</span>).{" "}
          <Link
            href="/factbook/methodology/reconciliation"
            style={{
              color: "var(--color-text-60)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            Methodology →
          </Link>
        </div>
      ) : null}

      <div id="factbook-header-sentinel" aria-hidden="true" />

      <FactbookMobileSubheader
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
