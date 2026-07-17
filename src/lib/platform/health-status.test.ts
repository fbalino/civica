import assert from "node:assert/strict";
import test from "node:test";

import {
  checkHealthStatus,
  healthHttpStatus,
  statusPageDecision,
  type HealthStatusDependencies,
} from "./health-status";

const now = new Date("2026-07-16T12:00:00.000Z");

function healthyDependencies(
  overrides: HealthStatusDependencies = {},
): HealthStatusDependencies {
  return {
    now: () => now,
    env: {
      ANTHROPIC_API_KEY_CHAT: "test-chat-key",
      ANTHROPIC_API_KEY_PULSE_CLASSIFIER: "test-pulse-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
      GLM_API_KEY: "test-glm-key",
    },
    checkDatabase: async () => undefined,
    probeCriticalAsset: async () => undefined,
    loadPipelineRows: async () => [],
    expectedPipelineSlots: () => new Map(),
    ...overrides,
  };
}

test("health report distinguishes every required component without leaking env values", async () => {
  const report = await checkHealthStatus(
    healthyDependencies({
      env: {
        ANTHROPIC_API_KEY_CHAT: "private-chat-key",
        ANTHROPIC_API_KEY_PULSE_CLASSIFIER: "private-pulse-key",
        DEEPSEEK_API_KEY: "private-deepseek-key",
        GLM_API_KEY: "private-glm-key",
      },
    }),
  );

  assert.equal(report.overall, "operational");
  assert.deepEqual(
    report.components.map(({ id, state, optional }) => ({ id, state, optional })),
    [
      { id: "application", state: "operational", optional: false },
      { id: "database", state: "operational", optional: false },
      { id: "critical_assets", state: "operational", optional: false },
      { id: "scheduled_data_freshness", state: "operational", optional: false },
      {
        id: "model_dependent_optional_services",
        state: "operational",
        optional: true,
      },
    ],
  );
  assert.equal(healthHttpStatus(report), 200);
  assert.equal(JSON.stringify(report).includes("private-chat-key"), false);
  assert.equal(JSON.stringify(report).includes("private-pulse-key"), false);
});

test("database failure is an immediate public-status incident and a failing HTTP health check", async () => {
  const report = await checkHealthStatus(
    healthyDependencies({
      checkDatabase: async () => {
        throw new Error("database connection string must not leak");
      },
    }),
  );

  assert.equal(report.overall, "unavailable");
  assert.equal(healthHttpStatus(report), 503);
  assert.deepEqual(statusPageDecision(report), {
    action: "publish",
    incidentStatus: "investigating",
    threshold: "immediate_core_failure",
    components: ["website", "atlas_data"],
  });
  assert.equal(JSON.stringify(report).includes("connection string"), false);
});

test("missed scheduled data becomes a persistence-gated atlas-data incident", async () => {
  const expectedSlot = new Date("2026-07-16T08:00:00.000Z");
  const report = await checkHealthStatus(
    healthyDependencies({
      expectedPipelineSlots: () => new Map([["factbook.wikidata", expectedSlot]]),
    }),
  );

  assert.equal(report.overall, "degraded");
  assert.equal(healthHttpStatus(report), 200);
  assert.deepEqual(statusPageDecision(report), {
    action: "observe",
    incidentStatus: null,
    threshold: "not_met",
    components: ["atlas_data"],
  });
  assert.deepEqual(statusPageDecision(report, 2), {
    action: "publish",
    incidentStatus: "investigating",
    threshold: "two_consecutive_observations",
    components: ["atlas_data"],
  });
});

test("critical assets and Ask Civica are separately represented as non-core incidents", async () => {
  const assetReport = await checkHealthStatus(
    healthyDependencies({
      probeCriticalAsset: async () => {
        throw new Error("asset origin timeout");
      },
    }),
  );
  assert.equal(assetReport.overall, "degraded");
  assert.deepEqual(statusPageDecision(assetReport, 2).components, ["atlas_map"]);

  const modelReport = await checkHealthStatus(
    healthyDependencies({
      env: {
        ANTHROPIC_API_KEY_PULSE_CLASSIFIER: "configured",
        DEEPSEEK_API_KEY: "configured",
        GLM_API_KEY: "configured",
      },
    }),
  );
  assert.equal(modelReport.overall, "operational");
  assert.deepEqual(statusPageDecision(modelReport), {
    action: "observe",
    incidentStatus: null,
    threshold: "not_met",
    components: ["ask_civica"],
  });
  assert.deepEqual(statusPageDecision(modelReport, 2).components, ["ask_civica"]);
});

test("status-page decisions reject an invalid persistence count", async () => {
  const report = await checkHealthStatus(healthyDependencies());
  assert.throws(() => statusPageDecision(report, 0), /positive integer/);
});
