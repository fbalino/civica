import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getJurisdictionBySlug,
  getFactbookCountryOptions,
  getCICountryDetail,
  getGovernmentStructure,
  getLeaderTimeline,
  getSource,
  getAllSources,
  getBillsForJurisdiction,
  getInternationalMembershipsBySlugs,
} from "@/lib/db/queries";
import { getLegislatureForJurisdiction } from "@/lib/factbook/legislature";
import { getScoresForJurisdiction } from "@/lib/db/queries-scores";
import {
  FactbookSidebar,
  type FactbookSidebarItem,
} from "@/components/factbook/FactbookSidebar";
import {
  FactbookRightRail,
  type SubsectionEntry,
  type SourceEntry,
} from "@/components/factbook/FactbookRightRail";
import { FactbookGovOrgChart } from "@/components/factbook/FactbookGovOrgChart";
import { buildOrgChartFromGovernmentStructure } from "@/lib/factbook/gov-org-chart";
import { FactbookLegislature } from "@/components/factbook/FactbookLegislature";
import { FactbookLeaders } from "@/components/factbook/FactbookLeaders";
import { FactbookBills } from "@/components/factbook/FactbookBills";
import { FactbookOrganizations } from "@/components/factbook/FactbookOrganizations";
import { ScoresAndRankings } from "@/components/scores/ScoresAndRankings";
import { CivicaIndexPanel } from "@/components/country/CivicaIndexPanel";
import { sourceLabel } from "@/lib/data/sources";
import "@/app/civica-data.css";

export const revalidate = 3600;

// Civica Data tab of the unified /country/[slug] page. This is the Civica
// value-add layer — the governance sections that overlay (rather than
// reproduce) the CIA Factbook prose:
//   1. Civica Index   — full CI body (score + Pulse, dimensions, history,
//                        peers, rank, compare) via <CivicaIndexPanel>.
//   2. Government      — the "How power is organised" org chart.
//   3. Legislature     — chamber / hemicycle.
//   4. Leaders         — current officeholder timeline.
//   5. Bills           — recent legislative actions.
//   6. Organizations   — international memberships footprint.
//   7. Rankings        — curated scores & rankings.
//
// Every section is visibility-gated upfront so the sidebar + right rail
// never list a phantom anchor. The masthead, tab bar, sticky search,
// reconciliation notice, and AI drawer live in the shared layout — this
// page renders content-only inside `.factbook-body`.

type SectionId =
  | "civica-index"
  | "government"
  | "legislature"
  | "leaders"
  | "bills"
  | "organizations"
  | "rankings";

type SectionPlan = { id: SectionId; label: string };

const SECTION_PLAN: SectionPlan[] = [
  { id: "civica-index", label: "Civica Index" },
  { id: "government", label: "Government" },
  { id: "legislature", label: "Legislature" },
  { id: "leaders", label: "Leaders" },
  { id: "bills", label: "Bills" },
  { id: "organizations", label: "Organizations" },
  { id: "rankings", label: "Rankings" },
];

