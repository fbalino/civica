import type {
  HttpMethod,
  RouteInventoryEntry,
} from "@/lib/api/route-inventory/registry";
import { ROUTE_INVENTORY } from "@/lib/api/route-inventory/registry";

/**
 * PLT-014 — one closed cache/freshness vocabulary for public surfaces.
 *
 * API route handlers that read mutable database rows are request-live: they
 * are uncached by default and emit `no-store`. The only shared public caches
 * for route handlers are checked, build-owned artifacts and frozen,
 * version-addressed releases. Checked artifacts must revalidate at expiry and
 * never opt into stale-while-revalidate/stale-if-error. Frozen release URLs are
 * immutable and are replaced by a new URL rather than overwritten.
 *
 * PLT-033 (APR-D177) — database-backed public pages are cached. Each one
 * declares the literal `revalidate = 86400` backstop, and the daily
 * `operations.refresh-pages` job invalidates every page and re-renders the
 * sitemap after the day's imports. A page stays request-live only when it is
 * listed in `LIVE_PAGE_ROUTES`: it is private to a signed-in session, or it
 * reads per-request input (`searchParams`, headers, cookies) that Next.js
 * cannot serve from a shared page cache.
 */
export const CACHE_CONSISTENCY_SCHEMA_VERSION =
  "civica-cache-consistency/v1" as const;

/**
 * The only revalidate literal a cached database-backed page may declare
 * (24 hours). Next.js requires a statically analyzable literal, so pages write
 * `export const revalidate = 86400;` and the cache gate checks the value.
 */
export const PAGE_CACHE_REVALIDATE_SECONDS = 86400 as const;

export type LivePageReason = "private-session" | "request-input";

export interface LivePageRoute {
  /** Route module that declares `revalidate = 0` (a page or a layout). */
  file: string;
  /** URL path the module serves; a layout covers its whole subtree. */
  routePath: string;
  reason: LivePageReason;
  note: string;
}

/**
 * Closed allowlist of database-backed pages that render per request.
 * The cache gate rejects a stale entry, an entry whose module does not
 * declare `revalidate = 0`, and a `request-input` entry whose pages no longer
 * read request input.
 */
export const LIVE_PAGE_ROUTES: readonly LivePageRoute[] = Object.freeze([
  {
    file: "src/app/(admin)/layout.tsx",
    routePath: "/admin",
    reason: "private-session",
    note: "Owner admin workspace behind the signed admin session.",
  },
  {
    file: "src/app/(coding)/admin/pulse-coding/layout.tsx",
    routePath: "/admin/pulse-coding",
    reason: "private-session",
    note: "Pulse coder workspace behind the signed coding session.",
  },
  {
    file: "src/app/admin/sign-in/page.tsx",
    routePath: "/admin/sign-in",
    reason: "private-session",
    note: "Reads the admin session cookie and the sign-in error/redirect query.",
  },
  {
    file: "src/app/(reader)/atlas/page.tsx",
    routePath: "/atlas",
    reason: "request-input",
    note: "Map layer, filter, and selection come from the query string.",
  },
  {
    file: "src/app/(reader)/civica-index/corrections/page.tsx",
    routePath: "/civica-index/corrections",
    reason: "request-input",
    note: "Pagination and the post-submission confirmation come from the query string.",
  },
  {
    file: "src/app/(reader)/civica-index/pulse-changelog/page.tsx",
    routePath: "/civica-index/pulse-changelog",
    reason: "request-input",
    note: "Server-side filters and pagination (PLT-028) come from the query string.",
  },
  {
    file: "src/app/(reader)/country/methodology/reconciliation/disputes/page.tsx",
    routePath: "/country/methodology/reconciliation/disputes",
    reason: "request-input",
    note: "Server-side filters and pagination come from the query string.",
  },
  {
    file: "src/app/(reader)/governance-change/page.tsx",
    routePath: "/governance-change",
    reason: "request-input",
    note: "The comparison window and its coverage claim come from the query string.",
  },
  {
    file: "src/app/(reader)/report-data-issue/page.tsx",
    routePath: "/report-data-issue",
    reason: "request-input",
    note: "The report form is prefilled from the query string.",
  },
  {
    file: "src/app/civica-conditions/page.tsx",
    routePath: "/civica-conditions",
    reason: "request-input",
    note: "The selected Conditions release comes from the query string.",
  },
  {
    file: "src/app/compare/page.tsx",
    routePath: "/compare",
    reason: "request-input",
    note: "The compared countries come from the query string.",
  },
  {
    file: "src/app/constitution/page.tsx",
    routePath: "/constitution",
    reason: "request-input",
    note: "Country and topic filters come from the query string.",
  },
  {
    file: "src/app/constitution/search/page.tsx",
    routePath: "/constitution/search",
    reason: "request-input",
    note: "Full-text query plus the rate limiter's request headers.",
  },
  {
    file: "src/app/governance-evidence/page.tsx",
    routePath: "/governance-evidence",
    reason: "request-input",
    note: "The selected country comes from the query string; the layout defers work to request time.",
  },
]);

