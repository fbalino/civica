/**
 * backfill-growth-methodology — populate country_facts.growth_methodology
 * for the GDP growth-rate fact-keys, labelling each publisher's row with
 * the measurement basis it reports on.
 *
 *   Dry-run (default):  npx tsx scripts/backfill-growth-methodology.ts --dry-run
 *   Apply:              npx tsx scripts/backfill-growth-methodology.ts --apply
 *   npm:               npm run backfill:growth-methodology -- --apply
 *
 * ── What this does ──
 * Different publishers report GDP growth on different measurement bases,
 * and the raw numbers are NOT directly comparable across bases:
 *
 *   - Stats SA (P0441)         → quarter-on-quarter, seasonally adjusted
 *   - IBGE / Brazil (tab 5932) → four-quarter accumulated, year-on-year
 *   - World Bank / IMF /
 *     Eurostat / CIA / ONS-UK /
 *     INSEE-FR / StatCan / …    → annual, year-on-year (comparable default)
 *   - any other source         → unspecified
 *
 * This script stamps each `gdp_real_growth_rate` (and its `gdp_growth_rate`
 * legacy alias) source row with its `growth_methodology` label, so the
 * resolver can prefer the comparable annual-YoY publisher (Q3 rule) and
 * the UI can disclose the basis via an InfoTip. The per-source mapping is
 * the single source of truth in `src/lib/data/growth-methodology.ts`.
 *
 * Idempotent: it only writes rows whose current label differs from the
 * target, so a re-run is a no-op.
 *
 * ── Provenance note (IMPORTANT) ──
 * This is a LOCAL labelling pass over already-synced data — it reads no
 * upstream and writes no source rows. It MUST NOT stamp
 * `sources.last_sync_at`: a derivation is not a fresh sync, and faking
 * freshness would violate the AGENTS.md provenance invariant. This script
 * touches only `country_facts.growth_methodology`. `validate:sync-freshness`
 * passes because there is no `last_sync_at` write here.
 *
 * Contract: `~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md`
 * (Option E, owner-adopted).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import {
  GROWTH_METHODOLOGY_BY_SOURCE,
  type GrowthMethodology,
} from "@/lib/data/growth-methodology";

const sql = neon(process.env.DATABASE_URL!);

/** The growth fact-keys this labelling pass covers: the canonical Phase F
 *  key plus the CIA legacy alias. Both share growth semantics. */
const GROWTH_FACT_KEYS = ["gdp_real_growth_rate", "gdp_growth_rate"] as const;

/** Sources not present in GROWTH_METHODOLOGY_BY_SOURCE fall back here. */
const DEFAULT_METHODOLOGY: GrowthMethodology = "unspecified";

function parseArgs(): { apply: boolean } {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const dryRun = argv.includes("--dry-run");
  if (apply && dryRun) {
    console.error("Pass either --apply or --dry-run, not both.");
    process.exit(1);
  }
  // Default to dry-run when neither flag is present (safe by default).
  return { apply };
}

async function main() {
  const { apply } = parseArgs();
  console.log("=== backfill-growth-methodology ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN (no writes)"}`);
  console.log(
    "Rule: label every gdp_real_growth_rate / gdp_growth_rate row by its " +
      "source's measurement basis (unknown source → unspecified)\n",
  );

  // Enumerate the distinct source_ids actually present on the growth keys,
  // so we report an honest per-source count (and catch any source we did
  // not anticipate — it lands in `unspecified`).
  const presentSources = (await sql`
    SELECT source_id, count(*)::int AS n
    FROM country_facts
    WHERE fact_key IN ('gdp_real_growth_rate', 'gdp_growth_rate')
    GROUP BY source_id
    ORDER BY n DESC
  `) as Array<{ source_id: string; n: number }>;

  let totalRows = 0;
  let totalWrote = 0;

  for (const { source_id, n } of presentSources) {
    const target =
      GROWTH_METHODOLOGY_BY_SOURCE[source_id] ?? DEFAULT_METHODOLOGY;
    totalRows += n;

    // Rows already at the correct label (idempotency).
    const correctRows = (await sql`
      SELECT count(*)::int AS n
      FROM country_facts
      WHERE fact_key IN ('gdp_real_growth_rate', 'gdp_growth_rate')
        AND source_id = ${source_id}
        AND growth_methodology = ${target}
    `) as Array<{ n: number }>;
    const alreadyCorrect = correctRows[0].n;
    const toWrite = n - alreadyCorrect;

    if (apply) {
      const updated = (await sql`
        UPDATE country_facts
        SET growth_methodology = ${target}
        WHERE fact_key IN ('gdp_real_growth_rate', 'gdp_growth_rate')
          AND source_id = ${source_id}
          AND (growth_methodology IS DISTINCT FROM ${target})
        RETURNING id
      `) as Array<{ id: string }>;
      totalWrote += updated.length;
      console.log(
        `${source_id.padEnd(16)} → ${target.padEnd(30)} rows=${n} labelled=${updated.length} (already-correct=${alreadyCorrect})`,
      );
    } else {
      totalWrote += toWrite;
      console.log(
        `${source_id.padEnd(16)} → ${target.padEnd(30)} rows=${n} would-label=${toWrite} (already-correct=${alreadyCorrect})`,
      );
    }
  }

  console.log(
    `\nTotals: rows=${totalRows}, ${apply ? "labelled" : "would-label"}=${totalWrote}`,
  );
  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
  } else {
    console.log(
      "\nDone. growth_methodology written; no last_sync_at touched.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("backfill-growth-methodology failed:", err);
    process.exit(1);
  });
