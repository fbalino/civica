/**
 * CLM-012 — canonical inventory of every public `/api/v1/*` GET route
 * plus the bulk `/api/countries/:slug/export` route.
 *
 * `src/app/api-docs/page.tsx` renders its Endpoints section FROM this
 * array (path, params, CORS/rate-limit prose, deprecation notices) —
 * it does not hand-maintain a second copy. `scripts/validate-api-docs.ts`
 * walks the filesystem under `src/app/api/v1` + the export route and
 * fails the build if a live route is missing from this registry
 * (phantom route) or if an entry here has no matching route.ts file
 * (uncontracted/stale entry).
 *
 * Deprecation headers/meta/dates are imported from
 * `src/lib/api/deprecation.ts` — never retyped.
 */

import {
  STRUCTURAL_FAMILY_DEPRECATION_HEADERS,
  STRUCTURAL_FAMILY_DEPRECATION_META,
  STRUCTURAL_FAMILY_SUNSET_DATE_ISO,
  PEER_GROUPINGS_SUCCESSOR_HREF,
  INDEX_COMPOSITE_DEPRECATION_HEADERS,
  INDEX_COMPOSITE_DEPRECATION_META,
  INDEX_COMPOSITE_SUNSET_DATE_ISO,
  INDEX_DISPOSITION_SUCCESSOR_HREF,
} from "@/lib/api/deprecation";
import { CORS_HEADERS } from "@/lib/api/helpers";
import {
  EXPORT_RATE_LIMIT_MAX,
  EXPORT_RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_EXCEEDED_STATUS,
  RATE_LIMIT_STORE_UNAVAILABLE_STATUS,
  V1_RATE_LIMIT_MAX,
  V1_RATE_LIMIT_WINDOW_MS,
} from "@/lib/api/contract/rate-limits";

export interface RouteParam {
  name: string;
  in: "path" | "query";
  type: string;
  description: string;
}

export interface RateLimitContract {
  max: number;
  windowMs: number;
  scope: "per-validated-client-identity";
  backend: "postgres";
  countedMethods: readonly ["GET"];
  exceededStatus: typeof RATE_LIMIT_EXCEEDED_STATUS;
  storeUnavailableStatus: typeof RATE_LIMIT_STORE_UNAVAILABLE_STATUS;
}

export interface DeprecationEntryContract {
  identifier: string;
  kind: string;
  sunset: string;
  successor: string;
  replacedBy: readonly string[];
  reason: string;
}

export interface DeprecationContract {
  reason: "structural_family" | "index_public_disposition";
  sunsetIso: string;
  successor: string;
  headers: Record<string, string>;
  meta: { deprecations: readonly DeprecationEntryContract[] };
  helperName:
    "withStructuralFamilyDeprecation" | "withIndexDispositionDeprecation";
  /** True when the ENTIRE route is deprecated (government-types);
   *  false when only a subset of its fields/filters are (countries,
   *  index/*). Drives whether api-docs renders a full "deprecated
   *  endpoint" banner vs. a field-level note. */
  wholeRoute: boolean;
  /** Whether the signal applies to every response or only requests
   * using the retired taxonomy values. */
  appliesWhen: "always" | "taxonomy-structural-regime";
}

export interface RouteContract {
  id: string;
  /** Anchor id in api-docs/page.tsx's ReaderSidebar SECTIONS + the
   *  EndpointSection this route renders under. */
  docSectionId: string;
  method: "GET";
  pathTemplate: string;
  /** Repo-relative path to the route handler, checked to exist by
   *  scripts/validate-api-docs.ts. */
  filePath: string;
  versioned: boolean;
  summary: string;
  params: RouteParam[];
  cors: boolean;
  corsHeaders: typeof CORS_HEADERS | null;
  rateLimit: RateLimitContract | null;
  errorStatuses: number[];
  deprecation: DeprecationContract | null;
  /** Key into contract/examples.ts's EXAMPLES map. */
  exampleId: string;
}

