import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import manifest from "../data/releases/ci-beta-r5-2024-Q4/reproduction-manifest.v1.json";
import {
  CURRENT_CI_METHODOLOGY_VERSION,
  CURRENT_CI_QUARTER,
  CURRENT_CI_RELEASE_ID,
  CURRENT_CI_VINTAGE_LABEL,
} from "../src/lib/ci/current-release";

const requiredResearchConsumers = [
  "src/app/api/v1/index/[country_slug]/route.ts",
  "src/app/api/v1/index/[country_slug]/history/route.ts",
  "src/app/api/v1/index/by-government-type/route.ts",
  "src/app/api/v1/index/compare/route.ts",
  "src/app/api/v1/index/rankings/route.ts",
  "src/lib/ci/calculate-v2.ts",
  "src/lib/ci/ingest.ts",
  "src/lib/content/site-state.ts",
  "src/lib/content/site-stats.ts",
  "src/lib/db/queries-scores.ts",
  "src/lib/db/queries.ts",
  "src/lib/pulse/v2/decouple.ts",
];

const releaseContractConsumers = new Map([
  ["src/app/api/v1/index/[country_slug]/route.ts", "v1-index-country-query/v1"],
  ["src/app/api/v1/index/[country_slug]/history/route.ts", "v1-index-history-query/v1"],
  ["src/app/api/v1/index/by-government-type/route.ts", "v1-index-group-query/v1"],
  ["src/app/api/v1/index/compare/route.ts", "v1-index-compare-query/v1"],
  ["src/app/api/v1/index/rankings/route.ts", "v1-index-rankings-query/v1"],
]);

assert.equal(manifest.releaseId, CURRENT_CI_RELEASE_ID);
assert.equal(manifest.quarter, CURRENT_CI_QUARTER);
assert.equal(manifest.methodologyVersion, CURRENT_CI_METHODOLOGY_VERSION);
assert.equal(manifest.vintageLabel, CURRENT_CI_VINTAGE_LABEL);
assert.equal(manifest.dimensions.rows, 745);
assert.equal(manifest.composites.rows, 190);
assert.match(manifest.dimensions.sha256, /^[a-f0-9]{64}$/);
assert.match(manifest.composites.sha256, /^[a-f0-9]{64}$/);

for (const path of requiredResearchConsumers) {
  const source = readFileSync(path, "utf8");
  const queryContract = releaseContractConsumers.get(path);
  if (queryContract) {
    assert.match(
      source,
      /await loadPublishedCiRelease\(query\.data\.release\)/,
      `${path} must validate the exact published header and pointer before reading`,
    );
    assert.doesNotMatch(
      source,
      /\bresolveCiRelease\b/,
      `${path} may not fall back to the in-memory release registry`,
    );
    assert.ok(
      source.includes(`parseQueryContract(request, "${queryContract}"`),
      `${path} must use its closed release query contract`,
    );
    continue;
  }
  assert.match(
    source,
    /CURRENT_CI_(?:METHODOLOGY_VERSION|RELEASE_ID)/,
    `${path} must consume the pinned current release or its exact methodology coordinate`,
  );
}

const releaseSelection = readFileSync(
  "src/lib/ci/release-selection.ts",
  "utf8",
);
const releaseStore = readFileSync("src/lib/ci/release-store.ts", "utf8");
const requestContracts = readFileSync(
  "src/lib/api/request-contract.ts",
  "utf8",
);
assert.match(
  releaseSelection,
  /resolveCiRelease\(releaseId: string = CURRENT_CI_RELEASE_ID\)/,
);
assert.match(requestContracts, /CI_RELEASE_CONTRACTS\.at\(-1\)!/);
assert.match(requestContracts, /value \?\? CURRENT_CI_RELEASE\.releaseId/);
assert.match(
  releaseStore,
  /eq\(ciIndexReleases\.status, "published"\)/,
);
assert.match(
  releaseStore,
  /ciStoredReleaseHeaderErrors\(header, release\)/,
);
assert.match(
  releaseStore,
  /eq\(ciIndexReleasePointers\.product, "civica_index"\)/,
);
assert.match(
  releaseStore,
  /pointer\?\.releaseId !== release\.releaseId/,
);
assert.doesNotMatch(
  releaseStore,
  /catch\s*\(|\.catch\s*\(|return\s+resolveCiRelease\s*\(/,
  "published release loading must fail closed",
);

const atlasLoader = readFileSync("src/lib/atlas/load-atlas-data.ts", "utf8");
assert.doesNotMatch(
  atlasLoader,
  /CURRENT_CI_METHODOLOGY_VERSION|ciCompositeScores|ciScore/,
  "Atlas must remain independent of the preserved composite under the adopted disposition",
);

const calculator = readFileSync("src/lib/ci/calculate-v2.ts", "utf8");
assert.match(
  calculator,
  /eq\(ciDimensionScores\.methodologyVersion, methodologyVersion\)/,
);
assert.match(calculator, /orderedDims = \[\.\.\.dims\.values\(\)\]\.sort/);
assert.match(calculator, /const score = compositeInputs\.reduce/);
assert.match(calculator, /competitionRankPublishedScores/);
assert.doesNotMatch(calculator, /simulateComposite\(/);

console.log(
  `PASS — ${CURRENT_CI_RELEASE_ID} is pinned across ${requiredResearchConsumers.length} research consumers; the public Atlas remains composite-free; checked manifest covers ${manifest.dimensions.rows} dimensions and ${manifest.composites.rows} composites.`,
);
