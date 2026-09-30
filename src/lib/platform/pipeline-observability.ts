import { randomUUID } from "node:crypto";

import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { productionPipelineRuns, sources } from "@/lib/db/schema";
import {
  MANUAL_PRODUCTION_ADAPTERS,
  SCHEDULED_PRODUCTION_ADAPTERS,
} from "@/lib/data/production-adapter-registry";
import { SOURCE_INPUT_SPECS } from "@/lib/data/source-input-manifest";
import { deploymentReleaseId } from "@/lib/platform/route-performance-telemetry";
import { latestCronScheduleSlot } from "@/lib/api/cron-schedule";

export const PIPELINE_OBSERVABILITY_VERSION =
  "civica-pipeline-observability/v1" as const;
export const PIPELINE_MISSED_RUN_GRACE_MS = 2 * 60 * 60 * 1_000;
export const PIPELINE_ANOMALY_MIN_REJECTIONS = 10;
export const PIPELINE_ANOMALY_REJECTION_RATE = 0.1;

export type PipelineTriggerKind = "scheduled" | "manual";
export type PipelineRunStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "empty"
  | "anomalous";

export interface PipelineSourceVersion {
  sourceId: string;
  upstreamVersion: string;
  upstreamVintage: string;
}

export interface PipelineMetrics {
  rowsRead: number | null;
  rowsWritten: number | null;
  rowsRejected: number | null;
  costMicrousd: number | null;
}

export interface PipelineRunStart {
  pipelineId: string;
  triggerKind: PipelineTriggerKind;
  executionKey?: string;
  scheduleSlot?: Date;
  startedAt?: Date;
}

export interface PipelineRunFinish {
  id: string;
  pipelineId: string;
  triggerKind: PipelineTriggerKind;
  startedAt: Date;
  responseStatus: number;
  succeeded: boolean;
  payload: unknown;
  completedAt?: Date;
}

export interface PipelineRunStore {
  start(input: {
    id: string;
    pipelineId: string;
    triggerKind: PipelineTriggerKind;
    executionKey: string | null;
    scheduleSlot: Date | null;
    startedAt: Date;
    sourceVersions: PipelineSourceVersion[];
    releaseId: string;
  }): Promise<{
    id: string;
    startedAt: Date;
  }>;
  finish(input: {
    id: string;
    status: Exclude<PipelineRunStatus, "running">;
    completedAt: Date;
    metrics: PipelineMetrics;
    freshnessSourceIds: string[];
    errorSummary: string | null;
  }): Promise<void>;
  /** Of `sourceIds`, those whose sanctioned freshness stamp is at or after `since`. */
  advancedSources(input: {
    sourceIds: readonly string[];
    since: Date;
  }): Promise<string[]>;
}

export interface PipelineRunHandle {
  id: string;
  pipelineId: string;
  triggerKind: PipelineTriggerKind;
  startedAt: Date;
}

export interface PipelineAlertRow {
  pipelineId: string;
  triggerKind: PipelineTriggerKind;
  scheduleSlot: Date | null;
  status: PipelineRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  rowsRead: number | null;
  rowsWritten: number | null;
  rowsRejected: number | null;
}

export interface PipelineAlert {
  id: "missed" | "failed" | "empty" | "anomalous";
  pipelineId: string;
  detail: string;
}

type RegisteredPipeline = {
  id: string;
  sourceIds: readonly string[];
  inputKind: "external" | "derived";
};

const registeredPipelines = new Map<string, RegisteredPipeline>([
  ...SCHEDULED_PRODUCTION_ADAPTERS.map((pipeline) => [
    pipeline.id,
    {
      id: pipeline.id,
      sourceIds: pipeline.sources,
      inputKind: pipeline.inputKind,
    },
  ] as const),
  ...MANUAL_PRODUCTION_ADAPTERS.map((pipeline) => [
    pipeline.id,
    {
      id: pipeline.id,
      sourceIds: pipeline.sources,
      inputKind: "external" as const,
    },
  ] as const),
]);

