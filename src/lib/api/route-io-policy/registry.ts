import {
  ROUTE_INVENTORY,
  type HttpMethod,
  type RouteExposure,
} from "@/lib/api/route-inventory/registry";

/**
 * PLT-012 — closed request/response/content policy for every registered
 * route-method. The grouped declarations below are intentionally exhaustive:
 * a new route or HTTP method has no default request contract and therefore
 * fails `validate:route-io-policy` until it is reviewed and placed here.
 */
export const ROUTE_IO_POLICY_VERSION = "route-io-policy/v1" as const;

export type ValidationStage =
  | "no-application-input"
  | "after-rate-limit-before-work"
  | "after-auth-before-work"
  | "after-cron-auth-before-lease";

export interface RequestContractDefinition {
  id: string;
  paramsSchemaId: string | "none";
  querySchemaId: string | "none";
  body:
    | { kind: "none" }
    | {
        kind: "json" | "form" | "json-or-form";
        maxBytes: number;
        schemaId: string;
      };
  headerSchemaId: string | "auth-boundary" | "none";
  unknownQuery: "reject" | "none";
  duplicateScalars: "reject" | "none";
  validationStage: ValidationStage;
}

export interface RequestContractMapping {
  contract: RequestContractDefinition;
  endpoints: ReadonlyArray<{
    filePath: string;
    methods: readonly HttpMethod[];
  }>;
}

const none = { kind: "none" } as const;

function noInput(id: string): RequestContractDefinition {
  return {
    id,
    paramsSchemaId: "none",
    querySchemaId: "none",
    body: none,
    headerSchemaId: "none",
    unknownQuery: "none",
    duplicateScalars: "none",
    validationStage: "no-application-input",
  };
}

function queryContract(
  id: string,
  options: {
    params?: string;
    query: string;
    stage?: ValidationStage;
    header?: string | "auth-boundary";
  },
): RequestContractDefinition {
  return {
    id,
    paramsSchemaId: options.params ?? "none",
    querySchemaId: options.query,
    body: none,
    headerSchemaId: options.header ?? "none",
    unknownQuery: "reject",
    duplicateScalars: "reject",
    validationStage: options.stage ?? "after-rate-limit-before-work",
  };
}

function pathContract(
  id: string,
  paramsSchemaId: string,
  stage: ValidationStage = "after-rate-limit-before-work",
): RequestContractDefinition {
  return {
    id,
    paramsSchemaId,
    querySchemaId: "none",
    body: none,
    headerSchemaId: "none",
    unknownQuery: "none",
    duplicateScalars: "none",
    validationStage: stage,
  };
}

function bodyContract(
  id: string,
  options: {
    params?: string;
    bodyKind: "json" | "form" | "json-or-form";
    maxBytes: number;
    schema: string;
    stage: ValidationStage;
    header?: string | "auth-boundary";
  },
): RequestContractDefinition {
  return {
    id,
    paramsSchemaId: options.params ?? "none",
    querySchemaId: "none",
    body: {
      kind: options.bodyKind,
      maxBytes: options.maxBytes,
      schemaId: options.schema,
    },
    headerSchemaId: options.header ?? "none",
    unknownQuery: "none",
    duplicateScalars: "reject",
    validationStage: options.stage,
  };
}

function endpoint(
  filePath: string,
  methods: readonly HttpMethod[],
): RequestContractMapping["endpoints"][number] {
  return { filePath, methods };
}

const V1_OPTIONS_ROUTES = [
  "api/v1/atlas/query/route.ts",
  "api/v1/conditions/route.ts",
  "api/v1/countries/[code]/route.ts",
  "api/v1/countries/route.ts",
  "api/v1/elections/route.ts",
  "api/v1/government-types/route.ts",
  "api/v1/index/[country_slug]/history/route.ts",
  "api/v1/index/[country_slug]/route.ts",
  "api/v1/index/by-government-type/route.ts",
  "api/v1/index/compare/route.ts",
  "api/v1/index/methodology/route.ts",
  "api/v1/index/rankings/route.ts",
  "api/v1/peer-groupings/route.ts",
  "api/v1/pulse/[country_slug]/dimensions/route.ts",
  "api/v1/pulse/[country_slug]/events/route.ts",
  "api/v1/pulse/changelog/v2/route.ts",
  "api/v1/pulse/cluster-coverage/route.ts",
  "api/v1/pulse/methodology/route.ts",
  "api/v1/pulse/source-coverage/route.ts",
] as const;

