import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import type { SourceDataRecord, IngestionResult } from "../src/lib/ci/types";

const db = createDb();

const SOURCE_ID = "undp_hdi";
const DIMENSION = "human_development" as const;
const INDICATOR = "hdi";

// UNDP Human Development Index: scale 0-1, higher = more developed, NOT inverted
// In production, fetch from https://hdr.undp.org/api/data/hdi or download CSV from UNDP Data Center
// Reference values are HDR 2023/24 report (2022 data)
const HDI_2022: Record<string, number> = {
  CHE: 0.967, NOR: 0.966, ISL: 0.959, HKG: 0.956, DNK: 0.952,
  SWE: 0.952, DEU: 0.950, IRL: 0.950, SGP: 0.949, NLD: 0.946,
  AUS: 0.946, BEL: 0.942, FIN: 0.942, NZL: 0.939, GBR: 0.940,
  CAN: 0.935, USA: 0.927, KOR: 0.929, JPN: 0.920, ISR: 0.915,
  ESP: 0.911, ITA: 0.906, FRA: 0.903, CZE: 0.895, GRC: 0.893,
  POL: 0.881, SAU: 0.875, ARE: 0.937, TUR: 0.838, RUS: 0.822,
  CHL: 0.860, ARG: 0.849, THA: 0.803, MYS: 0.803, CHN: 0.788,
  MEX: 0.781, COL: 0.758, PER: 0.762, UKR: 0.773, ZAF: 0.717,
  VNM: 0.726, EGY: 0.728, BRA: 0.760, IDN: 0.713, PHL: 0.710,
  BGD: 0.670, IND: 0.644, KEN: 0.601, NGA: 0.548, PAK: 0.544,
  ETH: 0.492, MOZ: 0.461, SSD: 0.381, SOM: 0.380,
};

async function main() {
  console.log("Ingesting UNDP Human Development Index...\n");

  const records: SourceDataRecord[] = Object.entries(HDI_2022).map(
    ([iso3, rawValue]) => ({
      iso3,
      year: 2022,
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
    datasetYear: 2022,
    records,
    globalMinObserved: Math.min(...values),
    globalMaxObserved: Math.max(...values),
  };

  const { ingested, skipped } = await runIngestion(db, result);
  console.log(`Done: ${ingested} countries ingested, ${skipped} skipped (no jurisdiction match)`);
}

main().catch(console.error);
