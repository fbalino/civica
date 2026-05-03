/**
 * Phase F.1 schema verification.
 *
 * Confirms the migration didn't lose data and the new columns
 * backfilled as expected.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const counts = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM country_facts) AS total_facts,
      (SELECT COUNT(*) FROM country_facts WHERE source_id = 'cia_factbook') AS cia_facts,
      (SELECT COUNT(*) FROM country_facts WHERE source_id IS NULL) AS null_source,
      (SELECT COUNT(*) FROM country_facts WHERE methodology_version = 'v0.1-beta') AS v01_beta,
      (SELECT COUNT(*) FROM country_facts WHERE status = 'active') AS active_status,
      (SELECT COUNT(*) FROM country_facts WHERE fact_group = 'B') AS group_b
  `);

  console.log("country_facts row counts:");
  console.table(counts.rows);

  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'country_facts',
        'country_fact_vintages',
        'data_disputes',
        'fact_snapshots',
        'data_facts_audit_log'
      )
    ORDER BY table_name
  `);

  console.log("\nPhase F tables present:");
  console.table(tables.rows);

  const sample = await db.execute(sql`
    SELECT
      fact_key,
      source_id,
      methodology_version,
      status,
      fact_group,
      retrieved_at IS NOT NULL AS has_retrieved_at
    FROM country_facts
    LIMIT 5
  `);

  console.log("\nSample rows after migration:");
  console.table(sample.rows);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
