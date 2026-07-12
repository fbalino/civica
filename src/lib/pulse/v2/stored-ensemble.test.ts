import assert from "node:assert/strict";
import test from "node:test";
import type { ClassifierRun, ClassifierProvider } from "./types";
import {
  deriveStoredEnsemble,
  storedRunsPermitAutomaticPublication,
} from "./stored-ensemble";

const run = (
  provider: ClassifierProvider,
  category = "judicial_purge",
  overrides: Partial<ClassifierRun> = {},
): ClassifierRun => ({
  run: provider === "deepseek" ? 1 : provider === "glm" ? 2 : 3,
  temp: 0,
  provider,
  model: `${provider}-fixture`,
  role: "classify",
  promptVersion: "pulse-classifier-prompt/sha256:" + "a".repeat(64),
  methodVersion: "pulse-v2.13-beta",
  configurationHash: "pulse-classification-config/sha256:" + "b".repeat(64),
  configuredEngineCount: 3,
  category,
  dimension: "rule_of_law",
  severityTier: "moderate_neg",
  severityValue: -4,
  selfConfidence: 0.8,
  rationale: "fixture",
  raw: JSON.stringify({ pass: "classify", runnerUp: "none" }),
  ...overrides,
});

test("three stored provider-distinct versioned votes derive unanimity", () => {
  const derived = deriveStoredEnsemble([
    run("deepseek"),
    run("glm"),
    run("anthropic"),
  ]);
  assert.equal(derived.valid, true);
  assert.equal(derived.consensus.agreement, "all");
  assert.equal(storedRunsPermitAutomaticPublication([
    run("deepseek"),
    run("glm"),
    run("anthropic"),
  ]), true);
});

test("one run can never manufacture agreement or automatic publication", () => {
  const derived = deriveStoredEnsemble([run("anthropic")]);
  assert.equal(derived.valid, false);
  assert.equal(derived.consensus.agreement, "none");
  assert.equal(storedRunsPermitAutomaticPublication([run("anthropic")]), false);
});

test("same-provider and mixed-prompt panels fail closed", () => {
  const duplicateProvider = deriveStoredEnsemble([
    run("anthropic", "judicial_purge", { model: "model-a" }),
    run("anthropic", "judicial_purge", { model: "model-b" }),
  ]);
  assert.equal(duplicateProvider.valid, false);
  assert.ok(duplicateProvider.reasons.includes("duplicate_provider_not_independent"));

  const mixedPrompt = deriveStoredEnsemble([
    run("deepseek"),
    run("glm", "judicial_purge", { promptVersion: "different-prompt" }),
  ]);
  assert.equal(mixedPrompt.valid, false);
  assert.ok(mixedPrompt.reasons.includes("mixed_promptVersion"));
});

test("legacy runs without explicit pass and version identity remain unresolved", () => {
  const legacy = run("anthropic", "judicial_purge", {
    role: undefined,
    promptVersion: undefined,
    methodVersion: undefined,
    configurationHash: undefined,
    configuredEngineCount: undefined,
  });
  const derived = deriveStoredEnsemble([legacy]);
  assert.equal(derived.valid, false);
  assert.equal(derived.classifyRunCount, 0);
  assert.equal(derived.consensus.agreement, "none");
});
