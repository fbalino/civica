import { createHash } from "node:crypto";

export const ATLAS_SURFACE_MATRIX_VERSION =
  "civica-atlas-surface-data-matrix/v1" as const;

export const ATLAS_SURFACE_STATE_KEYS = [
  "loading",
  "empty",
  "error",
  "partial",
  "stale",
  "disputed",
  "noSource",
] as const;

export type AtlasSurfaceStateKey = (typeof ATLAS_SURFACE_STATE_KEYS)[number];
export type AtlasReleaseRelation =
  | "included_reference_rows"
  | "mixed_row_level_rights"
  | "excluded_surface_only"
  | "excluded_restricted_source"
  | "excluded_experimental";

export interface AtlasDataAccess {
  symbol: string;
  file: string;
}

export interface AtlasSurfaceMatrixRow {
  id: string;
  kind: "route" | "country_module";
  route: string;
  renderer: string;
  dataAccess: AtlasDataAccess[];
  storage: string[];
  fields: string[];
  provenance: string[];
  coverage: string[];
  states: Record<AtlasSurfaceStateKey, string>;
  tests: string[];
  testGap: string | null;
  owner: string;
  releaseRelation: AtlasReleaseRelation;
  releaseReason: string;
}

const serverStates = (
  overrides: Partial<Record<AtlasSurfaceStateKey, string>> = {},
) => ({
  loading:
    "No route-level loading state; the server response waits for the query.",
  empty:
    "The renderer has an explicit empty or omission rule recorded for this row.",
  error:
    "The route catches the query or delegates to the nearest Next.js error boundary as recorded in source.",
  partial: "Independent modules may render when this row has no usable data.",
  stale:
    "Source freshness is shown from sources.last_sync_at or a named frozen vintage where implemented.",
  disputed:
    "Resolver-backed values expose dispute state; non-resolver datasets retain their own status only.",
  noSource:
    "The module omits provenance only where the current renderer lacks source metadata.",
  ...overrides,
});

function row(input: AtlasSurfaceMatrixRow): AtlasSurfaceMatrixRow {
  return input;
}

