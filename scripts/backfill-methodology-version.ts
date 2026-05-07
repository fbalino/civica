/**
 * v1.0 follow-up §1.2 — per-row `country_facts.methodology_version` backfill.
 *
 * Live DB state (2026-05-06): all 25,821 rows tagged `v0.1-beta`.
 * R.23 page rewrite + R.22 vintage cadence both flipped the page-level
 * stamp to `v0.2-beta`, but the per-row field was never migrated.
 * Cosmetically harmless (resolver ignores this field) but creates a
 * citation-provenance gap — API readers see `v0.1-beta` while the
 * methodology page declares `v0.2-beta`.
 *
 * Ref: ~/civica/plan/v1.0-followup-backlog.md §1.2
 *
 * Idempotent — WHERE clause limits to rows still on `v0.1-beta`.
 * Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/backfill-methodology-version.ts
 *   npx tsx scripts/backfill-methodology-version.ts --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { countryFacts } from "../src/lib/db/schema";

const OLD_VERSION = "v0.1-beta";
const NEW_VERSION = "v0.2-beta";

interface CliArgs {
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  return { dryRun: process.argv.slice(2).includes("--dry-run") };
}

async function main() {
  const { dryRun } = parseArgs();
  console.log(
    `§1.2 methodology_version backfill: '${OLD_VERSION}' → '${NEW_VERSION}'${dryRun ? " (DRY RUN)" : ""}`,
  );

  // ── Pre-backfill count ─────────────────────────────────────
  const beforeRows: Array<{ n: number }> = (
    await db.execute(sql`
      SELECT COUNT(*)::int AS n
      FROM country_facts
      WHERE methodology_version = ${OLD_VERSION}
    `)
  ).rows as Array<{ n: number }>;
  const targetCount = beforeRows[0]?.n ?? 0;

  console.log(`  Rows tagged '${OLD_VERSION}': ${targetCount}`);

  if (!dryRun && targetCount > 0) {
    await db
      .update(countryFacts)
      .set({ methodologyVersion: NEW_VERSION })
      .where(sql`${countryFacts.methodologyVersion} = ${OLD_VERSION}`);
    console.log(`  Updated ${targetCount} rows to '${NEW_VERSION}'.`);
  }

  // ── Post-backfill verification ─────────────────────────────
  const verifyRows: Array<{ methodology_version: string; n: number }> = (
    await db.execute(sql`
      SELECT methodology_version, COUNT(*)::int AS n
      FROM country_facts
      GROUP BY methodology_version
      ORDER BY methodology_version
    `)
  ).rows as Array<{ methodology_version: string; n: number }>;

  const totalRows = verifyRows.reduce((sum, r) => sum + r.n, 0);
  const v02Rows = verifyRows.find((r) => r.methodology_version === NEW_VERSION)?.n ?? 0;
  const v01Rows = verifyRows.find((r) => r.methodology_version === OLD_VERSION)?.n ?? 0;

  console.log("\n=== Post-backfill state ===");
  for (const r of verifyRows) {
    console.log(`  ${r.methodology_version}: ${r.n} rows`);
  }
  console.log(`  Total rows: ${totalRows}`);

  if (!dryRun) {
    if (v01Rows === 0 && v02Rows === totalRows) {
      console.log(
        `\n✓ 100% coverage — all ${totalRows} rows tagged '${NEW_VERSION}'.`,
      );
    } else {
      console.error(
        `\n✗ Coverage gap — ${v01Rows} rows still on '${OLD_VERSION}'.`,
      );
      process.exit(1);
    }
  } else {
    console.log(
      `\n(DRY RUN — no rows updated. Would migrate ${targetCount} rows.)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
