import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";

async function main() {
  const rows = await db.execute(sql`
    SELECT to_regclass('government_taxonomies') AS exists
  `);
  const exists = (rows.rows[0]?.exists as string | null) !== null;
  console.log(`government_taxonomies table exists: ${exists}`);

  if (!exists) {
    console.log("→ Migration 0003_soft_shinko_yamashiro has not been applied to this DB.");
    console.log("→ Run: npm run db:push   (or equivalent)");
    return;
  }

  const count = await db.execute(sql`SELECT COUNT(*)::int AS n FROM government_taxonomies`);
  const n = count.rows[0]?.n as number;
  console.log(`government_taxonomies row count: ${n}`);

  if (n === 0) {
    console.log("→ Table is empty. Run: npm run sync:government-taxonomy");
    return;
  }

  const versions = await db.execute(sql`
    SELECT taxonomy_version, COUNT(*)::int AS n
    FROM government_taxonomies
    GROUP BY taxonomy_version
    ORDER BY taxonomy_version DESC
  `);
  console.log("By taxonomy_version:");
  for (const row of versions.rows) {
    console.log(`  ${row.taxonomy_version}: ${row.n} rows`);
  }

  const regimeCoverage = await db.execute(sql`
    SELECT COUNT(*)::int AS with_regime,
           COUNT(*) FILTER (WHERE structural_family IS NOT NULL)::int AS with_structural
    FROM government_taxonomies
  `);
  const r = regimeCoverage.rows[0];
  console.log(`  with regime_type_cgv: ${r?.with_regime} (of ${n})`);
  console.log(`  with structural_family: ${r?.with_structural} (of ${n})`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});
