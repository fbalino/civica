/**
 * Phase R.22 — one-shot backfill for CIA + Wikidata
 * `country_facts.upstream_vintage_label` coverage gaps.
 *
 * Live DB probe (2026-05-05) found:
 *
 *   - `cia_factbook` rows: 10,700 active. 8,165 NULL labels across
 *     26 fact-keys (the original Phase F.0 / F.1 ingestion that
 *     pre-dates the column). The 2,535 labelled rows already use
 *     `'CIA Factbook 2026-01-frozen'` — the same string we stamp
 *     on the NULLs.
 *
 *   - `wikidata` rows: 1,264 active. 0 labels — Wikidata's
 *     claim-level cadence has no upstream-published vintage
 *     identifier. We stamp a derived snapshot-at-sync-time label
 *     `"Wikidata YYYY-MM snapshot"` based on the row's
 *     `retrieved_at` quarter (resolution v1.0 § 2b).
 *
 * Idempotent — re-runs only update rows where
 * `upstream_vintage_label IS NULL`. Safe to run multiple times.
 *
 * Methodology: ~/civica/plan/vintage-cadence-resolution-v1.md § 2b
 *
 * Usage:
 *   npx tsx scripts/backfill-upstream-vintage-labels.ts
 *   npx tsx scripts/backfill-upstream-vintage-labels.ts --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { countryFacts } from "../src/lib/db/schema";

const CIA_LABEL = "CIA Factbook 2026-01-frozen";

interface CliArgs {
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  return { dryRun: process.argv.slice(2).includes("--dry-run") };
}

async function main() {
  const { dryRun } = parseArgs();
  console.log(
    `R.22 upstream_vintage_label backfill${dryRun ? " (DRY RUN)" : ""}`,
  );

  // ── CIA ──────────────────────────────────────────────────────
  const ciaCount: Array<{ n: number }> = (await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM country_facts
    WHERE source_id = 'cia_factbook'
      AND status = 'active'
      AND upstream_vintage_label IS NULL
  `)).rows as Array<{ n: number }>;
  const ciaTarget = ciaCount[0]?.n ?? 0;

  console.log(`  CIA NULL-label active rows to backfill: ${ciaTarget}`);

  if (!dryRun && ciaTarget > 0) {
    await db
      .update(countryFacts)
      .set({ upstreamVintageLabel: CIA_LABEL })
      .where(sql`
        ${countryFacts.sourceId} = 'cia_factbook'
        AND ${countryFacts.status} = 'active'
        AND ${countryFacts.upstreamVintageLabel} IS NULL
      `);
    console.log(`  Stamped CIA rows with: '${CIA_LABEL}'`);
  }

  // ── Wikidata ─────────────────────────────────────────────────
  // Use a single SQL UPDATE with date_trunc on retrieved_at to
  // construct the per-row label without an in-process loop. The
  // expression `to_char(date_trunc('month', retrieved_at), 'YYYY-MM')`
  // produces `"2026-05"` from a 2026-05-04 timestamp.
  const wdCount: Array<{ n: number }> = (await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM country_facts
    WHERE source_id = 'wikidata'
      AND status = 'active'
      AND upstream_vintage_label IS NULL
  `)).rows as Array<{ n: number }>;
  const wdTarget = wdCount[0]?.n ?? 0;

  console.log(`  Wikidata NULL-label active rows to backfill: ${wdTarget}`);

  if (!dryRun && wdTarget > 0) {
    // Build the label inline: "Wikidata <YYYY-MM> snapshot".
    await db.execute(sql`
      UPDATE country_facts
      SET upstream_vintage_label =
        'Wikidata ' || to_char(date_trunc('month', retrieved_at), 'YYYY-MM') || ' snapshot'
      WHERE source_id = 'wikidata'
        AND status = 'active'
        AND upstream_vintage_label IS NULL
    `);
    console.log(
      `  Stamped Wikidata rows with derived 'Wikidata YYYY-MM snapshot' labels.`,
    );
  }

  // ── Verification ─────────────────────────────────────────────
  const verify: Array<{
    source_id: string;
    null_count: number;
    distinct_labels: number;
  }> = (await db.execute(sql`
    SELECT source_id,
           SUM(CASE WHEN upstream_vintage_label IS NULL THEN 1 ELSE 0 END)::int AS null_count,
           COUNT(DISTINCT upstream_vintage_label)::int AS distinct_labels
    FROM country_facts
    WHERE source_id IN ('cia_factbook', 'wikidata')
      AND status = 'active'
    GROUP BY source_id
    ORDER BY source_id
  `)).rows as Array<{
    source_id: string;
    null_count: number;
    distinct_labels: number;
  }>;

  console.log("\n=== Post-backfill state ===");
  for (const r of verify) {
    console.log(
      `  ${r.source_id}: NULL=${r.null_count}, distinct labels=${r.distinct_labels}`,
    );
  }

  if (dryRun) {
    console.log("\n(DRY RUN — no rows updated)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
