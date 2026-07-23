/**
 * Phase R.4 — WHO Global Health Observatory sync orchestrator.
 *
 * Direct sync from WHO's Global Health Observatory OData API
 * (`https://ghoapi.azureedge.net/api/`). After R.7.5 ships 7
 * indicators total (R.4's 2 + R.7.5's 5):
 *   - `WHOSIS_000001` → `life_expectancy_years` (canonical)
 *   - `MDG_0000000001` → `infant_mortality_per_1000` (canonical)
 *   - `WHOSIS_000002` → `healthy_life_expectancy_years` (canonical; R.7.5 NEW)
 *   - `MDG_0000000026` → `maternal_mortality_per_100000` (canonical; R.7.5 NEW)
 *   - `MDG_0000000007` → `under_five_mortality_per_1000` (canonical; R.7.5 NEW)
 *   - `NCDMORT3070` → `ncd_premature_mortality_pct` (canonical; R.7.5 NEW)
 *   - `GHED_CHEGDP_SHA2011` → `health_expenditure_pct_gdp` (shared canonical with OECD SHA; R.7.5 NEW)
 *
 * All ship as `civicaRole: 'canonical'`. The 5 R.7.5 additions cover
 * the deferrals from R.4's original scope per
 * `~/civica/plan/fact-key-registry-expansion-resolution-v1.md` §2a.
 * Note: `health_expenditure_pct_gdp` is **shared canonical** with
 * OECD SHA — both publishers compute SHA-2011 joint methodology and
 * write rows tagged `canonical`; the resolver picks fresher within
 * envelope.
 *
 * For each indicator we ask the WHO GHO OData API for the full
 * country-tagged time series (`/{IndicatorCode}` filtered by
 * `SpatialDimType eq 'COUNTRY'` and the canonical disaggregation
 * dimensions per indicator), pick the latest non-null observation
 * per ISO3 country, validate against the fact-key's plausibility
 * envelope (with the R.1.1 isPercent fix mirrored inline), then
 * upsert into `country_facts` keyed by
 * `(jurisdictionId, factKey, sourceId='who_gho')`. Snapshots are
 * deduplicated via `fact_snapshots` (sourceId + payloadHash).
 *
 * The Phase F resolver picks between WHO and CIA / WB / Wikidata
 * per methodology §3.3 — material-error guard + freshness
 * preference. **WHO life expectancy data is older than WB's**
 * (most recent TimeDim ≈ 2021 for WHOSIS_000001 vs WB's 2024).
 * WB will functionally win at runtime via freshness; WHO stays
 * editorially canonical via the `civicaRole` tag, surfaced on the
 * methodology page and in the per-row references payload. See
 * `~/civica/plan/who-gho-resolution-v1.md` §2d for the worked
 * example. This mirrors R.1's WB-canonical-but-IMF-takes-over
 * pattern for nominal GDP.
 *
 * License: WHO data is published under CC BY-NC-SA 3.0 IGO
 * (non-commercial only with ShareAlike). Each row's references
 * payload carries `license: 'CC BY-NC-SA 3.0 IGO'` so downstream
 * consumers can license-aware-filter when commercial endpoints
 * land. See `~/civica/plan/who-gho-resolution-v1.md` §2f, §4
 * Risk 1.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.4
 * Resolution:  ~/civica/plan/who-gho-resolution-v1.md
 */
import { sql } from "drizzle-orm";

import { factSnapshots, jurisdictions } from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import {
  resolveAtlasReleaseId,
  routineCountryFactHistory,
  upsertCountryFactWithHistory,
  type CountryFactHistoryWriter,
} from "@/lib/factbook/country-fact-history-writer";
import { getFactKey } from "./fact-keys";
import {
  persistProposedDisputes,
  type PersistDisputeSummary,
} from "./dispute-persistence";
import {
  markExternalSourceSyncedAfterAggregateSuccess,
  payloadHash,
  recordRequiredSubfeedOutcome,
  type CivicaSourceRole,
} from "./_sync-common";

