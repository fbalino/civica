import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import {
  CI_PRODUCTION_SOURCE_URLS,
  CI_RELEASE_DATASET_YEAR,
  applyFrozenReleaseCoverage,
  parseTransparencyCpi,
} from "../src/lib/ci/production-source-adapters";
import { fetchBuffer } from "../src/lib/ci/source-utils";

const db = createDb();

async function main() {
  const datasetYear = Number(
    process.env.CI_DATASET_YEAR ?? CI_RELEASE_DATASET_YEAR,
  );
  const url =
    process.env.TRANSPARENCY_CPI_XLSX_URL ??
    CI_PRODUCTION_SOURCE_URLS.transparencyCpi;
  console.log(`Ingesting Transparency International CPI (${datasetYear})...\n`);
  const result = applyFrozenReleaseCoverage(
    parseTransparencyCpi(await fetchBuffer(url), datasetYear),
    "transparency_intl.corruption_control",
  );
  const { ingested, skipped } = await runIngestion(db, result);
  console.log(
    `Done: ${ingested} countries ingested, ${skipped} skipped (no jurisdiction match)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
