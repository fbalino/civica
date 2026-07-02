import { config } from "dotenv";
config({ path: ".env.local" });

import {
  enrichPersonPortraits,
  reportPersonPortraitPlan,
} from "../src/lib/factbook/person-portraits";

/**
 * enrich-person-portraits — backfill Wikidata P18 portraits + P569 birthdates
 * for EVERY `persons` row with `wikidata_qid IS NOT NULL AND photo_url IS NULL`.
 *
 * The existing officeholder sync only enriches ~400 heads of state/government.
 * A QID backfill just attached `wikidata_qid` to ~1.9k cabinet ministers, so
 * this pass fills their portraits from the same Wikidata + Wikimedia Commons
 * pipeline (the shared `@/lib/factbook/person-portraits` module).
 *
 * Idempotent: the candidate query excludes anyone who already has a photo_url,
 * so re-runs after future backfills only process the delta, and an existing
 * photo_url is NEVER overwritten.
 *
 * Flags:
 *   --dry-run          Compute + print the plan, write NOTHING, never stamp
 *                      freshness. (Also honoured via DRY_RUN=1.)
 *   --limit=<n>        Cap the candidate set (smoke tests). Deterministic order.
 *
 * On a real apply, provenance is stamped via markSourcesSynced("wikidata", …)
 * — the one sanctioned path — and only when rows were actually written.
 */

function parseLimit(): number | undefined {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (!arg) return undefined;
  const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const DRY_RUN =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
const LIMIT = parseLimit();

async function main() {
  console.log("=== Person-portrait enrichment (P18 + P569) ===");
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "APPLY"}` +
      (LIMIT ? ` · limit=${LIMIT}` : "") +
      "\n",
  );

  const summary = await enrichPersonPortraits({
    dryRun: DRY_RUN,
    limit: LIMIT,
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
      else console.log(line);
    },
  });

  reportPersonPortraitPlan(summary.plan);

  console.log("=== Result ===");
  console.log(`Candidates:              ${summary.candidates}`);
  console.log(`Portraits written:       ${summary.portraitsWritten}`);
  console.log(`Birthdates written:      ${summary.birthdatesWritten}`);
  console.log(`Skipped (non-free lic.): ${summary.portraitsSkippedNonFree}`);
  console.log(`No P18 image:            ${summary.portraitsNoImage}`);
  console.log(`Duration:                ${Math.round(summary.durationMs / 1000)}s`);
  console.log(`Freshness stamped:       ${summary.freshnessStamped}`);

  console.log("\n=== SUMMARY (JSON) ===");
  console.log(
    JSON.stringify(
      {
        candidates: summary.candidates,
        portraitsWritten: summary.portraitsWritten,
        birthdatesWritten: summary.birthdatesWritten,
        portraitsSkippedNonFree: summary.portraitsSkippedNonFree,
        portraitsNoImage: summary.portraitsNoImage,
        dryRun: summary.dryRun,
        freshnessStamped: summary.freshnessStamped,
        durationMs: summary.durationMs,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("enrich-person-portraits failed:", err);
    process.exit(1);
  });
