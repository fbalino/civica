import assert from "node:assert/strict";
import test from "node:test";

import type {
  LivePageRoute,
  RouteFreshnessPolicy,
} from "../src/lib/platform/cache-consistency";
import {
  buildImportGraph,
  exportModuleCoverageErrors,
  inspectSourceModule,
  inspectHandlerCacheProfile,
  livePageCoverageErrors,
  pageRevalidationErrors,
  routeMethodCoverageErrors,
  shortestDependencyPath,
  type PageRouteObservation,
} from "./validate-cache-consistency";
import { isRepositoryOwned } from "./repository-owned-files";

test("product inventories include tracked routes and ignore local untracked experiments", () => {
  const owned = new Set(["src/app/api/product/route.ts"]);
  assert.equal(
    isRepositoryOwned("src/app/api/product/route.ts", owned),
    true,
  );
  assert.equal(
    isRepositoryOwned("src/app/api/local-experiment/route.ts", owned),
    false,
  );
  assert.equal(
    isRepositoryOwned("src/app/api/archive-fallback/route.ts", null),
    true,
  );
});

test("source inspection ignores type-only imports and permits React render-pass cache", () => {
  const facts = inspectSourceModule(
    "src/lib/db/queries-example.ts",
    `
      import type { Row } from "./schema";
      import { cache } from "react";
      import { db } from "./index";
      export const revalidate = 0 as const;
      export async function getRows(): Promise<Row[]> { return db.select(); }
      export const getMore = async () => [];
    `,
  );

  assert.deepEqual(facts.runtimeImports, ["./index", "react"]);
  assert.deepEqual(facts.exportedAsyncFunctions, ["getMore", "getRows"]);
  assert.equal(facts.revalidate, 0);
  assert.deepEqual(facts.persistentCacheApis, []);
});

test("source inspection detects every prohibited persistent-cache family", () => {
  const facts = inspectSourceModule(
    "src/lib/db/queries-example.ts",
    `
      "use cache";
      import { unstable_cache } from "next/cache";
      export async function getRows() {
        unstable_cache(async () => []);
        await fetch("https://example.test", { cache: "force-cache" });
        await fetch("https://example.test/2", { next: { revalidate: 60 } });
      }
    `,
  );

  assert.deepEqual(facts.persistentCacheApis, [
    "call:unstable_cache",
    "directive:use cache",
    "fetch:force-cache",
    "fetch:next-cache-options",
    "import:next/cache",
  ]);
});

test("runtime import graph follows re-exports and literal dynamic imports without type edges", () => {
  const modules = [
    inspectSourceModule(
      "src/app/page.tsx",
      `import { View } from "../components/View"; export default View;`,
    ),
    inspectSourceModule(
      "src/components/View.tsx",
      `export { load } from "../lib/data"; import("../lib/lazy"); require("../lib/commonjs");`,
    ),
    inspectSourceModule(
      "src/lib/data.ts",
      `import type { Db } from "./db/index"; export const load = () => null;`,
    ),
    inspectSourceModule(
      "src/lib/lazy.ts",
      `import { db } from "./db/index"; export const value = db;`,
    ),
    inspectSourceModule("src/lib/db/index.ts", `export const db = {};`),
    inspectSourceModule("src/lib/commonjs.ts", `export const value = 1;`),
  ];
  const resolutions = new Map([
    ["src/app/page.tsx::../components/View", "src/components/View.tsx"],
    ["src/components/View.tsx::../lib/data", "src/lib/data.ts"],
    ["src/components/View.tsx::../lib/lazy", "src/lib/lazy.ts"],
    ["src/components/View.tsx::../lib/commonjs", "src/lib/commonjs.ts"],
    ["src/lib/lazy.ts::./db/index", "src/lib/db/index.ts"],
  ]);
  const graph = buildImportGraph(
    modules,
    (from, specifier) => resolutions.get(`${from}::${specifier}`) ?? null,
  );

  assert.deepEqual(graph.unresolvedLocalImports, []);
  assert.deepEqual(
    shortestDependencyPath(
      graph.edges,
      ["src/app/page.tsx"],
      new Set(["src/lib/db/index.ts"]),
    ),
    [
      "src/app/page.tsx",
      "src/components/View.tsx",
      "src/lib/lazy.ts",
      "src/lib/db/index.ts",
    ],
  );
});

