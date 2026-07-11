/**
 * Civica Conditions — Economic Stability dimension
 *
 * Fetches three World Bank indicators for every jurisdiction that has
 * an ISO2 code, computes a composite z-score (equal-weight), and maps
 * it to 0–100 via the cumulative normal CDF approximation from
 * methodology spec §2.3.
 *
 * Indicators:
 *   - FP.CPI.TOTL.ZG  Inflation, consumer prices (% annual) — INVERTED
 *   - SL.UEM.TOTL.ZS  Unemployment, total (% of total labor force) — INVERTED
 *   - NY.GDP.MKTP.KD.ZG  GDP growth (% annual) — higher is better
 *
 * Source: worldbank_economic
 * Dimension: economic_stability
 * Quarter convention: ${dataset_year}-Q4
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { jurisdictions } from "../src/lib/db/schema";
import { isNotNull } from "drizzle-orm";
import { writeConditionScores, type ConditionScoreInput } from "../src/lib/conditions/ingest";

const METHODOLOGY_VERSION = "beta";
const SOURCE_ID = "worldbank_economic";
const CONDITIONS_DIMENSION = "economic_stability";
const DRY_RUN = process.argv.includes("--dry-run");

const WB_BASE = "https://api.worldbank.org/v2";
const DATE_RANGE = "2020:2024";
const PER_PAGE = 10;

const INDICATORS = {
  inflation: "FP.CPI.TOTL.ZG",  // inverted — lower inflation is better
  unemployment: "SL.UEM.TOTL.ZS", // inverted — lower unemployment is better
  gdpGrowth: "NY.GDP.MKTP.KD.ZG", // higher growth is better
};

/**
 * Abramowitz approximation of the cumulative normal CDF.
 * Accurate to ~1e-7. Works in Node without any math libraries.
 */
