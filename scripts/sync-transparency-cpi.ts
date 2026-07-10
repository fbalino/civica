import { config } from "dotenv";
config({ path: ".env.local" });

import { markSourcesSynced } from "../src/lib/db/source-freshness";
import { countryMetrics } from "../src/lib/db/schema";
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
  for (const record of eligible) {
    await db
      .insert(countryMetrics)
      .values({
        jurisdictionId: iso3Map.get(record.iso3)!,
        metricId: METRIC_ID,
        year: datasetYear,
        value: record.score,
        rank: ranks.get(record.iso3),
        totalRanked: eligible.length,
        sourceId: SOURCE_ID,
        sourceUrl: `https://www.transparency.org/en/cpi/${datasetYear}`,
      })
      .onConflictDoUpdate({
        target: [
          countryMetrics.jurisdictionId,
          countryMetrics.metricId,
          countryMetrics.year,
        ],
        set: {
          value: record.score,
          rank: ranks.get(record.iso3),
          totalRanked: eligible.length,
          sourceId: SOURCE_ID,
          sourceUrl: `https://www.transparency.org/en/cpi/${datasetYear}`,
          updatedAt: new Date(),
        },
      });
    written += 1;
  }

  await markSourcesSynced(SOURCE_ID, { rowsWritten: written });
  console.log(`Done. Inserted/updated: ${written}; source rows: ${result.records.length}`);
}

main().catch((error) => {
  console.error("Failed to sync CPI:", error);
  process.exitCode = 1;
});