function registeredPipeline(pipelineId: string): RegisteredPipeline {
  const pipeline = registeredPipelines.get(pipelineId);
  if (!pipeline) throw new Error(`Unknown production pipeline: ${pipelineId}`);
  return pipeline;
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function boundedErrorCode(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return /^[a-z][a-z0-9_.-]{0,79}$/.test(normalized)
    ? normalized
    : "pipeline_failure";
}

function numericPayloadEntries(
  value: unknown,
  prefix = "",
  depth = 0,
): Array<[string, number]> {
  if (depth > 4 || !value || typeof value !== "object") return [];
  const entries: Array<[string, number]> = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const integer = nonNegativeInteger(child);
    if (integer !== null) entries.push([path, integer]);
    else entries.push(...numericPayloadEntries(child, path, depth + 1));
  }
  return entries;
}

function firstMetric(
  entries: readonly [string, number][],
  candidates: readonly string[],
): number | null {
  for (const candidate of candidates) {
    const suffix = candidate.toLowerCase();
    let found: [string, number] | undefined;
    let foundDepth = Number.POSITIVE_INFINITY;
    for (const entry of entries) {
      if (!entry[0].toLowerCase().endsWith(suffix)) continue;
      const depth = entry[0].split(".").length;
      if (depth < foundDepth) {
        found = entry;
        foundDepth = depth;
      }
    }
    if (found) return found[1];
  }
  return null;
}

/**
 * Map the bounded machine-readable response fields already returned by cron
 * routes to the cross-pipeline counters. Unknown stays null rather than being
 * silently converted to zero. Among paths matching a candidate, the least
 * nested wins and key order breaks ties, so a run total such as
 * `summary.totalInserted` outranks one connector's `summary.reports.0.inserted`.
 * The stored metrics retain these same fields and never retain response
 * prose, payload records, URLs, or exception content.
 */
export function summarizePipelinePayload(payload: unknown): PipelineMetrics {
  const entries = numericPayloadEntries(payload);
  return {
    rowsRead: firstMetric(entries, [
      "rowsRead",
      "fetched",
      "countriesCrawled",
      "jurisdictionsProcessed",
      "jurisdictionsInScope",
      "scanned",
      "candidateCount",
      "candidates",
    ]),
    rowsWritten: firstMetric(entries, [
      "totalRowsWritten",
      "totalWritten",
      "fieldsWritten",
      "totalAdmitted",
      "winnerCount",
      "autoResolved",
      "inserted",
      "written",
    ]),
    rowsRejected: firstMetric(entries, [
      "rowsRejected",
      "totalUnmatched",
      "unmatchedCountry",
      "countriesUnmatched",
      "errorCount",
      "errors",
      "failed",
      "rejected",
    ]),
    costMicrousd: firstMetric(entries, ["costMicrousd"]),
  };
}

export function sourceVersionsForPipeline(
  pipelineId: string,
): PipelineSourceVersion[] {
  const pipeline = registeredPipeline(pipelineId);
  return [...pipeline.sourceIds]
    .sort()
    .map((sourceId) => {
      const spec = SOURCE_INPUT_SPECS.find((candidate) => candidate.sourceId === sourceId);
      if (!spec) {
        throw new Error(
          `Production pipeline ${pipelineId} lacks a source-input specification for ${sourceId}`,
        );
      }
      return {
        sourceId,
        upstreamVersion: spec.upstreamVersion,
        upstreamVintage: spec.upstreamVintage,
      };
    });
}

