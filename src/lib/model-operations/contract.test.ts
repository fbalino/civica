import assert from "node:assert/strict";
import test from "node:test";

import {
  APPROVED_PULSE_PROVIDER_MODELS,
  MODEL_OPERATION_CONTROLS,
  assertModelOperationRequest,
  isApprovedPulseProviderModel,
  modelOperationVersion,
} from "./contract";

test("every paid model operation has a bounded, alertable control", () => {
  for (const [operation, control] of Object.entries(MODEL_OPERATION_CONTROLS)) {
    assert.ok(control.credentialEnv.length > 0, `${operation} has no credential scope`);
    assert.ok(control.maxInputChars > 0, `${operation} has no input ceiling`);
    assert.ok(control.maxOutputTokens > 0, `${operation} has no output ceiling`);
    assert.ok(control.maxCallsPerExecution > 0, `${operation} has no call ceiling`);
    assert.ok(control.maxAttemptsPerCall > 0, `${operation} has no retry ceiling`);
    assert.ok(control.alertAtUsd > 0 && control.alertAtUsd < control.monthlySpendCapUsd, `${operation} has no usable alert threshold`);
    assert.match(control.unavailableBehavior, /never|skip|show|stop|return|route|mark|store/);
  }
});

test("unapproved Pulse models cannot enter the paid provider path", () => {
  assert.equal(isApprovedPulseProviderModel("deepseek", "deepseek-v4-flash"), true);
  assert.equal(isApprovedPulseProviderModel("openai", "gpt-4.1-mini"), true);
  assert.equal(isApprovedPulseProviderModel("anthropic", "claude-opus-4-6"), false);
  assert.equal(isApprovedPulseProviderModel("glm", "anything-else"), false);
  assert.ok(APPROVED_PULSE_PROVIDER_MODELS.anthropic.length > 0);
});

test("model request ceilings fail before a paid call", () => {
  const control = MODEL_OPERATION_CONTROLS["ask-civica"];
  assert.doesNotThrow(() =>
    assertModelOperationRequest("ask-civica", control.maxInputChars, control.maxOutputTokens),
  );
  assert.throws(
    () => assertModelOperationRequest("ask-civica", control.maxInputChars + 1, 1),
    /approved ceiling/,
  );
  assert.throws(
    () => assertModelOperationRequest("ask-civica", 1, control.maxOutputTokens + 1),
    /approved ceiling/,
  );
});

test("provider or model substitutions derive a distinct public version", () => {
  const original = modelOperationVersion("pulse-classify", "deepseek", "deepseek-v4-flash");
  assert.equal(original, modelOperationVersion("pulse-classify", "deepseek", "deepseek-v4-flash"));
  assert.notEqual(original, modelOperationVersion("pulse-classify", "glm", "glm-4.7"));
  assert.match(original, /^model-operation\/sha256:[a-f0-9]{64}$/);
});
