/**
 * Peer-grouping distribution queries.
 *
 * Provides per-lens variants that the civica-index filter bar consumes
 * to populate its V-Dem / World Bank region / income / CGV selects.
 * Read by `src/app/(reader)/civica-index/page.tsx`, which passes the
 * decorated options into `<CivicaIndexFilterBar>`.
 *
 *   ~/civica/plan/peer-grouping-resolution-v1.md
 *   ~/civica/plan/structural-family-removal-implementation-plan.md
 *
 * Note on resolver semantics: the four peer-grouping fact-keys
 * (`world_bank_region`, `world_bank_income_group`, `vdem_row`,
 * `monarchy_status`) are sourced from a single upstream provider
 * each (World Bank, V-Dem, CIA Factbook respectively). Until a
 * second source lands for any of them, "all active rows for a
 * fact-key" reduces cleanly to "the canonical value per
 * jurisdiction". When Phase F admits a second source the
 * `status='active'` filter PLUS Phase F's freshness rule still
 * yield one row per (jurisdiction, fact-key); the queries below
 * tolerate the multi-row case by `COUNT(DISTINCT jurisdiction_id)`.
 */

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { getLatestAvailableQuarter } from "@/lib/db/queries";
import type { TemporalMetadata } from "@/lib/data/temporal-metadata";

export interface LensDistributionEntry {
  /** Canonical value string from `country_facts` (e.g. `liberal_democracy`). */
  key: string;
  totalCount: number;
  scoredCount: number;
}

export type LensTemporalMetadata = TemporalMetadata;

export async function getPeerLensTemporalMetadata(): Promise<Record<string, LensTemporalMetadata>> {
  const factResult = await db.execute(sql`
    SELECT fact_key,
      CASE WHEN COUNT(DISTINCT COALESCE(data_vintage_year, fact_year, EXTRACT(YEAR FROM as_of)::int)) = 1
        THEN MIN(COALESCE(data_vintage_year, fact_year, EXTRACT(YEAR FROM as_of)::int)) END::int AS observation_year,
      CASE WHEN COUNT(DISTINCT upstream_vintage_label) = 1 THEN MIN(upstream_vintage_label) END AS upstream_release,
      MAX(retrieved_at)::text AS retrieved_at,
      CASE WHEN COUNT(DISTINCT methodology_version) = 1 THEN MIN(methodology_version) END AS civica_version
    FROM country_facts
    WHERE status = 'active' AND fact_key IN ('world_bank_region','world_bank_income_group','vdem_row','monarchy_status')
    GROUP BY fact_key
  `);
  const taxonomyResult = await db.execute(sql`
    SELECT regime_year AS observation_year,
      regime_source_dataset_version || ' via ' || regime_dataset_version AS upstream_release,
      regime_retrieved_at::text AS retrieved_at,
      civica_publication_version AS civica_version
    FROM government_taxonomies WHERE regime_type_cgv IS NOT NULL LIMIT 1
  `);
  const rows = queryRows(factResult);
  const output: Record<string, LensTemporalMetadata> = {};
  for (const row of rows) output[String(row.fact_key)] = {
    observationReferenceYear: row.observation_year === null ? null : Number(row.observation_year),
    upstreamDatasetRelease: row.upstream_release ? String(row.upstream_release) : null,
    retrievedAt: row.retrieved_at ? String(row.retrieved_at) : null,
    civicaPublicationVersion: row.civica_version ? String(row.civica_version) : null,
  };
  const cgv = queryRows(taxonomyResult)[0];
  output.regime_type_cgv = cgv ? {
    observationReferenceYear: Number(cgv.observation_year),
    upstreamDatasetRelease: String(cgv.upstream_release),
    retrievedAt: String(cgv.retrieved_at),
    civicaPublicationVersion: String(cgv.civica_version),
  } : { observationReferenceYear: null, upstreamDatasetRelease: null, retrievedAt: null, civicaPublicationVersion: null };
  return output;
}

/* ────────────────────────────────────────────────────────────────
 * World Bank region — material peer lens
 * ──────────────────────────────────────────────────────────────── */

export async function getWorldBankRegionDistribution(
  quarter?: string,
): Promise<LensDistributionEntry[]> {
  return distributionForFactKey("world_bank_region", quarter);
}

/* ────────────────────────────────────────────────────────────────
 * World Bank income group — material peer lens
 * ──────────────────────────────────────────────────────────────── */

export async function getWorldBankIncomeGroupDistribution(
  quarter?: string,
): Promise<LensDistributionEntry[]> {
  return distributionForFactKey("world_bank_income_group", quarter);
}

/* ────────────────────────────────────────────────────────────────
 * V-Dem RoW — governance peer lens
 * ──────────────────────────────────────────────────────────────── */

export async function getVDemRowDistribution(
  quarter?: string,
): Promise<LensDistributionEntry[]> {
  return distributionForFactKey("vdem_row", quarter);
}

/* ────────────────────────────────────────────────────────────────
 * Bjørnskov-Rode / CGV — alternate regime lens
 * ────────────────────────────────────────────────────────────────
 *
 * BR/CGV is still ingested into `government_taxonomies.regime_type_cgv`
 * (legacy column, not yet migrated to country_facts). Until Phase F
 * promotes it, the distribution query reads from that column.
 */

