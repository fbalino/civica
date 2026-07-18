import { notFound } from "next/navigation";
import {
  getJurisdictionBySlug,
  getGovernmentStructure,
  getLeaderTimeline,
  getSource,
  getAllSources,
  getBillsForJurisdiction,
  getFactbookCountryOptions,
  getIndicatorHistoryForCountry,
  getConditionsPublicRelease,
} from "@/lib/db/queries";
import { getCountryOrganizationsData } from "@/lib/db/queries-organizations";
import { getScoresForJurisdiction } from "@/lib/db/queries-scores";
import { isCiReleaseConsistencyError } from "@/lib/ci/release-selection";
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
import { CivicaConditionsPanel } from "@/components/conditions/CivicaConditionsPanel";
import {
  CountryEvidenceCoverage,
  COUNTRY_EVIDENCE_SUPPORTED_FACT_KEYS,
} from "@/components/provenance/CountryEvidenceCoverage";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import { withOg } from "@/lib/og";
import {
  atlasSurfaceQueryValue,
  captureAtlasSurfaceQuery,
} from "@/lib/atlas/surface-query-state";
import type { Metadata } from "next";
import "@/app/civica-data.css";

export const revalidate = 0;

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
//   4. Civica Conditions — versioned, source-native material indicators.
//   5. Government      — the "How power is organised" org chart.
//   6. Legislature     — chamber / hemicycle.
//   7. Leaders         — current officeholder timeline.
//   8. Bills           — recent legislative actions.
//   9. Organizations   — international memberships footprint.
//  10. Rankings        — curated source-native measures.
//
// LAYOUT: a factbook-style stacked scroll (<CivicaDataSections>). Every visible
// section renders one after another in a single scroll column — nothing hidden,
// all of it in the DOM and on screen. A sticky left nav is
// scroll-spy anchor navigation: the active entry follows the scroll, and a click
// smooth-scrolls to that section. Each section opens with a numbered chapter
// header, then its body, then a compact "Sources" provenance strip. Every
// documented section stays in the navigation: an unavailable query and a
// successful empty result render distinct visible states rather than causing a
// section to disappear.
// The masthead, tab bar, reconciliation notice, and AI drawer live in the shared
// layout. The "jump to country" search + its sticky-bar handoff render here via
// <CountryJumpSearch> — a normal-flow field above the left sidebar that scrolls away,
// so the sticky bar never shows alongside it.

