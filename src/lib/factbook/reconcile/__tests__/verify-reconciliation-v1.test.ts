/**
 * v1.0 verification suite — pure-helper unit tests.
 *
 * Run with:
 *     npx tsx src/lib/factbook/reconcile/__tests__/verify-reconciliation-v1.test.ts
 *
 * Pure helpers only — `classifyComparator`, `softenStatus`,
 * `aggregateStatus`. No DB IO. The full suite (`runVerificationSuite`)
 * is exercised by the cron route's smoke run + the manual CLI run.
 *
 * Methodology: ~/civica/plan/v1-verification-suite-resolution-v1.md
 */
import assert from "node:assert/strict";
import {
  classifyComparator,
  softenStatus,
  aggregateStatus,
  type VerificationMetric,
} from "@/lib/factbook/reconcile/verify-reconciliation-v1";

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

// ── classifyComparator ──────────────────────────────────────────────

console.log("classifyComparator");

test(">= passes when actual exceeds threshold", () => {
  assert.equal(classifyComparator(">=", 17, 20), "pass");
});

test(">= passes when actual equals threshold", () => {
  assert.equal(classifyComparator(">=", 17, 17), "pass");
});

test(">= fails when actual is below threshold", () => {
  assert.equal(classifyComparator(">=", 30, 27), "fail");
});

test("<= passes when actual is below threshold", () => {
  assert.equal(classifyComparator("<=", 200, 2), "pass");
});

test("<= fails when actual exceeds threshold", () => {
  assert.equal(classifyComparator("<=", 50, 100), "fail");
});

test("== passes for matching strings", () => {
  assert.equal(classifyComparator("==", "v0.2-beta", "v0.2-beta"), "pass");
});

test("== fails for mismatched strings", () => {
  assert.equal(classifyComparator("==", "v0.2-beta", "v0.1-beta"), "fail");
});

test("== passes for matching numbers as zero-counts", () => {
  // Used by nso_sync_status: actual=0 missing, threshold=0 → pass.
  assert.equal(classifyComparator("==", 0, 0), "pass");
});

test("== fails when one source is missing sync", () => {
  assert.equal(classifyComparator("==", 0, 1), "fail");
});

test("!= passes when values differ", () => {
  assert.equal(classifyComparator("!=", "a", "b"), "pass");
});

test("!= fails when values match", () => {
  assert.equal(classifyComparator("!=", "a", "a"), "fail");
});

test("regex_match passes on matching label", () => {
  const regex = "^Civica Atlas Reconciled v\\d+\\.\\d+-beta — vintage \\d{4}-Q\\d$";
  const label = "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1";
  assert.equal(classifyComparator("regex_match", regex, label), "pass");
});

test("regex_match fails on legacy label", () => {
  const regex = "^Civica Atlas Reconciled v\\d+\\.\\d+-beta — vintage \\d{4}-Q\\d$";
  const label = "Civica Atlas 2026Q3";
  assert.equal(classifyComparator("regex_match", regex, label), "fail");
});

// ── softenStatus ────────────────────────────────────────────────────

console.log("\nsoftenStatus");

test("pass stays pass regardless of phase or gating", () => {
  assert.equal(softenStatus("pass", true, "launched"), "pass");
  assert.equal(softenStatus("pass", true, "pre-launch-beta"), "pass");
  assert.equal(softenStatus("pass", false, "launched"), "pass");
  assert.equal(softenStatus("pass", false, "pre-launch-beta"), "pass");
});

test("gating fail → fail when launched", () => {
  assert.equal(softenStatus("fail", true, "launched"), "fail");
});

test("gating fail → warn when pre-launch", () => {
  assert.equal(softenStatus("fail", true, "pre-launch-beta"), "warn");
});

test("non-gating fail → warn regardless of phase", () => {
  assert.equal(softenStatus("fail", false, "launched"), "warn");
  assert.equal(softenStatus("fail", false, "pre-launch-beta"), "warn");
});

// ── aggregateStatus ─────────────────────────────────────────────────

console.log("\naggregateStatus");

function metric(
  id: string,
  status: "pass" | "warn" | "fail",
  gating = true,
): VerificationMetric {
  return {
    id,
    label: id,
    category: "coverage",
    status,
    gating,
    comparator: ">=",
    threshold: 0,
    actual: 0,
    message: "",
  };
}

test("all pass → pass", () => {
  assert.equal(
    aggregateStatus([metric("a", "pass"), metric("b", "pass")]),
    "pass",
  );
});

test("any fail → fail (short-circuits)", () => {
  assert.equal(
    aggregateStatus([
      metric("a", "pass"),
      metric("b", "fail"),
      metric("c", "warn"),
    ]),
    "fail",
  );
});

test("any warn (no fail) → warn", () => {
  assert.equal(
    aggregateStatus([
      metric("a", "pass"),
      metric("b", "warn"),
      metric("c", "pass"),
    ]),
    "warn",
  );
});

test("empty array → pass (no metrics evaluated)", () => {
  assert.equal(aggregateStatus([]), "pass");
});

// ── Integration: pre-launch softening end-to-end ───────────────────

console.log("\nintegration");

test("pre-launch + gating fail surfaces as warn at metric AND aggregate", () => {
  // Simulate the multi_sourced_two regression at v1.0 ground truth:
  // threshold 27, actual 26 (one short). Pre-launch.
  const raw = classifyComparator(">=", 27, 26);
  assert.equal(raw, "fail");
  const softened = softenStatus(raw, true, "pre-launch-beta");
  assert.equal(softened, "warn");
  // Aggregate: a pass + this warn → warn overall, NOT fail.
  const metricA = metric("active_sources", "pass");
  const metricB: VerificationMetric = {
    ...metric("multi_sourced_two", softened),
  };
  assert.equal(aggregateStatus([metricA, metricB]), "warn");
});

test("launched + gating fail surfaces as fail end-to-end", () => {
  // Same regression, but launched. Should fire the alert.
  const raw = classifyComparator(">=", 27, 26);
  const softened = softenStatus(raw, true, "launched");
  assert.equal(softened, "fail");
  const metricA = metric("active_sources", "pass");
  const metricB: VerificationMetric = {
    ...metric("multi_sourced_two", softened),
  };
  assert.equal(aggregateStatus([metricA, metricB]), "fail");
});

test("non-gating regression never escalates beyond warn", () => {
  // open_disputes_bottleneck with 100 open vs threshold 50.
  const raw = classifyComparator("<=", 50, 100);
  assert.equal(raw, "fail");
  // gating=false → always warn.
  assert.equal(softenStatus(raw, false, "launched"), "warn");
  assert.equal(softenStatus(raw, false, "pre-launch-beta"), "warn");
});

console.log(`\n  ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