const DRY_RUN_CRON_ROUTES = [
  "api/cron/bills/br/route.ts",
  "api/cron/bills/ca/route.ts",
  "api/cron/bills/de/route.ts",
  "api/cron/bills/fr/route.ts",
  "api/cron/bills/uk/route.ts",
  "api/cron/bills/us/route.ts",
  "api/cron/factbook/refresh-cache/route.ts",
  "api/cron/factbook/sync-classifications/route.ts",
  "api/cron/factbook/sync-eurostat/route.ts",
  "api/cron/factbook/sync-fao-faostat/route.ts",
  "api/cron/factbook/sync-ibge-br/route.ts",
  "api/cron/factbook/sync-ilo-ilostat/route.ts",
  "api/cron/factbook/sync-imf-weo/route.ts",
  "api/cron/factbook/sync-insee-fr/route.ts",
  "api/cron/factbook/sync-oecd-stat/route.ts",
  "api/cron/factbook/sync-officeholders/route.ts",
  "api/cron/factbook/sync-ons-uk/route.ts",
  "api/cron/factbook/sync-statcan-ca/route.ts",
  "api/cron/factbook/sync-stats-sa/route.ts",
  "api/cron/factbook/sync-un-data/route.ts",
  "api/cron/factbook/sync-undp-hdi/route.ts",
  "api/cron/factbook/sync-unesco-uis/route.ts",
  "api/cron/factbook/sync-us-census/route.ts",
  "api/cron/factbook/sync-wdi/route.ts",
  "api/cron/factbook/sync-who-gho/route.ts",
  "api/cron/factbook/sync-wikidata/route.ts",
  "api/cron/operations/error-alerts/route.ts",
  "api/cron/operations/health-alerts/route.ts",
  "api/cron/operations/pipeline-alerts/route.ts",
  "api/cron/factbook/sync-wto-stats/route.ts",
  "api/cron/pulse/v2/classify/route.ts",
  "api/cron/pulse/v2/cluster/route.ts",
  "api/cron/pulse/v2/ingest/route.ts",
  "api/cron/pulse/v2/review-sla/route.ts",
  "api/cron/pulse/v2/score/route.ts",
] as const;

const ACTIVE_CRON_METHODS = ["GET", "POST"] as const;

