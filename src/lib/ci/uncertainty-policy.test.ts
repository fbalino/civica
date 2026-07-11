import assert from "node:assert/strict";
import test from "node:test";
import { CURRENT_CI_UNCERTAINTY_POLICY } from "./uncertainty-policy";
import { CURRENT_CI_METHODOLOGY_VERSION } from "./current-release";

test("current uncertainty policy removes unsupported composite bands", () => {
  assert.equal(
    CURRENT_CI_UNCERTAINTY_POLICY.methodologyVersion,
    CURRENT_CI_METHODOLOGY_VERSION,
  );
  assert.equal(CURRENT_CI_UNCERTAINTY_POLICY.pointEstimate, "deterministic_weighted_composite");
  assert.equal(CURRENT_CI_UNCERTAINTY_POLICY.displayedRange, "not_published");
  assert.equal(CURRENT_CI_UNCERTAINTY_POLICY.covarianceModel, "not_available");
  assert.equal(CURRENT_CI_UNCERTAINTY_POLICY.usableReleasedUncertaintyRows, 0);
});

test("every current source has an explicit upstream and retention audit", () => {
  assert.equal(CURRENT_CI_UNCERTAINTY_POLICY.sources.length, 4);
  for (const source of CURRENT_CI_UNCERTAINTY_POLICY.sources) {
    assert.equal(source.retainedInCurrentRelease, false);
    assert.match(source.reference, /^https:\/\//);
    assert.notEqual(source.upstreamUncertainty, "");
  }
});