function terminalStatus(
  pipeline: RegisteredPipeline,
  succeeded: boolean,
  metrics: PipelineMetrics,
): Exclude<PipelineRunStatus, "running"> {
  if (!succeeded) return "failed";
  if (
    metrics.rowsRead !== null &&
    metrics.rowsRejected !== null &&
    metrics.rowsRejected >= PIPELINE_ANOMALY_MIN_REJECTIONS &&
    metrics.rowsRejected / Math.max(metrics.rowsRead, 1) >
      PIPELINE_ANOMALY_REJECTION_RATE
  ) {
    return "anomalous";
  }
  if (pipeline.inputKind === "external" && metrics.rowsRead === 0) {
    return "empty";
  }
  return "succeeded";
}

export const postgresPipelineRunStore: PipelineRunStore = {
  async start(input) {
    const inserted = await db
      .insert(productionPipelineRuns)
      .values({
        id: input.id,
        pipelineId: input.pipelineId,
        triggerKind: input.triggerKind,
        executionKey: input.executionKey,
        scheduleSlot: input.scheduleSlot,
        status: "running",
        startedAt: input.startedAt,
        sourceVersions: input.sourceVersions,
        freshnessSourceIds: [],
        metrics: {},
        releaseId: input.releaseId,
        observabilityVersion: PIPELINE_OBSERVABILITY_VERSION,
      })
      .onConflictDoNothing()
      .returning({
        id: productionPipelineRuns.id,
        startedAt: productionPipelineRuns.startedAt,
      });
    if (inserted.length === 1) return inserted[0];

    // Vercel can deliver an already-completed slot again, and the cron
    // boundary can retry after its own finalization outage. Re-use the one
    // logical run row rather than turning observability into a second source
    // of failure for that retry. A manual invocation has no execution key and
    // therefore cannot legitimately collide here.
    if (!input.executionKey) {
      throw new Error("Manual pipeline run collided without an execution key");
    }
    const existing = await db
      .select({
        id: productionPipelineRuns.id,
        pipelineId: productionPipelineRuns.pipelineId,
        triggerKind: productionPipelineRuns.triggerKind,
        startedAt: productionPipelineRuns.startedAt,
      })
      .from(productionPipelineRuns)
      .where(eq(productionPipelineRuns.executionKey, input.executionKey))
      .limit(1);
    const row = existing[0];
    if (
      !row ||
      row.pipelineId !== input.pipelineId ||
      row.triggerKind !== input.triggerKind
    ) {
      throw new Error("Pipeline execution key resolved to a different run");
    }
    return { id: row.id, startedAt: row.startedAt };
  },
  async finish(input) {
    const rows = await db
      .update(productionPipelineRuns)
      .set({
        status: input.status,
        completedAt: input.completedAt,
        rowsRead: input.metrics.rowsRead,
        rowsWritten: input.metrics.rowsWritten,
        rowsRejected: input.metrics.rowsRejected,
        costMicrousd: input.metrics.costMicrousd,
        freshnessSourceIds: input.freshnessSourceIds,
        metrics: { ...input.metrics },
        errorSummary: input.errorSummary,
      })
      .where(eq(productionPipelineRuns.id, input.id))
      .returning({ id: productionPipelineRuns.id });
    if (rows.length !== 1) {
      throw new Error("Pipeline run finalization did not update one retained row");
    }
  },
  async advancedSources(input) {
    if (!input.sourceIds.length) return [];
    const rows = await db
      .select({ id: sources.id })
      .from(sources)
      .where(
        and(
          inArray(sources.id, [...input.sourceIds]),
          gte(sources.lastSyncAt, input.since),
        ),
      );
    return rows.map((row) => row.id).sort();
  },
};

