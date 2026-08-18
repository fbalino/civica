import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  SUBSCRIPTION_CLASSIFY_ENSEMBLE,
  SUBSCRIPTION_VERIFY_CONFIG,
  cliInvocation,
  summarizeCliStderr,
  voterFailureKind,
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

test("the Kimi voter carries the frozen system prompt in the system channel", () => {
  // Regression: flattening the classify rubric into Kimi's user turn is
  // refused by the managed endpoint's content-risk filter with a
  // deterministic HTTP 400, killing the fourth voter on every cluster.
  const scratch = mkdtempSync(join(tmpdir(), "civica-voter-test-"));
  const request = { system: "FROZEN RUBRIC", user: "EVENT EVIDENCE" };
  const kimi = SUBSCRIPTION_CLASSIFY_ENSEMBLE.find(
    (voter) => voter.provider === "moonshot",
  );
  assert.ok(kimi);
  const argv = cliInvocation(kimi, request, scratch);

  const agentFileIndex = argv.indexOf("--agent-file");
  assert.notEqual(agentFileIndex, -1, "the system prompt uses --agent-file");
  const agentFile = argv[agentFileIndex + 1];
  assert.equal(
    agentFile.startsWith(scratch),
    true,
    "the agent file stays in the empty scratch directory",
  );
  assert.match(readFileSync(agentFile, "utf8"), /FROZEN RUBRIC/);

  const promptIndex = argv.indexOf("-p");
  assert.notEqual(promptIndex, -1);
  assert.equal(
    argv[promptIndex + 1],
    "EVENT EVIDENCE",
    "the user turn carries the event evidence alone",
  );
  assert.equal(
    argv.some((arg) => arg.includes("FROZEN RUBRIC")),
    false,
    "the rubric never enters the user turn",
  );
  assert.deepEqual(argv.slice(-4), [
    "--model",
    "kimi-code/k3",
    "--output-format",
    "text",
  ]);
});

test("the other three voters keep one self-contained prompt", () => {
  const scratch = mkdtempSync(join(tmpdir(), "civica-voter-test-"));
  const request = { system: "FROZEN RUBRIC", user: "EVENT EVIDENCE" };
  for (const voter of SUBSCRIPTION_CLASSIFY_ENSEMBLE.filter(
    (candidate) => candidate.provider !== "moonshot",
  )) {
    const argv = cliInvocation(voter, request, scratch);
    assert.equal(
      argv.includes("FROZEN RUBRIC\n\nEVENT EVIDENCE"),
      true,
      `${voter.provider} keeps the combined prompt`,
    );
    assert.equal(argv.includes("--agent-file"), false);
  }
});

test("a CLI failure reports the provider error, not the version banner", () => {
  // The first diagnosis of the Kimi outage was misdirected because the raw
  // head-slice of stderr showed only `kimi version 0.36.1`.
  const stderr = [
    "kimi version 0.36.1",
    "• thinking about the taxonomy",
    "error: failed to run prompt: provider.api_error: 400 The request was rejected because it was considered high risk",
    "See log: /Users/fernandobalino/.kimi-code/logs/kimi-code.log",
  ].join("\n");
  const summary = summarizeCliStderr(stderr);
  assert.match(summary, /provider\.api_error: 400/);
  assert.equal(summary.includes("kimi version"), false);
  assert.equal(summary.includes("thinking about"), false);
  // With no error-shaped line it still reports something useful.
  assert.equal(summarizeCliStderr("kimi version 0.36.1\nsome context"), "some context");
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

test("content-policy refusals are separated from ordinary voter failures", () => {
  // The exact Moonshot/Kimi refusal that killed the fourth voter.
  assert.equal(
    voterFailureKind(
      "Subscription voter moonshot/kimi-k3 exited 1: stderr=error: failed to run prompt: provider.api_error: 400 The request was rejected because it was considered high risk",
    ),
    "content_filter",
  );
  // Vendor-neutral phrasings a future provider might use.
  for (const message of [
    "error: blocked due to content policy",
    "rejected: content_filter triggered",
    "error: request refused by safety policy",
  ]) {
    assert.equal(voterFailureKind(message), "content_filter", message);
  }

  // Ordinary failures must NOT be miscounted as refusals — that would
  // manufacture evidence of content-correlated dropout that does not exist.
  assert.equal(
    voterFailureKind("Subscription voter x/y timed out after 300000ms"),
    "timeout",
  );
  assert.equal(
    voterFailureKind("Subscription voter x/y failed to start: ENOENT"),
    "startup",
  );
  assert.equal(
    voterFailureKind("Subscription voter x/y produced empty output"),
    "empty_output",
  );
  assert.equal(
    voterFailureKind("Subscription voter x/y exited 1: stderr=segfault"),
    "exit",
  );
  // A model reasoning ABOUT a risky event is not a refusal.
  assert.equal(
    voterFailureKind("the protest carried a high risk of escalation"),
    "unknown",
  );
});
