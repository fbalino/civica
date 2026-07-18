/**
 * Public-reader research-visualization contract.
 *
 * This is deliberately an inventory rather than a component registry. Each
 * record identifies the reader-facing visual that encodes research data and
 * points reviewers to the exact route/component that must keep its accessible
 * equivalent, provenance, missingness semantics, and rights-consistent data
 * access in sync. Interface icons, purely orientational basemaps, and native
 * semantic tables belong to their own accessibility contracts and are not
 * silently counted as research visualizations here.
 */

export type VisualizationDataAccess = "permitted-download" | "rights-withheld";

export interface ResearchVisualizationContract {
  id: string;
  title: string;
  components: readonly string[];
  routes: readonly string[];
  equivalent: string;
  provenance: string;
  missingness: string;
  keyboard: string;
  dataAccess: VisualizationDataAccess;
  dataAccessPath: string;
}

export const RESEARCH_VISUALIZATION_CONTRACT: readonly ResearchVisualizationContract[] = [
  {
    id: "atlas-source-native-map",
    title: "Atlas source-native choropleth",
    components: [
      "src/components/atlas/AtlasWorldMap.tsx",
      "src/components/atlas/AtlasStandaloneClient.tsx",
    ],
    routes: ["/atlas"],
    equivalent: "Synchronized Map layer table alternative",
    provenance: "Active layer source, freshness, and upstream vintage",
    missingness: "Map-eligible sovereign-state scope and explicit no-data rows",
    keyboard: "Country selector and table provide the complete non-pointer path",
    dataAccess: "permitted-download",
    dataAccessPath: "/downloads/civica-atlas-2026-07-11.json.gz",
  },
  {
    id: "index-methodology-weights",
    title: "Historical Civica Index dimension weights",
    components: ["src/app/(reader)/civica-index/methodology/page.tsx"],
    routes: ["/civica-index/methodology"],
    equivalent: "Dimension, weight, primary-source, and candidate-cross-check table",
    provenance: "Versioned Civica Index methodology and source-input record",
    missingness: "Candidate or unavailable dimensions are not presented as zero-weight components",
    keyboard: "No chart-only interaction; the complete table is native document content",
    dataAccess: "permitted-download",
    dataAccessPath: "/api/v1/index/methodology",
  },
  {
    id: "organization-membership-map",
    title: "Organization membership map",
    components: ["src/components/atlas/OrgDetailPanel.tsx"],
    routes: ["/organizations/[slug]"],
    equivalent: "Full dated member roster with country, role, and membership status",
    provenance: "Per-organization publisher roster source and release capture",
    missingness: "Selected rosters name their coverage and never treat absence as non-membership",
    keyboard: "The complete roster is native document content and country links remain keyboard reachable",
    dataAccess: "rights-withheld",
    dataAccessPath: "/licensing#rights-manifest",
  },
  {
    id: "indicator-history",
    title: "Source-native indicator histories",
    components: [
      "src/components/ci/IndicatorTrendChart.tsx",
      "src/components/ci/CountryTrendSection.tsx",
      "src/components/compare/CompareIndicatorHistory.tsx",
    ],
    routes: ["/country/[slug]/civica-data", "/compare"],
    equivalent: "Source-native observation table, including gaps and captured release",
    provenance: "Per-series source, freshness, and upstream release",
    missingness: "Unobserved years remain explicit gaps and never become zero",
    keyboard: "Series, range, and individual-year controls are keyboard reachable",
    dataAccess: "permitted-download",
    dataAccessPath: "/api/countries/{slug}/indicator-history?format=csv",
  },
  {
    id: "legislature-composition",
    title: "Legislature composition",
    components: [
      "src/components/factbook/FactbookLegislatureChart.tsx",
      "src/components/factbook/ChamberComposition.tsx",
      "src/components/factbook/PartyBrowser.tsx",
      "src/components/factbook/FactbookLegislature.tsx",
    ],
    routes: ["/country/[slug]/civica-data", "/compare"],
    equivalent: "Party browser with each party's seats, share, rank, and coalition state",
    provenance: "Composition source and captured date supplied by the chamber context",
    missingness: "No composition is a named ingest gap, never an empty chamber",
    keyboard: "Party dimming and disclosure controls are native buttons",
    dataAccess: "rights-withheld",
    dataAccessPath: "/licensing#rights-manifest",
  },
  {
    id: "party-ideology",
    title: "Party ideology compass",
    components: [
      "src/components/parties/IdeologyCompass.tsx",
      "src/components/parties/PartyExplorer.tsx",
    ],
    routes: ["/parties"],
    equivalent: "Sortable party table with source-backed seats and ideology fields",
    provenance: "Per-party composition and V-Party source disclosures",
    missingness: "Unrecorded or non-displayable ideology remains named and unplotted",
    keyboard: "Filters and plotted-party focus targets are keyboard reachable",
    dataAccess: "rights-withheld",
    dataAccessPath: "/licensing#rights-manifest",
  },
  {
    id: "leader-tenure",
    title: "Current-officeholder tenure timeline",
    components: [
      "src/components/factbook/LeaderTenureTimeline.tsx",
      "src/components/factbook/FactbookLeaders.tsx",
    ],
    routes: ["/country/[slug]/civica-data"],
    equivalent: "Current-officeholder roster with office and current-term start",
    provenance: "Wikidata source freshness shown with the leadership roster",
    missingness: "Missing start dates are omitted; the visual never invents a tenure",
    keyboard: "No chart-only interaction; the roster is native document content",
    dataAccess: "permitted-download",
    dataAccessPath: "/api/countries/{slug}/leaders",
  },
  {
    id: "index-history",
    title: "Civica Index country estimate and history",
    components: [
      "src/components/country/CivicaIndexPanel.tsx",
      "src/components/editorial/ScorePosition.tsx",
    ],
    routes: ["/country/[slug]/civica-data"],
    equivalent: "Score card plus quarter-by-quarter country history table",
    provenance: "Visible quarterly version and methodology/source-input disclosure",
    missingness: "Incomplete inputs and unavailable quarters are named; no estimate is interpolated or presented as no change",
    keyboard: "The score card and native tables are the complete non-pointer equivalent",
    dataAccess: "permitted-download",
    dataAccessPath: "/api/v1/index/{country_slug}/history",
  },
  {
    id: "pca-eigenvalue",
    title: "PCA eigenvalue scree figure",
    components: ["src/components/methodology/EigenvalueChart.tsx"],
    routes: ["/civica-index/methodology/pca-appendix"],
    equivalent: "Principal-component eigenvalue and cumulative-variance table",
    provenance: "Archived PCA input artifact and methodology version",
    missingness: "No data yields no chart or unsupported conclusion",
    keyboard: "No chart-only interaction; the data table is native document content",
    dataAccess: "permitted-download",
    dataAccessPath: "PCA figure CSV download",
  },
  {
    id: "pulse-backtest-trajectories",
    title: "Archived Pulse backtest trajectories",
    components: ["src/app/(reader)/civica-index/methodology/pulse/backtest/page.tsx"],
    routes: ["/civica-index/methodology/pulse/backtest"],
    equivalent: "Per-case day-offset and dimensional-delta table",
    provenance: "Archived run timestamp and backtest case metadata",
    missingness: "No run remains visibly unrun rather than a neutral trajectory",
    keyboard: "No chart-only interaction; trajectory rows are native document content",
    dataAccess: "rights-withheld",
    dataAccessPath: "/licensing#rights-manifest",
  },
] as const;

