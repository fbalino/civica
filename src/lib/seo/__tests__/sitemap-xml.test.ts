import assert from "node:assert/strict";
import test from "node:test";

import { resolveSitemap } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";

import sitemap from "@/app/sitemap";
import { pageWarmTargets } from "@/lib/platform/page-refresh";
import {
  escapeSitemapUrl,
  sitemapXmlErrors,
  unescapeSitemapUrl,
} from "@/lib/seo/sitemap-xml";

async function withoutDatabase<T>(run: () => Promise<T>): Promise<T> {
  const prior = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    return await run();
  } finally {
    if (prior !== undefined) process.env.DATABASE_URL = prior;
  }
}

const COMPARE =
  "https://civicaatlas.org/compare?c=united-states&c=united-kingdom";

test("sitemap URLs round-trip through XML escaping", () => {
  const escaped = escapeSitemapUrl(COMPARE);
  assert.equal(
    escaped,
    "https://civicaatlas.org/compare?c=united-states&amp;c=united-kingdom",
  );
  assert.equal(unescapeSitemapUrl(escaped), COMPARE);
  assert.equal(escapeSitemapUrl("https://civicaatlas.org/country/france"), "https://civicaatlas.org/country/france");
});

test("the well-formedness check rejects the raw ampersand crawlers rejected", () => {
  const raw = resolveSitemap([{ url: COMPARE }]);
  assert.match(sitemapXmlErrors(raw).join("\n"), /unescaped "&"/);
  assert.deepEqual(sitemapXmlErrors(resolveSitemap([{ url: escapeSitemapUrl(COMPARE) }])), []);
  assert.match(sitemapXmlErrors("<urlset><url></urlset>").join("\n"), /closes/);
  assert.match(sitemapXmlErrors("<a/><b/>").join("\n"), /one root element/);
});

test("the generated sitemap is well-formed XML with escaped compare URLs", async () => {
  const entries = await withoutDatabase(() => sitemap());
  const xml = resolveSitemap(entries);
  assert.deepEqual(sitemapXmlErrors(xml), []);
  assert.match(xml, /<loc>https:\/\/civicaatlas\.org\/compare\?c=united-states&amp;c=united-kingdom<\/loc>/);
  assert.doesNotMatch(xml, /<loc>[^<]*&(?!amp;)[^<]*<\/loc>/);
});

test("the page warm-up decodes sitemap URLs before requesting them", () => {
  const targets = pageWarmTargets(
    [
      { url: escapeSitemapUrl("https://civicaatlas.org/country/france"), priority: 0.9 },
      { url: escapeSitemapUrl(COMPARE), priority: 0.6 },
    ],
    "https://civicaatlas.org",
  );
  // The compare canonical is a request-live query-string page, so it is not
  // warmed; nothing ever requests a literal "&amp;".
  assert.deepEqual(
    targets.map((target) => target.url),
    ["https://civicaatlas.org/country/france"],
  );
  assert.ok(targets.every((target) => !target.url.includes("&amp;")));
});
