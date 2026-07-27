import { config } from "dotenv";
config({ path: ".env.local" });

import {
  syncFactbookOfficeholders,
  computeEnrichmentPlan,
  reportEnrichmentPlan,
} from "../src/lib/factbook/officeholders-sync";
import { markSourcesSynced } from "../src/lib/db/source-freshness";

// Thin CLI wrapper around the shared officeholder-sync core in
// `src/lib/factbook/officeholders-sync.ts` (the single implementation used by
// BOTH this script and the `/api/cron/factbook/sync-officeholders` route).
//
// `--dry-run` (or DRY_RUN=1) computes the full proposed title/party change set
// and prints it WITHOUT writing anything to the DB. Used to let the owner
// approve the enrichment before a real apply pass.
const DRY_RUN =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
const ATLAS_RELEASE_ID = process.argv
  .find((arg) => arg.startsWith("--release-id="))
  ?.slice("--release-id=".length);

async function main() {
  if (DRY_RUN) {
    console.log("=== Wikidata Officeholder Enrichment (DRY RUN) ===\n");
    const plan = await computeEnrichmentPlan();
    reportEnrichmentPlan(plan);
    // Dry runs never advance freshness.
    await markSourcesSynced("wikidata", { rowsWritten: 0, dryRun: true });
    return;
  }

  await syncFactbookOfficeholders({
    atlasReleaseId: ATLAS_RELEASE_ID,
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
      else console.log(line);
    },
  });
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
