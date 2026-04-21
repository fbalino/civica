import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import type { SourceDataRecord, IngestionResult } from "../src/lib/ci/types";

const db = createDb();

const SOURCE_ID = "vdem";
const DIMENSION = "democratic_quality" as const;
const INDICATOR = "v2x_libdem";

// V-Dem Liberal Democracy Index: scale 0-1, higher = more democratic
// In production, download CSV from https://www.v-dem.net/data/the-v-dem-dataset/
// For now, use reference data for 2023 (latest available)
const VDEM_2023: Record<string, number> = {
  DNK: 0.89, NOR: 0.88, SWE: 0.87, FIN: 0.86, CHE: 0.85,
  NZL: 0.84, NLD: 0.84, DEU: 0.83, CAN: 0.82, IRL: 0.82,
  AUS: 0.81, AUT: 0.80, GBR: 0.79, BEL: 0.78, JPN: 0.77,
  FRA: 0.76, USA: 0.74, KOR: 0.73, CZE: 0.72, ESP: 0.71,
  CHL: 0.70, ITA: 0.69, POL: 0.62, ARG: 0.60, GRC: 0.68,
  BRA: 0.55, ZAF: 0.54, COL: 0.52, MEX: 0.47, IND: 0.43,
  IDN: 0.42, PHL: 0.40, UKR: 0.38, NGA: 0.35, TUR: 0.27,
  THA: 0.26, BGD: 0.24, PAK: 0.22, HKG: 0.20, KEN: 0.34,
  ETH: 0.15, EGY: 0.12, VNM: 0.10, RUS: 0.08, VEN: 0.07,
  CHN: 0.06, SAU: 0.03, SYR: 0.02, SSD: 0.02,
};

async function main() {
  console.log("Ingesting V-Dem Liberal Democracy Index...\n");

  const records: SourceDataRecord[] = Object.entries(VDEM_2023).map(
    ([iso3, rawValue]) => ({
      iso3,
      year: 2023,
      dimension: DIMENSION,
      indicator: INDICATOR,
      rawValue,
      nativeMin: 0,
      nativeMax: 1,
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