/** URL path a page or layout module serves (route groups removed). */
export function routePathForModule(file: string): string {
  const withoutRoot = file.replace(/^src\/app/, "");
  const directory = withoutRoot.replace(/\/(?:page|layout|not-found|sitemap)\.[cm]?[jt]sx?$/, "");
  const segments = directory
    .split("/")
    .filter((segment) => segment && !/^\(.+\)$/.test(segment));
  return `/${segments.join("/")}`;
}

/**
 * True when a public URL path is served by a request-live page. Layout
 * entries cover their subtree; page entries cover exactly one path.
 */
export function isLivePagePath(
  pathname: string,
  routes: readonly LivePageRoute[] = LIVE_PAGE_ROUTES,
): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return routes.some((route) =>
    /\/layout\.[cm]?[jt]sx?$/.test(route.file)
      ? normalized === route.routePath ||
        normalized.startsWith(`${route.routePath}/`)
      : normalized === route.routePath,
  );
}

export function livePageRouteErrors(
  routes: readonly LivePageRoute[] = LIVE_PAGE_ROUTES,
): string[] {
  const errors: string[] = [];
  const files = new Set<string>();
  for (const route of routes) {
    if (files.has(route.file)) errors.push(`${route.file}: duplicate live page`);
    files.add(route.file);
    if (!/^src\/app\/.+\/(?:page|layout)\.tsx$/.test(route.file)) {
      errors.push(`${route.file}: live page entry must name a page or layout module`);
    }
    const modulePath = routePathForModule(route.file);
    const isLayout = /\/layout\.tsx$/.test(route.file);
    // A route-group layout sits above its first URL segment, so its declared
    // subtree may be narrower than the module path; the cache gate proves
    // every page it wraps is inside that subtree.
    const pathMatches = isLayout
      ? route.routePath === modulePath ||
        route.routePath.startsWith(modulePath === "/" ? "/" : `${modulePath}/`)
      : route.routePath === modulePath;
    if (!pathMatches) {
      errors.push(
        `${route.file}: routePath ${route.routePath} does not match ${modulePath}`,
      );
    }
    if (route.reason === "private-session" && !route.routePath.startsWith("/admin")) {
      errors.push(`${route.file}: private-session pages must live under /admin`);
    }
    if (!route.note.trim()) errors.push(`${route.file}: live page entry needs a note`);
  }
  return errors;
}

export type CacheProfileId =
  | "public-live"
  | "private-live"
  | "checked-build-artifact"
  | "immutable-release"
  | "build-static"
  | "build-revalidated";

export type CacheInvalidation =
  | "per-request"
  | "deployment"
  | "new-versioned-url"
  | "time-revalidation";

export type CacheVersionBinding =
  | "live-source-observation"
  | "build-commit"
  | "frozen-release-id";

export interface CacheProfile {
  id: CacheProfileId;
  cacheControl: string | null;
  invalidation: CacheInvalidation;
  versionBinding: CacheVersionBinding;
  allowsMutableDbData: boolean;
  allowsStaleOnError: boolean;
  nextRouteBehavior:
    | "request-dynamic"
    | "build-static"
    | "time-revalidated-static";
}