const topLevelRows: AtlasSurfaceMatrixRow[] = [
  row({
    id: "route.home",
    kind: "route",
    route: "/",
    renderer: "src/components/home/HomeGrid.tsx",
    dataAccess: [
      { symbol: "getAllReferenceJurisdictions", file: "src/lib/db/queries.ts" },
      {
        symbol: "getCanonicalFactsForJurisdictions",
        file: "src/lib/factbook/reconcile/api.ts",
      },
    ],
    storage: ["jurisdictions", "country_facts", "data_disputes"],
    fields: [
      "slug",
      "name",
      "iso2",
      "capital",
      "population",
      "government_type",
      "world_bank_income_group",
    ],
    provenance: [
      "Compact cards link to resolver-backed country pages; inline summaries expressly do not claim per-value provenance.",
    ],
    coverage: [
      "The closed 253-entry reference catalog drives search and the displayed count; Japan and Estonia are named featured-card selections.",
    ],
    states: serverStates({
      empty:
        "A catalog outage renders a named temporary-unavailable state; a healthy empty catalog still renders its distinct zero-result shell without a country-count claim.",
      error:
        "The home module preserves a catalog outage visibly instead of presenting it as a zero-country atlas.",
    }),
    tests: [
      "src/lib/ci/quarantine-contract.test.ts",
      "src/lib/claims/__tests__/provenance-coverage.test.ts",
      "src/lib/atlas/atl-018-country-reader.test.ts",
      "e2e/atl-018-data-states.spec.ts",
    ],
    testGap: null,
    owner: "Atlas reference product",
    releaseRelation: "mixed_row_level_rights",
    releaseReason:
      "Jurisdiction identity and permitted canonical facts enter the export; page composition and art do not.",
  }),
  row({
    id: "route.atlas",
    kind: "route",
    route: "/atlas",
    renderer: "src/app/(reader)/atlas/page.tsx",
    dataAccess: [
      { symbol: "loadAtlasData", file: "src/lib/atlas/load-atlas-data.ts" },
      {
        symbol: "loadAtlasLayerData",
        file: "src/lib/atlas/load-atlas-data.ts",
      },
    ],
    storage: [
      "jurisdictions",
      "country_facts",
      "country_factbook_sections",
      "government_bodies",
      "offices",
      "terms",
      "persons",
      "legislature_parties",
      "organizations",
      "organization_memberships",
      "elections",
      "sources",
    ],
    fields: [
      "jurisdiction identity",
      "government form",
      "population",
      "GDP",
      "capital",
      "map-layer values",
      "institution summaries",
      "jurisdiction status label and sources",
    ],
    provenance: [
      "Resolver-backed masthead facts carry source identity; map-layer definitions name source, unit, vintage, and availability; hover cards carry jurisdiction-status/v1 labels.",
    ],
    coverage: [
      "The map explicitly limits itself to map-eligible sovereign_state entries; the scope note links to the full reference catalog. Per-layer coverage comes from loadAtlasLayerData.",
    ],
    states: serverStates({
      empty:
        "An empty map-eligible catalog renders a named coverage state; a selected layer with no values remains visibly available as a layer-coverage result.",
      error: "Uncaught loader failures reach the route error boundary.",
    }),
    tests: [
      "src/lib/ci/quarantine-contract.test.ts",
      "src/lib/atlas/atl-018-country-reader.test.ts",
      "e2e/atl-018-data-states.spec.ts",
    ],
    testGap: null,
    owner: "Atlas reference product",
    releaseRelation: "mixed_row_level_rights",
    releaseReason:
      "Only jurisdiction and permitted frozen canonical-fact rows enter the export; map composition and restricted datasets do not.",
  }),
  row({
    id: "route.country-index",
    kind: "route",
    route: "/country",
    renderer: "src/app/(reader)/country/page.tsx",
    dataAccess: [
      { symbol: "getAllReferenceJurisdictions", file: "src/lib/db/queries.ts" },
      { symbol: "getAlmanacFilterFacts", file: "src/lib/db/queries.ts" },
    ],
    storage: ["jurisdictions", "country_facts"],
    fields: [
      "identity",
      "status",
      "capital",
      "continent",
      "world_bank_region",
      "world_bank_income_group",
      "vdem_regime_type",
    ],
    provenance: [
      "Filter facts use active canonical country_facts; every directory row carries the sourced jurisdiction-status presentation and routes to a citation-bearing profile.",
    ],
    coverage: [
      "All 253 closed-catalog identities are listed; catalogAvailable distinguishes an outage from zero rows.",
    ],
    states: serverStates({
      empty:
        "catalogAvailable=false preserves an outage state instead of claiming a zero-country atlas.",
    }),
    tests: [],
    testGap: "No dedicated country-index route contract test exists.",
    owner: "Atlas reference product",
    releaseRelation: "included_reference_rows",
    releaseReason:
      "Jurisdiction identity/status and permitted frozen filter facts are within the Atlas export scope.",
  }),
  row({
    id: "route.parties",
    kind: "route",
    route: "/parties",
    renderer: "src/app/parties/page.tsx",
    dataAccess: [
      { symbol: "getPartiesForBrowser", file: "src/lib/db/queries-parties.ts" },
      {
        symbol: "getPartyBrowserFacets",
        file: "src/lib/db/queries-parties.ts",
      },
      {
        symbol: "getPartySourceFreshness",
        file: "src/lib/db/queries-parties.ts",
      },
    ],
    storage: [
      "political_parties",
      "legislature_parties",
      "jurisdictions",
      "sources",
    ],
    fields: [
      "party identity",
      "jurisdiction",
      "ideology",
      "seats",
      "source",
      "freshness",
    ],
    provenance: [
      "Party records and page freshness retain Wikidata, IPU, and V-Party source identities.",
    ],
    coverage: [
      "Facet counts and source freshness are computed from returned party rows.",
    ],
    states: serverStates({
      empty:
        "A fulfilled empty party catalog renders a named coverage state rather than implying that no parties or legislatures exist.",
      error:
        "A rejected party/facet query renders a named temporarily-unavailable state rather than the empty catalog state.",
    }),
    tests: [
      "src/lib/atlas/atl-018-country-reader.test.ts",
      "e2e/atl-018-data-states.spec.ts",
    ],
    testGap: null,
    owner: "Atlas institutions",
    releaseRelation: "excluded_surface_only",
    releaseReason:
      "DAT-017 currently exports jurisdictions and canonical facts, not party or seat tables.",
  }),
  row({
    id: "route.compare",
    kind: "route",
    route: "/compare",
    renderer: "src/app/compare/page.tsx",
    dataAccess: [
      { symbol: "getAllReferenceJurisdictions", file: "src/lib/db/queries.ts" },
      { symbol: "getJurisdictionsBySlugs", file: "src/lib/db/queries.ts" },
      {
        symbol: "getCanonicalFactsForJurisdictions",
        file: "src/lib/factbook/reconcile/api.ts",
      },
      { symbol: "getGovernmentStructure", file: "src/lib/db/queries.ts" },
      { symbol: "getLegislatureComposition", file: "src/lib/db/queries.ts" },
      { symbol: "getElectionsByJurisdiction", file: "src/lib/db/queries.ts" },
      {
        symbol: "getInternationalMembershipsBySlugs",
        file: "src/lib/db/queries.ts",
      },
      {
        symbol: "getGovernanceEvidence",
        file: "src/lib/db/queries-governance-evidence.ts",
      },
      {
        symbol: "getIndicatorHistoryForCountry",
        file: "src/lib/db/queries.ts",
      },
    ],
    storage: [
      "jurisdictions",
      "country_facts",
      "data_disputes",
      "government_bodies",
      "offices",
      "terms",
      "legislature_parties",
      "elections",
      "organizations",
      "organization_memberships",
      "ci_research_panel_rows",
      "indicator_history",
      "dataset_releases",
      "dataset_artifacts",
      "transformation_registry",
      "sources",
    ],
    fields: [
      "canonical profile facts",
      "government structure",
      "chambers",
      "elections",
      "memberships",
      "source-native governance observations",
      "source-native longitudinal observations and release lineage",
      "jurisdiction status label, note, review date, and sources",
    ],
    provenance: [
      "Resolver output supports per-fact source panels; governance evidence and longitudinal history remain on publisher-native scales with source, unit, release, and transformation lineage; selected identities expose sourced status notes.",
    ],
    coverage: [
      "Two to four selections from the full 253-entry reference catalog; each comparison section has an independent availability gate.",
    ],
    states: serverStates({
      empty:
        "No selection and an invalid requested selection render named next steps; governance, indicator, Conditions, chamber, election, and membership coverage remain visible by section.",
      error:
        "A country-catalog outage is named at the selector; independent section-query failures retain their sections and appear in a named temporarily-unavailable register.",
      partial:
        "Available comparison sections keep rendering when another independent query fails; the register identifies the unavailable section instead of substituting an empty result.",
    }),
    tests: [
      "src/lib/ci/quarantine-contract.test.ts",
      "src/lib/atlas/atl-018-country-reader.test.ts",
      "e2e/atl-018-data-states.spec.ts",
    ],
    testGap: null,
    owner: "Atlas comparison",
    releaseRelation: "mixed_row_level_rights",
    releaseReason:
      "Permitted canonical facts enter the export; institutions, restricted sources, and governance research rows do not.",
  }),
  row({
    id: "route.elections",
    kind: "route",
    route: "/elections",
    renderer: "src/app/elections/page.tsx",
    dataAccess: [
      { symbol: "getUpcomingElections", file: "src/lib/db/queries.ts" },
      {
        symbol: "getRecentElectionsWithResults",
        file: "src/lib/db/queries.ts",
      },
      {
        symbol: "ELECTION_CORPUS_AUDIT",
        file: "src/lib/elections/corpus-audit-runtime.ts",
      },
      {
        symbol: "loadLiveElectionContentFingerprints",
        file: "src/lib/elections/corpus-audit-live.ts",
      },
    ],
    storage: [
      "elections",
      "election_results",
      "statements",
      "jurisdictions",
      "sources",
    ],
    fields: [
      "normalized event type",
      "date basis/precision/role",
      "temporal class and source status",
      "conceptual event and chamber-contest identity",
      "qualification disposition and issue codes",
      "field-level turnout/result eligibility",
      "statement source/license/retrieval",
      "publisher-to-Civica jurisdiction identity evidence",
      "live row-content fingerprint",
      "jurisdiction status scope",
    ],
    provenance: [
      "The checked 915-row audit resolves event, turnout, and result evidence from statements; elections rows do not carry source_id/source_url directly.",
      "Wikidata P17 and IPU election/chamber country codes independently bind publisher jurisdiction identity; live rows must still match their checked content fingerprint.",
      "Wikidata rights are verified; IPU and IDEA remain pending non-commercial source reviews and are excluded from the public bulk export.",
    ],
    coverage: [
      "The page counts qualified conceptual events, chamber contests, source-dated future records, projections, quarantine, and sovereign/limited-recognition scope separately.",
    ],
    states: serverStates({
      empty:
        "No qualified results or filter matches render explicit audited empty states; quarantined rows never masquerade as no election.",
      partial:
        "Source-dated future rows, term projections, turnout, results, and rights review each retain independent availability.",
      disputed:
        "Kosovo and Taiwan retain the sourced limited-recognition status from jurisdiction-status/v1 and remain outside sovereign totals.",
      noSource:
        "Rows without authoritative event provenance are retained in the audit and quarantined from public election queries.",
    }),
    tests: [
      "src/lib/elections/corpus-audit.test.ts",
      "src/lib/elections/corpus-audit-runtime.test.ts",
      "scripts/validate-election-jurisdiction-identity.ts",
      "src/lib/elections/__tests__/writer-repeatability.test.ts",
      "scripts/validate-election-corpus-audit.ts",
    ],
    testGap: null,
    owner: "Atlas elections",
    releaseRelation: "excluded_surface_only",
    releaseReason: "The current frozen export excludes election rows.",
  }),
  row({
    id: "route.conditions",
    kind: "route",
    route: "/civica-conditions",
    renderer: "src/app/civica-conditions/page.tsx",
    dataAccess: [
      {
        symbol: "getAllMetricDefinitionsWithCoverage",
        file: "src/lib/db/queries.ts",
      },
    ],
    storage: ["metric_definitions", "country_metrics", "sources"],
    fields: [
      "metric identity",
      "native unit",
      "coverage",
      "year",
      "value",
      "rank",
      "source",
    ],
    provenance: ["Metric definitions retain source and dataset-year metadata."],
    coverage: ["Coverage is computed per available metric/year."],
    states: serverStates({
      empty: "No definitions render an unavailable/empty explorer state.",
    }),
    tests: [],
    testGap: "No dedicated Conditions route test exists.",
    owner: "Conditions experiment",
    releaseRelation: "excluded_experimental",
    releaseReason:
      "Conditions inputs are secondary experimental outputs and are excluded from DAT-017.",
  }),
  row({
    id: "route.governance-evidence",
    kind: "route",
    route: "/governance-evidence",
    renderer: "src/app/governance-evidence/page.tsx",
    dataAccess: [
      {
        symbol: "getGovernanceEvidenceCountries",
        file: "src/lib/db/queries-governance-evidence.ts",
      },
      {
        symbol: "getGovernanceEvidence",
        file: "src/lib/db/queries-governance-evidence.ts",
      },
    ],
    storage: ["ci_research_panel_rows", "jurisdictions", "sources"],
    fields: [
      "publisher",
      "indicator",
      "native value/unit/range",
      "availability",
      "uncertainty",
      "vintage",
      "artifact hash",
      "last sync",
    ],
    provenance: [
      "Every observation retains publisher, source URL, native scale, vintage, artifact hash, rights, and freshness.",
    ],
    coverage: [
      "Sovereign-state directory plus selected-country rows for the frozen research panel year.",
    ],
    states: serverStates({
      empty:
        "The page distinguishes no selected country and a selected country with no released observations.",
    }),
    tests: [
      "src/lib/ci/governance-evidence.test.ts",
      "src/lib/research/atlas-review-packet.test.ts",
    ],
    testGap: null,
    owner: "Governance Evidence research",
    releaseRelation: "excluded_experimental",
    releaseReason:
      "The source-native dashboard is public, but its research-panel rows are outside the Atlas canonical-fact export.",
  }),
  row({
    id: "route.rankings",
    kind: "route",
    route: "/rankings",
    renderer: "src/app/rankings/page.tsx",
    dataAccess: [
      { symbol: "getRankingsMatrix", file: "src/lib/db/queries.ts" },
    ],
    storage: ["jurisdictions", "country_facts", "country_metrics", "sources"],
    fields: [
      "source-native values",
      "rank",
      "coverage count",
      "source",
      "as_of",
    ],
    provenance: [
      "Columns name their underlying source and use neutral source-native observations.",
    ],
    coverage: ["Sovereign-state rows with available values per named metric."],
    states: serverStates({
      empty:
        "A fulfilled empty matrix renders a named source-coverage state rather than implying that the underlying measures do not exist.",
      error:
        "A rejected matrix query renders a named temporarily-unavailable state rather than the empty matrix state.",
    }),
    tests: [
      "src/lib/ci/quarantine-contract.test.ts",
      "src/lib/atlas/atl-018-country-reader.test.ts",
      "e2e/atl-018-data-states.spec.ts",
    ],
    testGap: null,
    owner: "Atlas comparison",
    releaseRelation: "mixed_row_level_rights",
    releaseReason:
      "Only permitted canonical fact rows overlap the frozen export; ranking presentation and non-fact metrics do not.",
  }),
  row({
    id: "route.constitution-explorer",
    kind: "route",
    route: "/constitution",
    renderer: "src/app/constitution/page.tsx",
    dataAccess: [
      {
        symbol: "getIndexedConstitutionCountries",
        file: "src/lib/db/queries-constitution.ts",
      },
      {
        symbol: "getConstitutionWithArticles",
        file: "src/lib/db/queries-constitution.ts",
      },
      {
        symbol: "getTopicExcerpts",
        file: "src/lib/db/queries-constitution.ts",
      },
      { symbol: "getSource", file: "src/lib/db/queries.ts" },
    ],
    storage: [
      "constitutions",
      "constitution_topic_excerpts",
      "jurisdictions",
      "sources",
    ],
    fields: [
      "structured articles",
      "topic tags",
      "year",
      "amendment year",
      "Constitute id",
      "last fetched",
    ],
    provenance: [
      "Constitute Project attribution and last_sync_at are displayed with the reading surface.",
    ],
    coverage: [
      "Indexed-country catalog explicitly distinguishes catalog outage, unindexed selection, and document-load failure.",
    ],
    states: serverStates({
      empty:
        "Landing, catalog outage, no constitution, and document unavailable are separate rendered states.",
      error:
        "throwOnError preserves catalog outages; document reads soft-fail to the explicit unavailable state.",
    }),
    tests: ["src/lib/db/queries-constitution-outage.test.ts"],
    testGap: null,
    owner: "Atlas constitutions",
    releaseRelation: "excluded_restricted_source",
    releaseReason:
      "Constitution text and excerpts are excluded from bulk export under Constitute Project terms.",
  }),
  row({
    id: "route.organization-detail",
    kind: "route",
    route: "/organizations/[slug]",
    renderer: "src/app/(reader)/organizations/[slug]/page.tsx",
    dataAccess: [
      { symbol: "loadAtlasData", file: "src/lib/atlas/load-atlas-data.ts" },
      {
        symbol: "getMembersOfOrg",
        file: "src/lib/data/international-organizations.ts",
      },
    ],
    storage: ["organizations", "organization_memberships", "jurisdictions"],
    fields: [
      "organization identity/type",
      "founded year",
      "headquarters",
      "members",
      "join year",
      "role",
    ],
    provenance: [
      "Organization definitions and membership records use the project organization registry and Atlas jurisdiction spine.",
    ],
    coverage: [
      "Every organization in ORGANIZATIONS has a sitemap route; unmatched members use an explicit fallback catalog.",
    ],
    states: serverStates({
      empty:
        "Unknown organization returns 404; a known organization can render an empty member list.",
    }),
    tests: [],
    testGap: "No dedicated organization-detail contract test exists.",
    owner: "Atlas organizations",
    releaseRelation: "excluded_surface_only",
    releaseReason:
      "The current frozen export excludes organization and membership tables.",
  }),
  row({
    id: "route.reconciliation-disputes",
    kind: "route",
    route: "/country/methodology/reconciliation/disputes",
    renderer:
      "src/app/(reader)/country/methodology/reconciliation/disputes/page.tsx",
    dataAccess: [
      {
        symbol: "getPublicDisputeFeed",
        file: "src/lib/db/queries-data-disputes.ts",
      },
      {
        symbol: "getPublicDisputeFilterDistributions",
        file: "src/lib/db/queries-data-disputes.ts",
      },
    ],
    storage: [
      "data_disputes",
      "data_dispute_audit_log",
      "country_facts",
      "jurisdictions",
      "sources",
    ],
    fields: [
      "fact key",
      "public status",
      "candidate values",
      "sources",
      "decision history",
      "opened/resolved time",
    ],
    provenance: [
      "Public entries retain jurisdiction, fact, source, and redacted audit history.",
    ],
    coverage: ["Filter distributions and paginated public dispute feed."],
    states: serverStates({
      empty: "No matching disputes renders an explicit no-results state.",
    }),
    tests: [
      "src/lib/factbook/reconcile/__tests__/dispute-resolution.test.ts",
      "src/lib/factbook/reconcile/__tests__/auto-resolve-disputes.test.ts",
    ],
    testGap: null,
    owner: "Atlas reconciliation",
    releaseRelation: "excluded_surface_only",
    releaseReason:
      "The export records dispute-at-cut status on facts but does not export the operational dispute queue.",
  }),
  row({
    id: "route.provenance-coverage",
    kind: "route",
    route: "/methodology/provenance-coverage",
    renderer: "src/app/(reader)/methodology/provenance-coverage/page.tsx",
    dataAccess: [
      {
        symbol: "schemaVersion",
        file: "src/lib/provenance/fact-coverage.generated.json",
      },
    ],
    storage: ["generated fact/source/dispute coverage artifact"],
    fields: [
      "fact counts",
      "source-link counts",
      "multi-source counts",
      "disputes",
      "staleness",
      "coverage by fact key/country",
    ],
    provenance: [
      "The checked report records generation time, source tables, and its own semantic identity.",
    ],
    coverage: [
      "Dataset-wide canonical fact coverage; distinct from compact renderer coverage.",
    ],
    states: serverStates({
      empty:
        "A checked generated report is required; validator failure blocks build rather than rendering an invented live count.",
    }),
    tests: ["scripts/validate-fact-coverage-report.ts"],
    testGap: null,
    owner: "Atlas provenance",
    releaseRelation: "excluded_surface_only",
    releaseReason:
      "The coverage report is a release companion, not a normalized observation table.",
  }),
  row({
    id: "route.source-coverage",
    kind: "route",
    route: "/methodology/source-coverage",
    renderer: "src/app/(reader)/methodology/source-coverage/page.tsx",
    dataAccess: [
      {
        symbol: "schemaVersion",
        file: "src/lib/provenance/domain-coverage.generated.json",
      },
    ],
    storage: ["generated fourteen-domain operational coverage artifact"],
    fields: [
      "domain",
      "covered jurisdictions",
      "freshness",
      "source ids",
      "known gaps",
    ],
    provenance: [
      "The checked report binds source and freshness evidence for each operational domain.",
    ],
    coverage: [
      "Countries/entities, canonical facts, government bodies, offices, people, legislatures, parties, elections, constitutions, organizations, bills, indicators, images, and statement citations.",
    ],
    states: serverStates({
      empty:
        "A missing or invalid checked artifact fails validation rather than silently rendering no domains.",
    }),
    tests: ["scripts/validate-domain-coverage.ts"],
    testGap: null,
    owner: "Atlas provenance",
    releaseRelation: "excluded_surface_only",
    releaseReason:
      "The operational report accompanies the release but is not part of the normalized export tables.",
  }),
];

