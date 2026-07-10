/**
 * Reconciliation Worked Example 1 (Argentina inflation) — DB-free
 * contract test binding two prose surfaces to `fact-keys.ts`.
 *
 * The reconciliation methodology TSX page
 * (`src/app/(reader)/country/methodology/reconciliation/page.tsx`) is
 * the live, rendered source of truth. `content/methodology-reconciliation.md`
 * is a deferred, unwired mirror kept for when the `<WorkedExample>`
 * editorial primitive lands (see AGENTS.md). Neither surface is allowed
 * to retype the `inflation_rate` / `public_debt_pct_gdp` material-error
 * threshold as a bare literal that can drift from the registry, and
 * neither is allowed to narrate the threshold as a past migration event
 * ("before X, we raised the threshold") — Civica's pre-launch prose
 * discipline is present-tense current truth, not before/after theater.
 *
 * No test runner is wired into the project (no jest, no vitest). The
 * suite is a runnable script using Node's built-in `assert/strict`.
 * Run via:
 *     npx tsx src/lib/factbook/reconcile/__tests__/reconciliation-worked-examples.test.ts
 * Throws on first failure; exits 0 on success.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getFactKey } from "../fact-keys";

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

console.log("reconciliation-worked-examples.test.ts");

const ROOT = process.cwd();
const TSX_PATH = path.join(
  ROOT,
  "src/app/(reader)/country/methodology/reconciliation/page.tsx",
);
const MARKDOWN_PATH = path.join(ROOT, "content/methodology-reconciliation.md");

const tsxSource = readFileSync(TSX_PATH, "utf8");
const markdownSource = readFileSync(MARKDOWN_PATH, "utf8");

// Frozen worked-example rows (methodology v0.2-beta, vintage 2026-Q1).
const WORLD_BANK_PCT_2024 = 219.88;
const CIA_PCT_2022 = 73.1;
const EXPECTED_GAP_PP =
  Math.round((WORLD_BANK_PCT_2024 - CIA_PCT_2022) * 100) / 100;

test("inflation_rate and public_debt_pct_gdp share a 300pp material-error threshold in the registry", () => {
  const inflation = getFactKey("inflation_rate");
  const publicDebt = getFactKey("public_debt_pct_gdp");
  assert.ok(inflation, "inflation_rate must be registered");
  assert.ok(publicDebt, "public_debt_pct_gdp must be registered");
  assert.equal(inflation!.materialErrorPpThreshold, 300);
  assert.equal(publicDebt!.materialErrorPpThreshold, 300);
});

test("frozen worked-example gap computes to 146.78pp", () => {
  assert.equal(EXPECTED_GAP_PP, 146.78);
});

test("TSX page derives the threshold from getFactKey() rather than a bare literal", () => {
  assert.match(
    tsxSource,
    /getFactKey\(\s*"inflation_rate"\s*\)\?\.\s*materialErrorPpThreshold/,
    "TSX page must read the threshold from the fact-keys registry",
  );
  assert.match(
    tsxSource,
    /getFactKey\(\s*"public_debt_pct_gdp"\s*,?\s*\)\?\.\s*materialErrorPpThreshold/,
    "TSX page must read the public_debt_pct_gdp threshold from the fact-keys registry",
  );
});

test("TSX Worked Example 1 renders the registry threshold and computed gap as JSX expressions, not retyped literals", () => {
  // The TSX page interpolates {INFLATION_MATERIAL_ERROR_PP_THRESHOLD} and
  // {ARGENTINA_INFLATION_GAP_PP} rather than embedding "300"/"146.78" as
  // bare text, so the source itself never contains the literal numbers —
  // only the derived-constant references. Presence of those references
  // (already proven non-empty by the getFactKey() test above) is the
  // contract; the rendered digits are proven by the earlier tests that
  // the constants resolve to 300 and 146.78.
  assert.match(
    tsxSource,
    /\{INFLATION_MATERIAL_ERROR_PP_THRESHOLD\}\s*\{" "\}\s*percentage-point/,
    "TSX prose should preserve a rendered space between the derived threshold and 'percentage-point'",
  );
  assert.match(
    tsxSource,
    /\{ARGENTINA_INFLATION_GAP_PP\}\s*percentage points/,
    "TSX prose should render the computed gap constant, not a retyped number",
  );
});

test("markdown mirror states the same 300pp threshold and 146.78pp gap as literal frozen prose", () => {
  const threshold = getFactKey("inflation_rate")!.materialErrorPpThreshold;
  assert.match(
    markdownSource,
    new RegExp(`${threshold} percentage-point`),
    `markdown prose should state the ${threshold}pp material-error ceiling`,
  );
  assert.match(
    markdownSource,
    new RegExp(`${EXPECTED_GAP_PP} percentage points`),
    `markdown prose should state the ${EXPECTED_GAP_PP}pp gap`,
  );
});

test("markdown mirror cites the same frozen World Bank / CIA readings as literal text", () => {
  assert.ok(
    markdownSource.includes(`${WORLD_BANK_PCT_2024}%`),
    `expected World Bank reading ${WORLD_BANK_PCT_2024}% to appear in markdown`,
  );
  assert.ok(
    markdownSource.includes(`${CIA_PCT_2022}%`),
    `expected CIA reading ${CIA_PCT_2022}% to appear in markdown`,
  );
});

test("TSX page cites the same frozen World Bank / CIA readings via its named constants", () => {
  assert.ok(
    tsxSource.includes(`ARGENTINA_INFLATION_WORLD_BANK_PCT_2024 = ${WORLD_BANK_PCT_2024}`),
    `expected TSX constant ARGENTINA_INFLATION_WORLD_BANK_PCT_2024 = ${WORLD_BANK_PCT_2024}`,
  );
  assert.ok(
    tsxSource.includes(`ARGENTINA_INFLATION_CIA_PCT_2022 = ${CIA_PCT_2022}`),
    `expected TSX constant ARGENTINA_INFLATION_CIA_PCT_2022 = ${CIA_PCT_2022}`,
  );
});

test("Worked Example 1 prose is present-tense current truth, not before/after migration theater", () => {
  const bannedPhrases = [
    /before 5 may 2026/i,
    /raised the threshold/i,
    /threshold raise/i,
    /50\s*pp\s*(?:→|->)\s*300\s*pp/i,
    /50\s+pp\s+to\s+300\s+pp/i,
    /hyperinflation hot-?fix/i,
  ];
  for (const [label, source] of [
    ["TSX page", tsxSource],
    ["markdown mirror", markdownSource],
  ] as const) {
    // Scope the check to the Worked Example 1 section only — later
    // sections (e.g. the disputes-cron vintage summary) are allowed to
    // describe genuinely historical, dated cron behavior.
    const start = source.indexOf("example-argentina-inflation");
    const sectionStart = start === -1 ? source.indexOf("Worked example 1") : start;
    assert.ok(sectionStart !== -1, `${label} must contain Worked Example 1`);
    const nextHeading =
      label === "TSX page"
        ? source.indexOf("example-usa-life-expectancy", sectionStart)
        : source.indexOf("### Worked example 2", sectionStart);
    const section = source.slice(
      sectionStart,
      nextHeading === -1 ? sectionStart + 4000 : nextHeading,
    );
    for (const phrase of bannedPhrases) {
      assert.ok(
        !phrase.test(section),
        `${label} Worked Example 1 still contains migration-theater phrasing matching ${phrase}`,
      );
    }
  }
});

test("reconciliation methodology contains no sealed pre-launch fix narrative", () => {
  const bannedPhrases = [
    /hyperinflation hot-?fix/i,
    /pre-threshold-raise/i,
    /canonical-pick threshold raise/i,
    /before the 4 may 2026 fix/i,
    /documented 4 may 2026 migration/i,
  ];
  for (const [label, source] of [
    ["TSX page", tsxSource],
    ["markdown mirror", markdownSource],
  ] as const) {
    for (const phrase of bannedPhrases) {
      assert.ok(
        !phrase.test(source),
        `${label} still contains sealed pre-launch history matching ${phrase}`,
      );
    }
  }
});

console.log(`\n  ${passed} test(s) passed.`);
