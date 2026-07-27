import assert from "node:assert/strict";
import test from "node:test";

import {
  PULSE_CLASSIFICATION_STATE_VERSION,
  buildClassificationConfigHash,
  classificationQueueMetrics,
  classifyClassificationError,
  recordClassificationFailure,
  selectClassificationQueue,
  type ClassificationConfigInput,
  type ClassificationState,
} from "./classification-state";

const policy = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  multiplier: 2,
  maxDelayMs: 3_000,
} as const;

const config: ClassificationConfigInput = {
  methodVersion: "pulse-v2.9-beta",
  ontologyVersion: "v2.0",
  algorithmVersion: "classification-v1",
  classifierPromptVersion: "prompt-v1",
  publicationGateVersion: "gate-v1",
  classifyEngines: [
    { provider: "glm", model: "glm-4.7" },
    { provider: "deepseek", model: "deepseek-v4-flash" },
  ],
  verifyEngine: { provider: "anthropic", model: "claude-haiku-4-5" },
  subjectAttribution: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    attributionVersion: "jurisdiction-attribution-v1",
    promptVersion: "subject-prompt-v1",
  },
  decodeMode: "deterministic",
  thinkingMode: "disabled",
  retryPolicy: policy,
};

const hash = buildClassificationConfigHash(config);

function baseState(
  clusterId: string,
  overrides: Partial<ClassificationState> = {},
): ClassificationState {
  return {
    schemaVersion: PULSE_CLASSIFICATION_STATE_VERSION,
    clusterId,
    configHash: hash,
    status: "none",
    attemptCount: 1,
    firstAttemptAt: "2026-07-12T10:00:00.000Z",
    lastAttemptAt: "2026-07-12T10:00:00.000Z",
    lastRunId: "run-1",
    eventId: null,
    decisionKey: "decision-1",
    completedAt: "2026-07-12T10:00:00.000Z",
    nextRetryAt: null,
    lastError: null,
    ...overrides,
  } as ClassificationState;
}

test("configuration hash uses actual engines but excludes batch identity", () => {
  const withBatchFields = {
    ...config,
    sourceIds: ["gdelt"],
    upstreamRunIds: ["run-a"],
    runId: "run-b",
  };
  assert.equal(buildClassificationConfigHash(withBatchFields), hash);
  assert.equal(
    buildClassificationConfigHash({
      ...config,
      classifyEngines: [...config.classifyEngines].reverse(),
    }),
    hash,
  );
  assert.notEqual(
    buildClassificationConfigHash({
      ...config,
      verifyEngine: { provider: "anthropic", model: "claude-sonnet-4-6" },
    }),
    hash,
  );
});

test("a second identical terminal-none run makes zero model calls", async () => {
  const queue = selectClassificationQueue({
    candidates: [{ clusterId: "none-cluster", clusteredAt: "2026-07-12T09:00:00.000Z" }],
    states: [baseState("none-cluster")],
    configHash: hash,
    now: "2026-07-12T12:00:00.000Z",
  });
  assert.deepEqual(queue, []);
  let modelCalls = 0;
  for (const _item of queue) {
    modelCalls++;
  }
  assert.equal(modelCalls, 0);
});

test("a configuration change makes a terminal cluster new work", () => {
  const changedHash = buildClassificationConfigHash({
    ...config,
    classifierPromptVersion: "prompt-v2",
  });
  const queue = selectClassificationQueue({
    candidates: [{ clusterId: "prior-none", clusteredAt: "2026-07-12T09:00:00.000Z" }],
    states: [baseState("prior-none")],
    configHash: changedHash,
    now: "2026-07-12T12:00:00.000Z",
  });
  assert.equal(queue[0]?.reason, "new");
});

