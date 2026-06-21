import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import type { SourceDataRecord, IngestionResult } from "../src/lib/ci/types";

const db = createDb();

const SOURCE_ID = "global_peace_index";
const DIMENSION = "stability_security" as const;
const INDICATOR = "score";

// Institute for Economics & Peace — Global Peace Index 2023: scale 1-5, INVERTED (1 = most peaceful, 5 = least peaceful)
// In production, download from https://www.visionofhumanity.org/maps/#/ (Excel)
// Reference values are GPI 2023 overall scores
const GPI_2023: Record<string, number> = {
  ISL: 1.124, IRL: 1.296, DNK: 1.296, AUT: 1.300, NZL: 1.316,
  SGP: 1.332, JPN: 1.336, FIN: 1.338, CHE: 1.338, PRT: 1.343,
  NOR: 1.371, SWE: 1.365, CAN: 1.389, BEL: 1.400, NLD: 1.404,
  AUS: 1.420, ESP: 1.452, CZE: 1.470, DEU: 1.527, CHL: 1.649,
  IDN: 1.665, GBR: 1.668, ITA: 1.686, ARG: 1.704, HKG: 1.783,
  VNM: 1.836, POL: 1.869, GRC: 1.801, KOR: 1.812, THA: 1.987,
  BGD: 2.067, BRA: 2.107, CHN: 2.113, TUR: 2.270, EGY: 2.297,
  IND: 2.315, PHL: 2.348, COL: 2.367, KEN: 2.396, USA: 2.440,
  SAU: 2.456, MEX: 2.573, ETH: 2.789, NGA: 2.834, PAK: 2.978,
  VEN: 2.967, SSD: 3.189, RUS: 3.268, SYR: 3.344, UKR: 3.332,
  ZAF: 2.180,
};

async function main() {
  console.log("Ingesting Global Peace Index...\n");

  const records: SourceDataRecord[] = Object.entries(GPI_2023).map(
    ([iso3, rawValue]) => ({
      iso3,
      year: 2023,
      dimension: DIMENSION,
      indicator: INDICATOR,
      rawValue,
      nativeMin: 1,
      nativeMax: 5,
      isInverted: true,
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

  // Pass vintageAt so sources.last_sync_at reflects the data vintage
  // (2023), not the date this seed script was run.
  const { ingested, skipped } = await runIngestion(db, result, {
    vintageAt: new Date(`${result.datasetYear}-12-31`),
  });
  console.log(`Done: ${ingested} countries ingested, ${skipped} skipped (no jurisdiction match)`);
}

main().catch(console.error);
