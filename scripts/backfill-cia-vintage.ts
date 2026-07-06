/**
 * backfill-cia-vintage — populate country_facts.data_vintage_year for the
 * CIA demographic fact-keys whose prose stamp is a projection year.
 *
 *   Dry-run (default):  npx tsx scripts/backfill-cia-vintage.ts --dry-run
 *   Apply:              npx tsx scripts/backfill-cia-vintage.ts --apply
 *   npm:               npm run backfill:cia-vintage -- --apply
 *
 * ── What this does ──
 * CIA World Factbook stamps a republication / projection year on its
 * demographic estimates — e.g. `Population: 338,016,259 (2025 est.)` is a
 * current-year estimate CIA constructs from the prior year's UN World
 * Population Prospects reference data, NOT a 2025 measurement. For those
 * rows the underlying measurement vintage is one year older than the
 * stamp. This script records that real measurement year in
 * `data_vintage_year` (= `fact_year - 1`) WITHOUT mutating CIA's original
 * `fact_year` / `as_of` provenance. The resolver's freshness comparator
 * then ranks a primary publisher's actual measurement ahead of CIA's
 * republication stamp (see `src/lib/factbook/reconcile/resolver.ts`
 * `freshness()`).
 *
 * Scope is DELIBERATELY narrow and honest:
 *  - exactly the five fact-keys whose CIA projection methodology is
 *    documented, AND
 *  - only rows whose prose stamp carries the "(YYYY est.)" ESTIMATE
 *    qualifier. A bare "(YYYY)" stamp (e.g. Falkland Islands `(2021)`,
 *    Vatican City `(2024)`, Norfolk Island `(2021)`) is a real
 *    measurement in that year, NOT a nowcast off prior-year data — aging
 *    it down would wrongly demote a genuine census figure below a UN/WB
 *    nowcast. This is Risk 1 in the resolution doc §7. Those rows keep a
 *    NULL vintage, and this backfill CLEARS any vintage a prior
 *    un-gated pass wrote onto them (self-correcting, idempotent).
 *
 * Every other row — and any CIA row on these keys with a NULL `fact_year`
 * (no stamp to offset off) — is left NULL, so the resolver falls back to
 * the existing `as_of || fact_year || retrieved_at` ladder. No false
 * precision.
 *
 * Contract: `~/civica/plan/cia-stale-vintage-resolution-v1.md`
 * (§5 Option A + §6, owner-confirmed).
 *
 * ── Provenance note (IMPORTANT) ──
 * This is a LOCAL derivation of already-synced CIA data — it reads no
 * upstream and writes no source rows. It MUST NOT stamp
 * `sources.last_sync_at`: a derivation is not a fresh sync, and faking
 * freshness would violate the AGENTS.md provenance invariant. This
 * script touches only `country_facts.data_vintage_year`. `validate:sync-
 * freshness` passes because there is no `last_sync_at` write here.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

/**
 * The five reader-facing fact-keys where CIA's prose stamp is a
 * projection year one ahead of the underlying measurement vintage. These
 * are what the resolver reads for the canonical pick, and the scope named
 * by the resolution.
 */
const TARGET_FACT_KEYS = [
  "population_total",
  "birth_rate",
  "death_rate",
  "population_growth_rate",
  "median_age",
] as const;

/**
 * The legacy `population` alias. CIA seeds population under this short
 * key, and `scripts/bridge-cia-legacy-to-canonical.ts` copies it to the
 * canonical `population_total`. We stamp the alias with the SAME derived
 * vintage so the seed→bridge pipeline stays internally consistent: a
 * future bridge re-run copies the alias's `data_vintage_year` onto
 * `population_total` rather than clobbering it back to NULL. This is
 * plumbing for the same CIA population datum — NOT a sixth reader-facing
 * fact-key (the alias is CIA-only / single-source, so it changes no
 * canonical pick on its own).
 */
const LEGACY_ALIAS_KEYS = ["population"] as const;

const ALL_KEYS: readonly string[] = [
  ...TARGET_FACT_KEYS,
  ...LEGACY_ALIAS_KEYS,
];

