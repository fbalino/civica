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
} from "@/lib/api/deprecation";
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  CORS_HEADERS,
} from "@/lib/api/helpers";

export interface RouteParam {
  name: string;
  in: "path" | "query";
  type: string;
  description: string;
}

export interface RateLimitContract {
  max: number;
  windowMs: number;
  scope: "per-ip";
}

export interface DeprecationContract {
  /** Always the structural_family retirement today — a second
   *  deprecation would add a discriminated union here. */
  reason: "structural_family";
  sunsetIso: typeof STRUCTURAL_FAMILY_SUNSET_DATE_ISO;
  successor: typeof PEER_GROUPINGS_SUCCESSOR_HREF;
  headers: typeof STRUCTURAL_FAMILY_DEPRECATION_HEADERS;
  meta: typeof STRUCTURAL_FAMILY_DEPRECATION_META;
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
  wholeRoute,
  appliesWhen,
});

const v1RateLimit: RateLimitContract = {
  max: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  scope: "per-ip",
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
      "Paginated list of sovereign states with basic metadata. Filter by continent or by a typed peer lens: region, income, V-Dem regime, CGV regime, or monarchy status.",
    params: [
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
    errorStatuses: [429, 500],
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
      "Detailed government structure for a single country. Look up by slug, ISO 3166-1 alpha-2, or alpha-3 code.",
    params: [
      {
        name: ":code",
        in: "path",
        type: "string",
        description:
          'Country slug, ISO-2, or ISO-3 code (e.g. "us", "USA", "united-states").',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [404, 429, 500],
    deprecation: structuralFamilyDeprecation(false),
    exampleId: "countryDetail",
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
    errorStatuses: [429, 500],
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
      "Latest research-beta Civica Index composite, Monte Carlo input-variation range, rank, completeness fields, and available dimension rows for one country. No categorical country grades.",
    params: [
      {
        name: ":country_slug",
        in: "path",
        type: "string",
        description: 'Country slug, e.g. "france" or "united-states".',
      },
      {
        name: "methodology",
        in: "query",
        type: "string",
        description: 'Optional methodology version. Defaults to "beta".',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [404, 429, 500],
    deprecation: structuralFamilyDeprecation(false),
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
      "Quarter-by-quarter Civica Index composite history for one country (beta methodology): quarter, score, rank, totalRanked, isPartial.",
    params: [
      {
        name: ":country_slug",
        in: "path",
        type: "string",
        description: 'Country slug, e.g. "france".',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [404, 429, 500],
    deprecation: null,
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
      "Civica Index score distribution (count, avg/min/max/median, quartiles) grouped by government-type bucket, for the requested or latest quarter.",
    params: [
      {
        name: "quarter",
        in: "query",
        type: "string",
        description:
          'Optional quarter label such as "2026-Q1". Defaults to latest available.',
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
    errorStatuses: [429, 500],
    // Field-level deprecation only applies when ?taxonomy=structural|regime
    // is requested — see zIndexByGovernmentTypeResponse's meta union.
    deprecation: structuralFamilyDeprecation(
      false,
      "taxonomy-structural-regime",
    ),
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
      "Compares up to 10 countries on the Civica Index for a given quarter.",
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
          "Optional quarter. Defaults to each country's latest available comparison data.",
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [400, 429, 500],
    deprecation: structuralFamilyDeprecation(false),
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
      "Published Civica Index methodology version record (weights, notes, publish date). Defaults to the latest version.",
    params: [
      {
        name: "version",
        in: "query",
        type: "string",
        description:
          'Optional methodology version id, e.g. "beta". Defaults to the most recently published version.',
      },
    ],
    cors: true,
    corsHeaders: CORS_HEADERS,
    rateLimit: v1RateLimit,
    errorStatuses: [404, 429, 500],
    deprecation: null,
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
      "Civica Index rankings for the latest available quarter, or a requested quarter. Pulse is not available as a scalar ranking.",
    params: [
      {
        name: "quarter",
        in: "query",
        type: "string",
        description:
          'Optional quarter label such as "2026-Q1". Defaults to latest available.',
      },
      {
        name: "methodology",
        in: "query",
        type: "string",
        description: 'Methodology version. Defaults to "beta".',
      },
      {
        name: "sort",
        in: "query",
        type: "string",
        description:
          'Must be "ci" (the only supported value) or omitted; any other value returns 400.',
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
    errorStatuses: [400, 429, 500],
    deprecation: structuralFamilyDeprecation(false),
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
    errorStatuses: [429, 500],
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
    errorStatuses: [429, 500],
    deprecation: null,
    exampleId: "pulseMethodology",
  },
  {
    id: "pulse-dimensions",
    docSectionId: "pulse-dimensions",
    method: "GET",
    pathTemplate: "/api/v1/pulse/:country_slug/dimensions",
    filePath: "src/app/api/v1/pulse/[country_slug]/dimensions/route.ts",
    versioned: true,
    summary:
      "Public experimental per-dimension Pulse deltas for one country, their evidence qualifiers, and driving published events. No scalar Pulse score.",
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
    errorStatuses: [404, 429, 500],
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
    errorStatuses: [404, 429, 500],
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
    errorStatuses: [429, 500],
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
      "Returns 503 while the former mixed-source country download is withheld for source/field rights closure. DAT-027 owns its rights-filtered per-country replacement.",
    params: [
      {
        name: ":slug",
        in: "path",
        type: "string",
        description: 'Country slug, e.g. "france" or "united-states".',
      },
    ],
    cors: false,
    corsHeaders: null,
    rateLimit: null,
    errorStatuses: [503],
    deprecation: null,
    exampleId: "countryExport",
  },
];

export function getRouteContract(id: string): RouteContract {
  const route = API_ROUTES.find((r) => r.id === id);
  if (!route) throw new Error(`Unknown route contract id: ${id}`);
  return route;
}