export const REQUEST_CONTRACT_MAPPINGS: readonly RequestContractMapping[] = [
  {
    contract: noInput("no-input/cors-v1"),
    endpoints: [
      ...V1_OPTIONS_ROUTES.map((filePath) => endpoint(filePath, ["OPTIONS"])),
      endpoint("api/contact/route.ts", ["OPTIONS"]),
      endpoint("embed/[slug]/route.ts", ["OPTIONS"]),
    ],
  },
  {
    contract: noInput("no-input/static-get-v1"),
    endpoints: [
      "api/provenance-coverage/route.ts",
      "api/reconciliation-audit/route.ts",
      "api/rights-manifest/route.ts",
      "api/source-coverage/route.ts",
      "api/health/route.ts",
      "api/v1/government-types/route.ts",
      "api/v1/peer-groupings/route.ts",
      "api/v1/pulse/cluster-coverage/route.ts",
      "api/v1/pulse/methodology/route.ts",
      "api/v1/pulse/source-coverage/route.ts",
      "downloads/civica-atlas-2026-07-11.json.gz/route.ts",
      "downloads/civica-atlas-2026-07-11.manifest.json/route.ts",
    ].map((filePath) => endpoint(filePath, ["GET"])),
  },
  {
    contract: {
      ...noInput("no-input/logout-v1"),
      headerSchemaId: "auth-boundary",
      validationStage: "after-auth-before-work",
    },
    endpoints: [
      endpoint("api/admin/session/route.ts", ["DELETE"]),
      endpoint("api/admin/sign-out/route.ts", ["POST"]),
      endpoint("api/pulse-coding/sign-out/route.ts", ["POST"]),
    ],
  },
  {
    contract: {
      ...noInput("no-input/retired-cron-v1"),
      headerSchemaId: "cron-auth/v1",
      validationStage: "after-cron-auth-before-lease",
    },
    endpoints: [
      "api/cron/pulse/ingest/route.ts",
      "api/cron/pulse/classify/route.ts",
      "api/cron/pulse/calculate/route.ts",
    ].map((filePath) => endpoint(filePath, ACTIVE_CRON_METHODS)),
  },
  {
    contract: queryContract("cron/dry-run-v1", {
      query: "cron-dry-run-query/v1",
      header: "cron-idempotency/v1",
      stage: "after-cron-auth-before-lease",
    }),
    endpoints: DRY_RUN_CRON_ROUTES.map((filePath) =>
      endpoint(filePath, ACTIVE_CRON_METHODS),
    ),
  },
  ...[
    [
      "cron/auto-resolve-v1",
      "api/cron/factbook/auto-resolve-disputes/route.ts",
      "cron-auto-resolve-query/v1",
    ],
    [
      "cron/snapshot-vintage-v1",
      "api/cron/factbook/snapshot-vintage/route.ts",
      "cron-snapshot-vintage-query/v1",
    ],
    [
      "cron/cia-shard-v1",
      "api/cron/factbook/sync-cia-cabinets/route.ts",
      "cron-cia-shard-query/v1",
    ],
    [
      "cron/verify-reconciliation-v1",
      "api/cron/factbook/verify-reconciliation/route.ts",
      "cron-verify-reconciliation-query/v1",
    ],
  ].map(([id, filePath, query]) => ({
    contract: queryContract(id, {
      query,
      header: "cron-idempotency/v1",
      stage: "after-cron-auth-before-lease",
    }),
    endpoints: [endpoint(filePath, ACTIVE_CRON_METHODS)],
  })),
  {
    contract: pathContract(
      "path/entity-citation-v1",
      "entity-citation-params/v1",
    ),
    endpoints: [endpoint("api/citations/[entityType]/[id]/route.ts", ["GET"])],
  },
  {
    contract: queryContract("entity-citation-history-v1", {
      params: "entity-citation-params/v1",
      query: "atlas-entity-history-query/v1",
    }),
    endpoints: [endpoint("api/citations/[entityType]/[id]/history/route.ts", ["GET"])],
  },
  {
    contract: pathContract(
      "path/constitution-passage-v1",
      "constitution-passage-params/v1",
    ),
    endpoints: [
      endpoint("api/constitution/passages/[digest]/route.ts", ["GET"]),
    ],
  },
  {
    contract: pathContract(
      "path/jurisdiction-slug-v1",
      "jurisdiction-slug-params/v1",
    ),
    endpoints: [
      "api/countries/[slug]/bills/route.ts",
      "api/countries/[slug]/constitution/route.ts",
      "api/countries/[slug]/democracy/route.ts",
      "api/countries/[slug]/international/route.ts",
      "api/countries/[slug]/leaders/route.ts",
      "api/countries/[slug]/scores/route.ts",
      "api/countries/[slug]/structure/route.ts",
    ].map((filePath) => endpoint(filePath, ["GET"])),
  },
  {
    contract: pathContract(
      "path/study-uuid-v1",
      "pulse-study-uuid-params/v1",
      "after-auth-before-work",
    ),
    endpoints: [
      endpoint("api/pulse-coding/exports/[studyId]/route.ts", ["GET"]),
    ],
  },
  {
    contract: pathContract(
      "path/pulse-country-v1",
      "pulse-country-slug-params/v1",
    ),
    endpoints: [
      endpoint("api/v1/pulse/[country_slug]/dimensions/route.ts", ["GET"]),
      endpoint("api/v1/pulse/[country_slug]/events/route.ts", ["GET"]),
    ],
  },
  {
    contract: pathContract("path/embed-slug-v1", "embed-slug-params/v1"),
    endpoints: [endpoint("embed/[slug]/route.ts", ["GET"])],
  },
  ...[
    [
      "admin/advisory-queue-v1",
      "api/admin/advisory-applications/route.ts",
      "admin-advisory-queue-query/v1",
      undefined,
      "after-auth-before-work",
    ],
    [
      "admin/contact-queue-v1",
      "api/admin/contact/route.ts",
      "admin-contact-queue-query/v1",
      undefined,
      "after-auth-before-work",
    ],
    [
      "oauth/callback-v1",
      "api/admin/google/callback/route.ts",
      "oauth-callback-query/v1",
      undefined,
      "after-rate-limit-before-work",
    ],
    [
      "oauth/start-v1",
      "api/admin/google/start/route.ts",
      "oauth-start-query/v1",
      undefined,
      "after-rate-limit-before-work",
    ],
    [
      "constitution/notable-v1",
      "api/constitution/excerpts/notable/route.ts",
      "constitution-notable-query/v1",
    ],
    [
      "constitution/excerpts-v1",
      "api/constitution/excerpts/route.ts",
      "constitution-excerpts-query/v1",
    ],
    [
      "constitution/search-v1",
      "api/constitution/search/route.ts",
      "constitution-search-query/v1",
    ],
    [
      "export/country-v1",
      "api/countries/[slug]/export/route.ts",
      "country-export-query/v1",
      "jurisdiction-slug-params/v1",
    ],
    [
      "export/indicator-history-v1",
      "api/countries/[slug]/indicator-history/route.ts",
      "indicator-history-query/v1",
      "jurisdiction-slug-params/v1",
    ],
    [
      "export/governance-evidence-v1",
      "api/governance-evidence/[slug]/route.ts",
      "governance-evidence-query/v1",
      "jurisdiction-slug-params/v1",
    ],
    [
      "metrics/strip-v1",
      "api/metrics/[metricId]/strip-data/route.ts",
      "metric-strip-query/v1",
      "metric-id-params/v1",
    ],
    [
      "v1/country-detail-v1",
      "api/v1/countries/[code]/route.ts",
      "v1-country-detail-query/v1",
      "v1-country-code-params/v1",
    ],
    ["v1/countries-v1", "api/v1/countries/route.ts", "v1-countries-query/v1"],
    [
      "v1/atlas-query-v1",
      "api/v1/atlas/query/route.ts",
      "v1-atlas-query/v1",
    ],
    ["v1/conditions-v1", "api/v1/conditions/route.ts", "v1-conditions-query/v1"],
    ["v1/elections-v1", "api/v1/elections/route.ts", "v1-elections-query/v1"],
    [
      "v1/index-history-v1",
      "api/v1/index/[country_slug]/history/route.ts",
      "v1-index-history-query/v1",
      "jurisdiction-slug-params/v1",
    ],
    [
      "v1/index-country-v1",
      "api/v1/index/[country_slug]/route.ts",
      "v1-index-country-query/v1",
      "jurisdiction-slug-params/v1",
    ],
    [
      "v1/index-group-v1",
      "api/v1/index/by-government-type/route.ts",
      "v1-index-group-query/v1",
    ],
    [
      "v1/index-compare-v1",
      "api/v1/index/compare/route.ts",
      "v1-index-compare-query/v1",
    ],
    [
      "v1/index-methodology-v1",
      "api/v1/index/methodology/route.ts",
      "v1-index-methodology-query/v1",
    ],
    [
      "v1/index-rankings-v1",
      "api/v1/index/rankings/route.ts",
      "v1-index-rankings-query/v1",
    ],
    [
      "v1/pulse-changelog-v1",
      "api/v1/pulse/changelog/v2/route.ts",
      "v1-pulse-changelog-query/v1",
    ],
  ].map(([id, filePath, query, params, stage]) => ({
    contract: queryContract(id as string, {
      query: query as string,
      params: params as string | undefined,
      stage:
        (stage as ValidationStage | undefined) ??
        "after-rate-limit-before-work",
    }),
    endpoints: [endpoint(filePath as string, ["GET"])],
  })),
  ...[
    [
      "admin/advisory-mutation-v1",
      "api/admin/advisory-applications/[id]/route.ts",
      "json-or-form",
      8_192,
      "admin-advisory-mutation-body/v1",
      "admin-resource-uuid-params/v1",
      "after-auth-before-work",
    ],
    [
      "admin/dispute-review-v1",
      "api/admin/data-disputes/[id]/route.ts",
      "json-or-form",
      16_384,
      "admin-dispute-review-body/v1",
      "admin-resource-uuid-params/v1",
      "after-auth-before-work",
    ],
    [
      "admin/message-status-v1",
      "api/admin/messages/[id]/route.ts",
      "json-or-form",
      8_192,
      "admin-message-status-body/v1",
      "admin-resource-uuid-params/v1",
      "after-auth-before-work",
    ],
    [
      "admin/pulse-review-v1",
      "api/admin/pulse-review/[id]/route.ts",
      "json-or-form",
      32_768,
      "admin-pulse-review-body/v1",
      "admin-resource-uuid-params/v1",
      "after-auth-before-work",
    ],
    [
      "admin/pulse-exception-v1",
      "api/admin/pulse-review/[id]/exception/route.ts",
      "form",
      16_384,
      "admin-pulse-exception-body/v1",
      "admin-resource-uuid-params/v1",
      "after-auth-before-work",
    ],
    [
      "admin/login-v1",
      "api/admin/session/route.ts",
      "json-or-form",
      8_192,
      "admin-login-body/v1",
      undefined,
      "after-rate-limit-before-work",
    ],
    [
      "public/advisory-v1",
      "api/advisory-applications/route.ts",
      "json",
      16_384,
      "public-advisory-body/v1",
      undefined,
      "after-rate-limit-before-work",
    ],
    [
      "public/chat-v1",
      "api/chat/route.ts",
      "json",
      16_384,
      "public-chat-body/v1",
      undefined,
      "after-rate-limit-before-work",
    ],
    [
      "public/correction-v1",
      "api/civica-index/corrections/route.ts",
      "json",
      16_384,
      "public-correction-body/v1",
      undefined,
      "after-rate-limit-before-work",
    ],
    [
      "public/contact-v1",
      "api/contact/route.ts",
      "json",
      8_192,
      "public-contact-body/v1",
      undefined,
      "after-rate-limit-before-work",
    ],
    [
      "public/client-error-monitoring-v1",
      "api/observability/client-error/route.ts",
      "json",
      1_024,
      "client-error-monitoring-body/v1",
      undefined,
      "after-rate-limit-before-work",
    ],
    [
      "pulse/adjudication-v1",
      "api/pulse-coding/adjudications/[assignmentId]/route.ts",
      "json",
      262_144,
      "pulse-adjudication-body/v1",
      "pulse-assignment-uuid-params/v1",
      "after-auth-before-work",
      "pulse-idempotency/v1",
    ],
    [
      "pulse/participant-v1",
      "api/pulse-coding/admin/participants/route.ts",
      "json",
      8_192,
      "pulse-participant-body/v1",
      undefined,
      "after-auth-before-work",
    ],
    [
      "pulse/assignment-v1",
      "api/pulse-coding/assignments/[id]/route.ts",
      "json",
      262_144,
      "pulse-assignment-body/v1",
      "pulse-assignment-uuid-params/v1",
      "after-auth-before-work",
      "pulse-idempotency/v1",
    ],
    [
      "pulse/login-v1",
      "api/pulse-coding/session/route.ts",
      "form",
      4_096,
      "pulse-login-body/v1",
      undefined,
      "after-rate-limit-before-work",
    ],
  ].map(
    ([id, filePath, bodyKind, maxBytes, schema, params, stage, header]) => ({
      contract: bodyContract(id as string, {
        bodyKind: bodyKind as "json" | "form" | "json-or-form",
        maxBytes: maxBytes as number,
        schema: schema as string,
        params: params as string | undefined,
        stage: stage as ValidationStage,
        header: header as string | undefined,
      }),
      endpoints: [endpoint(filePath as string, ["POST"])],
    }),
  ),
] as const;

