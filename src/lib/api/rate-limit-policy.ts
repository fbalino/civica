/**
 * PLT-011 closed route-level rate-limit policy.
 *
 * This module is deliberately DB-, filesystem-, and network-free. It records
 * the intended protection for every route+method in the canonical PLT-008
 * route inventory and exposes a pure validator for CI and focused fixtures.
 *
 * `implementation` is intentionally separate from the intended disposition:
 * a planned durable policy is covered by the design registry, but it is not
 * represented as already enforced. Platform WAF controls become
 * `external-verified` only when a checked live-configuration artifact exists.
 */

import type {
  HttpMethod,
  RouteControl,
  RouteExposure,
} from "./route-inventory/registry";

export const RATE_LIMIT_POLICY_VERSION = "rate-limit-policy/v1" as const;

export interface RateLimitInventoryEntry {
  filePath: string;
  exposure: RouteExposure;
  methods: readonly HttpMethod[];
  mutation: boolean;
  controls: readonly RouteControl[];
}

export type RoutePolicyImplementation =
  | "source-confirmed"
  | "partial"
  | "planned"
  | "external-required"
  | "external-verified";

export interface DurableDbPolicyDefinition {
  id: string;
  kind: "durable-db";
  algorithm: "fixed-window";
  storage: "neon-postgres";
  limit: number;
  windowMs: number;
  bucketScope: string;
  scope: "trusted-client-ip";
  keyDerivation: "hmac-sha256-trusted-client-ip-v1";
  storeUnavailable: "deny-request-with-503";
}

export interface PlatformWafPolicyDefinition {
  id: string;
  kind: "platform-waf";
  algorithm: "fixed-window";
  limit: number;
  windowMs: number;
  bucketScope: string;
  scope: "trusted-client-ip";
  verification: "external-required" | "external-verified";
  verifiedAt?: string;
  evidencePath?: string;
}

export interface PlatformWafEvidence {
  overview?: {
    firewall?: string;
    pendingDraftChanges?: number;
  };
  rule?: {
    active?: boolean;
    valid?: boolean;
    condition?: {
      type?: string;
      operator?: string;
      value?: string;
    };
    action?: string;
    algorithm?: string;
    windowSeconds?: number;
    limit?: number;
    keys?: string[];
    onExceed?: string;
  };
}

export type RateLimitPolicyDefinition =
  DurableDbPolicyDefinition | PlatformWafPolicyDefinition;

/** Prove that checked evidence describes the active all-path challenge rule. */
export function matchesPlatformWafEvidence(
  policy: PlatformWafPolicyDefinition,
  evidence: PlatformWafEvidence,
): boolean {
  return (
    evidence.overview?.firewall === "enabled" &&
    evidence.overview.pendingDraftChanges === 0 &&
    evidence.rule?.active === true &&
    evidence.rule.valid === true &&
    evidence.rule.condition?.type === "path" &&
    evidence.rule.condition.operator === "starts_with" &&
    evidence.rule.condition.value === "/" &&
    evidence.rule.action === "rate_limit" &&
    evidence.rule.algorithm?.replaceAll("_", "-") === policy.algorithm &&
    evidence.rule.windowSeconds === policy.windowMs / 1000 &&
    evidence.rule.limit === policy.limit &&
    evidence.rule.keys?.length === 1 &&
    evidence.rule.keys[0] === "ip" &&
    evidence.rule.onExceed === "challenge"
  );
}

const durable = (
  id: string,
  limit: number,
  windowMs: number,
  bucketScope: string,
): DurableDbPolicyDefinition => ({
  id,
  kind: "durable-db",
  algorithm: "fixed-window",
  storage: "neon-postgres",
  limit,
  windowMs,
  bucketScope,
  scope: "trusted-client-ip",
  keyDerivation: "hmac-sha256-trusted-client-ip-v1",
  storeUnavailable: "deny-request-with-503",
});

const platformWaf = (
  id: string,
  limit: number,
  windowMs: number,
  bucketScope: string,
): PlatformWafPolicyDefinition => ({
  id,
  kind: "platform-waf",
  algorithm: "fixed-window",
  limit,
  windowMs,
  bucketScope,
  scope: "trusted-client-ip",
  verification: "external-verified",
  verifiedAt: "2026-07-14",
  evidencePath: "plan/evidence/PLT-011/vercel-firewall-live.json",
});

/**
 * Proposed limits are concrete so route integration cannot silently invent a
 * different window, scope, or outage behavior. Existing values are retained
 * where Civica already publishes or enforces them; new bootstrap/WAF ceilings
 * are tied to the checked live-firewall evidence named below.
 */
