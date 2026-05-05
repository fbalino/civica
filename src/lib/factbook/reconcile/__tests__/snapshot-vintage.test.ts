/**
 * Phase R.22 — `snapshot-vintage` unit tests.
 *
 * Run with:
 *     npx tsx src/lib/factbook/reconcile/__tests__/snapshot-vintage.test.ts
 *
 * Tests the pure helpers (label derivation, content hash). The
 * full snapshot orchestration is covered by the live smoke test
 * documented in the resolution doc's adoption appendix.
 *
 * Methodology: ~/civica/plan/vintage-cadence-resolution-v1.md
 */
import assert from "node:assert/strict";
import {
  buildVintageLabel,
  computeContentHash,
  deriveQuarterFromCutDate,
  deriveVintageLabel,
  VINTAGE_METHODOLOGY_VERSION,
} from "@/lib/factbook/reconcile/snapshot-vintage";

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

console.log("snapshot-vintage tests");

/* ─────────────── buildVintageLabel ─────────────── */

test("buildVintageLabel composes long-form label", () => {
  assert.equal(
    buildVintageLabel("v0.2-beta", "2026-Q1"),
    "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1",
  );
});

test("buildVintageLabel handles future v1.0", () => {
  assert.equal(
    buildVintageLabel("v1.0", "2027-Q1"),
    "Civica Atlas Reconciled v1.0 — vintage 2027-Q1",
  );
});

/* ─────────────── deriveQuarterFromCutDate ─────────────── */

test("Jan 15 cut maps to prior year's Q4 (boundary day)", () => {
  // Jan 15, 2026 — Q4-2025 closed Dec 31, Q1-2026 not yet closed
  assert.equal(
    deriveQuarterFromCutDate(new Date("2026-01-15T04:00:00Z")),
    "2025-Q4",
  );
});

test("Apr 15 cut maps to Q1 of same year (boundary day)", () => {
  assert.equal(
    deriveQuarterFromCutDate(new Date("2026-04-15T04:00:00Z")),
    "2026-Q1",
  );
});

test("Jul 15 cut maps to Q2", () => {
  assert.equal(
    deriveQuarterFromCutDate(new Date("2026-07-15T04:00:00Z")),
    "2026-Q2",
  );
});

test("Oct 15 cut maps to Q3", () => {
  assert.equal(
    deriveQuarterFromCutDate(new Date("2026-10-15T04:00:00Z")),
    "2026-Q3",
  );
});

test("Mar 31 cut still maps to prior Q4 (Q1 not yet closed)", () => {
  assert.equal(
    deriveQuarterFromCutDate(new Date("2026-03-31T23:59:59Z")),
    "2025-Q4",
  );
});

test("Apr 1 cut maps to Q1 (Q1 just closed)", () => {
  assert.equal(
    deriveQuarterFromCutDate(new Date("2026-04-01T00:00:00Z")),
    "2026-Q1",
  );
});

test("Mid-quarter May 5 cut (R.22 first-cut date) maps to Q1", () => {
  // May 5, 2026 — Q1-2026 closed Mar 31, Q2-2026 still in progress
  assert.equal(
    deriveQuarterFromCutDate(new Date("2026-05-05T12:00:00Z")),
    "2026-Q1",
  );
});

test("Mid-quarter August 20 cut maps to Q2", () => {
  assert.equal(
    deriveQuarterFromCutDate(new Date("2026-08-20T12:00:00Z")),
    "2026-Q2",
  );
});

test("Dec 31 end-of-year cut still maps to Q3 (Q4 not yet closed)", () => {
  assert.equal(
    deriveQuarterFromCutDate(new Date("2026-12-31T23:59:00Z")),
    "2026-Q3",
  );
});

test("Jan 1 New Year cut maps to prior Q4 (Q4 just closed)", () => {
  assert.equal(
    deriveQuarterFromCutDate(new Date("2027-01-01T00:00:00Z")),
    "2026-Q4",
  );
});

/* ─────────────── deriveVintageLabel (composition) ─────────────── */

test("deriveVintageLabel composes label from cut date", () => {
  assert.equal(
    deriveVintageLabel(new Date("2026-05-05T12:00:00Z")),
    `Civica Atlas Reconciled ${VINTAGE_METHODOLOGY_VERSION} — vintage 2026-Q1`,
  );
});

test("deriveVintageLabel honours methodology-version override", () => {
  assert.equal(
    deriveVintageLabel(new Date("2027-04-15T04:00:00Z"), "v1.0"),
    "Civica Atlas Reconciled v1.0 — vintage 2027-Q1",
  );
});

/* ─────────────── computeContentHash ─────────────── */

test("computeContentHash returns 64-char hex SHA-256", () => {
  const hash = computeContentHash({
    sourceId: "world_bank",
    valueText: "100",
    valueNumeric: 100,
    asOf: "2026-03-31",
    methodologyVersion: "v0.2-beta",
  });
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("computeContentHash is stable for identical inputs", () => {
  const a = computeContentHash({
    sourceId: "imf_weo",
    valueText: "211.4",
    valueNumeric: 211.4,
    asOf: "2026-04-15",
    methodologyVersion: "v0.2-beta",
  });
  const b = computeContentHash({
    sourceId: "imf_weo",
    valueText: "211.4",
    valueNumeric: 211.4,
    asOf: "2026-04-15",
    methodologyVersion: "v0.2-beta",
  });
  assert.equal(a, b);
});

test("computeContentHash drifts when value changes", () => {
  const a = computeContentHash({
    sourceId: "world_bank",
    valueText: "100",
    valueNumeric: 100,
    asOf: "2026-03-31",
    methodologyVersion: "v0.2-beta",
  });
  const b = computeContentHash({
    sourceId: "world_bank",
    valueText: "101",
    valueNumeric: 101,
    asOf: "2026-03-31",
    methodologyVersion: "v0.2-beta",
  });
  assert.notEqual(a, b);
});

test("computeContentHash drifts when source changes", () => {
  const a = computeContentHash({
    sourceId: "world_bank",
    valueText: "100",
    valueNumeric: 100,
    asOf: "2026-03-31",
    methodologyVersion: "v0.2-beta",
  });
  const b = computeContentHash({
    sourceId: "imf_weo",
    valueText: "100",
    valueNumeric: 100,
    asOf: "2026-03-31",
    methodologyVersion: "v0.2-beta",
  });
  assert.notEqual(a, b);
});

test("computeContentHash handles null value fields without crashing", () => {
  const hash = computeContentHash({
    sourceId: "cia_factbook",
    valueText: null,
    valueNumeric: null,
    asOf: null,
    methodologyVersion: "v0.1-beta",
  });
  assert.equal(hash.length, 64);
});

console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
