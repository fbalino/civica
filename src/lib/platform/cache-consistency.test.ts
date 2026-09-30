import assert from "node:assert/strict";
import test from "node:test";

import type { RouteInventoryEntry } from "@/lib/api/route-inventory/registry";
import {
  CACHE_PROFILES,
  EXPORT_FRESHNESS_POLICY,
  PAGE_CACHE_REVALIDATE_SECONDS,
  ROUTE_FRESHNESS_POLICY,
  buildRouteFreshnessPolicy,
  cacheControlFor,
  cacheProfileErrors,
  exportFreshnessPolicyErrors,
  isLivePagePath,
  livePageRouteErrors,
  routeFreshnessPolicyErrors,
  routePathForModule,
  type CacheProfile,
  type CacheProfileId,
  type ExportFreshnessPolicy,
} from "./cache-consistency";
import { ROUTE_INVENTORY } from "@/lib/api/route-inventory/registry";

test("canonical cache profiles are internally valid and prohibit stale mutable data", () => {
  assert.deepEqual(cacheProfileErrors(), []);
  assert.equal(cacheControlFor("public-live"), "no-store");
  assert.equal(cacheControlFor("private-live"), "private, no-store");
  assert.equal(
    cacheControlFor("checked-build-artifact"),
    "public, max-age=3600, must-revalidate",
  );
  assert.equal(
    cacheControlFor("immutable-release"),
    "public, max-age=31536000, immutable",
  );
  for (const profile of Object.values(CACHE_PROFILES)) {
    if (profile.allowsMutableDbData) {
      assert.equal(profile.allowsStaleOnError, false, profile.id);
      assert.match(profile.cacheControl ?? "", /no-store/, profile.id);
    }
  }
});

test("seeded stale-on-error and stale-while-revalidate profiles fail closed", () => {
  const profiles = {
    ...CACHE_PROFILES,
    "public-live": {
      ...CACHE_PROFILES["public-live"],
      allowsStaleOnError: true,
      cacheControl: "public, max-age=60, stale-while-revalidate=600",
    },
  } as Readonly<Record<CacheProfileId, CacheProfile>>;

  const errors = cacheProfileErrors(profiles);
  assert.ok(errors.some((error) => /mutable DB data may not be served stale/.test(error)));
  assert.ok(errors.some((error) => /stale cache directives are prohibited/.test(error)));
  assert.ok(errors.some((error) => /request-dynamic profile must be no-store/.test(error)));
});

test("every tracked API method has exactly one canonical freshness policy", () => {
  assert.ok(ROUTE_INVENTORY.length > 0);
  assert.deepEqual(
    routeFreshnessPolicyErrors(ROUTE_INVENTORY, ROUTE_FRESHNESS_POLICY),
    [],
  );
  assert.equal(
    ROUTE_FRESHNESS_POLICY.length,
    ROUTE_INVENTORY.reduce((count, entry) => count + entry.methods.length, 0),
  );
});

test("route policy construction defaults public reads live and sensitive routes private", () => {
  const fixture: RouteInventoryEntry[] = [
    {
      filePath: "api/public/route.ts",
      exposure: "public-read",
      methods: ["GET"],
      mutation: false,
      sensitive: false,
      controls: ["public"],
      note: "fixture",
    },
    {
      filePath: "api/private/route.ts",
      exposure: "admin",
      methods: ["GET", "POST"],
      mutation: true,
      sensitive: true,
      controls: ["admin-session"],
      note: "fixture",
    },
  ];

  assert.deepEqual(buildRouteFreshnessPolicy(fixture, {}), [
    {
      filePath: "api/public/route.ts",
      method: "GET",
      profileId: "public-live",
      invalidation: "per-request",
      versionBinding: "live-source-observation",
    },
    {
      filePath: "api/private/route.ts",
      method: "GET",
      profileId: "private-live",
      invalidation: "per-request",
      versionBinding: "live-source-observation",
    },
    {
      filePath: "api/private/route.ts",
      method: "POST",
      profileId: "private-live",
      invalidation: "per-request",
      versionBinding: "live-source-observation",
    },
  ]);
});

