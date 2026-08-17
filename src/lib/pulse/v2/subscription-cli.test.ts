import assert from "node:assert/strict";
import test from "node:test";

import {
  SUBSCRIPTION_CLASSIFY_ENSEMBLE,
  SUBSCRIPTION_VERIFY_CONFIG,
} from "./subscription-cli";
import {
  resolveClassifyEnsemble,
  resolveEnsembleVerifyConfig,
  subscriptionTransportActive,
} from "./provider";
import { isApprovedPulseProviderModel } from "@/lib/model-operations/contract";

function withEnv<T>(name: string, value: string | undefined, fn: () => T): T {
  const prior = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return fn();
  } finally {
    if (prior === undefined) delete process.env[name];
    else process.env[name] = prior;
  }
}

test("the subscription panel is the owner-approved closed set", () => {
  assert.deepEqual(
    SUBSCRIPTION_CLASSIFY_ENSEMBLE.map(({ provider, model }) => ({
      provider,
      model,
    })),
    [
      { provider: "openai", model: "gpt-5.6-terra" },
      { provider: "anthropic", model: "claude-sonnet-5" },
      { provider: "moonshot", model: "kimi-k3" },
      { provider: "xai", model: "grok-4.5" },
    ],
  );
  for (const voter of SUBSCRIPTION_CLASSIFY_ENSEMBLE) {
    assert.equal(
      isApprovedPulseProviderModel(voter.provider, voter.model),
      true,
      `${voter.provider}/${voter.model} must be in the approved registry`,
    );
  }
  assert.equal(SUBSCRIPTION_VERIFY_CONFIG.provider, "anthropic");
  assert.equal(SUBSCRIPTION_VERIFY_CONFIG.model, "claude-sonnet-5");
});

test("subscription transport fixes the ensemble and ignores env pair lists", () => {
  withEnv("PULSE_CLASSIFY_TRANSPORT", "subscription-cli", () => {
    withEnv("PULSE_CLASSIFY_ENSEMBLE", "deepseek:deepseek-v4-flash", () => {
      assert.equal(subscriptionTransportActive(), true);
      const ensemble = resolveClassifyEnsemble();
      assert.equal(ensemble.length, 4);
      for (const config of ensemble) {
        assert.equal(config.transport, "subscription-cli");
        assert.ok(config.bin, "every subscription voter names its CLI");
      }
      assert.deepEqual(
        ensemble.map(({ provider }) => provider).toSorted(),
        ["anthropic", "moonshot", "openai", "xai"],
      );
      const verify = resolveEnsembleVerifyConfig();
      assert.equal(verify.transport, "subscription-cli");
      assert.equal(verify.model, "claude-sonnet-5");
    });
  });
});

test("without the transport flag the HTTP ensemble path is unchanged", () => {
  withEnv("PULSE_CLASSIFY_TRANSPORT", undefined, () => {
    withEnv("PULSE_CLASSIFY_ENSEMBLE", undefined, () => {
      assert.equal(subscriptionTransportActive(), false);
      for (const config of resolveClassifyEnsemble()) {
        assert.equal(config.transport ?? "http", "http");
      }
    });
  });
});

test("xai and moonshot have no HTTP path", async () => {
  const { callClassifier } = await import("./provider");
  await assert.rejects(
    callClassifier(
      { provider: "xai", model: "grok-4.5" },
      { system: "s", user: "u", maxTokens: 10, expectJson: true },
    ),
    /no HTTP path/,
  );
  await assert.rejects(
    callClassifier(
      { provider: "moonshot", model: "kimi-k3" },
      { system: "s", user: "u", maxTokens: 10, expectJson: true },
    ),
    /no HTTP path/,
  );
});
