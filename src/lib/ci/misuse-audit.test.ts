import test from "node:test";
import assert from "node:assert/strict";
import { INDEX_MISUSE_AUDIT, INDEX_MISUSE_AUDIT_SHA256, misuseAuditErrors } from "./misuse-audit";

test("misuse audit covers every required threat and separates presentation failure from retirement", () => {
  assert.deepEqual(misuseAuditErrors(), []);
  assert.match(INDEX_MISUSE_AUDIT_SHA256, /^[a-f0-9]{64}$/);
  assert.equal(INDEX_MISUSE_AUDIT.disposition.currentPresentationPassesMisuseGate, false);
  assert.equal(INDEX_MISUSE_AUDIT.disposition.underlyingCandidateAutomaticallyRetired, false);
});