export const RATE_LIMIT_POLICIES: readonly RateLimitPolicyDefinition[] = [
  durable("public-dynamic-read", 60, 60_000, "public-dynamic-read"),
  durable("public-api-v1", 60, 60_000, "api-v1"),
  durable("constitution-search", 30, 60_000, "constitution-search"),
  durable("public-dynamic-export", 30, 60_000, "public-dynamic-export"),
  durable("chat-burst", 15, 60_000, "chat-burst"),
  durable("chat-sustained", 100, 60 * 60_000, "chat-sustained"),
  durable("contact-form", 5, 10 * 60_000, "contact-form"),
  durable("correction-form", 5, 10 * 60_000, "correction-form"),
  durable(
    "advisory-application-form",
    5,
    30 * 60_000,
    "advisory-application-form",
  ),
  durable(
    "admin-credential-bootstrap",
    5,
    15 * 60_000,
    "admin-credential-bootstrap",
  ),
  durable("admin-oauth-bootstrap", 10, 15 * 60_000, "admin-oauth-bootstrap"),
  durable(
    "pulse-credential-bootstrap",
    5,
    15 * 60_000,
    "pulse-credential-bootstrap",
  ),
  platformWaf("static-release-download", 600, 60_000, "vercel-global-ip"),
  platformWaf("retired-embed", 600, 60_000, "vercel-global-ip"),
  platformWaf("pulse-sign-out", 600, 60_000, "vercel-global-ip"),
];

export interface DurableDbDisposition {
  kind: "durable-db";
  policyIds: readonly string[];
  implementation: Exclude<
    RoutePolicyImplementation,
    "external-required" | "external-verified"
  >;
  /** Required only after the route actually calls the shared durable boundary.
   *  The executable validator checks this literal marker in route source. */
  integrationMarker?: string;
  implementationNote: string;
}

export interface PlatformWafDisposition {
  kind: "platform-waf";
  policyId: string;
  implementation: "external-required" | "external-verified";
  evidencePath?: string;
  implementationNote: string;
}

export interface AuthenticatedSessionAuditDisposition {
  kind: "authenticated-session-audit";
  session: "admin" | "pulse-coding";
  audit: "declared-admin-audit" | "not-applicable-read" | "not-declared";
  implementation: "source-confirmed";
  implementationNote: string;
}

export interface CronSecretLeaseDisposition {
  kind: "cron-secret-lease";
  authentication: "cron-secret";
  concurrency: "withCronJob-job-wide-lease";
  implementation: "source-confirmed";
  implementationNote: string;
}

export interface BoundedPublicReadExemptionDisposition {
  kind: "bounded-public-read-exemption";
  bound:
    | "cors-preflight-no-work"
    | "checked-static-artifact"
    | "in-process-static-manifest";
  maxDatabaseQueries: 0;
  maxUpstreamCalls: 0;
  implementation: "source-confirmed";
  justification: string;
  implementationNote: string;
}

export type RateLimitDisposition =
  | DurableDbDisposition
  | PlatformWafDisposition
  | AuthenticatedSessionAuditDisposition
  | CronSecretLeaseDisposition
  | BoundedPublicReadExemptionDisposition;

export interface RateLimitRoutePolicyMapping {
  filePath: string;
  methods: readonly HttpMethod[];
  disposition: RateLimitDisposition;
}

const route = (
  filePath: string,
  methods: readonly HttpMethod[],
  disposition: RateLimitDisposition,
): RateLimitRoutePolicyMapping => ({ filePath, methods, disposition });

const durableDb = (
  policyIds: readonly string[],
  implementation: DurableDbDisposition["implementation"],
  implementationNote: string,
  integrationMarker?: string,
): DurableDbDisposition => ({
  kind: "durable-db",
  policyIds,
  implementation,
  ...(integrationMarker ? { integrationMarker } : {}),
  implementationNote,
});

const platform = (
  policyId: string,
  implementationNote: string,
): PlatformWafDisposition => ({
  kind: "platform-waf",
  policyId,
  implementation: "external-verified",
  evidencePath: "plan/evidence/PLT-011/vercel-firewall-live.json",
  implementationNote,
});

const authenticated = (
  session: AuthenticatedSessionAuditDisposition["session"],
  audit: AuthenticatedSessionAuditDisposition["audit"],
  implementationNote: string,
): AuthenticatedSessionAuditDisposition => ({
  kind: "authenticated-session-audit",
  session,
  audit,
  implementation: "source-confirmed",
  implementationNote,
});

const cron = (): CronSecretLeaseDisposition => ({
  kind: "cron-secret-lease",
  authentication: "cron-secret",
  concurrency: "withCronJob-job-wide-lease",
  implementation: "source-confirmed",
  implementationNote:
    "The canonical inventory declares cron-secret and APR-D166 supplies the shared withCronJob lease boundary.",
});

