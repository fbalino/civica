import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import manifest from "../data/releases/ci-beta-r4-2024-Q4/reproduction-manifest.v1.json";
import {
  CURRENT_CI_METHODOLOGY_VERSION,
  CURRENT_CI_QUARTER,
  CURRENT_CI_RELEASE_ID,
  CURRENT_CI_VINTAGE_LABEL,
} from "../src/lib/ci/current-release";

const requiredConsumers = [
  "src/app/api/v1/index/[country_slug]/route.ts",
  "src/app/api/v1/index/rankings/route.ts",
  "src/lib/atlas/load-atlas-data.ts",
  "src/lib/ci/calculate-v2.ts",
  "src/lib/ci/ingest.ts",
  "src/lib/content/site-state.ts",
  "src/lib/content/site-stats.ts",
  "src/lib/db/queries-scores.ts",
  "src/lib/db/queries.ts",
  "src/lib/pulse/v2/decouple.ts",
];

assert.equal(manifest.releaseId, CURRENT_CI_RELEASE_ID);
assert.equal(manifest.quarter, CURRENT_CI_QUARTER);
assert.equal(manifest.methodologyVersion, CURRENT_CI_METHODOLOGY_VERSION);
assert.equal(manifest.vintageLabel, CURRENT_CI_VINTAGE_LABEL);
assert.equal(manifest.dimensions.rows, 745);
assert.equal(manifest.composites.rows, 190);
assert.match(manifest.dimensions.sha256, /^[a-f0-9]{64}$/);
assert.match(manifest.composites.sha256, /^[a-f0-9]{64}$/);

for (const path of requiredConsumers) {
  const source = readFileSync(path, "utf8");
  assert.match(source, /CURRENT_CI_METHODOLOGY_VERSION/, `${path} must consume the pinned current release`);
}

const calculator = readFileSync("src/lib/ci/calculate-v2.ts", "utf8");
assert.match(calculator, /eq\(ciDimensionScores\.methodologyVersion, methodologyVersion\)/);
assert.match(calculator, /orderedDims = \[\.\.\.dims\.values\(\)\]\.sort/);
assert.match(calculator, /const score = compositeInputs\.reduce/);
assert.doesNotMatch(calculator, /simulateComposite\(/);

console.log(`PASS — ${CURRENT_CI_RELEASE_ID} is pinned across ${requiredConsumers.length} production consumers; checked manifest covers ${manifest.dimensions.rows} dimensions and ${manifest.composites.rows} composites.`);
