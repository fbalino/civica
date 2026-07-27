import assert from "node:assert/strict";
import test from "node:test";

import type { RouteFreshnessPolicy } from "../src/lib/platform/cache-consistency";
import {
  buildImportGraph,
  exportModuleCoverageErrors,
  inspectSourceModule,
  inspectHandlerCacheProfile,
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

test("only DB-dependent pages require effective revalidate zero", () => {
  const observations: PageRouteObservation[] = [
    {
      pageFile: "src/app/live/page.tsx",
      routeModules: ["src/app/live/page.tsx"],
      dependencyPath: ["src/app/live/page.tsx", "src/lib/db/index.ts"],
      effectiveRevalidate: 3600,
    },
    {
      pageFile: "src/app/live-zero/page.tsx",
      routeModules: ["src/app/live-zero/page.tsx"],
      dependencyPath: ["src/app/live-zero/page.tsx", "src/lib/db/index.ts"],
      effectiveRevalidate: 0,
    },
    {
      pageFile: "src/app/static/page.tsx",
      routeModules: ["src/app/static/page.tsx"],
      dependencyPath: null,
      effectiveRevalidate: 86400,
    },
  ];

  const errors = pageRevalidationErrors(observations);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /src\/app\/live\/page\.tsx/);
  assert.match(errors[0], /effective revalidate=3600/);
  assert.doesNotMatch(errors[0], /static/);
});

test("a newly discovered DB-backed page without a freshness declaration fails closed", () => {
  const observations: PageRouteObservation[] = [
    {
      pageFile: "src/app/new-live-page/page.tsx",
      routeModules: ["src/app/new-live-page/page.tsx"],
      dependencyPath: [
        "src/app/new-live-page/page.tsx",
        "src/lib/db/index.ts",
      ],
      effectiveRevalidate: null,
    },
  ];

  assert.deepEqual(pageRevalidationErrors(observations), [
    "src/app/new-live-page/page.tsx: reaches mutable DB data but has no literal route-level revalidate; require an effective literal revalidate=0; dependency: src/app/new-live-page/page.tsx -> src/lib/db/index.ts",
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