const factbookSections = [
  ["overview", "introduction"],
  ["geography", "geography"],
  ["people", "people_and_society"],
  ["government", "government"],
  ["economy", "economy"],
  ["energy", "energy"],
  ["communications", "communications"],
  ["transport", "transportation"],
  ["environment", "environment"],
  ["military", "military_and_security"],
  ["terrorism", "terrorism"],
  ["space", "space"],
  ["transnational", "transnational_issues"],
] as const;

const factbookRows: AtlasSurfaceMatrixRow[] = factbookSections.map(
  ([id, sourceKey]) =>
    row({
      id: `country.factbook.${id}`,
      kind: "country_module",
      route: "/country/[slug]",
      renderer: "src/components/FactbookSection.tsx",
      dataAccess: [
        { symbol: "getFactbookSections", file: "src/lib/db/queries.ts" },
        {
          symbol: "getCanonicalFactsForJurisdiction",
          file: "src/lib/factbook/reconcile/api.ts",
        },
      ],
      storage: [
        "country_factbook_sections.section_data",
        "country_facts",
        "data_disputes",
        "sources",
      ],
      fields: [
        `section_name=${sourceKey}`,
        "structured CIA prose/values",
        "resolver-backed canonical fact keys where mapped",
      ],
      provenance: [
        "CIA Factbook frozen retrieval 2026-01-23 plus resolver source panels for mapped canonical values.",
      ],
      coverage: [
        "Every documented Factbook module remains visible. jsonbToFields selects rendered rows, while missing or structurally empty source content renders a named coverage state.",
      ],
      states: serverStates({
        empty:
          "A missing, non-object, or structurally empty section remains visible as a named source-coverage state.",
        error:
          "The Factbook tab preserves a section-table outage as a named temporarily-unavailable state rather than an empty country reference.",
        noSource:
          "CIA attribution is fixed for the section; resolver-backed leaves expose alternates where mapped.",
      }),
      tests: [
        "src/lib/factbook/__tests__/read-selection.test.ts",
        "src/lib/factbook/reconcile/__tests__/resolver.test.ts",
        "src/lib/atlas/atl-018-country-reader.test.ts",
        "e2e/atl-018-data-states.spec.ts",
      ],
      testGap: null,
      owner: "Country Factbook",
      releaseRelation: "mixed_row_level_rights",
      releaseReason:
        "Permitted frozen canonical facts may enter the export; full Factbook section JSON/prose does not.",
    }),
);

