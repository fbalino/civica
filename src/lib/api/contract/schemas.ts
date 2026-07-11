/**
 * CLM-012 — canonical DB-free API contract schema layer.
 *
 * Single source of truth for the wire shape of every public `/api/v1/*`
 * GET route plus the bulk `/api/countries/:slug/export` route. Every
 * schema here describes the JSON that actually leaves the server
 * (post-`JSON.stringify`: `Date` -> ISO string, `undefined` stripped),
 * not the raw Drizzle row shape.
 *
 * Deprecation dates/headers/meta are NEVER retyped here — they are
 * imported from `src/lib/api/deprecation.ts`, the one sanctioned source
 * (see AGENTS.md "one canonical source" discipline, APR-D024).
 *
 * Route handlers bind to these schemas at the TYPE level (each route's
 * pure shape function in `src/app/api/**\/route.ts` is annotated
 * `z.infer<typeof XSchema>`, so TypeScript's excess-property and
 * missing-property checks fire on every edit). Runtime `.strict()`
 * parsing happens in `contract/examples.ts` (canonical fixtures) and in
 * `contract/__tests__/*.test.ts` (negative fixtures) — see
 * `scripts/validate-api-docs.ts` for the build-gate that ties it all
 * together.
 */

import { z } from "zod";
import {
  STRUCTURAL_FAMILY_SUNSET_DATE,
  STRUCTURAL_FAMILY_SUNSET_DATE_ISO,
  PEER_GROUPINGS_SUCCESSOR_HREF,
} from "@/lib/api/deprecation";

/* ────────────────────────────────────────────────────────────────
 * Primitive enums (mirrored from their owning modules — these are
 * closed unions the source modules already export; keeping the
 * zod enum here is the schema-layer's job, not a second taxonomy).
 * ──────────────────────────────────────────────────────────────── */

export const zStructuralFamilyKey = z.enum([
  "parliamentary_democracy",
  "presidential_republic",
  "semi_presidential",
  "constitutional_monarchy",
  "absolute_monarchy",
  "one_party_state",
  "military_rule",
  "theocracy",
  "directorial_republic",
  "other",
]);

export const zRegimeTypeKey = z.enum([
  "parliamentary_democracy",
  "semi_presidential_democracy",
  "presidential_democracy",
  "civilian_dictatorship",
  "military_dictatorship",
  "royal_dictatorship",
]);

export const zWorldBankRegionKey = z.enum([
  "East Asia & Pacific",
  "Europe & Central Asia",
  "Latin America & Caribbean",
  "Middle East, North Africa, Afghanistan & Pakistan",
  "North America",
  "South Asia",
  "Sub-Saharan Africa",
]);

export const zWorldBankIncomeGroupKey = z.enum([
  "Low income",
  "Lower middle income",
  "Upper middle income",
  "High income",
]);

export const zVDemRowKey = z.enum([
  "Closed Autocracy",
  "Electoral Autocracy",
  "Electoral Democracy",
  "Liberal Democracy",
]);

export const zMonarchyStatusKey = z.enum([
  "none",
  "constitutional",
  "absolute",
  "ceremonial",
  "elective",
  "theocratic",
]);

export const zPulseDimension = z.enum([
  "democratic_quality",
  "rule_of_law",
  "freedom_rights",
  "corruption_control",
  "stability",
]);

export const zDataValueStatus = z.enum([
  "observed",
  "missing",
  "unknown",
  "not_applicable",
  "not_observed",
  "disputed",
  "withheld",
]);

