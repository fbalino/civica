/**
 * Phase 5.5 — Pulse v2 ingest orchestrator.
 *
 * Calls every connector in sequence (parallel where possible) and
 * batches their output into the `raw_events` staging table. Eligible source
 * freshness is collected per connector, then stamped once only after every
 * connector in the aggregate run succeeds.
 *
 * Each connector is wrapped in a try/catch so every source gets a report.
 * Any configured connector failure blocks aggregate publication, while
 * connectors explicitly gated off by absent configuration return an honest
 * empty success.
 */

import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { createServerlessSql } from "@/lib/db";
import { buildJurisdictionMap } from "./country-resolver";
import {
  upsertRawEvents,
  type UpsertRawEventsOptions,
  type UpsertResult,
} from "./upsert";
import { fetchCivicus } from "./sources/civicus";
import { fetchRsf } from "./sources/rsf";
import { fetchAmnesty, fetchHrw } from "./sources/hrw-amnesty";
import { fetchIpuActions } from "./sources/ipu-actions";
import { fetchAcled } from "./sources/acled";
import { fetchVdemPulse } from "./sources/vdem-pulse";
import { fetchGdelt } from "./sources/gdelt";
import { fetchReutersAp } from "./sources/reuters-ap";
import type { RawEventInput } from "./types";
import type { JurisdictionMap } from "./country-resolver";
import { CURRENT_PULSE_RUNTIME_METHOD } from "./runtime-contract";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  preparePulsePipelineRun,
  pulseCronStageRunId,
  type PulsePipelineRunRef,
} from "./pipeline-version";

export function createDb() {
  const sql = createServerlessSql(process.env.DATABASE_URL!);
  return drizzle({ client: sql, schema });
}
export type Db = ReturnType<typeof createDb>;

export interface ConnectorReport {
  source: string;
  fetched: number;
  inserted: number;
  skippedDuplicate: number;
  unmatchedCountry: number;
  /** Rows this connector would submit to the writer. Equals inserted only
   * when every submitted row is new; remains populated during dry runs. */
  wouldWrite: number;
  /** Set when the connector raised. Other connectors continue. */
  error?: string;
}

export interface IngestSummary {
  runId: string;
  versionKey: string;
  reports: ConnectorReport[];
  totalFetched: number;
  totalInserted: number;
  totalSkipped: number;
  totalUnmatched: number;
  totalWouldWrite: number;
  /** Sources stamped after the complete connector batch succeeded. */
  sourcesStamped: string[];
  dryRun: boolean;
  /** True when a retry reused an already-completed deterministic stage run. */
  reused: boolean;
}

export interface PulseConnectorResult {
  rows: RawEventInput[];
  fetched: number;
  unmatchedCountry: number;
}

export interface PulseConnectorJob {
  source: string;
  fetcher: () => Promise<PulseConnectorResult>;
}

export interface PulseIngestOptions {
  dryRun?: boolean;
  /** Fixture seam. Production callers omit this and use the live connectors. */
  jobs?: readonly PulseConnectorJob[];
  jurisdictionMap?: JurisdictionMap;
  writeRows?: (
    db: Db,
    rows: RawEventInput[],
    ingestRunId: string,
    options: UpsertRawEventsOptions,
  ) => Promise<UpsertResult>;
  /** Fixture/replay seam. Production creates and persists a fresh run. */
  runRef?: PulsePipelineRunRef;
  /** Fixture/diagnostic fail-closed controls; production preserves partial
   * connector availability unless the caller explicitly requests strictness. */
  failOnConnectorError?: boolean;
  requireNonEmpty?: boolean;
  /** Stable identity injected by the authenticated cron boundary. */
  cronExecutionKey?: string;
  /** Fixture seam for exercising the production pipeline-run lifecycle. */
  persistRun?: boolean;
}

export const PULSE_CONNECTOR_METRICS = [
  "fetched",
  "wouldWrite",
  "inserted",
  "skippedDuplicate",
  "unmatchedCountry",
  "failed",
] as const;

export type PulseConnectorMetric = (typeof PULSE_CONNECTOR_METRICS)[number];

export function pulseConnectorMetricKey(
  connectorId: string,
  metric: PulseConnectorMetric,
): string {
  if (!/^[a-z0-9_-]+$/.test(connectorId)) {
    throw new Error(
      `Invalid Pulse connector id for run metrics: ${connectorId}`,
    );
  }
  return `connector.${connectorId}.${metric}`;
}

export function connectorReportsToRunCounts(
  reports: readonly ConnectorReport[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const report of reports) {
    counts[pulseConnectorMetricKey(report.source, "fetched")] = report.fetched;
    counts[pulseConnectorMetricKey(report.source, "wouldWrite")] =
      report.wouldWrite;
    counts[pulseConnectorMetricKey(report.source, "inserted")] =
      report.inserted;
    counts[pulseConnectorMetricKey(report.source, "skippedDuplicate")] =
      report.skippedDuplicate;
    counts[pulseConnectorMetricKey(report.source, "unmatchedCountry")] =
      report.unmatchedCountry;
    counts[pulseConnectorMetricKey(report.source, "failed")] =
      report.error !== undefined ? 1 : 0;
  }
  return counts;
}