type Db = typeof import("@/lib/db").db;

const WHO_BASE_URL = "https://ghoapi.azureedge.net/api";
const WHO_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";
// WHO returns ~190 country rows × 30+ years of history per
// indicator; with disaggregation filters reducing to a single row
// per (country, year), 5,000–8,000 rows per indicator is typical.
// **WHO's OData endpoint caps `$top` at 1,000** (the documented
// limit; 1001+ returns 400 Bad Request) so we paginate via $skip
// at this page size. Investigation 2026-05-04: a 7,000-row
// indicator needs 7 round-trips at 1,000/page.
const WHO_PAGE_SIZE = 1_000;

const WHO_GHO_VINTAGE = "WHO GHO 2026Q3";
// WHO publishes data under CC BY-NC-SA 3.0 IGO. The methodology
// page rewrite (R.23) discloses this site-wide; per-row metadata
// gives downstream consumers a license-aware filter point. See
// `~/civica/plan/who-gho-resolution-v1.md` §2f.
const WHO_GHO_LICENSE = "CC BY-NC-SA 3.0 IGO";

/**
 * One WHO GHO indicator we care about. Each entry maps an upstream
 * indicator code to a Civica fact-key and includes the OData filter
 * clauses for the canonical disaggregation (e.g. both-sexes total,
 * the right age group). The optional `valueTransform` lets us reshape
 * upstream units to fact-key units; both R.4 indicators ship with
 * identity transforms (years stay years, per-1000 stays per-1000).
 */
export interface WhoGhoIndicatorConfig {
  /** WHO GHO indicator code (e.g. "WHOSIS_000001"). */
  whoCode: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw WHO `NumericValue` before
   *  envelope check and write. Default 1 — used when the WHO unit
   *  matches the fact-key unit verbatim. */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Optional Dim1 filter — typically `'SEX_BTSX'` to take the
   *  both-sexes total instead of the male/female disaggregation. */
  dim1Filter?: string;
  /** Optional Dim2 filter — typically the canonical age group, e.g.
   *  `'AGEGROUP_MONTHS0-11'` for infant mortality. */
  dim2Filter?: string;
  /** Optional Dim3 filter — typically the canonical wealth quintile
   *  total, e.g. `'WEALTHQUINTILE_TOTL'` for under-5 mortality. */
  dim3Filter?: string;
  /** Civica's editorial role for this WHO indicator. R.4 ships both
   *  indicators as `'canonical'` per the resolution. The Phase F
   *  resolver does NOT use this field for runtime selection (the
   *  resolver is freshness-driven per methodology §3.3); the field
   *  is informational metadata for the methodology page rewrite at
   *  Phase R.23. Mirrors R.1's
   *  `WdiIndicatorConfig.civicaRole`. */
  civicaRole?: CivicaSourceRole;
}

