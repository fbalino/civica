import type {
  HttpMethod,
  RouteInventoryEntry,
} from "@/lib/api/route-inventory/registry";
import { ROUTE_INVENTORY } from "@/lib/api/route-inventory/registry";

/**
 * PLT-014 — one closed cache/freshness vocabulary for public surfaces.
 *
 * Mutable database reads are deliberately request-live. Next.js route handlers
 * are uncached by default and database-backed pages must resolve to
 * `revalidate = 0`; there is therefore no cache entry to invalidate after a
 * write and no stale value to serve when a revalidation attempt fails.
 *
 * The only shared public caches are checked, build-owned artifacts and frozen,
 * version-addressed releases. Checked artifacts must revalidate at expiry and
 * never opt into stale-while-revalidate/stale-if-error. Frozen release URLs are
 * immutable and are replaced by a new URL rather than overwritten.
 */
export const CACHE_CONSISTENCY_SCHEMA_VERSION =
  "civica-cache-consistency/v1" as const;

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
