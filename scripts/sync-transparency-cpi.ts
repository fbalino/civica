import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql as dsql } from "drizzle-orm";
import {
  jurisdictions,
  countryMetrics,
  sources,
} from "../src/lib/db/schema";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sqlClient });

const SOURCE_ID = "transparency_intl";
const METRIC_ID = "cpi";

// CPI 2023 reference data (score 0-100, higher = less corrupt)
// Source: Transparency International CPI 2023
// In production, download from https://www.transparency.org/en/cpi (CSV/XLSX)
const CPI_2023: Record<string, { score: number; rank: number }> = {
  DNK: { score: 90, rank: 1 }, FIN: { score: 87, rank: 2 }, NZL: { score: 85, rank: 3 },
  NOR: { score: 84, rank: 4 }, SGP: { score: 83, rank: 5 }, SWE: { score: 82, rank: 6 },
  CHE: { score: 82, rank: 6 }, NLD: { score: 79, rank: 8 }, DEU: { score: 78, rank: 9 },
  LUX: { score: 78, rank: 9 }, IRL: { score: 77, rank: 11 }, AUS: { score: 75, rank: 14 },
  HKG: { score: 75, rank: 14 }, AUT: { score: 71, rank: 18 }, CAN: { score: 76, rank: 12 },
  EST: { score: 76, rank: 12 }, JPN: { score: 73, rank: 16 }, GBR: { score: 71, rank: 18 },
  BEL: { score: 73, rank: 16 }, FRA: { score: 71, rank: 18 }, USA: { score: 69, rank: 24 },
  ISR: { score: 62, rank: 35 }, KOR: { score: 63, rank: 32 }, ESP: { score: 60, rank: 36 },
  ITA: { score: 56, rank: 42 }, CZE: { score: 57, rank: 41 }, GRC: { score: 49, rank: 58 },
  POL: { score: 54, rank: 47 }, CHL: { score: 66, rank: 29 }, ARG: { score: 37, rank: 98 },
  BRA: { score: 36, rank: 104 }, CHN: { score: 42, rank: 76 }, MEX: { score: 31, rank: 126 },
  TUR: { score: 34, rank: 115 }, RUS: { score: 26, rank: 141 }, THA: { score: 35, rank: 108 },
  ZAF: { score: 41, rank: 83 }, IND: { score: 39, rank: 93 }, KEN: { score: 31, rank: 126 },
  NGA: { score: 25, rank: 145 }, PAK: { score: 29, rank: 133 }, BGD: { score: 24, rank: 149 },
  ETH: { score: 37, rank: 98 }, EGY: { score: 35, rank: 108 }, IDN: { score: 34, rank: 115 },
  PHL: { score: 34, rank: 115 }, VNM: { score: 41, rank: 83 }, MYS: { score: 50, rank: 53 },
  COL: { score: 40, rank: 87 }, PER: { score: 36, rank: 104 }, UKR: { score: 36, rank: 104 },
  SAU: { score: 52, rank: 52 }, ARE: { score: 68, rank: 26 }, SOM: { score: 11, rank: 180 },
  SSD: { score: 13, rank: 177 }, SYR: { score: 13, rank: 177 }, VEN: { score: 13, rank: 177 },
  YEM: { score: 16, rank: 176 },
};

const TOTAL_RANKED = 180;

async function buildIso3Map(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: jurisdictions.id, iso3: jurisdictions.iso3 })
    .from(jurisdictions)
    .where(dsql`${jurisdictions.iso3} IS NOT NULL`);
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.iso3) map.set(r.iso3.toUpperCase(), r.id);
  }
  return map;
}

async function main() {
  console.log("Syncing Transparency International CPI data...\n");

  const iso3Map = await buildIso3Map();
  console.log(`Loaded ${iso3Map.size} jurisdictions with ISO3 codes.\n`);

  let inserted = 0;
  let skipped = 0;
  const unmatchedCountries: string[] = [];

  for (const [iso3, data] of Object.entries(CPI_2023)) {
    const jurisdictionId = iso3Map.get(iso3);
    if (!jurisdictionId) {
      unmatchedCountries.push(iso3);
      skipped++;
      continue;
    }

    await db
      .insert(countryMetrics)
      .values({
        jurisdictionId,
        metricId: METRIC_ID,
        year: 2023,
        value: data.score,
        rank: data.rank,
        totalRanked: TOTAL_RANKED,
        sourceId: SOURCE_ID,
        sourceUrl: "https://www.transparency.org/en/cpi/2023",
      })
      .onConflictDoUpdate({
        target: [
          countryMetrics.jurisdictionId,
          countryMetrics.metricId,
          countryMetrics.year,
        ] as [typeof countryMetrics.jurisdictionId, typeof countryMetrics.metricId, typeof countryMetrics.year],
        set: {
          value: data.score,
          rank: data.rank,
          totalRanked: TOTAL_RANKED,
          updatedAt: new Date(),
        },
      });
    inserted++;
  }

  if (unmatchedCountries.length > 0) {
    console.log(`Unmatched ISO3 codes: ${unmatchedCountries.join(", ")}`);
  }

  await db
    .update(sources)
    .set({ lastSyncAt: new Date() })
    .where(eq(sources.id, SOURCE_ID));

  console.log(`\nDone. Inserted/updated: ${inserted}, skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("Failed to sync CPI:", err);
  process.exit(1);
});
