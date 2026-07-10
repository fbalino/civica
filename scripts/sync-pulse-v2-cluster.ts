/**
 * Phase 5.5 — Pulse v2 clustering runner.
 *
 * Pulls unclustered raw_events rows and groups by country + 48h window.
 * It uses embedding cosine similarity when available and the declared lexical
 * Jaccard fallback otherwise. Run after sync-pulse-v2-ingest.
 *
 * Usage:
 *   npm run pulse:v2:cluster           # run on all unclustered rows
 *   npm run pulse:v2:cluster -- --limit 100
 *   npm run pulse:v2:cluster -- --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { runClustering } from "../src/lib/pulse/v2/cluster";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit"));
  const limit = limitArg
    ? parseInt(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1] ?? "1000")
    : 1000;

  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sqlClient, schema });

  const start = Date.now();
  const summary = await runClustering(db, { limit, dryRun });
  const elapsedMs = Date.now() - start;

  console.log("\nClustering complete:");
  console.log(`  mode:                 ${summary.dryRun ? "DRY RUN — zero writes" : "apply"}`);
  console.log(`  candidates:           ${summary.candidates}`);
  console.log(`  clustered:            ${summary.clustered}`);
  console.log(`  clusters created:     ${summary.clustersCreated}`);
  console.log(`  country buckets:      ${summary.countryBuckets}`);
  console.log(`  multi-source groups:  ${summary.multiSourceClusters}`);
  console.log(`  elapsed:              ${(elapsedMs / 1000).toFixed(1)}s`);

  // Sample a few clusters for visual confirmation
  if (dryRun) return;
  const result = await db.execute(sql`
    SELECT r.cluster_id, j.name AS country, r.title, r.source_id AS source
    FROM raw_events r
    LEFT JOIN jurisdictions j ON j.id = r.jurisdiction_id
    WHERE r.cluster_id IS NOT NULL
    ORDER BY r.clustered_at DESC NULLS LAST, r.cluster_id
    LIMIT 12
  `);
  const rows = (result as unknown as {
    rows?: Array<{
      cluster_id: string;
      country: string | null;
      title: string;
      source: string;
    }>;
  }).rows ?? (result as unknown as Array<{
    cluster_id: string;
    country: string | null;
    title: string;
    source: string;
  }>);
  if (rows.length) {
    console.log("\nSample clusters (most recent):");
    let lastCluster = "";
    for (const row of rows) {
      const marker = row.cluster_id === lastCluster ? "  " : "▸ ";
      console.log(
        `  ${marker}[${row.source}] ${row.country ?? "(no country)"} — ${row.title.slice(0, 70)}`
      );
      lastCluster = row.cluster_id;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