export const WHO_GHO_INDICATORS: readonly WhoGhoIndicatorConfig[] = [
  // ─── R.4 ship list (2 indicators) — see resolution §2b. ───
  {
    // Life expectancy at birth, both sexes. WHO publishes this on a
    // multi-year cycle (most recent at the time of writing: 2021).
    // Civica's resolver picks fresher within plausibility envelope,
    // so WB 2024 will functionally win at runtime — but WHO stays
    // editorially canonical via the `civicaRole` tag. See resolution
    // §2d for the USA worked example.
    whoCode: "WHOSIS_000001",
    factKey: "life_expectancy_years",
    label: "Life expectancy at birth, both sexes (years)",
    docUrl:
      "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/life-expectancy-at-birth-(years)",
    dim1Filter: "SEX_BTSX",
    civicaRole: "canonical",
  },
  {
    // Infant mortality rate (probability of dying between birth and
    // age 1 per 1,000 live births). WHO publishes this on a more
    // current cycle (most recent at the time of writing: 2023);
    // freshness disagreement with WB 2024 is small (≤1 year), so
    // resolver pick alternates depending on which source ran more
    // recently. Both methodologically agree on values within ~0.2%.
    whoCode: "MDG_0000000001",
    factKey: "infant_mortality_per_1000",
    label: "Infant mortality rate (per 1,000 live births)",
    docUrl:
      "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/infant-mortality-rate-(probability-of-dying-between-birth-and-age-1-per-1000-live-births)",
    dim1Filter: "SEX_BTSX",
    dim2Filter: "AGEGROUP_MONTHS0-11",
    civicaRole: "canonical",
  },

  // ─── R.7.5 ship list (5 new health fact-keys; resolution §2a). ───
  // All canonical for WHO. `health_expenditure_pct_gdp` is shared
  // canonical with OECD SHA per resolution L3 — both WHO GHED and
  // OECD SHA write rows tagged `canonical`. The resolver picks fresher
  // within envelope; both publishers compute SHA-2011 joint methodology
  // and converge to ~0.1pp.
  {
    // Healthy life expectancy at birth (HALE), both sexes. Multi-year
    // refresh; latest 2021. Probe (2021): min Lesotho 44.6, max
    // Singapore 73.6. ~191 ISO3 coverage.
    whoCode: "WHOSIS_000002",
    factKey: "healthy_life_expectancy_years",
    label: "Healthy life expectancy at birth, both sexes (years)",
    docUrl:
      "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/gho-ghe-hale-healthy-life-expectancy-at-birth",
    dim1Filter: "SEX_BTSX",
    civicaRole: "canonical",
  },
  {
    // Maternal mortality ratio per 100,000 live births. Annual to
    // multi-year refresh; latest 2023. Probe (2023): min Cook Islands
    // 0.1, max Nigeria 992.8. ~190 ISO3 coverage.
    whoCode: "MDG_0000000026",
    factKey: "maternal_mortality_per_100000",
    label: "Maternal mortality ratio (per 100,000 live births)",
    docUrl:
      "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/maternal-mortality-ratio-(per-100-000-live-births)",
    civicaRole: "canonical",
  },
  {
    // Under-five mortality rate (per 1,000 live births). The
    // `WEALTHQUINTILE_TOTL` Dim3 filter takes the wealth-quintile
    // total (i.e. the country aggregate, not a quintile breakdown).
    // Annual refresh; latest 2023. Probe (2023): min San Marino 1.3,
    // max Niger 118.5. ~190 ISO3 coverage.
    whoCode: "MDG_0000000007",
    factKey: "under_five_mortality_per_1000",
    label: "Under-five mortality rate (per 1,000 live births)",
    docUrl:
      "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/under-five-mortality-rate-(probability-of-dying-by-age-5-per-1000-live-births)",
    dim3Filter: "WEALTHQUINTILE_TOTL",
    civicaRole: "canonical",
  },
  {
    // Probability of dying between ages 30-70 from CVD/cancer/
    // diabetes/CRD (NCD premature mortality). Both sexes. Multi-year
    // refresh; latest 2021. Probe (2021, BTSX): min South Korea 6.9,
    // max Kiribati 44.1. Value scaled 0-100 (probability percentage).
    // ~180 ISO3 coverage.
    whoCode: "NCDMORT3070",
    factKey: "ncd_premature_mortality_pct",
    label:
      "Probability of dying between exact ages 30 and 70 from CVD/cancer/diabetes/CRD",
    docUrl:
      "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/probability-(-)-of-dying-between-age-30-and-exact-age-70-from-any-of-cardiovascular-disease-cancer-diabetes-or-chronic-respiratory-disease",
    dim1Filter: "SEX_BTSX",
    civicaRole: "canonical",
  },
  {
    // Current health expenditure as % of GDP. WHO Global Health
    // Expenditure Database (GHED) under the SHA-2011 methodology.
    // Annual refresh; latest 2022. Probe (2022): min Brunei 1.8%,
    // max Afghanistan 23.1%, USA 16.5%. ~190 ISO3 coverage.
    //
    // R.7.5 L3 — SHARED CANONICAL with OECD SHA. Both publishers
    // compute the same SHA-2011 methodology; values converge to
    // ~0.1pp. The resolver picks fresher within envelope; methodology
    // page renders both as editorial canonical for their respective
    // scopes (WHO ~190, OECD 51).
    whoCode: "GHED_CHEGDP_SHA2011",
    factKey: "health_expenditure_pct_gdp",
    label: "Current health expenditure (% of GDP)",
    docUrl:
      "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/current-health-expenditure-(che)-as-percentage-of-gross-domestic-product-(gdp)-(-)",
    civicaRole: "canonical",
  },
];

