/**
 * Phase R.19 — Stats SA sync helper tests.
 *
 * Sanity tests for the URL builder, candidate enumeration, sanity
 * range, quote-mismatch helper, and as_of derivation in
 * `sync-stats-sa.ts`. No DB IO and no Anthropic API calls — pure
 * helper tests against synthetic fixtures.
 *
 * No test runner is wired into the project (no jest, no vitest).
 * The suite is a runnable script using Node's built-in
 * `assert/strict`. Run via:
 *   npx tsx src/lib/factbook/reconcile/__tests__/sync-stats-sa.test.ts
 * Throws on first failure; exits 0 on success.
 */

import assert from "node:assert/strict";
import {
  STATS_SA_INDICATORS,
  __test,
} from "../sync-stats-sa";

const {
  buildPdfUrl,
  enumerateCandidateUrls,
  quoteContainsValue,
  deriveAsOf,
  STATS_SA_EXTRACTION_PROMPT_VERSION,
  STATS_SA_EXTRACTION_MODEL,
  STATS_SA_LICENSE,
} = __test;

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

console.log("sync-stats-sa.test.ts");

// ---------------------------------------------------------------------
// Indicator catalogue invariants
// ---------------------------------------------------------------------

test("STATS_SA_INDICATORS has exactly 4 entries (R.19 ship scope)", () => {
  assert.equal(STATS_SA_INDICATORS.length, 4);
});

test("STATS_SA_INDICATORS pCode set is {P0302, P0141, P0211, P0441}", () => {
  const pCodes = new Set(STATS_SA_INDICATORS.map((c) => c.pCode));
  assert.deepEqual(
    [...pCodes].sort(),
    ["P0141", "P0211", "P0302", "P0441"],
  );
});

test("All indicators ship as civicaRole='canonical'", () => {
  for (const c of STATS_SA_INDICATORS) {
    assert.equal(c.civicaRole, "canonical", `${c.pCode} civicaRole`);
  }
});

test("Each indicator declares a tighter sanity range than the bare envelope", () => {
  for (const c of STATS_SA_INDICATORS) {
    assert.ok(
      Number.isFinite(c.sanityMin),
      `${c.pCode} sanityMin must be finite`,
    );
    assert.ok(
      Number.isFinite(c.sanityMax),
      `${c.pCode} sanityMax must be finite`,
    );
    assert.ok(
      c.sanityMin < c.sanityMax,
      `${c.pCode} sanityMin must be less than sanityMax`,
    );
  }
});

test("Each indicator declares a non-empty extraction prompt fragment", () => {
  for (const c of STATS_SA_INDICATORS) {
    assert.ok(
      c.promptFragment.length > 50,
      `${c.pCode} promptFragment too short — needs detail`,
    );
  }
});

test("R.19 extraction prompt version is locked to v1.0", () => {
  assert.equal(STATS_SA_EXTRACTION_PROMPT_VERSION, "v1.0");
});

test("R.19 extraction model is locked to claude-haiku-4-5-20251001", () => {
  assert.equal(STATS_SA_EXTRACTION_MODEL, "claude-haiku-4-5-20251001");
});

test("R.19 license string matches resolution §2e + Q6 sign-off", () => {
  assert.equal(
    STATS_SA_LICENSE,
    "Stats SA Copyright (CC-BY-4.0 equivalent)",
  );
});

// ---------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------

test("buildPdfUrl: P0302 annual matches the verified-live pattern", () => {
  assert.equal(
    buildPdfUrl("P0302", 2025),
    "https://www.statssa.gov.za/publications/P0302/P03022025.pdf",
  );
});

test("buildPdfUrl: P0141 monthly inserts capitalised English month name", () => {
  assert.equal(
    buildPdfUrl("P0141", 2026, 3),
    "https://www.statssa.gov.za/publications/P0141/P0141March2026.pdf",
  );
  assert.equal(
    buildPdfUrl("P0141", 2026, 1),
    "https://www.statssa.gov.za/publications/P0141/P0141January2026.pdf",
  );
  assert.equal(
    buildPdfUrl("P0141", 2026, 12),
    "https://www.statssa.gov.za/publications/P0141/P0141December2026.pdf",
  );
});

