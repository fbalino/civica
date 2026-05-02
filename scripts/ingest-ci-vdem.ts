import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import type { SourceDataRecord, IngestionResult } from "../src/lib/ci/types";
import {
  DEFAULT_CI_DATASET_YEAR,
  fetchBuffer,
  forEachCsvRow,
  minMax,
  normalizeIso3Code,
  toNumber,
  zipEntryText,
} from "../src/lib/ci/source-utils";

const db = createDb();

const SOURCE_ID = "vdem";
const DIMENSION = "democratic_quality" as const;
const INDICATOR = "v2x_libdem";
const DATA_URL =
  process.env.VDEM_CY_CORE_ZIP_URL ??
  "https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip";

async function main() {
  const datasetYear = DEFAULT_CI_DATASET_YEAR;
  console.log(`Ingesting V-Dem Liberal Democracy Index (${datasetYear})...\n`);

  const buffer = await fetchBuffer(DATA_URL);
  const csv = zipEntryText(
    buffer,
    (name) => name.endsWith(".csv") && name.includes("V-Dem-CY-Core"),
  );

  const records: SourceDataRecord[] = [];
  let countryIdx = -1;
  let yearIdx = -1;
  let valueIdx = -1;

  forEachCsvRow(csv, (row, rowIndex) => {
    if (rowIndex === 0) {
      countryIdx = row.indexOf("country_text_id");
      yearIdx = row.indexOf("year");
      valueIdx = row.indexOf(INDICATOR);
      if (countryIdx === -1 || yearIdx === -1 || valueIdx === -1) {
        throw new Error("V-Dem CSV is missing required columns.");
      }
      return;
    }

    if (Number(row[yearIdx]) !== datasetYear) return;
    const rawValue = toNumber(row[valueIdx]);
    const iso3 = normalizeIso3Code(row[countryIdx] ?? "");
    if (!iso3 || rawValue === null) return;

    records.push({
      iso3,
      year: datasetYear,
      dimension: DIMENSION,
      indicator: INDICATOR,
      rawValue,
      nativeMin: 0,
      nativeMax: 1,
      isInverted: false,
    });
  });

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
