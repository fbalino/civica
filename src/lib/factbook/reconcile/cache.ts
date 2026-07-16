/**
 * Phase F.3.5 — Jurisdictions cache refresh.
 *
 * Walks every jurisdiction, runs the resolver for each cached
 * fact-key, and writes the canonical value back into the
 * corresponding `jurisdictions` column. This is the only place
 * allowed to write to those columns; surfaces that need fast
 * bounded-freshness reads consume from `readCachedField()` in `api.ts`.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §1.0
 * Schema doc:  ~/civica/plan/phase-f-schema-v0.1.md §11
 * Plan:        ~/civica/plan/phase-f-implementation-plan.md F.3.5
 *
 * The contract: the resolver IS the source of truth. These cache
 * columns are eventually-consistent. The cron runs nightly after
 * sync jobs complete (06:30 UTC).
 */

import { eq } from "drizzle-orm";

import { jurisdictions } from "@/lib/db/schema";
import {
  getCanonicalFactsForJurisdiction,
  type CachedField,
} from "./api";

type Db = typeof import("@/lib/db").db;

/**
 * Mapping from `jurisdictions` cached column → canonical fact-key.
 *
 * If a fact-key flip in F.3 hasn't happened yet (i.e. the resolver
 * still prefers CIA), the cache value will be the CIA value — same
 * as today. Once the flip happens, the cache picks up the new
 * canonical value automatically on the next nightly run.
 */
const COLUMN_TO_FACT_KEY: Record<CachedField, string> = {
  capital: "capital",
  population: "population_total",
  // jurisdictions.gdp_billions has historically held PPP GDP per
  // the 2026-05-01 atlas-masthead-facts decision (project memory):
  // "GDP in the masthead is CIA Factbook real GDP PPP and must be
  // labeled GDP (PPP). If a future task switches to nominal GDP,
  // update the label and source at the same time." We keep PPP
  // here so existing display labels stay correct. F.4's atlas
  // masthead migration will change to resolver-direct calls and
  // can pick nominal vs PPP explicitly per surface.
  gdpBillions: "gdp_ppp_usd_billions",
  areaSqKm: "area_total_km2",
  languages: "official_languages",
  currency: "currency_code",
  democracyIndex: "vdem_row",
};

const ALL_FACT_KEYS = Object.values(COLUMN_TO_FACT_KEY);

export interface CacheRefreshSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsRefreshed: number;
  /** Non-null canonical values committed (or projected by a dry run). */
  fieldsWritten: number;
  /** Withdrawn/unavailable canonical values cleared (or projected by a dry run). */
  fieldsCleared: number;
  errors: string[];
  dryRun: boolean;
}

export interface CacheJurisdiction {
  id: string;
  slug: string;
}

/**
 * Refresh the jurisdictions cache for all jurisdictions, or for a
 * single jurisdiction if `jurisdictionId` is provided.
 *
 * For each jurisdiction:
 *   1. Batch-resolve all 7 cached fact-keys.
 *   2. For each resolved value, normalise into the column's type
 *      and write back to `jurisdictions`.
 *   3. Stamp `fact_cache_refreshed_at = NOW()`.
 *
 * Idempotent on re-run. Errors per-jurisdiction are caught and
 * counted; one bad jurisdiction doesn't fail the whole pass.
 */
