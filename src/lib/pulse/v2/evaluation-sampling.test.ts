import assert from "node:assert/strict";
import test from "node:test";
import { allocatePrimaryStrata, inflateSampleSize, pulseEvaluationSamplingErrors, simpleRandomProportionSampleSize, stableSample } from "./evaluation-sampling";

test("power rationale closes at five percentage points before design inflation", () => {
  const simple = simpleRandomProportionSampleSize({ z: 1.96, proportion: 0.5, halfWidth: 0.05 });
  assert.equal(simple, 385);
  assert.deepEqual(inflateSampleSize({ simpleRandom: simple, designEffect: 1.25, unusableFraction: 0.1 }), { validRequired: 482, initialDraw: 536 });
});

test("bounded allocation honors rare-stratum minima and the exact target", () => {
  const allocation = allocatePrimaryStrata({ common: 1000, rare: 8, medium: 100 }, 100, 10);
  assert.equal(allocation.rare, 8);
  assert.ok(allocation.medium >= 10);
  assert.equal(Object.values(allocation).reduce((sum, value) => sum + value, 0), 100);
});

test("stable sampling is order invariant and quota exact", () => {
  const rows = [
    { id: "a", stratum: "x" }, { id: "b", stratum: "x" },
    { id: "c", stratum: "y" }, { id: "d", stratum: "y" },
  ];
  const first = stableSample({ rows, quotas: { x: 1, y: 1 }, seed: "seed", frameId: "frame" });
  const second = stableSample({ rows: [...rows].reverse(), quotas: { y: 1, x: 1 }, seed: "seed", frameId: "frame" });
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
});

test("the frozen protocol is complete and blind to labels", () => {
  assert.deepEqual(pulseEvaluationSamplingErrors(), []);
});