test("buildPdfUrl: P0211 quarterly inserts ordinal Quarter form", () => {
  assert.equal(
    buildPdfUrl("P0211", 2025, undefined, 4),
    "https://www.statssa.gov.za/publications/P0211/P02114thQuarter2025.pdf",
  );
  assert.equal(
    buildPdfUrl("P0211", 2025, undefined, 1),
    "https://www.statssa.gov.za/publications/P0211/P02111stQuarter2025.pdf",
  );
});

test("buildPdfUrl: P0441 quarterly mirrors P0211 form", () => {
  assert.equal(
    buildPdfUrl("P0441", 2025, undefined, 3),
    "https://www.statssa.gov.za/publications/P0441/P04413rdQuarter2025.pdf",
  );
});

// ---------------------------------------------------------------------
// Candidate enumeration
// ---------------------------------------------------------------------

test("enumerateCandidateUrls: P0302 in March → previous-year fallback only", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0302")!;
  const march = new Date(Date.UTC(2026, 2, 15)); // March 15, 2026
  const urls = enumerateCandidateUrls(config, march);
  assert.equal(urls.length, 1);
  assert.equal(
    urls[0],
    "https://www.statssa.gov.za/publications/P0302/P03022025.pdf",
  );
});

test("enumerateCandidateUrls: P0302 in September → current year first, previous as fallback", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0302")!;
  const sep = new Date(Date.UTC(2026, 8, 15)); // September 15, 2026
  const urls = enumerateCandidateUrls(config, sep);
  assert.equal(urls.length, 2);
  assert.equal(
    urls[0],
    "https://www.statssa.gov.za/publications/P0302/P03022026.pdf",
  );
  assert.equal(
    urls[1],
    "https://www.statssa.gov.za/publications/P0302/P03022025.pdf",
  );
});

test("enumerateCandidateUrls: P0141 in May 2026 → April / March / Feb / Jan candidates", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0141")!;
  const may = new Date(Date.UTC(2026, 4, 11)); // May 11, 2026
  const urls = enumerateCandidateUrls(config, may);
  assert.equal(urls.length, 4);
  assert.equal(
    urls[0],
    "https://www.statssa.gov.za/publications/P0141/P0141April2026.pdf",
  );
  assert.equal(
    urls[1],
    "https://www.statssa.gov.za/publications/P0141/P0141March2026.pdf",
  );
  assert.equal(
    urls[3],
    "https://www.statssa.gov.za/publications/P0141/P0141January2026.pdf",
  );
});

test("enumerateCandidateUrls: P0141 in February 2026 wraps to December 2025", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0141")!;
  const feb = new Date(Date.UTC(2026, 1, 11)); // February 11, 2026
  const urls = enumerateCandidateUrls(config, feb);
  assert.equal(urls.length, 4);
  assert.equal(
    urls[0],
    "https://www.statssa.gov.za/publications/P0141/P0141January2026.pdf",
  );
  assert.equal(
    urls[1],
    "https://www.statssa.gov.za/publications/P0141/P0141December2025.pdf",
  );
});

test("enumerateCandidateUrls: P0211 in May 2026 → Q1 2026 first, Q4 2025 fallback", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0211")!;
  const may = new Date(Date.UTC(2026, 4, 11));
  const urls = enumerateCandidateUrls(config, may);
  assert.equal(urls.length, 5);
  assert.equal(
    urls[0],
    "https://www.statssa.gov.za/publications/P0211/P02111stQuarter2026.pdf",
  );
  assert.equal(
    urls[1],
    "https://www.statssa.gov.za/publications/P0211/P02114thQuarter2025.pdf",
  );
});

test("enumerateCandidateUrls: P0441 in February 2026 wraps quarter to Q4 2025", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0441")!;
  const feb = new Date(Date.UTC(2026, 1, 11));
  const urls = enumerateCandidateUrls(config, feb);
  assert.equal(urls.length, 5);
  assert.equal(
    urls[0],
    "https://www.statssa.gov.za/publications/P0441/P04414thQuarter2025.pdf",
  );
  assert.equal(
    urls[1],
    "https://www.statssa.gov.za/publications/P0441/P04413rdQuarter2025.pdf",
  );
});

// ---------------------------------------------------------------------
// Quote-mismatch substring check (Q5 hallucination guard)
// ---------------------------------------------------------------------

