import assert from "node:assert/strict";
import test from "node:test";

import {
  pipelineAlerts,
  sourceVersionsForPipeline,
  startPipelineRun,
  summarizePipelinePayload,
  type PipelineRunStore,
} from "./pipeline-observability";

const starts: Parameters<PipelineRunStore["start"]>[0][] = [];

const memoryStore: PipelineRunStore = {
  async start(input) {
    starts.push(input);
    return { id: input.id, startedAt: input.startedAt };
  },
  async finish() {
    // Start-contract coverage is sufficient for this pure unit fixture.
  },
};

test("registered pipelines derive bounded declared source versions", async () => {
  const versions = sourceVersionsForPipeline("factbook.wdi");
  assert.deepEqual(versions.map((entry) => entry.sourceId), ["world_bank"]);
  const handle = await startPipelineRun(
    {
      pipelineId: "factbook.wdi",
      triggerKind: "scheduled",
      executionKey: "a".repeat(64),
      scheduleSlot: new Date("2026-07-15T08:00:00.000Z"),
      startedAt: new Date("2026-07-15T08:01:00.000Z"),
    },
    memoryStore,
  );
  assert.equal(handle.pipelineId, "factbook.wdi");
  assert.equal(starts.at(-1)?.sourceVersions[0]?.upstreamVersion.length! > 0, true);
});

test("a retry retains the store-owned logical run identity", async () => {
  const firstStartedAt = new Date("2026-07-15T08:01:00.000Z");
  const handle = await startPipelineRun(
    {
      pipelineId: "factbook.wdi",
      triggerKind: "scheduled",
      executionKey: "b".repeat(64),
      scheduleSlot: new Date("2026-07-15T08:00:00.000Z"),
      startedAt: new Date("2026-07-15T08:04:00.000Z"),
    },
    {
      async start() {
        return { id: "retained-logical-run", startedAt: firstStartedAt };
      },
      async finish() {},
    },
  );
  assert.equal(handle.id, "retained-logical-run");
  assert.equal(handle.startedAt, firstStartedAt);
});

test("payload counters never coerce unknown values into zero", () => {
  assert.deepEqual(
    summarizePipelinePayload({
      jurisdictionsInScope: 190,
      totalWritten: 188,
      errorCount: 2,
    }),
    { rowsRead: 190, rowsWritten: 188, rowsRejected: 2, costMicrousd: null },
  );
  assert.deepEqual(summarizePipelinePayload({ ok: true }), {
    rowsRead: null,
    rowsWritten: null,
    rowsRejected: null,
    costMicrousd: null,
  });
});

test("missed, failed, empty, and anomalous rows become closed alerts", () => {
  const alerts = pipelineAlerts({
    now: new Date("2026-07-16T12:00:00.000Z"),
    expectedSlots: new Map([
      ["factbook.wdi", new Date("2026-07-16T08:00:00.000Z")],
      ["pulse.v2.ingest", new Date("2026-07-16T08:00:00.000Z")],
    ]),
    rows: [
      {
        pipelineId: "pulse.v2.ingest",
        triggerKind: "scheduled",
        scheduleSlot: new Date("2026-07-16T08:00:00.000Z"),
        status: "failed",
        startedAt: new Date("2026-07-16T08:00:00.000Z"),
        completedAt: new Date("2026-07-16T08:02:00.000Z"),
        rowsRead: 100,
        rowsWritten: 0,
        rowsRejected: 0,
      },
      {
        pipelineId: "atlas.constitutions",
        triggerKind: "manual",
        scheduleSlot: null,
        status: "empty",
        startedAt: new Date("2026-07-16T08:00:00.000Z"),
        completedAt: new Date("2026-07-16T08:02:00.000Z"),
        rowsRead: 0,
        rowsWritten: 0,
        rowsRejected: 0,
      },
      {
        pipelineId: "atlas.elections",
        triggerKind: "manual",
        scheduleSlot: null,
        status: "anomalous",
        startedAt: new Date("2026-07-16T08:00:00.000Z"),
        completedAt: new Date("2026-07-16T08:02:00.000Z"),
        rowsRead: 100,
        rowsWritten: 75,
        rowsRejected: 25,
      },
    ],
  });
  assert.deepEqual(
    alerts.map(({ id, pipelineId }) => `${id}:${pipelineId}`),
    [
      "empty:atlas.constitutions",
      "anomalous:atlas.elections",
      "missed:factbook.wdi",
      "failed:pulse.v2.ingest",
    ],
  );
});

test("a newer successful row clears a prior failed alert for the same pipeline", () => {
  const latestRows = [
    {
      pipelineId: "factbook.wdi",
      triggerKind: "scheduled" as const,
      scheduleSlot: new Date("2026-07-15T08:00:00.000Z"),
      status: "failed" as const,
      startedAt: new Date("2026-07-15T08:01:00.000Z"),
      completedAt: new Date("2026-07-15T08:02:00.000Z"),
      rowsRead: 100,
      rowsWritten: 0,
      rowsRejected: 0,
    },
    {
      pipelineId: "factbook.wdi",
      triggerKind: "scheduled" as const,
      scheduleSlot: new Date("2026-07-16T08:00:00.000Z"),
      status: "succeeded" as const,
      startedAt: new Date("2026-07-16T08:01:00.000Z"),
      completedAt: new Date("2026-07-16T08:02:00.000Z"),
      rowsRead: 100,
      rowsWritten: 100,
      rowsRejected: 0,
    },
  ];
  assert.deepEqual(
    pipelineAlerts({
      now: new Date("2026-07-16T12:00:00.000Z"),
      expectedSlots: new Map([
        ["factbook.wdi", new Date("2026-07-16T08:00:00.000Z")],
      ]),
      rows: latestRows,
    }),
    [],
  );
});
