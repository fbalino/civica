import assert from "node:assert/strict";
import test from "node:test";
import { RELEASE_AUTHORITY, releaseAuthorityErrors, simulateReleaseIncident } from "./release-authority";

test("release authority names the approver and closes version, DOI, notice, and appeal rules", () => {
  assert.deepEqual(releaseAuthorityErrors(), []);
  assert.equal(RELEASE_AUTHORITY.approver.name, "Fernando Baliño");
});

test("material-error tabletop produces containment, changelog, version, DOI relation, notices, and appeal", () => {
  const result = simulateReleaseIncident({ incidentId: "tabletop-material-error", detectedAt: "2026-07-11T12:00:00.000Z", kind: "material_error", artifactId: "atlas-release", fromVersion: "v1.0.0", fromDoi: "10.0000/civica.v1", summary: "A country identity was assigned to the wrong jurisdiction.", changedFrozenBytes: true });
  assert.equal(result.emergencyAction.reviewDueAt, "2026-07-14T12:00:00.000Z");
  assert.equal(result.releaseNote.proposedVersion, "v1.1.0");
  assert.deepEqual(result.doiAction.relation, { relationType: "IsNewVersionOf", relatedIdentifier: "10.0000/civica.v1" });
  assert.equal(result.notices.length, 5);
  assert.equal(result.appeal.routes.length, 2);
});

test("methodology failure retracts pending a major replacement", () => {
  const result = simulateReleaseIncident({ incidentId: "tabletop-method", detectedAt: "2026-07-11T12:00:00.000Z", kind: "methodology_failure", artifactId: "pulse", fromVersion: "v1.4.0-beta", fromDoi: null, summary: "The construct cannot support the published interpretation.", changedFrozenBytes: true });
  assert.equal(result.changelog.disposition, "retraction_pending_replacement");
  assert.equal(result.releaseNote.proposedVersion, "v2.0.0");
  assert.equal(result.doiAction.status, "no_registered_doi");
});
