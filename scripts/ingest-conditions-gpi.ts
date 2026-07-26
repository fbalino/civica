/** Civica Conditions — Peace & Security component ledger. */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { CURRENT_CONDITIONS_METHODOLOGY_VERSION } from "../src/lib/conditions/contract";
import { writeConditionsRelease } from "../src/lib/conditions/ingest";
import { prepareGpiConditions } from "../src/lib/conditions/production-workflow";

const DRY_RUN = process.argv.includes("--dry-run");
const RELEASE_ID = process.argv.find((arg) => arg.startsWith("--release-id="))?.slice(
  "--release-id=".length,
);

async function main() {
  console.log("=== Civica Conditions — Peace & Security component ledger ===\n");
  if (!RELEASE_ID) {
    throw new Error("Pass a stable --release-id=conditions-*-vN; releases are never implicit");
  }
  if (!DRY_RUN) {
    throw new Error(
      "Single-dimension Conditions writes are disabled; use ingest:conditions:all for one canonical release",
    );
  }
  const prepared = await prepareGpiConditions(db, RELEASE_ID);
  const summary = await writeConditionsRelease(db, {
    releaseId: RELEASE_ID,
    methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
    referenceSets: prepared.referenceSets,
  }, prepared.rows, { dryRun: DRY_RUN });
  console.log(
    `${DRY_RUN ? "[DRY RUN] proposed" : "Done:"} ${summary.proposed} calculations, ${summary.written} decomposable scores, and ${DRY_RUN ? prepared.rows.length : summary.componentsWritten} component rows.`,
  );
  console.log(
    `Dimension: peace_security | Source: global_peace_index | Release: ${RELEASE_ID} | Version: ${CURRENT_CONDITIONS_METHODOLOGY_VERSION}`,
  );
}

main().catch((error) => {
  console.error("Ingest failed:", error);
  process.exit(1);
});
