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
  zPeerGroupingsResponse,
  zPulseMethodologyResponse,
  zPulseDimensionsResponse,
  zPulseEventsResponse,
  zPulseChangelogResponse,
  zCountryExportJson,
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
  shapePeerGroupingsData,
  shapePulseDimensionsData,
  shapePulseEventsData,
  shapePulseChangelogRow,
} from "./shapes";
import { COUNTRY_EXPORT_CSV_HEADER } from "./csv";

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
    }),
  ],
  meta: shapeCountriesListMeta({
    total: 195,
    limit: 50,
    offset: 0,
    hasMore: true,
    taxonomy: "raw",
    selection: { mode: "live", asOf: "live", vintage: null, cutoffAt: null, retrievedThrough: "2026-07-11T00:00:00.000Z", methodologyVersions: ["v0.2-beta"], candidateSetStatus: "live", candidateSetChecksum: null, winnerSetChecksum: null, resolverVersionHash: null },
  }),
});

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
    civicaIndex: {
      quarter: "2026-Q1",
      composite: { score: 83.2, rank: 18, totalRanked: 167, isPartial: false },
      dimensions: [
        {
          dimension: "democratic_quality",
          normalizedScore: 82.4,
          rawValue: 0.824,
          valueStatus: "observed",
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
  meta: shapeCountryDetailMeta({ mode: "live", asOf: "live", vintage: null, cutoffAt: null, retrievedThrough: "2026-07-11T00:00:00.000Z", methodologyVersions: ["v0.2-beta"], candidateSetStatus: "live", candidateSetChecksum: null, winnerSetChecksum: null, resolverVersionHash: null }),
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
    quarter: "2026-Q1",
    vintageLabel: "Civica Index 2026 Q1 (Beta)",
    score: 83.2,
    scoreLower: 79.1,
    scoreUpper: 86.4,
    completenessFlag: "full",
    rank: 18,
    totalRanked: 167,
    isPartial: false,
    missingDimensions: [],
    dimensionsAvailable: 4,
    methodologyVersion: "beta-r3",
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
    methodology: {
      status: "beta",
      standing: "secondary_research_experiment",
      independent_validation: false,
      atlas_dependency: false,
      last_revised: "2026-07-01",
      reference: "https://civicaatlas.org/civica-index/methodology",
      presentation: {
        format: "numeric_position",
        scale: { min: 0, max: 100 },
        input_variation_range: "central_90_percent",
        categorical_grades: false,
      },
    },
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
      quarter: "2025-Q4",
      score: 82.6,
      rank: 19,
      totalRanked: 165,
      isPartial: false,
    }),
    shapeIndexHistoryItem({
      quarter: "2026-Q1",
      score: 83.2,
      rank: 18,
      totalRanked: 167,
      isPartial: false,
    }),
  ],
  meta: {
    methodology: {
      status: "beta",
      standing: "secondary_research_experiment",
      independent_validation: false,
      atlas_dependency: false,
      last_revised: "2026-07-01",
      reference: "https://civicaatlas.org/civica-index/methodology",
      presentation: {
        format: "numeric_position",
        scale: { min: 0, max: 100 },
        input_variation_range: "central_90_percent",
        categorical_grades: false,
      },
    },
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
    meta: { quarter: "2026-Q1", taxonomy: "raw" },
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
    quarter: "2026-Q1",
    vintageLabel: "Civica Index 2026 Q1 (Beta)",
    score: 83.2,
    scoreLower: 79.1,
    scoreUpper: 86.4,
    completenessFlag: "full",
    rank: 18,
    totalRanked: 167,
    isPartial: false,
    missingDimensions: [],
    dimensionsAvailable: 4,
    methodologyVersion: "beta-r3",
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
    quarter: "2026-Q1",
    vintageLabel: "Civica Index 2026 Q1 (Beta)",
    score: 85.6,
    scoreLower: 81.9,
    scoreUpper: 88.7,
    completenessFlag: "full",
    rank: 12,
    totalRanked: 167,
    isPartial: false,
    missingDimensions: [],
    dimensionsAvailable: 4,
    methodologyVersion: "beta-r3",
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
    quarter: null,
    count: 2,
    methodology: {
      status: "beta",
      standing: "secondary_research_experiment",
      independent_validation: false,
      atlas_dependency: false,
      last_revised: "2026-07-01",
      reference: "https://civicaatlas.org/civica-index/methodology",
      presentation: {
        format: "numeric_position",
        scale: { min: 0, max: 100 },
        input_variation_range: "central_90_percent",
        categorical_grades: false,
      },
    },
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
      id: "beta",
      publishedAt: "2026-05-15T00:00:00.000Z",
      weights: {
        democratic_quality: 0.3,
        rule_of_law: 0.3,
        freedom_rights: 0.2,
        corruption_control: 0.2,
      },
      notes:
        "Research-beta composite under active validation. Numeric estimates are secondary experimental outputs and are not categorical country grades.",
      createdAt: "2026-05-15T00:00:00.000Z",
    }),
    meta: {
      methodology: {
        status: "beta",
        standing: "secondary_research_experiment",
        independent_validation: false,
        atlas_dependency: false,
        last_revised: "2026-07-01",
        reference: "https://civicaatlas.org/civica-index/methodology",
        presentation: {
          format: "numeric_position",
          scale: { min: 0, max: 100 },
          input_variation_range: "central_90_percent",
          categorical_grades: false,
        },
      },
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
      scoreLower: 88.6,
      scoreUpper: 93.9,
      completenessFlag: "full",
      vintageLabel: "Civica Index 2026 Q1 (Beta)",
      isPartial: false,
      missingDimensions: [],
      dimensionsAvailable: 4,
      methodologyVersion: "beta-r3",
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
    total: 195,
    limit: 50,
    offset: 0,
    hasMore: true,
    quarter: "2026-Q1",
    taxonomy: "raw",
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
      temporal: { observationReferenceYear: null, upstreamDatasetRelease: null, retrievedAt: null, civicaPublicationVersion: null },
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
      temporal: { observationReferenceYear: null, upstreamDatasetRelease: null, retrievedAt: null, civicaPublicationVersion: null },
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
      temporal: { observationReferenceYear: null, upstreamDatasetRelease: null, retrievedAt: null, civicaPublicationVersion: null },
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
      temporal: { observationReferenceYear: 2022, upstreamDatasetRelease: "Bjørnskov-Rode regime data v6.1 via QoG Standard Jan26", retrievedAt: "2026-04-22 04:01:13.289", civicaPublicationVersion: "2026_v1" },
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
      temporal: { observationReferenceYear: null, upstreamDatasetRelease: null, retrievedAt: null, civicaPublicationVersion: null },
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
    method_version_coverage: "mixed_legacy_unversioned" as const,
    presentation: {
      format: "per_dimension",
      public_status: "public_experimental",
      scalar_pulse_score: false as const,
      trailing_window_days: 365,
      bounds_per_dimension: { lower: -10, upper: 10 },
    },
    evaluation: {
      current_production_backtest_complete: false,
      independent_validation: "not_completed",
    },
  };
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
      },
    },
    lastComputedAt: "2026-07-09T09:00:29.000Z",
    totalEvents: 1,
    pressFreedomContext: {
      score: 58,
      source: "approximate_static_2024_subset",
      directLookup: true,
      defaultApplied: false,
    },
  }),
  meta: {
    methodology: pulseMethodologyMetaExample(),
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
        publicationOrigin: "auto",
        sources: [
          {
            sourceId: "gdelt",
            sourceType: "news",
            sourceName: "GDELT",
            sourceUrl: null,
          },
        ],
      },
    ],
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
      classifierRuns: [
        {
          run: 1,
          temp: 0,
          provider: "deepseek",
          category: "judicial_independence_rollback",
          dimension: "rule_of_law",
          severityTier: "moderate_neg",
          severityValue: -1.2,
          rationale: "Court decision restricts judicial review scope.",
        },
      ],
      corroborationConfidence: 0.42,
      pressFreedomScoreAtClassification: 58,
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
          sourceUrl: null,
        },
      ],
    }),
  ],
  meta: {
    methodology: pulseMethodologyMetaExample(),
    limit: 50,
    offset: 0,
    hasMore: false,
  },
});

