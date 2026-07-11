/**
 * Civica Index — published-methodology worked-examples fixture (CLM-008).
 *
 * This is executable documentation: every assertion below recomputes a
 * rule published at /civica-index/methodology using the SAME exported
 * functions/constants that production calls (`calculate-v2.ts`,
 * `monte-carlo.ts`, `normalize-v2.ts`, `dimensions-v2.ts`), plus the
 * shared display-copy source of truth (`site-state.ts`) and the one
 * peer-grouping constant the methodology cites. No formula is
 * reimplemented here — where a test "recomputes" a value it does so by
 * composing the same production primitives a second time with a seeded
 * RNG, never by duplicating the underlying math.
 *
 * DB-free. Runs under `npm test` (glob: src/**\/*.test.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeV2,
  displayDimensionScore,
  defaultUncertaintyV2,
} from "../normalize-v2";
import {
  V2_DIMENSIONS,
  V2_WEIGHTS,
  V2_MANDATORY,
  V2_DIMENSION_LABELS,
} from "../dimensions-v2";
import {
  computeOne,
  classifyCompleteness,
  adjustedWeights,
  PARTIAL_WIDENING_FACTOR,
  BETA_VERSION,
  type DimensionRow,
} from "../calculate-v2";
import { CURRENT_CI_METHODOLOGY_VERSION } from "../current-release";
import { simulateComposite } from "../monte-carlo";
import { civicaIndex } from "@/lib/content/site-state";
import { CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { DEFAULT_MIN_N } from "@/lib/peer-grouping";
import { rankingDimensionCell } from "@/lib/db/queries";

// ─────────────────────────────────────────────────────────────────────
// Seeded RNG (test-only determinism seam; NOT part of the methodology).
// mulberry32 — small, fast, well-distributed for test purposes.
// ─────────────────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 424242;
const seededRng = () => mulberry32(SEED);

function assertClose(
  actual: number | null,
  expected: number,
  label: string,
  tol = 1e-9,
): void {
  assert.ok(actual !== null, `${label}: expected ~${expected}, got null`);
  assert.ok(
    Math.abs(actual - expected) < tol,
    `${label}: expected ~${expected}, got ${actual}`,
  );
}

// Production source_id actually written by each dimension's ingestion
// adapter (scripts/ingest-ci-vdem.ts, ingest-ci-wgi.ts,
// ingest-ci-freedom-house.ts, ingest-ci-cpi.ts). Documented here so the
// fixture matches deployed reality, not an aspirational mapping.
const HEADLINE_SOURCE: Record<(typeof V2_DIMENSIONS)[number], string> = {
  democratic_quality: "vdem",
  rule_of_law: "worldbank_wgi",
  freedom_rights: "freedom_house",
  corruption_control: "transparency_intl",
};

// ─────────────────────────────────────────────────────────────────────
// §3 Normalization — the four headline fixed-bound transforms.
// ─────────────────────────────────────────────────────────────────────

test("§3 four headline normalizations: each dimension's actual production source transforms correctly", () => {
  // democratic_quality <- V-Dem Liberal Democracy Index, 0..1 -> x100
  assertClose(normalizeV2(0.72, HEADLINE_SOURCE.democratic_quality), 72, "vdem 0.72");
  // rule_of_law <- World Bank WGI Rule of Law, -2.5..2.5 -> ((x+2.5)/5)*100
  assertClose(normalizeV2(0.1, HEADLINE_SOURCE.rule_of_law), 52, "wgi 0.1");
  // freedom_rights <- Freedom House PR+CL, 2..14 inverted -> ((14-x)/12)*100
  assertClose(normalizeV2(4, HEADLINE_SOURCE.freedom_rights), (14 - 4) / 12 * 100, "fh 4");
  // corruption_control <- Transparency Intl CPI, already 0..100
  assertClose(normalizeV2(55, HEADLINE_SOURCE.corruption_control), 55, "cpi 55");
});

test("§3 fixed-bound direction/clamping: non-inverted rises with raw, inverted falls, both clamp to [0,100]", () => {
  // Non-inverted sources: higher raw -> higher normalized score.
  assert.ok(
    normalizeV2(0.9, "vdem")! > normalizeV2(0.1, "vdem")!,
    "vdem should be non-inverted",
  );
  // Inverted source (Freedom House): lower raw (more free) -> higher score.
  assert.ok(
    normalizeV2(2, "freedom_house")! > normalizeV2(14, "freedom_house")!,
    "freedom_house should be inverted",
  );
  // Clamping never overflows the published 0-100 scale.
  assert.equal(normalizeV2(1.5, "vdem"), 100);
  assert.equal(normalizeV2(-0.5, "vdem"), 0);
  assert.equal(normalizeV2(-3.0, "worldbank_wgi"), 0);
  assert.equal(normalizeV2(3.0, "worldbank_wgi"), 100);
  // Unknown/unrecognized source -> null, never a fabricated value.
  assert.equal(normalizeV2(0.5, "some_future_source"), null);
  assert.equal(displayDimensionScore(0.5, "some_future_source"), null);
});

// ─────────────────────────────────────────────────────────────────────
// §4 Weight determination — weights sum to 1 and reconcile with the
// site-state display copy used by the methodology page and dimension
// table.
// ─────────────────────────────────────────────────────────────────────

test("§4 weights: V2_WEIGHTS sums to 1.00 and matches published site-state dimension metadata", () => {
  const sum = V2_DIMENSIONS.reduce((s, d) => s + V2_WEIGHTS[d], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights should sum to 1.00, got ${sum}`);

  assert.equal(civicaIndex.dimensionCount, V2_DIMENSIONS.length);
  assert.equal(civicaIndex.dimensions.length, V2_DIMENSIONS.length);
  for (const d of civicaIndex.dimensions) {
    assert.equal(
      V2_WEIGHTS[d.id as (typeof V2_DIMENSIONS)[number]],
      d.weight,
      `${d.id}: dimensions-v2.ts and site-state.ts weights drifted`,
    );
    assert.equal(
      V2_DIMENSION_LABELS[d.id as (typeof V2_DIMENSIONS)[number]],
      d.label,
      `${d.id}: dimensions-v2.ts and site-state.ts labels drifted`,
    );
  }
});

test("§14 beta/release presentation: methodology-version constant and beta status are coherent", () => {
  assert.equal(BETA_VERSION, CURRENT_CI_METHODOLOGY_VERSION);
  assert.equal(civicaIndex.status, "beta");
  assert.equal(CI_METHODOLOGY_META.status, civicaIndex.status);
  assert.equal(CI_METHODOLOGY_META.presentation.format, "numeric_position");
  assert.equal(
    CI_METHODOLOGY_META.presentation.input_variation_range,
    "central_90_percent",
  );
  assert.equal(CI_METHODOLOGY_META.presentation.categorical_grades, false);
  assert.equal(
    CI_METHODOLOGY_META.missingness.policy_id,
    civicaIndex.missingness.id,
  );
  assert.equal(
    CI_METHODOLOGY_META.missingness.minimum_dimensions_for_publication,
    3,
  );
});

// ─────────────────────────────────────────────────────────────────────
// §7 Missing data — mandatory-dimension exclusion, full composite,
// partial re-proportioning + widening. Every composite value below is
// cross-checked against a manual composition of the SAME exported
// primitives (adjustedWeights, normalizeV2, defaultUncertaintyV2,
// PARTIAL_WIDENING_FACTOR, simulateComposite) fed an identically-seeded
// RNG — so a bit-exact match proves computeOne performs re-proportioning
// and widening exactly as published, not merely "close enough."
// ─────────────────────────────────────────────────────────────────────

const FULL_RAW: Record<(typeof V2_DIMENSIONS)[number], number> = {
  democratic_quality: 0.72,
  rule_of_law: 0.1,
  freedom_rights: 4,
  corruption_control: 55,
};

function buildRows(
  dims: readonly (typeof V2_DIMENSIONS)[number][],
  jurisdictionId: string,
): DimensionRow[] {
  return dims.map((d) => ({
    jurisdictionId,
    dimension: d,
    rawValue: FULL_RAW[d],
    sourceId: HEADLINE_SOURCE[d],
  }));
}

test("mandatory-dimension exclusion: missing rule_of_law yields insufficient / null composite", () => {
  const present = new Set<string>([
    "democratic_quality",
    "freedom_rights",
    "corruption_control",
  ]);
  const { completeness, missing } = classifyCompleteness(present);
  assert.equal(completeness, "insufficient");
  assert.deepEqual(missing, ["rule_of_law"]);
  assert.ok(V2_MANDATORY.includes("rule_of_law"));

  const rows = buildRows(
    ["democratic_quality", "freedom_rights", "corruption_control"],
    "test-insufficient",
  );
  assert.equal(computeOne(rows, 500, seededRng()), null);
});

test("publication threshold: two mandatory dimensions alone remain insufficient", () => {
  const rows = buildRows(
    ["democratic_quality", "rule_of_law"],
    "test-two-dimensions",
  );
  const assessment = classifyCompleteness(
    new Set(rows.map((row) => row.dimension)),
  );
  assert.equal(assessment.completeness, "insufficient");
  assert.deepEqual(assessment.missing, [
    "freedom_rights",
    "corruption_control",
  ]);
  assert.equal(computeOne(rows, 500, seededRng()), null);
});

test("full composite: computeOne matches manual composition of the same production primitives", () => {
  const rows = buildRows(V2_DIMENSIONS, "test-full");
  const actual = computeOne(rows, 2000, seededRng());
  assert.ok(actual !== null);
  assert.equal(actual.completeness, "full");
  assert.equal(actual.dimensionsAvailable, 4);
  assert.deepEqual(actual.missingDimensions, []);

  const weights = adjustedWeights([...V2_DIMENSIONS]);
  const mcInputs = V2_DIMENSIONS.map((d) => ({
    key: d,
    mean: normalizeV2(FULL_RAW[d], HEADLINE_SOURCE[d])!,
    stdDev: defaultUncertaintyV2(HEADLINE_SOURCE[d]),
    weight: weights[d],
  }));
  const expected = simulateComposite(mcInputs, 2000, seededRng());

  assert.equal(actual.scoreInteger, Math.round(expected.scoreMedian));
  assert.equal(actual.scoreLower, Math.round(expected.lower));
  assert.equal(actual.scoreUpper, Math.round(expected.upper));
  assert.ok(actual.scoreInteger >= 0 && actual.scoreInteger <= 100);
  assert.ok(actual.scoreLower <= actual.scoreInteger);
  assert.ok(actual.scoreInteger <= actual.scoreUpper);
  // No categorical grade of any kind on the composite result.
  assert.ok(!("band" in actual));
  assert.ok(!("grade" in actual));
});

test("partial composite: available dimensions are re-proportioned to sum to 1 and the range widens by PARTIAL_WIDENING_FACTOR", () => {
  const presentDims = [
    "democratic_quality",
    "rule_of_law",
    "freedom_rights",
  ] as const;
  const rows = buildRows(presentDims, "test-partial");
  const actual = computeOne(rows, 2000, seededRng());
  assert.ok(actual !== null);
  assert.equal(actual.completeness, "partial");
  assert.equal(actual.dimensionsAvailable, 3);
  assert.deepEqual(actual.missingDimensions, ["corruption_control"]);

  const weights = adjustedWeights([...presentDims]);
  const weightSum = presentDims.reduce((s, d) => s + weights[d], 0);
  assert.ok(
    Math.abs(weightSum - 1) < 1e-9,
    `re-proportioned partial weights should sum to 1.00, got ${weightSum}`,
  );
  // Proves re-proportioning actually happened (not a no-op): the raw v2
  // weights over just these 3 dimensions do NOT sum to 1.
  const rawWeightSum = presentDims.reduce((s, d) => s + V2_WEIGHTS[d], 0);
  assert.ok(rawWeightSum < 0.999, "raw weights over 3 dims should be < 1");

  assert.equal(PARTIAL_WIDENING_FACTOR, 1.2);
  const mcInputs = presentDims.map((d) => ({
    key: d,
    mean: normalizeV2(FULL_RAW[d], HEADLINE_SOURCE[d])!,
    stdDev: defaultUncertaintyV2(HEADLINE_SOURCE[d]) * PARTIAL_WIDENING_FACTOR,
    weight: weights[d],
  }));
  const expected = simulateComposite(mcInputs, 2000, seededRng());

  assert.equal(actual.scoreInteger, Math.round(expected.scoreMedian));
  assert.equal(actual.scoreLower, Math.round(expected.lower));
  assert.equal(actual.scoreUpper, Math.round(expected.upper));
});

// ─────────────────────────────────────────────────────────────────────
// §5 Input-variation ranges — deterministic Monte Carlo median/P5/P95.
// ─────────────────────────────────────────────────────────────────────

test("§5 Monte Carlo: identical seed reproduces the exact median/P5/P95; result is internally monotonic", () => {
  const dims = V2_DIMENSIONS.map((d) => ({
    key: d,
    mean: normalizeV2(FULL_RAW[d], HEADLINE_SOURCE[d])!,
    stdDev: defaultUncertaintyV2(HEADLINE_SOURCE[d]),
    weight: V2_WEIGHTS[d],
  }));

  const a = simulateComposite(dims, 3000, mulberry32(7));
  const b = simulateComposite(dims, 3000, mulberry32(7));
  assert.equal(a.scoreMedian, b.scoreMedian);
  assert.equal(a.lower, b.lower);
  assert.equal(a.upper, b.upper);
  assert.ok(a.lower <= a.scoreMedian);
  assert.ok(a.scoreMedian <= a.upper);

  const c = simulateComposite(dims, 3000, mulberry32(99));
  assert.ok(
    a.scoreMedian !== c.scoreMedian || a.lower !== c.lower || a.upper !== c.upper,
    "a different seed should shift the simulated distribution",
  );
});

// ─────────────────────────────────────────────────────────────────────
// Rankings-matrix regression (CLM-008 root scope refinement): the Beta
// panel must read raw_value + displayDimensionScore, never the legacy
// v1 normalized_score column.
// ─────────────────────────────────────────────────────────────────────

test("rankings matrix: dimension cell uses raw_value + displayDimensionScore, never a legacy fallback", () => {
  const cell = rankingDimensionCell(0.72, "vdem", "2026-04-01T00:00:00Z");
  assert.ok(cell !== null);
  assertClose(cell.value, 72, "vdem raw 0.72 via rankingDimensionCell");
  assert.equal(cell.source, "vdem");
  assert.equal(cell.retrievedAt, "2026-04-01T00:00:00.000Z");

  // Unrecognized source (e.g. a stale v1-only source_id) hides the cell
  // instead of silently falling back to a stored value.
  assert.equal(rankingDimensionCell(0.72, "not_a_v2_source", null), null);
  assert.equal(rankingDimensionCell(null, "vdem", null), null);
  assert.equal(rankingDimensionCell(undefined, "vdem", null), null);
});

// ─────────────────────────────────────────────────────────────────────
// Cross-reference — peer-grouping minimum-n constant cited by the
// published methodology (§9 links to the peer-grouping methodology).
// ─────────────────────────────────────────────────────────────────────

test("peer-grouping minimum n: production constant matches the published value (n >= 8)", () => {
  assert.equal(DEFAULT_MIN_N, 8);
});
