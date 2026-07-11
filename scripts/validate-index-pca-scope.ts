import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import historical from "../src/lib/ci/pca-analysis.generated.json";
import temporal from "../data/releases/index-dimensionality-analysis-v1/result.v1.json";

assert.equal(historical.panelSize, 46);
assert.equal(historical.panelYear, "2023-Q4");
assert.match(historical.decision, /Historical weight recipe only/);
assert.match(historical.decision, /does not validate a general or longitudinal governance factor/);
assert.match(historical.fifthDimensionTest, /^Not run\./);
assert.match(historical.fifthDimensionTest, /no distinctness, redundancy, factor, or rotation result/);
assert.match(historical.sampleSizeCaveat, /cannot be generalized across time or broader country coverage/);

assert.equal(temporal.releaseId, "index-dimensionality-analysis-v1");
assert.equal(temporal.methodVersion, "civica-index-dimensionality/v1");
assert.equal(temporal.panelReleaseId, "ci-research-panel-2000-2024-v3");
assert.equal(temporal.samples.profiles, 2270);
assert.equal(temporal.crossSections.length, 13);
assert.ok(temporal.pooled.explainedVariance[0] > 0.85);
assert.ok(temporal.betweenCountry.explainedVariance[0] > 0.85);
assert.ok(temporal.withinCountry.explainedVariance[0] < 0.55);
assert.ok(temporal.firstDifferences.explainedVariance[0] < 0.4);

const surfaces = [
  "content/data-approach.md",
  "content/methodology-civica-index.md",
  "content/methodology-pca-appendix.md",
  "src/app/(reader)/civica-index/methodology/page.tsx",
  "src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx",
  "src/lib/ci/dimensions-v2.ts",
  "src/lib/ci/pca-analysis.generated.json",
];
const publicText = surfaces.map((path) => `${path}\n${readFileSync(path, "utf8")}`).join("\n");
for (const forbidden of [
  /confirms? (?:a )?single dominant latent factor/i,
  /single [“\"]?governance quality[”\"]? (?:latent )?factor/i,
  /only component (?:the )?data supports/i,
  /below the noise floor/i,
  /structural decision[^.]*unlikely to change/i,
  /fifth dimension[^.]*added if and only if/i,
]) {
  assert.doesNotMatch(publicText, forbidden);
}

const appendix = readFileSync("content/methodology-pca-appendix.md", "utf8");
for (const required of [
  "describe these {{state.civicaIndex.pca.panelSize}} observations only",
  "provides no fifth-dimension result",
  "Later temporal evidence",
  "No five-variable rotation",
]) assert.ok(appendix.includes(required), `PCA appendix is missing: ${required}`);

const page = readFileSync("src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx", "utf8");
for (const required of [
  "Historical PCA weight record",
  "cannot establish the factor structure",
  "does not turn their shared",
  "this run does not justify calling them noise",
]) assert.ok(page.includes(required), `PCA page is missing: ${required}`);

console.log("PASS — the n=46 PCA is a bounded historical weight record; temporal level/change evidence is linked, and no public surface claims an unrun fifth-dimension or universal latent-factor result.");
