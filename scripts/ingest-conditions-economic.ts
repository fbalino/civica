/** Civica Conditions — World Bank economic source-native input ledger. */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { CURRENT_CONDITIONS_METHODOLOGY_VERSION } from "../src/lib/conditions/contract";
import { writeConditionsRelease } from "../src/lib/conditions/ingest";
import { prepareEconomicConditions } from "../src/lib/conditions/production-workflow";

const DRY_RUN = process.argv.includes("--dry-run");
const RELEASE_ID = process.argv.find((arg) => arg.startsWith("--release-id="))?.slice(
  "--release-id=".length,
);
const INPUT_FILE = process.argv.find((arg) => arg.startsWith("--economic-input="))?.slice(
  "--economic-input=".length,
);
const CAPTURE_OUTPUT = process.argv
  .find((arg) => arg.startsWith("--economic-capture-output="))
  ?.slice("--economic-capture-output=".length);

async function main() {
  console.log("=== Civica Conditions — Economic Stability inputs ===\n");
  if (!RELEASE_ID) {
    throw new Error("Pass a stable --release-id=conditions-*-vN; releases are never implicit");
  }
  if (!DRY_RUN) {
    throw new Error(
      "Single-dimension Conditions writes are disabled; use ingest:conditions:all for one canonical release",
    );
  }
  const prepared = await prepareEconomicConditions(db, RELEASE_ID, {
    inputFile: INPUT_FILE,
    captureOutput: CAPTURE_OUTPUT,
  });
  const summary = await writeConditionsRelease(db, {
    releaseId: RELEASE_ID,
    methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
    referenceSets: prepared.referenceSets,
  }, prepared.rows, { dryRun: DRY_RUN });
  const aligned = prepared.rows.filter(
    (row) => row.alignmentStatus === "aligned",
  ).length;
  const mixedYear = prepared.rows.filter(
    (row) => row.alignmentStatus === "mixed_year_refused",
  ).length;
  const missing = prepared.rows.filter(
    (row) => row.alignmentStatus === "missing_component",
  ).length;
  console.log(
    `\n${DRY_RUN ? "[DRY RUN] proposed" : "Done:"} ${summary.calculationsWritten || summary.proposed} calculation ledgers and ${summary.componentsWritten || prepared.rows.length * 3} component rows.`,
  );
  console.log(
    `Aligned source-native ledgers: ${aligned}; mixed-year refused: ${mixedYear}; missing component: ${missing}.`,
  );
  console.log(
    "Economic stability scores are intentionally withheld pending the ATL-028 frozen longitudinal construct study.",
  );
  console.log(
    `Dimension: economic_stability | Source: worldbank_economic | Release: ${RELEASE_ID} | Version: ${CURRENT_CONDITIONS_METHODOLOGY_VERSION}`,
  );
}

main().catch((error) => {
  console.error("Ingest failed:", error);
  process.exit(1);
});