export default async function CountryCivicaDataTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) notFound();

  // Each section's data fetch doubles as its visibility gate. Every fetch
  // soft-fails so a Neon hiccup degrades a single section rather than
  // 500-ing the whole tab.
  const [
    ciDetail,
    govStructure,
    leadersRows,
    legislatureData,
    billsResult,
    memberships,
    scoresRows,
    countryOptions,
    wikidataSource,
    allSources,
  ] = await Promise.all([
    getCICountryDetail(slug).catch(() => null),
    getGovernmentStructure(jurisdiction.id).catch(
      () => ({ bodies: [], offices: [], currentTerms: [] }) as Awaited<
        ReturnType<typeof getGovernmentStructure>
      >
    ),
    getLeaderTimeline(jurisdiction.id).catch(() => []),
    getLegislatureForJurisdiction(jurisdiction.id).catch(() => null),
    getBillsForJurisdiction(slug, 20).catch(() => null),
    getInternationalMembershipsBySlugs([jurisdiction.id]).catch(() => []),
    getScoresForJurisdiction(jurisdiction.id).catch(() => []),
    getFactbookCountryOptions().catch(() => []),
    getSource("wikidata").catch(() => null),
    // Whole sources table → real `last_sync_at` dates for the right-rail
    // "Sources on this page" list. Soft-fails to [] so a Neon hiccup just
    // drops the dates, never the page.
    getAllSources().catch(
      () => [] as Awaited<ReturnType<typeof getAllSources>>
    ),
  ]);

  // Build the org chart once — reused for the gate and the render.
  const orgChart = buildOrgChartFromGovernmentStructure(
    govStructure.bodies,
    govStructure.offices,
    govStructure.currentTerms
  );

  // Per-section visibility flags.
  const hasCivicaIndex = !!ciDetail;
  const hasGovernment = govStructure.offices.length > 0 && !!orgChart;
  const hasLegislature = !!legislatureData;
  const hasLeaders = leadersRows.length > 0;
  const hasBills = !!billsResult && billsResult.rows.length > 0;
  const hasOrganizations = memberships.length > 0;
  const hasRankings = scoresRows.length > 0;

  const isVisible = (id: SectionId): boolean => {
    switch (id) {
      case "civica-index":
        return hasCivicaIndex;
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

  const sidebarItems: FactbookSidebarItem[] = visibleSections.map((s) => ({
    id: s.id,
    label: s.label,
  }));

  // Right-rail subsection map. EVERY visible section must be a key here —
  // the rail's section IntersectionObserver only tracks ids that appear in
  // this map, so a section absent from the map never becomes "active" and
  // the "In this section" list stays frozen on whichever section IS present
  // (the old bug: only Government had an entry, so it never updated). The
  // sub-anchor ids match the DOM ids rendered below (and inside
  // <CivicaIndexPanel>); the observer silently ignores any that didn't
  // render (e.g. an absent Pulse block).
  const subsectionsBySection: Record<string, SubsectionEntry[]> = {};
  if (hasCivicaIndex) {
    subsectionsBySection["civica-index"] = [
      { id: "ci-score", label: "Score & Pulse" },
      { id: "ci-dimensions", label: "Dimension breakdown" },
      { id: "ci-history", label: "Quarterly history" },
      { id: "ci-rank", label: "Regional rank & peers" },
      { id: "ci-pulse", label: "Pulse changelog" },
    ];
  }
  if (hasGovernment) {
    subsectionsBySection["government"] = [
      { id: "government--structure", label: "How power is organised" },
    ];
  }
  if (hasLegislature) {
    subsectionsBySection["legislature"] = [
      { id: "legislature--chambers", label: "Chamber composition" },
    ];
  }
  if (hasLeaders) {
    subsectionsBySection["leaders"] = [
      { id: "leaders--officeholders", label: "Current officeholders" },
    ];
  }
  if (hasBills) {
    subsectionsBySection["bills"] = [
      { id: "bills--recent", label: "Recent legislation" },
    ];
  }
  if (hasOrganizations) {
    subsectionsBySection["organizations"] = [
      { id: "organizations--summary", label: "Membership summary" },
      { id: "organizations--list", label: "Memberships by type" },
    ];
  }
  if (hasRankings) {
    subsectionsBySection["rankings"] = [
      { id: "rankings--scores", label: "Scores & rankings" },
    ];
  }

  // The Organizations section's grouping, summary stats, and co-membership
  // context are computed inside <FactbookOrganizations> from its own deepened
  // fetch. The `memberships` array fetched above is retained only for the
  // visibility gate (`hasOrganizations`) and the right-rail Wikidata source
  // attribution below.

  // Right-rail "Sources on this page" — accurate to what THIS tab actually
  // renders. Each entry carries the real source id (so the <SourceDot> reads
  // green/amber correctly) and the real `last_sync_at` date from the sources
  // table. We collect the set of source ids contributing to the tab, then
  // emit one entry per id, deduped and ordered by section.
  const sourceById = new Map(allSources.map((s) => [s.id, s]));
  const formatSyncDate = (id: string): string => {
    const d = sourceById.get(id)?.lastSyncAt ?? null;
    return d ? d.toISOString().slice(0, 10) : "Not yet synced";
  };

  const sourceIdsOnPage: string[] = [];
  const pushSource = (id: string) => {
    if (id && !sourceIdsOnPage.includes(id)) sourceIdsOnPage.push(id);
  };

  // Civica Index composite + its four dimension upstreams (always cited in
  // the breakdown the panel renders).
  if (hasCivicaIndex) {
    if (ciDetail) {
      for (const dim of ciDetail.dimensions) pushSource(dim.sourceId);
    }
  }
  // Government structure + leaders are Wikidata-derived; legislature seat
  // composition is IPU Parline.
  if (hasGovernment || hasLeaders) pushSource("wikidata");
  if (hasLegislature) pushSource("ipu_parline");
  // Bills carry their own per-source provenance (Congress.gov, national
  // legislature feeds, …) — pull the distinct ids from the rendered rows.
  if (hasBills && billsResult) {
    for (const b of billsResult.rows) pushSource(b.sourceId);
  }
  // Organizations / international memberships are Wikidata-derived.
  if (hasOrganizations) pushSource("wikidata");
  // Rankings rows each carry a `.source` (V-Dem, Freedom House, HDI, CPI,
  // RSF, plus the Civica Index + Pulse composites).
  if (hasRankings) {
    for (const r of scoresRows) pushSource(r.source);
  }

  const sources: SourceEntry[] = [];
  // Lead with the Civica Index composite itself (frozen quarterly vintage →
  // amber dot via the civica_curated mapping; it has no own sources-table row).
  if (hasCivicaIndex) {
    sources.push({
      name: "Civica Index (composite)",
      date: ciDetail?.composite?.calculatedAt
        ? new Date(ciDetail.composite.calculatedAt)
            .toISOString()
            .slice(0, 10)
        : "Beta",
      sourceId: "civica_curated",
    });
  }
  // Pulse upstream (GDELT) only when pulse events actually rendered on the
  // tab. CivicaIndexPanel renders the Pulse changelog from getPulseChangelog;
  // surface GDELT whenever a CI detail exists (the panel's Pulse block).
  if (hasCivicaIndex) pushSource("gdelt");

  for (const id of sourceIdsOnPage) {
    // `civica_curated` is already represented by the explicit "Civica Index
    // (composite)" lead entry above — don't list it twice (the rankings
    // section's CI row also carries this id).
    if (id === "civica_curated") continue;
    sources.push({
      name: sourceLabel(id),
      date: formatSyncDate(id),
      sourceId: id,
    });
  }

  // Edge case: a country with a masthead but zero Civica overlays. Render
  // a clean note rather than an empty grid with a phantom sidebar.
  if (visibleSections.length === 0) {
    return (
      <div className="factbook-body">
        <div className="factbook-main">
          <section className="factbook-section">
            <header className="factbook-section-header">
              <h2 className="factbook-section-title">Civica Data</h2>
            </header>
            <p
              style={{
                color: "var(--color-text-60)",
                fontSize: "var(--text-15)",
              }}
            >
              Civica governance data for {jurisdiction.name} has not been
              compiled yet. See the{" "}
              <Link href={`/country/${slug}`}>Factbook tab</Link> for the
              source reference, or browse the{" "}
              <Link href="/civica-index">Civica Index</Link>.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="factbook-body">
      <FactbookSidebar items={sidebarItems} countries={countryOptions} />

      <div className="factbook-main">
        {visibleSections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="factbook-section"
          >
            <header className="factbook-section-header">
              <h2 className="factbook-section-title">{section.label}</h2>
            </header>

            {/* 1. Civica Index — full CI body, reused from the standalone
                /civica-index/[slug] rendering via the extracted panel. */}
            {section.id === "civica-index" && <CivicaIndexPanel slug={slug} />}

            {/* 2. Government — "How power is organised" org chart. */}
            {section.id === "government" && orgChart && (
              <div id="government--structure" className="civica-data-gov-structure">
                <p className="civica-data-gov-eyebrow">Civica · structure</p>
                <h3 className="civica-data-gov-heading">
                  How power is organised
                </h3>
                <FactbookGovOrgChart
                  chart={orgChart}
                  countryName={jurisdiction.name}
                />
              </div>
            )}

            {/* 3. Legislature. */}
            {section.id === "legislature" && (
              <div id="legislature--chambers" className="civica-data-anchor">
                <FactbookLegislature
                  jurisdictionId={jurisdiction.id}
                  countryName={jurisdiction.name}
                />
              </div>
            )}

            {/* 4. Leaders. */}
            {section.id === "leaders" && (
              <div id="leaders--officeholders" className="civica-data-anchor">
                <FactbookLeaders
                  jurisdictionId={jurisdiction.id}
                  countryName={jurisdiction.name}
                  retrievedAt={
                    wikidataSource?.lastSyncAt
                      ? wikidataSource.lastSyncAt.toISOString()
                      : null
                  }
                />
              </div>
            )}

            {/* 5. Bills. */}
            {section.id === "bills" && (
              <div id="bills--recent" className="civica-data-anchor">
                <FactbookBills
                  countrySlug={slug}
                  countryName={jurisdiction.name}
                />
              </div>
            )}

            {/* 6. Organizations — international footprint. The enriched
                Organizations section (grouped membership cards with role,
                accession year, org scale, and co-membership context) lives
                in <FactbookOrganizations>, which fetches its own deepened
                data by jurisdictionId. The page keeps the lighter
                `memberships` fetch above only for the visibility gate and
                the right-rail source attribution. */}
            {section.id === "organizations" && (
              <FactbookOrganizations
                jurisdictionId={jurisdiction.id}
                countryName={jurisdiction.name}
                retrievedAt={
                  wikidataSource?.lastSyncAt
                    ? wikidataSource.lastSyncAt.toISOString()
                    : null
                }
              />
            )}

            {/* 7. Rankings. */}
            {section.id === "rankings" && (
              <div id="rankings--scores" className="civica-data-anchor">
                <ScoresAndRankings
                  jurisdictionId={jurisdiction.id}
                  countryName={jurisdiction.name}
                  variant="factbook"
                />
              </div>
            )}
          </section>
        ))}
      </div>

      <FactbookRightRail
        subsectionsBySection={subsectionsBySection}
        sources={sources}
      />
    </div>
  );
}
