/**
 * Phase 5.5 — Pulse v2 end-to-end pipeline runner.
 *
 * Runs ingest → cluster → classify → corroborate → score in one
 * pass. Useful for backfill, spot-checking, and debugging.
 *
 * Usage: npm run pulse:v2:all
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { ingestPulseV2 } from "../src/lib/pulse/v2/ingest";
import { runClustering } from "../src/lib/pulse/v2/cluster";
import { classifyClusters } from "../src/lib/pulse/v2/classify";
import { corroborateEvents } from "../src/lib/pulse/v2/corroborate";
import { calculateDimensionalDeltas } from "../src/lib/pulse/v2/score";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sqlClient, schema });

  const start = Date.now();

  console.log("\n────────  STAGE 1: INGEST  ────────");
  const ingest = await ingestPulseV2(db, { dryRun });
  console.log(
    `  ${ingest.totalFetched} fetched · ${ingest.totalInserted} inserted · ${ingest.totalSkipped} dup · ${ingest.totalUnmatched} unmatched`
  );

  console.log("\n────────  STAGE 2: CLUSTER  ────────");
  const cluster = await runClustering(db, { dryRun });
  console.log(
    `  ${cluster.candidates} candidates → ${cluster.clustersCreated} clusters · ${cluster.multiSourceClusters} multi-source`
  );

  console.log("\n────────  STAGE 3: CLASSIFY  ────────");
  const classify = await classifyClusters(db, { dryRun });
  console.log(
    `  ${classify.clustersExamined} examined · ${classify.classified} classified · ${classify.publishedAuto} auto-published · ${classify.flaggedForReview} review-flagged · ${classify.noneCategory} skipped (none) · ${classify.failed} failed`
  );

  console.log("\n────────  STAGE 4: CORROBORATE + SCORE  ────────");
  const corro = await corroborateEvents(db, { dryRun });
  const score = await calculateDimensionalDeltas(db, { dryRun });
  console.log(
    `  corroboration: ${corro.examined} events ${dryRun ? "planned" : "updated"}, avg conf ${corro.averageConfidence.toFixed(3)}`
  );
  console.log(
    `  scoring:       ${score.eventsConsidered} events × ${score.countriesScored} countries → ${score.dimensionRowsWritten} dim rows · ${score.significantDeltas} significant`
  );

  // Summary view
  const result = dryRun ? [] : await db.execute(sql`
    SELECT j.name AS country, pdd.dimension, pdd.delta_value
    FROM pulse_dimensional_deltas pdd
    JOIN jurisdictions j ON j.id = pdd.jurisdiction_id
    WHERE ABS(pdd.delta_value) >= 0.5
    ORDER BY ABS(pdd.delta_value) DESC
    LIMIT 20
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
  if ((rows as unknown[]).length) {
    console.log("\n  Top dimensional deltas:");
    for (const row of rows as Array<Record<string, unknown>>) {
      const v = Number(row.delta_value);
      const sign = v >= 0 ? "+" : "";
      console.log(
        `    ${row.country?.toString().padEnd(20)}  ${String(row.dimension).padEnd(20)}  ${sign}${v.toFixed(2)}`
      );
    }
  }

  console.log(`\n  Total elapsed: ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