/**
 * One row as returned by the WHO GHO OData endpoint. Field names
 * are case-sensitive and match the upstream JSON exactly.
 */
export interface WhoGhoDataPoint {
  Id: number;
  IndicatorCode: string;
  /** "COUNTRY" | "REGION" | "GLOBAL" | "UNSDGREGION" | etc. */
  SpatialDimType: string;
  /** ISO3 code when SpatialDimType === "COUNTRY". */
  SpatialDim: string;
  TimeDimType: string;
  TimeDim: number;
  Dim1Type: string | null;
  Dim1: string | null;
  Dim2Type: string | null;
  Dim2: string | null;
  Dim3Type: string | null;
  Dim3: string | null;
  /** "78.9 [78.5-79.2]" — string with confidence intervals. */
  Value: string;
  /** Clean numeric value. Null when the indicator has no numeric
   *  representation (rare; not expected for the 2 R.4 indicators). */
  NumericValue: number | null;
  Low: number | null;
  High: number | null;
  Comments: string | null;
  /** WHO publication-revision date (ISO 8601 with timezone). E.g.
   *  "2024-08-02T09:43:39.193+02:00" for life expectancy. We
   *  preserve this in the snapshot payload; methodology page
   *  rewrite (R.23) may surface it. */
  Date: string;
  TimeDimensionValue: string;
  TimeDimensionBegin: string;
  TimeDimensionEnd: string;
}

export interface PerWhoGhoCounters {
  factKey: string;
  whoCode: string;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  skipped_no_iso3: number;
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
}

export interface WhoGhoSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  countersByFactKey: Record<string, PerWhoGhoCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface WhoGhoSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific WHO indicator code (for testing). */
  whoCode?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
  /** Deterministic fixture seams; production callers omit these. */
  fetchIndicator?: (
    config: WhoGhoIndicatorConfig,
  ) => Promise<WhoGhoDataPoint[]>;
  jurisdictions?: WhoGhoJurisdiction[];
  persistDisputes?: typeof persistProposedDisputes;
  markSynced?: typeof markSourcesSynced;
  atlasReleaseId?: string;
  writeFact?: CountryFactHistoryWriter;
}

export interface WhoGhoJurisdiction {
  id: string;
  slug: string;
  iso3: string | null;
}

function freshCounters(factKey: string, whoCode: string): PerWhoGhoCounters {
  return {
    factKey,
    whoCode,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_no_iso3: 0,
    skipped_no_jurisdiction: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
  };
}

/**
 * Build the OData $filter clause for one indicator. We always
 * filter to `SpatialDimType eq 'COUNTRY'` so regional aggregates
 * (AMR, EMR, EUR, GLOBAL, UNSDGREGION_*, UNICEFREGION_*) never
 * land in `country_facts`. Optional Dim1/Dim2/Dim3 filters keep
 * us on the canonical disaggregation per indicator (e.g.
 * SEX_BTSX for life expectancy, AGEGROUP_MONTHS0-11 for infant
 * mortality).
 */
