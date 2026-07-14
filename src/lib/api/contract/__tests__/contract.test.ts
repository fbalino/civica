/**
 * CLM-012 — API contract test suite.
 *
 * DB-free (`npm test`, glob: src/**\/*.test.ts). Two halves:
 *
 *   1. Positive: the real `contract/registry.ts` + `contract/examples.ts`
 *      are internally consistent (mirrors what `validate:api-docs`
 *      checks, but visible under `npm test` too).
 *   2. Negative: nine deterministic mutated fixtures, one per failure
 *      mode CLM-012 requires coverage for — excess field, missing
 *      field, date mismatch, stripped deprecation, phantom route,
 *      uncontracted route, projection extra field, param drift, CSV
 *      header drift. Each asserts the relevant strict schema or pure
 *      validator function actually catches the mutation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { API_ROUTES } from "../registry";
import {
  EXPORT_RATE_LIMIT_MAX,
  EXPORT_RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_EXCEEDED_STATUS,
  RATE_LIMIT_STORE_UNAVAILABLE_STATUS,
  V1_RATE_LIMIT_MAX,
  V1_RATE_LIMIT_WINDOW_MS,
} from "../rate-limits";
import { EXAMPLES } from "../examples";
import {
  zCountryListItem,
  zDeprecationEntry,
  zCountriesListResponse,
} from "../schemas";
import { shapeCountryListItem } from "../shapes";
import {
  findPhantomRoutes,
  findRateLimitContractIssues,
  findUncontractedEntries,
  findUndocumentedRoutes,
  diffParams,
  deprecationMismatch,
  deprecationScopeMismatch,
  hasInlineCsvHeader,
  isRightsBlockedExport,
  usesSharedCsvBuilder,
  filePathToPathTemplate,
} from "../../../../../scripts/validate-api-docs";
import { STRUCTURAL_FAMILY_SUNSET_DATE_ISO } from "@/lib/api/deprecation";

// ─────────────────────────────────────────────────────────────────────
// Positive: the real registry + examples are internally consistent
// ─────────────────────────────────────────────────────────────────────

test("every registry route has a matching, schema-valid example", () => {
  for (const route of API_ROUTES) {
    assert.ok(
      route.exampleId in EXAMPLES,
      `route "${route.id}" declares exampleId "${route.exampleId}" with no EXAMPLES entry`,
    );
  }
});

test("every /v1 registry route path uses the :param convention filePathToPathTemplate expects", () => {
  for (const route of API_ROUTES.filter((r) => r.versioned)) {
    assert.equal(filePathToPathTemplate(route.filePath), route.pathTemplate);
  }
});

test("no duplicate route ids or path+method pairs in the registry", () => {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const route of API_ROUTES) {
    assert.ok(!ids.has(route.id), `duplicate id: ${route.id}`);
    ids.add(route.id);
    const key = `${route.method} ${route.pathTemplate}`;
    assert.ok(!paths.has(key), `duplicate path+method: ${key}`);
    paths.add(key);
  }
});

test("every /api/v1 GET declares the canonical distributed fail-closed limit", () => {
  const versionedRoutes = API_ROUTES.filter((route) => route.versioned);
  assert.ok(versionedRoutes.length > 0);

  for (const route of versionedRoutes) {
    assert.equal(route.method, "GET", route.id);
    assert.deepEqual(
      route.rateLimit,
      {
        max: V1_RATE_LIMIT_MAX,
        windowMs: V1_RATE_LIMIT_WINDOW_MS,
        scope: "per-validated-client-identity",
        backend: "postgres",
        countedMethods: ["GET"],
        exceededStatus: RATE_LIMIT_EXCEEDED_STATUS,
        storeUnavailableStatus: RATE_LIMIT_STORE_UNAVAILABLE_STATUS,
      },
      route.id,
    );
    assert.ok(
      route.errorStatuses.includes(RATE_LIMIT_EXCEEDED_STATUS),
      `${route.id} must document the limited response`,
    );
    assert.ok(
      route.errorStatuses.includes(RATE_LIMIT_STORE_UNAVAILABLE_STATUS),
      `${route.id} must document the shared-counter outage response`,
    );
  }
});

test("country export declares its canonical distributed limit without changing CORS", () => {
  const route = API_ROUTES.find(({ id }) => id === "country-export");
  assert.ok(route);
  assert.deepEqual(route.rateLimit, {
    max: EXPORT_RATE_LIMIT_MAX,
    windowMs: EXPORT_RATE_LIMIT_WINDOW_MS,
    scope: "per-validated-client-identity",
    backend: "postgres",
    countedMethods: ["GET"],
    exceededStatus: RATE_LIMIT_EXCEEDED_STATUS,
    storeUnavailableStatus: RATE_LIMIT_STORE_UNAVAILABLE_STATUS,
  });
  assert.ok(route.errorStatuses.includes(RATE_LIMIT_EXCEEDED_STATUS));
  assert.ok(route.errorStatuses.includes(RATE_LIMIT_STORE_UNAVAILABLE_STATUS));
  assert.equal(route.cors, false);
  assert.equal(route.corsHeaders, null);
});

test("API docs validator rejects missing limits and undocumented counter outages", () => {
  assert.deepEqual(findRateLimitContractIssues(API_ROUTES), []);

  const countries = API_ROUTES.find(({ id }) => id === "countries");
  assert.ok(countries);
  assert.match(
    findRateLimitContractIssues([{ ...countries, rateLimit: null }]).join("\n"),
    /has no distributed rate-limit contract/,
  );
  assert.match(
    findRateLimitContractIssues([
      {
        ...countries,
        errorStatuses: countries.errorStatuses.filter(
          (status) => status !== RATE_LIMIT_STORE_UNAVAILABLE_STATUS,
        ),
      },
    ]).join("\n"),
    /does not document 503/,
  );
});

test("API Docs renders shared limits from the registry and contains no stale instance-local claims", async () => {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const source = await readFile(
    path.join(process.cwd(), "src/app/api-docs/page.tsx"),
    "utf8",
  );
  const normalized = source.replace(/\s+/g, " ");

  assert.match(normalized, /PostgreSQL-backed counter/);
  assert.match(normalized, /OPTIONS.*do not consume either counter/);
  assert.match(source, /countriesRoute\.rateLimit\?\.max/);
  assert.match(source, /countryExportRoute\.rateLimit\?\.max/);
  assert.match(source, /storeUnavailableStatus/);
  assert.doesNotMatch(normalized, /in-memory, per server instance/i);
  assert.doesNotMatch(normalized, /export.*not currently rate-limited/i);
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture 1/9 — excess field
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: excess field is rejected by a strict schema", () => {
  const valid = EXAMPLES.countries.data[0];
  const withExcessField = { ...valid, notARealField: "surprise" };
  assert.throws(() => zCountryListItem.parse(withExcessField), z.ZodError);
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture 2/9 — missing field
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: missing required field is rejected", () => {
  const valid = EXAMPLES.countries.data[0];
  const withoutSlug: Partial<typeof valid> = { ...valid };
  delete withoutSlug.slug;
  assert.throws(() => zCountryListItem.parse(withoutSlug), z.ZodError);
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture 3/9 — date mismatch
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: a deprecation sunset date that drifts from deprecation.ts is rejected", () => {
  const realEntry = EXAMPLES.countryDetail.meta.deprecations[0];
  assert.equal(realEntry.sunset, STRUCTURAL_FAMILY_SUNSET_DATE_ISO);
  const wrongDate = { ...realEntry, sunset: "2099-01-01" };
  assert.throws(() => zDeprecationEntry.parse(wrongDate), z.ZodError);
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture 4/9 — stripped deprecation
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: stripped deprecation call is caught by deprecationMismatch", () => {
  const sourceWithoutHelper = `
    export async function GET() {
      return apiResponse({ data: [] });
    }
  `;
  const result = deprecationMismatch(
    "countries",
    "fake/route.ts",
    true,
    sourceWithoutHelper,
  );
  assert.ok(
    result,
    "expected a mismatch message when the deprecation contract is set but the helper is unused",
  );
  assert.match(result!, /never calls withStructuralFamilyDeprecation/);
});

test("negative fixture: an undeclared deprecation helper call is also caught", () => {
  const sourceWithHelper = `
    export async function GET() {
      return withStructuralFamilyDeprecation(apiResponse({ data: [] }));
    }
  `;
  const result = deprecationMismatch(
    "index-methodology",
    "fake/route.ts",
    false,
    sourceWithHelper,
  );
  assert.ok(
    result,
    "expected a mismatch message when the route calls the helper but has no registry contract",
  );
  assert.match(
    result!,
    /stripped deprecation headers or a missing registry entry/,
  );
});

test("negative fixture: a deprecated route that leaves 429 undecorated is caught", () => {
  const source = `
    const rateLimited = withRateLimit(request);
    if (rateLimited) return rateLimited;
    return withStructuralFamilyDeprecation(apiResponse({ data: [] }));
  `;
  assert.match(
    deprecationScopeMismatch("countries", "fake/route.ts", "always", source) ??
      "",
    /does not decorate its 429/,
  );
});

test("negative fixture: conditional deprecation must cover success, 429, and 500", () => {
  const incomplete = `
    const isDeprecatedTaxonomy = taxonomy === "structural";
    if (rateLimited) return rateLimited;
    return isDeprecatedTaxonomy
      ? withStructuralFamilyDeprecation(response)
      : response;
  `;
  assert.match(
    deprecationScopeMismatch(
      "index-by-government-type",
      "fake/route.ts",
      "taxonomy-structural-regime",
      incomplete,
    ) ?? "",
    /does not apply its conditional taxonomy deprecation consistently/,
  );
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture 5/9 — phantom route
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: a live route path absent from the registry is a phantom route", () => {
  const liveV1Paths = new Set([
    ...API_ROUTES.filter((r) => r.versioned).map((r) => r.pathTemplate),
    "/api/v1/countries/:code/shadow-endpoint",
  ]);
  const phantoms = findPhantomRoutes(liveV1Paths, API_ROUTES);
  assert.deepEqual(phantoms, ["/api/v1/countries/:code/shadow-endpoint"]);
});

test("the real live registry has zero phantom routes against itself", () => {
  const liveV1Paths = new Set(
    API_ROUTES.filter((r) => r.versioned).map((r) => r.pathTemplate),
  );
  assert.deepEqual(findPhantomRoutes(liveV1Paths, API_ROUTES), []);
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture 6/9 — uncontracted route (stale registry entry)
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: a registry entry whose file no longer exists is uncontracted", () => {
  const registry = [
    { id: "real-route", filePath: "src/app/api/v1/countries/route.ts" },
    {
      id: "deleted-route",
      filePath: "src/app/api/v1/countries/[code]/old-route.ts",
    },
  ];
  const knownFiles = new Set(["src/app/api/v1/countries/route.ts"]);
  assert.deepEqual(findUncontractedEntries(registry, knownFiles), [
    "deleted-route",
  ]);
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture 7/9 — projection extra field
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: a shape function itself rejects a smuggled extra field", () => {
  const leaked = {
    slug: "testland",
    name: "Testland",
    iso2: "TL",
    iso3: "TLD",
    continent: "Europe",
    capital: "Test City",
    population: 1000,
    governmentType: "presidential republic",
    governmentTypeDetail: null,
    gdpBillions: 1,
    areaSqKm: 100,
    flagUrl: null,
    governmentClassification: null,
    jurisdictionStatus: EXAMPLES.countries.data[0]!.jurisdictionStatus,
    id: "internal-db-uuid-should-never-be-public",
  };
  assert.throws(
    () =>
      shapeCountryListItem(
        leaked as Parameters<typeof shapeCountryListItem>[0],
      ),
    z.ZodError,
  );
});

test("negative fixture: an incomplete response envelope (missing meta.deprecations) fails strict parsing", () => {
  const valid = EXAMPLES.countries;
  const metaWithoutDeprecations: Partial<typeof valid.meta> = { ...valid.meta };
  delete metaWithoutDeprecations.deprecations;
  const broken = { ...valid, meta: metaWithoutDeprecations };
  assert.throws(() => zCountriesListResponse.parse(broken), z.ZodError);
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture 8/9 — param drift
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: a documented query param the handler never reads is flagged", () => {
  const sourceMissingContinent = `
    export async function GET(request: Request) {
      const url = new URL(request.url);
      const limit = url.searchParams.get("limit");
      return apiResponse({ data: [] });
    }
  `;
  const errors = diffParams(
    "countries",
    "fake/route.ts",
    [
      { in: "query", name: "continent" },
      { in: "query", name: "limit" },
    ],
    sourceMissingContinent,
  );
  assert.equal(errors.length, 1);
  assert.match(
    errors[0],
    /documents query param "continent" but no searchParams/,
  );
});

test("negative fixture: a param the handler reads but the registry never declares is flagged", () => {
  const sourceWithUndeclaredParam = `
    export async function GET(request: Request) {
      const url = new URL(request.url);
      const secret = url.searchParams.get("undocumented_debug_flag");
      return apiResponse({ data: [] });
    }
  `;
  const errors = diffParams(
    "countries",
    "fake/route.ts",
    [],
    sourceWithUndeclaredParam,
  );
  assert.equal(errors.length, 1);
  assert.match(
    errors[0],
    /reads query param "undocumented_debug_flag".*not declared/,
  );
});

test("registry-backed query contracts contribute their exact schema keys", () => {
  const source = `
    export async function GET(request: Request) {
      const query = parseQueryContract(request, "v1-countries-query/v1");
      return apiResponse({ data: query });
    }
  `;
  const exact = [
    "as_of",
    "continent",
    "government_type",
    "taxonomy",
    "limit",
    "offset",
    "status",
  ].map((name) => ({ in: "query" as const, name }));
  assert.deepEqual(diffParams("countries", "fake/route.ts", exact, source), []);

  const missing = diffParams(
    "countries",
    "fake/route.ts",
    exact.filter(({ name }) => name !== "status"),
    source,
  );
  assert.equal(missing.length, 1);
  assert.match(missing[0], /reads query param "status".*not declared/);
});

test("an unknown query-contract id cannot bypass param drift", () => {
  const source = `
    export async function GET(request: Request) {
      return parseQueryContract(request, "not-registered/v1");
    }
  `;
  const errors = diffParams("broken", "fake/route.ts", [], source);
  assert.equal(errors.length, 1);
  assert.match(
    errors[0],
    /invokes unknown query contract "not-registered\/v1"/,
  );
});

test("query param drift ignores parser and searchParams text in comments", () => {
  const source = `
    export async function GET() {
      // parseQueryContract(request, "not-registered/v1");
      // request.nextUrl.searchParams.get("undocumented_debug_flag");
      return apiResponse({ data: [] });
    }
  `;
  assert.deepEqual(diffParams("comments", "fake/route.ts", [], source), []);
});

test("the real registry has zero param drift for every route", async () => {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  for (const route of API_ROUTES) {
    const source = await readFile(
      path.join(process.cwd(), route.filePath),
      "utf8",
    );
    const errors = diffParams(route.id, route.filePath, route.params, source);
    assert.deepEqual(
      errors,
      [],
      `unexpected param drift on route "${route.id}": ${errors.join("; ")}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture 9/9 — CSV header drift
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: a re-inlined CSV header string is flagged", () => {
  const regressed = `
    const header = "category,key,value,numeric_value,unit,year";
    return new Response([header, ...rows].join("\\n"));
  `;
  assert.equal(hasInlineCsvHeader(regressed), true);
  assert.equal(usesSharedCsvBuilder(regressed), false);
});

test("the real export route uses the rights-filtered shared CSV builder", async () => {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const source = await readFile(
    path.join(process.cwd(), "src/app/api/countries/[slug]/export/route.ts"),
    "utf8",
  );
  assert.equal(hasInlineCsvHeader(source), false);
  assert.equal(usesSharedCsvBuilder(source), true);
  assert.equal(isRightsBlockedExport(source), false);
});

// ─────────────────────────────────────────────────────────────────────
// Docs coverage sanity (complements the 9 required fixtures above)
// ─────────────────────────────────────────────────────────────────────

test("findUndocumentedRoutes flags a route missing from the docs page source", () => {
  const registry = [
    { id: "documented", docSectionId: "documented" },
    { id: "missing", docSectionId: "missing" },
  ];
  const pageSource = `<EndpointSection id="documented" routeId="documented" />`;
  assert.deepEqual(findUndocumentedRoutes(registry, pageSource), ["missing"]);
});