const countryRows: AtlasSurfaceMatrixRow[] = [
  row({
    id: "country.shared.masthead",
    kind: "country_module",
    route: "/country/[slug]/*",
    renderer: "src/components/factbook/FactbookHeaderStrip.tsx",
    dataAccess: [
      { symbol: "getJurisdictionBySlug", file: "src/lib/db/queries.ts" },
      {
        symbol: "getCanonicalFactsForJurisdiction",
        file: "src/lib/factbook/reconcile/api.ts",
      },
    ],
    storage: [
      "jurisdictions",
      "country_facts",
      "data_disputes",
      "sources",
      "static engraving/gallery/bounds manifests",
    ],
    fields: [
      "identity/status",
      "government type",
      "population_total",
      "gdp_ppp_usd_billions",
      "map/gallery/art captions",
    ],
    provenance: [
      "Population/GDP resolver panels; government taxonomy; sourced jurisdiction-status/v1 note and links; Wikimedia captions/licenses; AI-assisted illustration captions.",
    ],
    coverage: [
      "Every valid jurisdiction route; gallery, bounds, engraving, and individual facts are independently optional.",
    ],
    states: serverStates({
      empty:
        "Unknown jurisdiction returns 404; missing facts/art fall back independently.",
      error:
        "The slug lookup currently collapses DB outage and unknown slug to 404.",
    }),
    tests: [
      "src/components/factbook/CountryMapTile.test.ts",
      "src/lib/illustrations/country-engraving-validation.test.ts",
      "src/lib/jurisdictions/status-presentation.test.ts",
      "src/lib/seo/__tests__/jurisdiction-jsonld.test.ts",
    ],
    testGap: null,
    owner: "Country shell",
    releaseRelation: "mixed_row_level_rights",
    releaseReason:
      "Jurisdiction identity and permitted canonical facts enter the export; images, maps, and galleries do not.",
  }),
  ...factbookRows,
  row({
    id: "country.factbook.sources-and-citation",
    kind: "country_module",
    route: "/country/[slug]",
    renderer: "src/components/factbook/FactbookRightRail.tsx",
    dataAccess: [
      {
        symbol: "getDistinctActiveSourcesForJurisdiction",
        file: "src/lib/factbook/reconcile/api.ts",
      },
      { symbol: "getAllSources", file: "src/lib/db/queries.ts" },
    ],
    storage: ["country_facts.source_id/status", "sources.name/last_sync_at"],
    fields: ["source id", "source name", "last sync", "citation vintage"],
    provenance: [
      "Distinct active source rows populate the right rail and CiteAccordion; CIA is added for prose even without a fact row.",
    ],
    coverage: [
      "All distinct active contributing source ids for the jurisdiction.",
    ],
    states: serverStates({
      empty:
        "Source lookup failure leaves dates/list sparse while the country content remains visible.",
    }),
    tests: ["src/lib/factbook/reconcile/__tests__/cite-sources.test.ts"],
    testGap: null,
    owner: "Country Factbook",
    releaseRelation: "excluded_surface_only",
    releaseReason:
      "The export embeds its own per-source rights records; the reader rail is presentation only.",
  }),
];

