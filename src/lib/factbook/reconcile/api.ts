/**
 * Phase F.3.5 — Canonical fact read API.
 *
 * The single read path every Civica surface consumes for in-scope
 * facts (population, GDP, area, capital, etc.). Surfaces that
 * need provenance or alternates call these functions directly.
 * Surfaces that only need the display value AND accept up-to-24h
 * staleness may read the denormalised `jurisdictions` cache
 * columns (refreshed nightly by `scripts/refresh-jurisdiction-cache.ts`).
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §1.0 (site-wide rule)
 * Schema doc:  ~/civica/plan/phase-f-schema-v0.1.md §11
 * Plan:        ~/civica/plan/phase-f-implementation-plan.md F.3.5
 *
 * The contract: the resolver IS the source of truth. The
 * `jurisdictions` quantitative columns are eventually-consistent
 * with resolver output. Any surface displaying provenance or
 * alternates calls `getCanonicalFact()` / batch variants.
 *
 * For lint enforcement (banning direct `jurisdictions.population`
 * reads from new code), see `.eslintrc` at project root once F.4
 * lands the rule.
 */

import { eq, sql, and, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { countryFacts, jurisdictions, dataDisputes } from "@/lib/db/schema";
import { resolveFromRows } from "./resolver";
import { getFactKey } from "./fact-keys";
import type { FactRow, ResolverOutput } from "./types";

/**
 * Phase F.4 — public-API metadata block.
 *
 * Sibling of `CI_METHODOLOGY_META` and `PULSE_METHODOLOGY_META` in
 * `src/lib/api/helpers.ts`. API endpoints that surface reconciled
 * facts (`/api/v1/countries/[code]`, the country export route, the
 * embed widget) include this object as `meta.reconciliation` in
 * their response envelope so machine consumers can detect the
 * Phase F development phase, version handle, and citation vintage.
 *
 * The vintage handle updates quarterly via the snapshot script
 * (`scripts/snapshot-fact-vintage.ts`); when a new vintage is cut,
 * update `vintage` here in the same commit so API responses cite
 * the live frozen snapshot.
 */
export const FACTBOOK_RECONCILIATION_META = Object.freeze({
  status: "beta" as const,
  version: "v0.1",
  reference:
    "https://civicaatlas.org/factbook/methodology/reconciliation",
  vintage: "Civica Atlas 2026Q3",
});

/**
 * Human-readable labels for source IDs. Mirrors (and is the
 * canonical source for) the SOURCE_LABELS in `FactValuePanel.tsx`
 * — both should reference this map. Add new entries when a sync
 * adds a new source ID.
 */
export const SOURCE_LABELS: Record<string, string> = {
  cia_factbook: "CIA World Factbook",
  wikidata: "Wikidata",
  world_bank: "World Bank",
  imf_weo: "IMF (WEO)",
  un_data: "UN Statistics Division",
  unesco_uis: "UNESCO Institute for Statistics",
  who_gho: "WHO Global Health Observatory",
  oecd_stat: "OECD.Stat",
  fao_faostat: "FAO FAOSTAT",
  iea_data: "International Energy Agency",
  ilo_ilostat: "ILO ILOSTAT",
  eurostat: "Eurostat",
  wto_stats: "WTO Stats",
  vdem: "V-Dem",
  undp_hdi: "UNDP HDR",
  // R.13 — NSO Wave 1, first phase. Per
  // `~/civica/plan/us-census-resolution-v1.md` §3 step 9.
  us_census: "US Census Bureau",
  // R.14 — NSO Wave 1, ONS (UK). Per
  // `~/civica/plan/ons-uk-resolution-v1.md` §3 step 6.
  ons_uk: "ONS (UK)",
  // R.15 — NSO Wave 1, INSEE (France). Per
  // `~/civica/plan/insee-fr-resolution-v1.md` §3 step 3.
  insee_fr: "INSEE (France)",
  // R.17 — NSO Wave 2, Statistics Canada. Per
  // `~/civica/plan/statcan-resolution-v1.md` §3 step 3.
  statcan_ca: "Statistics Canada",
  // R.18 — NSO Wave 2, IBGE (Brazil). Per
  // `~/civica/plan/ibge-br-resolution-v1.md` §3 step 3.
  ibge_br: "IBGE (Brazil)",
};

export function sourceName(sourceId: string): string {
  return SOURCE_LABELS[sourceId] ?? sourceId;
}

/**
 * One alternate source's data, as serialised in the public API's
 * `provenance.{field}.alternates` array.
 */
export interface ApiAlternate {
  source: string;
  sourceName: string;
  /** Numeric when the upstream value is numeric; otherwise the
   *  display string. */
  value: number | string | null;
  asOf: string | null;
  vintageLabel: string | null;
  url: string | null;
  rejected?: true;
  rejectionReason?: string;
  /** Bug 1 — `'measured'` (default) or `'projected'`. UIs render a
   *  visual badge (e.g. amber "projected" pill) when the value is a
   *  forecast/projection. See `~/civica/plan/forecast-vs-measurement-v1.md`. */
  valueType: "measured" | "projected";
}

/**
 * Per-fact provenance entry as serialised in the public API's
 * `provenance.{field}` object.
 *
 * `factKey` cross-references the canonical Phase F fact-key (e.g.
 * "population_total") so consumers can look up the methodology's
 * definition. The flat field name (e.g. "population") matches the
 * back-compat top-level field on the country object.
 */
export interface ApiProvenanceEntry {
  factKey: string;
  source: string;
  sourceName: string;
  asOf: string | null;
  vintageLabel: string | null;
  decisionReason: string;
  isDisputed: boolean;
  alternates: ApiAlternate[];
  /** Bug 1 — `'measured'` (default) or `'projected'`. The canonical
   *  row's value type. Always `'measured'` unless no measurement was
   *  available and the resolver fell back to a projection (e.g.
   *  `fiscal_balance_pct_gdp`, where IMF is the only source globally
   *  and IMF only ships projections). See
   *  `~/civica/plan/forecast-vs-measurement-v1.md` § 2e. */
  valueType: "measured" | "projected";
  /** Bug 1 — convenience flag mirroring
   *  `ResolverOutput.canonicalIsProjection`. True iff `valueType ===
   *  'projected'`; broken out for callers that prefer a flag-shaped
   *  boolean over an enum check. */
  canonicalIsProjection: boolean;
}

function buildAlternateUrl(row: FactRow): string | null {
  if (row.sourceUrl) return row.sourceUrl;
  if (row.sourceId === "wikidata" && row.wikidataQid && row.wikidataPid) {
    return `https://www.wikidata.org/wiki/${row.wikidataQid}#${row.wikidataPid}`;
  }
  return null;
}

function alternateValue(row: FactRow): number | string | null {
  if (row.factValueNumeric !== null && Number.isFinite(row.factValueNumeric)) {
    return row.factValueNumeric;
  }
  return row.factValue;
}

/**
 * Construct a public-API provenance entry from a `ResolverOutput`.
 *
 * The chosen row becomes the entry's metadata (source, asOf,
 * decisionReason, …). Other rows from `output.all` (active and
 * rejected) become the `alternates` array. Returns `null` if the
 * resolver returned no canonical row — the caller should omit the
 * provenance entry entirely in that case.
 */
export function buildApiProvenanceEntry(
  factKey: string,
  output: ResolverOutput
): ApiProvenanceEntry | null {
  const canonical = output.canonical;
  if (!canonical) return null;

  const alternates: ApiAlternate[] = output.all
    .filter((r) => r.id !== canonical.id)
    .map((row) => {
      const entry: ApiAlternate = {
        source: row.sourceId,
        sourceName: sourceName(row.sourceId),
        value: alternateValue(row),
        asOf: row.asOf,
        vintageLabel: row.upstreamVintageLabel,
        url: buildAlternateUrl(row),
        // Bug 1 — surface the per-row valueType so consumers can
        // render a "projected" badge on alternate rows.
        valueType: row.valueType,
      };
      if (row.status === "rejected") {
        entry.rejected = true;
        if (row.statusReason) entry.rejectionReason = row.statusReason;
      }
      return entry;
    });

  return {
    factKey,
    source: canonical.sourceId,
    sourceName: sourceName(canonical.sourceId),
    asOf: canonical.asOf,
    vintageLabel: canonical.upstreamVintageLabel,
    decisionReason: output.decisionReason,
    isDisputed: output.isDisputed,
    alternates,
    valueType: canonical.valueType,
    canonicalIsProjection: output.canonicalIsProjection,
  };
}

/**
 * Fetch all rows from `country_facts` for a given (jurisdiction,
 * fact_key) pair, hydrate to `FactRow[]`, run the resolver, and
 * stamp `isDisputed` from the dispute queue.
 *
 * Returns a `ResolverOutput` with `canonical` set to the chosen
 * row (or `null` if no rows exist for that key).
 */
export async function getCanonicalFact(
  jurisdictionId: string,
  factKey: string
): Promise<ResolverOutput> {
  const factKeyDef = getFactKey(factKey);

  const dbRows = await db
    .select()
    .from(countryFacts)
    .where(
      and(
        eq(countryFacts.jurisdictionId, jurisdictionId),
        eq(countryFacts.factKey, factKey)
      )
    );

  const rows: FactRow[] = dbRows.map(dbRowToFactRow);

  // Empty-fact-key fallback: registry doesn't know this key. Return
  // a minimal "single_source" if there's exactly one row, else null.
  if (!factKeyDef) {
    if (rows.length === 0) {
      return {
        jurisdictionId,
        factKey,
        canonical: null,
        alternates: [],
        all: [],
        isDisputed: false,
        decisionReason: "no_active_rows",
        proposedDisputes: [],
        canonicalIsProjection: false,
      };
    }
    const active = rows.filter((r) => r.status === "active");
    const canonical = active[0] ?? null;
    return {
      jurisdictionId,
      factKey,
      canonical,
      alternates: active,
      all: rows,
      isDisputed: false,
      decisionReason: active.length > 0 ? "single_source" : "no_active_rows",
      proposedDisputes: [],
      canonicalIsProjection: canonical?.valueType === "projected",
    };
  }

  const resolution = resolveFromRows(rows, factKeyDef);

  // Check the dispute queue.
  const openDisputes = await db
    .select({ id: dataDisputes.id })
    .from(dataDisputes)
    .where(
      and(
        eq(dataDisputes.jurisdictionId, jurisdictionId),
        eq(dataDisputes.factKey, factKey),
        sql`${dataDisputes.status} IN ('open', 'in_review')`
      )
    )
    .limit(1);
  const isDisputed = openDisputes.length > 0;

  return {
    jurisdictionId,
    factKey,
    ...resolution,
    isDisputed,
  };
}

/**
 * Batch-fetch canonical facts for one jurisdiction across multiple
 * fact-keys. Returns a map keyed by factKey.
 *
 * Single SQL hit + per-key resolver. Use this for surfaces that
 * need several facts about the same country (atlas masthead,
 * factbook header, civica-index country card).
 */
export async function getCanonicalFactsForJurisdiction(
  jurisdictionId: string,
  factKeys: string[]
): Promise<Record<string, ResolverOutput>> {
  if (factKeys.length === 0) return {};

  const dbRows = await db
    .select()
    .from(countryFacts)
    .where(
      and(
        eq(countryFacts.jurisdictionId, jurisdictionId),
        inArray(countryFacts.factKey, factKeys)
      )
    );

  // Group by factKey.
  const byKey = new Map<string, FactRow[]>();
  for (const r of dbRows.map(dbRowToFactRow)) {
    let bucket = byKey.get(r.factKey);
    if (!bucket) {
      bucket = [];
      byKey.set(r.factKey, bucket);
    }
    bucket.push(r);
  }

  // Disputes lookup in one query.
  const disputeRows = await db
    .select({
      factKey: dataDisputes.factKey,
    })
    .from(dataDisputes)
    .where(
      and(
        eq(dataDisputes.jurisdictionId, jurisdictionId),
        inArray(dataDisputes.factKey, factKeys),
        sql`${dataDisputes.status} IN ('open', 'in_review')`
      )
    );
  const disputedKeys = new Set(disputeRows.map((d) => d.factKey));

  const out: Record<string, ResolverOutput> = {};
  for (const factKey of factKeys) {
    const rows = byKey.get(factKey) ?? [];
    const factKeyDef = getFactKey(factKey);
    if (!factKeyDef) {
      const active = rows.filter((r) => r.status === "active");
      const canonical = active[0] ?? null;
      out[factKey] = {
        jurisdictionId,
        factKey,
        canonical,
        alternates: active,
        all: rows,
        isDisputed: disputedKeys.has(factKey),
        decisionReason:
          active.length > 0 ? "single_source" : "no_active_rows",
        proposedDisputes: [],
        canonicalIsProjection: canonical?.valueType === "projected",
      };
      continue;
    }

    const resolution = resolveFromRows(rows, factKeyDef);
    out[factKey] = {
      jurisdictionId,
      factKey,
      ...resolution,
      isDisputed: disputedKeys.has(factKey),
    };
  }

  return out;
}

/**
 * Batch-fetch canonical facts for many jurisdictions × many
 * fact-keys. Used by list-shaped surfaces (civica-index
 * leaderboard, country list, world map hover, compare picker).
 *
 * Single SQL hit; in-memory resolution. Returns
 * `result[jurisdictionId][factKey] = ResolverOutput`.
 *
 * Performance target: <300ms for the full 271-jurisdiction × 5-key
 * batch on a warm DB.
 */
export async function getCanonicalFactsForJurisdictions(
  jurisdictionIds: string[],
  factKeys: string[]
): Promise<Record<string, Record<string, ResolverOutput>>> {
  if (jurisdictionIds.length === 0 || factKeys.length === 0) return {};

  const dbRows = await db
    .select()
    .from(countryFacts)
    .where(
      and(
        inArray(countryFacts.jurisdictionId, jurisdictionIds),
        inArray(countryFacts.factKey, factKeys)
      )
    );

  // Group by (jurisdictionId, factKey).
  const grouped = new Map<string, Map<string, FactRow[]>>();
  for (const r of dbRows.map(dbRowToFactRow)) {
    let perJur = grouped.get(r.jurisdictionId);
    if (!perJur) {
      perJur = new Map();
      grouped.set(r.jurisdictionId, perJur);
    }
    let bucket = perJur.get(r.factKey);
    if (!bucket) {
      bucket = [];
      perJur.set(r.factKey, bucket);
    }
    bucket.push(r);
  }

  // Disputes lookup in one query for the whole batch.
  const disputeRows = await db
    .select({
      jurisdictionId: dataDisputes.jurisdictionId,
      factKey: dataDisputes.factKey,
    })
    .from(dataDisputes)
    .where(
      and(
        inArray(dataDisputes.jurisdictionId, jurisdictionIds),
        inArray(dataDisputes.factKey, factKeys),
        sql`${dataDisputes.status} IN ('open', 'in_review')`
      )
    );
  const disputedKeys = new Set(
    disputeRows.map((d) => `${d.jurisdictionId}|${d.factKey}`)
  );

  const out: Record<string, Record<string, ResolverOutput>> = {};
  for (const jurisdictionId of jurisdictionIds) {
    out[jurisdictionId] = {};
    const perJur = grouped.get(jurisdictionId);
    for (const factKey of factKeys) {
      const rows = perJur?.get(factKey) ?? [];
      const factKeyDef = getFactKey(factKey);
      const isDisputed = disputedKeys.has(`${jurisdictionId}|${factKey}`);

      if (!factKeyDef) {
        const active = rows.filter((r) => r.status === "active");
        const canonical = active[0] ?? null;
        out[jurisdictionId][factKey] = {
          jurisdictionId,
          factKey,
          canonical,
          alternates: active,
          all: rows,
          isDisputed,
          decisionReason:
            active.length > 0 ? "single_source" : "no_active_rows",
          proposedDisputes: [],
          canonicalIsProjection: canonical?.valueType === "projected",
        };
        continue;
      }

      const resolution = resolveFromRows(rows, factKeyDef);
      out[jurisdictionId][factKey] = {
        jurisdictionId,
        factKey,
        ...resolution,
        isDisputed,
      };
    }
  }

  return out;
}

/**
 * Read the denormalised cache value off `jurisdictions` for fast
 * list paths that don't need provenance / alternates. Returns the
 * raw column value plus the cache timestamp (for SourceDot
 * freshness display).
 *
 * **Use sparingly.** Provenance-bearing surfaces should use
 * `getCanonicalFact()` instead. This is for hot list queries
 * where a 24h-stale value is fine.
 *
 * Acceptable caller examples (per F.4 surface inventory):
 *   - `/civica-index` leaderboard rows
 *   - Atlas world-map hover
 *   - Global search snippets
 *   - `/government-types/[type]` listing
 *
 * Unacceptable caller examples (must use the resolver):
 *   - Any SourceDot
 *   - Atlas masthead
 *   - Factbook header strip
 *   - `/api/v1/countries/*` (returns provenance)
 *   - `/embed/[slug]` (citation-bearing)
 */
export type CachedField =
  | "capital"
  | "population"
  | "gdpBillions"
  | "areaSqKm"
  | "languages"
  | "currency"
  | "democracyIndex";

export async function readCachedField(
  jurisdictionId: string,
  field: CachedField
): Promise<{
  value: string | number | null;
  cacheRefreshedAt: Date | null;
}> {
  const result = await db
    .select({
      value: jurisdictions[field],
      cacheRefreshedAt: jurisdictions.factCacheRefreshedAt,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.id, jurisdictionId))
    .limit(1);

  if (result.length === 0) {
    return { value: null, cacheRefreshedAt: null };
  }

  return {
    value: result[0].value as string | number | null,
    cacheRefreshedAt: result[0].cacheRefreshedAt,
  };
}

/**
 * Phase F.4 — Drizzle column-projection helper for the cached
 * jurisdictions fields.
 *
 * Spread this into a `.select({ ... })` call when a route or query
 * needs the cached fact columns (capital, population, gdp, area,
 * languages, currency, democracy index). Keeps the
 * `jurisdictions.<col>` references contained inside this module so
 * the F.4 lint rule (banning direct cached-column reads outside
 * `src/lib/factbook/reconcile/`) can stay tight.
 *
 * Usage:
 *   const rows = await db
 *     .select({ id: jurisdictions.id, ...cachedJurisdictionColumns })
 *     .from(jurisdictions);
 */
export const cachedJurisdictionColumns = {
  capital: jurisdictions.capital,
  population: jurisdictions.population,
  gdpBillions: jurisdictions.gdpBillions,
  areaSqKm: jurisdictions.areaSqKm,
  languages: jurisdictions.languages,
  currency: jurisdictions.currency,
  democracyIndex: jurisdictions.democracyIndex,
} as const;

/**
 * Phase F.4 — fact-key-aware cached read against an already-loaded
 * jurisdictions row.
 *
 * Use this overload from list-shaped surfaces that already SELECT
 * the jurisdictions row(s) and just need the value off the cached
 * column. It maps the canonical Phase F fact-key (e.g.
 * `"population_total"`) to the matching `jurisdictions` column
 * (e.g. `population`) and returns the value directly. Synchronous,
 * zero DB hits.
 *
 * For surfaces that haven't loaded the row yet, use the async
 * `readCachedField(jurisdictionId, field)` overload above.
 *
 * The fact-key → column mapping mirrors `COLUMN_TO_FACT_KEY` in
 * `src/lib/factbook/reconcile/cache.ts`.
 */
export type FactKeyForCache =
  | "capital"
  | "population_total"
  | "gdp_ppp_usd_billions"
  | "area_total_km2"
  | "official_languages"
  | "currency_code"
  | "vdem_row";

const FACT_KEY_TO_COLUMN: Record<FactKeyForCache, CachedField> = {
  capital: "capital",
  population_total: "population",
  gdp_ppp_usd_billions: "gdpBillions",
  area_total_km2: "areaSqKm",
  official_languages: "languages",
  currency_code: "currency",
  vdem_row: "democracyIndex",
};

type CachedFieldHolder = {
  capital?: string | null;
  population?: number | null;
  gdpBillions?: number | null;
  areaSqKm?: number | null;
  languages?: string | null;
  currency?: string | null;
  democracyIndex?: number | null;
};

export function readCachedFieldFromRow<R extends CachedFieldHolder>(
  row: R,
  factKey: "capital"
): string | null;
export function readCachedFieldFromRow<R extends CachedFieldHolder>(
  row: R,
  factKey: "population_total"
): number | null;
export function readCachedFieldFromRow<R extends CachedFieldHolder>(
  row: R,
  factKey: "gdp_ppp_usd_billions"
): number | null;
export function readCachedFieldFromRow<R extends CachedFieldHolder>(
  row: R,
  factKey: "area_total_km2"
): number | null;
export function readCachedFieldFromRow<R extends CachedFieldHolder>(
  row: R,
  factKey: "official_languages"
): string | null;
export function readCachedFieldFromRow<R extends CachedFieldHolder>(
  row: R,
  factKey: "currency_code"
): string | null;
export function readCachedFieldFromRow<R extends CachedFieldHolder>(
  row: R,
  factKey: "vdem_row"
): number | null;
export function readCachedFieldFromRow<R extends CachedFieldHolder>(
  row: R,
  factKey: FactKeyForCache
): string | number | null {
  const column = FACT_KEY_TO_COLUMN[factKey];
  const value = row[column];
  return (value ?? null) as string | number | null;
}

/* ────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────── */

interface CountryFactDbRow {
  id: string;
  jurisdictionId: string;
  factKey: string;
  factGroup: string;
  category: string;
  sourceId: string;
  sourceUrl: string | null;
  wikidataQid: string | null;
  wikidataPid: string | null;
  wikidataRank: string | null;
  references: unknown;
  factValue: string | null;
  factValueNumeric: number | null;
  factUnit: string | null;
  factYear: number | null;
  valueJson: unknown;
  asOf: string | null;
  retrievedAt: Date | string;
  upstreamVintageLabel: string | null;
  methodologyVersion: string;
  status: string;
  statusReason: string | null;
  sourceNote: string | null;
  /** Bug 1 — `'measured'` (default) or `'projected'`. */
  valueType?: string | null;
}

export function dbRowToFactRow(row: CountryFactDbRow): FactRow {
  return {
    id: row.id,
    jurisdictionId: row.jurisdictionId,
    factKey: row.factKey,
    factGroup: row.factGroup as "A" | "B" | "C",
    category: row.category,
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    wikidataQid: row.wikidataQid,
    wikidataPid: row.wikidataPid,
    wikidataRank:
      row.wikidataRank === "preferred" ||
      row.wikidataRank === "normal" ||
      row.wikidataRank === "deprecated"
        ? row.wikidataRank
        : null,
    references: Array.isArray(row.references)
      ? (row.references as unknown[])
      : null,
    factValue: row.factValue,
    factValueNumeric: row.factValueNumeric,
    factUnit: row.factUnit,
    factYear: row.factYear,
    valueJson: row.valueJson,
    asOf: row.asOf,
    retrievedAt:
      typeof row.retrievedAt === "string"
        ? row.retrievedAt
        : row.retrievedAt.toISOString(),
    upstreamVintageLabel: row.upstreamVintageLabel,
    methodologyVersion: row.methodologyVersion,
    status:
      row.status === "active" ||
      row.status === "rejected" ||
      row.status === "superseded" ||
      row.status === "demoted"
        ? row.status
        : "active",
    statusReason: row.statusReason,
    sourceNote: row.sourceNote,
    valueType: row.valueType === "projected" ? "projected" : "measured",
  };
}
