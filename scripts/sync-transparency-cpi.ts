import { config } from "dotenv";
config({ path: ".env.local" });

import { writeCountryMetrics, type CountryMetricInput } from "../src/lib/metrics/ingest";
import { buildIso3Map, createDb } from "../src/lib/ci/ingest";
import {
  CI_PRODUCTION_SOURCE_URLS,
  CI_RELEASE_DATASET_YEAR,
  parseTransparencyCpi,
} from "../src/lib/ci/production-source-adapters";
import { fetchBuffer } from "../src/lib/ci/source-utils";

const db = createDb();
const SOURCE_ID = "transparency_intl";
const METRIC_ID = "cpi";
const DRY_RUN = process.argv.includes("--dry-run");
const ATLAS_RELEASE_ID =
  process.argv
    .find((arg) => arg.startsWith("--release-id="))
    ?.slice("--release-id=".length)
    .trim() ||
  process.env.CIVICA_ATLAS_RELEASE_ID?.trim() ||
  null;

function competitionRanks(
  rows: readonly { iso3: string; score: number }[],
): Map<string, number> {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.iso3.localeCompare(b.iso3),
  );
  const ranks = new Map<string, number>();
  let previous: number | undefined;
  let rank = 0;
  sorted.forEach((row, index) => {
    if (row.score !== previous) rank = index + 1;
    ranks.set(row.iso3, rank);
    previous = row.score;
  });
  return ranks;
}

async function main() {
  if (!DRY_RUN && !ATLAS_RELEASE_ID) {
    throw new Error(
      "A named Atlas release is required: pass --release-id=<id> or set CIVICA_ATLAS_RELEASE_ID.",
    );
  }
  const datasetYear = Number(
    process.env.CI_DATASET_YEAR ?? CI_RELEASE_DATASET_YEAR,
  );
  const url =
    process.env.TRANSPARENCY_CPI_XLSX_URL ??
    CI_PRODUCTION_SOURCE_URLS.transparencyCpi;
  console.log(`Syncing Transparency International CPI (${datasetYear})...\n`);

  const result = parseTransparencyCpi(await fetchBuffer(url), datasetYear);
  const iso3Map = await buildIso3Map(db);
  const eligible = result.records
    .filter((record) => iso3Map.has(record.iso3))
    .map((record) => ({ iso3: record.iso3, score: record.rawValue }));
  const ranks = competitionRanks(eligible);

  let written = 0;
  const output: CountryMetricInput[] = [];
  for (const record of eligible) {
    output.push({
        jurisdictionId: iso3Map.get(record.iso3)!,
        metricId: METRIC_ID,
        year: datasetYear,
        value: record.score,
        rank: ranks.get(record.iso3),
        totalRanked: eligible.length,
        sourceId: SOURCE_ID,
        sourceUrl: `https://www.transparency.org/en/cpi/${datasetYear}`,
      });
    written += 1;
  }

  await writeCountryMetrics(db as never, output, {
    dryRun: DRY_RUN,
    history: ATLAS_RELEASE_ID
      ? {
          changeKind: "routine_refresh",
          reason: "Transparency International CPI release refresh",
          methodologyVersion: "transparency-cpi-country-metrics/v1",
          releaseId: ATLAS_RELEASE_ID,
        }
      : undefined,
  });
  console.log(`Done. Inserted/updated: ${written}; source rows: ${result.records.length}`);
}

main().catch((error) => {
  console.error("Failed to sync CPI:", error);
  process.exitCode = 1;
});
