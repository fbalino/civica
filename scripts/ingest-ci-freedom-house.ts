import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import type { SourceDataRecord, IngestionResult } from "../src/lib/ci/types";
import {
  buildIso3ByCountryName,
  DEFAULT_CI_DATASET_YEAR,
  fetchBuffer,
  minMax,
  normalizeCountryName,
  rowsToObjects,
  toNumber,
  xlsxSheetRows,
} from "../src/lib/ci/source-utils";

const db = createDb();

const SOURCE_ID = "freedom_house";
const DIMENSION = "freedom_rights" as const;
const INDICATOR = "pr_cl_total";
const DATA_URL =
  process.env.FREEDOM_HOUSE_FIW_XLSX_URL ??
  "https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx";

async function main() {
  const datasetYear = DEFAULT_CI_DATASET_YEAR;
  console.log(`Ingesting Freedom House Freedom in the World (${datasetYear})...\n`);

  const buffer = await fetchBuffer(DATA_URL);
  const rows = rowsToObjects(
    xlsxSheetRows(buffer, "FIW06-24"),
    (row) => row.includes("Country/Territory") && row.includes("Edition"),
  );
  const iso3ByName = await buildIso3ByCountryName(db);
  const unmatched = new Set<string>();

  const records: SourceDataRecord[] = rows.flatMap((row) => {
    if (Number(row.Edition) !== datasetYear) return [];
    if ((row["C/T?"] ?? "").toLowerCase() !== "c") return [];

    const countryName = row["Country/Territory"]?.trim();
    const pr = toNumber(row["PR Rating"]);
    const cl = toNumber(row["CL Rating"]);
    if (!countryName || pr === null || cl === null) return [];

    const iso3 = iso3ByName.get(normalizeCountryName(countryName));
    if (!iso3) {
      unmatched.add(countryName);
      return [];
    }

    return [
      {
        iso3,
        year: datasetYear,
        dimension: DIMENSION,
        indicator: INDICATOR,
        rawValue: pr + cl,
        nativeMin: 2,
        nativeMax: 14,
        isInverted: true,
      },
    ];
  });

  if (unmatched.size > 0) {
    console.warn(
      `Unmatched Freedom House country names (${unmatched.size}): ${[
        ...unmatched,
      ].join(", ")}`,
    );
  }

  const { min, max } = minMax(records.map((r) => r.rawValue));
  const result: IngestionResult = {
    sourceId: SOURCE_ID,
    dimension: DIMENSION,
    datasetYear,
    records,
    globalMinObserved: min,
    globalMaxObserved: max,
  };

  const { ingested, skipped } = await runIngestion(db, result);
  console.log(`Done: ${ingested} countries ingested, ${skipped} skipped (no jurisdiction match)`);
}

main().catch(console.error);