function buildOdataFilter(config: WhoGhoIndicatorConfig): string {
  const parts: string[] = [`SpatialDimType eq 'COUNTRY'`];
  if (config.dim1Filter) parts.push(`Dim1 eq '${config.dim1Filter}'`);
  if (config.dim2Filter) parts.push(`Dim2 eq '${config.dim2Filter}'`);
  if (config.dim3Filter) parts.push(`Dim3 eq '${config.dim3Filter}'`);
  return parts.join(" and ");
}

/**
 * Fetch all rows of one indicator, paginating via $skip when the
 * indicator has more than `WHO_PAGE_SIZE` matching rows. WHO's
 * OData endpoint supports both $top and $skip; in practice both
 * R.4 indicators fit in a single page (~5,000–8,000 rows after
 * disaggregation filtering for ~190 countries × ~30 years).
 */
async function fetchIndicator(
  config: WhoGhoIndicatorConfig,
): Promise<WhoGhoDataPoint[]> {
  const out: WhoGhoDataPoint[] = [];
  const filter = buildOdataFilter(config);
  let skip = 0;

  // Bound the loop so a misbehaving endpoint cannot run indefinitely.
  // 50 pages × 1,000 rows = 50,000 upper bound; both R.4 indicators
  // (~7,000 rows each post-disaggregation filter) are well below
  // this.
  for (let page = 0; page < 50; page += 1) {
    const url =
      `${WHO_BASE_URL}/${config.whoCode}` +
      `?$filter=${encodeURIComponent(filter)}` +
      `&$top=${WHO_PAGE_SIZE}` +
      `&$skip=${skip}`;
    const res = await fetch(url, {
      headers: { "User-Agent": WHO_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(
        `WHO GHO ${config.whoCode} skip ${skip}: ${res.status} ${res.statusText}`,
      );
    }
    const body = (await res.json()) as { value?: WhoGhoDataPoint[] };
    const rows = Array.isArray(body?.value) ? body.value : [];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < WHO_PAGE_SIZE) break;
    skip += WHO_PAGE_SIZE;
  }
  return out;
}

/**
 * Pick the most recent non-null observation per country. Returns a
 * map keyed by uppercase iso3.
 */
function pickLatestPerCountry(
  rows: WhoGhoDataPoint[],
): Map<string, WhoGhoDataPoint> {
  const latest = new Map<string, WhoGhoDataPoint>();
  for (const r of rows) {
    if (r.NumericValue === null || r.NumericValue === undefined) continue;
    const iso3 = (r.SpatialDim ?? "").toUpperCase();
    if (!iso3 || iso3.length !== 3) continue;
    const existing = latest.get(iso3);
    if (!existing) {
      latest.set(iso3, r);
      continue;
    }
    // Higher year wins.
    if (r.TimeDim > existing.TimeDim) {
      latest.set(iso3, r);
    }
  }
  return latest;
}

/**
 * Run the WHO GHO sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncWhoGho(
  db: Db,
  options: WhoGhoSyncOptions = {},
): Promise<WhoGhoSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = WHO_GHO_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.whoCode && c.whoCode !== options.whoCode) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no WHO GHO indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }
  const atlasReleaseId = options.dryRun
    ? undefined
    : resolveAtlasReleaseId(options.atlasReleaseId);
  const writeFact = options.writeFact ?? upsertCountryFactWithHistory;

  // Build iso3 → jurisdictionId map once; reused across all indicators.
  const allJurisdictions =
    options.jurisdictions ??
    (await db
      .select({
        id: jurisdictions.id,
        slug: jurisdictions.slug,
        iso3: jurisdictions.iso3,
      })
      .from(jurisdictions)
      .where(sql`${jurisdictions.iso3} IS NOT NULL`));
  const iso3ToJurisdiction = new Map<
    string,
    { id: string; slug: string; iso3: string | null }
  >();
  for (const j of allJurisdictions) {
    if (j.iso3) iso3ToJurisdiction.set(j.iso3.toUpperCase(), j);
  }
  log(`${allJurisdictions.length} jurisdictions with ISO3 codes loaded.`);

  const counters = new Map<string, PerWhoGhoCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.whoCode));
  }

  let totalWritten = 0;
  // Phase F.6.1 — track every (jurisdictionId, factKey) pair we
  // upserted so the resolver can re-evaluate them and we can persist
  // any disputes after the write loop.
  const touchedPairs = new Set<string>();

  for (const config of targets) {
    const counter = counters.get(config.factKey)!;
    const factKeyDef = getFactKey(config.factKey);
    if (!factKeyDef) {
      errors.push(
        `unknown fact-key '${config.factKey}' for WHO ${config.whoCode} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.whoCode}) "${config.label}" — fetching all country rows…`,
    );

    let rows: WhoGhoDataPoint[];
    try {
      rows = await (options.fetchIndicator ?? fetchIndicator)(config);
    } catch (err) {
      errors.push(
        `${config.whoCode} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    counter.observations = rows.length;
    log(`  fetched ${rows.length} observations`);

    const latestByIso3 = pickLatestPerCountry(rows);
    counter.jurisdictions_with_value = latestByIso3.size;
    log(`  ${latestByIso3.size} countries with at least one non-null value`);

    for (const [iso3, dp] of latestByIso3) {
      const j = iso3ToJurisdiction.get(iso3);
      if (!j) {
        counter.skipped_no_jurisdiction++;
        continue;
      }

      const transform = config.valueTransform ?? ((v: number) => v);
      const numericValue = transform(dp.NumericValue as number);

      // Plausibility envelope per fact-key registry §3.6.
      // R.1.1 fix mirrored inline (per the R.4 task brief — do NOT
      // extract a shared helper this round): when isPercent is true,
      // the [-1, 101] range is only a fallback for fact-keys that do
      // not declare their own min/max. When min/max are explicitly
      // set in the fact-key definition, those values take precedence.
      // See `~/civica/plan/wb-wdi-expansion-resolution-v1.md` §3c
      // for the original fix; helper extraction is a small follow-up
      // once R.2 / R.3 / R.4 land in parallel.
      const env = factKeyDef.envelope;
      if (env) {
        const min = env.isPercent
          ? env.min !== undefined
            ? env.min
            : -1
          : env.min;
        const max = env.isPercent
          ? env.max !== undefined
            ? env.max
            : 101
          : env.max;
        if (
          (min !== undefined && numericValue < min) ||
          (max !== undefined && numericValue > max)
        ) {
          counter.rejected_envelope++;
          continue;
        }
      }

      const factYear = dp.TimeDim;
      const asOf = Number.isFinite(factYear) ? `${factYear}-01-01` : null;

      const upstreamPayload = {
        source: "who_gho",
        endpoint: `${WHO_BASE_URL}/${config.whoCode}?$filter=SpatialDim%20eq%20%27${j.iso3}%27`,
        iso3: j.iso3,
        whoCode: config.whoCode,
        whoIndicatorRowId: dp.Id,
        timeDim: dp.TimeDim,
        dim1: dp.Dim1,
        dim2: dp.Dim2,
        dim3: dp.Dim3,
        value: dp.Value,
        numericValue: dp.NumericValue,
        whoPublicationDate: dp.Date,
        whoVintage: WHO_GHO_VINTAGE,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "WHO Global Health Observatory",
          // R.1 — Civica's canonical/alternate editorial role for
          // this (source, fact-key) pair. R.4 ships both indicators
          // as `'canonical'`; the resolver does not consult this
          // field, but the methodology page rewrite (R.23) reads
          // it to render the editorial canonical alongside the
          // freshest displayed value. See
          // `~/civica/plan/who-gho-resolution-v1.md` §2j.
          civicaRole: config.civicaRole ?? "canonical",
          // R.4 — per-row license metadata. WHO GHO data is
          // CC BY-NC-SA 3.0 IGO (non-commercial, ShareAlike,
          // attribution). Future commercial-monetization paths
          // need a license-aware response middleware to filter
          // out NC-licensed rows. See
          // `~/civica/plan/who-gho-resolution-v1.md` §2f, §4 Risk 1.
          license: WHO_GHO_LICENSE,
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${dp.TimeDim})`,
        );
        counter.written++;
        totalWritten++;
        touchedPairs.add(`${j.id}|${config.factKey}`);
        continue;
      }

      try {
        // Snapshot dedup — re-runs with identical upstream payloads are
        // no-ops at the snapshot table.
        await db
          .insert(factSnapshots)
          .values({
            sourceId: "who_gho",
            upstreamRef: `who:${j.iso3}:${config.whoCode}:${dp.TimeDim}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: WHO_GHO_VINTAGE,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          });

        const snapshotIdRow = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'who_gho' AND ${factSnapshots.payloadHash} = ${hash}`,
          )
          .limit(1);
        const snapshotId = snapshotIdRow[0]?.id ?? null;

        const values = {
          jurisdictionId: j.id,
          factKey: config.factKey,
          factGroup: factKeyDef.group,
          category: factKeyDef.category,
          sourceId: "who_gho",
          sourceUrl: config.docUrl,
          references: referencesPayload,
          sourceHash: hash,
          factValue: String(numericValue),
          factValueNumeric: numericValue,
          factUnit: factKeyDef.unit ?? null,
          factYear,
          valueJson: null,
          asOf,
          retrievedAt: new Date(),
          upstreamVintageLabel: WHO_GHO_VINTAGE,
          methodologyVersion: "v0.1-beta",
          status: "active",
          statusReason: null,
          snapshotId,
          sourceNote: null,
        };
        await writeFact(db, {
          values,
          history: routineCountryFactHistory(values, atlasReleaseId!),
        });
        counter.written++;
        totalWritten++;
        touchedPairs.add(`${j.id}|${config.factKey}`);
      } catch (err) {
        errors.push(
          `${j.slug} ${config.factKey}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
    log(
      `  wrote ${counter.written} rows ` +
        `(envelope rejects: ${counter.rejected_envelope}, ` +
        `unmatched ISO3: ${counter.skipped_no_jurisdiction})`,
    );
    recordRequiredSubfeedOutcome({
      errors,
      source: "WHO GHO",
      target: `${config.factKey} (${config.whoCode})`,
      rowsWritten: counter.written,
    });
  }

  // Phase F.6.1 — re-run the resolver on every (jurisdictionId,
  // factKey) we touched and persist any new disputes. Idempotent:
  // duplicates are filtered out by `persistProposedDisputes`.
  let disputes: PersistDisputeSummary | null = null;
  if (touchedPairs.size > 0) {
    const touched = [...touchedPairs].map((s) => {
      const [jurisdictionId, factKey] = s.split("|");
      return { jurisdictionId, factKey };
    });
    log(
      `→ persisting resolver-proposed disputes across ${touched.length} (jurisdiction, fact-key) pairs…`,
    );
    try {
      disputes = await (options.persistDisputes ?? persistProposedDisputes)(
        db,
        touched,
        {
          dryRun: options.dryRun,
          onProgress: (line) => {
            if (line.startsWith("[DRY]")) return; // too verbose
            log(`  ${line}`);
          },
        },
      );
      for (const e of disputes.errors) errors.push(`disputes: ${e}`);
    } catch (err) {
      errors.push(
        `dispute persistence failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  await markExternalSourceSyncedAfterAggregateSuccess({
    sourceIds: "who_gho",
    rowsWritten: totalWritten,
    dryRun: options.dryRun,
    executor: db,
    errors,
    markSynced: options.markSynced ?? markSourcesSynced,
  });

  const finishedAtMs = Date.now();
  const countersByFactKey: Record<string, PerWhoGhoCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
