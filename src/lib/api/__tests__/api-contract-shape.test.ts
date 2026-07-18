/**
 * QA-005 — API contract SHAPE test (DB-free, `npm test`).
 *
 * `contract/__tests__/contract.test.ts` (CLM-012) already proves the
 * registry/examples pairing is complete, checks param drift, and
 * exercises nine negative fixtures against individual sub-schemas
 * (zCountryListItem, zDeprecationEntry, zCountriesListResponse for one
 * route). It does NOT sweep every public `/api/v1/*` GET route's
 * checked-in example against ITS OWN full top-level response schema in
 * one pass keyed off the registry — that's the gap this file closes.
 *
 * `contract/examples.ts` already `.strict().parse()`s each example
 * against its schema at module load (see that file's doc comment), so
 * importing it is already a partial proof — but that proof is implicit
 * (a broken example would crash the whole test run with an import-time
 * stack trace, not a named, itemized test failure) and it doesn't prove
 * the route -> example -> schema MAPPING itself is correct (a route
 * could be wired to the wrong example and still "work" if nothing ever
 * strict-parses it against its own declared contract). This file makes
 * both explicit: every versioned route's example is re-parsed here
 * against a hand-verified route-id -> schema map, plus negative fixtures
 * proving the map actually discriminates between routes.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { API_ROUTES, type RouteContract } from "../contract/registry";
import { EXAMPLES, type ExampleId } from "../contract/examples";
import {
  zCountriesListResponse,
  zCountryDetailResponse,
  zElectionResearchExport,
  zGovernmentTypesResponse,
  zIndexCountryResponse,
  zIndexHistoryResponse,
  zIndexByGovernmentTypeResponse,
  zIndexCompareResponse,
  zIndexMethodologyResponse,
  zIndexRankingsResponse,
  zConditionsReleaseResponse,
  zPeerGroupingsResponse,
  zPulseMethodologyResponse,
  zPulseClusterCoverageResponse,
  zPulseSourceCoverageResponse,
  zPulseDimensionsResponse,
  zPulseEventsResponse,
  zPulseChangelogResponse,
} from "../contract/schemas";

/**
 * Route id -> its full top-level response schema. Hand-mapped once here
 * because `registry.ts`'s `RouteContract` only carries an `exampleId`
 * (a key into EXAMPLES), not a schema reference — this map is the thing
 * under test, not a shortcut around it. Covers every `versioned: true`
 * (`/api/v1/*`) GET route; `country-export` (`/api/countries/:slug/export`)
 * is deliberately excluded — it's not under `/api/v1` and its JSON/CSV
 * rights-filtered shape is covered separately by the country-export
 * fixtures in `contract.test.ts` and DAT-027 evidence.
 */
const RESPONSE_SCHEMA_BY_ROUTE_ID: Record<string, z.ZodTypeAny> = {
  conditions: zConditionsReleaseResponse,
  countries: zCountriesListResponse,
  "country-detail": zCountryDetailResponse,
  elections: zElectionResearchExport,
  "government-types": zGovernmentTypesResponse,
  "index-country": zIndexCountryResponse,
  "index-history": zIndexHistoryResponse,
  "index-by-government-type": zIndexByGovernmentTypeResponse,
  "index-compare": zIndexCompareResponse,
  "index-methodology": zIndexMethodologyResponse,
  "index-rankings": zIndexRankingsResponse,
  "peer-groupings": zPeerGroupingsResponse,
  "pulse-methodology": zPulseMethodologyResponse,
  "pulse-cluster-coverage": zPulseClusterCoverageResponse,
  "pulse-source-coverage": zPulseSourceCoverageResponse,
  "pulse-dimensions": zPulseDimensionsResponse,
  "pulse-events": zPulseEventsResponse,
  "pulse-changelog-v2": zPulseChangelogResponse,
};

const versionedRoutes: RouteContract[] = API_ROUTES.filter((r) => r.versioned);