function completedRunSummary(
  run: PulsePipelineRunRef,
  counts: Record<string, number>,
): IngestSummary {
  const connectorIds = Object.keys(counts)
    .map((key) => /^connector\.([a-z0-9_-]+)\.fetched$/.exec(key)?.[1])
    .filter((value): value is string => value !== undefined)
    .sort();
  const count = (key: string) => {
    const value = counts[key];
    return Number.isFinite(value) ? value : 0;
  };
  return {
    runId: run.id,
    versionKey: run.versionKey,
    reports: connectorIds.map((source) => ({
      source,
      fetched: count(pulseConnectorMetricKey(source, "fetched")),
      inserted: count(pulseConnectorMetricKey(source, "inserted")),
      skippedDuplicate: count(
        pulseConnectorMetricKey(source, "skippedDuplicate"),
      ),
      unmatchedCountry: count(
        pulseConnectorMetricKey(source, "unmatchedCountry"),
      ),
      wouldWrite: count(pulseConnectorMetricKey(source, "wouldWrite")),
    })),
    totalFetched: count("fetched"),
    totalInserted: count("inserted"),
    totalSkipped: count("skipped"),
    totalUnmatched: count("unmatched"),
    totalWouldWrite: count("wouldWrite"),
    // Exact stamped source ids are not pipeline-run counts. The completed run
    // is already durable, so a retry deliberately performs no freshness work.
    sourcesStamped: [],
    dryRun: false,
    reused: true,
  };
}

function liveConnectorJobs(map: JurisdictionMap): PulseConnectorJob[] {
  return [
    { source: "civicus", fetcher: () => fetchCivicus(map) },
    { source: "rsf", fetcher: () => fetchRsf(map) },
    { source: "amnesty", fetcher: () => fetchAmnesty(map) },
    { source: "hrw", fetcher: () => fetchHrw(map) },
    { source: "ipu", fetcher: () => fetchIpuActions(map) },
    {
      source: "acled",
      fetcher: () => fetchAcled(map),
    },
    {
      source: "vdem_pulse",
      fetcher: () =>
        fetchVdemPulse(map).then((result) => ({
          rows: result.rows,
          fetched: result.fetched,
          unmatchedCountry: 0,
        })),
    },
    { source: "gdelt", fetcher: () => fetchGdelt(map) },
    { source: "reuters_ap", fetcher: () => fetchReutersAp(map) },
  ];
}

