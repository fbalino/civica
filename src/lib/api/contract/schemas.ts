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
    last_revised: z.string(),
    reference: z.literal("https://civicaatlas.org/civica-index/methodology"),
    presentation: z
      .object({
        format: z.literal("numeric_position"),
        scale: z.object({ min: z.literal(0), max: z.literal(100) }).strict(),
        input_variation_range: z.literal("central_90_percent"),
        categorical_grades: z.literal(false),
      })
      .strict(),
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
    method_version_coverage: z.enum(["mixed_legacy_unversioned", "current"]),
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
    selection: z.object({ mode: z.enum(["live", "vintage"]), asOf: z.string(), vintage: z.string().nullable(), cutoffAt: z.string().nullable(), retrievedThrough: z.string().nullable(), methodologyVersions: z.array(z.string()) }).strict(),
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

export const zCountryDetailCivicaIndex = z
  .object({
    quarter: z.string().nullable(),
    composite: z
      .object({
        score: z.number(),
        rank: z.number().nullable(),
        totalRanked: z.number().nullable(),
        isPartial: z.boolean(),
      })
      .strict()
      .nullable(),
    dimensions: z.array(
      z
        .object({
          dimension: z.string(),
          normalizedScore: z.number().nullable(),
          rawValue: z.number().nullable(),
          valueStatus: zDataValueStatus,
        })
        .strict(),
    ),
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
    civicaIndex: zCountryDetailCivicaIndex.nullable(),
    provenance: z.record(z.string(), zApiProvenanceEntry),
    valueStatus: z.record(z.string(), zApiDataValueStatus),
  })
  .strict();

export const zCountryDetailMeta = z
  .object({
    reconciliation: zFactbookReconciliationMeta,
    methodology: zCiMethodologyMeta,
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
  completenessFlag: z.string().nullable(),
  rank: z.number().nullable(),
  totalRanked: z.number().nullable(),
  isPartial: z.boolean(),
  missingDimensions: z.array(z.string()),
  dimensionsAvailable: z.number().nullable(),
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
      .object({ methodology: zCiMethodologyMeta })
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
    meta: z.object({ methodology: zCiMethodologyMeta }).strict(),
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
    meta: z.object({ methodology: zCiMethodologyMeta }).strict(),
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
    completenessFlag: z.string().nullable(),
    vintageLabel: z.string().nullable(),
    isPartial: z.boolean(),
    missingDimensions: z.array(z.string()),
    dimensionsAvailable: z.number().nullable(),
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
    temporal: z.object({
      observationReferenceYear: z.number().int().nullable(),
      upstreamDatasetRelease: z.string().nullable(),
      retrievedAt: z.string().nullable(),
      civicaPublicationVersion: z.string().nullable(),
    }).strict(),
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
  })
  .strict();

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
    pressFreedomContext: z
      .object({
        score: z.number(),
        source: z.literal("approximate_static_2024_subset"),
        directLookup: z.boolean(),
        defaultApplied: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const zPulseDimensionsResponse = z
  .object({
    data: zPulseDimensionsData,
    meta: z.object({ methodology: zPulseMethodologyMeta }).strict(),
  })
  .strict();

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/[country_slug]/events
 * ──────────────────────────────────────────────────────────────── */

export const zPulseEventSourceDetail = z
  .object({
    sourceId: z.string(),
    sourceType: z.string(),
    sourceName: z.string(),
    sourceUrl: z.string().nullable(),
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
    publicationOrigin: zPulsePublicationOrigin,
    sources: z.array(zPulseEventSourceDetail),
  })
  .strict();

export const zPulseEventsData = z
  .object({
    jurisdiction: z
      .object({ id: z.string(), slug: z.string(), name: z.string() })
      .strict(),
    events: z.array(zPulseCountryEvent),
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
    pressFreedomScoreAtClassification: z.number().nullable(),
    humanReviewed: z.boolean(),
    publicationOrigin: zPulsePublicationOrigin,
    published: z.boolean(),
    reviewStatus: z.string(),
    headline: z.string(),
    description: z.string(),
    aiSummary: z.string().nullable(),
    sources: z.array(z.string()),
    sourceDetail: z.array(zPulseEventSourceDetail),
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
    mixed_legacy_unversioned: z.literal(true),
    ledgerHistory: z.unknown(),
    providers: z.unknown(),
    feeds: z.unknown(),
    cadence: z.unknown(),
    clustering: z.unknown(),
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

/* /api/countries/[slug]/export — rights-filtered research export. */
const zDecisionTraceStep = z.object({
  code: z.enum(["row_eligibility", "measurement_partition", "source_lineage", "precedence_rule", "guard_result", "canonical_selection"]),
  outcome: z.string(),
  detail: z.string(),
  sourceIds: z.array(z.string()),
}).strict();

const zCountryExportObservation = z
  .object({
    recordClass: z.enum(["canonical", "alternate", "projection", "rejected"]),
    rowId: z.string(), factKey: z.string(), factGroup: z.string(), category: z.string(),
    value: z.object({ text: z.string().nullable(), numeric: z.number().nullable(), structured: z.unknown().nullable(), unit: z.string().nullable(), status: z.string(), statusReason: z.string().nullable(), type: z.string() }).strict(),
    source: z.object({ id: z.string(), name: z.string(), url: z.string().url(), license: z.string(), termsUrl: z.string().url(), lastSyncedAt: z.string().datetime().nullable() }).strict(),
    freshness: z.object({ asOf: z.string().nullable(), observationYear: z.number().int().nullable(), dataVintageYear: z.number().int().nullable(), retrievedAt: z.string().datetime(), upstreamVintage: z.string().nullable() }).strict(),
    lifecycle: z.object({ status: z.string(), reason: z.string().nullable() }).strict(),
    method: z.object({ rowMethodologyVersion: z.string(), reconciliationVersion: z.literal("source-precedence/v1"), growthMethodology: z.string().nullable() }).strict(),
    decision: z.object({ reason: z.string(), trace: z.array(zDecisionTraceStep) }).strict(),
    dispute: z.object({ openOrInReview: z.boolean() }).strict(),
  })
  .strict();

export const zCountryExportFact = zCountryExportObservation;

export const zCountryExportJson = z
  .object({
    schemaVersion: z.literal("country-research-export/v1"),
    generatedAt: z.string().datetime(),
    selection: z.object({ mode: z.enum(["live", "vintage"]), asOf: z.string(), vintage: z.string().nullable(), cutoffAt: z.string().nullable(), retrievedThrough: z.string().nullable(), methodologyVersions: z.array(z.string()) }).strict(),
    jurisdiction: z.object({ id: z.string(), slug: z.string(), name: z.string(), iso2: z.string().nullable(), iso3: z.string().nullable(), status: z.string() }).strict(),
    facts: z.array(z.object({
      factKey: z.string(),
      canonical: zCountryExportObservation.refine((row) => row.recordClass === "canonical"),
      alternates: z.array(zCountryExportObservation.refine((row) => row.recordClass === "alternate")),
      projections: z.array(zCountryExportObservation.refine((row) => row.recordClass === "projection")),
      rejected: z.array(zCountryExportObservation.refine((row) => row.recordClass === "rejected")),
    }).strict()),
    withheld: z.object({ factKeys: z.array(z.string()), observationCount: z.number().int().nonnegative(), reason: z.string() }).strict(),
    rights: z.object({ manifest: z.literal("/api/rights-manifest"), policy: z.literal("source-row-filtered") }).strict(),
  })
  .strict();