test("import graph terminates cycles and reports unresolved local runtime edges", () => {
  const modules = [
    inspectSourceModule("src/a.ts", `import "./b"; import "./missing";`),
    inspectSourceModule("src/b.ts", `import "./a";`),
  ];
  const graph = buildImportGraph(modules, (from, specifier) => {
    if (`${from}::${specifier}` === "src/a.ts::./b") return "src/b.ts";
    if (`${from}::${specifier}` === "src/b.ts::./a") return "src/a.ts";
    return null;
  });

  assert.deepEqual(graph.unresolvedLocalImports, ["src/a.ts -> ./missing"]);
  assert.equal(
    shortestDependencyPath(graph.edges, ["src/a.ts"], new Set(["src/db.ts"])),
    null,
  );
});

const LIVE_FIXTURES: LivePageRoute[] = [
  {
    file: "src/app/(admin)/layout.tsx",
    routePath: "/admin",
    reason: "private-session",
    note: "Admin workspace.",
  },
  {
    file: "src/app/filtered/page.tsx",
    routePath: "/filtered",
    reason: "request-input",
    note: "Filters come from the query string.",
  },
];

function dbPage(
  pageFile: string,
  overrides: Partial<PageRouteObservation> = {},
): PageRouteObservation {
  return {
    pageFile,
    routeModules: [pageFile],
    dependencyPath: [pageFile, "src/lib/db/index.ts"],
    effectiveRevalidate: 86400,
    requestInput: null,
    dynamicSegment: false,
    generatesStaticParams: false,
    ...overrides,
  };
}

test("DB-dependent pages require the daily cache literal unless listed live", () => {
  const observations: PageRouteObservation[] = [
    dbPage("src/app/hourly/page.tsx", { effectiveRevalidate: 3600 }),
    dbPage("src/app/still-zero/page.tsx", { effectiveRevalidate: 0 }),
    dbPage("src/app/cached/page.tsx"),
    dbPage("src/app/(admin)/admin/page.tsx", {
      routeModules: ["src/app/(admin)/admin/page.tsx", "src/app/(admin)/layout.tsx"],
      effectiveRevalidate: 0,
    }),
    {
      pageFile: "src/app/static/page.tsx",
      routeModules: ["src/app/static/page.tsx"],
      dependencyPath: null,
      effectiveRevalidate: null,
    },
  ];

  const errors = pageRevalidationErrors(observations, LIVE_FIXTURES);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /src\/app\/hourly\/page\.tsx/);
  assert.match(errors[0], /effective revalidate=3600/);
  assert.match(errors[1], /src\/app\/still-zero\/page\.tsx/);
  assert.match(errors[1], /require an effective literal revalidate=86400/);
});

test("a listed live page must stay request-live", () => {
  assert.deepEqual(
    pageRevalidationErrors(
      [
        dbPage("src/app/(admin)/admin/page.tsx", {
          routeModules: [
            "src/app/(admin)/admin/page.tsx",
            "src/app/(admin)/layout.tsx",
          ],
        }),
      ],
      LIVE_FIXTURES,
    ).map((error) => error.split(";")[0]),
    [
      "src/app/(admin)/admin/page.tsx: listed live by src/app/(admin)/layout.tsx but has effective revalidate=86400",
    ],
  );
});

test("a cached page that reads request input fails closed", () => {
  const errors = pageRevalidationErrors(
    [
      dbPage("src/app/quietly-dynamic/page.tsx", {
        requestInput: ["src/app/quietly-dynamic/page.tsx (searchParams)"],
      }),
    ],
    LIVE_FIXTURES,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /declared cached but reads per-request input/);
});

