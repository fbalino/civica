/**
 * The publisher-attribution/v1 registry (CLM-020, APR-D174). Not UI code:
 * only the static validator, the live validator, and tests import it.
 *
 * What it closes:
 *   1. Surfaces — every place a number sits beside a publisher's name, with
 *      the origin of the number and the visible disclosure the scan requires.
 *      Known gaps are registered exceptions tied to an open follow-up.
 *   2. Provenance renderers — every source file that renders a `SourceDot` or
 *      `FactValueDot` is classified. A new provenance surface fails the scan
 *      until someone decides what its numbers are.
 *   3. Derived-field readers — every source file that reads a Civica-derived
 *      field (rescaled scores, ranks, composite tables, the legacy
 *      country-metric table) is listed with the tokens it may use.
 *   4. Scale suffixes — every source file whose code prints a 0-to-100 scale
 *      suffix ("/100", "/ 100", "(83/100)", "out of 100") is listed with a
 *      reason the scan checks. The former Freedom House row printed Civica's
 *      rescale this way, so a new suffix fails until someone decides whose
 *      number it follows.
 *   5. The live exception ledger, the live sample, and the baseline ratchet:
 *      an exception, reader allowance, or scale-suffix allowance that is not
 *      in `scripts/publisher-attribution-baseline.json` fails until it names
 *      an approving decision or task and the baseline is updated on purpose.
 *
 * Limits (current list: F13 in plan/evidence/CLM-020/follow-ups.md): the scan
 * cannot see other new arithmetic in a file that reads no registered field
 * and prints no scale suffix, and allowances are per file, so a new derived
 * read or scale suffix inside an allowed file is not caught. The rule in
 * DESIGN.md and AGENTS.md is a review rule for those cases.
 */

import type { DisplayedValueOriginKind } from "./publisher-attribution";

export type SurfaceDisclosure =
  | "none"
  | "value_origin_note"
  | "column_header"
  | "adjacent_statement"
  | "api_contract_field"
  | "visible_label";

export interface EvidenceRequirement {
  file: string;
  /** Code that must remain (comments stripped, whitespace collapsed). */
  mustContain: string;
}

export interface SurfaceException {
  /** An open checklist task id or a `### F<n>` anchor in follow-ups.md. */
  followUp: string;
  /** An APR decision id or a checklist task id that approved the gap. */
  approvedBy: string;
  reason: string;
}

export interface PublisherAttributionSurface {
  id: string;
  summary: string;
  routes: readonly string[];
  files: readonly string[];
  origins: readonly DisplayedValueOriginKind[];
  disclosure: SurfaceDisclosure;
  evidence: readonly EvidenceRequirement[];
  verification: "unit_and_live" | "unit" | "static" | "live";
  /** Country score rows only: the `ScoreRow.id` this surface governs. */
  scoreRowId?: string;
  exception?: SurfaceException;
}

export type ProvenanceRendererClass =
  | "surface"
  | "publisher_values"
  | "records_only"
  | "civica_clock_unlabeled"
  | "not_rendered"
  | "admin_only"
  | "design_system_demo"
  | "disclosure_primitive";

export interface ProvenanceRenderer {
  file: string;
  class: ProvenanceRendererClass;
  note: string;
  surfaceIds?: readonly string[];
  followUp?: string;
}

export const DERIVED_FIELD_TOKENS = [
  "normalizedScore",
  "normalized_score",
  "totalRanked",
  "total_ranked",
  "rankWithinDimension",
  "competitionRanks",
  "ciCompositeScores",
  "ci_composite_scores",
  "countryMetrics",
  "country_metrics",
] as const;
export type DerivedFieldToken = (typeof DERIVED_FIELD_TOKENS)[number];

export type DerivedFieldReaderClass =
  | "surface"
  | "score_contract"
  | "api_contract"
  | "retired_index_api"
  | "not_rendered"
  | "imported_only_by_not_rendered"
  | "query_module"
  | "computation_or_storage"
  | "governance_tooling"
  | "attribution_tooling";

export interface DerivedFieldReader {
  file: string;
  class: DerivedFieldReaderClass;
  /** Tokens this file may use anywhere in its code. */
  allowedTokens?: readonly DerivedFieldToken[];
  /** Exact code snippets removed before the token check (score contract). */
  allowedSnippets?: readonly string[];
  surfaceIds?: readonly string[];
  note: string;
  approvedBy: string;
}

export interface LiveCheckException {
  id: string;
  check: string;
  scope: { releaseId: string; componentId: string };
  followUp: string;
  approvedBy: string;
  reason: string;
}

