import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq } from "drizzle-orm";
import {
  createDb,
  getLatestMethodologyVersion,
  runIngestion,
} from "../src/lib/ci/ingest";
import { yearToQuarter } from "../src/lib/ci/normalize";
import {
  CI_PRODUCTION_SOURCE_URLS,
  CI_RELEASE_DATASET_YEAR,
  applyFrozenReleaseCoverage,
  parseWgiVoiceAccountability,
  wgiFallbackRecords,
} from "../src/lib/ci/production-source-adapters";
import { fetchBuffer } from "../src/lib/ci/source-utils";
import { ciDimensionScores, jurisdictions } from "../src/lib/db/schema";

const db = createDb();

async function main() {
  const datasetYear = Number(
    process.env.CI_DATASET_YEAR ?? CI_RELEASE_DATASET_YEAR,
  );
  const quarter = yearToQuarter(datasetYear);
  const methodologyVersion = await getLatestMethodologyVersion(db);
  const existingRows = await db
    .select({ iso3: jurisdictions.iso3 })
    .from(ciDimensionScores)
    .innerJoin(
      jurisdictions,
      eq(ciDimensionScores.jurisdictionId, jurisdictions.id),
    )
    .where(
      and(
        eq(ciDimensionScores.dimension, "democratic_quality"),
        eq(ciDimensionScores.quarter, quarter),
        eq(ciDimensionScores.methodologyVersion, methodologyVersion),
      ),
    );
  const alreadyCovered = new Set(
    existingRows.flatMap((row) => (row.iso3 ? [row.iso3.toUpperCase()] : [])),
  );
  const url =
    process.env.WGI_DATASET_XLSX_URL ?? CI_PRODUCTION_SOURCE_URLS.worldbankWgi;
  console.log(
    `Ingesting WGI Voice & Accountability fallback for missing V-Dem countries (${datasetYear})...\n`,
  );
  const result = applyFrozenReleaseCoverage(
    wgiFallbackRecords(
      parseWgiVoiceAccountability(await fetchBuffer(url), datasetYear),
      alreadyCovered,
    ),
    "worldbank_wgi.democratic_quality_fallback",
  );
  if (result.records.length === 0) {
    console.log("No WGI fallback rows needed.");
    return;
  }
  const { ingested, skipped } = await runIngestion(db, result);
  console.log(
    `Done: ${ingested} fallback countries ingested, ${skipped} skipped (no jurisdiction match)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
