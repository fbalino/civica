import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import type { SourceDataRecord, IngestionResult } from "../src/lib/ci/types";
import {
  DEFAULT_CI_DATASET_YEAR,
  fetchBuffer,
  minMax,
  normalizeIso3Code,
  rowsToObjects,
  toNumber,
  xlsxSheetRows,
} from "../src/lib/ci/source-utils";

const db = createDb();

const SOURCE_ID = "transparency_intl";
const DIMENSION = "corruption_control" as const;
const INDICATOR = "score";
const DATA_URL =
  process.env.TRANSPARENCY_CPI_XLSX_URL ??
  "https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx";

async function main() {
  const datasetYear = DEFAULT_CI_DATASET_YEAR;
  const scoreColumn = `CPI ${datasetYear} score`;
  console.log(`Ingesting Transparency International CPI (${datasetYear})...\n`);

  const buffer = await fetchBuffer(DATA_URL);
  const rows = rowsToObjects(
    xlsxSheetRows(buffer, `CPI ${datasetYear}`),
    (row) => row.includes("ISO3") && row.includes(scoreColumn),
  );

  const records: SourceDataRecord[] = rows.flatMap((row) => {
    const iso3 = normalizeIso3Code(row.ISO3 ?? "");
    const rawValue = toNumber(row[scoreColumn]);
    if (!iso3 || rawValue === null) return [];
    return [
      {
        iso3,
        year: datasetYear,
        dimension: DIMENSION,
        indicator: INDICATOR,
        rawValue,
        nativeMin: 0,
        nativeMax: 100,
        isInverted: false,
      },
    ];
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
