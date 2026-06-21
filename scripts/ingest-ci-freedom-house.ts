import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import type { SourceDataRecord, IngestionResult } from "../src/lib/ci/types";

const db = createDb();

const SOURCE_ID = "freedom_house";
const DIMENSION = "freedom_rights" as const;
const INDICATOR = "total";

// Freedom House Freedom in the World 2023: Freedom Rating scale 1-7, INVERTED (1 = most free, 7 = least free)
// In production, download from https://freedomhouse.org/report/freedom-world (CSV/XLS)
// Reference values are Freedom in the World 2023 country ratings (political rights + civil liberties averaged)
const FH_2023: Record<string, number> = {
  DNK: 1.0, NOR: 1.0, SWE: 1.0, FIN: 1.0, CHE: 1.0,
  NZL: 1.0, NLD: 1.0, DEU: 1.0, CAN: 1.0, IRL: 1.0,
  AUS: 1.0, AUT: 1.0, GBR: 1.0, BEL: 1.0, FRA: 1.0,
  ESP: 1.0, JPN: 1.5, ISR: 1.5, CZE: 1.5, ITA: 1.5,
  USA: 2.0, KOR: 2.0, CHL: 2.0, ARG: 2.0, GRC: 2.0,
  BRA: 2.5, ZAF: 2.5, POL: 2.5, UKR: 3.0, IND: 3.0,
  IDN: 3.0, COL: 3.5, MEX: 3.5, KEN: 3.5, PHL: 3.5,
  SGP: 4.0, MOZ: 4.5, NGA: 4.5, PAK: 4.5, BGD: 4.5,
  TUR: 5.0, THA: 5.0, HKG: 5.5, RUS: 6.5, ETH: 6.5,
  VNM: 6.5, VEN: 6.5, CHN: 6.5, EGY: 6.0, SAU: 7.0,
  SYR: 7.0, SSD: 7.0,
};

async function main() {
  console.log("Ingesting Freedom House Freedom in the World ratings...\n");

  // FH_2023 holds the 1–7 Freedom Rating (the AVERAGE of Political Rights and
  // Civil Liberties). The Civica normalization (src/lib/ci/normalize-v2.ts) and
  // the published methodology both use the 2–14 SUM scale:
  // ((14 − score) / 12) × 100. Convert avg → sum here (sum = avg × 2 exactly)
  // so the stored raw_value matches the normalizer's freedom_house bounds.
  // Without this, freedom_rights is computed on the wrong scale and flatters
  // autocracies (e.g. SAU 7.0 → 58/100 instead of the correct 0/100).
  const records: SourceDataRecord[] = Object.entries(FH_2023).map(
    ([iso3, avgRating]) => ({
      iso3,
      year: 2023,
      dimension: DIMENSION,
      indicator: INDICATOR,
      rawValue: avgRating * 2,
      nativeMin: 2,
      nativeMax: 14,
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