function normalCdf(z: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

interface WbDataPoint {
  year: number;
  value: number | null;
}

async function fetchIndicator(
  iso2: string,
  indicator: string
): Promise<WbDataPoint[]> {
  const url = `${WB_BASE}/country/${iso2}/indicator/${indicator}?format=json&date=${DATE_RANGE}&per_page=${PER_PAGE}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json() as [unknown, Array<{ date: string; value: number | null }>];
    if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) return [];
    return json[1]
      .filter((d) => d.value !== null)
      .map((d) => ({ year: parseInt(d.date, 10), value: d.value as number }));
  } catch {
    return [];
  }
}

/**
 * Get the most recent non-null value from a series (preferring latest year).
 */
function latestValue(points: WbDataPoint[]): { year: number; value: number } | null {
  const sorted = [...points].sort((a, b) => b.year - a.year);
  const hit = sorted.find((p) => p.value !== null);
  if (!hit || hit.value === null) return null;
  return { year: hit.year, value: hit.value };
}

interface IndicatorObservation {
  jurisdictionId: string;
  iso2: string;
  inflation: number | null;
  unemployment: number | null;
  gdpGrowth: number | null;
  datasetYear: number;
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], mu: number): number {
  const variance =
    values.reduce((s, v) => s + (v - mu) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

async function main() {
  console.log("=== Civica Conditions — Economic Stability (World Bank) ===\n");

  // Load all jurisdictions with iso2
  const jurs = await db
    .select({ id: jurisdictions.id, iso2: jurisdictions.iso2 })
    .from(jurisdictions)
    .where(isNotNull(jurisdictions.iso2));

  console.log(`Fetching World Bank data for ${jurs.length} jurisdictions...`);
  console.log("(This takes ~2–3 minutes; World Bank API is throttled.)\n");

  const observations: IndicatorObservation[] = [];
  let fetchErrors = 0;

  for (let i = 0; i < jurs.length; i++) {
    const { id, iso2 } = jurs[i];
    if (!iso2) continue;

    if (i > 0 && i % 20 === 0) {
      console.log(`  ${i}/${jurs.length} fetched...`);
    }

    const [inflationPts, unemploymentPts, gdpPts] = await Promise.all([
      fetchIndicator(iso2, INDICATORS.inflation),
      fetchIndicator(iso2, INDICATORS.unemployment),
      fetchIndicator(iso2, INDICATORS.gdpGrowth),
    ]);

    const infl = latestValue(inflationPts);
    const unem = latestValue(unemploymentPts);
    const gdp = latestValue(gdpPts);

    // Need at least 2 of 3 indicators to include the country
    const available = [infl, unem, gdp].filter(Boolean);
    if (available.length < 2) {
      fetchErrors++;
      continue;
    }

    // Dataset year = most recent year among available indicators
    const datasetYear = Math.max(
      ...(available.map((x) => x!.year))
    );

    observations.push({
      jurisdictionId: id,
      iso2,
      inflation: infl?.value ?? null,
      unemployment: unem?.value ?? null,
      gdpGrowth: gdp?.value ?? null,
      datasetYear,
    });
  }

  console.log(`\nData collected: ${observations.length} countries with sufficient data`);
  console.log(`Skipped (insufficient data): ${fetchErrors}`);

  if (observations.length === 0) {
    console.log("No data collected. Exiting.");
    process.exit(1);
  }

  // --- Build global distributions for z-scoring ---
  const inflValues = observations
    .filter((o) => o.inflation !== null)
    .map((o) => o.inflation as number);
  const unemValues = observations
    .filter((o) => o.unemployment !== null)
    .map((o) => o.unemployment as number);
  const gdpValues = observations
    .filter((o) => o.gdpGrowth !== null)
    .map((o) => o.gdpGrowth as number);

  const inflMu = mean(inflValues);
  const inflSd = stddev(inflValues, inflMu) || 1;
  const unemMu = mean(unemValues);
  const unemSd = stddev(unemValues, unemMu) || 1;
  const gdpMu = mean(gdpValues);
  const gdpSd = stddev(gdpValues, gdpMu) || 1;

  console.log(`\nGlobal distributions (n=${observations.length}):`);
  console.log(`  Inflation:     μ=${inflMu.toFixed(2)}%, σ=${inflSd.toFixed(2)}`);
  console.log(`  Unemployment:  μ=${unemMu.toFixed(2)}%, σ=${unemSd.toFixed(2)}`);
  console.log(`  GDP growth:    μ=${gdpMu.toFixed(2)}%, σ=${gdpSd.toFixed(2)}`);

  // --- Compute composite z-score and map to 0–100 ---
  let upserted = 0;
  const output: ConditionScoreInput[] = [];

  for (const obs of observations) {
    const zComponents: number[] = [];

    // Inflation: INVERT (lower inflation → higher score)
    if (obs.inflation !== null) {
      const z = (obs.inflation - inflMu) / inflSd;
      zComponents.push(-z); // inverted
    }

    // Unemployment: INVERT (lower unemployment → higher score)
    if (obs.unemployment !== null) {
      const z = (obs.unemployment - unemMu) / unemSd;
      zComponents.push(-z); // inverted
    }

    // GDP growth: higher is better
    if (obs.gdpGrowth !== null) {
      const z = (obs.gdpGrowth - gdpMu) / gdpSd;
      zComponents.push(z);
    }

    if (zComponents.length === 0) continue;

    // Equal-weight composite z-score
    const compositeZ = mean(zComponents);

    // Map composite z → 0–100 via cumulative normal CDF
    const normalizedScore = Math.round(normalCdf(compositeZ) * 100 * 10) / 10;

    // Quarter uses the dataset year
    const quarter = `${obs.datasetYear}-Q4`;

    // Raw value: store composite z-score as the "raw" for transparency
    const rawValue = Math.round(compositeZ * 1000) / 1000;

    output.push({
        jurisdictionId: obs.jurisdictionId,
        dimension: CONDITIONS_DIMENSION,
        quarter,
        normalizedScore,
        rawValue,
        sourceId: SOURCE_ID,
        datasetYear: obs.datasetYear,
        methodologyVersion: METHODOLOGY_VERSION,
      });

    upserted++;
  }

  // Stamp source freshness via the single sanctioned helper — only when
  // this run actually upserted rows (AGENTS.md provenance invariant). The
  // helper applies the same `upserted > 0` gate internally.
  await writeConditionScores(db, output, { dryRun: DRY_RUN });

  console.log(`\n${DRY_RUN ? "[DRY RUN] proposed" : "Done:"} ${upserted} rows ${DRY_RUN ? "with zero writes" : "upserted into civica_conditions_scores"}.`);
  console.log(`Dimension: ${CONDITIONS_DIMENSION} | Source: ${SOURCE_ID} | Version: ${METHODOLOGY_VERSION}`);
  console.log(`Skipped entirely (< 2 indicators): ${fetchErrors}`);
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
