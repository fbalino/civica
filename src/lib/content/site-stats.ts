/**
 * Civica site-stats — live DB-driven counters for reader-facing copy.
 *
 *   Adopted via: ~/civica/plan/site-stale-content-audit-v1.md (Phase 1)
 *   Companion :  src/lib/content/site-state.ts (typed project-state config)
 *
 * `getSiteStats()` returns the live counts that reader-facing pages
 * embed in prose: active source orchestrators writing into
 * `country_facts`, total reconciled facts, distinct fact-keys,
 * multi-sourced fact-key tiers, jurisdiction coverage, and so on.
 *
 * Server-only. The function is wrapped in React's `cache()` helper so
 * a single render of `/about` (or wherever this gets interpolated)
 * issues exactly one DB round-trip even when many places on the page
 * read different fields. Across requests the cache resets, so the
 * values reflect fresh DB state on every page load. This matches the
 * pattern already used by `src/lib/atlas/load-atlas-data.ts`.
 *
 * **Editing this file:** queries are independent, small, and addressed
 * by name. Add a new field by adding a new query helper and a new
 * line in the `SiteStats` interface — the function shape will catch
 * shape drift at build time.
 *
 * **Multi-canonical fact-keys** are NOT in this file because the
 * `civicaRole: 'canonical'` assertion lives in per-source orchestrator
 * configs (`src/lib/factbook/reconcile/sync-*.ts`), not in the
 * database. That value lives in `site-state.ts::multiCanonicalFactKeys`
 * as a hand-maintained list, updated when a methodology resolution
 * adds a new canonical-overlap.
 */

import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────
// Public shape
// ─────────────────────────────────────────────────────────────────────

export interface SiteStats {
  /** Distinct `source_id` values currently writing rows into
   *  `country_facts`. Drives the README "14 active source
   *  orchestrators" claim and the methodology-approach Tier-1 list. */
  activeSources: number;

  /** Total rows in the `sources` registry table (the broad universe
   *  Civica integrates from — includes non-factbook sources like
   *  IPU Parline, congress_gov, uk_parliament, parlgov, eu_parliament,
   *  the Constitute Project, etc.). The About page surfaces this number
   *  intentionally; it's the count of *all* sources Civica draws from,
   *  not just the subset feeding the reconciliation layer. */
  totalSourcesInRegistry: number;

  /** Top-N source contributors by row count. Useful for the About
   *  page's source breakdown and any future "biggest contributors"
   *  prose. Ordered DESC by row count. */
  sourcesByVolume: Array<{
    sourceId: string;
    factCount: number;
  }>;

  /** Total rows in `country_facts`. Drives the README "~26,000
   *  reconciled facts" claim. */
  totalFacts: number;

  /** Distinct `fact_key` values with at least one row in
   *  `country_facts`. Drives the README "88 declared fact-keys"
   *  claim. Reads from data; the registry size in `fact-keys.ts` is
   *  a different number (fact-keys *declared* — not all of them are
   *  populated yet). */
  distinctFactKeys: number;

  /** Fact-keys where at least one country has rows from ≥2 distinct
   *  sources. Drives the README "Multi-sourced fact-keys (≥2 sources)"
   *  metric. */
  multiSourcedFactKeys: number;

  /** Same as above for ≥3, ≥5, ≥6 source thresholds. */
  threeSourceFactKeys: number;
  fiveSourceFactKeys: number;
  sixSourceFactKeys: number;

  /** Fact-keys with rows but only single-sourced for every country
   *  that has them. Computed as `distinctFactKeys − multiSourcedFactKeys`.
   *  Drives the methodology-approach "~50 of 88 declared fact-keys
   *  currently have only one publisher" claim. */
  singleSourcedFactKeys: number;

  /** Names of fact-keys that have at least one country with ≥5 sources.
   *  Used to populate the "5+ source fact-keys" cell on the README
   *  status table with the actual list (currently
   *  population/life-expectancy/unemployment, may grow as more sync
   *  orchestrators land). */
  fiveSourceFactKeyNames: string[];

  /** Total rows in `jurisdictions` table (includes territories
   *  without iso3 codes). */
  totalJurisdictions: number;

  /** Jurisdictions with iso3 set — the "covered" universe per the
   *  reconciliation methodology page §scope. Drives the replication
   *  page's "all 197 scored jurisdictions" claim. */
  jurisdictionsWithIso3: number;

