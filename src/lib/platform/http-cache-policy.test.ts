import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { GET as getProvenanceCoverage } from "@/app/api/provenance-coverage/route";
import { GET as getReconciliationAudit } from "@/app/api/reconciliation-audit/route";
import { GET as getRightsManifest } from "@/app/api/rights-manifest/route";
import { GET as getSourceCoverage } from "@/app/api/source-coverage/route";
import { apiError, apiResponse, corsOptions } from "@/lib/api/helpers";
import { cacheControlFor } from "./cache-consistency";

test("generic public API responses are request-live and non-cacheable", () => {
  const expected = cacheControlFor("public-live");
  assert.equal(apiResponse({ ok: true }).headers.get("cache-control"), expected);
  assert.equal(apiError("missing", 404).headers.get("cache-control"), expected);
  assert.equal(corsOptions().headers.get("cache-control"), expected);
});

test("checked artifact APIs revalidate at expiry without serving stale", async () => {
  const expected = cacheControlFor("checked-build-artifact");
  const handlers = [
    ["provenance coverage", getProvenanceCoverage],
    ["source coverage", getSourceCoverage],
    ["reconciliation audit", getReconciliationAudit],
    ["rights manifest", getRightsManifest],
  ] as const;

  for (const [name, handler] of handlers) {
    const response = await handler();
    const cacheControl = response.headers.get("cache-control");
    assert.equal(cacheControl, expected, name);
    assert.doesNotMatch(cacheControl ?? "", /stale-(while-revalidate|if-error)/i);
    assert.match(cacheControl ?? "", /must-revalidate/i);
  }
});

test("mutable direct API responses use the public-live profile", () => {
  const files = [
    "src/app/api/citations/[entityType]/[id]/route.ts",
    "src/app/api/constitution/passages/[digest]/route.ts",
    "src/app/api/countries/[slug]/export/route.ts",
    "src/app/api/countries/[slug]/indicator-history/route.ts",
    "src/app/api/v1/elections/route.ts",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /cacheControlFor\("public-live"\)/, file);
    assert.doesNotMatch(
      source,
      /"Cache-Control"\s*:\s*"public,\s*max-age=/,
      file,
    );
    assert.doesNotMatch(source, /stale-while-revalidate|stale-if-error/i, file);
  }
});