export const zApiDataValueStatus = z
  .object({
    status: zDataValueStatus,
    reason: z.string().nullable(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * Shared building blocks
 * ──────────────────────────────────────────────────────────────── */

/** Mirrors `GovernmentClassification` (src/lib/government-taxonomy/index.ts).
 *  Carries the deprecated `structural*` fields — every response that
 *  embeds this schema MUST also attach `zDeprecationMeta`. */
export const zGovernmentClassification = z
  .object({
    taxonomyVersion: z.string(),
    rawLabel: z.string().nullable(),
    regimeType: zRegimeTypeKey.nullable(),
    regimeTypeLabel: z.string().nullable(),
    regimeSource: z.string().nullable(),
    regimeDatasetVersion: z.string().nullable(),
    regimeYear: z.number().nullable(),
    structuralFamily: zStructuralFamilyKey.nullable(),
    structuralFamilyLabel: z.string().nullable(),
    structuralSubtype: z.string().nullable(),
    structuralSubtypeLabel: z.string().nullable(),
    structuralColorVar: z.string().nullable(),
    structuralColorFallback: z.string().nullable(),
    regimeColorVar: z.string().nullable(),
    regimeColorFallback: z.string().nullable(),
    primitives: z
      .object({
        isFederal: z.boolean().nullable(),
        isMonarchy: z.boolean().nullable(),
        executiveStructure: z.string().nullable(),
        governmentDependency: z.string().nullable(),
      })
      .strict(),
    overrideNote: z.string().nullable(),
    provenance: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict();
export type GovernmentClassificationShape = z.infer<
  typeof zGovernmentClassification
>;

/** Mirrors `ApiAlternate` (src/lib/factbook/reconcile/api.ts). */
export const zApiAlternate = z
  .object({
    source: z.string(),
    sourceName: z.string(),
    value: z.union([z.number(), z.string(), z.null()]),
    asOf: z.string().nullable(),
    vintageLabel: z.string().nullable(),
    url: z.string().nullable(),
    rejected: z.literal(true).optional(),
    rejectionReason: z.string().optional(),
    valueType: z.enum(["measured", "projected"]),
    valueStatus: zDataValueStatus,
    valueStatusReason: z.string().nullable(),
  })
  .strict();

/** Mirrors `ApiProvenanceEntry` (src/lib/factbook/reconcile/api.ts). */
export const zApiProvenanceEntry = z
  .object({
    factKey: z.string(),
    source: z.string(),
    sourceName: z.string(),
    asOf: z.string().nullable(),
    vintageLabel: z.string().nullable(),
    decisionReason: z.enum([
      "single_source",
      "agreement",
      "fresher_winner",
      "incumbent_held",
      "cia_default_group_a",
      "cia_default_group_c",
      "no_active_rows",
    ]),
    decisionTrace: z.array(
      z
        .object({
          code: z.enum([
            "row_eligibility",
            "measurement_partition",
            "source_lineage",
            "precedence_rule",
            "guard_result",
            "canonical_selection",
          ]),
          outcome: z.string(),
          detail: z.string(),
          sourceIds: z.array(z.string()),
        })
        .strict(),
    ),
    isDisputed: z.boolean(),
    alternates: z.array(zApiAlternate),
    valueType: z.enum(["measured", "projected"]),
    canonicalIsProjection: z.boolean(),
    valueStatus: zDataValueStatus,
  })
  .strict();

/**
 * `meta.deprecations` block. Every literal value is imported from
 * `deprecation.ts` — never retyped — so a future sunset-date change
 * only needs one edit and this schema (and every fixture built on it)
 * stays correct automatically.
 */
export const zDeprecationEntry = z
  .object({
    identifier: z.literal("structural_family"),
    kind: z.literal("field+filter"),
    sunset: z.literal(STRUCTURAL_FAMILY_SUNSET_DATE_ISO),
    successor: z.literal(PEER_GROUPINGS_SUCCESSOR_HREF),
    replacedBy: z.array(z.string()),
    reason: z.string(),
  })
  .strict();

export const zDeprecationMeta = z
  .object({
    deprecations: z.array(zDeprecationEntry).length(1),
  })
  .strict();

/** HTTP headers attached by `withStructuralFamilyDeprecation`. Values
 *  are literal-bound to `deprecation.ts` constants, not retyped. */
export const zDeprecationHeaders = z
  .object({
    Deprecation: z.literal("true"),
    Sunset: z.literal(STRUCTURAL_FAMILY_SUNSET_DATE),
    Link: z.literal(
      `<${PEER_GROUPINGS_SUCCESSOR_HREF}>; rel="successor-version"`,
    ),
  })
  .strict();

/** Mirrors `CI_METHODOLOGY_META` (src/lib/api/helpers.ts). */
export const zCiMethodologyMeta = z
  .object({
    status: z.string(),
    standing: z.literal("secondary_research_experiment"),
    independent_validation: z.literal(false),
    atlas_dependency: z.literal(false),
    last_revised: z.string(),
    reference: z.literal("https://civicaatlas.org/civica-index/methodology"),
    missingness: z
      .object({
        policy_id: z.string(),
        mandatory_dimensions: z.array(z.string()).length(2),
        optional_dimensions: z.array(z.string()).length(2),
        minimum_dimensions_for_publication: z.literal(3),
        maximum_missing_optional_dimensions: z.literal(1),
        partial_weight_treatment: z.literal(
          "renormalize_present_weights_to_one",
        ),
        partial_range_multiplier: z.null(),
        partial_comparability: z.literal(
          "not_directly_comparable_to_full_estimates_without_the_missingness_flag",
        ),
        insufficient_treatment: z.literal("withhold_composite"),
      })
      .strict(),
    uncertainty: z
      .object({
        policy_id: z.string(),
        point_estimate: z.literal("deterministic_weighted_composite"),
        displayed_range: z.literal("not_published"),
        covariance_model: z.literal("not_available"),
        usable_released_uncertainty_rows: z.literal(0),
        released_dimension_rows: z.literal(745),
        disposition: z.literal(
          "removed_until_source_specific_uncertainty_and_dependence_are_retained_and_validated",
        ),
      })
      .strict(),
    ranking: z
      .object({
        policy_id: z.literal("ci-rank/competition-rounded-score-v1"),
        ranked_quantity: z.literal("published_integer_composite"),
        tie_method: z.literal("competition"),
        tie_breaker: z.literal("none_for_published_rank"),
        display_order_within_tie: z.literal(
          "jurisdiction_id_ascending_nonordinal",
        ),
        rank_uncertainty: z.literal(
          "not_estimable_without_valid_score_uncertainty",
        ),
      })
      .strict(),
    presentation: z
      .object({
        format: z.literal("numeric_position"),
        scale: z.object({ min: z.literal(0), max: z.literal(100) }).strict(),
        input_variation_range: z.literal("not_published"),
        categorical_grades: z.literal(false),
      })
      .strict(),
  })
  .strict();

export const zCiSeriesProvenance = z
  .object({
    releaseId: z.string(),
    seriesType: z.enum(["as_published_release", "harmonized_backcast"]),
    observationPeriodStart: z.string(),
    observationPeriodEnd: z.string(),
    originalPublicationCutAt: z.string().nullable(),
    calculatedAt: z.string(),
    methodVersion: z.string(),
    citationLabel: z.string(),
  })
  .strict();

/** Mirrors `PULSE_METHODOLOGY_META` (src/lib/api/helpers.ts). */
export const zPulseMethodologyMeta = z
  .object({
    status: z.literal("experimental"),
    version: z.string(),
    taxonomy_version: z.string(),
    reference: z.literal(
      "https://civicaatlas.org/civica-index/methodology/pulse",
    ),
    runtime_snapshot: z.literal("/api/v1/pulse/methodology"),
    method_version_coverage: z.enum([
      "mixed_legacy_unversioned",
      "explicit_row_level_versions",
    ]),
    presentation: z
      .object({
        format: z.string(),
        public_status: z.string(),
        scalar_pulse_score: z.literal(false),
        trailing_window_days: z.number(),
        bounds_per_dimension: z.record(z.string(), z.unknown()),
      })
      .strict(),
    evaluation: z
      .object({
        current_production_backtest_complete: z.boolean(),
        independent_validation: z.string(),
      })
      .strict(),
  })
  .strict();

/** Mirrors `FACTBOOK_RECONCILIATION_META` (src/lib/factbook/reconcile/api.ts). */
export const zFactbookReconciliationMeta = z
  .object({
    status: z.string(),
    version: z.string(),
    reference: z.literal(
      "https://civicaatlas.org/country/methodology/reconciliation",
    ),
    mode: z.enum(["live", "vintage"]),
    asOf: z.string(),
    vintage: z.string().nullable(),
    cutoffAt: z.string().nullable(),
    retrievedThrough: z.string().nullable(),
    methodologyVersions: z.array(z.string()),
    candidateSetStatus: z.enum([
      "live",
      "complete_candidates",
      "canonical_only_legacy",
    ]),
    candidateSetChecksum: z.string().nullable(),
    winnerSetChecksum: z.string().nullable(),
    resolverVersionHash: z.string().nullable(),
  })
  .strict();

export const zPaginationMeta = z
  .object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  })
  .strict();

export const zApiErrorEnvelope = z.object({ error: z.string() }).strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/countries
 * ──────────────────────────────────────────────────────────────── */

export const zCountryListItem = z
  .object({
    slug: z.string(),
    name: z.string(),
    iso2: z.string().nullable(),
    iso3: z.string().nullable(),
    continent: z.string().nullable(),
    capital: z.string().nullable(),
    population: z.number().nullable(),
    governmentType: z.string().nullable(),
    governmentTypeDetail: z.string().nullable(),
    gdpBillions: z.number().nullable(),
    areaSqKm: z.number().nullable(),
    flagUrl: z.string().nullable(),
    governmentClassification: zGovernmentClassification.nullable(),
  })
  .strict();

export const zCountriesListMeta = zPaginationMeta
  .extend({
    taxonomy: z.string(),
    selection: z
      .object({
        mode: z.enum(["live", "vintage"]),
        asOf: z.string(),
        vintage: z.string().nullable(),
        cutoffAt: z.string().nullable(),
        retrievedThrough: z.string().nullable(),
        methodologyVersions: z.array(z.string()),
        candidateSetStatus: z.enum([
          "live",
          "complete_candidates",
          "canonical_only_legacy",
        ]),
        candidateSetChecksum: z.string().nullable(),
        winnerSetChecksum: z.string().nullable(),
        resolverVersionHash: z.string().nullable(),
      })
      .strict(),
  })
  .extend(zDeprecationMeta.shape)
  .strict();

export const zCountriesListResponse = z
  .object({
    data: z.array(zCountryListItem),
    meta: zCountriesListMeta,
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/countries/[code]
 * ──────────────────────────────────────────────────────────────── */

const zOfficeHolder = z
  .object({
    name: z.string(),
    party: z.string().nullable(),
    since: z.string().nullable(),
    photoUrl: z.string().nullable(),
  })
  .strict();

const zOffice = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string().nullable(),
    isElected: z.boolean().nullable(),
    currentHolder: zOfficeHolder.nullable(),
  })
  .strict();

const zParty = z
  .object({
    name: z.string(),
    seats: z.number().nullable(),
    color: z.string().nullable(),
    isRulingCoalition: z.boolean().nullable(),
  })
  .strict();

const zGovernmentBody = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string().nullable(),
    chamberType: z.string().nullable(),
    totalSeats: z.number().nullable(),
    offices: z.array(zOffice),
    parties: z.array(zParty).optional(),
  })
  .strict();

export const zCountryDetail = z
  .object({
    slug: z.string(),
    name: z.string(),
    iso2: z.string().nullable(),
    iso3: z.string().nullable(),
    continent: z.string().nullable(),
    capital: z.string().nullable(),
    population: z.number().nullable(),
    gdpBillions: z.number().nullable(),
    areaSqKm: z.number().nullable(),
    languages: z.string().nullable(),
    currency: z.string().nullable(),
    democracyIndex: z.number().nullable(),
    worldBankRegion: z.string().nullable(),
    worldBankIncomeGroup: z.string().nullable(),
    vdemRow: z.string().nullable(),
    monarchyStatus: z.string().nullable(),
    governmentFormDescription: z.string().nullable(),
    governmentType: z.string().nullable(),
    governmentTypeDetail: z.string().nullable(),
    governmentClassification: zGovernmentClassification.nullable(),
    flagUrl: z.string().nullable(),
    constitution: z
      .object({
        year: z.number().nullable(),
        yearUpdated: z.number().nullable(),
      })
      .strict()
      .nullable(),
    government: z.record(z.string(), z.array(zGovernmentBody)),
    provenance: z.record(z.string(), zApiProvenanceEntry),
    valueStatus: z.record(z.string(), zApiDataValueStatus),
  })
  .strict();

export const zCountryDetailMeta = z
  .object({
    reconciliation: zFactbookReconciliationMeta,
  })
  .extend(zDeprecationMeta.shape)
  .strict();

export const zCountryDetailResponse = z
  .object({
    data: zCountryDetail,
    meta: zCountryDetailMeta,
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/government-types (DEPRECATED — see deprecation.ts)
 * ──────────────────────────────────────────────────────────────── */

export const zGovernmentTypesItem = z
  .object({
    governmentType: z.string(),
    structuralFamily: zStructuralFamilyKey,
    count: z.number(),
    topExamples: z.array(z.string()),
  })
  .strict();

export const zGovernmentTypesResponse = z
  .object({
    data: z.array(zGovernmentTypesItem),
    meta: z
      .object({ total: z.number() })
      .extend(zDeprecationMeta.shape)
      .strict(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * CI composite dimension row — shared by index/[slug], index/compare,
 * index/rankings.
 * ──────────────────────────────────────────────────────────────── */

export const zCiDimensionRow = z
  .object({
    dimension: z.string(),
    normalizedScore: z.number().nullable(),
    rawValue: z.number().nullable(),
    sourceId: z.string().nullable(),
    valueStatus: zDataValueStatus,
  })
  .strict();

const zCiCompositeCore = {
  quarter: z.string(),
  vintageLabel: z.string().nullable(),
  score: z.number(),
  scoreLower: z.number().nullable(),
  scoreUpper: z.number().nullable(),
  completenessFlag: z.enum(["full", "partial"]).nullable(),
  rank: z.number().nullable(),
  totalRanked: z.number().nullable(),
  isPartial: z.boolean(),
  missingDimensions: z
    .array(
      z.enum([
        "democratic_quality",
        "rule_of_law",
        "freedom_rights",
        "corruption_control",
      ]),
    )
    .max(1),
  dimensionsAvailable: z.number().int().min(3).max(4).nullable(),
  methodologyVersion: z.string(),
};

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/[country_slug]
 * ──────────────────────────────────────────────────────────────── */

export const zIndexCountryData = z
  .object({
    slug: z.string(),
    name: z.string(),
    governmentClassification: zGovernmentClassification.nullable(),
    ...zCiCompositeCore,
    dimensions: z.array(zCiDimensionRow),
  })
  .strict();

export const zIndexCountryResponse = z
  .object({
    data: zIndexCountryData,
    meta: z
      .object({ methodology: zCiMethodologyMeta, series: zCiSeriesProvenance })
      .extend(zDeprecationMeta.shape)
      .strict(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/[country_slug]/history
 * ──────────────────────────────────────────────────────────────── */

export const zIndexHistoryItem = z
  .object({
    quarter: z.string(),
    score: z.number(),
    rank: z.number().nullable(),
    totalRanked: z.number().nullable(),
    isPartial: z.boolean(),
  })
  .strict();

export const zIndexHistoryResponse = z
  .object({
    data: z.array(zIndexHistoryItem),
    meta: z
      .object({ methodology: zCiMethodologyMeta, series: zCiSeriesProvenance })
      .strict(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/by-government-type
 * ──────────────────────────────────────────────────────────────── */

export const zIndexByGovernmentTypeItem = z
  .object({
    key: z.string(),
    governmentType: z.string(),
    count: z.number(),
    avgScore: z.number(),
    minScore: z.number(),
    maxScore: z.number(),
    medianScore: z.number(),
    q1: z.number(),
    q3: z.number(),
  })
  .strict();

export const zIndexByGovernmentTypeMetaBase = z
  .object({
    quarter: z.string().nullable(),
    taxonomy: z.string(),
    series: zCiSeriesProvenance,
  })
  .strict();

export const zIndexByGovernmentTypeResponse = z
  .object({
    data: z.array(zIndexByGovernmentTypeItem),
    meta: z.union([
      zIndexByGovernmentTypeMetaBase,
      zIndexByGovernmentTypeMetaBase.extend(zDeprecationMeta.shape).strict(),
    ]),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/compare
 * ──────────────────────────────────────────────────────────────── */

export const zIndexCompareResult = z
  .object({
    jurisdiction: z
      .object({
        slug: z.string(),
        name: z.string(),
        iso2: z.string().nullable(),
        iso3: z.string().nullable(),
        continent: z.string().nullable(),
        governmentType: z.string().nullable(),
        governmentTypeDetail: z.string().nullable(),
        governmentClassification: zGovernmentClassification.nullable(),
      })
      .strict(),
    composite: z.object(zCiCompositeCore).strict().nullable(),
    dimensions: z.array(zCiDimensionRow),
  })
  .strict();

export const zIndexCompareResponse = z
  .object({
    data: z.array(zIndexCompareResult),
    meta: z
      .object({
        quarter: z.string().nullable(),
        count: z.number(),
        methodology: zCiMethodologyMeta,
        series: zCiSeriesProvenance,
      })
      .extend(zDeprecationMeta.shape)
      .strict(),
  })
  .strict()
  .refine((val) => val.data.length === val.meta.count, {
    message: "meta.count must equal data.length",
    path: ["meta", "count"],
  });

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/methodology
 * ──────────────────────────────────────────────────────────────── */

export const zIndexMethodologyData = z
  .object({
    id: z.string(),
    publishedAt: z.string(),
    weights: z.record(z.string(), z.unknown()),
    notes: z.string().nullable(),
    createdAt: z.string().nullable(),
  })
  .strict();

export const zIndexMethodologyResponse = z
  .object({
    data: zIndexMethodologyData,
    meta: z
      .object({
        methodology: zCiMethodologyMeta,
        series: zCiSeriesProvenance.nullable(),
      })
      .strict(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/rankings
 * ──────────────────────────────────────────────────────────────── */

/**
 * `/api/v1/index/rankings` items are a deliberately narrower projection
 * than `zCiCompositeCore` (no `totalRanked` — redundant next to
 * `meta.total`/`meta.hasMore` on a paginated ranking list). They DO
 * carry `dimensionsAvailable` (CLM-012 addition — the rankings query
 * previously selected every composite field except this one, an
 * inconsistency with the sibling index/[slug] and index/compare
 * endpoints that this contract closes).
 */
export const zIndexRankingsItem = z
  .object({
    rank: z.number().nullable(),
    score: z.number(),
    scoreLower: z.number().nullable(),
    scoreUpper: z.number().nullable(),
    completenessFlag: z.enum(["full", "partial"]).nullable(),
    vintageLabel: z.string().nullable(),
    isPartial: z.boolean(),
    missingDimensions: z
      .array(
        z.enum([
          "democratic_quality",
          "rule_of_law",
          "freedom_rights",
          "corruption_control",
        ]),
      )
      .max(1),
    dimensionsAvailable: z.number().int().min(3).max(4).nullable(),
    methodologyVersion: z.string(),
    slug: z.string(),
    name: z.string(),
    iso2: z.string().nullable(),
    iso3: z.string().nullable(),
    continent: z.string().nullable(),
    governmentType: z.string().nullable(),
    governmentTypeDetail: z.string().nullable(),
    governmentClassification: zGovernmentClassification.nullable(),
  })
  .strict();

export const zIndexRankingsMeta = zPaginationMeta
  .extend({
    quarter: z.string().nullable(),
    taxonomy: z.string(),
    methodology: zCiMethodologyMeta,
    series: zCiSeriesProvenance,
  })
  .extend(zDeprecationMeta.shape)
  .strict();

export const zIndexRankingsResponse = z
  .object({
    data: z.array(zIndexRankingsItem),
    meta: zIndexRankingsMeta,
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/peer-groupings
 * ──────────────────────────────────────────────────────────────── */

export const zPeerLensValue = z
  .object({
    value: z.string(),
    label: z.string(),
    totalCountries: z.number(),
    scoredCountries: z.number(),
  })
  .strict();

export const zPeerLensBlock = z
  .object({
    factKey: z.string(),
    filterParam: z.string(),
    source: z.string(),
    sourceName: z.string(),
    description: z.string(),
    temporal: z
      .object({
        observationReferenceYear: z.number().int().nullable(),
        upstreamDatasetRelease: z.string().nullable(),
        retrievedAt: z.string().nullable(),
        civicaPublicationVersion: z.string().nullable(),
      })
      .strict(),
    values: z.array(zPeerLensValue),
  })
  .strict();

export const zPeerGroupingsData = z
  .object({
    world_bank_region: zPeerLensBlock,
    world_bank_income_group: zPeerLensBlock,
    vdem_row: zPeerLensBlock,
    cgv_regime: zPeerLensBlock,
    monarchy_status: zPeerLensBlock,
  })
  .strict();

export const zPeerGroupingsResponse = z
  .object({
    data: zPeerGroupingsData,
    meta: z
      .object({
        peerGrouping: z
          .object({
            status: z.string(),
            version: z.string(),
            versionDate: z.string(),
            methodology: z.literal(
              "https://civicaatlas.org/civica-index/methodology/peer-grouping",
            ),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * Pulse — shared building blocks
 * ──────────────────────────────────────────────────────────────── */

const zPulseVersionRef = z.discriminatedUnion("state", [
  z.object({ state: z.literal("versioned"), id: z.string() }).strict(),
  z.object({ state: z.literal("not_applicable"), reason: z.string() }).strict(),
  z
    .object({ state: z.literal("legacy_unversioned"), reason: z.string() })
    .strict(),
]);

const zPulseStageVersionEnvelope = z
  .object({
    schemaVersion: z.literal("pulse-stage-version-envelope/v1"),
    stage: z.enum([
      "ingest",
      "cluster",
      "classify",
      "corroborate",
      "review",
      "score",
    ]),
    methodology: zPulseVersionRef,
    ontology: zPulseVersionRef,
    pipeline: zPulseVersionRef,
    algorithm: zPulseVersionRef,
    prompt: zPulseVersionRef,
    sourceBasket: zPulseVersionRef,
    sourceIds: z.array(z.string()),
    models: z.array(
      z
        .object({
          role: z.enum([
            "connector",
            "embedding",
            "classify",
            "verify",
            "subject_attribution",
            "review_summary",
          ]),
          provider: z.string(),
          model: z.string(),
        })
        .strict(),
    ),
    upstreamRunIds: z.array(z.string()),
  })
  .strict();

const zPulseRunIdentity = z
  .object({
    runId: z.string(),
    versionKey: z.string(),
    versions: zPulseStageVersionEnvelope,
  })
  .strict();

const zPulseVersionSetSummary = z
  .object({
    state: z.enum(["single_version", "mixed_version", "legacy_only", "empty"]),
    versionKeys: z.array(z.string()),
    containsLegacy: z.boolean(),
    comparableAsSingleSeries: z.boolean(),
  })
  .strict();

export const zPulseDrivingEvent = z
  .object({
    id: z.string(),
    headline: z.string(),
    eventDate: z.string(),
    severityTier: z.string(),
    severityValue: z.number(),
    sources: z.array(z.string()),
  })
  .strict();

export const zPulseDimensionRow = z
  .object({
    dimension: zPulseDimension,
    delta: z.number().nullable(),
    contributingEventIds: z.array(z.string()),
    drivingEvents: z.array(zPulseDrivingEvent),
    evidence: z
      .object({
        nEvents: z.number(),
        maxConfidence: z.number(),
        minSources: z.number(),
        maxSources: z.number(),
        allSingleSource: z.boolean(),
      })
      .strict(),
    limitedSignal: z.boolean(),
    limitedReason: z.string().nullable(),
    versionIdentity: zPulseRunIdentity.nullable(),
  })
  .strict();

export const zPulseCountryPeriodObservability = z
  .object({
    schemaVersion: z.literal("pulse-observability/country-period-v1"),
    period: z
      .object({
        start: z.string(),
        end: z.string(),
        basis: z.literal("retrieval_time"),
      })
      .strict(),
    observationState: z.enum([
      "sufficient_observation",
      "low_coverage",
      "source_outage",
      "restricted_information_environment",
    ]),
    eventObservation: z.enum([
      "qualifying_event_observed",
      "no_qualifying_event_observed",
      "not_assessable",
    ]),
    stateReason: z.string(),
    evidence: z
      .object({
        operatingFeeds: z.number().int().nonnegative(),
        degradedFeeds: z.number().int().nonnegative(),
        observedFeedFamilies: z.array(z.string()),
        retainedDocuments: z.number().int().nonnegative(),
        qualifyingEvents: z.number().int().nonnegative(),
        informationEnvironment: z
          .object({
            state: z.literal("restricted"),
            sourceId: z.string(),
            sourceUrl: z.string(),
            upstreamVersion: z.string(),
            observationYear: z.number().int(),
            retrievedAt: z.string(),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    thresholds: z
      .object({
        minimumObservedFeedFamilies: z.number().int().positive(),
        minimumRetainedDocuments: z.number().int().positive(),
      })
      .strict(),
    numericEffect: z.enum(["event_evidence_only", "withheld"]),
    countryQualityInference: z.literal("prohibited"),
    limitations: z.array(z.string()),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.eventObservation === "no_qualifying_event_observed" &&
      value.observationState !== "sufficient_observation"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["eventObservation"],
        message: "no qualifying event observed requires sufficient observation",
      });
    }
    if (
      value.eventObservation === "not_assessable" &&
      value.observationState === "sufficient_observation"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["eventObservation"],
        message:
          "sufficient observation with no event must use the explicit no-event state",
      });
    }
    const hasEvent = value.evidence.qualifyingEvents > 0;
    if ((value.eventObservation === "qualifying_event_observed") !== hasEvent) {
      ctx.addIssue({
        code: "custom",
        path: ["evidence", "qualifyingEvents"],
        message: "event observation and qualifying-event count disagree",
      });
    }
    if ((value.numericEffect === "event_evidence_only") !== hasEvent) {
      ctx.addIssue({
        code: "custom",
        path: ["numericEffect"],
        message: "numeric effects require observed event evidence",
      });
    }
  });

export const zPulseInformationEnvironmentContext = z
  .object({
    schemaVersion: z.literal("pulse-information-environment-context/v1"),
    valueStatus: z.enum(["observed", "missing"]),
    score: z.number().min(0).max(100).nullable(),
    tier: z.enum(["free", "partial", "restricted"]).nullable(),
    sourceId: z.string().nullable(),
    sourceUrl: z.string().url().nullable(),
    upstreamRelease: z.string().nullable(),
    observationYear: z.number().int().nullable(),
    retrievedAt: z.string().nullable(),
    contentSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    sourceCoverage: z
      .object({
        publisherRows: z.number().int().nonnegative().nullable(),
        matchedJurisdictions: z.number().int().nonnegative().nullable(),
        supportedJurisdictions: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    rightsStatus: z.enum(["verified", "pending", "not_registered"]),
    useStatus: z.enum([
      "active_unvalidated_heuristic",
      "disabled_pending_rights_and_validation",
      "not_available",
    ]),
    missingReason: z.string().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const observedFields = [
      value.score,
      value.tier,
      value.sourceId,
      value.sourceUrl,
      value.upstreamRelease,
      value.observationYear,
      value.retrievedAt,
      value.contentSha256,
      value.sourceCoverage.publisherRows,
      value.sourceCoverage.matchedJurisdictions,
      value.sourceCoverage.supportedJurisdictions,
    ];
    const observed = value.valueStatus === "observed";
    if (observed !== observedFields.every((field) => field !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["valueStatus"],
        message:
          "observed context requires complete source, vintage, and coverage",
      });
    }
    if (!observed && observedFields.some((field) => field !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["valueStatus"],
        message: "missing context cannot contain a substituted observation",
      });
    }
    if (observed === (value.missingReason !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["missingReason"],
        message: "only missing context requires a reason",
      });
    }
  });

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/[country_slug]/dimensions
 * ──────────────────────────────────────────────────────────────── */

export const zPulseDimensionsData = z
  .object({
    jurisdiction: z
      .object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        iso3: z.string().nullable(),
      })
      .strict(),
    dimensions: z.record(z.string(), zPulseDimensionRow),
    lastComputedAt: z.string().nullable(),
    totalEvents: z.number(),
    observability: zPulseCountryPeriodObservability,
    informationEnvironmentContext: zPulseInformationEnvironmentContext,
    versionSet: zPulseVersionSetSummary,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.totalEvents !== value.observability.evidence.qualifyingEvents) {
      ctx.addIssue({
        code: "custom",
        path: ["totalEvents"],
        message: "total events and observability event count disagree",
      });
    }
    if (value.observability.evidence.qualifyingEvents === 0) {
      for (const [dimension, row] of Object.entries(value.dimensions)) {
        if (row.delta !== null) {
          ctx.addIssue({
            code: "custom",
            path: ["dimensions", dimension, "delta"],
            message:
              "a country-period without qualifying events cannot emit a numeric delta",
          });
        }
      }
    }
  });

export const zPulseDimensionsResponse = z
  .object({
    data: zPulseDimensionsData,
    meta: z.object({ methodology: zPulseMethodologyMeta }).strict(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/[country_slug]/events
 * ──────────────────────────────────────────────────────────────── */

const zPulseEvidencePublisher = z
  .object({
    schemaVersion: z.literal("pulse-raw-evidence/v1"),
    sourceId: z.string(),
    sourceFamilyId: z.string(),
    sourcePublisher: z.string(),
    sourceCanonicalUrl: z.string().url(),
    itemPublisherHost: z.string().nullable(),
    sourceType: z.enum(["specialist", "news"]),
  })
  .strict();

const zPulseEvidenceAttribution = z
  .object({
    schemaVersion: z.literal("pulse-raw-evidence/v1"),
    methodVersion: z.enum([
      "country-resolver/connector-v1",
      "legacy_unversioned",
    ]),
    status: z.enum(["resolved", "unresolved"]),
    rawCountryName: z.string().nullable(),
    jurisdictionId: z.string().nullable(),
    evidence: z.array(
      z
        .object({ kind: z.literal("source_country_label"), value: z.string() })
        .strict(),
    ),
  })
  .strict();

const zPulseEvidenceRights = z
  .object({
    schemaVersion: z.literal("pulse-raw-evidence/v1"),
    sourceId: z.string(),
    licenseId: z.string(),
    termsUrl: z.string().url(),
    reviewStatus: z.enum(["verified", "pending"]),
    reviewedAt: z.string().nullable(),
    publicExport: z.string(),
    redistributionPosture: z.string(),
    restrictions: z.array(z.string()),
  })
  .strict();

const zPulseEvidenceRetention = z
  .object({
    schemaVersion: z.literal("pulse-raw-evidence/v1"),
    captureMode: z.literal("full_internal_snapshot"),
    storedFields: z.tuple([
      z.literal("title"),
      z.literal("body"),
      z.literal("raw"),
    ]),
    storageRelation: z.literal("raw_events"),
    publicPayloadDistribution: z.literal("blocked"),
    hashAlgorithm: z.enum([
      "canonical-json/sha256-v1",
      "postgres-jsonb-text/sha256-legacy-v1",
    ]),
    linkRotProtection: z.literal("stored_payload_plus_content_hash"),
    policyReason: z.string(),
  })
  .strict();

export const zPulseEventSourceDetail = z
  .object({
    sourceId: z.string(),
    sourceType: z.string(),
    sourceName: z.string(),
    sourceUrl: z.string().url(),
    evidenceIdentity: z
      .object({
        identityKey: z.string().regex(/^pulse-evidence\/sha256:[a-f0-9]{64}$/),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        retrievedAt: z.string().datetime(),
        language: z.string().min(2),
        publisher: zPulseEvidencePublisher,
        attribution: zPulseEvidenceAttribution,
        rights: zPulseEvidenceRights,
        retention: zPulseEvidenceRetention,
      })
      .strict(),
  })
  .strict();

export const zPulsePublicationOrigin = z.enum([
  "auto",
  "human_approved",
  "human_edited",
  "human_rejected",
  "legacy_rejected_unverified",
  "queued",
]);

export const zPulseCountryEvent = z
  .object({
    id: z.string(),
    eventDate: z.string(),
    category: z.string(),
    // Loose string, not the closed `zPulseDimension` enum: the DB
    // column (`pulse_events_v2.dimension`) is untyped text, not a
    // Postgres enum, so a mismatched value would be a data-quality
    // bug to catch elsewhere, not something this contract can assume
    // away.
    dimension: z.string().nullable(),
    severityTier: z.string().nullable(),
    severityValue: z.number().nullable(),
    corroborationConfidence: z.number().nullable(),
    classifierAgreement: z.string(),
    humanReviewed: z.boolean(),
    published: z.boolean(),
    reviewStatus: z.string(),
    headline: z.string(),
    description: z.string(),
    subjectAttribution: z
      .object({
        standing: z.enum(["versioned", "legacy_projection", "unresolved"]),
        attributionVersion: z.string().nullable(),
        entityCatalogVersion: z.string().nullable(),
        entityCatalogHash: z.string().nullable(),
        aliasVersion: z.string().nullable(),
        requestedJurisdictionRole: z.enum(["primary", "affected", "unresolved"]),
        primary: z
          .object({
            jurisdictionId: z.string(),
            name: z.string(),
            iso3: z.string().nullable(),
            slug: z.string(),
            role: z.literal("primary"),
            rationale: z.string(),
            evidenceRefs: z.array(z.string()),
          })
          .strict()
          .nullable(),
        affected: z.array(
          z
            .object({
              jurisdictionId: z.string(),
              name: z.string(),
              iso3: z.string().nullable(),
              slug: z.string(),
              role: z.literal("affected"),
              rationale: z.string(),
              evidenceRefs: z.array(z.string()),
            })
            .strict(),
        ),
      })
      .strict(),
    publicationOrigin: zPulsePublicationOrigin,
    versionIdentity: z
      .object({
        classification: zPulseRunIdentity.nullable(),
        publication: zPulseRunIdentity.nullable(),
        corroboration: zPulseRunIdentity.nullable(),
      })
      .strict(),
    sources: z.array(zPulseEventSourceDetail),
  })
  .strict();

export const zPulseEventsData = z
  .object({
    jurisdiction: z
      .object({ id: z.string(), slug: z.string(), name: z.string() })
      .strict(),
    events: z.array(zPulseCountryEvent),
    versionSet: zPulseVersionSetSummary,
  })
  .strict();

export const zPulseEventsResponse = z
  .object({
    data: zPulseEventsData,
    meta: z.object({ methodology: zPulseMethodologyMeta }).strict(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/changelog/v2
 * ──────────────────────────────────────────────────────────────── */

export const zPulseClassifierRun = z
  .object({
    run: z.number(),
    temp: z.number(),
    model: z.string().optional(),
    provider: z.string().optional(),
    category: z.string(),
    dimension: z.string(),
    severityTier: z.string(),
    severityValue: z.number(),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    rationale: z.string(),
  })
  .strict();

export const zPulseChangelogRow = z
  .object({
    id: z.string(),
    eventDate: z.string(),
    country: z.object({ slug: z.string(), name: z.string() }).strict(),
    category: z.string(),
    dimension: z.string().nullable(),
    severityTier: z.string().nullable(),
    severityValue: z.number().nullable(),
    classifierAgreement: z.string(),
    classifierRuns: z.array(zPulseClassifierRun),
    corroborationConfidence: z.number(),
    legacyInformationContextPresent: z.boolean(),
    humanReviewed: z.boolean(),
    publicationOrigin: zPulsePublicationOrigin,
    published: z.boolean(),
    reviewStatus: z.string(),
    headline: z.string(),
    description: z.string(),
    aiSummary: z.string().nullable(),
    sources: z.array(z.string()),
    sourceDetail: z.array(zPulseEventSourceDetail),
    versionIdentity: z
      .object({
        classification: zPulseRunIdentity.nullable(),
        publication: zPulseRunIdentity.nullable(),
        corroboration: zPulseRunIdentity.nullable(),
      })
      .strict(),
  })
  .strict();

export const zPulseChangelogResponse = z
  .object({
    data: z.array(zPulseChangelogRow),
    meta: z
      .object({
        methodology: zPulseMethodologyMeta,
        limit: z.number(),
        offset: z.number(),
        hasMore: z.boolean(),
        versionSet: zPulseVersionSetSummary,
      })
      .strict(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/methodology
 *
 * Scope decision: this route already returns
 * `createPulseRuntimeMethodSnapshot()` verbatim — a large, deeply
 * literal-typed structure defined and exhaustively typed in
 * `src/lib/pulse/v2/runtime-contract.ts` (`PulseRuntimeMethodSnapshot`).
 * Re-typing every nested literal here would duplicate that contract
 * rather than reference it. This schema validates the top-level key
 * set strictly (catches a phantom/missing/renamed top-level section)
 * and the handful of leaf fields other endpoints' `meta.methodology`
 * blocks derive from; nested internals are typed `z.unknown()` and
 * remain governed by `PulseRuntimeMethodSnapshot` at the TypeScript
 * level, where `createPulseRuntimeMethodSnapshot()`'s return type
 * already enforces them.
 * ──────────────────────────────────────────────────────────────── */

export const zPulseMethodologySnapshot = z
  .object({
    schemaVersion: z.string(),
    methodology: z.unknown(),
    version: z.string(),
    taxonomy: z
      .object({
        version: z.string(),
        categoryCount: z.number(),
        dimensions: z.array(zPulseDimension),
      })
      .strict(),
    status: z.literal("experimental"),
    mixed_legacy_unversioned: z.literal(false),
    ledgerHistory: z.unknown(),
    evidenceIdentity: z.unknown(),
    decisionLedger: z.unknown(),
    providers: z.unknown(),
    feeds: z.unknown(),
    observability: z.unknown(),
    cadence: z.unknown(),
    clustering: z.unknown(),
    corroboration: z.unknown(),
    publicationPolicy: z.unknown(),
    numericDeltas: z.unknown(),
    evaluation: z.unknown(),
    contractHash: z.string(),
  })
  .strict();

export const zPulseMethodologyResponse = z
  .object({
    data: zPulseMethodologySnapshot,
  })
  .strict();

const zPulseClusterDistributionRow = z
  .object({
    value: z.number().int().nonnegative(),
    clusters: z.number().int().nonnegative(),
    share: z.number().min(0).max(1),
  })
  .strict();

export const zPulseClusterCoverageReport = z
  .object({
    schemaVersion: z.literal("pulse-cluster-coverage/v1"),
    releaseId: z.string(),
    releasedAt: z.string(),
    observedThrough: z.string().nullable(),
    standing: z.literal("descriptive_not_validation"),
    scope: z.string(),
    totals: z
      .object({
        rawReports: z.number().int().nonnegative(),
        clusteredReports: z.number().int().nonnegative(),
        unclusteredReports: z.number().int().nonnegative(),
        clusters: z.number().int().nonnegative(),
        multiReportClusters: z.number().int().nonnegative(),
        multiSourceClusters: z.number().int().nonnegative(),
        multiSourceFamilyClusters: z.number().int().nonnegative(),
        multilingualClusters: z.number().int().nonnegative(),
        mixedProvisionalJurisdictionClusters: z.number().int().nonnegative(),
      })
      .strict(),
    distributions: z
      .object({
        clusterSize: z.array(zPulseClusterDistributionRow),
        sourceIdsPerCluster: z.array(zPulseClusterDistributionRow),
        sourceFamiliesPerCluster: z.array(zPulseClusterDistributionRow),
        languagesPerCluster: z.array(zPulseClusterDistributionRow),
        provisionalJurisdictionsPerCluster: z.array(
          zPulseClusterDistributionRow,
        ),
      })
      .strict(),
    methodVersions: z.array(
      z
        .object({
          versionKey: z.string(),
          algorithmVersion: z.string(),
          clusters: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    limitations: z.array(z.string()),
    reportHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const zPulseClusterCoverageResponse = z
  .object({ data: zPulseClusterCoverageReport })
  .strict();

const zPulseFeedRights = z
  .object({
    sourceId: z.string(),
    licenseId: z.string(),
    termsUrl: z.string().nullable(),
    reviewStatus: z.enum(["verified", "pending", "missing"]),
    publicExport: z.string(),
    redistributionPosture: z.string(),
    restrictions: z.array(z.string()),
  })
  .strict();

const zPulseFeedCoverage = z
  .object({
    feedId: z.string(),
    connectorId: z.string(),
    sourceIds: z.array(z.string()),
    role: z.enum(["specialist", "news"]),
    state: z.enum(["operating", "degraded", "inactive"]),
    stateReason: z.string(),
    retrieval: z
      .object({
        observedRuns: z.number().int().nonnegative(),
        successfulRuns: z.number().int().nonnegative(),
        failedRuns: z.number().int().nonnegative(),
        latestAttemptAt: z.string().datetime().nullable(),
        latestOutcome: z.enum(["successful", "failed", "not_observed"]),
        latestFetched: z.number().int().nonnegative().nullable(),
        latestYield: z.number().int().nonnegative().nullable(),
        latestInserted: z.number().int().nonnegative().nullable(),
        latestSkippedDuplicate: z.number().int().nonnegative().nullable(),
        latestUnmatchedCountry: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    evidence: z
      .object({
        retainedRows: z.number().int().nonnegative(),
        lastDataAt: z.string().datetime().nullable(),
        languages: z.array(z.string()),
        observedJurisdictions: z.number().int().nonnegative(),
        jurisdictionIso3s: z.array(z.string()),
        unresolvedJurisdictionRows: z.number().int().nonnegative(),
      })
      .strict(),
    rights: z.array(zPulseFeedRights),
    activation: z.string(),
    blindSpots: z.array(z.string()),
  })
  .strict();

export const zPulseSourceCoverageReport = z
  .object({
    schemaVersion: z.literal("pulse-source-coverage/v1"),
    generatedAt: z.string().datetime(),
    standing: z.literal("operational_observability_not_retrieval_validation"),
    feeds: z.array(zPulseFeedCoverage),
    summary: z
      .object({
        operating: z.number().int().nonnegative(),
        degraded: z.number().int().nonnegative(),
        inactive: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const zPulseSourceCoverageResponse = z
  .object({ data: zPulseSourceCoverageReport })
  .strict();

/* /api/countries/[slug]/export — rights-filtered research export. */
const zDecisionTraceStep = z
  .object({
    code: z.enum([
      "row_eligibility",
      "measurement_partition",
      "source_lineage",
      "precedence_rule",
      "guard_result",
      "canonical_selection",
    ]),
    outcome: z.string(),
    detail: z.string(),
    sourceIds: z.array(z.string()),
  })
  .strict();

const zCountryExportObservation = z
  .object({
    recordClass: z.enum(["canonical", "alternate", "projection", "rejected"]),
    rowId: z.string(),
    factKey: z.string(),
    factGroup: z.string(),
    category: z.string(),
    value: z
      .object({
        text: z.string().nullable(),
        numeric: z.number().nullable(),
        structured: z.unknown().nullable(),
        unit: z.string().nullable(),
        status: z.string(),
        statusReason: z.string().nullable(),
        type: z.string(),
      })
      .strict(),
    source: z
      .object({
        id: z.string(),
        name: z.string(),
        url: z.string().url(),
        license: z.string(),
        termsUrl: z.string().url(),
        lastSyncedAt: z.string().datetime().nullable(),
      })
      .strict(),
    freshness: z
      .object({
        asOf: z.string().nullable(),
        observationYear: z.number().int().nullable(),
        dataVintageYear: z.number().int().nullable(),
        retrievedAt: z.string().datetime(),
        upstreamVintage: z.string().nullable(),
      })
      .strict(),
    lifecycle: z
      .object({ status: z.string(), reason: z.string().nullable() })
      .strict(),
    method: z
      .object({
        rowMethodologyVersion: z.string(),
        reconciliationVersion: z.literal("source-precedence/v1"),
        growthMethodology: z.string().nullable(),
      })
      .strict(),
    decision: z
      .object({ reason: z.string(), trace: z.array(zDecisionTraceStep) })
      .strict(),
    dispute: z.object({ openOrInReview: z.boolean() }).strict(),
  })
  .strict();

export const zCountryExportFact = zCountryExportObservation;

export const zCountryExportJson = z
  .object({
    schemaVersion: z.literal("country-research-export/v1"),
    generatedAt: z.string().datetime(),
    selection: z
      .object({
        mode: z.enum(["live", "vintage"]),
        asOf: z.string(),
        vintage: z.string().nullable(),
        cutoffAt: z.string().nullable(),
        retrievedThrough: z.string().nullable(),
        methodologyVersions: z.array(z.string()),
        candidateSetStatus: z.enum([
          "live",
          "complete_candidates",
          "canonical_only_legacy",
        ]),
        candidateSetChecksum: z.string().nullable(),
        winnerSetChecksum: z.string().nullable(),
        resolverVersionHash: z.string().nullable(),
      })
      .strict(),
    jurisdiction: z
      .object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        iso2: z.string().nullable(),
        iso3: z.string().nullable(),
        status: z.string(),
      })
      .strict(),
    facts: z.array(
      z
        .object({
          factKey: z.string(),
          canonical: zCountryExportObservation.refine(
            (row) => row.recordClass === "canonical",
          ),
          alternates: z.array(
            zCountryExportObservation.refine(
              (row) => row.recordClass === "alternate",
            ),
          ),
          projections: z.array(
            zCountryExportObservation.refine(
              (row) => row.recordClass === "projection",
            ),
          ),
          rejected: z.array(
            zCountryExportObservation.refine(
              (row) => row.recordClass === "rejected",
            ),
          ),
        })
        .strict(),
    ),
    withheld: z
      .object({
        factKeys: z.array(z.string()),
        observationCount: z.number().int().nonnegative(),
        reason: z.string(),
      })
      .strict(),
    rights: z
      .object({
        manifest: z.literal("/api/rights-manifest"),
        policy: z.literal("source-row-filtered"),
      })
      .strict(),
  })
  .strict();
