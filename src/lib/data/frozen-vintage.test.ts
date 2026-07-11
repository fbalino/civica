import assert from "node:assert/strict";
import test from "node:test";
import { assertSupersession, frozenContentHash, indexContentHash, parseAtlasVintageLabel, parseIndexVintageLabel } from "./frozen-vintage";

test("published labels resolve to their stored methodology and period", () => {
  const label = "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1";
  assert.deepEqual(parseAtlasVintageLabel(label), { product: "atlas", label, methodologyVersion: "v0.2-beta", period: "2026-Q1" });
  assert.equal(parseIndexVintageLabel("Civica Index 2024 Q4 (Beta)").methodologyVersion, "beta");
});

test("malformed labels fail closed", () => {
  assert.throws(() => parseAtlasVintageLabel("Atlas latest"), /Invalid frozen Atlas/);
  assert.throws(() => parseIndexVintageLabel("Index latest"), /Invalid frozen Civica Index/);
});

test("a correction requires an existing explicit supersession target", () => {
  assert.doesNotThrow(() => assertSupersession({ label: "v1", priorLabels: [], supersedes: null }));
  assert.throws(() => assertSupersession({ label: "v2", priorLabels: ["v1"] }), /must name/);
  assert.throws(() => assertSupersession({ label: "v2", priorLabels: ["v1"], supersedes: "missing" }), /unknown/);
  assert.doesNotThrow(() => assertSupersession({ label: "v2", priorLabels: ["v1"], supersedes: "v1" }));
});

test("release hashes are deterministic and sensitive to content", () => {
  assert.equal(frozenContentHash({ b: 2, a: 1 }), frozenContentHash({ a: 1, b: 2 }));
  const base = { score: 50, scoreLower: 45, scoreUpper: 55, completenessFlag: "full", rank: 2, totalRanked: 190, isPartial: false, dimensionsAvailable: 4, missingDimensions: [] as string[], methodologyVersion: "beta", derivationVersionKey: "d1" };
  assert.equal(indexContentHash(base), indexContentHash({ ...base }));
  assert.notEqual(indexContentHash(base), indexContentHash({ ...base, score: 51 }));
});
