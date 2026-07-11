import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import {
  CI_PRODUCTION_SOURCE_URLS,
  CI_RELEASE_DATASET_YEAR,
  applyFrozenReleaseCoverage,
  parseWgiRuleOfLaw,
} from "../src/lib/ci/production-source-adapters";
import { fetchBuffer } from "../src/lib/ci/source-utils";

const db = createDb();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const datasetYear = Number(
    process.env.CI_DATASET_YEAR ?? CI_RELEASE_DATASET_YEAR,
  );
  const url =
    process.env.WGI_DATASET_XLSX_URL ?? CI_PRODUCTION_SOURCE_URLS.worldbankWgi;
  console.log(`Ingesting World Bank WGI Rule of Law (${datasetYear})...\n`);
  const result = applyFrozenReleaseCoverage(
    parseWgiRuleOfLaw(await fetchBuffer(url), datasetYear),
    "worldbank_wgi.rule_of_law",
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
