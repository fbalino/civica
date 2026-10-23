import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildGovernanceEvidenceReviewBundle,
  GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR,
  reviewBundleSemanticSha256,
} from "../src/lib/ci/governance-evidence-review-package";
import {
  GOVERNANCE_EVIDENCE_REVIEW_PACKET,
  REVIEW_PACKET_REQUIRED_SECTIONS,
  governanceEvidenceReviewPacketErrors,
} from "../src/lib/ci/governance-evidence-review-packet";

assert.deepEqual(governanceEvidenceReviewPacketErrors(), []);
for (const section of REVIEW_PACKET_REQUIRED_SECTIONS) {
  assert.ok(section in GOVERNANCE_EVIDENCE_REVIEW_PACKET, `missing section ${section}`);
}

const expected = buildGovernanceEvidenceReviewBundle();
for (const document of expected.docs) {
  assert.equal(readFileSync(document.path, "utf8"), document.content, `${document.path} drift`);
}
assert.equal(
  readFileSync(`${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/artifact-inventory.v1.csv`, "utf8"),
  expected.inventoryCsv,
  "artifact inventory drift",
);
assert.equal(
  readFileSync(`${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/checksums.sha256`, "utf8"),
  expected.checksums,
  "checksums drift",
);

const manifest = JSON.parse(
  readFileSync(`${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/manifest.v1.json`, "utf8"),
) as Record<string, unknown> & {
  bundleSemanticSha256: string;
  environment: Record<string, unknown>;
  tournamentWinnerSelected: boolean;
  inventory: Array<{ role: string; path: string }>;
  reviewQuestions: string[];
};
// Node, npm and platform record the machine that generated the packet and
// legitimately differ on CI; the lockfile hash is deterministic and must match.
const { environment: recordedEnvironment, bundleSemanticSha256: _recordedHash, ...recordedRest } = manifest;
const { environment: expectedEnvironment, bundleSemanticSha256: _expectedHash, ...expectedRest } = expected.manifest;
assert.deepEqual(recordedRest, expectedRest, "manifest drift");
assert.equal(recordedEnvironment.packageLockSha256, expectedEnvironment.packageLockSha256, "environment.packageLockSha256 does not match package-lock.json");
for (const key of ["node", "npm", "platform", "platformRelease", "arch"]) {
  assert.ok(typeof recordedEnvironment[key] === "string" && recordedEnvironment[key], `environment.${key} is not recorded`);
}
assert.equal(manifest.bundleSemanticSha256, reviewBundleSemanticSha256(manifest));
assert.equal(manifest.tournamentWinnerSelected, false, "a tournament winner was silently asserted");
assert.ok(manifest.reviewQuestions.length >= 8, "review questions are incomplete");
for (const role of [
  "packet-document",
  "selected-product-input",
  "selected-product-code",
  "tournament-package",
  "tournament-artifact",
  "disposition",
  "governance",
  "rights",
  "environment",
]) {
  assert.ok(manifest.inventory.some((row) => row.role === role), `missing inventory role ${role}`);
}
assert.ok(
  manifest.inventory.some((row) => row.path.endsWith("index-misuse-audit-v1/result.v1.json")),
  "GOV-014 misuse analysis is not bound",
);
assert.ok(
  manifest.inventory.some((row) => row.path.endsWith("command-map.v1.json")),
  "frozen reproduction command map is not bound",
);
assert.ok(
  !manifest.inventory.some((row) => row.path === "package.json"),
  "mutable root package.json must not invalidate a frozen packet",
);

console.log(
  `PASS — ${GOVERNANCE_EVIDENCE_REVIEW_PACKET.releaseId}: ${manifest.inventory.length} artifacts and ${manifest.reviewQuestions.length} review questions reproduce exactly.`,
);
