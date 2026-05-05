/**
 * Phase R.21 — `dispute-severity` unit tests.
 *
 * Run with:
 *     npx tsx src/lib/factbook/reconcile/__tests__/dispute-severity.test.ts
 *
 * Pure helper, no DB or fixtures.
 *
 * Methodology: ~/civica/plan/disputes-triage-resolution-v1.md §2c
 */
import assert from "node:assert/strict";
import {
  computeSeverity,
  formatSeverity,
  SEVERITY_BUCKETS,
} from "@/lib/factbook/reconcile/dispute-severity";

let pass = 0;
let fail = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  pass  ${name}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log("    ", (err as Error).message);
    fail++;
  }
}

console.log("dispute-severity tests");

test("returns null severity for non-numeric inputs", () => {
  const score = computeSeverity("public_debt_pct_gdp", null, 100);
  assert.equal(score.severity, null);
  assert.equal(score.bucket, null);
  assert.equal(score.gap, null);
});

test("returns null severity for unknown fact-key", () => {
  const score = computeSeverity("not_a_real_key", 50, 80);
  assert.equal(score.severity, null);
  assert.equal(score.bucket, null);
  assert.equal(score.gap, 30);
});

test("pp threshold path — public_debt_pct_gdp gap=80 / threshold=300", () => {
  // Bolivia case from probe: 49 vs 102.7 = 53.7 gap, 0.18× threshold
  const score = computeSeverity("public_debt_pct_gdp", 49.0, 102.7);
  assert.ok(score.severity != null, "severity should be numeric");
  assert.equal(score.thresholdKind, "pp");
  assert.equal(score.thresholdValue, 300);
  // 53.7 / 300 ≈ 0.179
  assert.ok(Math.abs(score.severity! - 0.179) < 0.01);
  assert.equal(score.bucket, "lo");
});

test("pp threshold path — Marshall Islands population_total live case", () => {
  // CIA 82011 vs WB 37548 = 44463 gap, threshold = 0.5 × max(82011, 37548) = 41005.5
  const score = computeSeverity("population_total", 82011, 37548);
  assert.ok(score.severity != null);
  assert.equal(score.thresholdKind, "pct");
  assert.equal(score.thresholdValue, 0.5);
  // 44463 / 41005.5 ≈ 1.084
  assert.ok(Math.abs(score.severity! - 1.084) < 0.01);
  assert.equal(score.bucket, "mid");
});

test("pp threshold path — Venezuela debt 269.8 / 300 = 0.90", () => {
  const score = computeSeverity("public_debt_pct_gdp", 38.9, 308.7);
  assert.ok(score.severity != null);
  // 269.8 / 300 ≈ 0.899
  assert.ok(Math.abs(score.severity! - 0.899) < 0.01);
  assert.equal(score.bucket, "mid");
});

test("xhi bucket fires at >= 3.0", () => {
  // Synthetic: contrive a 1000pp inflation gap (Venezuela in 2018-style)
  const score = computeSeverity("inflation_rate", 0, 1000);
  assert.equal(score.bucket, "xhi");
});

test("hi bucket boundary: 1.5× threshold", () => {
  // public_debt: gap = 450 vs threshold 300 → 1.5×
  const score = computeSeverity("public_debt_pct_gdp", 0, 450);
  assert.equal(score.bucket, "hi");
});

test("formatSeverity prints with 2 decimal places", () => {
  const score = computeSeverity("public_debt_pct_gdp", 49.0, 102.7);
  const formatted = formatSeverity(score);
  assert.match(formatted, /^0\.\d{2}× threshold$/);
});

test("formatSeverity returns em-dash for null severity", () => {
  const score = computeSeverity("not_a_real_key", null, null);
  assert.equal(formatSeverity(score), "—");
});

test("zero-denom guard for pct threshold", () => {
  // both values 0; pct path would divide by zero
  const score = computeSeverity("population_total", 0, 0);
  assert.equal(score.severity, null);
});

test("SEVERITY_BUCKETS contains lo/mid/hi/xhi in order", () => {
  assert.deepEqual([...SEVERITY_BUCKETS], ["lo", "mid", "hi", "xhi"]);
});

console.log(`\n  ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