export const CACHE_PROFILES: Readonly<Record<CacheProfileId, CacheProfile>> =
  Object.freeze({
    "public-live": Object.freeze({
      id: "public-live",
      cacheControl: "no-store",
      invalidation: "per-request",
      versionBinding: "live-source-observation",
      allowsMutableDbData: true,
      allowsStaleOnError: false,
      nextRouteBehavior: "request-dynamic",
    }),
    "private-live": Object.freeze({
      id: "private-live",
      cacheControl: "private, no-store",
      invalidation: "per-request",
      versionBinding: "live-source-observation",
      allowsMutableDbData: true,
      allowsStaleOnError: false,
      nextRouteBehavior: "request-dynamic",
    }),
    "checked-build-artifact": Object.freeze({
      id: "checked-build-artifact",
      cacheControl: "public, max-age=3600, must-revalidate",
      invalidation: "deployment",
      versionBinding: "build-commit",
      allowsMutableDbData: false,
      allowsStaleOnError: false,
      nextRouteBehavior: "build-static",
    }),
    "immutable-release": Object.freeze({
      id: "immutable-release",
      cacheControl: "public, max-age=31536000, immutable",
      invalidation: "new-versioned-url",
      versionBinding: "frozen-release-id",
      allowsMutableDbData: false,
      allowsStaleOnError: false,
      nextRouteBehavior: "build-static",
    }),
    "build-static": Object.freeze({
      id: "build-static",
      cacheControl: null,
      invalidation: "deployment",
      versionBinding: "build-commit",
      allowsMutableDbData: false,
      allowsStaleOnError: false,
      nextRouteBehavior: "build-static",
    }),
    "build-revalidated": Object.freeze({
      id: "build-revalidated",
      cacheControl: null,
      invalidation: "time-revalidation",
      versionBinding: "build-commit",
      allowsMutableDbData: false,
      allowsStaleOnError: true,
      nextRouteBehavior: "time-revalidated-static",
    }),
  });

export function cacheControlFor(
  profileId: Exclude<CacheProfileId, "build-static" | "build-revalidated">,
): string {
  const value = CACHE_PROFILES[profileId].cacheControl;
  if (!value) throw new Error(`${profileId} has no HTTP Cache-Control value`);
  return value;
}

export interface RouteFreshnessPolicy {
  filePath: string;
  method: HttpMethod;
  profileId: Exclude<
    CacheProfileId,
    "build-static" | "build-revalidated"
  >;
  invalidation: CacheInvalidation;
  versionBinding: CacheVersionBinding;
}

type RoutePolicyOverride = Pick<RouteFreshnessPolicy, "profileId">;

/** Exact exceptions to the conservative request-live route-handler default. */
export const ROUTE_CACHE_POLICY_OVERRIDES: Readonly<
  Record<string, RoutePolicyOverride>
> = Object.freeze({
  "api/provenance-coverage/route.ts#GET": {
    profileId: "checked-build-artifact",
  },
  "api/reconciliation-audit/route.ts#GET": {
    profileId: "checked-build-artifact",
  },
  "api/rights-manifest/route.ts#GET": {
    profileId: "checked-build-artifact",
  },
  "api/source-coverage/route.ts#GET": {
    profileId: "checked-build-artifact",
  },
  "downloads/civica-atlas-2026-07-11.json.gz/route.ts#GET": {
    profileId: "immutable-release",
  },
  "downloads/civica-atlas-2026-07-11.manifest.json/route.ts#GET": {
    profileId: "immutable-release",
  },
});

function defaultRouteProfile(
  entry: RouteInventoryEntry,
): "public-live" | "private-live" {
  return entry.sensitive ||
    entry.exposure === "admin" ||
    entry.exposure === "chat" ||
    entry.exposure === "cron" ||
    entry.exposure === "pulse-coding"
    ? "private-live"
    : "public-live";
}

export function buildRouteFreshnessPolicy(
  routeInventory: readonly RouteInventoryEntry[],
  overrides: Readonly<Record<string, RoutePolicyOverride>> =
    ROUTE_CACHE_POLICY_OVERRIDES,
): RouteFreshnessPolicy[] {
  return routeInventory.flatMap((entry) =>
    entry.methods.map((method) => {
      const key = `${entry.filePath}#${method}`;
      const profileId =
        overrides[key]?.profileId ?? defaultRouteProfile(entry);
      const profile = CACHE_PROFILES[profileId];
      return {
        filePath: entry.filePath,
        method,
        profileId,
        invalidation: profile.invalidation,
        versionBinding: profile.versionBinding,
      };
    }),
  );
}

export const ROUTE_FRESHNESS_POLICY = Object.freeze(
  buildRouteFreshnessPolicy(ROUTE_INVENTORY),
);

export interface ExportFreshnessPolicy {
  id: string;
  filePath: string;
  builder: string;
  profileId:
    | "public-live"
    | "private-live"
    | "immutable-release";
  releaseFamily: "atlas" | null;
  note: string;
}

/**
 * Canonical public/private data export modules. CSV serializers inherit the
 * policy of the document builder in the same module.
 */