export async function startPipelineRun(
  input: PipelineRunStart,
  store: PipelineRunStore = postgresPipelineRunStore,
): Promise<PipelineRunHandle> {
  const pipeline = registeredPipeline(input.pipelineId);
  const startedAt = input.startedAt ?? new Date();
  if (!Number.isFinite(startedAt.getTime())) throw new Error("Invalid run start time");
  if (input.triggerKind === "scheduled") {
    if (!/^[a-f0-9]{64}$/.test(input.executionKey ?? "")) {
      throw new Error("Scheduled pipeline run requires a cron execution key");
    }
    if (!input.scheduleSlot || !Number.isFinite(input.scheduleSlot.getTime())) {
      throw new Error("Scheduled pipeline run requires a schedule slot");
    }
  } else if (input.scheduleSlot) {
    throw new Error("Manual pipeline run cannot carry a schedule slot");
  } else if (input.executionKey && !/^[a-f0-9]{64}$/.test(input.executionKey)) {
    throw new Error("Manual pipeline run carries an invalid execution key");
  }
  const handle = {
    id: randomUUID(),
    pipelineId: pipeline.id,
    triggerKind: input.triggerKind,
    startedAt,
  };
  const retainedRun = await store.start({
    ...handle,
    executionKey: input.executionKey ?? null,
    scheduleSlot: input.scheduleSlot ?? null,
    sourceVersions: sourceVersionsForPipeline(input.pipelineId),
    releaseId: deploymentReleaseId(),
  });
  return { ...handle, ...retainedRun };
}

const SOURCE_ID = /^[a-z0-9][a-z0-9_.-]{0,79}$/;
const MAX_FRESHNESS_SOURCES = 64;

/**
 * Source IDs a handler reports its writer stamped, from `sourcesStamped`
 * arrays such as the Pulse ingest and bills writers return. They only name
 * candidates; the database still decides which sources advanced.
 */
export function reportedStampedSources(payload: unknown, depth = 0): string[] {
  if (depth > 4 || !payload || typeof payload !== "object") return [];
  const found = new Set<string>();
  for (const [key, child] of Object.entries(payload as Record<string, unknown>)) {
    if (key === "sourcesStamped" && Array.isArray(child)) {
      for (const value of child) {
        if (typeof value === "string" && SOURCE_ID.test(value)) found.add(value);
      }
    } else {
      for (const value of reportedStampedSources(child, depth + 1)) found.add(value);
    }
  }
  return [...found].sort();
}

export async function finishPipelineRun(
  input: PipelineRunFinish,
  store: PipelineRunStore = postgresPipelineRunStore,
): Promise<Exclude<PipelineRunStatus, "running">> {
  const pipeline = registeredPipeline(input.pipelineId);
  const completedAt = input.completedAt ?? new Date();
  const metrics = summarizePipelinePayload(input.payload);
  const status = terminalStatus(pipeline, input.succeeded, metrics);
  // A failed run can still have committed rows: Pulse ingest publishes the
  // connectors that worked and finishes partial. Such a run records only the
  // sources its own writer reports and the database confirms; a successful
  // run also checks every registered source.
  const candidates = new Set(reportedStampedSources(input.payload));
  if (input.succeeded) {
    for (const sourceId of pipeline.sourceIds) candidates.add(sourceId);
  }
  const freshnessSourceIds = candidates.size
    ? (
        await store.advancedSources({
          sourceIds: [...candidates].sort(),
          since: input.startedAt,
        })
      ).slice(0, MAX_FRESHNESS_SOURCES)
    : [];
  await store.finish({
    id: input.id,
    status,
    completedAt,
    metrics,
    freshnessSourceIds,
    errorSummary: input.succeeded
      ? null
      : boundedErrorCode(
          typeof input.payload === "object" && input.payload
            ? String((input.payload as Record<string, unknown>).outcome ?? "handler_failed")
            : "handler_failed",
        ),
  });
  return status;
}

/**
 * The latest slot of each scheduled job whose missed-run grace has already
 * elapsed at `now`. Daily monitors run shortly after some of the jobs they
 * watch; evaluating the slot "as of now" would leave those jobs inside the
 * grace period on every run, so a missed delivery would never be reported.
 * A job is instead checked against its previous slot until the new one's
 * grace has passed.
 */
