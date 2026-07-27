/**
 * Phase 5.5 — Pulse v2 clustering runner.
 *
 * Pulls unclustered raw_events rows and compares normalized event identities
 * with the incoming batch and recent persisted incidents inside a 48-hour
 * window. Exact identities can attach automatically; semantic and strong
 * lexical matches become retained collision candidates. Ingest-time country
 * is diagnostic, not a partition.
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
import { inArray, sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { runClustering } from "../src/lib/pulse/v2/cluster";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  startPulsePipelineRun,
} from "../src/lib/pulse/v2/pipeline-version";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit"));
  const limit = limitArg
    ? parseInt(
        limitArg.split("=")[1] ??
          process.argv[process.argv.indexOf(limitArg) + 1] ??
          "1000",
      )
    : 1000;

  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sqlClient, schema });

  const start = Date.now();
  const runRef = createPulsePipelineRunRef("cluster");
  if (!dryRun) await startPulsePipelineRun(db, runRef);
  let summary;
  try {
    summary = await runClustering(db, { limit, dryRun, runRef });
    if (!dryRun) {
      await finishPulsePipelineRun(db, runRef.id, {
        status: "completed",
        counts: {
          candidates: summary.candidates,
          clustered: summary.clustered,
          clustersCreated: summary.clustersCreated,
          matchedPersistedIncidents: summary.matchedPersistedIncidents,
          collisionCandidates: summary.collisionCandidates,
        },
      });
    }
  } catch (error) {
    if (!dryRun) {
      await finishPulsePipelineRun(db, runRef.id, {
        status: "failed",
        counts: { candidates: 0, clustered: 0 },
        failures: [
          {
            component: "cluster",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      });
    }
    throw error;
  }
  const elapsedMs = Date.now() - start;

  console.log("\nClustering complete:");
  console.log(
    `  mode:                 ${summary.dryRun ? "DRY RUN — zero writes" : "apply"}`,
  );
  console.log(`  candidates:           ${summary.candidates}`);
  console.log(`  clustered:            ${summary.clustered}`);
  console.log(`  clusters created:     ${summary.clustersCreated}`);
  console.log(`  persisted matches:    ${summary.matchedPersistedIncidents}`);
  console.log(`  collision candidates: ${summary.collisionCandidates}`);
  console.log(`  candidate pairs:      ${summary.comparisonPairs}`);
  console.log(`  multi-source groups:  ${summary.multiSourceClusters}`);
  console.log(`  source-family groups: ${summary.multiSourceFamilyClusters}`);
  console.log(`  multilingual groups: ${summary.multilingualClusters}`);
  console.log(`  mixed-country groups: ${summary.crossJurisdictionClusters}`);
  console.log(`  elapsed:              ${(elapsedMs / 1000).toFixed(1)}s`);

  // A dry run may print a bounded local audit sample, but never persists it.
  if (dryRun) {
    const multiMemberIds = summary.assignments
      .filter(({ memberIds }) => memberIds.length > 1)
      .flatMap(({ memberIds }) => memberIds)
      .slice(0, 24);
    if (multiMemberIds.length) {
      const rows = await db
        .select({
          source_id: schema.rawEvents.sourceId,
          title: schema.rawEvents.title,
        })
        .from(schema.rawEvents)
        .where(inArray(schema.rawEvents.id, multiMemberIds))
        .orderBy(schema.rawEvents.title, schema.rawEvents.id);
      console.log("\nLocal dry-run sample (not retained):");
      for (const row of rows as Array<{ source_id: string; title: string }>) {
        console.log(`  [${row.source_id}] ${row.title.slice(0, 100)}`);
      }
    }
    return;
  }
  const result = await db.execute(sql`
    SELECT r.cluster_id, j.name AS country, r.title, r.source_id AS source
    FROM raw_events r
    LEFT JOIN jurisdictions j ON j.id = r.jurisdiction_id
    WHERE r.cluster_id IS NOT NULL
    ORDER BY r.clustered_at DESC NULLS LAST, r.cluster_id
    LIMIT 12
  `);
  const rows =
    (
      result as unknown as {
        rows?: Array<{
          cluster_id: string;
          country: string | null;
          title: string;
          source: string;
        }>;
      }
    ).rows ??
    (result as unknown as Array<{
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
        `  ${marker}[${row.source}] ${row.country ?? "(no country)"} — ${row.title.slice(0, 70)}`,
      );
      lastCluster = row.cluster_id;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
