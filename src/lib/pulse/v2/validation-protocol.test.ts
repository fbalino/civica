import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PULSE_REGRESSION_CASE_IDS,
  PULSE_VALIDATION_PROTOCOL,
  pulseValidationProtocolHash,
  renderPulseValidationProtocol,
} from "./validation-protocol";

test("famous historical cases are regression fixtures with no inferential role", () => {
  assert.equal(PULSE_REGRESSION_CASE_IDS.length, 10);
  assert.equal(
    PULSE_VALIDATION_PROTOCOL.lanes.regression.inferentialUse,
    "none",
  );
  assert.match(
    PULSE_VALIDATION_PROTOCOL.lanes.regression.currentLegacyHarness,
    /not_current_production_validation/,
  );
});

test("retrospective validity penalizes spurious dimensions and missed events", () => {
  const roles =
    PULSE_VALIDATION_PROTOCOL.lanes.retrospectiveValidity.frames.flatMap(
      ({ errorRoles }) => [...errorRoles],
    );
  for (const required of [
    "spurious_extra_dimension",
    "missed_event",
    "retrieval_miss",
    "wrong_jurisdiction",
  ]) {
    assert.ok(roles.includes(required as never), required);
  }
  assert.match(
    PULSE_VALIDATION_PROTOCOL.lanes.retrospectiveValidity.failureRetention,
    /Every sampled failure/,
  );
});

test("prospective shadow evaluation freezes the full current pipeline before labels", () => {
  assert.deepEqual(
    PULSE_VALIDATION_PROTOCOL.lanes.prospectiveShadow.requiredPipelineStages,
    ["ingest", "cluster", "classify", "corroborate", "review", "score"],
  );
  assert.match(
    PULSE_VALIDATION_PROTOCOL.labelPolicy.prospectiveLabelEmbargo,
    /No prospective human label/,
  );
  assert.match(
    PULSE_VALIDATION_PROTOCOL.lanes.prospectiveShadow.methodChangeRule,
    /ends the current window/,
  );
  assert.equal(
    PULSE_VALIDATION_PROTOCOL.analysisBoundary.currentEnsembleRequired,
    true,
  );
  assert.equal(
    PULSE_VALIDATION_PROTOCOL.analysisBoundary.fullPipelineRequired,
    true,
  );
});

test("checked protocol is the exact deterministic artifact", () => {
  const checked = readFileSync(
    "data/research/pulse-validation-protocol-v2.json",
    "utf8",
  );
  assert.equal(checked, renderPulseValidationProtocol());
  assert.match(pulseValidationProtocolHash(), /^[a-f0-9]{64}$/);
});

test("the superseded v1 preregistration is preserved unchanged", () => {
  const v1 = JSON.parse(
    readFileSync("data/research/pulse-validation-protocol-v1.json", "utf8"),
  ) as { schemaVersion: string; lockedAt: string; semanticSha256: string };
  assert.equal(v1.schemaVersion, "pulse-validation-protocol/v1");
  assert.equal(v1.lockedAt, "2026-07-12T12:00:00.000Z");
  // Frozen semantic hash recorded at supersession time (2026-08-17); any
  // rewrite of the preserved v1 artifact fails here.
  assert.equal(
    v1.semanticSha256,
    "89bea0ceb83090725e9a65a39e7e96a0f8e5badcae988493cd06873267a329e3",
  );
  assert.equal(
    PULSE_VALIDATION_PROTOCOL.supersedes.version,
    "pulse-validation-protocol/v1",
  );
  assert.equal(PULSE_VALIDATION_PROTOCOL.supersedes.windowStartedUnderPrior, false);
});