const structuralFamilyDeprecation = (
  wholeRoute: boolean,
  appliesWhen: DeprecationContract["appliesWhen"] = "always",
): DeprecationContract => ({
  reason: "structural_family",
  sunsetIso: STRUCTURAL_FAMILY_SUNSET_DATE_ISO,
  successor: PEER_GROUPINGS_SUCCESSOR_HREF,
  headers: STRUCTURAL_FAMILY_DEPRECATION_HEADERS,
  meta: STRUCTURAL_FAMILY_DEPRECATION_META,
  helperName: "withStructuralFamilyDeprecation",
  wholeRoute,
  appliesWhen,
});

const indexDispositionDeprecation = (): DeprecationContract => ({
  reason: "index_public_disposition",
  sunsetIso: INDEX_COMPOSITE_SUNSET_DATE_ISO,
  successor: INDEX_DISPOSITION_SUCCESSOR_HREF,
  headers: INDEX_COMPOSITE_DEPRECATION_HEADERS,
  meta: INDEX_COMPOSITE_DEPRECATION_META,
  helperName: "withIndexDispositionDeprecation",
  wholeRoute: true,
  appliesWhen: "always",
});

const v1RateLimit: RateLimitContract = {
  max: V1_RATE_LIMIT_MAX,
  windowMs: V1_RATE_LIMIT_WINDOW_MS,
  scope: "per-validated-client-identity",
  backend: "postgres",
  countedMethods: ["GET"],
  exceededStatus: RATE_LIMIT_EXCEEDED_STATUS,
  storeUnavailableStatus: RATE_LIMIT_STORE_UNAVAILABLE_STATUS,
};

const exportRateLimit: RateLimitContract = {
  max: EXPORT_RATE_LIMIT_MAX,
  windowMs: EXPORT_RATE_LIMIT_WINDOW_MS,
  scope: "per-validated-client-identity",
  backend: "postgres",
  countedMethods: ["GET"],
  exceededStatus: RATE_LIMIT_EXCEEDED_STATUS,
  storeUnavailableStatus: RATE_LIMIT_STORE_UNAVAILABLE_STATUS,
};