test("bounded deterministic retries become terminal at maximum attempts", () => {
  const first = recordClassificationFailure({
    clusterId: "retry-cluster",
    configHash: hash,
    runId: "run-1",
    attemptedAt: "2026-07-12T10:00:00.000Z",
    error: Object.assign(new Error("rate limited"), { status: 429 }),
    retryPolicy: policy,
  });
  assert.equal(first.status, "retryable_failure");
  assert.equal(first.nextRetryAt, "2026-07-12T10:00:01.000Z");
  const second = recordClassificationFailure({
    clusterId: "retry-cluster",
    configHash: hash,
    runId: "run-2",
    attemptedAt: "2026-07-12T10:00:01.000Z",
    error: new Error("timeout"),
    retryPolicy: policy,
    previous: first,
  });
  assert.equal(second.status, "retryable_failure");
  assert.equal(second.nextRetryAt, "2026-07-12T10:00:03.000Z");
  const third = recordClassificationFailure({
    clusterId: "retry-cluster",
    configHash: hash,
    runId: "run-3",
    attemptedAt: "2026-07-12T10:00:03.000Z",
    error: new TypeError("fetch failed"),
    retryPolicy: policy,
    previous: second,
  });
  assert.equal(third.status, "terminal_failure");
  assert.equal(third.attemptCount, 3);
  assert.equal(third.nextRetryAt, null);
});

test("a non-retryable authentication failure is terminal on its first attempt", () => {
  const failed = recordClassificationFailure({
    clusterId: "auth-failure",
    configHash: hash,
    runId: "run-auth",
    attemptedAt: "2026-07-12T10:00:00.000Z",
    error: Object.assign(new Error("invalid credential"), { status: 401 }),
    retryPolicy: policy,
  });
  assert.equal(failed.status, "terminal_failure");
  assert.equal(failed.attemptCount, 1);
  assert.equal(failed.nextRetryAt, null);
  assert.equal(failed.lastError.code, "authentication_failed");
});

test("new work precedes due retries and future retries remain excluded", () => {
  const due = recordClassificationFailure({
    clusterId: "due",
    configHash: hash,
    runId: "run-due",
    attemptedAt: "2026-07-12T09:00:00.000Z",
    error: new Error("timeout"),
    retryPolicy: policy,
  });
  const future = recordClassificationFailure({
    clusterId: "future",
    configHash: hash,
    runId: "run-future",
    attemptedAt: "2026-07-12T12:00:00.000Z",
    error: new Error("timeout"),
    retryPolicy: policy,
  });
  if (due.status !== "retryable_failure" || future.status !== "retryable_failure") {
    throw new Error("fixture failures must remain retryable");
  }
  const candidates = [
    { clusterId: "due", clusteredAt: "2026-07-12T08:00:00.000Z" },
    { clusterId: "new", clusteredAt: "2026-07-12T11:00:00.000Z" },
    { clusterId: "future", clusteredAt: "2026-07-12T07:00:00.000Z" },
  ];
  const now = "2026-07-12T12:00:00.500Z";
  const queue = selectClassificationQueue({
    candidates,
    states: [due, future],
    configHash: hash,
    now,
  });
  assert.deepEqual(queue.map(({ clusterId }) => clusterId), ["new", "due"]);
  const metrics = classificationQueueMetrics({
    candidates,
    states: [due, future],
    configHash: hash,
    now,
  });
  assert.deepEqual(
    {
      new: metrics.new,
      due: metrics.dueRetries,
      deferred: metrics.deferredRetries,
      eligible: metrics.eligible,
      oldest: metrics.oldestEligibleAt,
      age: metrics.oldestEligibleAgeMs,
    },
    {
      new: 1,
      due: 1,
      deferred: 1,
      eligible: 2,
      oldest: due.nextRetryAt,
      age: Date.parse(now) - Date.parse(due.nextRetryAt),
    },
  );
});

test("errors are classified and secrets are sanitized", () => {
  const error = classifyClassificationError(
    Object.assign(new Error("Bearer secret-token api_key=sk-secret12345678"), {
      status: 401,
    }),
  );
  assert.equal(error.code, "authentication_failed");
  assert.equal(error.retryable, false);
  assert.doesNotMatch(error.message, /secret12345678|secret-token/);
});