/**
 * Why a file may print a 0-to-100 scale suffix. The scan checks each class's
 * condition:
 * - `civica_calculation_surface`: every named surface lists the file, is a
 *   Civica calculation, has a visible disclosure, and carries no exception;
 * - `not_rendered`: the rendered-module ledger does not mount the file, and
 *   every application file that imports it is classified not_rendered too;
 * - `design_system_demo`: a /design-system file that shows the scale beside
 *   the ValueOriginNote marker;
 * - `tooling`: the ledger does not mount the file, and only other tooling
 *   imports it (scripts and tests are outside the scan).
 */
export type ScaleSuffixAllowanceClass =
  | "civica_calculation_surface"
  | "not_rendered"
  | "design_system_demo"
  | "tooling";

export interface ScaleSuffixAllowance {
  file: string;
  class: ScaleSuffixAllowanceClass;
  /** `civica_calculation_surface` only: the surfaces that disclose it. */
  surfaceIds?: readonly string[];
  note: string;
  /** An APR decision id or a checklist task id that approved the allowance. */
  approvedBy: string;
}

const CIVICA_DATA = "/country/[slug]/civica-data";

export const PUBLISHER_ATTRIBUTION_SURFACES: readonly PublisherAttributionSurface[] = [
  {
    id: "country-scores.vdem",
    summary:
      "Country Rankings table: V-Dem's own Liberal Democracy Index figure at V-Dem's published precision.",
    routes: [CIVICA_DATA],
    files: [
      "src/lib/ci/publisher-scores.ts",
      "src/lib/db/queries-scores.ts",
      "src/components/scores/ScoresAndRankings.tsx",
    ],
    origins: ["publisher_published"],
    disclosure: "none",
    evidence: [
      {
        file: "src/lib/ci/publisher-scores.ts",
        mustContain: 'valueOrigin: { kind: "publisher_published" }',
      },
    ],
    verification: "unit_and_live",
    scoreRowId: "vdem-libdem",
  },
  {
    id: "country-scores.freedom-house-status",
    summary:
      "Country Rankings table: Freedom House status with its Freedom in the World edition, produced by Freedom House's published rule; no number.",
    routes: [CIVICA_DATA],
    files: [
      "src/lib/ci/publisher-scores.ts",
      "src/lib/db/queries-scores.ts",
      "src/components/scores/ScoresAndRankings.tsx",
    ],
    origins: ["publisher_rule_applied"],
    disclosure: "value_origin_note",
    evidence: [
      { file: "src/lib/ci/publisher-scores.ts", mustContain: 'kind: "publisher_rule_applied"' },
      {
        file: "src/components/scores/ScoresAndRankings.tsx",
        mustContain: "<ValueOriginNote origin={row.valueOrigin} />",
      },
    ],
    verification: "unit_and_live",
    scoreRowId: "freedom-house",
  },
  {
    id: "api.country-scores",
    summary:
      "GET /api/countries/:slug/scores: the same rows with their origin, rights-filtered like the Governance Evidence API.",
    routes: ["/api/countries/[slug]/scores"],
    files: ["src/app/api/countries/[slug]/scores/route.ts", "src/lib/ci/publisher-scores.ts"],
    origins: ["publisher_published", "publisher_rule_applied"],
    disclosure: "api_contract_field",
    evidence: [
      {
        file: "src/app/api/countries/[slug]/scores/route.ts",
        mustContain: "shapePublicCountryScores(",
      },
      { file: "src/lib/ci/publisher-scores.ts", mustContain: "valueOrigin: zPublisherValueOrigin" },
    ],
    verification: "unit",
  },
  {
    id: "conditions.position.country",
    summary:
      "Country Conditions cards: Civica's 0 to 100 position carries the Civica-calculation marker and formula.",
    routes: [CIVICA_DATA],
    files: ["src/components/conditions/CivicaConditionsPanel.tsx"],
    origins: ["civica_calculation"],
    disclosure: "value_origin_note",
    evidence: [
      { file: "src/components/conditions/CivicaConditionsPanel.tsx", mustContain: "<ValueOriginNote" },
      {
        file: "src/components/conditions/CivicaConditionsPanel.tsx",
        mustContain: "calculation.scoreOrigin",
      },
    ],
    verification: "unit_and_live",
  },
  {
    id: "conditions.position.compare",
    summary:
      "Compare Conditions: publisher components only; Civica positions are hidden, matching the banner.",
    routes: ["/compare"],
    files: ["src/components/compare/CompareConditions.tsx"],
    origins: ["publisher_published"],
    disclosure: "none",
    evidence: [
      {
        file: "src/components/compare/CompareConditions.tsx",
        mustContain: "showCivicaPosition={false}",
      },
    ],
    verification: "unit",
  },
  {
    id: "conditions.position.explorer",
    summary:
      "Conditions explorer: the position column is headed as a Civica calculation and the formulas are listed.",
    routes: ["/civica-conditions"],
    files: ["src/components/conditions/ConditionsReleaseExplorer.tsx"],
    origins: ["civica_calculation"],
    disclosure: "column_header",
    evidence: [
      {
        file: "src/components/conditions/ConditionsReleaseExplorer.tsx",
        mustContain: "{CIVICA_CALCULATION_COLUMN_LABEL}",
      },
      {
        file: "src/components/conditions/ConditionsReleaseExplorer.tsx",
        mustContain: "<CivicaCalculationFormulas",
      },
    ],
    verification: "unit",
  },
  {
    id: "api.conditions",
    summary: "GET /api/v1/conditions: every scored position carries scoreOrigin.",
    routes: ["/api/v1/conditions"],
    files: ["src/lib/api/contract/schemas.ts", "src/lib/conditions/public-release.ts"],
    origins: ["civica_calculation"],
    disclosure: "api_contract_field",
    evidence: [
      { file: "src/lib/api/contract/schemas.ts", mustContain: 'kind: z.literal("civica_calculation")' },
      { file: "src/lib/conditions/public-release.ts", mustContain: 'kind: "civica_calculation"' },
    ],
    verification: "unit_and_live",
  },
  {
    id: "conditions.components",
    summary:
      "Conditions components: each publisher's own value, unit, and reference year beside its source.",
    routes: [CIVICA_DATA, "/compare", "/civica-conditions"],
    files: [
      "src/components/conditions/CivicaConditionsPanel.tsx",
      "src/components/conditions/ConditionsReleaseExplorer.tsx",
    ],
    origins: ["publisher_published"],
    disclosure: "none",
    evidence: [
      { file: "src/components/conditions/CivicaConditionsPanel.tsx", mustContain: "component.nativeValue" },
      {
        file: "src/components/conditions/ConditionsReleaseExplorer.tsx",
        mustContain: "component.nativeValue",
      },
    ],
    verification: "live",
  },
  {
    id: "indicator-history.display-index",
    summary:
      "Country indicator history: the chart's shared axis is a Civica rescale, stated beside the chart; the table keeps publisher values.",
    routes: [CIVICA_DATA],
    files: ["src/components/ci/CountryTrendSection.tsx"],
    origins: ["civica_calculation", "publisher_published"],
    disclosure: "adjacent_statement",
    evidence: [
      {
        file: "src/components/ci/CountryTrendSection.tsx",
        mustContain: "The chart rescales each publisher series to a shared visual axis",
      },
    ],
    verification: "static",
  },
  {
    id: "compare.indicator-history",
    summary:
      "Compare indicator history: the shared visual index is described as a comparison aid; the table keeps publisher values.",
    routes: ["/compare"],
    files: ["src/components/compare/CompareIndicatorHistory.tsx"],
    origins: ["civica_calculation", "publisher_published"],
    disclosure: "adjacent_statement",
    evidence: [
      {
        file: "src/components/compare/CompareIndicatorHistory.tsx",
        mustContain: "its shared visual index is only a comparison aid",
      },
    ],
    verification: "static",
  },
  {
    id: "governance-change.native-change",
    summary:
      "Governance change: Civica's publisher-native difference between two years is described as Civica's.",
    routes: ["/governance-change"],
    files: ["src/app/(reader)/governance-change/page.tsx"],
    origins: ["civica_calculation"],
    disclosure: "adjacent_statement",
    evidence: [
      {
        file: "src/app/(reader)/governance-change/page.tsx",
        mustContain: "Civica reports the publisher-native difference",
      },
    ],
    verification: "static",
  },
  {
    id: "elections.projected-dates",
    summary:
      "Elections: projected election years carry the visible Est. label and an estimate note; results are publisher figures.",
    routes: ["/elections", "/compare"],
    files: ["src/app/elections/ElectionsClient.tsx", "src/components/compare/CompareElections.tsx"],
    origins: ["civica_calculation", "publisher_published"],
    disclosure: "visible_label",
    evidence: [
      { file: "src/app/elections/ElectionsClient.tsx", mustContain: "`Est. ${" },
      { file: "src/app/elections/ElectionsClient.tsx", mustContain: 'label="About this estimate"' },
      { file: "src/components/compare/CompareElections.tsx", mustContain: "`Est. ${" },
    ],
    verification: "static",
  },
  {
    id: "electoral-systems.counts",
    summary:
      "Electoral systems: country counts per system are Civica's grouping of IPU records, stated on the page.",
    routes: ["/elections/systems"],
    files: [
      "src/app/elections/systems/ElectoralSystemsClient.tsx",
      "src/app/elections/systems/page.tsx",
    ],
    origins: ["civica_calculation"],
    disclosure: "adjacent_statement",
    evidence: [
      {
        file: "src/app/elections/systems/page.tsx",
        mustContain: "Civica groups the available records",
      },
    ],
    verification: "static",
  },
  {
    id: "governance-evidence.fh-combined-rating",
    summary:
      "Governance Evidence: the Freedom House row shows the sum of Freedom House's two ratings (2 to 14) as a combined rating; Freedom House publishes the two ratings and their average, not this sum.",
    routes: [CIVICA_DATA, "/governance-evidence", "/compare"],
    files: [
      "src/components/governance-evidence/GovernanceEvidenceTable.tsx",
      "src/lib/ci/governance-evidence.ts",
    ],
    origins: ["civica_calculation"],
    disclosure: "none",
    evidence: [],
    verification: "static",
    exception: {
      followUp: "F1",
      approvedBy: "CLM-020",
      reason:
        "The Governance Evidence files are bound by hash to the governance-evidence review packet; the marker lands with the packet's next version.",
    },
  },
  {
    id: "legislature.seat-shares",
    summary:
      "Legislature and chamber composition: seat shares, the top-two share, and the majority line are Civica arithmetic on publisher seat counts.",
    routes: [CIVICA_DATA, "/compare"],
    files: [
      "src/components/factbook/FactbookLegislature.tsx",
      "src/components/factbook/FactbookLegislatureChart.tsx",
      "src/components/compare/CompareChambers.tsx",
    ],
    origins: ["civica_calculation", "publisher_published"],
    disclosure: "none",
    evidence: [],
    verification: "static",
    exception: {
      followUp: "F2",
      approvedBy: "CLM-020",
      reason:
        "Another workstream owns the legislature components (seat colours); the marker waits for that work.",
    },
  },
  {
    id: "parties.seat-share-and-ideology",
    summary:
      "Party browser: seat share is Civica arithmetic on seat counts, and ideology labels are Civica buckets of V-Party positions.",
    routes: ["/parties"],
    files: ["src/components/parties/PartyExplorer.tsx", "src/lib/parties/ideology-labels.ts"],
    origins: ["civica_calculation", "publisher_published"],
    disclosure: "none",
    evidence: [],
    verification: "static",
    exception: {
      followUp: "F3",
      approvedBy: "CLM-020",
      reason: "Needs a party-browser design decision; recorded as follow-up F3.",
    },
  },
  {
    id: "api.metrics-strip-data",
    summary:
      "GET /api/metrics/:metricId/strip-data: Civica group aggregates and peer cohorts beside the metric's source name.",
    routes: ["/api/metrics/[metricId]/strip-data"],
    files: ["src/app/api/metrics/[metricId]/strip-data/route.ts", "src/lib/db/queries.ts"],
    origins: ["civica_calculation", "publisher_published"],
    disclosure: "none",
    evidence: [],
    verification: "static",
    exception: {
      followUp: "F4",
      approvedBy: "CLM-020",
      reason:
        "The only reader-facing consumer is unmounted; the API needs an origin field or retirement (follow-up F4).",
    },
  },
];