export type SuccessFamily =
  | "public-json/v1"
  | "admin-json/v1"
  | "admin-json-or-redirect/v1"
  | "cron-json/v1"
  | "research-export/v1"
  | "redirect/v1"
  | "stream-text/v1"
  | "artifact-bytes/v1"
  | "retired-html/v1"
  | "empty/v1";

export interface RouteIoPolicyEntry {
  filePath: string;
  method: HttpMethod;
  exposure: RouteExposure;
  request: RequestContractDefinition;
  success: {
    family: SuccessFamily;
    projectionId: string;
    sensitiveFields: readonly string[];
    htmlFields: ReadonlyArray<{ path: string; sanitizerBoundary: string }>;
  };
  errors: {
    profileId: string;
    unknowns: "fixed-safe-boundary";
    cache: "no-store";
  };
}

export interface RouteMethodTarget {
  filePath: string;
  method: HttpMethod;
}

/**
 * Exact operational handlers whose asynchronous work must sit behind the
 * shared fixed-error boundary. The source validator verifies a real
 * top-level wrapper invocation in every handler; this list alone is not proof.
 */
export const OPERATIONAL_ERROR_BOUNDARY_ROUTES = [
  { filePath: "api/advisory-applications/route.ts", method: "POST" },
  { filePath: "api/admin/advisory-applications/route.ts", method: "GET" },
  { filePath: "api/admin/contact/route.ts", method: "GET" },
  { filePath: "api/admin/google/callback/route.ts", method: "GET" },
  { filePath: "api/admin/google/start/route.ts", method: "GET" },
  { filePath: "api/admin/session/route.ts", method: "POST" },
  { filePath: "api/contact/route.ts", method: "POST" },
  { filePath: "api/civica-index/corrections/route.ts", method: "POST" },
  { filePath: "api/countries/[slug]/constitution/route.ts", method: "GET" },
  { filePath: "api/countries/[slug]/democracy/route.ts", method: "GET" },
  { filePath: "api/countries/[slug]/export/route.ts", method: "GET" },
  {
    filePath: "api/countries/[slug]/indicator-history/route.ts",
    method: "GET",
  },
  { filePath: "api/countries/[slug]/international/route.ts", method: "GET" },
  { filePath: "api/countries/[slug]/leaders/route.ts", method: "GET" },
  { filePath: "api/countries/[slug]/scores/route.ts", method: "GET" },
  { filePath: "api/countries/[slug]/structure/route.ts", method: "GET" },
  { filePath: "api/governance-evidence/[slug]/route.ts", method: "GET" },
  { filePath: "api/metrics/[metricId]/strip-data/route.ts", method: "GET" },
  {
    filePath: "api/pulse-coding/adjudications/[assignmentId]/route.ts",
    method: "POST",
  },
  {
    filePath: "api/pulse-coding/assignments/[id]/route.ts",
    method: "POST",
  },
  { filePath: "api/pulse-coding/session/route.ts", method: "POST" },
  { filePath: "api/v1/elections/route.ts", method: "GET" },
] as const satisfies readonly RouteMethodTarget[];