  /** Per-fact-key MAXIMUM number of distinct sources any single country
   *  carries for that fact. Drives the reconciliation methodology page's
   *  "headline reconciled fact-keys carry six or more publishers each"
   *  prose (unemployment rate, population, inflation, etc.) — read live so
   *  the counts never drift from the DB. Keyed by `fact_key`. */
  factKeyMaxSources: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────
// Query helpers — small, named, individually addressable for tests
// ─────────────────────────────────────────────────────────────────────

async function queryScalar(query: ReturnType<typeof sql>): Promise<number> {
  const res = await db.execute(query);
  const rows = (res as unknown as { rows?: unknown[] }).rows ?? res;
  const row = (rows as Array<{ n?: number | string }>)[0];
  return Number(row?.n ?? 0);
}

async function queryActiveSources(): Promise<number> {
  return queryScalar(
    sql`SELECT COUNT(DISTINCT source_id)::int AS n FROM country_facts`,
  );
}

async function queryTotalSources(): Promise<number> {
  return queryScalar(sql`SELECT COUNT(*)::int AS n FROM sources`);
}

async function querySourcesByVolume(
  limit = 25,
): Promise<SiteStats["sourcesByVolume"]> {
  const res = await db.execute(
    sql`SELECT source_id, COUNT(*)::int AS row_count
        FROM country_facts
        GROUP BY source_id
        ORDER BY row_count DESC
        LIMIT ${limit}`,
  );
  const rows = (res as unknown as { rows?: unknown[] }).rows ?? res;
  return (rows as Array<{ source_id: string; row_count: number }>).map((r) => ({
    sourceId: r.source_id,
    factCount: Number(r.row_count),
  }));
}

async function queryTotalFacts(): Promise<number> {
  return queryScalar(sql`SELECT COUNT(*)::int AS n FROM country_facts`);
}

async function queryDistinctFactKeys(): Promise<number> {
  return queryScalar(
    sql`SELECT COUNT(DISTINCT fact_key)::int AS n FROM country_facts`,
  );
}

async function queryMultiSourcedFactKeys(threshold: number): Promise<number> {
  return queryScalar(
    sql`SELECT COUNT(DISTINCT fact_key)::int AS n FROM (
          SELECT fact_key, jurisdiction_id
          FROM country_facts
          GROUP BY fact_key, jurisdiction_id
          HAVING COUNT(DISTINCT source_id) >= ${threshold}
        ) sub`,
  );
}

async function queryFiveSourceFactKeyNames(): Promise<string[]> {
  const res = await db.execute(
    sql`SELECT DISTINCT fact_key
        FROM (
          SELECT fact_key, jurisdiction_id
          FROM country_facts
          GROUP BY fact_key, jurisdiction_id
          HAVING COUNT(DISTINCT source_id) >= 5
        ) sub
        ORDER BY fact_key`,
  );
  const rows = (res as unknown as { rows?: unknown[] }).rows ?? res;
  return (rows as Array<{ fact_key: string }>).map((r) => r.fact_key);
}

async function queryFactKeyMaxSources(): Promise<Record<string, number>> {
  // For each fact_key, the largest distinct-source count any single
  // jurisdiction has for it. This is the "N publishers" number the
  // reconciliation page cites per headline fact-key.
  const res = await db.execute(
    sql`SELECT fact_key, MAX(src)::int AS max_sources
        FROM (
          SELECT fact_key, jurisdiction_id, COUNT(DISTINCT source_id) AS src
          FROM country_facts
          GROUP BY fact_key, jurisdiction_id
        ) t
        GROUP BY fact_key`,
  );
  const rows = (res as unknown as { rows?: unknown[] }).rows ?? res;
  const out: Record<string, number> = {};
  for (const r of rows as Array<{ fact_key: string; max_sources: number }>) {
    out[r.fact_key] = Number(r.max_sources);
  }
  return out;
}

async function queryTotalJurisdictions(): Promise<number> {
  return queryScalar(sql`SELECT COUNT(*)::int AS n FROM jurisdictions`);
}

async function queryJurisdictionsWithIso3(): Promise<number> {
  return queryScalar(
    sql`SELECT COUNT(*)::int AS n FROM jurisdictions WHERE iso3 IS NOT NULL`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────

/**
 * Returns the live site-stats counter object. Cached for the duration
 * of a single React render via `cache()` — multiple interpolations on
 * the same page issue exactly one round-trip per stat. Across renders
 * the cache resets, so values stay fresh on every page load.
 *
 * Throws if `DATABASE_URL` is unset or the DB is unreachable. Callers
 * that want soft-fail behaviour (e.g., methodology pages that should
 * still render when the DB is down) should wrap in try/catch.
 */
export const getSiteStats = cache(async (): Promise<SiteStats> => {
  // All queries are independent — fire in parallel.
  const [
    activeSources,
    totalSourcesInRegistry,
    sourcesByVolume,
    totalFacts,
    distinctFactKeys,
    multiSourcedFactKeys,
    threeSourceFactKeys,
    fiveSourceFactKeys,
    sixSourceFactKeys,
    fiveSourceFactKeyNames,
    totalJurisdictions,
    jurisdictionsWithIso3,
    factKeyMaxSources,
  ] = await Promise.all([
    queryActiveSources(),
    queryTotalSources(),
    querySourcesByVolume(),
    queryTotalFacts(),
    queryDistinctFactKeys(),
    queryMultiSourcedFactKeys(2),
    queryMultiSourcedFactKeys(3),
    queryMultiSourcedFactKeys(5),
    queryMultiSourcedFactKeys(6),
    queryFiveSourceFactKeyNames(),
    queryTotalJurisdictions(),
    queryJurisdictionsWithIso3(),
    queryFactKeyMaxSources(),
  ]);

  return {
    activeSources,
    totalSourcesInRegistry,
    sourcesByVolume,
    totalFacts,
    distinctFactKeys,
    multiSourcedFactKeys,
    threeSourceFactKeys,
    fiveSourceFactKeys,
    sixSourceFactKeys,
    singleSourcedFactKeys: distinctFactKeys - multiSourcedFactKeys,
    fiveSourceFactKeyNames,
    totalJurisdictions,
    jurisdictionsWithIso3,
    factKeyMaxSources,
  };
});
