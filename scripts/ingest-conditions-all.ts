/** Civica Conditions — one immutable three-dimension release. */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { runCombinedConditionsIngestion } from "../src/lib/conditions/production-workflow";

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
  if (!RELEASE_ID) {
    throw new Error("Pass a stable --release-id=conditions-*-vN; releases are never implicit");
  }
  const result = await runCombinedConditionsIngestion(db, {
    releaseId: RELEASE_ID,
    dryRun: DRY_RUN,
    inputFile: INPUT_FILE,
    captureOutput: CAPTURE_OUTPUT,
  });
  const dimensions = new Set(result.rows.map((row) => row.dimension));
  console.log(
    `${DRY_RUN ? "[DRY RUN] proposed" : "Done:"} ${result.summary.proposed} calculations, ${result.summary.written} scores, and ${result.summary.componentsWritten} component rows.`,
  );
  console.log(
    `Release: ${RELEASE_ID} | Dimensions: ${[...dimensions].sort().join(", ")}`,
  );
}

main().catch((error) => {
  console.error("Ingest failed:", error);
  process.exit(1);
});