// ─────────────────────────────────────────────────────────────────────
// Positive: the map is complete and every example satisfies its own
// route's schema
// ─────────────────────────────────────────────────────────────────────

test("every versioned /api/v1 registry route has a mapped response schema in this test", () => {
  const missing = versionedRoutes
    .map((r) => r.id)
    .filter((id) => !(id in RESPONSE_SCHEMA_BY_ROUTE_ID));
  assert.deepEqual(
    missing,
    [],
    `route id(s) with no mapped schema in RESPONSE_SCHEMA_BY_ROUTE_ID: ${missing.join(", ")}`,
  );
});

test("this test's schema map has no entry for a route id that doesn't exist in the registry (guards against a stale map)", () => {
  const versionedIds = new Set(versionedRoutes.map((r) => r.id));
  const stale = Object.keys(RESPONSE_SCHEMA_BY_ROUTE_ID).filter(
    (id) => !versionedIds.has(id),
  );
  assert.deepEqual(stale, [], `mapped route id(s) not present in the live versioned registry: ${stale.join(", ")}`);
});

test("every versioned /api/v1 route's checked-in example strictly parses against its own response schema", () => {
  const failures: string[] = [];
  for (const route of versionedRoutes) {
    const schema = RESPONSE_SCHEMA_BY_ROUTE_ID[route.id];
    if (!schema) continue; // reported by the completeness test above
    const example = EXAMPLES[route.exampleId as ExampleId];
    if (!example) {
      failures.push(`${route.id}: no EXAMPLES entry for exampleId "${route.exampleId}"`);
      continue;
    }
    const result = schema.safeParse(example);
    if (!result.success) {
      failures.push(`${route.id}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
  }
  assert.deepEqual(failures, [], `route(s) whose example failed their own schema:\n${failures.join("\n")}`);
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixtures — prove the mapping and the schemas actually
// discriminate, rather than trivially accepting anything
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: the countries-list example does not satisfy the country-detail schema, and vice versa", () => {
  assert.throws(() => zCountryDetailResponse.parse(EXAMPLES.countries), z.ZodError);
  assert.throws(() => zCountriesListResponse.parse(EXAMPLES.countryDetail), z.ZodError);
});

test("negative fixture: the elections export example does not satisfy the index-methodology schema", () => {
  assert.throws(() => zIndexMethodologyResponse.parse(EXAMPLES.elections), z.ZodError);
});

test("negative fixture: an excess top-level field on a full response envelope is rejected (strict envelope)", () => {
  const withExtra = { ...EXAMPLES.countries, notARealTopLevelField: true };
  assert.throws(() => zCountriesListResponse.parse(withExtra), z.ZodError);
});

test("negative fixture: a missing required top-level field on a full response envelope is rejected", () => {
  const withoutMeta: Partial<typeof EXAMPLES.countries> = { ...EXAMPLES.countries };
  delete (withoutMeta as { meta?: unknown }).meta;
  assert.throws(() => zCountriesListResponse.parse(withoutMeta), z.ZodError);
});

test("negative fixture: a wrong-type value on a required field is rejected", () => {
  const wrongType = {
    ...EXAMPLES.governmentTypes,
    data: "should be an array, not a string",
  };
  assert.throws(() => zGovernmentTypesResponse.parse(wrongType), z.ZodError);
});

test("negative fixture: Conditions cannot publish an economic composite or coverage that drifts from rows", () => {
  const economicComposite = structuredClone(EXAMPLES.conditions);
  const economic = economicComposite.data.calculations.find(
    (calculation) => calculation.dimension === "economic_stability",
  );
  assert.ok(economic);
  economic.normalizedScore = 52;
  economic.rawValue = 0.52;
  assert.throws(
    () => zConditionsReleaseResponse.parse(economicComposite),
    z.ZodError,
  );

  const coverageDrift = structuredClone(EXAMPLES.conditions);
  coverageDrift.data.coverage[0]!.calculations = 99;
  assert.throws(
    () => zConditionsReleaseResponse.parse(coverageDrift),
    z.ZodError,
  );
});
