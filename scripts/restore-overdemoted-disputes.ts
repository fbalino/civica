/**
 * restore-overdemoted-disputes — undo the dispute over-demotion bug.
 *
 *   Dry-run (default):  npx tsx scripts/restore-overdemoted-disputes.ts --dry-run
 *   Apply:              npx tsx scripts/restore-overdemoted-disputes.ts --apply
 *
 * ── What this does ──
 * Resolving a two-way dispute is supposed to demote only the LOSING party
 * (see src/app/api/admin/data-disputes/[id]/route.ts). A prior version
 * demoted every OTHER active row for the (jurisdiction, fact_key) — collapsing
 * the multi-source alternates panel and demoting bystanders that were never
 * part of the dispute, including sources that AGREED with the reviewer's
 * chosen winner.
 *
 * This restores every wrongly-demoted bystander to status='active' while
 * KEEPING the legitimate loser demoted. A row is a bystander iff:
 *   - status='demoted' (never touch 'rejected' / 'superseded' rows), AND
 *   - status_reason = 'demoted_by_dispute_<id>' for a dispute whose
 *     resolution_action is 'resolve_a' or 'resolve_b', AND
 *   - the row is NOT that dispute's loser (fact_id_b if resolve_a,
 *     fact_id_a if resolve_b). `IS DISTINCT FROM` so a null loser (unary
 *     dispute) restores every bystander.
 *
 * Idempotent: once restored, status<>'demoted' so the row no longer matches.
 * The legitimate loser keeps status='demoted', so the resolver never re-sees
 * it and the original dispute cannot resurrect.
 *
 * Provenance: touches only country_facts.status / status_reason; writes no
 * last_sync_at (this is a correction, not a sync).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

function parseArgs(): { apply: boolean } {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) {
    console.error("Pass either --apply or --dry-run, not both.");
    process.exit(1);
  }
  return { apply };
}

async function main() {
  const { apply } = parseArgs();
  console.log("=== restore-overdemoted-disputes ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN (no writes)"}\n`);

  // The bystanders: demoted rows attributed to a resolved 2-way dispute whose
  // loser they are NOT.
  const targets = await sql`
    SELECT cf.id, cf.source_id, cf.fact_key, cf.fact_value_numeric,
           j.slug, d.id AS dispute_id, d.resolution_action
    FROM country_facts cf
    JOIN jurisdictions j ON j.id = cf.jurisdiction_id
    JOIN data_disputes d
      ON ('demoted_by_dispute_' || d.id) = cf.status_reason
    WHERE cf.status = 'demoted'
      AND d.resolution_action IN ('resolve_a', 'resolve_b')
      AND cf.id IS DISTINCT FROM
          (CASE WHEN d.resolution_action = 'resolve_a' THEN d.fact_id_b
                ELSE d.fact_id_a END)
    ORDER BY j.slug, cf.source_id
  `;

  console.log(`Bystanders to restore: ${targets.length}`);
  for (const r of targets as Record<string, unknown>[]) {
    console.log(
      `  ${String(r.slug).padEnd(20)} ${String(r.source_id).padEnd(12)} ${String(r.fact_key).padEnd(18)} = ${r.fact_value_numeric}  (dispute ${String(r.dispute_id).slice(0, 8)}, ${r.resolution_action})`,
    );
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to restore.");
    return;
  }

  const restored = await sql`
    UPDATE country_facts cf
    SET status = 'active', status_reason = NULL, updated_at = now()
    FROM data_disputes d
    WHERE cf.status = 'demoted'
      AND ('demoted_by_dispute_' || d.id) = cf.status_reason
      AND d.resolution_action IN ('resolve_a', 'resolve_b')
      AND cf.id IS DISTINCT FROM
          (CASE WHEN d.resolution_action = 'resolve_a' THEN d.fact_id_b
                ELSE d.fact_id_a END)
    RETURNING cf.id
  `;
  console.log(`\nRestored ${restored.length} row(s) to active. No last_sync_at touched.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("restore-overdemoted-disputes failed:", err);
    process.exit(1);
  });
