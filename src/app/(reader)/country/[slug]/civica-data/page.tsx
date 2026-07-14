import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getJurisdictionBySlug,
  getGovernmentStructure,
  getLeaderTimeline,
  getSource,
  getAllSources,
  getBillsForJurisdiction,
  getInternationalMembershipsBySlugs,
  getFactbookCountryOptions,
  getIndicatorHistoryForCountry,
} from "@/lib/db/queries";
import { getLegislatureForJurisdiction } from "@/lib/factbook/legislature";
import { getScoresForJurisdiction } from "@/lib/db/queries-scores";
import { getGovernanceEvidence } from "@/lib/db/queries-governance-evidence";
import { FactbookGovOrgChart } from "@/components/factbook/FactbookGovOrgChart";
import { FactbookSidebar } from "@/components/factbook/FactbookSidebar";
import { buildOrgChartFromGovernmentStructure } from "@/lib/factbook/gov-org-chart";
import { FactbookLegislature } from "@/components/factbook/FactbookLegislature";
import { FactbookLeaders } from "@/components/factbook/FactbookLeaders";
import { FactbookBills } from "@/components/factbook/FactbookBills";
import { FactbookOrganizations } from "@/components/factbook/FactbookOrganizations";
import { ScoresAndRankings } from "@/components/scores/ScoresAndRankings";
import { GovernanceEvidenceTable } from "@/components/governance-evidence/GovernanceEvidenceTable";
import { Banner } from "@/components/editorial/Banner";
import {
  CivicaDataSections,
  type CivicaDataSectionItem,
} from "@/components/country/CivicaDataSections";
import { CountryJumpSearch } from "@/components/country/CountryJumpSearch";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { SourceDot } from "@/components/SourceDot";
import { sourceLabel } from "@/lib/data/sources";
import { CountryTrendSection } from "@/components/ci/CountryTrendSection";
import {
  CountryEvidenceCoverage,
  COUNTRY_EVIDENCE_SUPPORTED_FACT_KEYS,
} from "@/components/provenance/CountryEvidenceCoverage";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import { withOg } from "@/lib/og";
import type { Metadata } from "next";
import "@/app/civica-data.css";

export const revalidate = 3600;

// Per-tab metadata. The shared layout's generateMetadata sets the Factbook
// title + /country/[slug] canonical (correct for the base tab); metadata
// exported from a page shallowly overrides the layout's for the keys it
// defines, so this tab self-canonicalizes to its own URL/title instead of
// pointing back at the Factbook tab.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) return { title: "Country Not Found" };
  const title = `${jurisdiction.name} — Governance Evidence & Country Data`;
  const description = `Evidence coverage, source-native governance observations, indicator history, government structure, legislature, leaders, bills, and international memberships for ${jurisdiction.name}.`;
  const url = `https://civicaatlas.org/country/${slug}/civica-data`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: withOg({
      title: `${title} · Civica Atlas`,
      description,
      url,
      type: "website",
    }),
  };
}

// Civica Data tab of the unified /country/[slug] page. This is the Civica
// value-add layer — the governance sections that overlay (rather than
// reproduce) the CIA Factbook prose:
//   1. Evidence coverage — properties of Civica's evidence, never the country.
//   2. Governance evidence — source-native publisher observations.
//   3. Indicator history — longitudinal publisher-native observations.
//   4. Government      — the "How power is organised" org chart.
//   5. Legislature     — chamber / hemicycle.
//   6. Leaders         — current officeholder timeline.
//   7. Bills           — recent legislative actions.
//   8. Organizations   — international memberships footprint.
//   9. Rankings        — curated source-native measures.
//
// LAYOUT: a factbook-style stacked scroll (<CivicaDataSections>). Every visible
// section renders one after another in a single scroll column — nothing hidden,
// all of it in the DOM and on screen. A sticky left nav is
// scroll-spy anchor navigation: the active entry follows the scroll, and a click
// smooth-scrolls to that section. Each section opens with a numbered chapter
// header, then its body, then a compact "Sources" provenance strip. Every
// section is visibility-gated upfront so the nav never lists a phantom entry.
// The masthead, tab bar, reconciliation notice, and AI drawer live in the shared
// layout. The "jump to country" search + its sticky-bar handoff render here via
// <CountryJumpSearch> — a normal-flow field above the left sidebar that scrolls away,
// so the sticky bar never shows alongside it.

