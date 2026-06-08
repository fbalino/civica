/**
 * create-rate-limits-table — additive, idempotent setup for the durable
 * (cross-instance) rate limiter.
 *
 *   Run with:  npm run migrate:rate-limits
 *   Schema:    `rateLimits` in src/lib/db/schema.ts
 *   Consumer:  `checkDurableRateLimit()` in src/lib/api/rate-limit.ts
 *
 * Creates ONLY the new `rate_limits` table (+ its expires_at index). It
 * never touches any existing table, so it is safe to run against the live
 * Neon database directly — unlike `drizzle-kit push`, which diffs the WHOLE
 * schema and could propose changes to unrelated tables. `CREATE TABLE/INDEX
 * IF NOT EXISTS` makes every statement a no-op on re-run.
 *
 * Idempotent. Safe to re-run any number of times.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";

async function main() {
  console.log("→ Creating rate_limits table (idempotent, additive)…");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key text PRIMARY KEY,
      count integer NOT NULL DEFAULT 0,
      expires_at timestamptz NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at
      ON rate_limits (expires_at)
  `);

  // ── Verify the table exists and is queryable ──────────────────────
  const columns = (
    await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'rate_limits'
      ORDER BY ordinal_position
    `)
  ).rows as Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>;

  if (columns.length === 0) {
    console.error("✗ rate_limits table not found after creation.");
    process.exit(1);
  }

  console.log("  Columns:");
  for (const c of columns) {
    console.log(
      `    ${c.column_name} ${c.data_type}` +
        `${c.is_nullable === "NO" ? " NOT NULL" : ""}`
    );
  }

  const countRow = (
    await db.execute(sql`SELECT COUNT(*)::int AS n FROM rate_limits`)
  ).rows[0] as { n: number };

  console.log(`  Quick SELECT ok — rate_limits has ${countRow.n} row(s).`);
  console.log("✓ Done. rate_limits is ready for the durable limiter.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
