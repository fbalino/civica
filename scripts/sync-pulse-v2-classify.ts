/**
 * Phase 5.5 — Pulse v2 classifier runner.
 *
 * Pulls clusters that don't yet have pulse_events_v2 rows and runs
 * each through the multi-run classifier. Run after pulse:v2:cluster.
 *
 * Usage:
 *   npm run pulse:v2:classify
 *   npm run pulse:v2:classify -- --limit 50
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { classifyClusters } from "../src/lib/pulse/v2/classify";

async function main() {
  const limitArg = process.argv.find((a) => a === "--limit");
  const limit = limitArg
    ? parseInt(process.argv[process.argv.indexOf(limitArg) + 1] ?? "200")
    : 200;

  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sqlClient, schema });

  const start = Date.now();
  const summary = await classifyClusters(db, { limit });
  const elapsedMs = Date.now() - start;

  console.log("\nClassification complete:");
  console.log(`  clusters examined:   ${summary.clustersExamined}`);
  console.log(`  classified:          ${summary.classified}`);
  console.log(`    auto-published:    ${summary.publishedAuto}`);
  console.log(`    flagged for review:${summary.flaggedForReview}`);
  console.log(`  none category:       ${summary.noneCategory}`);
  console.log(`  failed:              ${summary.failed}`);
  console.log(`  elapsed:             ${(elapsedMs / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
