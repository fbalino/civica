/**
 * Civica Conditions — Economic Stability inputs
 *
 * Fetches the three declared World Bank indicators and persists every input
 * as a component ledger row. A score exists only where all three components
 * are observed in the same reference year; mixed-year candidates are retained
 * as refused rather than labelled with their newest value.
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { isNotNull } from "drizzle-orm";

import { db } from "../src/lib/db";
import { jurisdictions } from "../src/lib/db/schema";
import {
  CURRENT_CONDITIONS_METHODOLOGY_VERSION,
} from "../src/lib/conditions/contract";
import {
  buildEconomicConditionsCalculations,
  type EconomicComponentObservation,
  type EconomicObservation,
} from "../src/lib/conditions/economic";
import { writeConditionScores } from "../src/lib/conditions/ingest";
import { buildIndicatorLineage } from "../src/lib/indicators/lineage";

const SOURCE_ID = "worldbank_economic";
const CONDITIONS_DIMENSION = "economic_stability";
const DRY_RUN = process.argv.includes("--dry-run");

const WB_BASE = "https://api.worldbank.org/v2";
const DATE_RANGE = "2020:2024";
const PER_PAGE = 10;

const INDICATORS = {
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  gdpGrowth: "NY.GDP.MKTP.KD.ZG",
} as const;

interface WbDataPoint {
  year: number;
  value: number;
}

async function fetchIndicator(
  iso2: string,
  indicator: string,
): Promise<EconomicComponentObservation> {
  const url = `${WB_BASE}/country/${iso2}/indicator/${indicator}?format=json&date=${DATE_RANGE}&per_page=${PER_PAGE}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        value: null,
        referenceYear: null,
        valueStatus: "missing",
        valueStatusReason: `World Bank request returned HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as [
      unknown,
      Array<{ date: string; value: number | null }>,
    ];
    if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
      return {
        value: null,
        referenceYear: null,
        valueStatus: "missing",
        valueStatusReason: "World Bank returned an invalid indicator payload",
      };
    }
    const points: WbDataPoint[] = json[1]
      .filter(
        (point): point is { date: string; value: number } =>
          point.value !== null && Number.isFinite(point.value),
      )
      .map((point) => ({ year: Number.parseInt(point.date, 10), value: point.value }))
      .filter((point) => Number.isInteger(point.year));
    const latest = points.sort((a, b) => b.year - a.year)[0];
    if (!latest) {
      return {
        value: null,
        referenceYear: null,
        valueStatus: "not_observed",
        valueStatusReason: "World Bank returned no non-null observation in the requested period",
      };
    }
    return {
      value: latest.value,
      referenceYear: latest.year,
      valueStatus: "observed",
      valueStatusReason: null,
    };
  } catch {
    return {
      value: null,
      referenceYear: null,
      valueStatus: "missing",
      valueStatusReason: "World Bank request failed before an observation was returned",
    };
  }
}

function economicLineages(observations: readonly EconomicObservation[]) {
  const common = {
    sourceId: SOURCE_ID,
    dimension: CONDITIONS_DIMENSION,
    upstreamRelease: `World Bank API indicators ${DATE_RANGE}`,
    temporalCoverage: DATE_RANGE.replace(":", "/"),
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
  return {
    score: buildIndicatorLineage({
      ...common,
      transformationId: "conditions-economic-aligned-z-cdf/v2",
      rows: observations,
    }),
    components: {
      inflation: buildIndicatorLineage({
        ...common,
        indicatorId: INDICATORS.inflation,
        transformationId: "conditions-economic-component/v1",
        rows: observations.map(({ jurisdictionId, inflation }) => ({
          jurisdictionId,
          ...inflation,
        })),
      }),
      unemployment: buildIndicatorLineage({
        ...common,
        indicatorId: INDICATORS.unemployment,
        transformationId: "conditions-economic-component/v1",
        rows: observations.map(({ jurisdictionId, unemployment }) => ({
          jurisdictionId,
          ...unemployment,
        })),
      }),
      gdp_growth: buildIndicatorLineage({
        ...common,
        indicatorId: INDICATORS.gdpGrowth,
        transformationId: "conditions-economic-component/v1",
        rows: observations.map(({ jurisdictionId, gdpGrowth }) => ({
          jurisdictionId,
          ...gdpGrowth,
        })),
      }),
    },
  };
}

async function main() {
  console.log("=== Civica Conditions — Economic Stability inputs ===\n");
  const jurisdictionsWithIso2 = await db
    .select({ id: jurisdictions.id, iso2: jurisdictions.iso2 })
    .from(jurisdictions)
    .where(isNotNull(jurisdictions.iso2));

  console.log(`Fetching World Bank data for ${jurisdictionsWithIso2.length} jurisdictions...`);
  const observations: EconomicObservation[] = [];
  for (let index = 0; index < jurisdictionsWithIso2.length; index += 1) {
    const { id, iso2 } = jurisdictionsWithIso2[index];
    if (!iso2) continue;
    if (index > 0 && index % 20 === 0) {
      console.log(`  ${index}/${jurisdictionsWithIso2.length} fetched...`);
    }
    const [inflation, unemployment, gdpGrowth] = await Promise.all([
      fetchIndicator(iso2, INDICATORS.inflation),
      fetchIndicator(iso2, INDICATORS.unemployment),
      fetchIndicator(iso2, INDICATORS.gdpGrowth),
    ]);
    observations.push({ jurisdictionId: id, inflation, unemployment, gdpGrowth });
  }

  const rows = buildEconomicConditionsCalculations({
    observations,
    methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
    lineages: economicLineages(observations),
  });
  const summary = await writeConditionScores(db, rows, { dryRun: DRY_RUN });
  const aligned = rows.filter((row) => row.alignmentStatus === "aligned").length;
  const mixedYear = rows.filter(
    (row) => row.alignmentStatus === "mixed_year_refused",
  ).length;
  const missing = rows.filter(
    (row) => row.alignmentStatus === "missing_component",
  ).length;

  console.log(`\n${DRY_RUN ? "[DRY RUN] proposed" : "Done:"} ${summary.calculationsWritten || summary.proposed} calculation ledgers and ${summary.componentsWritten || rows.length * 3} component rows.`);
  console.log(`Scores available: ${aligned}; mixed-year refused: ${mixedYear}; missing component: ${missing}.`);
  console.log(`Dimension: ${CONDITIONS_DIMENSION} | Source: ${SOURCE_ID} | Version: ${CURRENT_CONDITIONS_METHODOLOGY_VERSION}`);
}

main().catch((error) => {
  console.error("Ingest failed:", error);
  process.exit(1);
});