export async function ingestPulseV2(
  db: Db,
  options: PulseIngestOptions = {},
): Promise<IngestSummary> {
  const run =
    options.runRef ??
    createPulsePipelineRunRef("ingest", {
      id: options.cronExecutionKey
        ? pulseCronStageRunId(options.cronExecutionKey, "ingest")
        : undefined,
      sourceIds: CURRENT_PULSE_RUNTIME_METHOD.feeds.observedEvidence.sourceIds,
    });
  const persistRun =
    options.persistRun ?? (!options.dryRun && !options.jobs && !options.runRef);
  if (persistRun) {
    const prepared = await preparePulsePipelineRun(db, run);
    if (prepared.state === "completed") {
      return completedRunSummary(run, prepared.counts);
    }
  }
  const map = options.jurisdictionMap ?? (await buildJurisdictionMap(db));
  const jobs = options.jobs ?? liveConnectorJobs(map);
  const writeRows = options.writeRows ?? upsertRawEvents;
  // Fetch every connector before the first raw-event/outcome/freshness write.
  // Promise.all preserves job order while still allowing the network work to
  // run concurrently, and failures are collected instead of short-circuiting.
  const fetched = await Promise.all(
    jobs.map(async (job) => {
      try {
        const result = await job.fetcher();
        if (result.fetched > 0 && result.rows.length === 0) {
          const error =
            `Fetched ${result.fetched} upstream record${result.fetched === 1 ? "" : "s"} ` +
            "but produced no usable event rows";
          console.error(`[ingest:${job.source}] failed: ${error}`);
          return {
            job,
            result: null,
            report: {
              source: job.source,
              fetched: result.fetched,
              inserted: 0,
              skippedDuplicate: 0,
              unmatchedCountry: result.unmatchedCountry,
              wouldWrite: 0,
              error,
            } satisfies ConnectorReport,
          };
        }
        return {
          job,
          result,
          report: {
            source: job.source,
            fetched: result.fetched,
            inserted: 0,
            skippedDuplicate: 0,
            unmatchedCountry: result.unmatchedCountry,
            wouldWrite: result.rows.length,
          } satisfies ConnectorReport,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ingest:${job.source}] failed:`, err);
        return {
          job,
          result: null,
          report: {
            source: job.source,
            fetched: 0,
            inserted: 0,
            skippedDuplicate: 0,
            unmatchedCountry: 0,
            wouldWrite: 0,
            error: message,
          } satisfies ConnectorReport,
        };
      }
    }),
  );
  const reports = fetched.map(({ report }) => report);

  const totals = () => ({
    fetched: reports.reduce((sum, report) => sum + report.fetched, 0),
    inserted: reports.reduce((sum, report) => sum + report.inserted, 0),
    skipped: reports.reduce((sum, report) => sum + report.skippedDuplicate, 0),
    unmatched: reports.reduce(
      (sum, report) => sum + report.unmatchedCountry,
      0,
    ),
    wouldWrite: reports.reduce((sum, report) => sum + report.wouldWrite, 0),
  });
  const initialTotals = totals();
  const runCounts = {
    ...initialTotals,
    ...connectorReportsToRunCounts(reports),
  };
  const failures = reports
    .filter(({ error }) => error !== undefined)
    .map(({ source, error }) => ({ component: source, message: error! }));

  // Partial-availability policy (2026-08-17 ingest restoration): a failed
  // connector never blocks the successful subset. Nine heterogeneous external
  // feeds mean at least one is broken on most real days, so all-or-nothing
  // publication starved ingestion entirely. Failed connectors still fail
  // closed individually — they contribute no rows, and the atomic writer
  // stamps freshness only for sources that actually gained a row — while the
  // run finalizes as 'partial' with every failure recorded. Finalization no
  // longer skips cron-keyed runs: a terminal 'partial' beats a run row stuck
  // at 'running' forever, and the cron boundary's fenced idempotency ledger
  // already absorbs duplicate scheduled deliveries.
  if (failures.length > 0 && options.failOnConnectorError) {
    if (persistRun) {
      await finishPulsePipelineRun(db, run.id, {
        status: "partial",
        counts: runCounts,
        failures,
      });
    }
    const first = failures[0];
    throw new Error(
      `Pulse connector ${first.component} failed: ${first.message}`,
    );
  }

  if ((options.requireNonEmpty ?? true) && initialTotals.wouldWrite === 0) {
    if (failures.length > 0) {
      // Nothing usable arrived and at least one connector failed: record the
      // partial run and report honestly instead of publishing.
      if (persistRun) {
        await finishPulsePipelineRun(db, run.id, {
          status: "partial",
          counts: runCounts,
          failures,
        });
      }
      reports.sort((left, right) => left.source.localeCompare(right.source));
      return {
        runId: run.id,
        versionKey: run.versionKey,
        reports,
        totalFetched: initialTotals.fetched,
        totalInserted: 0,
        totalSkipped: 0,
        totalUnmatched: initialTotals.unmatched,
        totalWouldWrite: 0,
        sourcesStamped: [],
        dryRun: options.dryRun ?? false,
        reused: false,
      };
    }
    if (persistRun) {
      await finishPulsePipelineRun(db, run.id, {
        status: "failed",
        counts: runCounts,
        failures: [],
      });
    }
    throw new Error("Pulse ingestion fixture/upstream returned no usable rows");
  }

  if (options.dryRun) {
    reports.sort((left, right) => left.source.localeCompare(right.source));
    return {
      runId: run.id,
      versionKey: run.versionKey,
      reports,
      totalFetched: initialTotals.fetched,
      totalInserted: 0,
      totalSkipped: 0,
      totalUnmatched: initialTotals.unmatched,
      totalWouldWrite: initialTotals.wouldWrite,
      sourcesStamped: [],
      dryRun: true,
      reused: false,
    };
  }

  const allRows: RawEventInput[] = [];
  const connectorIds: string[] = [];
  for (const item of fetched) {
    if (!item.result) continue;
    allRows.push(...item.result.rows);
    connectorIds.push(...item.result.rows.map(() => item.job.source));
  }

  // This is the sole publish call for the aggregate run. The default writer
  // atomically commits raw rows, duplicate outcomes, source freshness, and the
  // production pipeline-run completion.
  const upsert: UpsertResult = await writeRows(db, allRows, run.id, {
    connectorIds,
    finalizeRun: persistRun
      ? {
          counts: runCounts,
          status: failures.length > 0 ? "partial" : "completed",
          failures,
        }
      : undefined,
  });

  let outcomeOffset = 0;
  for (const item of fetched) {
    if (!item.result) continue;
    const rowOutcomes = upsert.rowOutcomes.slice(
      outcomeOffset,
      outcomeOffset + item.result.rows.length,
    );
    outcomeOffset += item.result.rows.length;
    item.report.inserted = rowOutcomes.filter(
      (outcome) => outcome === "inserted",
    ).length;
    item.report.skippedDuplicate = rowOutcomes.filter(
      (outcome) => outcome === "duplicate",
    ).length;
  }

  reports.sort((left, right) => left.source.localeCompare(right.source));
  const finalTotals = totals();
  return {
    runId: run.id,
    versionKey: run.versionKey,
    reports,
    totalFetched: finalTotals.fetched,
    totalInserted: upsert.inserted,
    totalSkipped: upsert.skippedDuplicate,
    totalUnmatched: finalTotals.unmatched,
    totalWouldWrite: finalTotals.wouldWrite,
    sourcesStamped: upsert.sourcesStamped,
    dryRun: false,
    reused: false,
  };
}
