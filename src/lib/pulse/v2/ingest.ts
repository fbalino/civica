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
  /** Set when the connector raised. Other connectors continue. */
  error?: string;
}

export interface IngestSummary {
  reports: ConnectorReport[];
  totalFetched: number;
  totalInserted: number;
  totalSkipped: number;
  totalUnmatched: number;
}

export async function ingestPulseV2(db: Db): Promise<IngestSummary> {
  const map = await buildJurisdictionMap(db);
  const reports: ConnectorReport[] = [];

  async function runOne<R extends {
    rows: { sourceId?: string; sourceType?: string }[];
    fetched: number;
    unmatchedCountry: number;
  }>(
    source: string,
    fetcher: () => Promise<R>
  ) {
    try {
      const r = await fetcher();
      let upsert: UpsertResult = {
        inserted: 0,
        skippedDuplicate: 0,
        sourcesStamped: [],
      };
      if (r.rows.length) {
        // Cast through unknown — each connector emits well-typed
        // RawEventInput already; the constraint above is a lower bound.
        upsert = await upsertRawEvents(
          db,
          r.rows as unknown as Parameters<typeof upsertRawEvents>[1]
        );
      }
      reports.push({
        source,
        fetched: r.fetched,
        inserted: upsert.inserted,
        skippedDuplicate: upsert.skippedDuplicate,
        unmatchedCountry: r.unmatchedCountry,
      });
    } catch (err) {
      console.error(`[ingest:${source}] failed:`, err);
      reports.push({
        source,
        fetched: 0,
        inserted: 0,
        skippedDuplicate: 0,
        unmatchedCountry: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Specialist feeds (run in parallel — independent HTTP fetches)
  await Promise.all([
    runOne("civicus", () => fetchCivicus(map)),
    runOne("rsf", () => fetchRsf(map)),
    runOne("hrw_amnesty", () => fetchHrwAmnesty(map)),
    runOne("ipu", () => fetchIpuActions(map)),
    runOne("acled", () =>
      fetchAcled(map).then((r) => ({
        rows: r.rows,
        fetched: r.fetched,
        unmatchedCountry: r.unmatchedCountry,
      }))
    ),
    runOne("vdem_pulse", () =>
      fetchVdemPulse(map).then((r) => ({
        rows: r.rows,
        fetched: r.fetched,
        unmatchedCountry: 0,
      }))
    ),
  ]);

  // News feeds
  await Promise.all([
    runOne("gdelt", () => fetchGdelt(map)),
    runOne("reuters_ap", () => fetchReutersAp(map)),
  ]);

  const totalFetched = reports.reduce((a, r) => a + r.fetched, 0);
  const totalInserted = reports.reduce((a, r) => a + r.inserted, 0);
  const totalSkipped = reports.reduce((a, r) => a + r.skippedDuplicate, 0);
  const totalUnmatched = reports.reduce((a, r) => a + r.unmatchedCountry, 0);

  return {
    reports,
    totalFetched,
    totalInserted,
    totalSkipped,
    totalUnmatched,
  };
}