export const PROVENANCE_RENDERERS: readonly ProvenanceRenderer[] = [
  { file: "src/app/(admin)/admin/pulse-review/[id]/page.tsx", class: "admin_only", note: "Admin review of Pulse source chips." },
  { file: "src/app/(admin)/admin/pulse-review/page.tsx", class: "admin_only", note: "Admin queue source chips." },
  {
    file: "src/app/(reader)/country/[slug]/civica-data/page.tsx",
    class: "civica_clock_unlabeled",
    note: "Section Sources strips pair each source with Civica's last sync date, shown without a clock label.",
    followUp: "F8",
  },
  {
    file: "src/app/(reader)/governance-change/page.tsx",
    class: "surface",
    surfaceIds: ["governance-change.native-change"],
    note: "Publisher-native difference between two years.",
  },
  { file: "src/app/about/page.tsx", class: "records_only", note: "Source list with names and retrieval dots." },
  { file: "src/app/design-system/page.tsx", class: "design_system_demo", note: "Primitive demonstrations." },
  {
    file: "src/app/elections/ElectionsClient.tsx",
    class: "surface",
    surfaceIds: ["elections.projected-dates"],
    note: "Election dates, turnout, and results; projected years carry the Est. label.",
  },
  {
    file: "src/app/elections/systems/ElectoralSystemsClient.tsx",
    class: "surface",
    surfaceIds: ["electoral-systems.counts"],
    note: "Country counts per electoral system beside the IPU dot.",
  },
  {
    file: "src/app/rankings/RankingsMatrix.tsx",
    class: "publisher_values",
    note: "Publisher values rounded for display; readers sort the columns and no rank number is printed.",
  },
  {
    file: "src/components/FactbookSection.tsx",
    class: "publisher_values",
    note: "CIA Factbook values and resolver-selected publisher facts.",
  },
  {
    file: "src/components/atlas/AtlasWorldMap.tsx",
    class: "publisher_values",
    note: "Choropleth classes on the publisher's native scale; legend labels are bins, not country figures.",
  },
  { file: "src/components/atlas/OrgDetailPanel.tsx", class: "records_only", note: "Organization roster records." },
  {
    file: "src/components/ci/CountryTrendSection.tsx",
    class: "surface",
    surfaceIds: ["indicator-history.display-index"],
    note: "Indicator history chart and native-value table.",
  },
  {
    file: "src/components/compare/CompareChambers.tsx",
    class: "surface",
    surfaceIds: ["legislature.seat-shares"],
    note: "Chamber composition provenance for the compared hemicycles.",
  },
  {
    file: "src/components/compare/CompareElections.tsx",
    class: "surface",
    surfaceIds: ["elections.projected-dates"],
    note: "Compared election dates, turnout, and results.",
  },
  {
    file: "src/components/compare/CompareIndicatorHistory.tsx",
    class: "surface",
    surfaceIds: ["compare.indicator-history"],
    note: "Compared indicator history.",
  },
  {
    file: "src/components/compare/CompareOverview.tsx",
    class: "publisher_values",
    note: "FactValueDot beside resolver-selected publisher facts.",
  },
  {
    file: "src/components/constitution/ConstitutionCrossReferencePane.tsx",
    class: "records_only",
    note: "Constitution text excerpts.",
  },
  {
    file: "src/components/constitution/ConstitutionPassageCard.tsx",
    class: "records_only",
    note: "Constitution search passages.",
  },
  {
    file: "src/components/constitution/ConstitutionReadingColumn.tsx",
    class: "records_only",
    note: "Constitution text and its year.",
  },
  { file: "src/components/country/CivicaIndexPanel.tsx", class: "not_rendered", note: "Retired Index panel." },
  {
    file: "src/components/factbook/FactbookAdditionalIndicators.tsx",
    class: "publisher_values",
    note: "Resolver-selected publisher facts.",
  },
  { file: "src/components/factbook/FactbookBills.tsx", class: "records_only", note: "Bill records." },
  {
    file: "src/components/factbook/FactbookGovOrgChart.tsx",
    class: "records_only",
    note: "Offices and officeholders.",
  },
  {
    file: "src/components/factbook/FactbookHeaderStrip.tsx",
    class: "publisher_values",
    note: "Masthead facts from their named publishers.",
  },
  {
    file: "src/components/factbook/FactbookLeaders.tsx",
    class: "records_only",
    note: "Leader records; tenure is calendar arithmetic on publisher dates.",
  },
  {
    file: "src/components/factbook/FactbookLegislature.tsx",
    class: "surface",
    surfaceIds: ["legislature.seat-shares"],
    note: "Legislature key facts and composition.",
  },
  { file: "src/components/factbook/FactbookOrganizations.tsx", class: "records_only", note: "Membership records." },
  {
    file: "src/components/factbook/FactbookOutcomesGraph.tsx",
    class: "not_rendered",
    note: "Unmounted peer-position graph.",
  },
  {
    file: "src/components/factbook/FactbookRightRail.tsx",
    class: "civica_clock_unlabeled",
    note: "Factbook source list pairs each source with Civica's last sync date without a clock label.",
    followUp: "F8",
  },
  {
    file: "src/components/governance-evidence/GovernanceEvidenceTable.tsx",
    class: "surface",
    surfaceIds: ["governance-evidence.fh-combined-rating"],
    note: "Publisher observations on native scales; the Freedom House row is a registered exception.",
  },
  {
    file: "src/components/leaders/WorldLeadersDirectoryClient.tsx",
    class: "records_only",
    note: "Leader directory records.",
  },
  {
    file: "src/components/parties/PartyExplorer.tsx",
    class: "surface",
    surfaceIds: ["parties.seat-share-and-ideology"],
    note: "Party browser source line.",
  },
  {
    file: "src/components/peer-grouping/PeerLensPanel.tsx",
    class: "not_rendered",
    note: "Unmounted panel; it prints a Civica rank and must be registered before any mount.",
  },
  {
    file: "src/components/pulse/PulseEventDetailCard.tsx",
    class: "records_only",
    note: "News source chips on an experimental Pulse event.",
  },
  {
    file: "src/components/research/ResearchVisualizationDisclosure.tsx",
    class: "disclosure_primitive",
    note: "Shared source-and-vintage disclosure for a research visual.",
  },
  {
    file: "src/components/scores/ScoresAndRankings.tsx",
    class: "surface",
    surfaceIds: ["country-scores.vdem", "country-scores.freedom-house-status"],
    note: "Country Rankings table.",
  },
];

