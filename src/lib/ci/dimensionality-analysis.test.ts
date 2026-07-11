import assert from "node:assert/strict";
import test from "node:test";
import { pcaCorrelation, symmetricEigen } from "./dimensionality-analysis";

test("symmetric eigendecomposition recovers ordered diagonal eigenvalues", () => { const result = symmetricEigen([[4, 0, 0, 0], [0, 3, 0, 0], [0, 0, 2, 0], [0, 0, 0, 1]]); assert.deepEqual(result.map((row) => row.value), [4, 3, 2, 1]); });
test("correlation PCA explains a dominant shared factor", () => { const matrix = Array.from({ length: 20 }, (_, i) => [i, i * 2 + (i % 2) / 10, i * 3 - (i % 3) / 10, i * 4 + (i % 4) / 10]); const result = pcaCorrelation(matrix); assert.ok(result.explainedVariance[0] > 0.99); assert.ok(result.pc1Loadings.every((value) => value > 0)); assert.ok(Math.abs(result.explainedVariance.reduce((a, b) => a + b, 0) - 1) < 1e-10); });
