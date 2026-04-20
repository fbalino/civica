import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql });

async function main() {
  console.log("=== Cleaning up bad enrichment data ===\n");

  // Remove terms for offices with bad types (deputy_head, cabinet, legislative_leader, judicial_leader)
  const badTypes = ["deputy_head", "cabinet", "legislative_leader", "judicial_leader"];

  for (const officeType of badTypes) {
    const result = await db.execute(sql`
      DELETE FROM terms
      WHERE office_id IN (
        SELECT id FROM offices WHERE office_type = ${officeType}
      )
    `);
    console.log(`  Deleted terms for ${officeType} offices: ${result.rowCount ?? 0}`);
  }

  // Remove bad offices
  for (const officeType of badTypes) {
    const result = await db.execute(sql`
      DELETE FROM offices WHERE office_type = ${officeType}
    `);
    console.log(`  Deleted ${officeType} offices: ${result.rowCount ?? 0}`);
  }

  // Remove judicial bodies that were added (they have no existing offices now)
  const result = await db.execute(sql`
    DELETE FROM government_bodies
    WHERE branch = 'judicial'
    AND id NOT IN (SELECT DISTINCT body_id FROM offices)
  `);
  console.log(`  Deleted empty judicial bodies: ${result.rowCount ?? 0}`);

  // Clean up orphan persons (no terms)
  const orphans = await db.execute(sql`
    DELETE FROM persons
    WHERE id NOT IN (SELECT DISTINCT person_id FROM terms)
  `);
  console.log(`  Deleted orphan persons: ${orphans.rowCount ?? 0}`);

  console.log("\n=== Cleanup complete ===");
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
