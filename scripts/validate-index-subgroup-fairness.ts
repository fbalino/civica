import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { buildIndexSubgroupFairness } from "./generate-index-subgroup-fairness";

const RELEASE_ID = "index-subgroup-fairness-v2";
const RELEASE_DIRECTORY = `data/releases/${RELEASE_ID}`;

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function main() {
  const classificationPath =
    "data/releases/index-subgroup-classifications-2026-07-11-v1/classifications.v1.json";
  const classificationBytes = readFileSync(classificationPath);
  const classifications = JSON.parse(classificationBytes.toString("utf8"));
  assert.equal(classifications.releaseId, "index-subgroup-classifications-2026-07-11-v1");
  assert.equal(classifications.countries.length, 217);
  assert.match(classifications.rawSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    new Set(classifications.countries.map((row: { iso3: string }) => row.iso3)).size,
    classifications.countries.length,
  );

  const manifest = JSON.parse(readFileSync(`${RELEASE_DIRECTORY}/manifest.v1.json`, "utf8"));
  assert.equal(manifest.releaseId, RELEASE_ID);
  assert.equal(manifest.protectedInput.schemaVersion, "civica-index-subgroup-fairness-inputs/v1");
  assert.match(manifest.protectedInput.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.replay.networkAccess, "disabled");
  assert.equal(manifest.replay.databaseAccess, "disabled");
  assert.equal(manifest.protectedInput.publicValuesIncluded, false);

  const stored = JSON.parse(readFileSync(`${RELEASE_DIRECTORY}/result.v1.json`, "utf8"));
  const rebuilt = buildIndexSubgroupFairness();
  assert.deepEqual(rebuilt, stored);
  assert.equal(stored.releaseId, RELEASE_ID);
  assert.equal(stored.protectedInputSha256, manifest.protectedInput.contentSha256);
  const required = [
    "region",
    "income",
    "regime",
    "media_environment",
    "small_state",
    "disputed_status",
    "data_availability",
    "source_count",
  ];
  assert.deepEqual(Object.keys(stored.subgroupFamilies), required);
  assert.equal(stored.scope.eligibleSovereignStates, 194);
  assert.equal(stored.exclusions.imputation, "none");
  assert.equal(stored.exclusions.outOfScopeTerritoriesNotAdded, true);
  assert.equal(stored.uncertainty.freedomHouseBoundStatus, "absent");
  assert.equal(typeof stored.evidenceScarcity.failsMechanicalScarcityGate, "boolean");
  assert.ok(
    Object.values(
      stored.subgroupFamilies as Record<string, { eligible: number; published: number }[]>,
    )
      .flat()
      .every((row) => row.eligible >= row.published),
  );
  console.log(
    `PASS — subgroup v2 ${stored.resultSha256}; protected input ${stored.protectedInputSha256}; classification artifact ${sha256(classificationPath)}.`,
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
