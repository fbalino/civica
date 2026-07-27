import assert from "node:assert/strict";
import test from "node:test";

import {
  PULSE_SCALAR_SUCCESSOR_HREF,
  PULSE_SCALAR_SUNSET_DATE,
  retiredPulseScalarResponse,
} from "./pulse-scalar-retirement";
import { GET as getRankings } from "@/app/api/v1/index/rankings/route";
import {
  GET as getRetiredEmbed,
  OPTIONS as optionsRetiredEmbed,
} from "@/app/embed/[slug]/route";

function assertNeverCached(response: Response) {
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
  assert.equal(response.headers.get("Vercel-CDN-Cache-Control"), "no-store");
}

test("scalar Pulse retirement response is terminal and points to dimensional output", async () => {
  const response = retiredPulseScalarResponse();
  assert.equal(response.status, 410);
  assert.equal(response.headers.get("Deprecation"), "true");
  assert.equal(response.headers.get("Sunset"), PULSE_SCALAR_SUNSET_DATE);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(
    response.headers.get("Link"),
    `<${PULSE_SCALAR_SUCCESSOR_HREF}>; rel="successor-version"`,
  );
  assertNeverCached(response);

  const body = await response.json();
  assert.equal(body.code, "pulse_scalar_retired");
  assert.equal(body.disposition, "named_per_dimension_deltas_only");
  assert.equal(body.successor, PULSE_SCALAR_SUCCESSOR_HREF);
  assert.equal(body.scalarPulseScore, false);
  assert.equal("score" in body, false);
  assert.equal("rank" in body, false);
});

test("rankings recognizes every casing of the retired cp sort before database work", async () => {
  for (const sort of ["cp", "CP", "Cp", "cP"]) {
    const response = await getRankings(
      new Request(`https://civicaatlas.org/api/v1/index/rankings?sort=${sort}`),
    );
    assert.equal(response.status, 410);
    assert.equal((await response.json()).code, "pulse_scalar_retired");
    assertNeverCached(response);
  }
});

test("rankings keeps unknown sort values distinct from retired cp", async () => {
  const response = await getRankings(
    new Request("https://civicaatlas.org/api/v1/index/rankings?sort=other"),
  );
  assert.equal(response.status, 400);
  assert.notEqual((await response.json()).code, "pulse_scalar_retired");
});

test("legacy embed variants are gone and cannot enter browser or CDN caches", async () => {
  for (const include of ["cp", "ci", "cp,ci", "capital"]) {
    const response = await getRetiredEmbed(
      new Request(`https://civicaatlas.org/embed/brazil?include=${include}`) as never,
      { params: Promise.resolve({ slug: "brazil" }) },
    );
    assert.equal(response.status, 410);
    assertNeverCached(response);
  }

  const options = await optionsRetiredEmbed();
  assert.equal(options.status, 204);
  assertNeverCached(options);
  assert.equal(options.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
});
