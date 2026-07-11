/**
 * Phase 5.5 — Pulse v2 corroborate + score runner.
 *
 * Two-pass: first refresh corroboration confidence without substituting a
 * press-freedom score, then aggregate decayed impacts into dimensional deltas.
 *
 * Usage: npm run pulse:v2:score
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { corroborateEvents } from "../src/lib/pulse/v2/corroborate";
import { calculateDimensionalDeltas } from "../src/lib/pulse/v2/score";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sqlClient, schema });

  const start = Date.now();

  console.log("Pass 1 — corroboration confidence (context disabled)…");
  const corro = await corroborateEvents(db, { dryRun });
  console.log(`  examined: ${corro.examined}`);
  console.log(
    `  ${dryRun ? "would update" : "updated"}:  ${dryRun ? corro.planned.length : corro.updated}`,
  );
  console.log(`  avg confidence: ${corro.averageConfidence.toFixed(3)}`);

  console.log("\nPass 2 — dimensional deltas…");
  const score = await calculateDimensionalDeltas(db, { dryRun });
  console.log(`  events considered:   ${score.eventsConsidered}`);
  console.log(`  countries scored:    ${score.countriesScored}`);
  console.log(
    `  dim rows ${dryRun ? "planned" : "written"}:    ${dryRun ? score.planned.length : score.dimensionRowsWritten}`,
  );
  console.log(`  significant deltas:  ${score.significantDeltas}`);

  // Show top deltas
  const result = dryRun
    ? []
    : await db.execute(sql`
    SELECT j.name AS country, pdd.dimension, pdd.delta_value
    FROM pulse_dimensional_deltas pdd
    JOIN jurisdictions j ON j.id = pdd.jurisdiction_id
    WHERE ABS(pdd.delta_value) >= 0.5
    ORDER BY ABS(pdd.delta_value) DESC
    LIMIT 15
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
  if ((rows as unknown[]).length) {
    console.log("\nTop dimensional deltas:");
    for (const row of rows as Array<Record<string, unknown>>) {
      const v = Number(row.delta_value);
      const sign = v >= 0 ? "+" : "";
      console.log(
        `  ${row.country?.toString().padEnd(20)}  ${String(row.dimension).padEnd(20)}  ${sign}${v.toFixed(2)}`,
      );
    }
  }

  console.log(`\nElapsed: ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
