/**
 * Peer-grouping distribution queries.
 *
 * Provides per-lens variants that the civica-index left rail consumes
 * during Phase 3. These
 * queries do NOT yet plug into any rendered surface — Phase 3 wires
 * them into `(shell)/@left/civica-index/page.tsx`.
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

export interface LensDistributionEntry {
  /** Canonical value string from `country_facts` (e.g. `liberal_democracy`). */
  key: string;
  totalCount: number;
  scoredCount: number;
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
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  return (rows as Array<{ key: string; totalCount: number; scoredCount: number }>)
    .filter((r) => typeof r.key === "string" && r.key.length > 0)
    .map((row) => ({
      key: row.key,
      totalCount: Number(row.totalCount ?? 0),
      scoredCount: Number(row.scoredCount ?? 0),
    }));
}

/* ────────────────────────────────────────────────────────────────
 * Per-country migration table (Phase 4 deliverable)
 * ────────────────────────────────────────────────────────────────
 *
 * Joins every sovereign state with its retired structural_family
 * value AND its replacement peer-lens fields. Used by the migration-
 * table API endpoint and reader page. Replication-script maintainers
 * call the JSON endpoint to bulk-rewrite their joins.
 */

export interface PeerGroupingMigrationRow {
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  /** Retired heuristic value (deprecated, sunset 2027-03-31). */
  structuralFamily: string | null;
  structuralSubtype: string | null;
  /** Replacement peer-lens fields. */
  worldBankRegion: string | null;
  worldBankIncomeGroup: string | null;
  vdemRow: string | null;
  cgvRegime: string | null;
  monarchyStatus: string | null;
  governmentFormDescription: string | null;
}

export async function getPeerGroupingMigrationTable(): Promise<
  PeerGroupingMigrationRow[]
> {
  const result = await db.execute(sql`
    SELECT
      j.slug,
      j.name,
      j.iso2,
      j.iso3,
      gt.structural_family   AS "structuralFamily",
      gt.structural_subtype  AS "structuralSubtype",
      gt.regime_type_cgv     AS "cgvRegime",
      (
        SELECT cf.fact_value FROM country_facts cf
        WHERE cf.jurisdiction_id = j.id
          AND cf.fact_key = 'world_bank_region'
          AND cf.status = 'active'
        LIMIT 1
      ) AS "worldBankRegion",
      (
        SELECT cf.fact_value FROM country_facts cf
        WHERE cf.jurisdiction_id = j.id
          AND cf.fact_key = 'world_bank_income_group'
          AND cf.status = 'active'
        LIMIT 1
      ) AS "worldBankIncomeGroup",
      (
        SELECT cf.fact_value FROM country_facts cf
        WHERE cf.jurisdiction_id = j.id
          AND cf.fact_key = 'vdem_row'
          AND cf.status = 'active'
        LIMIT 1
      ) AS "vdemRow",
      (
        SELECT cf.fact_value FROM country_facts cf
        WHERE cf.jurisdiction_id = j.id
          AND cf.fact_key = 'monarchy_status'
          AND cf.status = 'active'
        LIMIT 1
      ) AS "monarchyStatus",
      (
        SELECT cf.fact_value FROM country_facts cf
        WHERE cf.jurisdiction_id = j.id
          AND cf.fact_key = 'government_form_description'
          AND cf.status = 'active'
        LIMIT 1
      ) AS "governmentFormDescription"
    FROM jurisdictions j
    LEFT JOIN government_taxonomies gt
      ON gt.jurisdiction_id = j.id
      AND gt.taxonomy_version = '2026_v1'
    WHERE j.type = 'sovereign_state'
      AND LOWER(j.name) <> 'none'
    ORDER BY j.name
  `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  return (rows as PeerGroupingMigrationRow[]).map((row) => ({
    slug: row.slug,
    name: row.name,
    iso2: row.iso2,
    iso3: row.iso3,
    structuralFamily: row.structuralFamily,
    structuralSubtype: row.structuralSubtype,
    worldBankRegion: row.worldBankRegion,
    worldBankIncomeGroup: row.worldBankIncomeGroup,
    vdemRow: row.vdemRow,
    cgvRegime: row.cgvRegime,
    monarchyStatus: row.monarchyStatus,
    governmentFormDescription: row.governmentFormDescription,
  }));
}