const INDEX_MACHINERY =
  "Index or Pulse computation and release machinery under Index change control; renders nothing.";

export const DERIVED_FIELD_READERS: readonly DerivedFieldReader[] = [
  {
    file: "src/lib/db/queries-scores.ts",
    class: "score_contract",
    allowedSnippets: ["normalizedScore: ciDimensionScores.normalizedScore,"],
    note: "The release-row projection needs the normalized column for the release identity type; nothing else in the file may read it, and the pure contract in src/lib/ci/publisher-scores.ts reads none.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/conditions/CivicaConditionsPanel.tsx",
    class: "surface",
    surfaceIds: ["conditions.position.country"],
    allowedTokens: ["normalizedScore"],
    note: "Renders Civica positions with the ValueOriginNote marker.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/conditions/ConditionsReleaseExplorer.tsx",
    class: "surface",
    surfaceIds: ["conditions.position.explorer"],
    allowedTokens: ["normalizedScore"],
    note: "Renders Civica positions under the Civica-calculation column header.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/conditions/public-release.ts",
    class: "surface",
    surfaceIds: ["api.conditions"],
    allowedTokens: ["normalizedScore"],
    note: "Builds the public Conditions model and attaches scoreOrigin to every scored position.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/api/contract/schemas.ts",
    class: "api_contract",
    allowedTokens: ["normalizedScore", "totalRanked"],
    note: "normalizedScore: Conditions positions (scoreOrigin-marked). totalRanked: the retired Index API response schemas.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/api/contract/examples.ts",
    class: "api_contract",
    allowedTokens: ["normalizedScore", "totalRanked"],
    note: "Examples for the same schemas.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/api/contract/shapes.ts",
    class: "api_contract",
    allowedTokens: ["totalRanked"],
    note: "Retired Index API response shaping.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/api/contract/registry.ts",
    class: "api_contract",
    allowedTokens: ["normalizedScore"],
    note: "The Conditions endpoint summary names the field and its origin.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/app/api/v1/index/[country_slug]/route.ts",
    class: "retired_index_api",
    allowedTokens: ["ciCompositeScores", "normalizedScore", "normalized_score", "totalRanked"],
    note: "Returns 410 after the composite sunset.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/app/api/v1/index/compare/route.ts",
    class: "retired_index_api",
    allowedTokens: ["normalizedScore", "normalized_score", "totalRanked"],
    note: "Returns 410 after the composite sunset.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/app/api/v1/index/rankings/route.ts",
    class: "retired_index_api",
    allowedTokens: ["ciCompositeScores", "totalRanked"],
    note: "Returns 410 after the composite sunset.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/ci/CIPulseScoreDisplay.tsx",
    class: "not_rendered",
    allowedTokens: ["totalRanked"],
    note: "Retired Index display.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/compare/CompareCivicaIndex.tsx",
    class: "not_rendered",
    allowedTokens: ["normalizedScore", "normalized_score"],
    note: "Retired Index comparison.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/country/CivicaIndexPanel.tsx",
    class: "not_rendered",
    allowedTokens: ["normalizedScore", "totalRanked"],
    note: "Retired Index panel.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/factbook/FactbookOutcomesGraph.tsx",
    class: "not_rendered",
    allowedTokens: ["totalRanked"],
    note: "Unmounted outcomes graph.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/outcomes/CountryOutcomeBars.tsx",
    class: "not_rendered",
    allowedTokens: ["country_metrics", "totalRanked"],
    note: "Unmounted outcomes bars.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/outcomes/MetricStripPlot.tsx",
    class: "not_rendered",
    allowedTokens: ["totalRanked"],
    note: "Unmounted strip plot.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/outcomes/OutcomesExplorer.tsx",
    class: "not_rendered",
    allowedTokens: ["totalRanked"],
    note: "Unmounted outcomes explorer.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/outcomes/outcomesReducer.ts",
    class: "imported_only_by_not_rendered",
    allowedTokens: ["totalRanked"],
    note: "State reducer used only by the unmounted outcomes bars.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/db/queries.ts",
    class: "query_module",
    allowedTokens: [
      "ciCompositeScores",
      "ci_composite_scores",
      "country_metrics",
      "normalizedScore",
      "normalized_score",
      "totalRanked",
      "total_ranked",
    ],
    note: "Multi-purpose query module: retired Index readers, the strip-data exception (F4), and the scoreOrigin-marked Conditions release.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/db/queries-peer-grouping.ts",
    class: "query_module",
    allowedTokens: ["ci_composite_scores"],
    note: "Counts jurisdictions with a release composite per peer lens (a count of Civica's own records); returns no score.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/peer-grouping/material-metric-cohort.ts",
    class: "query_module",
    allowedTokens: ["country_metrics"],
    note: "Peer cohort for the strip-data API exception (F4).",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/citations/resolvers/indicator.ts",
    class: "query_module",
    allowedTokens: ["countryMetrics", "country_metrics"],
    note: "Citation resolver for stored indicator rows; the stored rank's origin is follow-up F5.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/content/site-stats.ts",
    class: "query_module",
    allowedTokens: ["ci_composite_scores"],
    note: "Counts release rows for site statistics; returns no score.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/atlas/change-history.ts",
    class: "query_module",
    allowedTokens: ["country_metrics", "total_ranked"],
    note: "Change-history field list for stored indicator rows, including the stored rank (follow-up F5).",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/db/schema.ts",
    class: "computation_or_storage",
    allowedTokens: [
      "ciCompositeScores",
      "ci_composite_scores",
      "countryMetrics",
      "country_metrics",
      "normalizedScore",
      "normalized_score",
      "totalRanked",
      "total_ranked",
    ],
    note: "Table definitions.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/metrics/ingest.ts",
    class: "computation_or_storage",
    allowedTokens: ["country_metrics", "totalRanked", "total_ranked"],
    note: "Legacy country-metric writer; its stored ranks are follow-up F5.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/data/frozen-vintage.ts",
    class: "computation_or_storage",
    allowedTokens: ["totalRanked"],
    note: "Vintage row hashing.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/data/raw-snapshot-manifest.ts",
    class: "computation_or_storage",
    allowedTokens: ["ci_composite_scores"],
    note: "Snapshot manifest table list.",
    approvedBy: "CLM-020",
  },
  ...[
    "src/lib/ci/atomic-ingestion.ts",
    "src/lib/ci/calculate-v2.ts",
    "src/lib/ci/calculate.ts",
    "src/lib/ci/ingest.ts",
    "src/lib/ci/release-publication.ts",
    "src/lib/ci/release-selection.ts",
    "src/lib/ci/reproduce-current-release.ts",
    "src/lib/pulse/v2/decouple.ts",
  ].map(
    (file): DerivedFieldReader => ({
      file,
      class: "computation_or_storage",
      allowedTokens: [
        "ciCompositeScores",
        "ci_composite_scores",
        "normalizedScore",
        "normalized_score",
        "totalRanked",
      ],
      note: INDEX_MACHINERY,
      approvedBy: "CLM-020",
    }),
  ),
  ...[
    "src/lib/conditions/contract.ts",
    "src/lib/conditions/economic.ts",
    "src/lib/conditions/ingest.ts",
    "src/lib/conditions/production-workflow.ts",
    "src/lib/conditions/release-live-validation.ts",
  ].map(
    (file): DerivedFieldReader => ({
      file,
      class: "computation_or_storage",
      allowedTokens: ["normalizedScore", "normalized_score"],
      note: "Conditions release computation and validation; renders nothing.",
      approvedBy: "CLM-020",
    }),
  ),
  {
    file: "src/lib/ci/quarantine-contract.ts",
    class: "governance_tooling",
    allowedTokens: ["ciCompositeScores"],
    note: "Checks that public surfaces do not read the composite.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/claims/country-grade-language.ts",
    class: "governance_tooling",
    allowedTokens: ["ciCompositeScores", "ci_composite_scores"],
    note: "Patterns that forbid grade language and band reads.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/atlas/surface-data-matrix.ts",
    class: "governance_tooling",
    allowedTokens: ["country_metrics"],
    note: "Surface inventory names storage tables.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/data-dictionary/build.ts",
    class: "governance_tooling",
    allowedTokens: ["country_metrics"],
    note: "Schema dictionary.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/data-dictionary/registry.ts",
    class: "governance_tooling",
    allowedTokens: ["ci_composite_scores", "country_metrics"],
    note: "Schema dictionary semantics.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/research/evidence-retention.ts",
    class: "governance_tooling",
    allowedTokens: ["ci_composite_scores", "country_metrics"],
    note: "Retention registry table list.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/provenance/publisher-attribution-registry.ts",
    class: "attribution_tooling",
    allowedTokens: [...DERIVED_FIELD_TOKENS],
    note: "This registry names the tokens it governs.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/provenance/publisher-attribution-selfproof.ts",
    class: "attribution_tooling",
    allowedTokens: ["normalizedScore"],
    note: "Seeded mutations reintroduce a Civica-position read to prove the scan fails.",
    approvedBy: "CLM-020",
  },
];