/** Error/cache seams that received the bounded P1 response-profile repair. */
export const P1_ERROR_PROFILE_ROUTES = [
  { filePath: "api/admin/advisory-applications/route.ts", method: "GET" },
  { filePath: "api/admin/contact/route.ts", method: "GET" },
  { filePath: "api/citations/[entityType]/[id]/route.ts", method: "GET" },
  {
    filePath: "api/constitution/passages/[digest]/route.ts",
    method: "GET",
  },
  { filePath: "api/countries/[slug]/export/route.ts", method: "GET" },
  {
    filePath: "api/countries/[slug]/indicator-history/route.ts",
    method: "GET",
  },
] as const satisfies readonly RouteMethodTarget[];

function endpointKey(filePath: string, method: HttpMethod): string {
  return `${filePath}#${method}`;
}

function successFamily(
  filePath: string,
  method: HttpMethod,
  exposure: RouteExposure,
): SuccessFamily {
  if (method === "OPTIONS" || method === "HEAD") return "empty/v1";
  if (filePath.startsWith("downloads/")) return "artifact-bytes/v1";
  if (filePath.startsWith("embed/")) return "retired-html/v1";
  if (exposure === "cron") return "cron-json/v1";
  if (exposure === "chat") return "stream-text/v1";
  if (
    filePath === "api/admin/google/start/route.ts" ||
    filePath === "api/admin/google/callback/route.ts" ||
    filePath === "api/admin/sign-out/route.ts" ||
    filePath === "api/pulse-coding/session/route.ts" ||
    filePath === "api/pulse-coding/sign-out/route.ts" ||
    (filePath === "api/admin/session/route.ts" && method === "DELETE")
  ) {
    return "redirect/v1";
  }
  if (
    filePath === "api/admin/session/route.ts" ||
    (exposure === "admin" && method === "POST")
  ) {
    return "admin-json-or-redirect/v1";
  }
  if (exposure === "admin" || exposure === "pulse-coding") {
    return "admin-json/v1";
  }
  if (
    exposure === "export" ||
    filePath === "api/v1/elections/route.ts" ||
    filePath === "api/countries/[slug]/indicator-history/route.ts"
  ) {
    return "research-export/v1";
  }
  return "public-json/v1";
}

