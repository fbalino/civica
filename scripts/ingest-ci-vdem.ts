import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import {
  CI_PRODUCTION_SOURCE_URLS,
  CI_RELEASE_DATASET_YEAR,
  applyFrozenReleaseCoverage,
  parseVdemCore,
} from "../src/lib/ci/production-source-adapters";
import { fetchBuffer } from "../src/lib/ci/source-utils";

const db = createDb();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const datasetYear = Number(
    process.env.CI_DATASET_YEAR ?? CI_RELEASE_DATASET_YEAR,
  );
  const url =
    process.env.VDEM_CY_CORE_ZIP_URL ?? CI_PRODUCTION_SOURCE_URLS.vdem;
  console.log(`Ingesting V-Dem Liberal Democracy Index (${datasetYear})...\n`);
  const result = applyFrozenReleaseCoverage(
    parseVdemCore(await fetchBuffer(url), datasetYear),
    "vdem.democratic_quality",
  );
  const { ingested, skipped } = await runIngestion(db, result, { dryRun: DRY_RUN });
  console.log(
    `Done: ${ingested} countries ingested, ${skipped} skipped (no jurisdiction match)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
