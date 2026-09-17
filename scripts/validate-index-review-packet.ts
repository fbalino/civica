import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR } from "../src/lib/ci/governance-evidence-review-package";
import { GOVERNANCE_EVIDENCE_REVIEW_PACKET } from "../src/lib/ci/governance-evidence-review-packet";

const manifestPath = `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/manifest.v1.json`;
const packet = JSON.parse(readFileSync(manifestPath, "utf8"));

assert.equal(packet.releaseId, GOVERNANCE_EVIDENCE_REVIEW_PACKET.releaseId);
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

const inventory = readFileSync(`${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/artifact-inventory.v1.csv`, "utf8").trim().split("\n");
assert.equal(inventory.length - 1, packet.inventory.length);
assert.ok(
  packet.inventory.some(
    ({ artifactId, path }: { artifactId: string; path: string }) =>
      artifactId === "project-disclosure" &&
      path === "data/research/project-disclosure-v1.json",
  ),
  "canonical project disclosure is not bound",
);

console.log("PASS — GOV-014 Index packet closes preregistration, candidates/baselines, frozen panel, code/environment, analyses, sensitivity/uncertainty/subgroups, thresholds, failures, disposition, misuse, and 11 bounded questions.");