test("a cached page under a dynamic segment must export generateStaticParams", () => {
  const errors = pageRevalidationErrors(
    [
      dbPage("src/app/things/[slug]/page.tsx", { dynamicSegment: true }),
      dbPage("src/app/others/[slug]/page.tsx", {
        dynamicSegment: true,
        generatesStaticParams: true,
      }),
    ],
    LIVE_FIXTURES,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /things\/\[slug\].*must export generateStaticParams/);
});

test("a newly discovered DB-backed page without a freshness declaration fails closed", () => {
  assert.deepEqual(
    pageRevalidationErrors(
      [dbPage("src/app/new-live-page/page.tsx", { effectiveRevalidate: null })],
      LIVE_FIXTURES,
    ),
    [
      "src/app/new-live-page/page.tsx: reaches mutable DB data but has no literal route-level revalidate; require an effective literal revalidate=86400 or a LIVE_PAGE_ROUTES entry; dependency: src/app/new-live-page/page.tsx -> src/lib/db/index.ts",
    ],
  );
});

test("the live-page allowlist rejects stale, undeclared, and no-longer-dynamic entries", () => {
  const facts = new Map([
    ["src/app/(admin)/layout.tsx", { revalidate: 0 as const }],
    ["src/app/filtered/page.tsx", { revalidate: 86400 }],
  ]);
  const errors = livePageCoverageErrors(
    [dbPage("src/app/filtered/page.tsx", { effectiveRevalidate: 86400 })],
    facts,
    LIVE_FIXTURES,
  );
  assert.deepEqual(errors, [
    "src/app/(admin)/layout.tsx: stale live page entry wraps no DB-dependent page",
    "src/app/filtered/page.tsx: live for request input but reads none; cache it with revalidate=86400",
    "src/app/filtered/page.tsx: live page entry must declare revalidate = 0",
  ]);
});

test("a live layout may not wrap a page outside its declared subtree", () => {
  const errors = livePageCoverageErrors(
    [
      dbPage("src/app/(admin)/public-leak/page.tsx", {
        routeModules: [
          "src/app/(admin)/public-leak/page.tsx",
          "src/app/(admin)/layout.tsx",
        ],
        effectiveRevalidate: 0,
      }),
    ],
    new Map([["src/app/(admin)/layout.tsx", { revalidate: 0 as const }]]),
    [LIVE_FIXTURES[0]],
  );
  assert.deepEqual(errors, [
    "src/app/(admin)/layout.tsx: wraps /public-leak, outside its declared /admin",
  ]);
});

test("source inspection records request-time APIs but not comments or type-only imports", () => {
  const page = inspectSourceModule(
    "src/app/example/page.tsx",
    `
      // searchParams used to live here.
      import type { cookies } from "next/headers";
      export default async function Page() { return null; }
    `,
  );
  assert.equal(page.mentionsSearchParams, false);
  assert.deepEqual(page.requestApis, []);

  const live = inspectSourceModule(
    "src/app/live/layout.tsx",
    `
      import { connection } from "next/server";
      import { headers } from "next/headers";
      export const dynamic = "force-dynamic";
      export default async function Layout({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
        await connection();
        await headers();
        return (await searchParams).q;
      }
    `,
  );
  assert.equal(live.mentionsSearchParams, true);
  assert.deepEqual(live.requestApis, [
    "dynamic:force-dynamic",
    "next/headers",
    "next/server:connection",
  ]);
});

test("a newly discovered API method without a cache policy fails closed", () => {
  assert.deepEqual(
    routeMethodCoverageErrors(["api/new-live-route/route.ts#GET"], []),
    [
      "api/new-live-route/route.ts#GET: route method has no cache policy",
    ],
  );
});