export const EXPORT_FRESHNESS_POLICY: readonly ExportFreshnessPolicy[] =
  Object.freeze([
    {
      id: "atlas-frozen-release",
      filePath: "src/lib/exports/atlas-release.ts",
      builder: "buildAtlasExport",
      profileId: "immutable-release",
      releaseFamily: "atlas",
      note: "Exact frozen vintage, cutoff, method, source-rights set, and versioned download URL.",
    },
    {
      id: "country-research-live",
      filePath: "src/lib/exports/country-research-export.ts",
      builder: "buildCountryResearchExport",
      profileId: "public-live",
      releaseFamily: null,
      note: "Request-time rights-filtered observations; each row retains its own source and method identity.",
    },
    {
      id: "indicator-history-live",
      filePath: "src/lib/exports/indicator-history-export.ts",
      builder: "buildIndicatorHistoryExport",
      profileId: "public-live",
      releaseFamily: null,
      note: "Request-time source-native history with explicit observation and source vintages.",
    },
    {
      id: "election-research-live",
      filePath: "src/lib/elections/research-export.ts",
      builder: "buildElectionResearchExport",
      profileId: "public-live",
      releaseFamily: null,
      note: "Request-time rows qualified by the checked corpus audit; not represented as a frozen release.",
    },
    {
      id: "pulse-coding-private",
      filePath: "src/lib/pulse/v2/coding-export.ts",
      builder: "projectPulseCodingExportBody",
      profileId: "private-live",
      releaseFamily: null,
      note: "Authenticated internal evidence export; always private and request-live.",
    },
  ]);

export function cacheProfileErrors(
  profiles: Readonly<Record<CacheProfileId, CacheProfile>> = CACHE_PROFILES,
): string[] {
  const errors: string[] = [];
  for (const [id, profile] of Object.entries(profiles)) {
    if (id !== profile.id) errors.push(`${id}: profile id mismatch`);
    if (profile.allowsMutableDbData && profile.allowsStaleOnError) {
      errors.push(`${id}: mutable DB data may not be served stale on error`);
    }
    if (
      profile.cacheControl &&
      /stale-while-revalidate|stale-if-error/i.test(profile.cacheControl)
    ) {
      errors.push(`${id}: stale cache directives are prohibited`);
    }
    if (
      profile.nextRouteBehavior === "request-dynamic" &&
      !profile.cacheControl?.includes("no-store")
    ) {
      errors.push(`${id}: request-dynamic profile must be no-store`);
    }
    if (
      profile.versionBinding === "frozen-release-id" &&
      profile.invalidation !== "new-versioned-url"
    ) {
      errors.push(`${id}: frozen releases must invalidate through a new URL`);
    }
  }
  return errors;
}

export function routeFreshnessPolicyErrors(
  routeInventory: readonly RouteInventoryEntry[],
  policies: readonly RouteFreshnessPolicy[],
  overrides: Readonly<Record<string, RoutePolicyOverride>> =
    ROUTE_CACHE_POLICY_OVERRIDES,
): string[] {
  const errors: string[] = [];
  const expected = new Set(
    routeInventory.flatMap((entry) =>
      entry.methods.map((method) => `${entry.filePath}#${method}`),
    ),
  );
  const seen = new Set<string>();
  for (const policy of policies) {
    const key = `${policy.filePath}#${policy.method}`;
    if (seen.has(key)) errors.push(`${key}: duplicate policy`);
    seen.add(key);
    if (!expected.has(key)) errors.push(`${key}: policy has no route method`);
    const profile = CACHE_PROFILES[policy.profileId];
    if (policy.invalidation !== profile.invalidation) {
      errors.push(`${key}: invalidation drift`);
    }
    if (policy.versionBinding !== profile.versionBinding) {
      errors.push(`${key}: version binding drift`);
    }
    if (
      (policy.profileId === "checked-build-artifact" ||
        policy.profileId === "immutable-release") &&
      policy.method !== "GET"
    ) {
      errors.push(`${key}: only GET may use a shared public cache`);
    }
  }
  for (const key of expected) {
    if (!seen.has(key)) errors.push(`${key}: missing policy`);
  }
  for (const key of Object.keys(overrides)) {
    if (!expected.has(key)) errors.push(`${key}: stale override`);
  }
  return errors;
}

export function exportFreshnessPolicyErrors(
  policies: readonly ExportFreshnessPolicy[] = EXPORT_FRESHNESS_POLICY,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const files = new Set<string>();
  for (const policy of policies) {
    if (ids.has(policy.id)) errors.push(`${policy.id}: duplicate export id`);
    ids.add(policy.id);
    if (files.has(policy.filePath)) {
      errors.push(`${policy.filePath}: duplicate export module`);
    }
    files.add(policy.filePath);
    if (policy.profileId === "immutable-release" && !policy.releaseFamily) {
      errors.push(`${policy.id}: immutable export lacks release family`);
    }
    if (policy.releaseFamily && policy.profileId !== "immutable-release") {
      errors.push(`${policy.id}: a release export must be immutable`);
    }
  }
  return errors;
}
