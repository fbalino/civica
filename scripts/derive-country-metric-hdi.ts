/**
 * DAT-001 canonical HDI country-metric producer.
 *
 * The old `sync-undp-hdi.ts` prototype (not present on the release branch)
 * wrote a small embedded table. The authoritative UNDP adapter now lands
 * source rows in `country_facts`; this deterministic derivation projects the
 * latest active `hdi_score` row into the legacy `country_metrics` read model.
 * It performs no network request and does not stamp source freshness.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { writeCountryMetrics, type CountryMetricInput } from "../src/lib/metrics/ingest";
const DRY_RUN = process.argv.includes("--dry-run");
const ATLAS_RELEASE_ID =
  process.argv
    .find((arg) => arg.startsWith("--release-id="))
    ?.slice("--release-id=".length)
    .trim() ||
  process.env.CIVICA_ATLAS_RELEASE_ID?.trim() ||
  null;

interface HdiRow {
  jurisdiction_id: string;
  iso3: string;
  value: number | string;
  year: number | null;
  source_url: string | null;
}

function competitionRanks(rows: readonly HdiRow[]): Map<string, number> {
  const sorted = [...rows].sort(
    (a, b) => Number(b.value) - Number(a.value) || a.iso3.localeCompare(b.iso3),
  );
  const ranks = new Map<string, number>();
  let previous: number | undefined;
  let rank = 0;
  sorted.forEach((row, index) => {
    const value = Number(row.value);
    if (value !== previous) rank = index + 1;
    ranks.set(row.jurisdiction_id, rank);
    previous = value;
  });
  return ranks;
}

async function main(): Promise<void> {
  if (!DRY_RUN && !ATLAS_RELEASE_ID) {
    throw new Error(
      "A named Atlas release is required: pass --release-id=<id> or set CIVICA_ATLAS_RELEASE_ID.",
    );
  }
  const result = await db.execute(sql`
    SELECT DISTINCT ON (cf.jurisdiction_id)
      cf.jurisdiction_id,
      j.iso3,
      cf.fact_value_numeric AS value,
      cf.fact_year AS year,
      cf.source_url
    FROM country_facts cf
    JOIN jurisdictions j ON j.id = cf.jurisdiction_id
    WHERE cf.source_id = 'undp_hdi'
      AND cf.fact_key = 'hdi_score'
      AND cf.fact_value_numeric IS NOT NULL
      AND (cf.status = 'active' OR cf.status IS NULL)
      AND j.iso3 IS NOT NULL
    ORDER BY
      cf.jurisdiction_id,
      cf.as_of DESC NULLS LAST,
      cf.retrieved_at DESC
  `);
  const rows = (
    Array.isArray(result)
      ? result
      : ((result as { rows?: unknown[] }).rows ?? [])
  ) as HdiRow[];
  if (rows.length === 0) {
    throw new Error(
      "No canonical UNDP hdi_score rows found; run the UNDP factbook sync first.",
    );
  }
  const ranks = competitionRanks(rows);
  let written = 0;
  const output: CountryMetricInput[] = [];
  for (const row of rows) {
    if (!row.year || !Number.isFinite(Number(row.value))) continue;
    output.push({
        jurisdictionId: row.jurisdiction_id,
        metricId: "hdi",
        year: row.year,
        value: Number(row.value),
        rank: ranks.get(row.jurisdiction_id),
        totalRanked: rows.length,
        sourceId: "undp_hdi",
        sourceUrl: row.source_url,
      });
    written += 1;
  }
  await writeCountryMetrics(db, output, {
    dryRun: DRY_RUN,
    stampFreshness: false,
    history: ATLAS_RELEASE_ID
      ? {
          changeKind: "routine_refresh",
          reason: "UNDP HDI canonical metric derivation refresh",
          methodologyVersion: "undp-hdi-country-metric-derivation/v1",
          releaseId: ATLAS_RELEASE_ID,
        }
      : undefined,
  });
  console.log(`${DRY_RUN ? "[DRY RUN] proposed" : "Derived"} ${written} HDI country-metric rows from canonical facts.`);
}

main().catch((error) => {
  console.error("Failed to derive HDI country metrics:", error);
  process.exitCode = 1;
});
