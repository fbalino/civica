/**
 * Sanity tests for `source-allowlist.ts`.
 *
 * Run via: `npx tsx src/lib/factbook/reconcile/__tests__/source-allowlist.test.ts`.
 * Uses Node's built-in `assert/strict`. Throws on first failure.
 */

import assert from "node:assert/strict";
import {
  SOURCE_ALLOWLIST,
  REJECTED_REFERENCE_QIDS,
  REJECTED_DOMAIN_PATTERNS,
  findAllowlistEntry,
  isAllowedReference,
  getAllowlistByTier,
} from "../source-allowlist";

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    throw err;
  }
}

console.log("source-allowlist.test.ts");

test("Tier 1 has the 12 multilateral agencies from §2.1", () => {
  assert.ok(getAllowlistByTier(1).length >= 12);
});

test("Tier 2 has at least 30 NSO entries per §13.3", () => {
  assert.ok(
    getAllowlistByTier(2).length >= 30,
    `expected >= 30 NSO entries, got ${getAllowlistByTier(2).length}`,
  );
});

test("World Bank Q21540096 is on the allowlist (R.0 / 2026-05-03 corrected QID)", () => {
  // Pre-R.0 the allowlist mapped WB to Q1199363 ("Taika —
  // Wikimedia disambiguation page" on live Wikidata) — wrong.
  // The correct entity is Q21540096 ("World Bank Open Data").
  // See `~/civica/plan/wikidata-sort-resolution-v1.md` §3 item 3.
  assert.equal(isAllowedReference({ qid: "Q21540096" }), true);
});

test("World Bank URL via data.worldbank.org is on the allowlist", () => {
  assert.equal(
    isAllowedReference({ url: "https://data.worldbank.org/indicator/SP.POP.TOTL?locations=NG" }),
    true,
  );
});

test("World Bank entry resolves via findAllowlistEntry", () => {
  const e = findAllowlistEntry({ qid: "Q21540096" });
  assert.ok(e);
  assert.equal(e!.tier, 1);
  assert.equal(e!.civicaSourceId, "world_bank");
});

test("Q1199363 (the previous, incorrect WB QID) is no longer on the allowlist", () => {
  // Regression guard for the R.0 fix. Q1199363 is "Taika —
  // Wikimedia disambiguation page" on live Wikidata; the
  // allowlist must not falsely match it.
  assert.equal(isAllowedReference({ qid: "Q1199363" }), false);
});

test("Wikipedia URL is rejected (mirror, not a primary source)", () => {
  assert.equal(
    isAllowedReference({ url: "https://en.wikipedia.org/wiki/Nigeria" }),
    false,
  );
  assert.equal(
    isAllowedReference({ url: "https://wikipedia.org/foo" }),
    false,
  );
});

test("Worldometers is rejected (aggregator)", () => {
  assert.equal(
    isAllowedReference({ url: "https://www.worldometers.info/world-population/" }),
    false,
  );
});

test("Statista is rejected (aggregator)", () => {
  assert.equal(
    isAllowedReference({ url: "https://www.statista.com/something" }),
    false,
  );
});

test("Twitter / X is rejected", () => {
  assert.equal(
    isAllowedReference({ url: "https://twitter.com/someone/status/1" }),
    false,
  );
  assert.equal(
    isAllowedReference({ url: "https://x.com/someone/status/1" }),
    false,
  );
});

test("Wikipedia Q-ID (Q52) is on REJECTED_REFERENCE_QIDS", () => {
  assert.ok(REJECTED_REFERENCE_QIDS.includes("Q52"));
  assert.equal(isAllowedReference({ qid: "Q52" }), false);
});

test("REJECTED_DOMAIN_PATTERNS rejects subdomains", () => {
  // The patterns use (^|\.) anchors so subdomain matches work.
  assert.equal(
    REJECTED_DOMAIN_PATTERNS.some((p) => p.test("en.wikipedia.org")),
    true,
  );
});

test("Unknown reference is not on the allowlist", () => {
  assert.equal(
    isAllowedReference({ url: "https://example.com/random-blog-post" }),
    false,
  );
  assert.equal(isAllowedReference({ qid: "Q9999999999" }), false);
});

test("Malformed URL is rejected gracefully", () => {
  assert.equal(isAllowedReference({ url: "not a url at all" }), false);
});

test("Empty reference returns false", () => {
  assert.equal(isAllowedReference({}), false);
});

test("INSEE (France) NSO is matched on domain insee.fr", () => {
  assert.equal(
    isAllowedReference({ url: "https://www.insee.fr/fr/statistiques/somefact" }),
    true,
  );
});

test("CIA Factbook URL is on Tier 3", () => {
  assert.equal(
    isAllowedReference({ url: "https://www.cia.gov/the-world-factbook/countries/nigeria" }),
    true,
  );
  const e = findAllowlistEntry({
    url: "https://www.cia.gov/the-world-factbook/countries/nigeria",
  });
  assert.equal(e!.tier, 3);
});

test("All Tier 2 entries have countryIso2 set", () => {
  for (const e of getAllowlistByTier(2)) {
    assert.ok(
      e.countryIso2,
      `Tier 2 entry '${e.name}' missing countryIso2`,
    );
  }
});

test("SOURCE_ALLOWLIST has every entry tier in {1,2,3,4}", () => {
  for (const e of SOURCE_ALLOWLIST) {
    assert.ok([1, 2, 3, 4].includes(e.tier));
  }
});

console.log(`\n  ${passed} test(s) passed.`);
