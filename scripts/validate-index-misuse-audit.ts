import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INDEX_MISUSE_AUDIT, INDEX_MISUSE_AUDIT_SHA256, misuseAuditErrors } from "../src/lib/ci/misuse-audit";

const stored = JSON.parse(readFileSync("data/releases/index-misuse-audit-v1/result.v1.json", "utf8"));
assert.deepEqual(misuseAuditErrors(), []);
assert.deepEqual(stored, { ...INDEX_MISUSE_AUDIT, resultSha256: INDEX_MISUSE_AUDIT_SHA256 });
assert.ok(stored.findings.every((finding: any) => finding.mitigation && finding.trigger));
assert.equal(stored.disposition.currentPresentationPassesMisuseGate, false);
assert.equal(stored.disposition.underlyingCandidateAutomaticallyRetired, false);
console.log(`PASS — adversarial misuse audit ${stored.resultSha256} binds eight risks to mitigations and triggers.`);
