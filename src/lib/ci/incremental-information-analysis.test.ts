import assert from "node:assert/strict";
import test from "node:test";
import {
  fitOls,
  fitScalar,
  predictOls,
  predictionMetrics,
} from "./incremental-information-analysis";
test("scalar and multivariate fits recover linear targets", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    target: 2 + 3 * i,
    value: i,
  }));
  assert.deepEqual(fitScalar(rows), { intercept: 2, slope: 3 });
  const model = fitOls(
    Array.from({ length: 10 }, (_, i) => ({
      target: 1 + 2 * i + 4 * (i % 3),
      features: [i, i % 3],
    })),
  );
  assert.ok(Math.abs(predictOls(model, [7, 1]) - 19) < 1e-9);
});
test("prediction metrics are exact for perfect predictions", () => {
  const m = predictionMetrics([
    { iso3: "A", year: 1, actual: 1, predicted: 1 },
    { iso3: "B", year: 1, actual: 2, predicted: 2 },
  ]);
  assert.equal(m.r2, 1);
  assert.equal(m.rmse, 0);
});
