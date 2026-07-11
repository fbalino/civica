import assert from "node:assert/strict";
import test from "node:test";
import {
  clusterInterval,
  directionAccuracy,
  median,
  quantile,
} from "./longitudinal-analysis";
test("longitudinal summaries are deterministic", () => {
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(quantile([0, 10], 0.5), 5);
  const r = [
    { iso3: "A", value: 1 },
    { iso3: "B", value: -1 },
    { iso3: "C", value: 2 },
  ];
  assert.equal(directionAccuracy(r), 2 / 3);
  assert.deepEqual(
    clusterInterval(r, directionAccuracy, "x", 50),
    clusterInterval(r, directionAccuracy, "x", 50),
  );
});