test("API method and export module closure reject missing and stale declarations", () => {
  const policies: RouteFreshnessPolicy[] = [
    {
      filePath: "api/declared/route.ts",
      method: "GET",
      profileId: "public-live",
      invalidation: "per-request",
      versionBinding: "live-source-observation",
    },
  ];
  assert.deepEqual(
    routeMethodCoverageErrors(
      ["api/phantom/route.ts#GET"],
      policies,
    ),
    [
      "api/declared/route.ts#GET: cache policy has no route method on disk",
      "api/phantom/route.ts#GET: route method has no cache policy",
    ],
  );

  const facts = new Map([
    [
      "src/lib/exports/declared-export.ts",
      inspectSourceModule(
        "src/lib/exports/declared-export.ts",
        `export function buildDeclaredExport() { return {}; }`,
      ),
    ],
    [
      "src/lib/exports/phantom-export.ts",
      inspectSourceModule(
        "src/lib/exports/phantom-export.ts",
        `export function buildPhantomExport() { return {}; }`,
      ),
    ],
  ]);
  const exportErrors = exportModuleCoverageErrors(
    [...facts.keys()],
    [
      {
        id: "declared",
        filePath: "src/lib/exports/declared-export.ts",
        builder: "wrongBuilder",
        profileId: "public-live",
        releaseFamily: null,
        note: "fixture",
      },
    ],
    facts,
  );
  assert.ok(exportErrors.some((error) => /phantom-export.*no freshness policy/.test(error)));
  assert.ok(exportErrors.some((error) => /wrongBuilder is not exported/.test(error)));
});

test("route cache proof rejects the bare success response that policy inventory missed", () => {
  const report = inspectHandlerCacheProfile(
    `
      import { NextResponse } from "next/server";
      import { cacheControlFor } from "@/lib/platform/cache-consistency";
      export async function GET() {
        if (Date.now() < 0) {
          return NextResponse.json(
            { error: "Unavailable", code: "DATA_UNAVAILABLE" },
            { status: 503, headers: { "Cache-Control": cacheControlFor("public-live") } },
          );
        }
        return NextResponse.json({ ok: true });
      }
    `,
    "GET",
    "public-live",
  );

  assert.deepEqual(
    report.findings.map(({ kind }) => kind),
    ["response-cache-missing"],
  );
});

test("route cache proof follows reachable local helpers and ignores dead cache mentions", () => {
  const report = inspectHandlerCacheProfile(
    `
      import { NextResponse } from "next/server";
      import { cacheControlFor } from "@/lib/platform/cache-consistency";
      function dead() {
        return NextResponse.json({ dead: true }, {
          headers: { "Cache-Control": cacheControlFor("public-live") },
        });
      }
      function live() {
        return NextResponse.json({ ok: true });
      }
      export function GET() { return live(); }
    `,
    "GET",
    "public-live",
  );

  assert.deepEqual(
    report.findings.map(({ kind }) => kind),
    ["response-cache-missing"],
  );
});

test("route cache proof accepts exact final boundaries and rejects profile drift", () => {
  const safe = inspectHandlerCacheProfile(
    `
      import { withSafeJsonErrors } from "@/lib/api/problem-response";
      export function GET() {
        return withSafeJsonErrors("fixture", () => Response.json({ ok: true }));
      }
    `,
    "GET",
    "public-live",
  );
  assert.deepEqual(safe.findings, []);

  const drift = inspectHandlerCacheProfile(
    `
      import { withSafeJsonErrors } from "@/lib/api/problem-response";
      export function POST() {
        return withSafeJsonErrors("fixture", () => Response.json({ ok: true }));
      }
    `,
    "POST",
    "private-live",
  );
  assert.deepEqual(
    drift.findings.map(({ kind }) => kind),
    ["boundary-profile-mismatch"],
  );

  const unused = inspectHandlerCacheProfile(
    `
      import { withSafeJsonErrors } from "@/lib/api/problem-response";
      function live() { return Response.json({ ok: true }); }
      export function GET() {
        withSafeJsonErrors("unused", () => Response.json({ ignored: true }));
        return live();
      }
    `,
    "GET",
    "public-live",
  );
  assert.ok(
    unused.findings.some(({ kind }) => kind === "response-cache-missing"),
  );
});