test("quoteContainsValue: matches CPI rate as comma-decimal in verbatim Stats SA quote", () => {
  // The actual P0141 March 2026 quote.
  const quote =
    "Annual consumer price inflation was 3,1% in March 2026, up from 3,0% in February 2026.";
  assert.equal(quoteContainsValue(3.1, quote), true);
});

test("quoteContainsValue: matches LU1 unemployment rate as comma-decimal", () => {
  // Synthetic but representative QLFS Table A row.
  const quote = "LU1- Unemployment rate ... 31,4 ... -0,5";
  assert.equal(quoteContainsValue(31.4, quote), true);
});

test("quoteContainsValue: matches GDP QoQ growth rate as comma-decimal", () => {
  // The actual P0441 Q4 2025 quote.
  const quote =
    "Real gross domestic product (GDP) measured by production increased by 0,4%¹ in the fourth quarter of 2025";
  assert.equal(quoteContainsValue(0.4, quote), true);
});

test("quoteContainsValue: matches population in millions form", () => {
  // The actual P0302 Summary 2025 quote.
  const quote =
    "For 2025, Statistics South Africa (Stats SA) estimates the mid-year population at 63,10 million people.";
  assert.equal(quoteContainsValue(63100000, quote), true);
});

test("quoteContainsValue: rejects hallucinated value not present in quote", () => {
  // Hallucinated wrong value — model said 5.5 but quote shows 3.1.
  const quote = "Annual consumer price inflation was 3,1% in March 2026.";
  assert.equal(quoteContainsValue(5.5, quote), false);
});

test("quoteContainsValue: matches dot-decimal form (defensive)", () => {
  const quote = "the rate was 3.1 percent";
  assert.equal(quoteContainsValue(3.1, quote), true);
});

// ---------------------------------------------------------------------
// As-of derivation
// ---------------------------------------------------------------------

test("deriveAsOf: P0302 annual mid-year-pop uses YYYY-06-30", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0302")!;
  const asOf = deriveAsOf(config, {
    value: 63100000,
    asOfPeriodLabel: "2025",
    asOfYear: 2025,
    asOfMonth: null,
    asOfQuarter: null,
    rawQuote: "...",
    tableReference: "Summary",
  });
  assert.equal(asOf, "2025-06-30");
});

test("deriveAsOf: P0141 monthly uses end-of-reference-month", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0141")!;
  const march = deriveAsOf(config, {
    value: 3.1,
    asOfPeriodLabel: "March 2026",
    asOfYear: 2026,
    asOfMonth: 3,
    asOfQuarter: null,
    rawQuote: "...",
    tableReference: "Key Findings",
  });
  assert.equal(march, "2026-03-31");
  const feb = deriveAsOf(config, {
    value: 3.0,
    asOfPeriodLabel: "February 2026",
    asOfYear: 2026,
    asOfMonth: 2,
    asOfQuarter: null,
    rawQuote: "...",
    tableReference: "Key Findings",
  });
  assert.equal(feb, "2026-02-28");
});

test("deriveAsOf: P0211/P0441 quarterly uses end-of-quarter month", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0211")!;
  const q4 = deriveAsOf(config, {
    value: 31.4,
    asOfPeriodLabel: "Q4 2025",
    asOfYear: 2025,
    asOfMonth: null,
    asOfQuarter: 4,
    rawQuote: "...",
    tableReference: "Table A",
  });
  assert.equal(q4, "2025-12-31");
  const q1 = deriveAsOf(config, {
    value: 30.0,
    asOfPeriodLabel: "Q1 2026",
    asOfYear: 2026,
    asOfMonth: null,
    asOfQuarter: 1,
    rawQuote: "...",
    tableReference: "Table A",
  });
  assert.equal(q1, "2026-03-31");
});

test("deriveAsOf: quarterly with null quarter falls back to YYYY-01-01", () => {
  const config = STATS_SA_INDICATORS.find((c) => c.pCode === "P0441")!;
  const fallback = deriveAsOf(config, {
    value: 0.4,
    asOfPeriodLabel: "2025",
    asOfYear: 2025,
    asOfMonth: null,
    asOfQuarter: null,
    rawQuote: "...",
    tableReference: "Annual estimates",
  });
  assert.equal(fallback, "2025-01-01");
});

console.log(`\n${passed} test${passed === 1 ? "" : "s"} passed.`);