function sensitiveFields(filePath: string): readonly string[] {
  if (filePath === "api/admin/contact/route.ts") {
    return [
      "submissions[].name",
      "submissions[].email",
      "submissions[].ipAddress",
    ];
  }
  if (filePath === "api/admin/advisory-applications/route.ts") {
    return [
      "applications[].name",
      "applications[].email",
      "applications[].institution",
    ];
  }
  if (filePath === "api/pulse-coding/admin/participants/route.ts") {
    return ["accessCode"];
  }
  if (filePath === "api/pulse-coding/exports/[studyId]/route.ts") {
    return ["participants[].pseudonym", "audit[].actorId"];
  }
  return [];
}

function htmlFields(
  filePath: string,
): RouteIoPolicyEntry["success"]["htmlFields"] {
  if (
    filePath === "api/constitution/excerpts/route.ts" ||
    filePath === "api/constitution/excerpts/notable/route.ts"
  ) {
    return [
      {
        path: "countries[].excerpts[].excerptHtml",
        sanitizerBoundary: "constitution-html/v1",
      },
    ];
  }
  return [];
}

/** Expanded exact tuple policy used by the build validator and audit tooling. */
export const ROUTE_IO_POLICY: readonly RouteIoPolicyEntry[] = (() => {
  const inventory = new Map(
    ROUTE_INVENTORY.map((entry) => [entry.filePath, entry]),
  );
  const rows: RouteIoPolicyEntry[] = [];
  for (const mapping of REQUEST_CONTRACT_MAPPINGS) {
    for (const target of mapping.endpoints) {
      const registered = inventory.get(target.filePath);
      for (const method of target.methods) {
        const family = successFamily(
          target.filePath,
          method,
          registered?.exposure ?? "internal",
        );
        rows.push({
          filePath: target.filePath,
          method,
          exposure: registered?.exposure ?? "internal",
          request: mapping.contract,
          success: {
            family,
            projectionId: `${endpointKey(target.filePath, method)}/response-v1`,
            sensitiveFields: sensitiveFields(target.filePath),
            htmlFields: htmlFields(target.filePath),
          },
          errors: {
            profileId: `${family}/problems-v1`,
            unknowns: "fixed-safe-boundary",
            cache: "no-store",
          },
        });
      }
    }
  }
  return rows;
})();
