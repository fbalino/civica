import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import type { ConstitutionSearchErrorCode } from "./search-contract";
import { shapeConstitutionSearchError } from "./search-error-response";

const CODES: readonly ConstitutionSearchErrorCode[] = [
  "invalid_request",
  "query_not_searchable",
  "jurisdiction_not_covered",
  "cursor_stale",
  "rate_limited",
  "rights_not_ready",
  "data_unavailable",
  "query_timeout",
];

test("every constitution search failure has fixed copy, status, and code", () => {
  for (const error of CODES) {
    const first = shapeConstitutionSearchError(error, {
      uncoveredJurisdictions: ["uruguay"],
    });
    const second = shapeConstitutionSearchError(error, {
      uncoveredJurisdictions: ["ghana"],
    });
    assert.match(first.body.code, /^[A-Z_]+$/);
    assert.ok(first.status >= 400 && first.status <= 599);
    assert.equal(first.body.message, second.body.message);
    assert.equal(first.status, second.status);
  }
});

test("only bounded jurisdiction slugs survive the detail projection", () => {
  const shaped = shapeConstitutionSearchError("jurisdiction_not_covered", {
    uncoveredJurisdictions: [
      "japan",
      "<script>secret</script>",
      "A".repeat(101),
      ...Array.from({ length: 25 }, (_, index) => `country-${index}`),
    ],
  });
  assert.deepEqual(shaped.body.details?.uncoveredJurisdictions, [
    "japan",
    ...Array.from({ length: 19 }, (_, index) => `country-${index}`),
  ]);

  const unrelated = shapeConstitutionSearchError("data_unavailable", {
    uncoveredJurisdictions: ["future-secret"],
  });
  assert.equal(unrelated.body.details, undefined);
});

test("the API route never forwards lower-layer message or status fields", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/app/api/constitution/search/route.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /error\.(?:message|status)\b/);
  assert.match(source, /shapeConstitutionSearchError/);
});
