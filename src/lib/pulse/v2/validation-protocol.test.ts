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
    "data/research/pulse-validation-protocol-v1.json",
    "utf8",
  );
  assert.equal(checked, renderPulseValidationProtocol());
  assert.match(pulseValidationProtocolHash(), /^[a-f0-9]{64}$/);
});