/**
 * Visual surfaces intentionally outside the research-visualization contract.
 * Their accessibility is still guarded by their own module contracts.
 */
export const NON_RESEARCH_VISUAL_SURFACES = [
  {
    components: [
      "src/components/factbook/CountryMap.tsx",
      "src/components/factbook/CountryMapTile.tsx",
      "src/components/factbook/MapExplorerModal.tsx",
    ],
    reason:
      "Orientational basemap with OpenStreetMap/Protomaps attribution; it does not encode a Civica research variable.",
  },
  {
    components: ["src/components/factbook/FactbookGovOrgChart.tsx"],
    reason:
      "Semantic branch/office document structure, not a chart; cards already expose the complete facts in reading order.",
  },
  {
    components: ["src/components/ci/GovernmentTypesAccordionExplorer.tsx"],
    reason:
      "Legacy composite explorer retained for research history; its only route redirects and it is not a live reader surface.",
  },
  {
    components: [
      "src/components/compare/CompareCivicaIndex.tsx",
      "src/components/compare/CompareTimelineOverlay.tsx",
    ],
    reason:
      "Retained comparison-composite research code with no live import path; the public comparison surface uses source-native evidence instead.",
  },
  {
    components: [
      "src/components/factbook/FactbookOutcomes.tsx",
      "src/components/factbook/FactbookOutcomesGraph.tsx",
    ],
    reason:
      "Legacy peer-band implementation retained without a live import path; the current Civica Data surface does not render it.",
  },
  {
    components: [
      "src/components/CivicaLogo.tsx",
      "src/components/MobileNav.tsx",
      "src/components/ThemeToggle.tsx",
    ],
    reason: "Interface or brand artwork, governed by the image and control semantics contract.",
  },
] as const;

export function visualizationContractErrors(
  entries: readonly ResearchVisualizationContract[] = RESEARCH_VISUALIZATION_CONTRACT,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) errors.push(`duplicate or empty id: ${entry.id}`);
    ids.add(entry.id);
    for (const [field, value] of Object.entries({
      title: entry.title,
      equivalent: entry.equivalent,
      provenance: entry.provenance,
      missingness: entry.missingness,
      keyboard: entry.keyboard,
      dataAccessPath: entry.dataAccessPath,
    })) {
      if (!value.trim()) errors.push(`${entry.id}: missing ${field}`);
    }
    if (entry.components.length === 0) errors.push(`${entry.id}: no component witness`);
    if (entry.routes.length === 0) errors.push(`${entry.id}: no route witness`);
  }
  return errors;
}