export const SCALE_SUFFIX_ALLOWANCES: readonly ScaleSuffixAllowance[] = [
  {
    file: "src/app/design-system/page.tsx",
    class: "design_system_demo",
    note: "The ValueOriginNote demo prints a Civica position on its 0 to 100 scale beside the Civica-calculation marker.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/ci/CIPulseScoreDisplay.tsx",
    class: "not_rendered",
    note: "Retired Index display; its 0 to 100 score label is not mounted.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/conditions/CivicaConditionsPanel.tsx",
    class: "civica_calculation_surface",
    surfaceIds: ["conditions.position.country"],
    note: "Country Conditions cards print Civica's 0 to 100 position with the Civica-calculation marker.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/components/conditions/ConditionsReleaseExplorer.tsx",
    class: "civica_calculation_surface",
    surfaceIds: ["conditions.position.explorer"],
    note: "The Conditions explorer prints Civica's 0 to 100 position under the Civica-calculation column header.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/brand/decision-criteria.ts",
    class: "tooling",
    note: "Writes Civica's own brand-decision rubric, including a minimum weighted score on a 0 to 100 scale, into a plan document. It names no publisher; only its validator script and test import it.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/provenance/publisher-attribution-check.ts",
    class: "tooling",
    note: "Rebuilds the former Freedom House row so the checks can prove they reject it.",
    approvedBy: "CLM-020",
  },
  {
    file: "src/lib/provenance/publisher-attribution-selfproof.ts",
    class: "tooling",
    note: "Seeded mutations print scale suffixes to prove the scan fails.",
    approvedBy: "CLM-020",
  },
];

