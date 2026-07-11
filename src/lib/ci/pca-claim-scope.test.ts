import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import historical from "./pca-analysis.generated.json";
import temporal from "../../../data/releases/index-dimensionality-analysis-v1/result.v1.json";

test("the Phase 5.3 result is retained as a bounded cross-sectional weight record", () => {
  assert.equal(historical.panelSize, 46);
  assert.equal(historical.panelYear, "2023-Q4");
  assert.match(historical.decision, /Historical weight recipe only/);
  assert.match(historical.decision, /does not validate a general or longitudinal governance factor/);
  assert.match(historical.fifthDimensionTest, /^Not run\./);
});

test("the frozen temporal result separates country levels from annual change", () => {
  assert.equal(temporal.samples.profiles, 2270);
  assert.ok(temporal.pooled.explainedVariance[0] > 0.85);
  assert.ok(temporal.betweenCountry.explainedVariance[0] > 0.85);
  assert.ok(temporal.withinCountry.explainedVariance[0] < 0.55);
  assert.ok(temporal.firstDifferences.explainedVariance[0] < 0.4);
});

test("the public PCA record does not promote sample results or an unrun fifth dimension", () => {
  const text = [
    "content/methodology-pca-appendix.md",
    "src/app/(reader)/civica-index/methodology/page.tsx",
    "src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx",
    "src/lib/ci/dimensions-v2.ts",
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(text, /confirms? (?:a )?single dominant latent factor/i);
  assert.doesNotMatch(text, /below the noise floor/i);
  assert.doesNotMatch(text, /fifth dimension[^.]*added if and only if/i);
  assert.match(text, /provides no fifth-dimension result/);
  assert.match(text, /cannot establish the factor structure/);
});