type SectionId =
  | "evidence-coverage"
  | "governance-evidence"
  | "longitudinal"
  | "conditions"
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
  { id: "conditions", label: "Civica Conditions" },
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

  // Keep a fulfilled empty result distinct from an unavailable query. The
  // visible module uses that distinction rather than disappearing from the
  // reader navigation.
  const [
    governanceEvidenceResult,
    resolverFactsResult,
    indicatorHistoryResult,
    govStructureResult,
    leadersRowsResult,
    billsResult,
    organizationsResult,
    scoresRowsResult,
    wikidataSource,
    allSources,
    countryOptions,
    conditionsReleaseResult,
  ] = await Promise.all([
    captureAtlasSurfaceQuery(() => getGovernanceEvidence(slug)),
    captureAtlasSurfaceQuery(() =>
      getCanonicalFactsForJurisdiction(
        jurisdiction.id,
        COUNTRY_EVIDENCE_SUPPORTED_FACT_KEYS,
      ),
    ),
    captureAtlasSurfaceQuery(() => getIndicatorHistoryForCountry(slug)),
    captureAtlasSurfaceQuery(() => getGovernmentStructure(jurisdiction.id)),
    captureAtlasSurfaceQuery(() => getLeaderTimeline(jurisdiction.id)),
    captureAtlasSurfaceQuery(() => getBillsForJurisdiction(slug, 20)),
    captureAtlasSurfaceQuery(() => getCountryOrganizationsData(jurisdiction.id)),
    captureAtlasSurfaceQuery(() => getScoresForJurisdiction(jurisdiction.id), {
      rethrow: isCiReleaseConsistencyError,
    }),
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
    captureAtlasSurfaceQuery(() => getConditionsPublicRelease()),
  ]);

  const governanceEvidence = atlasSurfaceQueryValue(governanceEvidenceResult);
  const resolverFacts = atlasSurfaceQueryValue(resolverFactsResult);
  const indicatorHistory = atlasSurfaceQueryValue(indicatorHistoryResult);
  const govStructure = atlasSurfaceQueryValue(govStructureResult);
  const leadersRows = atlasSurfaceQueryValue(leadersRowsResult);
  // A fulfilled empty result remains a coverage state. An unavailable result
  // reaches FactbookBills as null so it receives its distinct outage state.
  const hasBills = billsResult.status === "available";
  const bills = hasBills ? billsResult.value : null;
  const organizations = atlasSurfaceQueryValue(organizationsResult);
  const scoresRows = atlasSurfaceQueryValue(scoresRowsResult);
  const conditionsRelease = atlasSurfaceQueryValue(conditionsReleaseResult);
  const orgChart = govStructure
    ? buildOrgChartFromGovernmentStructure(
        govStructure.bodies,
        govStructure.offices,
        govStructure.currentTerms,
      )
    : null;
  const visibleSections = SECTION_PLAN;

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
  const governmentSources: SectionSource[] = orgChart
    ? [sourceEntry("wikidata")]
    : [];
  const legislatureSources: SectionSource[] = [];
  const leadersSources: SectionSource[] = leadersRows?.length
    ? [sourceEntry("wikidata")]
    : [];
  const billsSources: SectionSource[] =
    bills?.rows.length
      ? dedup(bills.rows.map((b) => b.sourceId)).map(sourceEntry)
      : [];
  const organizationsSources: SectionSource[] = organizations?.memberships.length
    ? [sourceEntry("wikidata")]
    : [];
  // Rankings rows carry established source-native measures only. The former
  // Civica composite is preserved research and is not returned here.
  const rankingsSources: SectionSource[] = scoresRows?.length
    ? dedup(scoresRows.map((r) => r.source)).map((id) => sourceEntry(id))
    : [];

  const wikidataRetrievedAt = wikidataSource?.lastSyncAt
    ? wikidataSource.lastSyncAt.toISOString()
    : null;

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
    "governance-evidence":
      governanceEvidenceResult.status === "unavailable" ? (
        <Banner variant="warn">
          Source-native governance observations are temporarily unavailable.
          Civica is not treating this as evidence that {jurisdiction.name} has
          no governance evidence.
        </Banner>
      ) : governanceEvidence && governanceEvidence.rows.length > 0 ? (
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
      ) : (
        <Banner variant="info">
          No source-native governance observations are currently recorded for
          {jurisdiction.name}. This is a coverage state, not a judgment about
          the country.
        </Banner>
      ),
    longitudinal: (
      <CountryTrendSection
        slug={slug}
        embedded
        initialSeries={indicatorHistory}
        initialSources={allSources}
      />
    ),
    conditions: (
      <CivicaConditionsPanel
        jurisdictionId={jurisdiction.id}
        release={conditionsRelease}
        releaseStatus={conditionsReleaseResult.status}
      />
    ),
    government:
      govStructureResult.status === "unavailable" ? (
        <Banner variant="warn">
          Government-structure records are temporarily unavailable. Civica is
          not treating this as evidence that {jurisdiction.name} has no
          institutions.
        </Banner>
      ) : orgChart ? (
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
      ) : (
        <Banner variant="info">
          No source-backed government-structure records have been compiled for
          {jurisdiction.name} yet. This is not a claim that the country has no
          institutions.
        </Banner>
      ),
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
          countrySlug={slug}
          retrievedAt={wikidataRetrievedAt}
          initialRows={leadersRows}
        />
        <SourcesStrip sources={leadersSources} />
      </>
    ),
    bills: (
      <>
        <FactbookBills
          countrySlug={slug}
          countryName={jurisdiction.name}
          initialResult={bills}
        />
        <SourcesStrip sources={billsSources} />
      </>
    ),
    organizations: (
      <>
        <FactbookOrganizations
          jurisdictionId={jurisdiction.id}
          countryName={jurisdiction.name}
          retrievedAt={wikidataRetrievedAt}
          initialData={organizations}
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
          rows={scoresRows}
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