export function expectedPipelineSlotsPastGrace(
  jobs: ReadonlyArray<{ id: string; schedule: string }>,
  now: Date,
  graceMs: number = PIPELINE_MISSED_RUN_GRACE_MS,
): Map<string, Date> {
  const boundary = new Date(now.getTime() - graceMs);
  return new Map(
    jobs.map((job) => [job.id, latestCronScheduleSlot(job.schedule, boundary)]),
  );
}

export function pipelineAlerts(input: {
  now: Date;
  expectedSlots: ReadonlyMap<string, Date>;
  rows: readonly PipelineAlertRow[];
  missedRunGraceMs?: number;
  ignoredPipelineIds?: ReadonlySet<string>;
}): PipelineAlert[] {
  const alerts: PipelineAlert[] = [];
  const grace = input.missedRunGraceMs ?? PIPELINE_MISSED_RUN_GRACE_MS;
  const latestRows = new Map<string, PipelineAlertRow>();
  for (const row of input.rows) {
    if (input.ignoredPipelineIds?.has(row.pipelineId)) continue;
    const existing = latestRows.get(row.pipelineId);
    if (!existing || row.startedAt.getTime() > existing.startedAt.getTime()) {
      latestRows.set(row.pipelineId, row);
    }
  }
  for (const [pipelineId, expectedSlot] of input.expectedSlots) {
    if (input.ignoredPipelineIds?.has(pipelineId)) continue;
    if (input.now.getTime() <= expectedSlot.getTime() + grace) continue;
    const observed = input.rows.some(
      (row) =>
        row.pipelineId === pipelineId &&
        row.triggerKind === "scheduled" &&
        row.scheduleSlot?.getTime() === expectedSlot.getTime(),
    );
    if (!observed) {
      alerts.push({
        id: "missed",
        pipelineId,
        detail: `no retained run for expected UTC slot ${expectedSlot.toISOString()}`,
      });
    }
  }
  for (const row of latestRows.values()) {
    if (row.status === "failed" || row.status === "empty" || row.status === "anomalous") {
      alerts.push({
        id: row.status,
        pipelineId: row.pipelineId,
        detail:
          row.status === "anomalous"
            ? `rejections ${row.rowsRejected ?? "unknown"} / read ${row.rowsRead ?? "unknown"}`
            : `latest run is ${row.status}`,
      });
    }
  }
  return alerts.sort((left, right) =>
    `${left.pipelineId}:${left.id}`.localeCompare(`${right.pipelineId}:${right.id}`),
  );
}

function rowsFromQuery(result: unknown): Array<Record<string, unknown>> {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: Array<Record<string, unknown>> }).rows ?? [])
  ) as Array<Record<string, unknown>>;
}

function asDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isFinite(date.getTime()) ? date : null;
}

export async function loadPipelineAlertRows(
  now: Date = new Date(),
): Promise<PipelineAlertRow[]> {
  const since = new Date(now.getTime() - 370 * 24 * 60 * 60 * 1_000);
  const result = await db.execute(sql`
    SELECT DISTINCT ON (pipeline_id)
      pipeline_id, trigger_kind, schedule_slot, status, started_at, completed_at,
      rows_read, rows_written, rows_rejected
    FROM production_pipeline_runs
    WHERE started_at >= ${since}
    ORDER BY pipeline_id, started_at DESC
  `);
  return rowsFromQuery(result).flatMap((row) => {
    const startedAt = asDate(row.started_at);
    if (!startedAt) return [];
    return [{
      pipelineId: String(row.pipeline_id),
      triggerKind: String(row.trigger_kind) as PipelineTriggerKind,
      scheduleSlot: asDate(row.schedule_slot),
      status: String(row.status) as PipelineRunStatus,
      startedAt,
      completedAt: asDate(row.completed_at),
      rowsRead: nonNegativeInteger(row.rows_read),
      rowsWritten: nonNegativeInteger(row.rows_written),
      rowsRejected: nonNegativeInteger(row.rows_rejected),
    }];
  });
}
