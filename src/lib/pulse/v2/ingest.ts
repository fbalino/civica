/**
 * Phase 5.5 — Pulse v2 ingest orchestrator.
 *
 * Calls every connector in sequence (parallel where possible) and
 * batches their output into the `raw_events` staging table. Stamps
 * `sources.last_sync_at` for each source that returned ≥1 row.
 *
 * Each connector is wrapped in a try/catch so one failing source
 * never blocks the others. Connectors that are gated on env vars
 * (ACLED) gracefully return empty without raising.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { buildJurisdictionMap } from "./country-resolver";
import { upsertRawEvents, type UpsertResult } from "./upsert";
import { fetchCivicus } from "./sources/civicus";
import { fetchRsf } from "./sources/rsf";
import { fetchHrwAmnesty } from "./sources/hrw-amnesty";
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
  startPulsePipelineRun,
  type PulsePipelineRunRef,
} from "./pipeline-version";

export function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
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
  dryRun: boolean;
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
  ) => Promise<UpsertResult>;
  /** Fixture/replay seam. Production creates and persists a fresh run. */
  runRef?: PulsePipelineRunRef;
  /** Fixture/diagnostic fail-closed controls; production preserves partial
   * connector availability unless the caller explicitly requests strictness. */
  failOnConnectorError?: boolean;
  requireNonEmpty?: boolean;
}

function liveConnectorJobs(map: JurisdictionMap): PulseConnectorJob[] {
  return [
    { source: "civicus", fetcher: () => fetchCivicus(map) },
    { source: "rsf", fetcher: () => fetchRsf(map) },
    { source: "hrw_amnesty", fetcher: () => fetchHrwAmnesty(map) },
    { source: "ipu", fetcher: () => fetchIpuActions(map) },
    {
      source: "acled",
      fetcher: () =>
        fetchAcled(map).then((result) => ({
          rows: result.rows,
          fetched: result.fetched,
          unmatchedCountry: result.unmatchedCountry,
        })),
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
  const map = options.jurisdictionMap ?? (await buildJurisdictionMap(db));
  const jobs = options.jobs ?? liveConnectorJobs(map);
  const writeRows = options.writeRows ?? upsertRawEvents;
  const run =
    options.runRef ??
    createPulsePipelineRunRef("ingest", {
      sourceIds: CURRENT_PULSE_RUNTIME_METHOD.feeds.activeProduction.sourceIds,
    });
  const persistRun = !options.dryRun && !options.jobs && !options.runRef;
  if (persistRun) await startPulsePipelineRun(db, run);
  const reports: ConnectorReport[] = [];

  async function runOne(job: PulseConnectorJob) {
    try {
      const result = await job.fetcher();
      let upsert: UpsertResult = {
        inserted: 0,
        skippedDuplicate: 0,
        sourcesStamped: [],
      };
      if (result.rows.length && !options.dryRun) {
        upsert = await writeRows(db, result.rows, run.id);
      }
      reports.push({
        source: job.source,
        fetched: result.fetched,
        inserted: upsert.inserted,
        skippedDuplicate: upsert.skippedDuplicate,
        unmatchedCountry: result.unmatchedCountry,
        wouldWrite: result.rows.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (options.failOnConnectorError) {
        throw new Error(`Pulse connector ${job.source} failed: ${message}`);
      }
      console.error(`[ingest:${job.source}] failed:`, err);
      reports.push({
        source: job.source,
        fetched: 0,
        inserted: 0,
        skippedDuplicate: 0,
        unmatchedCountry: 0,
        wouldWrite: 0,
        error: message,
      });
    }
  }

  await Promise.all(jobs.map(runOne));

  reports.sort((left, right) => left.source.localeCompare(right.source));
  const totalFetched = reports.reduce((a, r) => a + r.fetched, 0);
  const totalInserted = reports.reduce((a, r) => a + r.inserted, 0);
  const totalSkipped = reports.reduce((a, r) => a + r.skippedDuplicate, 0);
  const totalUnmatched = reports.reduce((a, r) => a + r.unmatchedCountry, 0);
  const totalWouldWrite = reports.reduce((a, report) => a + report.wouldWrite, 0);

  if ((options.requireNonEmpty ?? true) && totalFetched === 0) {
    if (persistRun) {
      await finishPulsePipelineRun(db, run.id, {
        status: "failed",
        counts: { fetched: 0, inserted: 0 },
        failures: reports
          .filter(({ error }) => error)
          .map(({ source, error }) => ({ component: source, message: error! })),
      });
    }
    throw new Error("Pulse ingestion fixture/upstream returned no rows");
  }

  if (persistRun) {
    const failures = reports
      .filter(({ error }) => error)
      .map(({ source, error }) => ({ component: source, message: error! }));
    await finishPulsePipelineRun(db, run.id, {
      status: failures.length ? "partial" : "completed",
      counts: {
        fetched: totalFetched,
        inserted: totalInserted,
        skipped: totalSkipped,
        unmatched: totalUnmatched,
      },
      failures,
    });
  }

  return {
    runId: run.id,
    versionKey: run.versionKey,
    reports,
    totalFetched,
    totalInserted,
    totalSkipped,
    totalUnmatched,
    totalWouldWrite,
    dryRun: options.dryRun ?? false,
  };
}
