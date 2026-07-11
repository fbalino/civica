import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildIndexSubgroupFairness } from "./generate-index-subgroup-fairness";

async function main() {
  const classificationBytes = readFileSync("data/releases/index-subgroup-classifications-2026-07-11-v1/classifications.v1.json");
  const classifications = JSON.parse(classificationBytes.toString("utf8"));
  assert.equal(classifications.releaseId, "index-subgroup-classifications-2026-07-11-v1");
  assert.equal(classifications.countries.length, 217);
  assert.match(classifications.rawSha256, /^[a-f0-9]{64}$/);
  assert.equal(new Set(classifications.countries.map((row: { iso3: string }) => row.iso3)).size, classifications.countries.length);
  const stored = JSON.parse(readFileSync("data/releases/index-subgroup-fairness-v1/result.v1.json", "utf8"));
  const rebuilt = await buildIndexSubgroupFairness();
  assert.deepEqual(rebuilt, stored);
  const required = ["region", "income", "regime", "media_environment", "small_state", "disputed_status", "data_availability", "source_count"];
  assert.deepEqual(Object.keys(stored.subgroupFamilies), required);
  assert.equal(stored.scope.eligibleSovereignStates, 194);
  assert.equal(stored.exclusions.imputation, "none");
  assert.equal(stored.exclusions.outOfScopeTerritoriesNotAdded, true);
  assert.equal(stored.uncertainty.freedomHouseBoundStatus, "absent");
  assert.equal(typeof stored.evidenceScarcity.failsMechanicalScarcityGate, "boolean");
  assert.ok(Object.values(stored.subgroupFamilies).flat().every((row: any) => row.eligible >= row.published));
  console.log(`PASS — subgroup result ${stored.resultSha256}; classification artifact ${createHash("sha256").update(classificationBytes).digest("hex")}.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