const preflight = (): BoundedPublicReadExemptionDisposition => ({
  kind: "bounded-public-read-exemption",
  bound: "cors-preflight-no-work",
  maxDatabaseQueries: 0,
  maxUpstreamCalls: 0,
  implementation: "source-confirmed",
  justification:
    "OPTIONS returns fixed CORS metadata without domain reads, writes, or upstream work.",
  implementationNote:
    "The exported OPTIONS handler is intentionally outside request counting.",
});

const checkedArtifact = (): BoundedPublicReadExemptionDisposition => ({
  kind: "bounded-public-read-exemption",
  bound: "checked-static-artifact",
  maxDatabaseQueries: 0,
  maxUpstreamCalls: 0,
  implementation: "source-confirmed",
  justification:
    "The response is a checked-in generated JSON artifact with a public cache and no request-time database or upstream work.",
  implementationNote:
    "Source shape confirms a bounded local artifact response.",
});

const staticManifest = (): BoundedPublicReadExemptionDisposition => ({
  kind: "bounded-public-read-exemption",
  bound: "in-process-static-manifest",
  maxDatabaseQueries: 0,
  maxUpstreamCalls: 0,
  implementation: "source-confirmed",
  justification:
    "The response is built from the in-process rights registry and performs no request-time database or upstream work.",
  implementationNote:
    "Source shape confirms a bounded in-process manifest response.",
});

const CONFIRMED_PUBLIC_READ = durableDb(
  ["public-dynamic-read"],
  "source-confirmed",
  "The route calls the shared HMAC/Neon request boundary before domain work.",
  "enforceRequestRateLimit(",
);
const CONFIRMED_V1 = durableDb(
  ["public-api-v1"],
  "source-confirmed",
  "The route awaits the shared distributed v1 helper; OPTIONS remains uncounted.",
  "await withRateLimit(request)",
);
const CONFIRMED_EXPORT = durableDb(
  ["public-dynamic-export"],
  "source-confirmed",
  "The dynamic export calls the shared HMAC/Neon boundary before data assembly.",
  "enforceRequestRateLimit(",
);
const CONFIRMED_OAUTH = durableDb(
  ["admin-oauth-bootstrap"],
  "source-confirmed",
  "The pre-session OAuth route checks the shared durable bootstrap budget before upstream work.",
  "checkRequestRateLimit(",
);
const CONFIRMED_ADMIN_LOGIN = durableDb(
  ["admin-credential-bootstrap"],
  "source-confirmed",
  "Password login delegates to the shared trusted-IP HMAC and Neon boundary before parsing or KDF work.",
  "checkAdminLoginRateLimit(",
);
const CONFIRMED_CHAT = durableDb(
  ["chat-burst", "chat-sustained"],
  "source-confirmed",
  "Both paid-chat budgets use the shared fail-closed HMAC/Neon boundary before parsing or model work.",
  "checkRequestRateLimit(",
);
const CONFIRMED_ADVISORY = durableDb(
  ["advisory-application-form"],
  "source-confirmed",
  "The advisory form checks the shared fail-closed HMAC/Neon boundary before parsing or storage.",
  "checkRequestRateLimit(",
);
const CONFIRMED_SEARCH = durableDb(
  ["constitution-search"],
  "source-confirmed",
  "Search checks the shared durable boundary before executing its bounded query transaction.",
  "checkRequestRateLimit(",
);

const CRON_ROUTES = [
  "api/cron/bills/br/route.ts",
  "api/cron/bills/ca/route.ts",
  "api/cron/bills/de/route.ts",
  "api/cron/bills/fr/route.ts",
  "api/cron/bills/uk/route.ts",
  "api/cron/bills/us/route.ts",
  "api/cron/factbook/auto-resolve-disputes/route.ts",
  "api/cron/factbook/refresh-cache/route.ts",
  "api/cron/factbook/snapshot-vintage/route.ts",
  "api/cron/factbook/sync-cia-cabinets/route.ts",
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
  "api/cron/factbook/sync-wto-stats/route.ts",
  "api/cron/factbook/verify-reconciliation/route.ts",
  "api/cron/pulse/calculate/route.ts",
  "api/cron/pulse/classify/route.ts",
  "api/cron/pulse/ingest/route.ts",
  "api/cron/pulse/v2/classify/route.ts",
  "api/cron/pulse/v2/cluster/route.ts",
  "api/cron/pulse/v2/ingest/route.ts",
  "api/cron/pulse/v2/review-sla/route.ts",
  "api/cron/pulse/v2/score/route.ts",
] as const;