/* ────────────────────────────────────────────────────────────────
 * /api/countries/[slug]/export
 * ──────────────────────────────────────────────────────────────── */

const countryExportJsonExample = zCountryExportJson.parse({
  schemaVersion: "country-research-export/v1",
  generatedAt: "2026-07-11T00:00:00.000Z",
  selection: { mode: "live", asOf: "live", vintage: null, cutoffAt: null, retrievedThrough: "2026-07-11T00:00:00.000Z", methodologyVersions: ["v0.2-beta"], candidateSetStatus: "live", candidateSetChecksum: null, winnerSetChecksum: null, resolverVersionHash: null },
  jurisdiction: { id: "example-france-id", slug: "france", name: "France", iso2: "FR", iso3: "FRA", status: "sovereign_state" },
  facts: [{
    factKey: "population_total",
    canonical: {
      recordClass: "canonical", rowId: "example-population-row", factKey: "population_total", factGroup: "B", category: "People",
      value: { text: "68,170,000", numeric: 68170000, structured: null, unit: "people", status: "observed", statusReason: null, type: "measured" },
      source: { id: "world_bank", name: "World Bank", url: "https://data.worldbank.org/indicator/SP.POP.TOTL?locations=FR", license: "CC-BY-4.0", termsUrl: "https://datacatalog.worldbank.org/public-licenses", lastSyncedAt: "2026-07-01T00:00:00.000Z" },
      freshness: { asOf: "2024-01-01", observationYear: 2024, dataVintageYear: 2024, retrievedAt: "2026-04-01T00:00:00.000Z", upstreamVintage: "WDI 2026.04" },
      lifecycle: { status: "active", reason: null },
      method: { rowMethodologyVersion: "v0.2-beta", reconciliationVersion: "source-precedence/v1", growthMethodology: null },
      decision: { reason: "fresher_winner", trace: [{ code: "canonical_selection", outcome: "selected", detail: "The resolver selected this row.", sourceIds: ["world_bank"] }] },
      dispute: { openOrInReview: false },
    },
    alternates: [], projections: [], rejected: [],
  }],
  withheld: { factKeys: [], observationCount: 0, reason: "Rows whose source terms do not permit public export are omitted." },
  rights: { manifest: "/api/rights-manifest", policy: "source-row-filtered" },
});

/* ────────────────────────────────────────────────────────────────
 * Public map + renderer
 * ──────────────────────────────────────────────────────────────── */

export const EXAMPLES = {
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
  pulseDimensions: pulseDimensionsExampleResponse,
  pulseEvents: pulseEventsExampleResponse,
  pulseChangelog: pulseChangelogExampleResponse,
  countryExport: countryExportJsonExample,
} as const;

export type ExampleId = keyof typeof EXAMPLES;

/** JSON.stringify'd, schema-validated example for a `/v1` (or export
 *  JSON-branch) route. This is what every `EndpointSection` in
 *  api-docs/page.tsx renders — no hand-authored JSON string literals. */
export function renderExample(id: ExampleId): string {
  return JSON.stringify(EXAMPLES[id], null, 2);
}

export function renderCountryExportCsvExample(): string {
  return `${COUNTRY_EXPORT_CSV_HEADER}\ncountry-research-export/v1,example-france-id,france,France,FR,FRA,sovereign_state,population_total,canonical,…`;
}

export { COUNTRY_EXPORT_CSV_HEADER };