export async function getCgvRegimeDistribution(
  quarter?: string,
): Promise<LensDistributionEntry[]> {
  const q = quarter ?? (await getLatestAvailableQuarter());
  const result = await db.execute(sql`
    SELECT
      gt.regime_type_cgv AS key,
      COUNT(DISTINCT gt.jurisdiction_id)::int AS "totalCount",
      COUNT(DISTINCT cs.jurisdiction_id) FILTER (
        WHERE cs.quarter = ${q} AND cs.score IS NOT NULL
      )::int AS "scoredCount"
    FROM government_taxonomies gt
    JOIN jurisdictions j
      ON j.id = gt.jurisdiction_id
      AND j.type = 'sovereign_state'
    LEFT JOIN ci_composite_scores cs
      ON cs.jurisdiction_id = gt.jurisdiction_id
    WHERE gt.regime_type_cgv IS NOT NULL
    GROUP BY gt.regime_type_cgv
    ORDER BY "totalCount" DESC
  `);
  return rowsToDistribution(result);
}

/* ────────────────────────────────────────────────────────────────
 * Monarchy status — descriptive metadata distribution
 * ──────────────────────────────────────────────────────────────── */

export async function getMonarchyStatusDistribution(
  quarter?: string,
): Promise<LensDistributionEntry[]> {
  return distributionForFactKey("monarchy_status", quarter);
}

/* ────────────────────────────────────────────────────────────────
 * Generic CI-rankings filter by peer lens
 * ────────────────────────────────────────────────────────────────
 *
 * Replaces the `structuralFamily` parameter on `getCIRankings()`.
 * Keep the signature explicit (`lensName` + `lensValue`) — refusing
 * to accept arbitrary fact-key strings prevents accidental coupling
 * to the resolver's larger surface area.
 */

export type RankingsPeerLens =
  | "world_bank_region"
  | "world_bank_income_group"
  | "vdem_row"
  | "cgv_regime"
  | "monarchy_status";

/**
 * Returns the SQL fragment that filters `getCIRankings()` to a
 * single peer-lens cohort. Embed this fragment in the existing
 * query builder; the format mirrors the legacy `familyFilter`
 * pattern.
 *
 * Phase 3 will swap the legacy `structuralFamily` filter on
 * `getCIRankings()` for a call to `buildPeerLensFilter()`.
 */
export function buildPeerLensFilter(
  lensName: RankingsPeerLens | null | undefined,
  lensValue: string | null | undefined,
) {
  if (!lensName || !lensValue) return sql``;
  if (lensName === "cgv_regime") {
    return sql`AND EXISTS (
      SELECT 1 FROM government_taxonomies gt
      WHERE gt.jurisdiction_id = j.id
        AND gt.regime_type_cgv = ${lensValue}
    )`;
  }
  const factKey = factKeyForLens(lensName);
  return sql`AND EXISTS (
    SELECT 1 FROM country_facts cf
    WHERE cf.jurisdiction_id = j.id
      AND cf.fact_key = ${factKey}
      AND cf.status = 'active'
      AND cf.fact_value = ${lensValue}
  )`;
}

function factKeyForLens(lens: Exclude<RankingsPeerLens, "cgv_regime">): string {
  switch (lens) {
    case "world_bank_region":
      return "world_bank_region";
    case "world_bank_income_group":
      return "world_bank_income_group";
    case "vdem_row":
      return "vdem_row";
    case "monarchy_status":
      return "monarchy_status";
  }
}

/* ────────────────────────────────────────────────────────────────
 * Internal — distribution helper for fact-key-backed lenses
 * ──────────────────────────────────────────────────────────────── */

async function distributionForFactKey(
  factKey: string,
  quarter?: string,
): Promise<LensDistributionEntry[]> {
  const q = quarter ?? (await getLatestAvailableQuarter());
  const result = await db.execute(sql`
    SELECT
      cf.fact_value AS key,
      COUNT(DISTINCT cf.jurisdiction_id)::int AS "totalCount",
      COUNT(DISTINCT cs.jurisdiction_id) FILTER (
        WHERE cs.quarter = ${q} AND cs.score IS NOT NULL
      )::int AS "scoredCount"
    FROM country_facts cf
    JOIN jurisdictions j
      ON j.id = cf.jurisdiction_id
      AND j.type = 'sovereign_state'
    LEFT JOIN ci_composite_scores cs
      ON cs.jurisdiction_id = cf.jurisdiction_id
    WHERE cf.fact_key = ${factKey}
      AND cf.status = 'active'
      AND cf.fact_value IS NOT NULL
    GROUP BY cf.fact_value
    ORDER BY "totalCount" DESC
  `);
  return rowsToDistribution(result);
}

function rowsToDistribution(result: unknown): LensDistributionEntry[] {
  const rows = queryRows(result);
  return (rows as Array<{ key: string; totalCount: number; scoredCount: number }>)
    .filter((r) => typeof r.key === "string" && r.key.length > 0)
    .map((row) => ({
      key: row.key,
      totalCount: Number(row.totalCount ?? 0),
      scoredCount: Number(row.scoredCount ?? 0),
    }));
}

function queryRows(result: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? [])) as Array<Record<string, unknown>>;
}
