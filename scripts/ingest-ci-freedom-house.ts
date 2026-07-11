import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import {
  CI_PRODUCTION_SOURCE_URLS,
  CI_RELEASE_DATASET_YEAR,
  applyFrozenReleaseCoverage,
  parseFreedomHouse,
} from "../src/lib/ci/production-source-adapters";
import {
  buildIso3ByCountryName,
  fetchBuffer,
} from "../src/lib/ci/source-utils";

const db = createDb();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const datasetYear = Number(
    process.env.CI_DATASET_YEAR ?? CI_RELEASE_DATASET_YEAR,
  );
  const url =
    process.env.FREEDOM_HOUSE_FIW_XLSX_URL ??
    CI_PRODUCTION_SOURCE_URLS.freedomHouse;
  console.log(
    `Ingesting Freedom House Freedom in the World (${datasetYear})...\n`,
  );
  const parsed = parseFreedomHouse(
    await fetchBuffer(url),
    await buildIso3ByCountryName(db),
    datasetYear,
  );
  if (parsed.unmatchedCountryNames.length > 0) {
    console.warn(
      `Unmatched Freedom House country names (${parsed.unmatchedCountryNames.length}): ${parsed.unmatchedCountryNames.join(", ")}`,
    );
  }
  const result = applyFrozenReleaseCoverage(
    parsed.ingestion,
    "freedom_house.freedom_rights",
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
