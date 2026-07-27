import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { API_ROUTES } from "../src/lib/api/contract/registry";
import {
  CI_RELEASE_CONTRACTS,
  ciReleaseContractErrors,
} from "../src/lib/ci/release-selection";

assert.deepEqual(ciReleaseContractErrors(), []);
for (const release of CI_RELEASE_CONTRACTS) {
  const manifest = JSON.parse(
    readFileSync(`data/releases/${release.releaseId}/reproduction-manifest.v1.json`, "utf8"),
  );
  assert.equal(manifest.releaseId, release.releaseId);
  assert.equal(manifest.methodologyVersion, release.methodologyVersion);
  assert.equal(manifest.quarter, release.quarter);
  assert.equal(manifest.vintageLabel, release.vintageLabel);
  for (const rule of release.dimensions) {
    assert.equal(manifest.inputSha256[rule.sourceId], rule.artifactSha256, `${release.releaseId}/${rule.sourceId} artifact drift`);
  }
}

const requiredTokens: Record<string, string[]> = {
  "src/lib/ci/calculate-v2.ts": ["resolveCiRelease", "selectCiReleaseDimensionRows"],
  "src/lib/db/queries.ts": ["loadPublishedCiRelease", "selectCiReleaseDimensionRows", "release.releaseId"],
  "src/lib/db/queries-peer-grouping.ts": ["loadPublishedCiRelease", "cs.release_id = ${release.releaseId}"],
  "src/lib/db/queries-scores.ts": ["await loadPublishedCiRelease(CURRENT_CI_RELEASE_ID)", "CI_RELEASE.releaseId"],
  "src/app/api/v1/index/[country_slug]/route.ts": ["await loadPublishedCiRelease(query.data.release)", "selectCiReleaseDimensionRows", "displayCiReleaseDimensionScore"],
  "src/app/api/v1/index/compare/route.ts": ["await loadPublishedCiRelease(query.data.release)", "displayCiReleaseDimensionScore"],
  "src/app/api/v1/index/rankings/route.ts": ["await loadPublishedCiRelease(query.data.release)", "release.quarter"],
  "src/app/api/v1/index/by-government-type/route.ts": ["await loadPublishedCiRelease(query.data.release)", "release.releaseId"],
  "src/app/api/v1/index/[country_slug]/history/route.ts": ["await loadPublishedCiRelease(query.data.release)", "release.releaseId"],
};
for (const [path, tokens] of Object.entries(requiredTokens)) {
  const source = readFileSync(path, "utf8");
  for (const token of tokens) assert.ok(source.includes(token), `${path} does not consume ${token}`);
}

const directPublicReaders = [
  "src/lib/db/queries.ts",
  "src/lib/db/queries-peer-grouping.ts",
  "src/app/api/v1/index/[country_slug]/route.ts",
  "src/app/api/v1/index/compare/route.ts",
  "src/app/api/v1/index/rankings/route.ts",
  "src/app/api/v1/index/by-government-type/route.ts",
  "src/app/api/v1/index/[country_slug]/history/route.ts",
];
for (const path of directPublicReaders) {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(
    source,
    /\bresolveCiRelease\b/,
    `${path} may not fall back to an unverified in-memory release`,
  );
}

const releaseStore = readFileSync("src/lib/ci/release-store.ts", "utf8");
for (const token of [
  "const release = resolveCiRelease(releaseId)",
  "eq(ciIndexReleases.id, release.releaseId)",
  'eq(ciIndexReleases.status, "published")',
  "ciStoredReleaseHeaderErrors(header, release)",
  "release.releaseId === CURRENT_CI_RELEASE_ID",
  'eq(ciIndexReleasePointers.product, "civica_index")',
  "pointer?.releaseId !== release.releaseId",
  "current publication pointer mismatch",
]) {
  assert.ok(
    releaseStore.includes(token),
    `release-store does not prove ${token}`,
  );
}
assert.doesNotMatch(
  releaseStore,
  /catch\s*\(|\.catch\s*\(|return\s+resolveCiRelease\s*\(/,
  "release-store may not soft-fail to an unverified release contract",
);

const scoreRouteIds = ["index-country", "index-history", "index-by-government-type", "index-compare", "index-rankings"];
for (const id of scoreRouteIds) {
  const route = API_ROUTES.find((row) => row.id === id)!;
  assert.ok(route.params.some((param) => param.in === "query" && param.name === "release"), `${id} omits exact release param`);
  assert.ok(!route.params.some((param) => param.in === "query" && param.name === "methodology"), `${id} still accepts methodology-only selection`);
}

const countryRoute = readFileSync("src/app/api/v1/index/[country_slug]/route.ts", "utf8");
assert.match(countryRoute, /ciDimensionScores\.methodologyVersion/);
assert.doesNotMatch(countryRoute, /searchParams\.get\("methodology"\)/);
const queries = readFileSync("src/lib/db/queries.ts", "utf8");
assert.doesNotMatch(queries, /function getLatestAvailableQuarter/);

console.log(`PASS — ${CI_RELEASE_CONTRACTS.length} closed Index releases pin source, indicator, artifact, method, quarter, calculation, peer, API, and display selection behind the exact published database header and current pointer.`);
