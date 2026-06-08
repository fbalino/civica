/**
 * Regression tests for the Civica Index v2 fixed-bound dimension
 * normalization — `src/lib/ci/normalize-v2.ts`.
 *
 * This is the fix that made the per-dimension breakdown reconcile with
 * the headline composite: every source is mapped to 0-100 using FIXED
 * THEORETICAL bounds (methodology §2.3), not observed min/max. The
 * expected numbers below are derived from each source's own bounds and
 * formula so the suite encodes the intended methodology, not a snapshot.
 *
 *   normalizeV2(raw, src):
 *     non-inverted: ((raw - min) / (max - min)) * 100
 *     inverted:     ((max - raw) / (max - min)) * 100
 *     result clamped to [0, 100]; unknown source -> null.
 *
 * Pure: no DB, no network. Runs under `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeV2, displayDimensionScore } from "../normalize-v2";

/**
 * Normalized results carry IEEE-754 noise (e.g. 0.824 * 100 evaluates
 * to 82.39999999999999). Assert to within a tight tolerance against the
 * EXACT intended methodology value so the test documents the number, not
 * the float artifact. Boundary/clamp cases that are exact in IEEE-754
 * (0, 100, etc.) use strict `assert.equal` to lock them precisely.
 */
function assertNorm(actual: number | null, expected: number, label: string): void {
  assert.ok(actual !== null, `${label}: expected ~${expected}, got null`);
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ~${expected}, got ${actual}`,
  );
}

test("World Bank WGI: linear over [-2.5, 2.5], higher = better", () => {
  // A rule_of_law-style raw of 0.95 on the -2.5..2.5 native scale:
  //   (0.95 - (-2.5)) / (2.5 - (-2.5)) * 100 = 3.45 / 5 * 100 = 69
  assertNorm(normalizeV2(0.95, "worldbank_wgi"), 69, "wgi 0.95");
  // The corruption-control WGI variant shares identical bounds.
  assertNorm(
    normalizeV2(0.95, "worldbank_wgi_corruption"),
    69,
    "wgi_corruption 0.95",
  );
  // Endpoints + midpoint are exact.
  assert.equal(normalizeV2(-2.5, "worldbank_wgi"), 0);
  assert.equal(normalizeV2(2.5, "worldbank_wgi"), 100);
  assert.equal(normalizeV2(0, "worldbank_wgi"), 50);
});

test("V-Dem: identity over [0, 1] scaled to 0-100", () => {
  // 0.824 on the 0..1 native scale -> 82.4 (0.824 * 100).
  assertNorm(normalizeV2(0.824, "vdem"), 82.4, "vdem 0.824");
  // The polyarchy / rule sibling keys share the 0..1 bounds.
  assertNorm(normalizeV2(0.824, "vdem_polyarchy"), 82.4, "vdem_polyarchy 0.824");
  assertNorm(normalizeV2(0.824, "vdem_rule"), 82.4, "vdem_rule 0.824");
  assert.equal(normalizeV2(0, "vdem"), 0);
  assert.equal(normalizeV2(1, "vdem"), 100);
});

test("Freedom House: inverted PR+CL sum over [2, 14] -> (14 - s) / 12 * 100", () => {
  // Methodology §2.3 formula. Lower raw = more free, so this source is
  // inverted (nativeMin 2, nativeMax 14).
  assert.equal(normalizeV2(2, "freedom_house"), 100); // most free
  assert.equal(normalizeV2(14, "freedom_house"), 0); // least free
  assert.equal(normalizeV2(8, "freedom_house"), 50); // midpoint
  assertNorm(normalizeV2(5, "freedom_house"), 75, "fh 5"); // (14-5)/12*100 = 75
});

test("Transparency CPI: already 0-100, identity transform", () => {
  assertNorm(normalizeV2(65, "transparency_intl"), 65, "cpi 65");
  assert.equal(normalizeV2(0, "transparency_intl"), 0);
  assert.equal(normalizeV2(100, "transparency_intl"), 100);
});

test("out-of-range raw values clamp to [0, 100], never overflow", () => {
  // V-Dem occasionally reports 1.001 etc — must clamp to 100, not exceed.
  assert.equal(normalizeV2(1.001, "vdem"), 100);
  assert.equal(normalizeV2(-0.2, "vdem"), 0);
  // WGI below / above the theoretical bounds clamp to the endpoints.
  assert.equal(normalizeV2(-3.0, "worldbank_wgi"), 0);
  assert.equal(normalizeV2(3.0, "worldbank_wgi"), 100);
});

test("unknown source -> null (caller skips the dimension)", () => {
  assert.equal(normalizeV2(0.5, "not_a_source"), null);
  assert.equal(normalizeV2(0.5, ""), null);
});

test("displayDimensionScore guards missing / NaN raw -> null, never NaN", () => {
  assert.equal(displayDimensionScore(null, "vdem"), null);
  assert.equal(displayDimensionScore(undefined, "vdem"), null);
  assert.equal(displayDimensionScore(NaN, "vdem"), null);
  // Unknown source also yields null (the dimension did not contribute to
  // the headline either, so the row should be hidden / fall back).
  assert.equal(displayDimensionScore(0.824, "not_a_source"), null);
  // Happy path delegates to normalizeV2 and matches it exactly.
  assertNorm(displayDimensionScore(0.824, "vdem"), 82.4, "display vdem 0.824");
});
