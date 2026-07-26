import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const manifestPath = "data/releases/governance-evidence-review-packet-2026-07-v3/manifest.v1.json";
const packet = JSON.parse(readFileSync(manifestPath, "utf8"));

assert.equal(packet.releaseId, "governance-evidence-review-packet-2026-07-v3");
assert.equal(packet.status, "ready_for_external_review_not_endorsed");
assert.equal(packet.tournamentWinnerSelected, false);
assert.ok(packet.frozenInputs?.releaseId && packet.frozenInputs?.grid?.cells === 970);
assert.ok(Array.isArray(packet.implementation?.code) && packet.implementation.code.length >= 6);
assert.ok(packet.environment?.packageLockSha256);
assert.ok(packet.validation?.exactSourceFileCells?.passed === 970);
assert.ok(packet.sensitivity?.relatedCompositeAnalysis);
assert.ok(packet.subgroupResults?.coverageOwner);
assert.ok(Array.isArray(packet.knownLimitations) && packet.knownLimitations.length >= 8);
assert.ok(Array.isArray(packet.reviewQuestions) && packet.reviewQuestions.length >= 10);

for (const key of ["package", "preregistration", "decisionTable", "disposition", "misuseAudit", "failedAndPendingLedger"])
  assert.ok(existsSync(packet.tournamentReview[key]), `${key} path is missing`);
for (const path of [packet.sensitivity.relatedCompositeAnalysis, packet.subgroupResults.coverageOwner])
  assert.ok(existsSync(path), `${path} is missing`);

const inventory = readFileSync("data/releases/governance-evidence-review-packet-2026-07-v3/artifact-inventory.v1.csv", "utf8").trim().split("\n");
assert.equal(inventory.length - 1, 50);

console.log("PASS — the current Index review packet closes preregistration, candidates/baselines, frozen panel, code/environment, analyses, sensitivity/uncertainty/subgroups, thresholds, failures, disposition, misuse, and 11 bounded questions.");
