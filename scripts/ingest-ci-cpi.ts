import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import type { SourceDataRecord, IngestionResult } from "../src/lib/ci/types";

const db = createDb();

const SOURCE_ID = "transparency_intl";
const DIMENSION = "corruption_control" as const;
const INDICATOR = "score";

// Transparency International CPI 2023: scale 0-100, higher = less corrupt, NOT inverted
// In production, download from https://www.transparency.org/en/cpi (CSV/XLSX)
// Reference values are CPI 2023 scores
const CPI_2023: Record<string, number> = {
  DNK: 90, FIN: 87, NZL: 85, NOR: 84, SGP: 83,
  SWE: 82, CHE: 82, NLD: 79, DEU: 78, LUX: 78,
  IRL: 77, CAN: 76, EST: 76, AUS: 75, HKG: 75,
  JPN: 73, BEL: 73, AUT: 71, GBR: 71, FRA: 71,
  ARE: 68, USA: 69, CHL: 66, KOR: 63, ISR: 62,
  CZE: 57, ITA: 56, POL: 54, SAU: 52, MYS: 50,
  GRC: 49, ESP: 60, CHN: 42, ZAF: 41, VNM: 41,
  IND: 39, ARG: 37, ETH: 37, THA: 35, EGY: 35,
  TUR: 34, IDN: 34, PHL: 34, BRA: 36, PER: 36,
  UKR: 36, RUS: 26, KEN: 31, MEX: 31, NGA: 25,
  PAK: 29, BGD: 24, VEN: 13, SYR: 13, SSD: 13,
  SOM: 11,
};

async function main() {
  console.log("Ingesting Transparency International CPI...\n");

  const records: SourceDataRecord[] = Object.entries(CPI_2023).map(
    ([iso3, rawValue]) => ({
      iso3,
      year: 2023,
      dimension: DIMENSION,
      indicator: INDICATOR,
      rawValue,
      nativeMin: 0,
      nativeMax: 100,
      isInverted: false,
    })
  );

  const values = records.map((r) => r.rawValue);
  const result: IngestionResult = {
    sourceId: SOURCE_ID,
    dimension: DIMENSION,
    datasetYear: 2023,
    records,
    globalMinObserved: Math.min(...values),
    globalMaxObserved: Math.max(...values),
  };

  const { ingested, skipped } = await runIngestion(db, result);
  console.log(`Done: ${ingested} countries ingested, ${skipped} skipped (no jurisdiction match)`);
}

main().catch(console.error);
