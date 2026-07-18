import assert from "node:assert/strict";
import test from "node:test";

import {
  PULSE_SCALAR_SUCCESSOR_HREF,
  PULSE_SCALAR_SUNSET_DATE,
  retiredPulseScalarResponse,
} from "./pulse-scalar-retirement";
import { parseQueryContract } from "@/lib/api/request-contract";
import {
  GET as getRetiredEmbed,
  OPTIONS as optionsRetiredEmbed,
} from "@/app/embed/[slug]/route";
import { RIGHTS_REGISTRY_URL } from "@/lib/claims/reuse-rights";

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

test("rankings query contract recognizes every casing of the retired cp sort", async () => {
  for (const sort of ["cp", "CP", "Cp", "cP"]) {
    const parsed = parseQueryContract(
      new Request(`https://civicaatlas.org/api/v1/index/rankings?sort=${sort}`),
      "v1-index-rankings-query/v1",
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) continue;
    assert.equal(parsed.data.sort, "cp");

    const response = retiredPulseScalarResponse();
    assert.equal(response.status, 410);
    assert.equal((await response.json()).code, "pulse_scalar_retired");
    assertNeverCached(response);
  }
});

test("rankings keeps unknown sort values distinct from retired cp", async () => {
  const parsed = parseQueryContract(
    new Request("https://civicaatlas.org/api/v1/index/rankings?sort=other"),
    "v1-index-rankings-query/v1",
  );
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.response.status, 400);
  assert.notEqual((await parsed.response.json()).code, "pulse_scalar_retired");
});

test("legacy embed variants contain only the retired notice and its point-of-use rights pointer", async () => {
  for (const include of ["cp", "ci", "cp,ci", "capital"]) {
    const response = await getRetiredEmbed(
      new Request(
        `https://civicaatlas.org/embed/brazil?include=${include}`,
      ) as never,
      { params: Promise.resolve({ slug: "brazil" }) },
    );
    assert.equal(response.status, 410);
    assertNeverCached(response);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
    const html = await response.text();
    assert.ok(
      html.includes(`<meta name="civica:rights" content="${RIGHTS_REGISTRY_URL}">`),
    );
    assert.ok(
      html.includes('<a href="/licensing#reuse" target="_top">Rights and reuse</a>'),
    );
    assert.doesNotMatch(html, /<(?:style|script|table|dl|ul|ol)\\b/i);
    assert.match(html, /<h1 id="embed-retired-title">Civica Index embed retired<\/h1>/);
    assert.match(html, /<main aria-labelledby="embed-retired-title">/);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.doesNotMatch(html, /<iframe\b|Civica Index score|Country rank/i);
  }

  const options = await optionsRetiredEmbed();
  assert.equal(options.status, 204);
  assertNeverCached(options);
  assert.equal(
    options.headers.get("Access-Control-Allow-Methods"),
    "GET, OPTIONS",
  );
});
