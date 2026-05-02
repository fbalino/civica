import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq } from "drizzle-orm";
import {
  createDb,
  getLatestMethodologyVersion,
  runIngestion,
} from "../src/lib/ci/ingest";
import { yearToQuarter } from "../src/lib/ci/normalize";
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
import { ciDimensionScores, jurisdictions } from "../src/lib/db/schema";

const db = createDb();

const SOURCE_ID = "worldbank_wgi";
const DIMENSION = "democratic_quality" as const;
const INDICATOR = "va.est";
const DATA_URL =
  process.env.WGI_DATASET_XLSX_URL ??
  "https://datacatalogfiles.worldbank.org/ddh-published/0038026/DR0095947/wgidataset_with_sourcedata-2025.xlsx";

async function main() {
  const datasetYear = DEFAULT_CI_DATASET_YEAR;
  const quarter = yearToQuarter(datasetYear);
  const methodologyVersion = await getLatestMethodologyVersion(db);
  console.log(
    `Ingesting WGI Voice & Accountability fallback for missing V-Dem countries (${datasetYear})...\n`,
  );

  const existingRows = await db
    .select({ iso3: jurisdictions.iso3 })
    .from(ciDimensionScores)
    .innerJoin(jurisdictions, eq(ciDimensionScores.jurisdictionId, jurisdictions.id))
    .where(
      and(
        eq(ciDimensionScores.dimension, DIMENSION),
        eq(ciDimensionScores.quarter, quarter),
        eq(ciDimensionScores.methodologyVersion, methodologyVersion),
      ),
    );
  const alreadyCovered = new Set(
    existingRows.flatMap((row) => (row.iso3 ? [row.iso3.toUpperCase()] : [])),
  );

  const buffer = await fetchBuffer(DATA_URL);
  const rows = rowsToObjects(
    xlsxSheetRows(buffer, "va"),
    (row) =>
      row.includes("Economy (code)") &&
      row.includes("Year") &&
      row.includes("Governance estimate (approx. -2.5 to +2.5)"),
  );

  const records: SourceDataRecord[] = rows.flatMap((row) => {
    if (Number(row.Year) !== datasetYear) return [];
    const iso3 = normalizeIso3Code(row["Economy (code)"] ?? "");
    if (!iso3 || alreadyCovered.has(iso3)) return [];

    const rawValue = toNumber(row["Governance estimate (approx. -2.5 to +2.5)"]);
    if (rawValue === null) return [];

    return [
      {
        iso3,
        year: datasetYear,
        dimension: DIMENSION,
        indicator: INDICATOR,
        rawValue,
        nativeMin: -2.5,
        nativeMax: 2.5,
        isInverted: false,
      },
    ];
  });

  if (records.length === 0) {
    console.log("No WGI fallback rows needed.");
    return;
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
  console.log(
    `Done: ${ingested} fallback countries ingested, ${skipped} skipped (no jurisdiction match)`,
  );
}

main().catch(console.error);
