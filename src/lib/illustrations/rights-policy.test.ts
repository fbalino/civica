import assert from "node:assert/strict";
import test from "node:test";

import {
  EDITORIAL_ILLUSTRATION_REQUIRED_RECORD_FIELDS,
  EDITORIAL_ILLUSTRATION_RIGHTS_POLICY,
  EDITORIAL_ILLUSTRATION_SCREENING_IDS,
  editorialIllustrationRightsPolicyErrors,
} from "./rights-policy";

test("the illustration rights policy is closed and complete", () => {
  assert.deepEqual(editorialIllustrationRightsPolicyErrors(), []);
  assert.equal(
    EDITORIAL_ILLUSTRATION_RIGHTS_POLICY.screenings.length,
    EDITORIAL_ILLUSTRATION_SCREENING_IDS.length,
  );
  assert.ok(EDITORIAL_ILLUSTRATION_REQUIRED_RECORD_FIELDS.length >= 10);
});

test("rights posture never converts access or AI assistance into ownership", () => {
  assert.match(
    EDITORIAL_ILLUSTRATION_RIGHTS_POLICY.ownership,
    /does not claim ownership/i,
  );
  assert.match(
    EDITORIAL_ILLUSTRATION_RIGHTS_POLICY.thirdPartyReuse,
    /no separate .* reuse license/i,
  );
  assert.match(
    EDITORIAL_ILLUSTRATION_RIGHTS_POLICY.historicalPosture,
    /never reconstructed/i,
  );
});

test("future assets fail closed on records, screening, and retention", () => {
  assert.match(
    EDITORIAL_ILLUSTRATION_RIGHTS_POLICY.futureReleaseRule,
    /cannot enter a release/i,
  );
  assert.match(
    EDITORIAL_ILLUSTRATION_RIGHTS_POLICY.retention,
    /superseding record or tombstone/i,
  );
  for (const screening of EDITORIAL_ILLUSTRATION_RIGHTS_POLICY.screenings) {
    assert.ok(screening.question.endsWith("?"));
    assert.ok(screening.failClosedAction.length > 40);
  }
});
