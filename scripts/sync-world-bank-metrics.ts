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

const WORLD_BANK_INDICATORS: Record<string, string> = {
  "SP.DYN.LE00.IN": "life_expectancy",
  "NY.GDP.PCAP.CD": "gdp_per_capita",
  "SL.UEM.TOTL.ZS": "unemployment_rate",
  "SI.POV.GINI": "gini_index",
  "SE.TER.ENRR": "school_enrollment_tertiary",
};

const SOURCE_ID = "world_bank";
const BASE_URL = "https://api.worldbank.org/v2";
const PER_PAGE = 500;
const START_YEAR = 2015;
const END_YEAR = 2024;

interface WBDataPoint {
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
}

async function fetchIndicator(
  indicatorCode: string
): Promise<WBDataPoint[]> {
  const url = `${BASE_URL}/country/all/indicator/${indicatorCode}?format=json&per_page=${PER_PAGE}&date=${START_YEAR}:${END_YEAR}`;
  const allData: WBDataPoint[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const pageUrl = `${url}&page=${page}`;
    const res = await fetch(pageUrl);
    if (!res.ok) throw new Error(`World Bank API error: ${res.status}`);
    const json = await res.json();

    if (!Array.isArray(json) || json.length < 2) break;

    const meta = json[0] as { pages: number };
    totalPages = meta.pages;
    const data = json[1] as WBDataPoint[];
    if (data) allData.push(...data);
    page++;
  }

  return allData.filter((d) => d.value !== null);
}

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
  console.log("Syncing World Bank indicators...\n");

  const iso3Map = await buildIso3Map();
  console.log(`Loaded ${iso3Map.size} jurisdictions with ISO3 codes.\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const [wbCode, metricId] of Object.entries(WORLD_BANK_INDICATORS)) {
    console.log(`Fetching ${metricId} (${wbCode})...`);
    const data = await fetchIndicator(wbCode);
    console.log(`  Got ${data.length} data points.`);

    let inserted = 0;
    let skipped = 0;

    for (const d of data) {
      const iso3 = (d.countryiso3code || "").toUpperCase();
      if (!iso3 || iso3.length !== 3) continue;
      const jurisdictionId = iso3Map.get(iso3);
      if (!jurisdictionId) {
        skipped++;
        continue;
      }

      const year = parseInt(d.date, 10);
      if (isNaN(year) || d.value === null) continue;

      await db
        .insert(countryMetrics)
        .values({
          jurisdictionId,
          metricId,
          year,
          value: d.value,
          sourceId: SOURCE_ID,
          sourceUrl: `${BASE_URL}/country/${d.country.id}/indicator/${wbCode}`,
        })
        .onConflictDoUpdate({
          target: [
            countryMetrics.jurisdictionId,
            countryMetrics.metricId,
            countryMetrics.year,
          ] as [typeof countryMetrics.jurisdictionId, typeof countryMetrics.metricId, typeof countryMetrics.year],
          set: {
            value: d.value,
            updatedAt: new Date(),
          },
        });
      inserted++;
    }

    console.log(`  Inserted/updated: ${inserted}, skipped (no ISO3 match): ${skipped}`);
    totalInserted += inserted;
    totalSkipped += skipped;
  }

  await db
    .update(sources)
    .set({ lastSyncAt: new Date() })
    .where(eq(sources.id, SOURCE_ID));

  console.log(`\nDone. Total inserted: ${totalInserted}, skipped: ${totalSkipped}`);
}

main().catch((err) => {
  console.error("Failed to sync World Bank metrics:", err);
  process.exit(1);
});