export async function refreshJurisdictionCache(
  db: Db,
  options: {
    jurisdictionId?: string;
    onProgress?: (line: string) => void;
    dryRun?: boolean;
    jurisdictions?: CacheJurisdiction[];
    resolveFacts?: typeof getCanonicalFactsForJurisdiction;
  } = {}
): Promise<CacheRefreshSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});

  const jurisdictionRows = options.jurisdictions ?? (options.jurisdictionId
    ? await db
        .select({ id: jurisdictions.id, slug: jurisdictions.slug })
        .from(jurisdictions)
        .where(eq(jurisdictions.id, options.jurisdictionId))
    : await db
        .select({ id: jurisdictions.id, slug: jurisdictions.slug })
        .from(jurisdictions));

  log(
    `${jurisdictionRows.length} jurisdiction(s) to refresh; ${ALL_FACT_KEYS.length} cached fact-keys.`
  );

  let jurisdictionsRefreshed = 0;
  let fieldsWritten = 0;
  let fieldsCleared = 0;
  const errors: string[] = [];

  for (const j of jurisdictionRows) {
    try {
      const resolved = await (options.resolveFacts ?? getCanonicalFactsForJurisdiction)(
        j.id,
        ALL_FACT_KEYS
      );

      // Every cache column participates in the same atomic update. A missing
      // canonical clears its former value; retaining it while advancing the
      // refresh timestamp would falsely relabel stale data as current.
      const update: {
        capital: string | null;
        population: number | null;
        gdpBillions: number | null;
        areaSqKm: number | null;
        languages: string | null;
        currency: string | null;
        democracyIndex: number | null;
        factCacheRefreshedAt: Date;
      } = {
        capital: null,
        population: null,
        gdpBillions: null,
        areaSqKm: null,
        languages: null,
        currency: null,
        democracyIndex: null,
        factCacheRefreshedAt: new Date(),
      };

      const popResult = resolved["population_total"];
      if (popResult?.canonical) {
        const v = popResult.canonical.factValueNumeric;
        update.population = v === null ? null : Math.round(v);
      }

      const gdpResult = resolved["gdp_ppp_usd_billions"];
      if (gdpResult?.canonical) {
        update.gdpBillions = gdpResult.canonical.factValueNumeric;
      }

      const areaResult = resolved["area_total_km2"];
      if (areaResult?.canonical) {
        const v = areaResult.canonical.factValueNumeric;
        update.areaSqKm = v === null ? null : Math.round(v);
      }

      const capitalResult = resolved["capital"];
      if (capitalResult?.canonical?.factValue) {
        update.capital = capitalResult.canonical.factValue;
      }

      const langsResult = resolved["official_languages"];
      if (langsResult?.canonical?.factValue) {
        update.languages = langsResult.canonical.factValue;
      }

      const currencyResult = resolved["currency_code"];
      if (currencyResult?.canonical?.factValue) {
        update.currency = currencyResult.canonical.factValue;
      }

      // democracy_index column historically held a numeric scalar
      // representing democracy. With Phase F's vdem_row cache target,
      // we map the V-Dem RoW bucket to a 1–4 numeric for back-compat
      // with surfaces that read jurisdictions.democracy_index as a
      // sortable number. F.4's site-wide migration replaces those
      // reads with resolver calls, at which point this mapping can
      // be retired.
      const vdemResult = resolved["vdem_row"];
      if (vdemResult?.canonical?.factValue) {
        update.democracyIndex = mapVdemRowToOrdinal(
          vdemResult.canonical.factValue
        );
      }

      const cacheValues = [
        update.capital,
        update.population,
        update.gdpBillions,
        update.areaSqKm,
        update.languages,
        update.currency,
        update.democracyIndex,
      ];
      const jurisdictionFieldsWritten = cacheValues.filter(
        (value) => value !== null
      ).length;
      const jurisdictionFieldsCleared =
        cacheValues.length - jurisdictionFieldsWritten;

      if (!options.dryRun) {
        const updated = await db
          .update(jurisdictions)
          .set(update)
          .where(eq(jurisdictions.id, j.id))
          .returning({ id: jurisdictions.id });
        if (updated.length !== 1) {
          throw new Error(
            `cache refresh expected one committed jurisdiction row; updated ${updated.length}`
          );
        }
      }

      // Counts advance only after the atomic update is confirmed. Dry runs
      // intentionally report the same projected counts without writing.
      fieldsWritten += jurisdictionFieldsWritten;
      fieldsCleared += jurisdictionFieldsCleared;
      jurisdictionsRefreshed++;
    } catch (err) {
      const msg = `${j.slug}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      log(`! ${msg}`);
    }
  }

  const finishedAtMs = Date.now();
  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsRefreshed,
    fieldsWritten,
    fieldsCleared,
    errors,
    dryRun: options.dryRun ?? false,
  };
}

/**
 * Map V-Dem Regimes of the World bucket label to a 1–4 ordinal.
 * Used to keep `jurisdictions.democracy_index` (numeric column)
 * populated for legacy callers. Higher = more democratic.
 *
 * Closed Autocracy = 1, Electoral Autocracy = 2,
 * Electoral Democracy = 3, Liberal Democracy = 4.
 */
export function mapVdemRowToOrdinal(label: string): number | null {
  const norm = label.toLowerCase();
  if (norm.includes("liberal democracy")) return 4;
  if (norm.includes("electoral democracy")) return 3;
  if (norm.includes("electoral autocracy")) return 2;
  if (norm.includes("closed autocracy")) return 1;
  return null;
}
