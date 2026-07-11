import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb } from "../src/lib/ci/ingest";
import {
  calculateCompositeScores,
  LEGACY_CI_METHODOLOGY_VERSION,
} from "../src/lib/ci/calculate";
import { currentQuarter } from "../src/lib/ci/normalize";

const db = createDb();

async function main() {
  const quarter = process.argv[2] || currentQuarter();
  const version = process.argv[3] || LEGACY_CI_METHODOLOGY_VERSION;

  console.log(`Calculating CI composite scores for ${quarter}...`);
  console.log(`Using archived methodology version: ${version}`);

  const { calculated, skippedInsufficient } = await calculateCompositeScores(
    db,
    quarter,
    version
  );

  console.log(
    `\nDone: ${calculated} countries scored and ranked, ${skippedInsufficient} skipped (fewer than 3 dimensions)`
  );
}

main().catch(console.error);
