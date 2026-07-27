import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveClassifyEnsemble,
  resolveEnsembleVerifyConfig,
  resolveProviderConfig,
} from "./provider";

function withEnv<T>(
  values: Partial<Record<"PULSE_CLASSIFY_ENSEMBLE" | "PULSE_ENSEMBLE_VERIFY" | "PULSE_VERIFY_PROVIDER" | "PULSE_VERIFY_MODEL", string | undefined>>,
  run: () => T,
): T {
  const prior = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return run();
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("unset Pulse configuration uses only its checked defaults", () => {
  withEnv(
    {
      PULSE_CLASSIFY_ENSEMBLE: undefined,
      PULSE_ENSEMBLE_VERIFY: undefined,
      PULSE_VERIFY_PROVIDER: undefined,
      PULSE_VERIFY_MODEL: undefined,
    },
    () => {
      assert.equal(resolveClassifyEnsemble().length, 3);
      assert.deepEqual(resolveEnsembleVerifyConfig(), {
        provider: "anthropic",
        model: "claude-haiku-4-5",
      });
      assert.deepEqual(resolveProviderConfig("verify"), {
        provider: "deepseek",
        model: "deepseek-v4-flash",
      });
    },
  );
});

test("invalid explicit Pulse configuration never falls through to a billed default", () => {
  withEnv({ PULSE_CLASSIFY_ENSEMBLE: "unapproved:unknown-model" }, () => {
    assert.throws(resolveClassifyEnsemble, /unapproved provider\/model/);
  });
  withEnv({ PULSE_ENSEMBLE_VERIFY: "glm:not-approved" }, () => {
    assert.throws(resolveEnsembleVerifyConfig, /not an approved provider\/model/);
  });
  withEnv({ PULSE_VERIFY_PROVIDER: "unapproved" }, () => {
    assert.throws(() => resolveProviderConfig("verify"), /not an approved provider/);
  });
  withEnv(
    { PULSE_VERIFY_PROVIDER: "glm", PULSE_VERIFY_MODEL: "not-approved" },
    () => {
      assert.throws(
        () => resolveProviderConfig("verify"),
        /not approved for PULSE_VERIFY_PROVIDER/,
      );
    },
  );
});