export const API_ROUTES: RouteContract[] = [
  {
    id: "countries",
    docSectionId: "countries",
    method: "GET",
    pathTemplate: "/api/v1/countries",
    filePath: "src/app/api/v1/countries/route.ts",
    versioned: true,
    summary:
      "Paginated list of the sourced Atlas jurisdiction catalog, including status labels, notes, and sources. Filter by jurisdiction status, continent, or a typed peer lens.",
    params: [
      {
        name: "as_of",
        in: "query",
        type: "string",
        description:
          'Required: "live" or a complete immutable Civica Atlas vintage label.',
      },
      {
        name: "status",
        in: "query",
        type: "string",
        description:
          "Optional jurisdiction-status/v1 class: sovereign_state | associated_state | dependency_or_territory | disputed_or_limited_recognition | aggregate_or_special_area.",
      },
      {
        name: "continent",
        in: "query",
        type: "string",
        description: 'Filter by continent (e.g. "Africa", "Europe").',
      },
      {
        name: "taxonomy",
        in: "query",
        type: "string",
        description:
          "Filter lens. Accepts: raw | region | income | vdem | cgv | monarchy (plus the deprecated structural | regime, sunset below). When non-raw, pair with government_type.",
      },
      {
        name: "government_type",
        in: "query",
        type: "string",
        description:
          'Lens value. With taxonomy=region: "Sub-Saharan Africa". With taxonomy=vdem: "Liberal Democracy". With taxonomy=raw: partial match against the CIA prose. See /api/v1/peer-groupings for the full value list per lens.',
      },
      {
        name: "limit",
        in: "query",
        type: "integer",
        description: "Results per page (default 50, max 250).",
      },
      {
        name: "offset",
        in: "query",
        type: "integer",
        description: "Number of results to skip (default 0).",
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [400, 429, 500, 503],
    deprecation: structuralFamilyDeprecation(false),
    exampleId: "countries",
  },
  {
    id: "country-detail",
    docSectionId: "country-detail",
    method: "GET",
    pathTemplate: "/api/v1/countries/:code",
    filePath: "src/app/api/v1/countries/[code]/route.ts",
    versioned: true,
    summary:
      "Detailed government structure and sourced status for a single Atlas jurisdiction. Look up by slug or an available ISO alpha-2/alpha-3 code.",
    params: [
      {
        name: ":code",
        in: "path",
        type: "string",
        description:
          'Jurisdiction slug, ISO-2, or ISO-3 code when assigned (e.g. "us", "USA", "united-states", "puerto-rico").',
      },
      {
        name: "as_of",
        in: "query",
        type: "string",
        description:
          'Required: "live" or a complete immutable Civica Atlas vintage label.',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [400, 404, 429, 500, 503],
    deprecation: structuralFamilyDeprecation(false),
    exampleId: "countryDetail",
  },
  {
    id: "elections",
    docSectionId: "elections",
    method: "GET",
    pathTemplate: "/api/v1/elections",
    filePath: "src/app/api/v1/elections/route.ts",
    versioned: true,
    summary:
      "Qualified election research rows with date-only semantics and source provenance. JSON and CSV emit only verified CC0 Wikidata rows; IPU, IDEA, and derived projections are reported as withheld counts.",
    params: [
      {
        name: "format",
        in: "query",
        type: "string",
        description: '"json" (default) or "csv".',
      },
      {
        name: "jurisdiction",
        in: "query",
        type: "string",
        description: "Filter by slug, ISO-2, or ISO-3.",
      },
      {
        name: "type",
        in: "query",
        type: "string",
        description: "legislative | presidential",
      },
      {
        name: "temporal_class",
        in: "query",
        type: "string",
        description: "historical | source_dated_upcoming | projection_due",
      },
      {
        name: "source_status",
        in: "query",
        type: "string",
        description: "held | source_dated | tentative | unknown",
      },
      {
        name: "jurisdiction_status",
        in: "query",
        type: "string",
        description: "Filter by jurisdiction-status/v1 class.",
      },
      {
        name: "from",
        in: "query",
        type: "date",
        description: "Inclusive YYYY-MM-DD lower bound.",
      },
      {
        name: "to",
        in: "query",
        type: "date",
        description: "Inclusive YYYY-MM-DD upper bound.",
      },
      {
        name: "has_results",
        in: "query",
        type: "boolean",
        description:
          "Filter the qualified pre-rights corpus by compiled-results availability.",
      },
      {
        name: "has_turnout",
        in: "query",
        type: "boolean",
        description:
          "Filter the qualified pre-rights corpus by sourced-turnout availability.",
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [400, 429, 500, 503],
    deprecation: null,
    exampleId: "elections",
  },
  {
    id: "government-types",
    docSectionId: "government-types",
    method: "GET",
    pathTemplate: "/api/v1/government-types",
    filePath: "src/app/api/v1/government-types/route.ts",
    versioned: true,
    summary:
      "DEPRECATED — retired structural_family taxonomy grouped by government type. Use /api/v1/peer-groupings instead.",
    params: [],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [429, 500, 503],
    deprecation: structuralFamilyDeprecation(true),
    exampleId: "governmentTypes",
  },
  {
    id: "index-country",
    docSectionId: "index-country",
    method: "GET",
    pathTemplate: "/api/v1/index/:country_slug",
    filePath: "src/app/api/v1/index/[country_slug]/route.ts",
    versioned: true,
    summary:
      "DEPRECATED — preserved research endpoint for the former public composite. The source-native Governance Evidence Dashboard is the selected public product.",
    params: [
      {
        name: ":country_slug",
        in: "path",
        type: "string",
        description: 'Country slug, e.g. "france" or "united-states".',
      },
      {
        name: "release",
        in: "query",
        type: "string",
        description:
          'Exact closed release id. Defaults to "ci-beta-r5-2024-Q4".',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [404, 429, 500, 503],
    deprecation: indexDispositionDeprecation(),
    exampleId: "indexCountry",
  },
  {
    id: "index-history",
    docSectionId: "index-history",
    method: "GET",
    pathTemplate: "/api/v1/index/:country_slug/history",
    filePath: "src/app/api/v1/index/[country_slug]/history/route.ts",
    versioned: true,
    summary:
      "DEPRECATED — preserved quarterly composite research history; not a selected public measurement product.",
    params: [
      {
        name: ":country_slug",
        in: "path",
        type: "string",
        description: 'Country slug, e.g. "france".',
      },
      {
        name: "release",
        in: "query",
        type: "string",
        description:
          'Exact closed release id. Defaults to "ci-beta-r5-2024-Q4".',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [404, 429, 500, 503],
    deprecation: indexDispositionDeprecation(),
    exampleId: "indexHistory",
  },
  {
    id: "index-by-government-type",
    docSectionId: "index-by-government-type",
    method: "GET",
    pathTemplate: "/api/v1/index/by-government-type",
    filePath: "src/app/api/v1/index/by-government-type/route.ts",
    versioned: true,
    summary:
      "DEPRECATED — preserved composite-by-government-type research analysis; source-native comparison is the selected public product.",
    params: [
      {
        name: "quarter",
        in: "query",
        type: "string",
        description:
          "Optional assertion that must equal the selected release quarter.",
      },
      {
        name: "release",
        in: "query",
        type: "string",
        description:
          'Exact closed release id. Defaults to "ci-beta-r5-2024-Q4".',
      },
      {
        name: "taxonomy",
        in: "query",
        type: "string",
        description:
          "Grouping lens. Defaults to raw (CIA prose text). structural | regime are deprecated (sunset below) — group with /api/v1/peer-groupings' filterParam values instead.",
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [429, 500, 503],
    // Field-level deprecation only applies when ?taxonomy=structural|regime
    // is requested — see zIndexByGovernmentTypeResponse's meta union.
    deprecation: indexDispositionDeprecation(),
    exampleId: "indexByGovernmentType",
  },
  {
    id: "index-compare",
    docSectionId: "index-compare",
    method: "GET",
    pathTemplate: "/api/v1/index/compare",
    filePath: "src/app/api/v1/index/compare/route.ts",
    versioned: true,
    summary:
      "DEPRECATED — preserved composite comparison endpoint. Use the source-native Governance Evidence Dashboard.",
    params: [
      {
        name: "slug",
        in: "query",
        type: "string[]",
        description:
          'Repeatable country slug, e.g. "?slug=france&slug=germany". Required.',
      },
      {
        name: "quarter",
        in: "query",
        type: "string",
        description:
          "Optional assertion that must equal the selected release quarter.",
      },
      {
        name: "release",
        in: "query",
        type: "string",
        description:
          'Exact closed release id. Defaults to "ci-beta-r5-2024-Q4".',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [400, 429, 500, 503],
    deprecation: indexDispositionDeprecation(),
    exampleId: "indexCompare",
  },
  {
    id: "index-methodology",
    docSectionId: "index-methodology",
    method: "GET",
    pathTemplate: "/api/v1/index/methodology",
    filePath: "src/app/api/v1/index/methodology/route.ts",
    versioned: true,
    summary:
      "DEPRECATED — preserved composite methodology record. The current disposition and research evidence are published on the methodology page.",
    params: [
      {
        name: "release",
        in: "query",
        type: "string",
        description:
          'Exact closed release id. Defaults to "ci-beta-r5-2024-Q4". This is the canonical selector.',
      },
      {
        name: "version",
        in: "query",
        type: "string",
        description:
          'Compatibility alias for an unambiguous methodology version, e.g. "beta-r4". Use release when corrections share a methodology and period.',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [400, 404, 429, 500, 503],
    deprecation: indexDispositionDeprecation(),
    exampleId: "indexMethodology",
  },
  {
    id: "index-rankings",
    docSectionId: "index-rankings",
    method: "GET",
    pathTemplate: "/api/v1/index/rankings",
    filePath: "src/app/api/v1/index/rankings/route.ts",
    versioned: true,
    summary:
      "DEPRECATED — preserved composite ranking endpoint. The retired scalar Pulse sort value returns 410; Pulse is available only as named per-dimension experimental deltas.",
    params: [
      {
        name: "quarter",
        in: "query",
        type: "string",
        description:
          "Optional assertion that must equal the selected release quarter.",
      },
      {
        name: "release",
        in: "query",
        type: "string",
        description:
          'Exact closed release id. Defaults to "ci-beta-r5-2024-Q4".',
      },
      {
        name: "sort",
        in: "query",
        type: "string",
        description:
          'Omit or use "ci" for the preserved Index ranking. The retired "cp" value (case-insensitive) returns 410 with a link to the per-country dimensional successor; any other value returns 400.',
      },
      {
        name: "continent",
        in: "query",
        type: "string",
        description: 'Filter by continent (e.g. "Europe").',
      },
      {
        name: "taxonomy",
        in: "query",
        type: "string",
        description:
          "Filter lens. Accepts: raw | region | income | vdem | cgv | monarchy (plus the deprecated structural | regime).",
      },
      {
        name: "government_type",
        in: "query",
        type: "string",
        description:
          "Lens value — see /api/v1/countries's parameter of the same name.",
      },
      {
        name: "limit",
        in: "query",
        type: "integer",
        description: "Pagination page size. Defaults to 50, caps at 250.",
      },
      {
        name: "offset",
        in: "query",
        type: "integer",
        description: "Pagination offset.",
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [400, 410, 429, 500, 503],
    deprecation: indexDispositionDeprecation(),
    exampleId: "indexRankings",
  },
  {
    id: "peer-groupings",
    docSectionId: "peer-groupings",
    method: "GET",
    pathTemplate: "/api/v1/peer-groupings",
    filePath: "src/app/api/v1/peer-groupings/route.ts",
    versioned: true,
    summary:
      "Four domain-specific peer-grouping lenses (World Bank region, World Bank income group, V-Dem RoW, BR/CGV regime) plus monarchy_status descriptive metadata. Successor to /api/v1/government-types.",
    params: [],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [429, 500, 503],
    deprecation: null,
    exampleId: "peerGroupings",
  },
  {
    id: "pulse-methodology",
    docSectionId: "pulse-methodology",
    method: "GET",
    pathTemplate: "/api/v1/pulse/methodology",
    filePath: "src/app/api/v1/pulse/methodology/route.ts",
    versioned: true,
    // PUBLIC_CLAIM: api.pulse-runtime-contract
    summary:
      "Returns the generated, machine-readable contract for the Pulse method currently scheduled in production. It distinguishes current runtime behavior from mixed older ledger rows.",
    params: [],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [429, 500, 503],
    deprecation: null,
    exampleId: "pulseMethodology",
  },
  {
    id: "pulse-cluster-coverage",
    docSectionId: "pulse-cluster-coverage",
    method: "GET",
    pathTemplate: "/api/v1/pulse/cluster-coverage",
    filePath: "src/app/api/v1/pulse/cluster-coverage/route.ts",
    versioned: true,
    summary:
      "Returns the frozen descriptive release of stored Pulse cluster-size, source, source-family, language, provisional-jurisdiction, and method-version distributions. It is not an accuracy result.",
    params: [],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [429, 500, 503],
    deprecation: null,
    exampleId: "pulseClusterCoverage",
  },
  {
    id: "pulse-source-coverage",
    docSectionId: "pulse-source-coverage",
    method: "GET",
    pathTemplate: "/api/v1/pulse/source-coverage",
    filePath: "src/app/api/v1/pulse/source-coverage/route.ts",
    versioned: true,
    summary:
      "Returns live Pulse connector outcomes, row yield, retained evidence times, observed language and jurisdiction scope, source rights, and blind spots. Stub and gated feeds remain inactive.",
    params: [],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [429, 500, 503],
    deprecation: null,
    exampleId: "pulseSourceCoverage",
  },
  {
    id: "pulse-dimensions",
    docSectionId: "pulse-dimensions",
    method: "GET",
    pathTemplate: "/api/v1/pulse/:country_slug/dimensions",
    filePath: "src/app/api/v1/pulse/[country_slug]/dimensions/route.ts",
    versioned: true,
    summary:
      "Public experimental per-dimension Pulse deltas from one immutable score-run publication, with release-checked evidence, separately labeled live context, and a country-period observability verdict. No scalar Pulse score; absent events never become stability evidence.",
    params: [
      {
        name: ":country_slug",
        in: "path",
        type: "string",
        description: 'Country slug, e.g. "brazil".',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [404, 429, 500, 503],
    deprecation: null,
    exampleId: "pulseDimensions",
  },
  {
    id: "pulse-events",
    docSectionId: "pulse-events",
    method: "GET",
    pathTemplate: "/api/v1/pulse/:country_slug/events",
    filePath: "src/app/api/v1/pulse/[country_slug]/events/route.ts",
    versioned: true,
    summary:
      "Published and review-queued ledger rows for one country with source attribution, review state, and whether publication followed human review.",
    params: [
      {
        name: ":country_slug",
        in: "path",
        type: "string",
        description: 'Country slug, e.g. "brazil".',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [404, 429, 500, 503],
    deprecation: null,
    exampleId: "pulseEvents",
  },
  {
    id: "pulse-changelog-v2",
    docSectionId: "pulse-changelog-v2",
    method: "GET",
    pathTemplate: "/api/v1/pulse/changelog/v2",
    filePath: "src/app/api/v1/pulse/changelog/v2/route.ts",
    versioned: true,
    summary:
      "Pulse event ledger with category, dimension, severity, sources, publication origin, and review state. Not a stream of per-event deltas; includes mixed older classifier generations.",
    params: [
      {
        name: "country",
        in: "query",
        type: "string",
        description: "Optional country slug filter.",
      },
      {
        name: "dimension",
        in: "query",
        type: "string",
        description: "Optional Pulse dimension filter.",
      },
      {
        name: "severity",
        in: "query",
        type: "string",
        description: "Optional severity tier filter.",
      },
      {
        name: "since",
        in: "query",
        type: "YYYY-MM-DD",
        description: "Only events on or after this date.",
      },
      {
        name: "published_only",
        in: "query",
        type: "0 | 1",
        description:
          "Set to 1 to exclude events still queued for human review.",
      },
      {
        name: "limit",
        in: "query",
        type: "integer",
        description: "Page size (default 50, max 250).",
      },
      {
        name: "offset",
        in: "query",
        type: "integer",
        description: "Page offset.",
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [429, 500, 503],
    deprecation: null,
    exampleId: "pulseChangelog",
  },
  {
    id: "country-export",
    docSectionId: "country-export",
    method: "GET",
    pathTemplate: "/api/countries/:slug/export",
    filePath: "src/app/api/countries/[slug]/export/route.ts",
    versioned: false,
    summary:
      "Downloads one resolver-selected canonical observation per fact key, with separately typed alternates, projections, and rejected rows filtered by source rights.",
    params: [
      {
        name: ":slug",
        in: "path",
        type: "string",
        description: 'Country slug, e.g. "france" or "united-states".',
      },
      {
        name: "format",
        in: "query",
        type: "string",
        description: '"json" (default) or "csv".',
      },
      {
        name: "as_of",
        in: "query",
        type: "string",
        description:
          'Required: "live" or a complete immutable Civica Atlas vintage label.',
      },
    ],
    cors: false,
    corsHeaders: null,
    rateLimit: exportRateLimit,
    errorStatuses: [400, 404, 429, 500, 503],
    deprecation: null,
    exampleId: "countryExport",
  },
];

export function getRouteContract(id: string): RouteContract {
  const route = API_ROUTES.find((r) => r.id === id);
  if (!route) throw new Error(`Unknown route contract id: ${id}`);
  return route;
}
