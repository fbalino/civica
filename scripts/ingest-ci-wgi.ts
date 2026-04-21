import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, runIngestion } from "../src/lib/ci/ingest";
import type { SourceDataRecord, IngestionResult } from "../src/lib/ci/types";

const db = createDb();

const SOURCE_ID = "worldbank_wgi";
const DIMENSION = "rule_of_law" as const;
const INDICATOR = "rl.est";

// World Bank WGI Rule of Law: scale -2.5 to +2.5, higher = stronger rule of law, NOT inverted
// In production, download from https://info.worldbank.org/governance/wgi/ (CSV/XLS)
// Reference values are 2022 WGI estimates (published 2023, assigned to 2023-Q4 CI period)
const WGI_2022: Record<string, number> = {
  FIN: 2.00, NOR: 1.98, DNK: 1.96, SWE: 1.97, SGP: 1.93,
  NZL: 1.87, IRL: 1.83, NLD: 1.85, CHE: 1.84, DEU: 1.79,
  CAN: 1.74, AUS: 1.74, AUT: 1.70, GBR: 1.73, HKG: 1.52,
  JPN: 1.54, FRA: 1.35, USA: 1.39, BEL: 1.27, KOR: 0.99,
  CZE: 1.07, CHL: 1.04, ESP: 0.87, GRC: 0.41, POL: 0.44,
  ITA: 0.34, SAU: 0.26, THA: 0.22, ZAF: 0.12, IND: 0.06,
  BRA: -0.10, IDN: -0.17, PHL: -0.13, EGY: -0.37, CHN: -0.37,
  VNM: -0.25, COL: -0.28, ARG: -0.38, TUR: -0.56, KEN: -0.55,
  UKR: -0.67, BGD: -0.75, RUS: -0.85, ETH: -0.89, PAK: -0.96,
  NGA: -1.02, SYR: -1.80, VEN: -1.97, SSD: -2.08,
};

async function main() {
  console.log("Ingesting World Bank WGI Rule of Law...\n");

  const records: SourceDataRecord[] = Object.entries(WGI_2022).map(
    ([iso3, rawValue]) => ({
      iso3,
      year: 2023,
      dimension: DIMENSION,
      indicator: INDICATOR,
      rawValue,
      nativeMin: -2.5,
      nativeMax: 2.5,
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