const V1_ROUTES = [
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

/** Exact non-preflight GET exemptions; all other public GETs must be durable or platform-controlled. */
export const BOUNDED_PUBLIC_READ_EXEMPTION_ROUTES = {
  "api/provenance-coverage/route.ts": "checked-static-artifact",
  "api/reconciliation-audit/route.ts": "checked-static-artifact",
  "api/rights-manifest/route.ts": "in-process-static-manifest",
  "api/source-coverage/route.ts": "checked-static-artifact",
} as const satisfies Readonly<
  Record<string, BoundedPublicReadExemptionDisposition["bound"]>
>;

export const RATE_LIMIT_ROUTE_POLICIES: readonly RateLimitRoutePolicyMapping[] =
  [
    // Established owner-admin operations.
    route(
      "api/admin/advisory-applications/[id]/route.ts",
      ["POST"],
      authenticated(
        "admin",
        "declared-admin-audit",
        "The common admin mutation boundary supplies session, exact-origin, and audit controls.",
      ),
    ),
    route(
      "api/admin/advisory-applications/route.ts",
      ["GET"],
      authenticated(
        "admin",
        "not-applicable-read",
        "The route reads applicant PII only after owner-session verification.",
      ),
    ),
    route(
      "api/admin/contact/route.ts",
      ["GET"],
      authenticated(
        "admin",
        "not-applicable-read",
        "The route reads contact PII only after owner-session verification.",
      ),
    ),
    route(
      "api/admin/data-disputes/[id]/route.ts",
      ["POST"],
      authenticated(
        "admin",
        "declared-admin-audit",
        "The common admin mutation boundary supplies session, exact-origin, and audit controls.",
      ),
    ),
    route("api/admin/google/callback/route.ts", ["GET"], CONFIRMED_OAUTH),
    route("api/admin/google/start/route.ts", ["GET"], CONFIRMED_OAUTH),
    route(
      "api/admin/messages/[id]/route.ts",
      ["POST"],
      authenticated(
        "admin",
        "declared-admin-audit",
        "The common admin mutation boundary supplies session, exact-origin, and audit controls.",
      ),
    ),
    route(
      "api/admin/pulse-review/[id]/exception/route.ts",
      ["POST"],
      authenticated(
        "admin",
        "declared-admin-audit",
        "The common admin mutation boundary supplies session, exact-origin, and audit controls.",
      ),
    ),
    route(
      "api/admin/pulse-review/[id]/route.ts",
      ["POST"],
      authenticated(
        "admin",
        "declared-admin-audit",
        "The common admin mutation boundary supplies session, exact-origin, and audit controls.",
      ),
    ),
    route("api/admin/session/route.ts", ["POST"], CONFIRMED_ADMIN_LOGIN),
    route(
      "api/admin/session/route.ts",
      ["DELETE"],
      authenticated(
        "admin",
        "declared-admin-audit",
        "Signed-session revocation uses the common admin logout and audit boundary.",
      ),
    ),
    route(
      "api/admin/sign-out/route.ts",
      ["POST"],
      authenticated(
        "admin",
        "declared-admin-audit",
        "Signed-session revocation uses the common admin logout and audit boundary.",
      ),
    ),

    // Public mutations, paid chat, public reads, search, and dynamic exports.
    route("api/advisory-applications/route.ts", ["POST"], CONFIRMED_ADVISORY),
    route("api/chat/route.ts", ["POST"], CONFIRMED_CHAT),
    route(
      "api/citations/[entityType]/[id]/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route(
      "api/civica-index/corrections/route.ts",
      ["POST"],
      durableDb(
        ["correction-form"],
        "source-confirmed",
        "The correction form checks the shared fail-closed HMAC/Neon boundary before parsing or storage.",
        "checkRequestRateLimit(",
      ),
    ),
    route(
      "api/constitution/excerpts/notable/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route("api/constitution/excerpts/route.ts", ["GET"], CONFIRMED_PUBLIC_READ),
    route(
      "api/constitution/passages/[digest]/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route("api/constitution/search/route.ts", ["GET"], CONFIRMED_SEARCH),
    route("api/contact/route.ts", ["OPTIONS"], preflight()),
    route(
      "api/contact/route.ts",
      ["POST"],
      durableDb(
        ["contact-form"],
        "source-confirmed",
        "The contact form checks the shared fail-closed HMAC/Neon boundary before parsing or storage.",
        "checkRequestRateLimit(",
      ),
    ),
    route(
      "api/countries/[slug]/bills/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route(
      "api/countries/[slug]/constitution/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route(
      "api/countries/[slug]/democracy/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route("api/countries/[slug]/export/route.ts", ["GET"], CONFIRMED_EXPORT),
    route(
      "api/countries/[slug]/indicator-history/route.ts",
      ["GET"],
      CONFIRMED_EXPORT,
    ),
    route(
      "api/countries/[slug]/international/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route(
      "api/countries/[slug]/leaders/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route(
      "api/countries/[slug]/scores/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route(
      "api/countries/[slug]/structure/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),

    // Cron is authenticated, idempotent, leased, and fenced under APR-D166.
    ...CRON_ROUTES.map((filePath) => route(filePath, ["GET", "POST"], cron())),

    route("api/governance-evidence/[slug]/route.ts", ["GET"], CONFIRMED_EXPORT),
    route(
      "api/metrics/[metricId]/strip-data/route.ts",
      ["GET"],
      CONFIRMED_PUBLIC_READ,
    ),
    route("api/provenance-coverage/route.ts", ["GET"], checkedArtifact()),

    // Established Pulse coding/admin sessions versus credential bootstrap.
    route(
      "api/pulse-coding/adjudications/[assignmentId]/route.ts",
      ["POST"],
      authenticated(
        "pulse-coding",
        "not-declared",
        "The participant session is enforced; no common admin-audit control is declared for this domain write.",
      ),
    ),
    route(
      "api/pulse-coding/admin/participants/route.ts",
      ["POST"],
      authenticated(
        "admin",
        "declared-admin-audit",
        "The owner-session mutation uses the common exact-origin and audit boundary.",
      ),
    ),
    route(
      "api/pulse-coding/assignments/[id]/route.ts",
      ["POST"],
      authenticated(
        "pulse-coding",
        "not-declared",
        "The participant session is enforced; no common admin-audit control is declared for this domain write.",
      ),
    ),
    route(
      "api/pulse-coding/exports/[studyId]/route.ts",
      ["GET"],
      authenticated(
        "pulse-coding",
        "not-applicable-read",
        "The research export is available only to an established coding session.",
      ),
    ),
    route(
      "api/pulse-coding/session/route.ts",
      ["POST"],
      durableDb(
        ["pulse-credential-bootstrap"],
        "source-confirmed",
        "The access-code bootstrap checks the shared fail-closed HMAC/Neon boundary before credential work.",
        "checkRequestRateLimit(",
      ),
    ),
    route(
      "api/pulse-coding/sign-out/route.ts",
      ["POST"],
      platform(
        "pulse-sign-out",
        "Exact-origin sign-out only clears the browser cookie and remains available during a counter outage; the checked all-path WAF supplies its distributed flood ceiling.",
      ),
    ),

    route("api/reconciliation-audit/route.ts", ["GET"], checkedArtifact()),
    route("api/rights-manifest/route.ts", ["GET"], staticManifest()),
    route("api/source-coverage/route.ts", ["GET"], checkedArtifact()),

    // Versioned public API: GET is durable; fixed OPTIONS preflight is exempt.
    ...V1_ROUTES.flatMap((filePath) => [
      route(filePath, ["GET"], CONFIRMED_V1),
      route(filePath, ["OPTIONS"], preflight()),
    ]),

    // Immutable release delivery and the retired embed depend on verified WAF state.
    route(
      "downloads/civica-atlas-2026-07-11.json.gz/route.ts",
      ["GET"],
      platform(
        "static-release-download",
        "Checked live WAF evidence verifies the active all-path platform ceiling for CDN and cache delivery that application counters cannot reliably observe.",
      ),
    ),
    route(
      "downloads/civica-atlas-2026-07-11.manifest.json/route.ts",
      ["GET"],
      platform(
        "static-release-download",
        "Checked live WAF evidence verifies the active all-path platform ceiling for CDN and cache delivery that application counters cannot reliably observe.",
      ),
    ),
    route(
      "embed/[slug]/route.ts",
      ["GET", "OPTIONS"],
      platform(
        "retired-embed",
        "Checked live WAF evidence verifies the active all-path platform ceiling for the retired static embed.",
      ),
    ),
  ];

export type RateLimitPolicyIssueCode =
  | "duplicate-policy-id"
  | "invalid-policy-definition"
  | "unused-policy-definition"
  | "duplicate-inventory-route-method"
  | "duplicate-policy-mapping"
  | "stale-policy-mapping"
  | "missing-policy-mapping"
  | "unknown-policy-reference"
  | "policy-kind-mismatch"
  | "invalid-integration-status"
  | "invalid-bounded-exemption"
  | "invalid-authenticated-disposition"
  | "invalid-cron-disposition"
  | "public-api-protection-gap"
  | "public-read-protection-gap"
  | "export-protection-gap"
  | "embed-protection-gap"
  | "form-protection-gap"
  | "credential-bootstrap-protection-gap"
  | "unauthenticated-mutation-protection-gap"
  | "session-protection-gap"
  | "cron-protection-gap";

export interface RateLimitPolicyIssue {
  code: RateLimitPolicyIssueCode;
  message: string;
  routeMethod?: string;
}

export interface ValidateRateLimitPolicyInput {
  routeInventory: readonly RateLimitInventoryEntry[];
  policies: readonly RateLimitPolicyDefinition[];
  mappings: readonly RateLimitRoutePolicyMapping[];
}

const MUTATING_METHODS = new Set<HttpMethod>([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
const routeMethodKey = (filePath: string, method: HttpMethod): string =>
  `${filePath}#${method}`;

function isProtected(disposition: RateLimitDisposition | undefined): boolean {
  return (
    disposition?.kind === "durable-db" || disposition?.kind === "platform-waf"
  );
}

function isCredentialBootstrap(
  entry: RateLimitInventoryEntry,
  method: HttpMethod,
): boolean {
  if (entry.controls.includes("oauth-bootstrap")) return true;
  return entry.controls.includes("credential-check") && method !== "DELETE";
}

function isEstablishedSession(entry: RateLimitInventoryEntry): boolean {
  return (
    entry.controls.includes("admin-session") ||
    entry.controls.includes("pulse-coding-session")
  );
}

function isPublicDynamicExport(entry: RateLimitInventoryEntry): boolean {
  return (
    (entry.exposure === "export" && entry.filePath.startsWith("api/")) ||
    entry.filePath === "api/governance-evidence/[slug]/route.ts" ||
    entry.filePath === "api/countries/[slug]/indicator-history/route.ts"
  );
}

/** Pure structural and policy-semantic validation; performs no source or filesystem scan. */
export function validateRateLimitPolicyRegistry({
  routeInventory,
  policies,
  mappings,
}: ValidateRateLimitPolicyInput): RateLimitPolicyIssue[] {
  const issues: RateLimitPolicyIssue[] = [];
  const policyById = new Map<string, RateLimitPolicyDefinition>();

  for (const policy of policies) {
    if (policyById.has(policy.id)) {
      issues.push({
        code: "duplicate-policy-id",
        message: `Duplicate rate-limit policy id: ${policy.id}`,
      });
      continue;
    }
    policyById.set(policy.id, policy);
    if (
      !policy.id.trim() ||
      !policy.bucketScope.trim() ||
      !Number.isInteger(policy.limit) ||
      policy.limit <= 0 ||
      !Number.isInteger(policy.windowMs) ||
      policy.windowMs <= 0
    ) {
      issues.push({
        code: "invalid-policy-definition",
        message: `Policy ${policy.id || "<blank>"} must define a positive integer limit/window and non-empty bucket scope.`,
      });
    }
    if (policy.kind === "platform-waf") {
      const verified = policy.verification === "external-verified";
      if (
        (verified &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(policy.verifiedAt ?? "") ||
            !policy.evidencePath?.trim())) ||
        (!verified &&
          (policy.verifiedAt !== undefined ||
            policy.evidencePath !== undefined))
      ) {
        issues.push({
          code: "invalid-policy-definition",
          message: `Platform policy ${policy.id} must pair external-verified with a dated evidence path, or remain external-required without one.`,
        });
      }
    }
  }

  const expected = new Map<
    string,
    { entry: RateLimitInventoryEntry; method: HttpMethod }
  >();
  for (const entry of routeInventory) {
    for (const method of entry.methods) {
      const key = routeMethodKey(entry.filePath, method);
      if (expected.has(key)) {
        issues.push({
          code: "duplicate-inventory-route-method",
          routeMethod: key,
          message: `Canonical route inventory repeats ${key}.`,
        });
      } else {
        expected.set(key, { entry, method });
      }
    }
  }

  const mapped = new Map<string, RateLimitRoutePolicyMapping>();
  const referencedPolicyIds = new Set<string>();

  for (const mapping of mappings) {
    if (mapping.methods.length === 0) {
      issues.push({
        code: "stale-policy-mapping",
        message: `Policy mapping ${mapping.filePath} declares no methods.`,
      });
    }

    const disposition = mapping.disposition;
    if (!disposition.implementationNote.trim()) {
      issues.push({
        code: "invalid-integration-status",
        message: `Policy mapping ${mapping.filePath} must explain its implementation status.`,
      });
    }

    if (disposition.kind === "durable-db") {
      if (
        disposition.policyIds.length === 0 ||
        (disposition.implementation === "source-confirmed" &&
          !disposition.integrationMarker?.trim()) ||
        (disposition.implementation !== "source-confirmed" &&
          disposition.integrationMarker !== undefined)
      ) {
        issues.push({
          code: "invalid-integration-status",
          message:
            disposition.policyIds.length === 0
              ? `Durable mapping ${mapping.filePath} references no policy.`
              : disposition.implementation === "source-confirmed"
                ? `Durable mapping ${mapping.filePath} is source-confirmed but declares no integration marker for the executable validator.`
                : `Durable mapping ${mapping.filePath} must not declare an integration marker while it remains ${disposition.implementation}.`,
        });
      }
      for (const policyId of disposition.policyIds) {
        referencedPolicyIds.add(policyId);
        const policy = policyById.get(policyId);
        if (!policy) {
          issues.push({
            code: "unknown-policy-reference",
            message: `Durable mapping ${mapping.filePath} references unknown policy ${policyId}.`,
          });
        } else if (policy.kind !== "durable-db") {
          issues.push({
            code: "policy-kind-mismatch",
            message: `Durable mapping ${mapping.filePath} references non-durable policy ${policyId}.`,
          });
        }
      }
    } else if (disposition.kind === "platform-waf") {
      referencedPolicyIds.add(disposition.policyId);
      const policy = policyById.get(disposition.policyId);
      if (!policy) {
        issues.push({
          code: "unknown-policy-reference",
          message: `Platform mapping ${mapping.filePath} references unknown policy ${disposition.policyId}.`,
        });
      } else if (policy.kind !== "platform-waf") {
        issues.push({
          code: "policy-kind-mismatch",
          message: `Platform mapping ${mapping.filePath} references non-platform policy ${disposition.policyId}.`,
        });
      }
      if (
        policy?.kind === "platform-waf" &&
        disposition.implementation !== policy.verification
      ) {
        issues.push({
          code: "invalid-integration-status",
          message: `Platform mapping ${mapping.filePath} implementation must match policy verification ${policy.verification}.`,
        });
      }
      if (
        disposition.implementation === "external-verified" &&
        (!disposition.evidencePath?.trim() ||
          disposition.evidencePath !==
            (policy?.kind === "platform-waf" ? policy.evidencePath : undefined))
      ) {
        issues.push({
          code: "invalid-integration-status",
          message: `Verified platform mapping ${mapping.filePath} must reference the policy evidence path.`,
        });
      }
      if (
        disposition.implementation === "external-required" &&
        disposition.evidencePath !== undefined
      ) {
        issues.push({
          code: "invalid-integration-status",
          message: `Unverified platform mapping ${mapping.filePath} must not claim an evidence path.`,
        });
      }
    }

    for (const method of mapping.methods) {
      const key = routeMethodKey(mapping.filePath, method);
      if (mapped.has(key)) {
        issues.push({
          code: "duplicate-policy-mapping",
          routeMethod: key,
          message: `Rate-limit registry maps ${key} more than once.`,
        });
        continue;
      }
      mapped.set(key, mapping);
      if (!expected.has(key)) {
        issues.push({
          code: "stale-policy-mapping",
          routeMethod: key,
          message: `Rate-limit registry maps ${key}, which is absent from the canonical route inventory.`,
        });
      }
    }
  }

  for (const policy of policies) {
    if (!referencedPolicyIds.has(policy.id)) {
      issues.push({
        code: "unused-policy-definition",
        message: `Rate-limit policy ${policy.id} is not referenced by any route method.`,
      });
    }
  }

  for (const [key, { entry, method }] of expected) {
    const mapping = mapped.get(key);
    const disposition = mapping?.disposition;
    if (!mapping) {
      issues.push({
        code: "missing-policy-mapping",
        routeMethod: key,
        message: `Canonical route method ${key} has no explicit PLT-011 disposition.`,
      });
    }

    if (disposition?.kind === "bounded-public-read-exemption") {
      const expectedStaticBound =
        BOUNDED_PUBLIC_READ_EXEMPTION_ROUTES[
          entry.filePath as keyof typeof BOUNDED_PUBLIC_READ_EXEMPTION_ROUTES
        ];
      const validPreflight =
        method === "OPTIONS" && disposition.bound === "cors-preflight-no-work";
      const validStaticGet =
        method === "GET" && expectedStaticBound === disposition.bound;
      if (
        (!validPreflight && !validStaticGet) ||
        disposition.maxDatabaseQueries !== 0 ||
        disposition.maxUpstreamCalls !== 0 ||
        !disposition.justification.trim()
      ) {
        issues.push({
          code: "invalid-bounded-exemption",
          routeMethod: key,
          message: `${key} is not one of the closed, zero-DB/zero-upstream bounded exemptions.`,
        });
      }
    }

    if (disposition?.kind === "authenticated-session-audit") {
      const requiredControl =
        disposition.session === "admin"
          ? "admin-session"
          : "pulse-coding-session";
      if (!entry.controls.includes(requiredControl)) {
        issues.push({
          code: "invalid-authenticated-disposition",
          routeMethod: key,
          message: `${key} claims ${disposition.session} session protection without the matching canonical control.`,
        });
      }
      if (
        disposition.audit === "declared-admin-audit" &&
        !entry.controls.includes("admin-audit")
      ) {
        issues.push({
          code: "invalid-authenticated-disposition",
          routeMethod: key,
          message: `${key} claims the admin audit boundary without a declared admin-audit control.`,
        });
      }
      if (method === "GET" && disposition.audit !== "not-applicable-read") {
        issues.push({
          code: "invalid-authenticated-disposition",
          routeMethod: key,
          message: `${key} is an authenticated read and must record audit as not-applicable-read.`,
        });
      }
    }

    if (disposition?.kind === "cron-secret-lease") {
      if (
        entry.exposure !== "cron" ||
        !entry.controls.includes("cron-secret")
      ) {
        issues.push({
          code: "invalid-cron-disposition",
          routeMethod: key,
          message: `${key} claims cron-secret+lease protection without the canonical cron exposure/control.`,
        });
      }
    }

    if (
      entry.filePath.startsWith("api/v1/") &&
      method !== "OPTIONS" &&
      !isProtected(disposition)
    ) {
      issues.push({
        code: "public-api-protection-gap",
        routeMethod: key,
        message: `${key} is a versioned public API without durable-db or platform protection.`,
      });
    }

    if (
      entry.exposure === "public-read" &&
      method === "GET" &&
      !isProtected(disposition) &&
      disposition?.kind !== "bounded-public-read-exemption"
    ) {
      issues.push({
        code: "public-read-protection-gap",
        routeMethod: key,
        message: `${key} is a dynamic public read without durable-db/platform protection or a closed bounded exemption.`,
      });
    }

    if (entry.exposure === "export") {
      const validExportDisposition = entry.filePath.startsWith("downloads/")
        ? disposition?.kind === "platform-waf"
        : isProtected(disposition);
      if (!validExportDisposition) {
        issues.push({
          code: "export-protection-gap",
          routeMethod: key,
          message: `${key} lacks the required ${entry.filePath.startsWith("downloads/") ? "platform" : "durable/platform"} export protection.`,
        });
      }
    }

    if (isPublicDynamicExport(entry) && !isProtected(disposition)) {
      issues.push({
        code: "export-protection-gap",
        routeMethod: key,
        message: `${key} is a dynamic public export without durable-db or platform protection.`,
      });
    }

    if (entry.exposure === "embed" && disposition?.kind !== "platform-waf") {
      issues.push({
        code: "embed-protection-gap",
        routeMethod: key,
        message: `${key} is an embed route without the required platform-WAF disposition.`,
      });
    }

    if (
      entry.exposure === "public-mutation" &&
      MUTATING_METHODS.has(method) &&
      !isProtected(disposition)
    ) {
      issues.push({
        code: "form-protection-gap",
        routeMethod: key,
        message: `${key} is a public form/mutation without durable-db or platform protection.`,
      });
    }

    if (isCredentialBootstrap(entry, method) && !isProtected(disposition)) {
      issues.push({
        code: "credential-bootstrap-protection-gap",
        routeMethod: key,
        message: `${key} establishes credentials/OAuth state without durable-db or platform protection.`,
      });
    }

    if (
      MUTATING_METHODS.has(method) &&
      !isEstablishedSession(entry) &&
      !entry.controls.includes("cron-secret") &&
      !isProtected(disposition)
    ) {
      issues.push({
        code: "unauthenticated-mutation-protection-gap",
        routeMethod: key,
        message: `${key} is an unauthenticated mutation without durable-db or platform protection.`,
      });
    }

    if (
      isEstablishedSession(entry) &&
      !isCredentialBootstrap(entry, method) &&
      disposition?.kind !== "authenticated-session-audit" &&
      !isProtected(disposition)
    ) {
      issues.push({
        code: "session-protection-gap",
        routeMethod: key,
        message: `${key} has an established session but no authenticated-session/audit or stronger rate disposition.`,
      });
    }

    if (
      entry.exposure === "cron" &&
      disposition?.kind !== "cron-secret-lease"
    ) {
      issues.push({
        code: "cron-protection-gap",
        routeMethod: key,
        message: `${key} is a cron route without the cron-secret+lease disposition.`,
      });
    }
  }

  return issues;
}

export function summarizeRateLimitPolicyImplementations(
  mappings: readonly RateLimitRoutePolicyMapping[],
): Record<RoutePolicyImplementation, number> {
  const result: Record<RoutePolicyImplementation, number> = {
    "source-confirmed": 0,
    partial: 0,
    planned: 0,
    "external-required": 0,
    "external-verified": 0,
  };
  for (const mapping of mappings) {
    result[mapping.disposition.implementation] += mapping.methods.length;
  }
  return result;
}

const FORBIDDEN_PROCESS_LOCAL_MARKERS = [
  "checkInMemoryRateLimit",
  "enforceInMemoryRateLimit",
  'failureMode: "memory-fallback"',
] as const;

/** Pure negative invariant used by the executable validator and unit tests. */
export function findProcessLocalRateLimitMarkers(
  sources: Readonly<Record<string, string>>,
): string[] {
  const findings: string[] = [];
  for (const [filePath, source] of Object.entries(sources)) {
    for (const marker of FORBIDDEN_PROCESS_LOCAL_MARKERS) {
      if (source.includes(marker)) findings.push(`${filePath}: ${marker}`);
    }
  }
  return findings.sort();
}