type SectionId =
  | "evidence-coverage"
  | "governance-evidence"
  | "longitudinal"
  | "government"
  | "legislature"
  | "leaders"
  | "bills"
  | "organizations"
  | "rankings";

type SectionPlan = { id: SectionId; label: string };

const SECTION_PLAN: SectionPlan[] = [
  { id: "evidence-coverage", label: "Evidence Coverage" },
  { id: "governance-evidence", label: "Governance Evidence" },
  { id: "longitudinal", label: "Indicator History" },
  { id: "government", label: "Government" },
  { id: "legislature", label: "Legislature" },
  { id: "leaders", label: "Leaders" },
  { id: "bills", label: "Bills" },
  { id: "organizations", label: "Organizations" },
  { id: "rankings", label: "Rankings" },
];

/** One provenance entry rendered in a section's Sources strip. */
interface SectionSource {
  name: string;
  date: string;
  sourceId: string;
}

/**
 * Compact, full-width provenance strip at the foot of a section. Replaces the
 * old right-rail "Sources on this page" block — each section now carries only
 * the sources it actually renders, with the real `last_sync_at` date and a
 * `<SourceDot>` (green=live, amber=frozen vintage).
 */
function SourcesStrip({ sources }: { sources: SectionSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="civica-data-sources">
      <span className="civica-data-sources-label">Sources</span>
      <ul className="civica-data-sources-list">
        {sources.map((src) => (
          <li
            key={`${src.sourceId}-${src.name}`}
            className="civica-data-source"
          >
            <span className="civica-data-source-name">
              {src.name}
              <SourceDot source={src.sourceId} retrievedAt={src.date} />
            </span>
            <span className="civica-data-source-date">{src.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function CountryCivicaDataTab({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { slug } = await params;
  const { section: sectionParam } = await searchParams;

  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) notFound();

  // Each section's data fetch doubles as its visibility gate. Every fetch
  // soft-fails so a Neon hiccup degrades a single section rather than
  // 500-ing the whole tab.
  const [
    governanceEvidence,
    resolverFacts,
    indicatorHistory,
    govStructure,
    leadersRows,
    legislatureData,
    billsResult,
    memberships,
    scoresRows,
    wikidataSource,
    allSources,
    countryOptions,
  ] = await Promise.all([
    getGovernanceEvidence(slug).catch(() => null),
    getCanonicalFactsForJurisdiction(
      jurisdiction.id,
      COUNTRY_EVIDENCE_SUPPORTED_FACT_KEYS,
    ).catch(() => null),
    getIndicatorHistoryForCountry(slug).catch(() => null),
    getGovernmentStructure(jurisdiction.id).catch(
      () =>
        ({ bodies: [], offices: [], currentTerms: [] }) as Awaited<
          ReturnType<typeof getGovernmentStructure>
        >,
    ),
    getLeaderTimeline(jurisdiction.id).catch(() => []),
    getLegislatureForJurisdiction(jurisdiction.id).catch(() => null),
    getBillsForJurisdiction(slug, 20).catch(() => null),
    getInternationalMembershipsBySlugs([jurisdiction.id]).catch(() => []),
    getScoresForJurisdiction(jurisdiction.id).catch(() => []),
    getSource("wikidata").catch(() => null),
    // Whole sources table → real `last_sync_at` dates for the per-section
    // Sources strips. Soft-fails to [] so a Neon hiccup just drops the
    // dates, never the page.
    getAllSources().catch(
      () => [] as Awaited<ReturnType<typeof getAllSources>>,
    ),
    // Country list for the "Jump to country…" search at the top of the
    // section nav. Soft-fails to [] so a Neon hiccup just hides the search.
    getFactbookCountryOptions().catch(
      () => [] as Awaited<ReturnType<typeof getFactbookCountryOptions>>,
    ),
  ]);

  // Build the org chart once — reused for the gate and the render.
  const orgChart = buildOrgChartFromGovernmentStructure(
    govStructure.bodies,
    govStructure.offices,
    govStructure.currentTerms,
  );

  // Per-section visibility flags.
  const hasGovernanceEvidence = !!governanceEvidence;
  const hasGovernment = govStructure.offices.length > 0 && !!orgChart;
  const hasLegislature = !!legislatureData;
  const hasLeaders = leadersRows.length > 0;
  // A valid zero-row result is itself meaningful: the Bills section explains
  // unsupported coverage instead of silently disappearing. A failed lookup
  // remains hidden so an outage is never mislabeled as a coverage gap.
  const hasBills = !!billsResult;
  const hasOrganizations = memberships.length > 0;
  const hasRankings = scoresRows.length > 0;

  const isVisible = (id: SectionId): boolean => {
    switch (id) {
      case "evidence-coverage":
        return true;
      case "governance-evidence":
        return hasGovernanceEvidence;
      case "longitudinal":
        return true;
      case "government":
        return hasGovernment;
      case "legislature":
        return hasLegislature;
      case "leaders":
        return hasLeaders;
      case "bills":
        return hasBills;
      case "organizations":
        return hasOrganizations;
      case "rankings":
        return hasRankings;
    }
  };

  const visibleSections = SECTION_PLAN.filter((s) => isVisible(s.id));

  // --- Per-section provenance --------------------------------------------
  // Each section's Sources strip lists ONLY the sources that section renders,
  // with the real `last_sync_at` from the sources table. The <SourceDot>
  // reads green/amber off the source id; the date column shows the vintage.
  const sourceById = new Map(allSources.map((s) => [s.id, s]));
  const syncDate = (id: string): string => {
    const d = sourceById.get(id)?.lastSyncAt ?? null;
    return d ? d.toISOString().slice(0, 10) : "Not yet synced";
  };
  const sourceEntry = (id: string): SectionSource => ({
    name: sourceLabel(id),
    date: syncDate(id),
    sourceId: id,
  });
  // Dedup a list of source ids preserving order.
  const dedup = (ids: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  };

  const governanceEvidenceSources: SectionSource[] = governanceEvidence
    ? dedup(governanceEvidence.rows.map((row) => row.sourceId)).map(sourceEntry)
    : [];

  // Government structure + leaders are Wikidata-derived; legislature seat
  // composition is IPU Parline; bills carry their own per-source provenance;
  // organizations are Wikidata-derived.
  const governmentSources: SectionSource[] = hasGovernment
    ? [sourceEntry("wikidata")]
    : [];
  const legislatureSources: SectionSource[] = hasLegislature
    ? [sourceEntry("ipu_parline")]
    : [];
  const leadersSources: SectionSource[] = hasLeaders
    ? [sourceEntry("wikidata")]
    : [];
  const billsSources: SectionSource[] =
    hasBills && billsResult
      ? dedup(billsResult.rows.map((b) => b.sourceId)).map(sourceEntry)
      : [];
  const organizationsSources: SectionSource[] = hasOrganizations
    ? [sourceEntry("wikidata")]
    : [];
  // Rankings rows carry established source-native measures only. The former
  // Civica composite is preserved research and is not returned here.
  const rankingsSources: SectionSource[] = hasRankings
    ? dedup(scoresRows.map((r) => r.source)).map((id) => sourceEntry(id))
    : [];

  const wikidataRetrievedAt = wikidataSource?.lastSyncAt
    ? wikidataSource.lastSyncAt.toISOString()
    : null;

  // Edge case: a country with a masthead but zero Civica overlays. Render
  // a clean note rather than an empty shell with a phantom nav.
  if (visibleSections.length === 0) {
    return (
      <div className="civica-data-body">
        <section className="civica-data-empty-card">
          <h2 className="civica-data-empty-title">Civica Data</h2>
          <p className="civica-data-empty-copy">
            Civica governance data for {jurisdiction.name} has not been compiled
            yet. See the <Link href={`/country/${slug}`}>Factbook tab</Link> for
            the source reference, or browse the{" "}
            <Link href="/governance-evidence">
              Governance Evidence Dashboard
            </Link>
            .
          </p>
        </section>
      </div>
    );
  }

  // Build the section bodies once, server-side, then hand them to the client
  // switcher as props. The client component renders exactly these nodes — it
  // never re-fetches.
  const contentById: Record<SectionId, React.ReactNode> = {
    "evidence-coverage": (
      <CountryEvidenceCoverage
        slug={slug}
        countryName={jurisdiction.name}
        resolverFacts={resolverFacts}
      />
    ),
    "governance-evidence": governanceEvidence ? (
      <>
        <Banner variant="info">
          These publisher observations remain on their native scales. Civica
          does not average them, rank the country, or treat agreement as
          independent corroboration.
        </Banner>
        <GovernanceEvidenceTable
          countryName={jurisdiction.name}
          rows={governanceEvidence.rows}
        />
        <SourcesStrip sources={governanceEvidenceSources} />
      </>
    ) : null,
    longitudinal: (
      <CountryTrendSection
        slug={slug}
        embedded
        initialSeries={indicatorHistory}
        initialSources={allSources}
      />
    ),
    government: orgChart ? (
      <>
        <div className="civica-data-gov-structure">
          <p className="civica-data-gov-dek">
            How power is organised — the offices, bodies, and current
            officeholders.
          </p>
          <FactbookGovOrgChart
            chart={orgChart}
            countryName={jurisdiction.name}
          />
        </div>
        <SourcesStrip sources={governmentSources} />
      </>
    ) : null,
    legislature: (
      <>
        <FactbookLegislature
          jurisdictionId={jurisdiction.id}
          countryName={jurisdiction.name}
        />
        <SourcesStrip sources={legislatureSources} />
      </>
    ),
    leaders: (
      <>
        <FactbookLeaders
          jurisdictionId={jurisdiction.id}
          countryName={jurisdiction.name}
          retrievedAt={wikidataRetrievedAt}
        />
        <SourcesStrip sources={leadersSources} />
      </>
    ),
    bills: (
      <>
        <FactbookBills countrySlug={slug} countryName={jurisdiction.name} />
        <SourcesStrip sources={billsSources} />
      </>
    ),
    organizations: (
      <>
        <FactbookOrganizations
          jurisdictionId={jurisdiction.id}
          countryName={jurisdiction.name}
          retrievedAt={wikidataRetrievedAt}
        />
        <SourcesStrip sources={organizationsSources} />
      </>
    ),
    rankings: (
      <>
        <ScoresAndRankings
          jurisdictionId={jurisdiction.id}
          countryName={jurisdiction.name}
          variant="factbook"
        />
        <SourcesStrip sources={rankingsSources} />
      </>
    ),
  };

  const items: CivicaDataSectionItem[] = visibleSections.map((s) => ({
    id: s.id,
    label: s.label,
    content: contentById[s.id],
  }));

  // Default to the deep-linked section when it names a visible section, else
  // Evidence coverage. SSR
  // paints this section's body.
  const requestedDefault =
    sectionParam && visibleSections.some((s) => s.id === sectionParam)
      ? sectionParam
      : "evidence-coverage";
  const defaultId = visibleSections.some((s) => s.id === requestedDefault)
    ? requestedDefault
    : visibleSections[0].id;

  // --- Citation footer ----------------------------------------------------
  // "Cite this page" box for the Civica Data tab. The data's vintage is the
  // source-native evidence reference year. Source names are deduped across every visible section's
  // provenance so the citation lists exactly what the page renders.
  const citeDataVintage = governanceEvidence
    ? `${governanceEvidence.year}-12-31`
    : null;
  const citeSourceNames = Array.from(
    new Set(
      [
        ...governanceEvidenceSources,
        ...(indicatorHistory ?? []).map((series) =>
          sourceEntry(series.sourceId),
        ),
        ...governmentSources,
        ...legislatureSources,
        ...leadersSources,
        ...billsSources,
        ...organizationsSources,
        ...rankingsSources,
      ].map((s) => s.name),
    ),
  );

  // Sidebar entries mirror the visible sections plus the same citation anchor
  // the Factbook tab exposes. The SAME <FactbookSidebar> (ReaderSidebar
  // primitive) renders inside the SAME grid geometry by owner mandate
  // (2026-07-05): the two tabs must never drift apart visually again.
  const sidebarItems = [
    ...visibleSections.map((s) => ({
      id: s.id,
      label: s.label,
    })),
    { id: "cite", label: "Cite this page" },
  ];

  return (
    <div className="factbook-tab">
      <div className="civica-data-body">
        <div className="factbook-left-rail">
          <CountryJumpSearch
            country={{ name: jurisdiction.name, iso2: jurisdiction.iso2 }}
            countries={countryOptions}
          />
          <FactbookSidebar items={sidebarItems} />
        </div>

        <CivicaDataSections
          items={items}
          defaultId={defaultId}
          footer={
            <section
              id="cite"
              className="editorial-section"
              aria-labelledby="cite-heading"
            >
              <h2 id="cite-heading">Cite this page</h2>
              <CiteAccordion
                subject={`Civica Atlas — ${jurisdiction.name}`}
                pageTitle="Civica Data"
                url={`https://civicaatlas.org/country/${slug}/civica-data`}
                downloadSlug={slug}
                dataVintage={citeDataVintage}
                sourceNames={citeSourceNames}
              />
            </section>
          }
        />
      </div>
    </div>
  );
}
