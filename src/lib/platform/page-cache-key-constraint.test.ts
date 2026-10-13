import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SITE_PAGE_KEY, countryPageKey } from "./page-rebuild-plan";

/**
 * APR-D179 guard: the database CHECK on `page_cache_fingerprints.page_key`
 * must accept every key the job writes. Keys are `country:<slug>`, so a
 * constraint that admitted only UUID keys would make every store fail and
 * every night rebuild every country.
 */
const MIGRATION = readFileSync(
  "drizzle/authoritative/0052_page_cache_fingerprints.sql",
  "utf8",
);
const SCHEMA = readFileSync("src/lib/db/schema.ts", "utf8");

/** Every `page_key ~ '<regex>'` pattern in a CHECK expression. */
function keyPatterns(source: string): RegExp[] {
  return [
    ...source.matchAll(/(?:page_key"?|\$\{table\.pageKey\})\s*~\s*'([^']+)'/g),
  ].map(
    (match) => new RegExp(match[1]!),
  );
}

/** Mirrors the CHECK: `site`, or a matching country key within the length cap. */
function accepts(patterns: RegExp[], source: string, key: string): boolean {
  const cap =
    /length\((?:[^)]*page_key"?|\$\{table\.pageKey\})\)\s*<=\s*(\d+)/.exec(
      source,
    );
  const withinCap = cap ? key.length <= Number(cap[1]) : true;
  return key === "site" || (withinCap && patterns.some((pattern) => pattern.test(key)));
}

const VALID_SLUGS = [
  "japan",
  "republic-of-france",
  "united-states",
  "saint-kitts-and-nevis",
  "cote-d-ivoire",
  "x1",
  "a".repeat(200),
];
const JUNK_KEYS = [
  "country:",
  "country:Japan",
  "country:-japan",
  "country:japan-",
  "country:japan--france",
  "country:japan/france",
  "country:japan france",
  "countries:japan",
  "japan",
  "",
  `country:${"a".repeat(201)}`,
];

for (const [name, source] of [
  ["migration 0052", MIGRATION],
  ["schema.ts", SCHEMA],
] as const) {
  test(`${name} CHECK accepts every key the job writes and rejects junk`, () => {
    const patterns = keyPatterns(source);
    assert.ok(patterns.length > 0, "page_key pattern not found");
    assert.ok(accepts(patterns, source, SITE_PAGE_KEY));
    for (const slug of VALID_SLUGS) {
      assert.ok(
        accepts(patterns, source, countryPageKey(slug)),
        `${countryPageKey(slug)} must satisfy the CHECK`,
      );
    }
    for (const key of JUNK_KEYS) {
      assert.ok(!accepts(patterns, source, key), `${key} must be rejected`);
    }
  });
}
