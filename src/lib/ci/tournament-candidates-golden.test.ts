/**
 * QA-007 — Index-candidate golden: baselines B0–B3 and candidates K1–K5.
 *
 * One fixed synthetic development-split panel drives every tournament
 * method. The expected values below were CAPTURED by running the real
 * production functions on this exact fixture (never hand-derived), then
 * locked here. Any drift in a baseline/candidate calculation changes an
 * asserted value and fails.
 *
 * Producing functions (source of truth):
 *   - B0–B3: `dashboardBaseline` / `singleIndicatorBaseline` /
 *     `equalWeightBaseline` / `fitFirstFactorBaseline` +
 *     `firstFactorBaseline` (src/lib/ci/tournament-baselines.ts)
 *   - K1: `runK1TournamentCandidate` (tournament-candidate-k1.ts)
 *   - K2: `runK2Concordance` (tournament-candidate-k2.ts)
 *   - K3: `runK3LedgerPrototype` (tournament-candidate-k3.ts)
 *   - K4: `runK4PairingPrototype` (tournament-candidate-k4.ts)
 *   - K5: `runK5RelationCandidateExtraction` (tournament-candidate-k5.ts)
 *
 * The three iso3 codes (ZAC/ZAD/ZAE) were chosen because
 * `jointTournamentSplit(iso3, 2005) === "development"` for each — the split
 * assignment is a deterministic SHA-256 hash of the iso3, so these are
 * reproducible. Pure: no DB, no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  dashboardBaseline,
  singleIndicatorBaseline,
  equalWeightBaseline,
  fitFirstFactorBaseline,
  firstFactorBaseline,
  jointTournamentSplit,
  type BaselinePanelObservation,
} from "./tournament-baselines";
import { runK1TournamentCandidate, type K1PanelInput } from "./tournament-candidate-k1";
import { runK2Concordance, type K2PanelInput } from "./tournament-candidate-k2";
import { runK3LedgerPrototype, k3LedgerHash, type K3TermInput } from "./tournament-candidate-k3";
import { runK4PairingPrototype, k4PairingHash, type K4ExcerptInput, type K4PracticeInput } from "./tournament-candidate-k4";
import { runK5RelationCandidateExtraction, k5RelationHash, type K5ExcerptInput } from "./tournament-candidate-k5";

const ISO3 = ["ZAC", "ZAD", "ZAE"] as const;
const YEAR = 2005;

// Fixed governance vectors per unit. `va` disagrees with vdem/fh on ZAE so
// the K2 concordance golden is non-trivial (real between-source spread).
const VECS: Record<string, { libdem: number; va: number; rl: number; fh: number; cpi: number }> = {
  ZAC: { libdem: 0.72, va: 0.9, rl: 0.4, fh: 4, cpi: 62 },
  ZAD: { libdem: 0.31, va: -0.5, rl: -0.8, fh: 9, cpi: 28 },
  ZAE: { libdem: 0.55, va: 0.95, rl: 0.1, fh: 6, cpi: 45 },
};

function assertClose(actual: number | null, expected: number, label: string, tol = 1e-9): void {
  assert.ok(actual !== null, `${label}: expected ~${expected}, got null`);
  assert.ok(Math.abs(actual - expected) < tol, `${label}: expected ~${expected}, got ${actual}`);
}

test("split assignment for the golden iso3 fixture is development (deterministic hash)", () => {
  for (const iso3 of ISO3) assert.equal(jointTournamentSplit(iso3, YEAR), "development");
});

// ── Baselines ────────────────────────────────────────────────────────────
function baselineRows(): BaselinePanelObservation[] {
  const rows: BaselinePanelObservation[] = [];
  for (const iso3 of ISO3) {
    const v = VECS[iso3];
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, sourceId: "vdem", indicatorId: "v2x_libdem", value: v.libdem, nativeMin: 0, nativeMax: 1, isInverted: false });
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, sourceId: "worldbank_wgi", indicatorId: "va.est", value: v.va, nativeMin: -2.5, nativeMax: 2.5, isInverted: false });
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, sourceId: "worldbank_wgi", indicatorId: "rl.est", value: v.rl, nativeMin: -2.5, nativeMax: 2.5, isInverted: false });
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, sourceId: "freedom_house", indicatorId: "pr_cl_total", value: v.fh, nativeMin: 2, nativeMax: 14, isInverted: true });
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, sourceId: "transparency_intl", indicatorId: "score", value: v.cpi, nativeMin: 0, nativeMax: 100, isInverted: false });
  }
  return rows;
}

test("B0 dashboard baseline: no score, native observations only", () => {
  const b0 = dashboardBaseline(baselineRows());
  assert.equal(b0.length, 3);
  for (const row of b0) {
    assert.equal(row.baselineId, "B0");
    assert.equal(row.value, null);
    assert.equal(row.scale, "no_score_native_observations");
  }
  assert.deepEqual(b0.map((r) => r.unitId), ["ZAC:2005", "ZAD:2005", "ZAE:2005"]);
});

test("B1 single-indicator baseline: exact V-Dem native values", () => {
  const b1 = singleIndicatorBaseline(baselineRows());
  assert.deepEqual(b1.map((r) => r.value), [0.72, 0.31, 0.55]);
  for (const row of b1) assert.equal(row.scale, "vdem_native_0_1");
});

test("B2 equal-weight baseline: exact common-scale means", () => {
  const b2 = equalWeightBaseline(baselineRows());
  assertClose(b2[0].value, 68.83333333333334, "B2 ZAC");
  assertClose(b2[1].value, 33.666666666666664, "B2 ZAD");
  assertClose(b2[2].value, 54.66666666666667, "B2 ZAE");
});

test("B3 first-factor baseline: exact development-fitted z scores and fitted model", () => {
  const rows = baselineRows();
  const model = fitFirstFactorBaseline(rows);
  // The fitted power-iteration model itself is part of the golden.
  assert.equal(model.iterations, 6);
  assert.equal(model.fitRows, 3);
  assert.deepEqual(model.loadings, [
    0.5023938038865686, 0.4963056449726317, 0.502533305643545, 0.498739861354249,
  ]);
  const b3 = firstFactorBaseline(rows, model);
  assertClose(b3[0].value, 1.8335546220239072, "B3 ZAC");
  assertClose(b3[1].value, -2.1159690327995264, "B3 ZAD");
  assertClose(b3[2].value, 0.2824144107756195, "B3 ZAE");
  for (const row of b3) assert.equal(row.scale, "development_fitted_first_factor_z");
});

// ── K1: current composite tournament candidate ────────────────────────────
function k1Rows(): K1PanelInput[] {
  const rows: K1PanelInput[] = [];
  for (const iso3 of ISO3) {
    const v = VECS[iso3];
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, dimension: "democratic_quality", sourceId: "vdem", indicatorId: "v2x_libdem", value: v.libdem });
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, dimension: "rule_of_law", sourceId: "worldbank_wgi", indicatorId: "rl.est", value: v.rl });
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, dimension: "freedom_rights", sourceId: "freedom_house", indicatorId: "pr_cl_total", value: v.fh });
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, dimension: "corruption_control", sourceId: "transparency_intl", indicatorId: "score", value: v.cpi });
  }
  return rows;
}

test("K1 composite tournament candidate: exact integers, ranks, and no published range", () => {
  const k1 = runK1TournamentCandidate(k1Rows());
  // Sorted output: rank 1..3 with exact composite integers.
  assert.deepEqual(
    k1.map((r) => [r.unitId, r.scoreInteger, r.rank, r.tieCount]),
    [
      ["ZAC:2005", 69, 1, 1],
      ["ZAE:2005", 55, 2, 1],
      ["ZAD:2005", 34, 3, 1],
    ],
  );
  for (const row of k1) {
    assert.equal(row.scoreLower, null);
    assert.equal(row.scoreUpper, null);
    assert.equal(row.completeness, "full");
    assert.equal(row.methodVersion, "k1-current-composite-tournament/v1");
  }
});

// ── K2: measurement-concordance prototype ─────────────────────────────────
function k2Rows(): K2PanelInput[] {
  const rows: K2PanelInput[] = [];
  for (const iso3 of ISO3) {
    const v = VECS[iso3];
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, sourceId: "vdem", indicatorId: "v2x_libdem", value: v.libdem, nativeMin: 0, nativeMax: 1, isInverted: false });
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, sourceId: "worldbank_wgi", indicatorId: "va.est", value: v.va, nativeMin: -2.5, nativeMax: 2.5, isInverted: false });
    rows.push({ jurisdictionId: `j-${iso3}`, iso3, periodYear: YEAR, sourceId: "freedom_house", indicatorId: "pr_cl_total", value: v.fh, nativeMin: 2, nativeMax: 14, isInverted: true });
  }
  return rows;
}

test("K2 concordance prototype: exact percentiles, spread, and midpoint distance", () => {
  const k2 = runK2Concordance(k2Rows());
  assert.equal(k2.length, 3);
  assert.deepEqual(k2.map((r) => r.unitId), [
    "ZAC:2005:democratic_accountability_broad",
    "ZAD:2005:democratic_accountability_broad",
    "ZAE:2005:democratic_accountability_broad",
  ]);
  // ZAC: vdem & fh rank it top (100), va mid (50) -> spread 50, iqr 25.
  assert.deepEqual(k2[0].placements.map((p) => p.percentile), [100, 50, 100]);
  assert.equal(k2[0].spreadRange, 50);
  assert.equal(k2[0].spreadIqr, 25);
  assertClose(k2[0].meanPlacement, 83.33333333333333, "K2 ZAC mean");
  assertClose(k2[0].midpointDistance, 33.33333333333333, "K2 ZAC midpoint");
  // ZAD: unanimous bottom (0).
  assert.deepEqual(k2[1].placements.map((p) => p.percentile), [0, 0, 0]);
  assert.equal(k2[1].spreadRange, 0);
  // ZAE: vdem/fh mid (50), va top (100).
  assert.deepEqual(k2[2].placements.map((p) => p.percentile), [50, 100, 50]);
  assert.equal(k2[2].spreadRange, 50);
  assertClose(k2[2].midpointDistance, 16.66666666666667, "K2 ZAE midpoint");
});

// ── K3: power-transfer ledger prototype (structured output golden) ────────
test("K3 ledger prototype: exact observed-executive output and output hash", () => {
  const k3rows: K3TermInput[] = [
    {
      iso3: "ZAC", jurisdictionId: "j-ZAC", executiveStructure: "presidential", termId: "term-1",
      officeType: "head_of_state", officeName: "President", personId: "p-1", personName: "A. Example",
      partyName: "Example Party", startDate: "2020-01-01",
      citations: [{ sourceId: "wikidata", sourceUrl: "https://www.wikidata.org/wiki/Q1", sourceHash: null, sourceLicense: "CC0", retrievedAt: "2026-07-01T00:00:00Z", predicate: "position_held" }],
    },
  ];
  const k3 = runK3LedgerPrototype(k3rows);
  assert.equal(k3.length, 1);
  const row = k3[0];
  assert.equal(row.executiveIdentityStatus, "observed");
  assert.equal(row.executive?.personId, "p-1");
  // tenureDays = calendar days from 2020-01-01 to the frozen as-of 2026-07-11.
  assert.equal(row.executive?.tenureDays, 2383);
  assert.equal(row.latestElectoralTransfer.state, "not_computable");
  assert.equal(row.termLimitStatus.state, "unknown");
  assert.equal(k3LedgerHash(k3), "7092853ab7ea3c683be9c77eae8b772c6299695ac1987cb2a957316653032503");
});

// ── K4: constitution↔practice pairing prototype (structured output golden) ─
test("K4 pairing prototype: exact coding states, retained practice values, and hash", () => {
  const excerpts: K4ExcerptInput[] = [
    { jurisdictionId: "j-ZAC", iso3: "ZAC", constitutionId: "c-1", constitutionYear: 1990, constituteProjectId: "CP1", topicKey: "express", topicLabel: "Freedom of expression", sectionId: "s1", articleLabel: "Art. 19", excerptHtml: "<p>Freedom of expression is guaranteed.</p>" },
  ];
  const practice: K4PracticeInput[] = [
    { jurisdictionId: "j-ZAC", iso3: "ZAC", periodYear: 2024, indicatorId: "v2x_freexp_altinf", value: 0.81, uncertaintyLower: 0.75, uncertaintyUpper: 0.87, missingReason: null, sourceVintage: "V-Dem Country-Year Core v15", artifactHash: "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b" },
    { jurisdictionId: "j-ZAC", iso3: "ZAC", periodYear: 2024, indicatorId: "v2juhcind", value: 1.2, uncertaintyLower: 0.6, uncertaintyUpper: 1.8, missingReason: null, sourceVintage: "V-Dem Country-Year Core v15", artifactHash: "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b" },
    { jurisdictionId: "j-ZAC", iso3: "ZAC", periodYear: 2024, indicatorId: "v2xel_frefair", value: 0.66, uncertaintyLower: 0.6, uncertaintyUpper: 0.72, missingReason: null, sourceVintage: "V-Dem Country-Year Core v15", artifactHash: "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b" },
  ];
  const k4 = runK4PairingPrototype(excerpts, practice);
  // Three constructs, output sorted by unitId (clean_elections < expression < high_court).
  assert.deepEqual(k4.map((r) => r.constructId), [
    "clean_elections_in_practice",
    "expression_in_practice",
    "high_court_independence_in_practice",
  ]);
  assert.deepEqual(k4.map((r) => r.constitutionalEvidence.codingState), [
    "no_tagged_excerpt",
    "candidate_topic_match_pending_blinded_human_coding",
    "no_tagged_excerpt",
  ]);
  // Only the expression construct matched the "express" excerpt.
  assert.equal(k4[1].constitutionalEvidence.excerpts.length, 1);
  assert.equal(k4[1].practiceEvidence.value, 0.81);
  for (const row of k4) assert.equal(row.interpretationState, "not_scored_pending_blinded_coding_and_scholar_review");
  assert.equal(k4PairingHash(k4), "87e2a8b33eb9f94176bd436b3e87c244e3294e6271a2b7b5a5b916a68f47127e");
});

// ── K5: institutional-constraint-map candidate extraction (hash golden) ───
test("K5 relation candidate extraction: exact relation candidate and hash", () => {
  const excerpts: K5ExcerptInput[] = [
    { jurisdictionId: "j-ZAC", iso3: "ZAC", constitutionId: "c-1", constitutionYear: 1990, constituteProjectId: "CP1", topicKey: "cabsel", topicLabel: "Cabinet selection", sectionId: "s2", articleLabel: "Art. 70", excerptHtml: "<p>The head of state appoints the cabinet.</p>" },
  ];
  const k5 = runK5RelationCandidateExtraction(excerpts);
  assert.equal(k5.length, 1);
  const row = k5[0];
  assert.equal(row.relationType, "appoints_or_selects");
  assert.equal(row.sourceTypeCandidate, "unspecified_institution");
  assert.equal(row.targetTypeCandidate, "cabinet");
  assert.equal(row.endpointState, "pending_blinded_coding");
  assert.equal(row.codingState, "candidate_topic_match_pending_double_blind_relation_coding");
  assert.equal(k5RelationHash(k5), "969789af3e3a994f5f69dccc5275e769433a9a86ed887ebcba65c7f6d44837c9");
});