export const LIVE_CHECK_EXCEPTIONS: readonly LiveCheckException[] = [
  {
    id: "conditions.hdi-reference-year",
    check: "conditions.hdi-year-duplicates-prior-year",
    scope: { releaseId: "conditions-production-20260729-v1", componentId: "hdi" },
    followUp: "CLM-021",
    approvedBy: "CLM-021",
    reason:
      "Human Development values labelled reference year 2023 repeat the retained 2022 values of the same UNDP series (the Human Development Report 2023/24 figures for 2022).",
  },
];

/**
 * Fixed live sample for per-country contract checks. Freedom House status and
 * V-Dem value checks run over the whole release population; this sample adds
 * row presence and the WGI-fallback case (Monaco has no V-Dem row).
 */
export const PUBLISHER_ATTRIBUTION_LIVE_SAMPLE = [
  "uruguay",
  "japan",
  "united-states",
  "brazil",
  "colombia",
  "south-africa",
  "hungary",
  "india",
  "mexico",
  "tunisia",
  "nigeria",
  "niger",
  "turkey",
  "china",
  "north-korea",
  "monaco",
] as const;

export const PUBLISHER_ATTRIBUTION_BASELINE_VERSION = "publisher-attribution-baseline/v2" as const;

export interface PublisherAttributionBaseline {
  schemaVersion: typeof PUBLISHER_ATTRIBUTION_BASELINE_VERSION;
  exceptions: string[];
  derivedFieldReaders: string[];
  scaleSuffixAllowances: string[];
}

/** The ratcheted lists; the scan compares each with the checked baseline. */
export const PUBLISHER_ATTRIBUTION_BASELINE_KEYS = [
  "exceptions",
  "derivedFieldReaders",
  "scaleSuffixAllowances",
] as const;

export function baselineFromRegistry(
  surfaces: readonly PublisherAttributionSurface[] = PUBLISHER_ATTRIBUTION_SURFACES,
  readers: readonly DerivedFieldReader[] = DERIVED_FIELD_READERS,
  liveExceptions: readonly LiveCheckException[] = LIVE_CHECK_EXCEPTIONS,
  scaleSuffixAllowances: readonly ScaleSuffixAllowance[] = SCALE_SUFFIX_ALLOWANCES,
): PublisherAttributionBaseline {
  return {
    schemaVersion: PUBLISHER_ATTRIBUTION_BASELINE_VERSION,
    exceptions: [
      ...surfaces.filter((surface) => surface.exception).map((surface) => surface.id),
      ...liveExceptions.map((exception) => exception.id),
    ].sort(),
    derivedFieldReaders: readers.map((reader) => reader.file).sort(),
    scaleSuffixAllowances: scaleSuffixAllowances.map((allowance) => allowance.file).sort(),
  };
}