/** CIA's projection stamp is one year ahead of the measurement vintage. */
const OFFSET = -1;

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
  console.log("=== backfill-cia-vintage ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN (no writes)"}`);
  console.log(
    `Rule: CIA rows on the 5 demographic keys → data_vintage_year = fact_year ${OFFSET} (NULL fact_year skipped)\n`,
  );

  let totalEligible = 0;
  let totalAlreadyCorrect = 0;
  let totalWouldWrite = 0;
  let totalCleared = 0;

  // Estimate-stamp predicate. CIA's demographic nowcasts read
  // "(YYYY est.)"; a real measurement reads "(YYYY)" (or "(YYYY census)").
  // Matching " est" (leading space) hits the estimate stamps and never the
  // bare-year rows, and mirrors the seed script's `/\best\.?/i` gate. Only
  // an estimate stamp is aged down (§7 Risk 1 of the resolution doc).
  for (const factKey of ALL_KEYS) {
    // Eligible = CIA rows on this key with a non-null fact_year (a stamp
    // to offset off). Rows with a null fact_year are intentionally left
    // NULL — there is nothing to derive a measurement year from.
    const eligibleRows = await sql`
      SELECT count(*)::int AS n
      FROM country_facts
      WHERE source_id = 'cia_factbook'
        AND fact_key = ${factKey}
        AND fact_year IS NOT NULL
    `;
    const eligible = eligibleRows[0].n as number;

    // Rows already at their TARGET vintage (idempotency check). Target:
    //   estimate stamp "(YYYY est.)" → fact_year - 1
    //   bare stamp     "(YYYY)"      → NULL
    const correctRows = await sql`
      SELECT count(*)::int AS n
      FROM country_facts
      WHERE source_id = 'cia_factbook'
        AND fact_key = ${factKey}
        AND fact_year IS NOT NULL
        AND data_vintage_year IS NOT DISTINCT FROM
            (CASE WHEN source_note ILIKE '% est%' THEN fact_year + ${OFFSET} ELSE NULL END)
    `;
    const alreadyCorrect = correctRows[0].n as number;
    const wouldWrite = eligible - alreadyCorrect;

    totalEligible += eligible;
    totalAlreadyCorrect += alreadyCorrect;
    totalWouldWrite += wouldWrite;

    if (apply) {
      // One self-correcting pass: SET the derived vintage on estimate rows
      // AND CLEAR any vintage a prior un-gated run wrote onto a bare-year
      // (census) row. `RETURNING` splits the two so the log is honest.
      const updated = (await sql`
        UPDATE country_facts
        SET data_vintage_year =
          CASE WHEN source_note ILIKE '% est%' THEN fact_year + ${OFFSET} ELSE NULL END
        WHERE source_id = 'cia_factbook'
          AND fact_key = ${factKey}
          AND fact_year IS NOT NULL
          AND data_vintage_year IS DISTINCT FROM
              (CASE WHEN source_note ILIKE '% est%' THEN fact_year + ${OFFSET} ELSE NULL END)
        RETURNING (source_note ILIKE '% est%') AS was_estimate
      `) as { was_estimate: boolean }[];
      const aged = updated.filter((r) => r.was_estimate).length;
      const cleared = updated.length - aged;
      totalCleared += cleared;
      console.log(
        `${factKey.padEnd(24)} eligible=${eligible} aged=${aged} cleared=${cleared} (already-correct=${alreadyCorrect})`,
      );
    } else {
      console.log(
        `${factKey.padEnd(24)} eligible=${eligible} would-change=${wouldWrite} (already-correct=${alreadyCorrect})`,
      );
    }
  }

  console.log(
    `\nTotals: eligible=${totalEligible}, ${apply ? `changed=${totalWouldWrite} (of which cleared=${totalCleared})` : `would-change=${totalWouldWrite}`}, already-correct=${totalAlreadyCorrect}`,
  );
  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
  } else {
    console.log("\nDone. data_vintage_year written; no last_sync_at touched.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("backfill-cia-vintage failed:", err);
    process.exit(1);
  });