test("missing, duplicate, orphaned, and stale-override route policies are rejected", () => {
  const fixture: RouteInventoryEntry[] = [
    {
      filePath: "api/example/route.ts",
      exposure: "public-read",
      methods: ["GET", "POST"],
      mutation: true,
      sensitive: false,
      controls: ["public"],
      note: "fixture",
    },
  ];
  const canonical = buildRouteFreshnessPolicy(fixture, {});
  const seeded = [
    canonical[0],
    canonical[0],
    {
      ...canonical[0],
      filePath: "api/orphan/route.ts",
    },
  ];
  const errors = routeFreshnessPolicyErrors(fixture, seeded, {
    "api/stale/route.ts#GET": { profileId: "checked-build-artifact" },
  });

  assert.ok(errors.some((error) => /duplicate policy/.test(error)));
  assert.ok(errors.some((error) => /policy has no route method/.test(error)));
  assert.ok(errors.some((error) => /api\/example\/route\.ts#POST: missing policy/.test(error)));
  assert.ok(errors.some((error) => /api\/stale\/route\.ts#GET: stale override/.test(error)));
});

test("canonical export policies are closed and seeded release drift is rejected", () => {
  assert.deepEqual(exportFreshnessPolicyErrors(), []);
  assert.ok(EXPORT_FRESHNESS_POLICY.length > 0);

  const duplicate: ExportFreshnessPolicy = {
    ...EXPORT_FRESHNESS_POLICY[0],
    filePath: "src/lib/exports/duplicate.ts",
  };
  const mutableRelease: ExportFreshnessPolicy = {
    id: "mutable-release-fixture",
    filePath: "src/lib/exports/mutable.ts",
    builder: "buildMutableExport",
    profileId: "public-live",
    releaseFamily: "atlas",
    note: "fixture",
  };
  const errors = exportFreshnessPolicyErrors([
    ...EXPORT_FRESHNESS_POLICY,
    duplicate,
    mutableRelease,
  ]);
  assert.ok(errors.some((error) => /duplicate export id/.test(error)));
  assert.ok(errors.some((error) => /a release export must be immutable/.test(error)));
});

test("page module paths drop route groups and map to their URL path", () => {
  assert.equal(routePathForModule("src/app/page.tsx"), "/");
  assert.equal(
    routePathForModule("src/app/(reader)/country/[slug]/civica-data/page.tsx"),
    "/country/[slug]/civica-data",
  );
  assert.equal(routePathForModule("src/app/(admin)/layout.tsx"), "/");
  assert.equal(routePathForModule("src/app/sitemap.ts"), "/");
});

test("live page paths cover a layout subtree but only the exact page path", () => {
  assert.equal(isLivePagePath("/admin/messages/42"), true);
  assert.equal(isLivePagePath("/compare"), true);
  assert.equal(isLivePagePath("/compare/"), true);
  assert.equal(isLivePagePath("/constitution"), true);
  assert.equal(isLivePagePath("/country/france/constitution"), false);
  assert.equal(isLivePagePath("/country/france"), false);
  assert.equal(isLivePagePath("/"), false);
});

test("the checked live-page allowlist is internally consistent", () => {
  assert.deepEqual(livePageRouteErrors(), []);
  assert.equal(PAGE_CACHE_REVALIDATE_SECONDS, 86400);
});

test("seeded live-page allowlist defects fail closed", () => {
  assert.deepEqual(
    livePageRouteErrors([
      {
        file: "src/app/rankings/page.tsx",
        routePath: "/rankings/all",
        reason: "request-input",
        note: "Filters.",
      },
      {
        file: "src/app/about/page.tsx",
        routePath: "/about",
        reason: "private-session",
        note: " ",
      },
    ]),
    [
      "src/app/rankings/page.tsx: routePath /rankings/all does not match /rankings",
      "src/app/about/page.tsx: private-session pages must live under /admin",
      "src/app/about/page.tsx: live page entry needs a note",
    ],
  );
});
