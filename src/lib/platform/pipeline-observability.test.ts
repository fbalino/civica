import assert from "node:assert/strict";
import test from "node:test";

import { summarizeCronReports } from "@/lib/api/cron-output";
import { pulseV2IngestCronOutcome } from "@/lib/pulse/v2/cron-outcomes";
import type { IngestSummary } from "@/lib/pulse/v2/ingest";

import {
  finishPipelineRun,
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
  async advancedSources() {
    return [];
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
  const sourceVersion = starts.at(-1)?.sourceVersions[0];
  assert.equal(sourceVersion !== undefined && sourceVersion.upstreamVersion.length > 0, true);
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
      async advancedSources() {
        return [];
      },
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

test("a run-level total outranks a nested per-item counter", () => {
  // factbook.sync-classifications reports per-publisher errors before the
  // run total; the first nested match would record 0 of 3 errors.
  assert.deepEqual(
    summarizePipelinePayload({
      worldBank: { regionRows: 217, errors: 0 },
      vdem: { rows: 179, errors: 3 },
      monarchy: { monarchyRows: 43, errors: 0 },
      totalErrors: 3,
    }).rowsRejected,
    3,
  );
  // Equal depth keeps key order, so earlier routes keep their picks.
  assert.equal(
    summarizePipelinePayload({
      summary: { candidates: 40, collisionCandidates: 2 },
    }).rowsRead,
    40,
  );
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

test("the pipeline monitor cannot create a recursive alert about itself", () => {
  const monitorId = "operations.pipeline-alerts";
  const alerts = pipelineAlerts({
    now: new Date("2026-07-16T12:00:00.000Z"),
    expectedSlots: new Map([
      [monitorId, new Date("2026-07-16T08:00:00.000Z")],
      ["factbook.wdi", new Date("2026-07-16T08:00:00.000Z")],
    ]),
    rows: [
      {
        pipelineId: monitorId,
        triggerKind: "scheduled",
        scheduleSlot: new Date("2026-07-16T08:00:00.000Z"),
        status: "failed",
        startedAt: new Date("2026-07-16T08:00:00.000Z"),
        completedAt: new Date("2026-07-16T08:01:00.000Z"),
        rowsRead: null,
        rowsWritten: null,
        rowsRejected: null,
      },
    ],
    ignoredPipelineIds: new Set([monitorId]),
  });

  assert.deepEqual(
    alerts.map(({ id, pipelineId }) => `${id}:${pipelineId}`),
    ["missed:factbook.wdi"],
  );
});

/** The payload shape `/api/cron/pulse/v2/ingest` returns for a partial run. */
function partialPulseIngestPayload() {
  const summary: IngestSummary = {
    runId: "pulse-run",
    versionKey: "pulse-version",
    reports: [
      { source: "acled", fetched: 0, inserted: 0, skippedDuplicate: 0, unmatchedCountry: 0, wouldWrite: 0, error: "access gated" },
      { source: "civicus", fetched: 10, inserted: 0, skippedDuplicate: 10, unmatchedCountry: 1, wouldWrite: 10 },
      { source: "gdelt", fetched: 0, inserted: 0, skippedDuplicate: 0, unmatchedCountry: 0, wouldWrite: 0, error: "connect timeout" },
      { source: "hrw", fetched: 20, inserted: 2, skippedDuplicate: 18, unmatchedCountry: 2, wouldWrite: 20 },
      { source: "ipu", fetched: 6, inserted: 2, skippedDuplicate: 4, unmatchedCountry: 0, wouldWrite: 6 },
    ],
    totalFetched: 36,
    totalInserted: 4,
    totalSkipped: 32,
    totalUnmatched: 3,
    totalWouldWrite: 36,
    sourcesStamped: ["hrw", "ipu_parline"],
    dryRun: false,
    reused: false,
  };
  const outcome = pulseV2IngestCronOutcome(summary);
  return {
    ok: outcome.ok,
    outcome: outcome.outcome,
    failedConnectors: outcome.failedConnectors,
    step: "pulse.v2.ingest",
    dryRun: false,
    started: "2026-09-25T08:00:15.459Z",
    finished: "2026-09-25T08:01:11.536Z",
    summary: { ...summary, reports: summarizeCronReports(summary.reports) },
  };
}

function recordingStore(advanced: readonly string[]) {
  const finishes: Parameters<PipelineRunStore["finish"]>[0][] = [];
  const lookups: string[][] = [];
  const store: PipelineRunStore = {
    async start(input) {
      return { id: input.id, startedAt: input.startedAt };
    },
    async finish(input) {
      finishes.push(input);
    },
    async advancedSources({ sourceIds }) {
      lookups.push([...sourceIds]);
      return sourceIds.filter((id) => advanced.includes(id));
    },
  };
  return { store, finishes, lookups };
}

const PULSE_RUN = {
  id: "run-1",
  pipelineId: "pulse.v2.ingest",
  triggerKind: "scheduled" as const,
  startedAt: new Date("2026-09-25T08:00:15.459Z"),
  completedAt: new Date("2026-09-25T08:01:11.536Z"),
};

test("a partial Pulse ingest records its run totals and the sources its writer stamped", async () => {
  // The database shows both stamped sources, plus an unrelated stamp that
  // this failed run did not report and must not claim.
  const { store, finishes, lookups } = recordingStore(["hrw", "ipu_parline", "amnesty"]);
  const payload = partialPulseIngestPayload();
  const status = await finishPipelineRun(
    { ...PULSE_RUN, responseStatus: 502, succeeded: false, payload },
    store,
  );
  assert.equal(status, "failed");
  assert.deepEqual(finishes[0].metrics, {
    rowsRead: 36,
    rowsWritten: 4,
    rowsRejected: 3,
    costMicrousd: null,
  });
  assert.deepEqual(finishes[0].freshnessSourceIds, ["hrw", "ipu_parline"]);
  assert.deepEqual(lookups, [["hrw", "ipu_parline"]]);
  assert.equal(finishes[0].errorSummary, "partial");
});

test("a failed run records only reported stamps the database confirms", async () => {
  const unreported = recordingStore(["hrw"]);
  await finishPipelineRun(
    {
      ...PULSE_RUN,
      responseStatus: 502,
      succeeded: false,
      payload: { ok: false, outcome: "upstream_timeout" },
    },
    unreported.store,
  );
  assert.deepEqual(unreported.finishes[0].freshnessSourceIds, []);
  assert.deepEqual(unreported.lookups, []);

  const unconfirmed = recordingStore(["hrw"]);
  await finishPipelineRun(
    {
      ...PULSE_RUN,
      responseStatus: 502,
      succeeded: false,
      payload: partialPulseIngestPayload(),
    },
    unconfirmed.store,
  );
  assert.deepEqual(unconfirmed.finishes[0].freshnessSourceIds, ["hrw"]);
});

test("a successful run checks registered and reported sources together", async () => {
  const { store, finishes, lookups } = recordingStore(["gdelt", "ipu_parline"]);
  const payload = partialPulseIngestPayload();
  const status = await finishPipelineRun(
    {
      ...PULSE_RUN,
      responseStatus: 200,
      succeeded: true,
      payload: { ...payload, ok: true, outcome: "completed", failedConnectors: [] },
    },
    store,
  );
  assert.equal(status, "succeeded");
  assert.deepEqual(lookups, [
    ["amnesty", "civicus_monitor", "gdelt", "hrw", "ipu_parline"],
  ]);
  assert.deepEqual(finishes[0].freshnessSourceIds, ["gdelt", "ipu_parline"]);
  assert.equal(finishes[0].errorSummary, null);
});
