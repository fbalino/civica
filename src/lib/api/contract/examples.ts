/**
 * CLM-012 — canonical, schema-validated example fixtures.
 *
 * Every value here is illustrative (api-docs/page.tsx renders the
 * "Illustrative Example Response" note above each one) — but every
 * SHAPE is real: each example is built through the same
 * `shape*` functions the live routes call (`contract/shapes.ts`), then
 * `.strict().parse()`d against its schema at module load. A field the
 * routes stop returning, or a new field they start returning without
 * updating this file, throws immediately here — in dev, in tests, and
 * in the `validate:api-docs` build gate — rather than silently drifting
 * from what api-docs shows.
 *
 * `renderExample(id)` is what `api-docs/page.tsx` calls; nothing in
 * that page hand-types a JSON string anymore (CLM-012 requirement).
 */

import { createPulseRuntimeMethodSnapshot } from "@/lib/pulse/v2/runtime-contract";
import pulseClusterCoverage from "@/lib/pulse/v2/cluster-coverage.generated.json";
import {
  STRUCTURAL_FAMILY_META,
  REGIME_TYPE_META,
} from "@/lib/government-taxonomy";
import {
  zCountriesListResponse,
  zCountryDetailResponse,
  zGovernmentTypesResponse,
  zIndexCountryResponse,
  zIndexHistoryResponse,
  zIndexByGovernmentTypeResponse,
  zIndexCompareResponse,
  zIndexMethodologyResponse,
  zIndexRankingsResponse,
  zConditionsReleaseResponse,
  zPeerGroupingsResponse,
  zPulseMethodologyResponse,
  zPulseClusterCoverageResponse,
  zPulseSourceCoverageResponse,
  zPulseDimensionsResponse,
  zPulseEventsResponse,
  zPulseChangelogResponse,
  zCountryExportJson,
  zElectionResearchExport,
  type GovernmentClassificationShape,
} from "./schemas";
import {
  shapeCountryListItem,
  shapeCountriesListMeta,
  shapeCountryDetail,
  shapeCountryDetailMeta,
  shapeGovernmentTypesItem,
  shapeGovernmentTypesMeta,
  shapeIndexCountryData,
  shapeIndexHistoryItem,
  shapeIndexByGovernmentTypeItem,
  shapeIndexCompareResult,
  shapeIndexMethodologyData,
  shapeIndexRankingsItem,
  shapeIndexRankingsMeta,
  shapeConditionsReleaseResponse,
  shapePeerGroupingsData,
  shapePulseDimensionsData,
  shapePulseEventsData,
  shapePulseChangelogRow,
} from "./shapes";
import { COUNTRY_EXPORT_CSV_HEADER } from "./csv";
import { CI_METHODOLOGY_META } from "@/lib/api/helpers";
import {
  CURRENT_CI_METHODOLOGY_VERSION,
  CURRENT_CI_RELEASE_ID,
} from "@/lib/ci/current-release";
import {
  publicCiReleaseIdentity,
  resolveCiRelease,
} from "@/lib/ci/release-selection";
import type { JurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";
import { publicCiPublicationComponents } from "@/lib/ci/publication-components";
import {
  pulseDeltaVersionEnvelope,
  pulseEventVersionEnvelope,
} from "@/lib/pulse/v2/versioning";

const currentCiRelease = resolveCiRelease(CURRENT_CI_RELEASE_ID);
const currentCiSeries = currentCiRelease.series;
const currentCiReleaseIdentity = publicCiReleaseIdentity(currentCiRelease);
const currentCiContextComponents = publicCiPublicationComponents(
  currentCiRelease,
  { jurisdiction: "live_current", taxonomy: "live_current" },
);

/* ────────────────────────────────────────────────────────────────
 * Shared fixture pieces
 * ──────────────────────────────────────────────────────────────── */

// Color fields are read from the same STRUCTURAL_FAMILY_META /
// REGIME_TYPE_META tables production uses (src/lib/government-taxonomy)
// rather than hand-typed hex — keeps these illustrative fixtures
// accurate and avoids reintroducing raw hex literals the design-token
// validator would otherwise flag as component-code drift.
const usaClassification: GovernmentClassificationShape = {
  taxonomyVersion: "2026_v1",
  rawLabel: "constitutional federal republic",
  regimeType: "presidential_democracy",
  regimeTypeLabel: REGIME_TYPE_META.presidential_democracy.label,
  regimeSource: "Bjornskov-Rode / CGV (QoG Standard)",
  regimeDatasetVersion: "QoG Standard Jan26",
  regimeYear: 2025,
  structuralFamily: "presidential_republic",
  structuralFamilyLabel: STRUCTURAL_FAMILY_META.presidential_republic.label,
  structuralSubtype: "federal_presidential_republic",
  structuralSubtypeLabel: "Federal presidential republic",
  structuralColorVar: STRUCTURAL_FAMILY_META.presidential_republic.colorVar,
  structuralColorFallback:
    STRUCTURAL_FAMILY_META.presidential_republic.fallback,
  regimeColorVar: REGIME_TYPE_META.presidential_democracy.colorVar,
  regimeColorFallback: REGIME_TYPE_META.presidential_democracy.fallback,
  primitives: {
    isFederal: true,
    isMonarchy: false,
    executiveStructure: "single_executive",
    governmentDependency: "fixed_term",
  },
  overrideNote: null,
  provenance: {},
};

const franceClassification: GovernmentClassificationShape = {
  taxonomyVersion: "2026_v1",
  rawLabel: "semi-presidential republic",
  regimeType: "semi_presidential_democracy",
  regimeTypeLabel: REGIME_TYPE_META.semi_presidential_democracy.label,
  regimeSource: "Bjornskov-Rode / CGV (QoG Standard)",
  regimeDatasetVersion: "QoG Standard Jan26",
  regimeYear: 2025,
  structuralFamily: "semi_presidential",
  structuralFamilyLabel: STRUCTURAL_FAMILY_META.semi_presidential.label,
  structuralSubtype: "semi_presidential_republic",
  structuralSubtypeLabel: "Semi-presidential republic",
  structuralColorVar: STRUCTURAL_FAMILY_META.semi_presidential.colorVar,
  structuralColorFallback: STRUCTURAL_FAMILY_META.semi_presidential.fallback,
  regimeColorVar: REGIME_TYPE_META.semi_presidential_democracy.colorVar,
  regimeColorFallback: REGIME_TYPE_META.semi_presidential_democracy.fallback,
  primitives: {
    isFederal: false,
    isMonarchy: false,
    executiveStructure: "dual_executive",
    governmentDependency: "mixed_dependency",
  },
  overrideNote: null,
  provenance: {},
};

const norwayClassification: GovernmentClassificationShape = {
  taxonomyVersion: "2026_v1",
  rawLabel: "parliamentary constitutional monarchy",
  regimeType: "parliamentary_democracy",
  regimeTypeLabel: REGIME_TYPE_META.parliamentary_democracy.label,
  regimeSource: "Bjornskov-Rode / CGV (QoG Standard)",
  regimeDatasetVersion: "QoG Standard Jan26",
  regimeYear: 2025,
  structuralFamily: "constitutional_monarchy",
  structuralFamilyLabel: STRUCTURAL_FAMILY_META.constitutional_monarchy.label,
  structuralSubtype: "parliamentary_constitutional_monarchy",
  structuralSubtypeLabel: "Parliamentary constitutional monarchy",
  structuralColorVar: STRUCTURAL_FAMILY_META.constitutional_monarchy.colorVar,
  structuralColorFallback:
    STRUCTURAL_FAMILY_META.constitutional_monarchy.fallback,
  regimeColorVar: REGIME_TYPE_META.parliamentary_democracy.colorVar,
  regimeColorFallback: REGIME_TYPE_META.parliamentary_democracy.fallback,
  primitives: {
    isFederal: false,
    isMonarchy: true,
    executiveStructure: "dual_executive",
    governmentDependency: "confidence_dependent",
  },
  overrideNote: null,
  provenance: {},
};

const exampleProvenanceEntry = {
  factKey: "population_total",
  source: "un_data",
  sourceName: "UN Statistics Division",
  asOf: "2024",
  vintageLabel: "UN World Population Prospects 2024 revision",
  decisionReason: "fresher_winner" as const,
  decisionTrace: [
    {
      code: "row_eligibility" as const,
      outcome: "eligible_rows_found",
      detail: "Two active rows remained eligible.",
      sourceIds: ["cia_factbook", "un_data"],
    },
    {
      code: "canonical_selection" as const,
      outcome: "selected",
      detail: "un_data was selected under source-precedence/v1.",
      sourceIds: ["un_data"],
    },
  ],
  isDisputed: false,
  alternates: [
    {
      source: "cia_factbook",
      sourceName: "CIA World Factbook",
      value: 68170228,
      asOf: "2024-07",
      vintageLabel: "CIA World Factbook, archived January 2026",
      url: null,
      valueType: "measured" as const,
      valueStatus: "observed" as const,
      valueStatusReason: null,
    },
  ],
  valueType: "measured" as const,
  canonicalIsProjection: false,
  valueStatus: "observed" as const,
};

/* ────────────────────────────────────────────────────────────────
 * /api/v1/countries
 * ──────────────────────────────────────────────────────────────── */

const exampleSovereignStatus: JurisdictionStatusPresentation = {
  version: "jurisdiction-status/v1" as const,
  type: "sovereign_state" as const,
  label: "UN member state",
  note: "Listed by Civica as a sovereign state because it is in the closed UN member-state inventory.",
  reviewedAt: "2026-07-10",
  administeringJurisdictionIso3: null,
  disputed: false,
  includeInSovereignStateCounts: true,
  sources: [
    {
      id: "un_member_states",
      label: "United Nations Member States",
      url: "https://www.un.org/en/about-us/member-states",
    },
    {
      id: "un_m49",
      label: "UN Statistics M49 countries or areas",
      url: "https://unstats.un.org/unsd/methodology/m49/",
    },
  ],
};

const countriesExampleResponse = zCountriesListResponse.strict().parse({
  data: [
    shapeCountryListItem({
      slug: "united-states",
      name: "United States",
      iso2: "US",
      iso3: "USA",
      continent: "North America",
      capital: "Washington, DC",
      population: 339996563,
      governmentType: "presidential republic",
      governmentTypeDetail: "constitutional federal republic",
      gdpBillions: 25460,
      areaSqKm: 9833520,
      flagUrl: "https://civicaatlas.org/flags/us.svg",
      governmentClassification: usaClassification,
      jurisdictionStatus: exampleSovereignStatus,
    }),
  ],
  meta: shapeCountriesListMeta({
    total: 253,
    limit: 50,
    offset: 0,
    hasMore: true,
    taxonomy: "raw",
    selection: {
      mode: "live",
      asOf: "live",
      vintage: null,
      cutoffAt: null,
      retrievedThrough: "2026-07-11T00:00:00.000Z",
      methodologyVersions: ["v0.2-beta"],
      candidateSetStatus: "live",
      candidateSetChecksum: null,
      winnerSetChecksum: null,
      resolverVersionHash: null,
    },
  }),
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/conditions
 * ──────────────────────────────────────────────────────────────── */

const conditionsExampleResponse = zConditionsReleaseResponse.strict().parse(
  shapeConditionsReleaseResponse({
    contract: "civica-conditions-public-release/v1",
    release: {
      releaseId: "conditions-atlas-v1",
      methodologyVersion: "conditions-components/v1",
      manifestSha256: "c".repeat(64),
      createdAt: "2026-07-18T00:00:00.000Z",
    },
    coverage: [
      {
        dimension: "human_development",
        calculations: 1,
        aligned: 1,
        scored: 1,
        mixedYearRefused: 0,
        missingComponent: 0,
        components: 1,
        observedComponents: 1,
        unavailableComponents: 0,
      },
      {
        dimension: "peace_security",
        calculations: 1,
        aligned: 1,
        scored: 1,
        mixedYearRefused: 0,
        missingComponent: 0,
        components: 1,
        observedComponents: 1,
        unavailableComponents: 0,
      },
      {
        dimension: "economic_stability",
        calculations: 1,
        aligned: 1,
        scored: 0,
        mixedYearRefused: 0,
        missingComponent: 0,
        components: 3,
        observedComponents: 3,
        unavailableComponents: 0,
      },
    ],
    calculations: [
      {
        releaseId: "conditions-atlas-v1",
        jurisdictionId: "illustrative-uruguay-id",
        countryName: "Uruguay",
        countrySlug: "uruguay",
        countryIso3: "URY",
        dimension: "human_development",
        calculationKey: `conditions-calculation/v1/sha256:${"1".repeat(64)}`,
        alignmentPolicy: "all-components-same-reference-year/v1",
        alignmentStatus: "aligned",
        referenceYear: 2024,
        normalizedScore: 83.4,
        rawValue: 0.83,
        scoreSourceId: "undp_hdi",
        scoreSourceName: "UNDP",
        scoreIndicatorId: "hdi",
        scoreUpstreamRelease: "HDR 2025",
        scoreLicenseUrl: "https://example.test/undp",
        components: [
          {
            componentId: "hdi",
            nativeValue: 0.83,
            nativeUnit: "index_0_1",
            referenceYear: 2024,
            valueStatus: "observed",
            valueStatusReason: null,
            inclusionDecision: "included",
            sourceId: "undp_hdi",
            sourceName: "UNDP",
            indicatorId: "hdi",
            upstreamRelease: "HDR 2025",
            licenseUrl: "https://example.test/undp",
            transformationId: "conditions-hdi-component/v2",
          },
        ],
      },
      {
        releaseId: "conditions-atlas-v1",
        jurisdictionId: "illustrative-uruguay-id",
        countryName: "Uruguay",
        countrySlug: "uruguay",
        countryIso3: "URY",
        dimension: "peace_security",
        calculationKey: `conditions-calculation/v1/sha256:${"2".repeat(64)}`,
        alignmentPolicy: "all-components-same-reference-year/v1",
        alignmentStatus: "aligned",
        referenceYear: 2024,
        normalizedScore: 75.6,
        rawValue: 1.4,
        scoreSourceId: "global_peace_index",
        scoreSourceName: "Institute for Economics & Peace",
        scoreIndicatorId: "gpi",
        scoreUpstreamRelease: "GPI 2025",
        scoreLicenseUrl: "https://example.test/gpi",
        components: [
          {
            componentId: "global_peace_index",
            nativeValue: 1.4,
            nativeUnit: "index",
            referenceYear: 2024,
            valueStatus: "observed",
            valueStatusReason: null,
            inclusionDecision: "included",
            sourceId: "global_peace_index",
            sourceName: "Institute for Economics & Peace",
            indicatorId: "gpi",
            upstreamRelease: "GPI 2025",
            licenseUrl: "https://example.test/gpi",
            transformationId: "conditions-gpi-component/v2",
          },
        ],
      },
      {
        releaseId: "conditions-atlas-v1",
        jurisdictionId: "illustrative-uruguay-id",
        countryName: "Uruguay",
        countrySlug: "uruguay",
        countryIso3: "URY",
        dimension: "economic_stability",
        calculationKey: `conditions-calculation/v1/sha256:${"3".repeat(64)}`,
        alignmentPolicy: "all-components-same-reference-year/v1",
        alignmentStatus: "aligned",
        referenceYear: 2024,
        normalizedScore: null,
        rawValue: null,
        scoreSourceId: null,
        scoreSourceName: null,
        scoreIndicatorId: null,
        scoreUpstreamRelease: null,
        scoreLicenseUrl: null,
        components: [
          {
            componentId: "inflation",
            nativeValue: 4.2,
            nativeUnit: "percent",
            referenceYear: 2024,
            valueStatus: "observed",
            valueStatusReason: null,
            inclusionDecision: "included",
            sourceId: "world_bank",
            sourceName: "World Bank",
            indicatorId: "FP.CPI.TOTL.ZG",
            upstreamRelease: "WDI 2025",
            licenseUrl: "https://example.test/worldbank",
            transformationId: "conditions-economic-component/v1",
          },
          {
            componentId: "unemployment",
            nativeValue: 7.8,
            nativeUnit: "percent",
            referenceYear: 2024,
            valueStatus: "observed",
            valueStatusReason: null,
            inclusionDecision: "included",
            sourceId: "world_bank",
            sourceName: "World Bank",
            indicatorId: "SL.UEM.TOTL.ZS",
            upstreamRelease: "WDI 2025",
            licenseUrl: "https://example.test/worldbank",
            transformationId: "conditions-economic-component/v1",
          },
          {
            componentId: "gdp_growth",
            nativeValue: 3.1,
            nativeUnit: "percent",
            referenceYear: 2024,
            valueStatus: "observed",
            valueStatusReason: null,
            inclusionDecision: "included",
            sourceId: "world_bank",
            sourceName: "World Bank",
            indicatorId: "NY.GDP.MKTP.KD.ZG",
            upstreamRelease: "WDI 2025",
            licenseUrl: "https://example.test/worldbank",
            transformationId: "conditions-economic-component/v1",
          },
        ],
      },
    ],
  }),
);

/* ────────────────────────────────────────────────────────────────
 * /api/v1/countries/[code]
 * ──────────────────────────────────────────────────────────────── */

const countryDetailExampleResponse = zCountryDetailResponse.strict().parse({
  data: shapeCountryDetail({
    slug: "france",
    name: "France",
    iso2: "FR",
    iso3: "FRA",
    continent: "Europe",
    capital: "Paris",
    population: 68170228,
    gdpBillions: 3130,
    areaSqKm: 643801,
    languages: "French",
    currency: "Euro (EUR)",
    democracyIndex: 7.99,
    worldBankRegion: "Europe & Central Asia",
    worldBankIncomeGroup: "High income",
    vdemRow: "Liberal Democracy",
    monarchyStatus: "none",
    governmentFormDescription:
      "Unitary semi-presidential constitutional republic",
    governmentType: "semi-presidential republic",
    governmentTypeDetail: "semi-presidential republic",
    governmentClassification: franceClassification,
    jurisdictionStatus: exampleSovereignStatus,
    flagUrl: "https://civicaatlas.org/flags/fr.svg",
    constitution: { year: 1958, yearUpdated: 2008 },
    government: {
      executive: [
        {
          id: "body-fr-presidency",
          name: "Presidency of France",
          type: "head_of_state",
          chamberType: null,
          totalSeats: null,
          offices: [
            {
              id: "office-fr-president",
              name: "President",
              type: "head_of_state",
              isElected: true,
              currentHolder: {
                name: "Emmanuel Macron",
                party: "Renaissance",
                since: "2017-05-14",
                photoUrl: "https://civicaatlas.org/people/macron.jpg",
              },
            },
          ],
        },
      ],
      legislative: [
        {
          id: "body-fr-assembly",
          name: "National Assembly",
          type: "legislature",
          chamberType: "lower",
          totalSeats: 577,
          offices: [],
          parties: [
            {
              name: "Renaissance",
              seats: 172,
              color: null,
              isRulingCoalition: true,
            },
          ],
        },
      ],
    },
    provenance: {
      population: exampleProvenanceEntry,
    },
    valueStatus: {
      capital: { status: "observed", reason: null },
      population: { status: "observed", reason: null },
      gdpBillions: { status: "observed", reason: null },
      areaSqKm: { status: "observed", reason: null },
      languages: { status: "observed", reason: null },
      currency: { status: "observed", reason: null },
      worldBankRegion: { status: "observed", reason: null },
      worldBankIncomeGroup: { status: "observed", reason: null },
      vdemRow: { status: "observed", reason: null },
      monarchyStatus: { status: "observed", reason: null },
      governmentFormDescription: { status: "observed", reason: null },
    },
  }),
  meta: shapeCountryDetailMeta({
    mode: "live",
    asOf: "live",
    vintage: null,
    cutoffAt: null,
    retrievedThrough: "2026-07-11T00:00:00.000Z",
    methodologyVersions: ["v0.2-beta"],
    candidateSetStatus: "live",
    candidateSetChecksum: null,
    winnerSetChecksum: null,
    resolverVersionHash: null,
  }),
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/government-types (deprecated)
 * ──────────────────────────────────────────────────────────────── */

const governmentTypesExampleResponse = zGovernmentTypesResponse.strict().parse({
  data: [
    shapeGovernmentTypesItem({
      governmentType: "Presidential republic",
      structuralFamily: "presidential_republic",
      count: 58,
      topExamples: [
        "United States",
        "Brazil",
        "Indonesia",
        "Nigeria",
        "Mexico",
      ],
    }),
  ],
  meta: shapeGovernmentTypesMeta(10),
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/[country_slug]
 * ──────────────────────────────────────────────────────────────── */

const indexCountryExampleResponse = zIndexCountryResponse.strict().parse({
  data: shapeIndexCountryData({
    slug: "france",
    name: "France",
    governmentClassification: franceClassification,
    quarter: currentCiRelease.quarter,
    vintageLabel: currentCiRelease.vintageLabel,
    score: 83.2,
    scoreLower: null,
    scoreUpper: null,
    completenessFlag: "full",
    rank: 18,
    totalRanked: currentCiRelease.compositeRowSet.rows,
    isPartial: false,
    missingDimensions: [],
    dimensionsAvailable: 4,
    methodologyVersion: currentCiRelease.methodologyVersion,
    dimensions: [
      {
        dimension: "democratic_quality",
        normalizedScore: 82.4,
        rawValue: 0.824,
        sourceId: "vdem",
        valueStatus: "observed",
      },
    ],
  }),
  meta: {
    methodology: CI_METHODOLOGY_META,
    release: currentCiReleaseIdentity,
    series: currentCiSeries,
    components: currentCiContextComponents,
    deprecations: [
      {
        identifier: "structural_family",
        kind: "field+filter",
        sunset: "2027-03-31",
        successor: "/api/v1/peer-groupings",
        replacedBy: [
          "world_bank_region",
          "world_bank_income_group",
          "vdem_row",
          "monarchy_status",
          "government_form_description",
        ],
        reason:
          "Use domain-specific peer lenses sourced from World Bank and V-Dem. See https://civicaatlas.org/civica-index/methodology/peer-grouping for the methodology.",
      },
    ],
  },
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/[country_slug]/history
 * ──────────────────────────────────────────────────────────────── */

const indexHistoryExampleResponse = zIndexHistoryResponse.strict().parse({
  data: [
    shapeIndexHistoryItem({
      quarter: currentCiRelease.quarter,
      score: 83.2,
      rank: 18,
      totalRanked: currentCiRelease.compositeRowSet.rows,
      isPartial: false,
    }),
  ],
  meta: {
    methodology: CI_METHODOLOGY_META,
    release: currentCiReleaseIdentity,
    series: currentCiSeries,
    components: publicCiPublicationComponents(currentCiRelease, {
      jurisdiction: "live_current",
    }),
  },
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/by-government-type
 * ──────────────────────────────────────────────────────────────── */

const indexByGovernmentTypeExampleResponse = zIndexByGovernmentTypeResponse
  .strict()
  .parse({
    data: [
      shapeIndexByGovernmentTypeItem({
        key: "parliamentary_democracy",
        governmentType: "Parliamentary democracy",
        count: 42,
        avgScore: 78.4,
        minScore: 51.2,
        maxScore: 96.1,
        medianScore: 80.0,
        q1: 68.5,
        q3: 88.9,
      }),
    ],
    meta: { quarter: currentCiRelease.quarter, taxonomy: "raw", release: currentCiReleaseIdentity, series: currentCiSeries, components: currentCiContextComponents },
  });

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/compare
 * ──────────────────────────────────────────────────────────────── */

const indexCompareResultA = shapeIndexCompareResult({
  jurisdiction: {
    slug: "france",
    name: "France",
    iso2: "FR",
    iso3: "FRA",
    continent: "Europe",
    governmentType: "semi-presidential republic",
    governmentTypeDetail: "semi-presidential republic",
    governmentClassification: franceClassification,
  },
  composite: {
    quarter: currentCiRelease.quarter,
    vintageLabel: currentCiRelease.vintageLabel,
    score: 83.2,
    scoreLower: null,
    scoreUpper: null,
    completenessFlag: "full",
    rank: 18,
    totalRanked: currentCiRelease.compositeRowSet.rows,
    isPartial: false,
    missingDimensions: [],
    dimensionsAvailable: 4,
    methodologyVersion: currentCiRelease.methodologyVersion,
  },
  dimensions: [
    {
      dimension: "democratic_quality",
      normalizedScore: 82.4,
      rawValue: 0.824,
      sourceId: "vdem",
      valueStatus: "observed",
    },
  ],
});

const indexCompareResultB = shapeIndexCompareResult({
  jurisdiction: {
    slug: "germany",
    name: "Germany",
    iso2: "DE",
    iso3: "DEU",
    continent: "Europe",
    governmentType: "federal parliamentary republic",
    governmentTypeDetail: "federal parliamentary republic",
    governmentClassification: {
      ...franceClassification,
      rawLabel: "federal parliamentary republic",
      regimeType: "parliamentary_democracy",
      regimeTypeLabel: "Parliamentary democracy",
      structuralFamily: "parliamentary_democracy",
      structuralFamilyLabel: "Parliamentary democracy",
      structuralSubtype: "federal_parliamentary_republic",
      structuralSubtypeLabel: "Federal parliamentary republic",
      primitives: {
        isFederal: true,
        isMonarchy: false,
        executiveStructure: "dual_executive",
        governmentDependency: "confidence_dependent",
      },
    },
  },
  composite: {
    quarter: currentCiRelease.quarter,
    vintageLabel: currentCiRelease.vintageLabel,
    score: 85.6,
    scoreLower: null,
    scoreUpper: null,
    completenessFlag: "full",
    rank: 12,
    totalRanked: currentCiRelease.compositeRowSet.rows,
    isPartial: false,
    missingDimensions: [],
    dimensionsAvailable: 4,
    methodologyVersion: currentCiRelease.methodologyVersion,
  },
  dimensions: [
    {
      dimension: "democratic_quality",
      normalizedScore: 85.1,
      rawValue: 0.851,
      sourceId: "vdem",
      valueStatus: "observed",
    },
  ],
});

const indexCompareExampleResponse = zIndexCompareResponse.parse({
  data: [indexCompareResultA, indexCompareResultB],
  meta: {
    quarter: currentCiRelease.quarter,
    count: 2,
    methodology: CI_METHODOLOGY_META,
    release: currentCiReleaseIdentity,
    series: currentCiSeries,
    components: currentCiContextComponents,
    deprecations: [
      {
        identifier: "structural_family",
        kind: "field+filter",
        sunset: "2027-03-31",
        successor: "/api/v1/peer-groupings",
        replacedBy: [
          "world_bank_region",
          "world_bank_income_group",
          "vdem_row",
          "monarchy_status",
          "government_form_description",
        ],
        reason:
          "Use domain-specific peer lenses sourced from World Bank and V-Dem. See https://civicaatlas.org/civica-index/methodology/peer-grouping for the methodology.",
      },
    ],
  },
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/methodology
 * ──────────────────────────────────────────────────────────────── */

const indexMethodologyExampleResponse = zIndexMethodologyResponse
  .strict()
  .parse({
    data: shapeIndexMethodologyData({
      id: CURRENT_CI_METHODOLOGY_VERSION,
      publishedAt: "2026-05-15T00:00:00.000Z",
      weights: {
        democratic_quality: 0.27,
        rule_of_law: 0.26,
        freedom_rights: 0.23,
        corruption_control: 0.24,
      },
      notes:
        "Research-beta composite under active validation. Numeric estimates are secondary experimental outputs and are not categorical country grades.",
      createdAt: "2026-05-15T00:00:00.000Z",
    }),
    meta: {
      methodology: CI_METHODOLOGY_META,
      release: currentCiReleaseIdentity,
      series: currentCiSeries,
      components: publicCiPublicationComponents(currentCiRelease),
    },
  });

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/rankings
 * ──────────────────────────────────────────────────────────────── */

const indexRankingsExampleResponse = zIndexRankingsResponse.strict().parse({
  data: [
    shapeIndexRankingsItem({
      rank: 1,
      score: 91.4,
      scoreLower: null,
      scoreUpper: null,
      completenessFlag: "full",
      vintageLabel: currentCiRelease.vintageLabel,
      isPartial: false,
      missingDimensions: [],
      dimensionsAvailable: 4,
      methodologyVersion: currentCiRelease.methodologyVersion,
      slug: "norway",
      name: "Norway",
      iso2: "NO",
      iso3: "NOR",
      continent: "Europe",
      governmentType: "parliamentary constitutional monarchy",
      governmentTypeDetail: "parliamentary constitutional monarchy",
      governmentClassification: norwayClassification,
    }),
  ],
  meta: shapeIndexRankingsMeta({
    total: currentCiRelease.compositeRowSet.rows,
    limit: 50,
    offset: 0,
    hasMore: true,
    quarter: currentCiRelease.quarter,
    taxonomy: "raw",
    release: currentCiRelease,
    series: currentCiSeries,
  }),
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/peer-groupings
 * ──────────────────────────────────────────────────────────────── */

const peerGroupingsExampleResponse = zPeerGroupingsResponse.strict().parse({
  data: shapePeerGroupingsData({
    world_bank_region: {
      factKey: "world_bank_region",
      filterParam: "region",
      source: "world_bank",
      sourceName: "World Bank",
      description:
        "World Bank Country and Lending Groups regional classification (7 regions). Default material peer lens — pair with world_bank_income_group for the canonical material cohort. Refreshed annually each July.",
      temporal: {
        observationReferenceYear: null,
        upstreamDatasetRelease: null,
        retrievedAt: null,
        civicaPublicationVersion: null,
      },
      values: [
        {
          value: "East Asia & Pacific",
          label: "East Asia & Pacific",
          totalCountries: 29,
          scoredCountries: 29,
        },
        {
          value: "Europe & Central Asia",
          label: "Europe & Central Asia",
          totalCountries: 52,
          scoredCountries: 52,
        },
      ],
    },
    world_bank_income_group: {
      factKey: "world_bank_income_group",
      filterParam: "income",
      source: "world_bank",
      sourceName: "World Bank",
      description:
        "World Bank income group classification (4 tiers, low → high). Pairs with world_bank_region for the canonical material cohort. Refreshed annually each July.",
      temporal: {
        observationReferenceYear: null,
        upstreamDatasetRelease: null,
        retrievedAt: null,
        civicaPublicationVersion: null,
      },
      values: [
        {
          value: "High income",
          label: "High income",
          totalCountries: 62,
          scoredCountries: 60,
        },
      ],
    },
    vdem_row: {
      factKey: "vdem_row",
      filterParam: "vdem",
      source: "vdem",
      sourceName: "V-Dem",
      description:
        "V-Dem Regimes of the World (Lührmann, Tannenberg & Lindberg 2018). Default governance peer lens — 4 tiers spanning closed autocracy through liberal democracy. Annual cadence.",
      temporal: {
        observationReferenceYear: null,
        upstreamDatasetRelease: null,
        retrievedAt: null,
        civicaPublicationVersion: null,
      },
      values: [
        {
          value: "Liberal Democracy",
          label: "Liberal Democracy",
          totalCountries: 33,
          scoredCountries: 33,
        },
      ],
    },
    cgv_regime: {
      factKey: "regime_type_cgv",
      filterParam: "cgv",
      source: "bjornskov_rode",
      sourceName: "Bjørnskov-Rode / CGV",
      description:
        "Bjørnskov-Rode / Cheibub-Gandhi-Vreeland regime classification (6 categories). Optional alternate governance lens distinguishing democracies by executive form and authoritarian systems by ruling-elite structure.",
      temporal: {
        observationReferenceYear: 2022,
        upstreamDatasetRelease:
          "Bjørnskov-Rode regime data v6.1 via QoG Standard Jan26",
        retrievedAt: "2026-04-22 04:01:13.289",
        civicaPublicationVersion: "2026_v1",
      },
      values: [
        {
          value: "presidential_democracy",
          label: "Presidential democracy",
          totalCountries: 58,
          scoredCountries: 55,
        },
      ],
    },
    monarchy_status: {
      factKey: "monarchy_status",
      filterParam: "monarchy",
      source: "cia_factbook",
      sourceName: "CIA World Factbook",
      description:
        "Monarchy status (6-value enum: none / constitutional / absolute / ceremonial / elective / theocratic). Descriptive constitutional-form metadata, NOT an analytical peer lens. Provided here for filterability ('show me ceremonial monarchies').",
      temporal: {
        observationReferenceYear: null,
        upstreamDatasetRelease: null,
        retrievedAt: null,
        civicaPublicationVersion: null,
      },
      values: [
        {
          value: "constitutional",
          label: "Constitutional monarchy",
          totalCountries: 34,
          scoredCountries: 33,
        },
      ],
    },
  }),
  meta: {
    peerGrouping: {
      status: "stable",
      version: "v1.0",
      versionDate: "2026-05-02",
      methodology:
        "https://civicaatlas.org/civica-index/methodology/peer-grouping",
    },
  },
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/methodology — generated verbatim from production code,
 * not a hand-typed fixture.
 * ──────────────────────────────────────────────────────────────── */

const pulseSnapshot = createPulseRuntimeMethodSnapshot();

const pulseMethodologyExampleResponse = zPulseMethodologyResponse
  .strict()
  .parse({
    data: pulseSnapshot,
  });

const pulseClusterCoverageExampleResponse = zPulseClusterCoverageResponse
  .strict()
  .parse({ data: pulseClusterCoverage });

const pulseSourceCoverageExampleResponse = zPulseSourceCoverageResponse
  .strict()
  .parse({
    data: {
      schemaVersion: "pulse-source-coverage/v1",
      generatedAt: "2026-07-11T16:45:00.000Z",
      standing: "operational_observability_not_retrieval_validation",
      feeds: [
        {
          feedId: "gdelt",
          connectorId: "gdelt",
          sourceIds: ["gdelt"],
          role: "news",
          state: "operating",
          stateReason:
            "The latest connector attempt succeeded and retained evidence exists.",
          retrieval: {
            observedRuns: 1,
            successfulRuns: 1,
            failedRuns: 0,
            latestAttemptAt: "2026-07-11T16:42:00.000Z",
            latestOutcome: "successful",
            latestFetched: 250,
            latestYield: 250,
            latestInserted: 128,
            latestSkippedDuplicate: 122,
            latestUnmatchedCountry: 1,
          },
          evidence: {
            retainedRows: 1306,
            lastDataAt: "2026-07-11T16:45:00.000Z",
            languages: ["en", "es", "und"],
            observedJurisdictions: 90,
            jurisdictionIso3s: ["BRA", "JPN", "URY"],
            unresolvedJurisdictionRows: 24,
          },
          rights: [
            {
              sourceId: "gdelt",
              licenseId: "pending-review",
              termsUrl: "https://www.gdeltproject.org/about.html",
              reviewStatus: "pending",
              publicExport: "pending-review",
              redistributionPosture: "open-with-attribution",
              restrictions: [
                "Public payload redistribution remains blocked pending review.",
              ],
            },
          ],
          activation:
            "Default GDELT document API query with best-effort article enrichment.",
          blindSpots: [
            "Query design, indexing, publisher access, language, and enrichment constrain recall.",
          ],
        },
      ],
      summary: { operating: 1, degraded: 0, inactive: 0 },
    },
  });

/** Every other Pulse endpoint's `meta.methodology` block, shared once
 *  here instead of copy-pasted per example. */
function pulseMethodologyMetaExample() {
  return {
    status: "experimental" as const,
    version: pulseSnapshot.version,
    taxonomy_version: pulseSnapshot.taxonomy.version,
    reference:
      "https://civicaatlas.org/civica-index/methodology/pulse" as const,
    runtime_snapshot: "/api/v1/pulse/methodology" as const,
    method_version_coverage: "explicit_row_level_versions" as const,
    presentation: {
      format: "per_dimension",
      public_status: "public_experimental",
      scalar_pulse_score: false as const,
      trailing_window_days: 730,
      bounds_per_dimension: { lower: -15, upper: 10 },
    },
    evaluation: {
      current_production_backtest_complete: false,
      independent_validation: "not_completed",
    },
  };
}

const pulseExampleVersionKey = `pulse-stage/sha256:${"a".repeat(64)}`;
const pulseExampleRunId = "11111111-1111-4111-8111-111111111111";

function pulseVersionIdentityExample(
  stage: "classify" | "corroborate" | "score",
  runId = pulseExampleRunId,
) {
  return {
    runId,
    versionKey: pulseExampleVersionKey,
    versions: {
      schemaVersion: "pulse-stage-version-envelope/v1" as const,
      stage,
      methodology: { state: "versioned" as const, id: pulseSnapshot.version },
      ontology: {
        state: "versioned" as const,
        id: pulseSnapshot.taxonomy.version,
      },
      pipeline: {
        state: "versioned" as const,
        id: "pulse-pipeline/versioned-lineage-v1",
      },
      algorithm: {
        state: "versioned" as const,
        id: `pulse-${stage}/example-v1`,
      },
      prompt:
        stage === "classify"
          ? {
              state: "versioned" as const,
              id: "pulse-classifier-prompt/example",
            }
          : {
              state: "not_applicable" as const,
              reason: `${stage} does not use a language-model decision prompt.`,
            },
      sourceBasket: {
        state: "versioned" as const,
        id: "source-basket/example",
      },
      sourceIds: ["gdelt"],
      models:
        stage === "classify"
          ? [
              {
                role: "classify" as const,
                provider: "deepseek",
                model: "deepseek-v4-flash",
              },
              {
                role: "classify" as const,
                provider: "glm",
                model: "glm-4.7",
              },
              {
                role: "classify" as const,
                provider: "anthropic",
                model: "claude-haiku-4-5",
              },
            ]
          : [],
      upstreamRunIds: [],
    },
  };
}

function pulseDeltaDerivationIdentityExample(contributing: boolean) {
  const version = pulseDeltaVersionEnvelope(
    contributing ? [pulseEventVersionEnvelope(["gdelt"]).envelope] : [],
    contributing ? ["gdelt"] : [],
  );
  return {
    versionKey: version.key,
    versions: version.envelope,
    lineageStatus: "current_versioned" as const,
  };
}

const pulseExampleVersionSet = {
  state: "single_version" as const,
  versionKeys: [pulseExampleVersionKey],
  containsLegacy: false,
  comparableAsSingleSeries: true,
};

const pulseExamplePromptVersion = "pulse-classifier-prompt/example";
const pulseExampleConfigurationHash = `pulse-classification-config/sha256:${"b".repeat(64)}`;

function pulseUnanimousClassifierRuns() {
  const shared = {
    temp: 0,
    role: "classify" as const,
    promptVersion: pulseExamplePromptVersion,
    methodVersion: pulseSnapshot.version,
    configurationHash: pulseExampleConfigurationHash,
    configuredEngineCount: 3,
    category: "judicial_independence_rollback",
    dimension: "rule_of_law",
    severityTier: "moderate_neg",
    severityValue: -1.2,
  };

  return [
    {
      ...shared,
      run: 1,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      rationale: "Court decision restricts judicial review scope.",
    },
    {
      ...shared,
      run: 2,
      provider: "glm",
      model: "glm-4.7",
      rationale: "The ruling narrows review of executive decrees.",
    },
    {
      ...shared,
      run: 3,
      provider: "anthropic",
      model: "claude-haiku-4-5",
      rationale: "The institutional change reduces judicial oversight.",
    },
  ];
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/[country_slug]/dimensions
 * ──────────────────────────────────────────────────────────────── */

const pulseDimensionsExampleResponse = zPulseDimensionsResponse.strict().parse({
  data: shapePulseDimensionsData({
    jurisdiction: {
      id: "jur-bra",
      slug: "brazil",
      name: "Brazil",
      iso3: "BRA",
    },
    dimensions: {
      democratic_quality: {
        dimension: "democratic_quality",
        delta: null,
        contributingEventIds: [],
        drivingEvents: [],
        evidence: {
          nEvents: 0,
          maxConfidence: 0,
          minSources: 0,
          maxSources: 0,
          allSingleSource: false,
        },
        limitedSignal: false,
        limitedReason: null,
        versionIdentity: null,
        derivationIdentity: pulseDeltaDerivationIdentityExample(false),
      },
      rule_of_law: {
        dimension: "rule_of_law",
        delta: -1.2,
        contributingEventIds: ["evt_9f1c2a"],
        drivingEvents: [
          {
            id: "evt_9f1c2a",
            headline: "Court ruling narrows judicial review",
            eventDate: "2026-07-01",
            severityTier: "moderate_neg",
            severityValue: -1.2,
            sources: ["gdelt"],
          },
        ],
        evidence: {
          nEvents: 1,
          maxConfidence: 0.42,
          minSources: 1,
          maxSources: 1,
          allSingleSource: true,
        },
        limitedSignal: true,
        limitedReason: "Single event",
        versionIdentity: pulseVersionIdentityExample("score"),
        derivationIdentity: pulseDeltaDerivationIdentityExample(true),
      },
      freedom_rights: {
        dimension: "freedom_rights",
        delta: null,
        contributingEventIds: [],
        drivingEvents: [],
        evidence: {
          nEvents: 0,
          maxConfidence: 0,
          minSources: 0,
          maxSources: 0,
          allSingleSource: false,
        },
        limitedSignal: false,
        limitedReason: null,
        versionIdentity: null,
        derivationIdentity: pulseDeltaDerivationIdentityExample(false),
      },
      corruption_control: {
        dimension: "corruption_control",
        delta: null,
        contributingEventIds: [],
        drivingEvents: [],
        evidence: {
          nEvents: 0,
          maxConfidence: 0,
          minSources: 0,
          maxSources: 0,
          allSingleSource: false,
        },
        limitedSignal: false,
        limitedReason: null,
        versionIdentity: null,
        derivationIdentity: pulseDeltaDerivationIdentityExample(false),
      },
      stability: {
        dimension: "stability",
        delta: null,
        contributingEventIds: [],
        drivingEvents: [],
        evidence: {
          nEvents: 0,
          maxConfidence: 0,
          minSources: 0,
          maxSources: 0,
          allSingleSource: false,
        },
        limitedSignal: false,
        limitedReason: null,
        versionIdentity: null,
        derivationIdentity: pulseDeltaDerivationIdentityExample(false),
      },
    },
    lastComputedAt: "2026-07-09T09:00:29.000Z",
    totalEvents: 1,
    observability: {
      schemaVersion: "pulse-observability/country-period-v1",
      period: {
        start: "2025-07-11",
        end: "2026-07-11",
        basis: "retrieval_time",
      },
      observationState: "low_coverage",
      eventObservation: "qualifying_event_observed",
      stateReason:
        "Retained country-period evidence does not meet the operational feed-family and document thresholds for a no-event statement.",
      evidence: {
        operatingFeeds: 4,
        degradedFeeds: 0,
        observedFeedFamilies: ["gdelt"],
        retainedDocuments: 3,
        qualifyingEvents: 1,
        informationEnvironment: null,
      },
      thresholds: {
        minimumObservedFeedFamilies: 2,
        minimumRetainedDocuments: 5,
      },
      numericEffect: "event_evidence_only",
      countryQualityInference: "prohibited",
      limitations: [
        "The threshold is an operational disclosure rule, not a validated estimate of retrieval recall.",
        "No qualifying event observed is not evidence of stability, good governance, or country quality.",
        "Restricted-information status requires a sourced context record; an approximate or default score cannot create it.",
      ],
    },
    informationEnvironmentContext: {
      schemaVersion: "pulse-information-environment-context/v1",
      valueStatus: "missing",
      score: null,
      tier: null,
      sourceId: null,
      sourceUrl: null,
      upstreamRelease: null,
      observationYear: null,
      retrievedAt: null,
      contentSha256: null,
      sourceCoverage: {
        publisherRows: null,
        matchedJurisdictions: null,
        supportedJurisdictions: null,
      },
      rightsStatus: "not_registered",
      useStatus: "not_available",
      missingReason:
        "No rights-cleared, versioned context observation is available.",
    },
    versionSet: pulseExampleVersionSet,
  }),
  meta: {
    methodology: pulseMethodologyMetaExample(),
    release: {
      schemaVersion: "pulse-score-publication/v1",
      product: "pulse_dimensions",
      scoreAsOf: "2026-07-09",
      publishedAt: "2026-07-09T09:00:29.000Z",
      completedAt: "2026-07-09T09:00:29.000Z",
      versionIdentity: {
        ...pulseVersionIdentityExample("score"),
        versionKeySerialization: "stable_json_v1",
      },
      lineageCoverage: {
        schemaVersion: "pulse-score-lineage-coverage/v1",
        state: "current_versioned_only",
        totalRows: 5,
        totalJurisdictions: 1,
        currentVersionedRows: 5,
        legacyInputLineageRows: 0,
        legacyInputLineageJurisdictions: 0,
      },
    },
    components: {
      dimensionalScores: "frozen_score_publication",
      contributingEventIds: "frozen_score_publication",
      derivationLineage:
        "frozen_explicit_current_or_legacy_input_lineage",
      drivingEventDetails: "live_context",
      evidenceQualifiers: "live_context",
      scoreEvidenceLinkage:
        "live_context_id_jurisdiction_dimension_sources_checked",
      jurisdictionIdentity: "live_context",
      observability: "live_context",
      informationEnvironment: "live_context",
    },
  },
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/[country_slug]/events
 * ──────────────────────────────────────────────────────────────── */

const pulseEventsExampleResponse = zPulseEventsResponse.strict().parse({
  data: shapePulseEventsData({
    jurisdiction: { id: "jur-bra", slug: "brazil", name: "Brazil" },
    events: [
      {
        id: "evt_9f1c2a",
        eventDate: "2026-07-01",
        category: "judicial_independence_rollback",
        dimension: "rule_of_law",
        severityTier: "moderate_neg",
        severityValue: -1.2,
        corroborationConfidence: 0.42,
        classifierAgreement: "all",
        humanReviewed: false,
        published: true,
        reviewStatus: "approved",
        headline: "Court ruling narrows judicial review",
        description:
          "A high court decision curtails judicial review of executive decrees.",
        subjectAttribution: {
          standing: "versioned",
          attributionVersion: "pulse-jurisdiction-attribution/v2",
          entityCatalogVersion: "pulse-jurisdiction-entities/v1",
          entityCatalogHash:
            "pulse-jurisdiction-entities/sha256:3333333333333333333333333333333333333333333333333333333333333333",
          aliasVersion: "pulse-jurisdiction-aliases/v1",
          requestedJurisdictionRole: "primary",
          primary: {
            jurisdictionId: "jur-bra",
            name: "Brazil",
            iso3: "BRA",
            slug: "brazil",
            role: "primary",
            rationale: "The ruling changes Brazil's domestic judicial review.",
            evidenceRefs: ["headline", "description"],
          },
          affected: [],
        },
        publicationOrigin: "auto",
        versionIdentity: {
          classification: pulseVersionIdentityExample("classify"),
          publication: pulseVersionIdentityExample("classify"),
          corroboration: pulseVersionIdentityExample("corroborate"),
        },
        sources: [
          {
            sourceId: "gdelt",
            sourceType: "news",
            sourceName: "GDELT",
            sourceUrl: "https://example.test/story",
            evidenceIdentity: {
              identityKey:
                "pulse-evidence/sha256:1111111111111111111111111111111111111111111111111111111111111111",
              contentHash:
                "2222222222222222222222222222222222222222222222222222222222222222",
              retrievedAt: "2026-07-01T12:00:00.000Z",
              language: "en",
              publisher: {
                schemaVersion: "pulse-raw-evidence/v1",
                sourceId: "gdelt",
                sourceFamilyId: "gdelt",
                sourcePublisher: "GDELT Project",
                sourceCanonicalUrl:
                  "https://api.gdeltproject.org/api/v2/doc/doc",
                itemPublisherHost: "example.test",
                sourceType: "news",
              },
              attribution: {
                schemaVersion: "pulse-raw-evidence/v1",
                methodVersion: "country-resolver/connector-v1",
                status: "resolved",
                rawCountryName: "Brazil",
                jurisdictionId: "jur-bra",
                evidence: [{ kind: "source_country_label", value: "Brazil" }],
              },
              rights: {
                schemaVersion: "pulse-raw-evidence/v1",
                sourceId: "gdelt",
                licenseId: "PUBLISHER-TERMS-PENDING:open-with-attribution",
                termsUrl: "https://api.gdeltproject.org/api/v2/doc/doc",
                reviewStatus: "pending",
                reviewedAt: null,
                publicExport: "pending-review",
                redistributionPosture: "open-with-attribution",
                restrictions: [
                  "Bulk export remains blocked until the terms record is verified",
                ],
              },
              retention: {
                schemaVersion: "pulse-raw-evidence/v1",
                captureMode: "full_internal_snapshot",
                storedFields: ["title", "body", "raw"],
                storageRelation: "raw_events",
                publicPayloadDistribution: "blocked",
                hashAlgorithm: "canonical-json/sha256-v1",
                linkRotProtection: "stored_payload_plus_content_hash",
                policyReason:
                  "Private research evidence; public payload redistribution is blocked.",
              },
            },
          },
        ],
      },
    ],
    versionSet: pulseExampleVersionSet,
  }),
  meta: {
    methodology: pulseMethodologyMetaExample(),
  },
});

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/changelog/v2
 * ──────────────────────────────────────────────────────────────── */

const pulseChangelogExampleResponse = zPulseChangelogResponse.strict().parse({
  data: [
    shapePulseChangelogRow({
      id: "evt_9f1c2a",
      eventDate: "2026-07-01",
      country: { slug: "brazil", name: "Brazil" },
      category: "judicial_independence_rollback",
      dimension: "rule_of_law",
      severityTier: "moderate_neg",
      severityValue: -1.2,
      classifierAgreement: "all",
      classifierRuns: pulseUnanimousClassifierRuns(),
      corroborationConfidence: 0.42,
      legacyInformationContextPresent: true,
      humanReviewed: false,
      publicationOrigin: "auto",
      published: true,
      reviewStatus: "approved",
      headline: "Court ruling narrows judicial review",
      description:
        "A high court decision curtails judicial review of executive decrees.",
      aiSummary: null,
      sources: ["gdelt"],
      sourceDetail: [
        {
          sourceId: "gdelt",
          sourceName: "GDELT",
          sourceType: "news",
          sourceUrl: "https://example.test/story",
          evidenceIdentity: {
            identityKey:
              "pulse-evidence/sha256:1111111111111111111111111111111111111111111111111111111111111111",
            contentHash:
              "2222222222222222222222222222222222222222222222222222222222222222",
            retrievedAt: "2026-07-01T12:00:00.000Z",
            language: "en",
            publisher: {
              schemaVersion: "pulse-raw-evidence/v1",
              sourceId: "gdelt",
              sourceFamilyId: "gdelt",
              sourcePublisher: "GDELT Project",
              sourceCanonicalUrl: "https://api.gdeltproject.org/api/v2/doc/doc",
              itemPublisherHost: "example.test",
              sourceType: "news",
            },
            attribution: {
              schemaVersion: "pulse-raw-evidence/v1",
              methodVersion: "country-resolver/connector-v1",
              status: "resolved",
              rawCountryName: "Brazil",
              jurisdictionId: "jur-bra",
              evidence: [{ kind: "source_country_label", value: "Brazil" }],
            },
            rights: {
              schemaVersion: "pulse-raw-evidence/v1",
              sourceId: "gdelt",
              licenseId: "PUBLISHER-TERMS-PENDING:open-with-attribution",
              termsUrl: "https://api.gdeltproject.org/api/v2/doc/doc",
              reviewStatus: "pending",
              reviewedAt: null,
              publicExport: "pending-review",
              redistributionPosture: "open-with-attribution",
              restrictions: [
                "Bulk export remains blocked until the terms record is verified",
              ],
            },
            retention: {
              schemaVersion: "pulse-raw-evidence/v1",
              captureMode: "full_internal_snapshot",
              storedFields: ["title", "body", "raw"],
              storageRelation: "raw_events",
              publicPayloadDistribution: "blocked",
              hashAlgorithm: "canonical-json/sha256-v1",
              linkRotProtection: "stored_payload_plus_content_hash",
              policyReason:
                "Private research evidence; public payload redistribution is blocked.",
            },
          },
        },
      ],
      versionIdentity: {
        classification: pulseVersionIdentityExample("classify"),
        publication: pulseVersionIdentityExample("classify"),
        corroboration: pulseVersionIdentityExample("corroborate"),
      },
    }),
  ],
  meta: {
    methodology: pulseMethodologyMetaExample(),
    limit: 50,
    offset: 0,
    hasMore: false,
    versionSet: pulseExampleVersionSet,
  },
});

/* ────────────────────────────────────────────────────────────────
 * /api/countries/[slug]/export
 * ──────────────────────────────────────────────────────────────── */

const countryExportJsonExample = zCountryExportJson.parse({
  schemaVersion: "country-research-export/v1",
  generatedAt: "2026-07-11T00:00:00.000Z",
  selection: {
    mode: "live",
    asOf: "live",
    vintage: null,
    cutoffAt: null,
    retrievedThrough: "2026-07-11T00:00:00.000Z",
    methodologyVersions: ["v0.2-beta"],
    candidateSetStatus: "live",
    candidateSetChecksum: null,
    winnerSetChecksum: null,
    resolverVersionHash: null,
  },
  jurisdiction: {
    id: "example-france-id",
    slug: "france",
    name: "France",
    iso2: "FR",
    iso3: "FRA",
    status: "sovereign_state",
    statusDetails: exampleSovereignStatus,
  },
  facts: [
    {
      factKey: "population_total",
      canonical: {
        recordClass: "canonical",
        rowId: "example-population-row",
        factKey: "population_total",
        factGroup: "B",
        category: "People",
        value: {
          text: "68,170,000",
          numeric: 68170000,
          structured: null,
          unit: "people",
          status: "observed",
          statusReason: null,
          type: "measured",
        },
        source: {
          id: "world_bank",
          name: "World Bank",
          url: "https://data.worldbank.org/indicator/SP.POP.TOTL?locations=FR",
          license: "CC-BY-4.0",
          termsUrl: "https://datacatalog.worldbank.org/public-licenses",
          lastSyncedAt: "2026-07-01T00:00:00.000Z",
        },
        freshness: {
          asOf: "2024-01-01",
          observationYear: 2024,
          dataVintageYear: 2024,
          retrievedAt: "2026-04-01T00:00:00.000Z",
          upstreamVintage: "WDI 2026.04",
        },
        lifecycle: { status: "active", reason: null },
        method: {
          rowMethodologyVersion: "v0.2-beta",
          reconciliationVersion: "source-precedence/v1",
          growthMethodology: null,
        },
        decision: {
          reason: "fresher_winner",
          trace: [
            {
              code: "canonical_selection",
              outcome: "selected",
              detail: "The resolver selected this row.",
              sourceIds: ["world_bank"],
            },
          ],
        },
        dispute: { openOrInReview: false },
      },
      alternates: [],
      projections: [],
      rejected: [],
    },
  ],
  withheld: {
    factKeys: [],
    observationCount: 0,
    reason: "Rows whose source terms do not permit public export are omitted.",
  },
  rights: { manifest: "/api/rights-manifest", policy: "source-row-filtered" },
});

const electionResearchExample = zElectionResearchExport.parse({
  schemaVersion: "election-research-export/v1",
  generatedAt: "2026-07-12T00:00:00.000Z",
  audit: { version: "election-corpus-audit/v1", asOf: "2026-07-12" },
  dateSemantics: {
    representation: "date_only",
    time: null,
    timeZone: null,
    note: "Publisher records provide calendar dates without a time of day or source time zone; UTC is not asserted.",
  },
  filters: { type: "presidential" },
  data: [
    {
      id: "example-election-id",
      conceptualEventKey: "example-us|presidential|2024-11-05",
      disposition: "qualified_event",
      jurisdiction: {
        id: "example-us",
        slug: "united-states",
        name: "United States",
        iso2: "US",
        iso3: "USA",
        status: "sovereign_state",
        statusLabel: "UN member state",
        disputed: false,
      },
      event: {
        name: "2024 United States presidential election",
        type: "presidential",
        date: {
          value: "2024-11-05",
          representation: "date_only",
          time: null,
          timeZone: null,
          timeZoneStatus: "not_provided_by_source",
          basis: "source_confirmed",
          precision: "day",
          role: "point_in_time",
          temporalClass: "historical",
          sourceStatus: "source_dated",
        },
        electoralSystem: null,
      },
      provenance: {
        sourceId: "wikidata",
        sourceUrl: "https://www.wikidata.org/wiki/Q101110072",
        license: "CC0",
        retrievedAt: "2026-07-05T14:03:06.491Z",
        rightsReview: "verified",
      },
    },
  ],
  withheld: {
    rows: 1,
    projectionRows: 1,
    bySource: [
      {
        sourceId: "ipu_parline",
        count: 1,
        reason:
          "IPU Parline export rights remain pending and non-commercial-only.",
      },
    ],
    fields: [
      {
        field: "electoralSystem",
        count: 1,
        reason:
          "Stored electoral-system labels do not yet carry exact field-level statement provenance and are not exported.",
      },
    ],
    reason:
      "Only qualified Wikidata rows with verified CC0 export rights are emitted. IPU, IDEA, projections derived from IPU, and unknown-source rows are withheld.",
  },
  rights: { manifest: "/api/rights-manifest", policy: "source-row-filtered" },
  meta: {
    auditedRowsMatchingFilters: 2,
    qualifiedEventOrContestRowsMatchingFilters: 1,
    projectionRowsMatchingFilters: 1,
    emittedRows: 1,
  },
});

/* ────────────────────────────────────────────────────────────────
 * Public map + renderer
 * ──────────────────────────────────────────────────────────────── */

export const EXAMPLES = {
  conditions: conditionsExampleResponse,
  countries: countriesExampleResponse,
  countryDetail: countryDetailExampleResponse,
  governmentTypes: governmentTypesExampleResponse,
  indexCountry: indexCountryExampleResponse,
  indexHistory: indexHistoryExampleResponse,
  indexByGovernmentType: indexByGovernmentTypeExampleResponse,
  indexCompare: indexCompareExampleResponse,
  indexMethodology: indexMethodologyExampleResponse,
  indexRankings: indexRankingsExampleResponse,
  peerGroupings: peerGroupingsExampleResponse,
  pulseMethodology: pulseMethodologyExampleResponse,
  pulseClusterCoverage: pulseClusterCoverageExampleResponse,
  pulseSourceCoverage: pulseSourceCoverageExampleResponse,
  pulseDimensions: pulseDimensionsExampleResponse,
  pulseEvents: pulseEventsExampleResponse,
  pulseChangelog: pulseChangelogExampleResponse,
  countryExport: countryExportJsonExample,
  elections: electionResearchExample,
} as const;

export type ExampleId = keyof typeof EXAMPLES;

/** JSON.stringify'd, schema-validated example for a `/v1` (or export
 *  JSON-branch) route. This is what every `EndpointSection` in
 *  api-docs/page.tsx renders — no hand-authored JSON string literals. */
export function renderExample(id: ExampleId): string {
  return JSON.stringify(EXAMPLES[id], null, 2);
}

export function renderCountryExportCsvExample(): string {
  return `${COUNTRY_EXPORT_CSV_HEADER}\ncountry-research-export/v1,…,example-france-id,france,France,FR,FRA,sovereign_state,UN member state,…,population_total,canonical,…`;
}

export { COUNTRY_EXPORT_CSV_HEADER };