const civicaModules: Array<{
  id: string;
  renderer: string;
  access: AtlasDataAccess;
  storage: string[];
  fields: string[];
  source: string;
  relation: AtlasReleaseRelation;
  reason: string;
}> = [
  {
    id: "evidence-coverage",
    renderer: "src/components/provenance/CountryEvidenceCoverage.tsx",
    access: {
      symbol: "getCanonicalFactsForJurisdiction",
      file: "src/lib/factbook/reconcile/api.ts",
    },
    storage: [
      "country_facts",
      "data_disputes",
      "fact-coverage.generated.json",
      "reconciliation-audit.generated.json",
    ],
    fields: [
      "held and missing supported fact groups",
      "source linkage",
      "producing-family depth",
      "source freshness",
      "unresolved disputes",
      "current resolver agreement and selected differences",
    ],
    source:
      "DAT-005 checked coverage snapshot plus the current DAT-006/DAT-007 resolver output; the view publishes no combined score or country judgment.",
    relation: "excluded_surface_only",
    reason:
      "Evidence-audit metadata describes the reader surface and remains outside the frozen observation export.",
  },
  {
    id: "governance-evidence",
    renderer: "src/components/governance-evidence/GovernanceEvidenceTable.tsx",
    access: {
      symbol: "getGovernanceEvidence",
      file: "src/lib/db/queries-governance-evidence.ts",
    },
    storage: ["ci_research_panel_rows", "sources"],
    fields: [
      "native observation",
      "availability",
      "uncertainty",
      "vintage",
      "artifact hash",
    ],
    source: "Per-row publisher/source metadata and SourceDot.",
    relation: "excluded_experimental",
    reason:
      "Research-panel observations are outside the Atlas canonical-fact export.",
  },
  {
    id: "longitudinal",
    renderer: "src/components/ci/CountryTrendSection.tsx",
    access: {
      symbol: "getIndicatorHistoryForCountry",
      file: "src/lib/db/queries.ts",
    },
    storage: [
      "indicator_history",
      "dataset_releases",
      "dataset_artifacts",
      "transformation_registry",
      "sources",
    ],
    fields: [
      "native observation",
      "value state",
      "year",
      "unit and native scale",
      "source freshness",
      "captured release and artifact hash",
      "transformation and method version",
    ],
    source:
      "Each series exposes source, license, freshness, native unit/scale, captured release, artifact hash, transformation id, and method version.",
    relation: "mixed_row_level_rights",
    reason:
      "The country download includes only source rows permitted by the rights manifest and names withheld series without redistributing their observations.",
  },
  {
    id: "conditions",
    renderer: "src/components/conditions/CivicaConditionsPanel.tsx",
    access: {
      symbol: "getConditionsPublicRelease",
      file: "src/lib/db/queries.ts",
    },
    storage: [
      "civica_conditions_releases",
      "civica_conditions_calculations",
      "civica_conditions_scores",
      "civica_conditions_components",
      "sources",
    ],
    fields: [
      "release identifier",
      "component value state",
      "reference year",
      "source",
      "alignment status",
      "native unit",
    ],
    source:
      "Every calculation keeps the selected release, component source, reference year, alignment state, and value-state reason visible.",
    relation: "excluded_experimental",
    reason:
      "Conditions remains a secondary research surface and is excluded from the frozen Atlas canonical-fact export.",
  },
  {
    id: "government",
    renderer: "src/components/factbook/FactbookGovOrgChart.tsx",
    access: { symbol: "getGovernmentStructure", file: "src/lib/db/queries.ts" },
    storage: ["government_bodies", "offices", "terms", "persons"],
    fields: ["branches", "bodies", "offices", "current terms"],
    source: "Wikidata section source strip and last_sync_at.",
    relation: "excluded_surface_only",
    reason: "The current export excludes institution graph tables.",
  },
  {
    id: "legislature",
    renderer: "src/components/factbook/FactbookLegislature.tsx",
    access: {
      symbol: "getLegislatureForJurisdiction",
      file: "src/lib/factbook/legislature.ts",
    },
    storage: ["government_bodies", "legislature_parties", "elections"],
    fields: [
      "chambers",
      "seat totals",
      "parties",
      "coalition",
      "next election",
    ],
    source: "IPU Parline section source strip and last_sync_at.",
    relation: "excluded_restricted_source",
    reason: "IPU-derived rows are excluded from public bulk export.",
  },
  {
    id: "leaders",
    renderer: "src/components/factbook/FactbookLeaders.tsx",
    access: { symbol: "getLeaderTimeline", file: "src/lib/db/queries.ts" },
    storage: ["offices", "terms", "persons"],
    fields: ["office", "person", "term dates", "current status"],
    source: "Wikidata section source strip and last_sync_at.",
    relation: "excluded_surface_only",
    reason: "The current export excludes offices, people, and term tables.",
  },
  {
    id: "bills",
    renderer: "src/components/factbook/FactbookBills.tsx",
    access: {
      symbol: "getBillsForJurisdiction",
      file: "src/lib/db/queries.ts",
    },
    storage: ["bills", "sources"],
    fields: [
      "bill id/title",
      "status",
      "introduced date",
      "last action",
      "source",
    ],
    source: "Per-row legislative source id plus section freshness.",
    relation: "excluded_surface_only",
    reason: "The current export excludes bill rows.",
  },
  {
    id: "organizations",
    renderer: "src/components/factbook/FactbookOrganizations.tsx",
    access: {
      symbol: "getInternationalMembershipsBySlugs",
      file: "src/lib/db/queries.ts",
    },
    storage: ["organizations", "organization_memberships"],
    fields: ["organization", "type", "join date", "role"],
    source: "Wikidata section source strip and last_sync_at.",
    relation: "excluded_surface_only",
    reason: "The current export excludes organizations and memberships.",
  },
  {
    id: "rankings",
    renderer: "src/components/scores/ScoresAndRankings.tsx",
    access: {
      symbol: "getScoresForJurisdiction",
      file: "src/lib/db/queries-scores.ts",
    },
    storage: ["ci_dimension_scores", "country_metrics", "sources"],
    fields: [
      "V-Dem",
      "Freedom House",
      "RSF",
      "HDI",
      "CPI",
      "rank",
      "trend",
      "as_of",
    ],
    source:
      "Each row carries its named source id and the section source strip.",
    relation: "excluded_experimental",
    reason:
      "Index/Conditions and restricted metric rows are excluded from DAT-017.",
  },
];

countryRows.push(
  ...civicaModules.map((module) =>
    row({
      id: `country.civica-data.${module.id}`,
      kind: "country_module",
      route: "/country/[slug]/civica-data",
      renderer: module.renderer,
      dataAccess: [
        module.access,
        { symbol: "getAllSources", file: "src/lib/db/queries.ts" },
      ],
      storage: module.storage,
      fields: module.fields,
      provenance: [module.source],
      coverage: [
        module.id === "evidence-coverage"
          ? "The section is always present. The checked DAT-005 country row supplies coverage and missingness; an absent row and a resolver outage remain explicit states."
          : module.id === "longitudinal"
            ? "The section is always present and reports every available documented series; an empty result remains visible as an availability state."
            : "The documented section is always present. A fulfilled empty result and an unavailable query render distinct named states instead of removing the module.",
      ],
      states: serverStates({
        empty:
          module.id === "evidence-coverage"
            ? "A missing checked country row is named explicitly and never becomes zero coverage or a country-quality judgment."
            : module.id === "longitudinal"
              ? "A named no-observations state remains visible; missing years are never rendered as zero or no change."
              : "A fulfilled empty result remains visible as a source-coverage state; it is never removed from the reader navigation.",
        error:
          module.id === "evidence-coverage"
            ? "The checked snapshot remains visible while current resolver counts render an explicit unavailable state."
            : module.id === "longitudinal"
              ? "A named temporarily-unavailable state remains visible while the rest of the tab continues to render."
              : "A named temporarily-unavailable state remains visible while the rest of the tab continues to render.",
      }),
      tests: [
        "src/lib/atlas/atl-018-country-reader.test.ts",
        "e2e/atl-018-data-states.spec.ts",
        ...(module.id === "evidence-coverage"
          ? ["src/lib/provenance/country-evidence-coverage.test.ts"]
          : module.id === "governance-evidence"
            ? ["src/lib/ci/governance-evidence.test.ts"]
            : module.id === "longitudinal"
              ? ["src/lib/indicators/history-catalog.test.ts"]
              : []),
      ],
      testGap: null,
      owner: "Country Civica Data",
      releaseRelation: module.relation,
      releaseReason: module.reason,
    }),
  ),
  row({
    id: "country.constitution.reader",
    kind: "country_module",
    route: "/country/[slug]/constitution",
    renderer: "src/components/constitution/ConstitutionReadingColumn.tsx",
    dataAccess: [
      {
        symbol: "getConstitutionWithArticles",
        file: "src/lib/db/queries-constitution.ts",
      },
      { symbol: "getSource", file: "src/lib/db/queries.ts" },
    ],
    storage: ["constitutions.structured_articles", "jurisdictions", "sources"],
    fields: [
      "section id",
      "heading",
      "topics",
      "HTML",
      "enactment/amendment year",
      "last fetched",
    ],
    provenance: [
      "Constitute Project attribution, SourceDot, and source last_sync_at.",
    ],
    coverage: [
      "One indexed constitution per matching jurisdiction; an unindexed document and a database outage render separate named states.",
    ],
    states: serverStates({
      empty:
        "No indexed text renders a named country-specific empty state with Explorer and Factbook links.",
      error:
        "The query rethrows for this country reader, which renders a named temporarily-unavailable state rather than claiming the text is unindexed.",
    }),
    tests: [
      "src/lib/db/queries-constitution-outage.test.ts",
      "src/lib/atlas/atl-018-country-reader.test.ts",
      "e2e/atl-018-data-states.spec.ts",
    ],
    testGap: null,
    owner: "Country constitutions",
    releaseRelation: "excluded_restricted_source",
    releaseReason:
      "Constitute-derived full text is not redistributed in the Atlas export.",
  }),
);

export const ATLAS_SURFACE_DATA_MATRIX = Object.freeze({
  schemaVersion: ATLAS_SURFACE_MATRIX_VERSION,
  auditedAt: "2026-07-18",
  scope:
    "Public data-bearing Atlas routes and every module rendered by the unified country reader.",
  owner: "Civica Atlas",
  release: {
    id: "atlas-2026-07-11",
    schemaVersion: "civica-atlas-export/v3",
    rule: "Only frozen jurisdiction rows and permitted canonical fact observations enter the bulk export; route presence never grants redistribution rights.",
  },
  rows: [...topLevelRows, ...countryRows].sort((left, right) =>
    left.id.localeCompare(right.id),
  ),
});

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function atlasSurfaceMatrixHash(): string {
  return createHash("sha256")
    .update(canonical(ATLAS_SURFACE_DATA_MATRIX))
    .digest("hex");
}

export function renderAtlasSurfaceMatrix(): string {
  return `${JSON.stringify(
    { ...ATLAS_SURFACE_DATA_MATRIX, semanticSha256: atlasSurfaceMatrixHash() },
    null,
    2,
  )}\n`;
}
