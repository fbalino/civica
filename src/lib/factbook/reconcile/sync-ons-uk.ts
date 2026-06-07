/**
 * Phase R.14 — ONS-UK sync orchestrator.
 *
 * Direct sync from the ONS public time-series API at
 * `https://www.ons.gov.uk/{taxonomy_path}/timeseries/{cdid}/{dataset}/data`.
 * Mirrors the F.6 / R.1 / R.2 / R.7 / R.10 / R.11 pattern.
 *
 * Ships **6 indicators** for `iso3='GBR'` only (single-country NSO):
 *
 *   1. `UKPOP` (UK total population mid-year)         → `population_total`        (canonical)
 *   2. `L55O`  (CPIH annual rate, all-items)          → `inflation_rate`          (canonical)
 *   3. `IHYP`  (GDP year-on-year real growth, CVM SA) → `gdp_real_growth_rate`    (canonical)
 *   4. `MGSX`  (Unemployment rate aged 16+, SA)       → `unemployment_rate_pct`   (canonical)
 *   5. `HF6X`  (PS Net Debt excl. PSB as % GDP)       → `public_debt_psnd_pct_gdp`(canonical, NEW fact-key)
 *   6. (CPI / `D7G7` deferred per resolution §2c + Q1 sign-off — defer
 *      to v1.1 with a unique-constraint extension.)
 *
 * All 5 ship as `civicaRole: 'canonical'` for UK rows ONLY. Per
 * `~/civica/plan/ons-uk-resolution-v1.md` §2d, this is the
 * **multi-canonical-with-scope-predicate** pattern (R.7 OECD precedent
 * + R.11 Eurostat formalization), extended to NSO scope = single
 * country. Existing IMF/WB/UN/ILO `civicaRole='canonical'` tags STAY
 * in place (no re-tagging). The methodology page (R.23) renders
 * multiple canonicals with their scope predicates.
 *
 * **NSO-priority-tier patch — phase-r13's resolver patch is the contract.**
 * `ons_uk` is pre-registered in `nso-overrides.ts` `NSO_SOURCE_BY_ISO3`
 * for `GBR`. The resolver's Group B tiebreak gives ONS priority=0 and
 * other Tier-1 publishers priority=1 for UK rows ONLY — so tied-date
 * races (e.g. ONS 2025 vs Eurostat 2025 for `unemployment_rate_pct`)
 * resolve deterministically to ONS. For non-UK countries this map is a
 * no-op (no `ons_uk` rows exist outside UK). Per
 * `~/civica/plan/ons-uk-resolution-v1.md` §2d Scenario 2 + §6 Q2.
 *
 * **UK-only scope.** R.14 writes rows for ISO3='GBR' only. The 5 ONS
 * series happen to expose UK (K02000001) data only via the public
 * time-series API endpoints we use; no client-side jurisdiction
 * filter needed beyond the single-jurisdiction lookup. For other
 * countries, Civica's resolver continues using IMF/WB/UN/ILO/etc.
 *
 * **`public_debt_psnd_pct_gdp` is a NEW fact-key declared inline at R.14.**
 * Per the R.12 trade-aggregate-fact-keys-v1.md two-fact-key precedent
 * (`exports_merchandise_usd` vs `exports_goods_services_usd` ship as
 * distinct facts), ONS's HF6X = "Public Sector Net Debt excluding
 * public sector banks" is methodologically distinct from IMF's
 * Maastricht-style General Government Gross Debt that populates the
 * existing `public_debt_pct_gdp` fact-key. R.14 declares a separate
 * UK-only fact-key for the PSND-excl-PSB measure rather than mixing
 * incommensurable values under the same fact-key. Per
 * `~/civica/plan/ons-uk-resolution-v1.md` §6 Q3 (sign-off override:
 * pulled into v1 from v1.1) + R.12 precedent.
 *
 * **CPIH-only for `inflation_rate` in v1.** ONS publishes both CPIH
 * (the headline measure since 2017) and CPI (the older measure widely
 * cited internationally). The resolver's upsert constraint
 * `(jurisdictionId, factKey, sourceId)` prevents two `ons_uk` rows for
 * the same `(GBR, inflation_rate)` pair without a unique-constraint
 * extension; R.14 ships CPIH-only and defers CPI as the
 * second-methodology-per-source case to v1.1. Per
 * `~/civica/plan/ons-uk-resolution-v1.md` §2c + Q1 sign-off.
 *
 * **`value_type` per Bug 1 forward policy.** Default `'measured'` for
 * all R.14 rows. Year-based discriminator (year > current_year →
 * 'projected') fires defensively at write time, but the 5 ONS series
 * ship measured/realized data only — no forecast horizons expected.
 * The `projection_rows` counter stays at 0 in normal sync runs.
 *
 * **License: Open Government Licence v3.0 (`OGL-UK-3.0`).** Commercial
 * use OK with attribution. Same posture as R.7 OECD (commercial OK)
 * and stricter than R.4 WHO (CC-BY-NC-SA 3.0 IGO). Source row has
 * `is_commercial_use_allowed: true` and `license: "OGL-UK-3.0"`.
 *
 * **`sources` row upsert.** R.14 inserts the `ons_uk` row defensively
 * at sync start (idempotent UPSERT) so cron deploys without a separate
 * `npm run seed:sources` re-run still work. The row is also added to
 * `scripts/seed-sources.ts` for canonical seeding.
 *
 * The Phase F resolver picks between ONS and IMF/WB/UN/ILO per
 * methodology §3.3 — material-error guard + freshness preference
 * WITH Bug 1's `value_type` partition AND phase-r13's NSO-priority
 * tiebreak. The `civicaRole` field on each indicator config is
 * informational metadata for the methodology page rewrite at Phase
 * R.23 (NOT used for runtime selection — the resolver consults the
 * NSO_SOURCE_BY_ISO3 map for source-priority semantics).
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.14
 * Resolution:  ~/civica/plan/ons-uk-resolution-v1.md
 * Bug 1:       ~/civica/plan/forecast-vs-measurement-v1.md
 * Two-fact-key precedent: ~/civica/plan/trade-aggregate-fact-keys-v1.md
 */
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import {
  countryFacts,
  factSnapshots,
  jurisdictions,
  sources,
} from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import { getFactKey } from "./fact-keys";
import {
  persistProposedDisputes,
  type PersistDisputeSummary,
} from "./dispute-persistence";
import type { CivicaSourceRole } from "./sync-wdi";

type Db = typeof import("@/lib/db").db;

const ONS_BASE_URL = "https://www.ons.gov.uk";
const ONS_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Civica-side source ID for ONS-UK. Pre-registered in
 * `nso-overrides.ts` `NSO_SOURCE_BY_ISO3.GBR` by phase-r13's NSO-
 * priority-tier patch. The slug is load-bearing — must match the
 * `sources.id` row + the allowlist `civicaSourceId` + the resolver's
 * NSO map entry + the api.ts SOURCE_LABELS key.
 */
const ONS_SOURCE_ID = "ons_uk";

/**
 * Civica-side vintage label for ONS rows. ONS series refresh on
 * different cadences (population annual, CPIH/CPI monthly, GDP
 * quarterly, unemployment monthly, PS finance monthly). The Civica-
 * side label is mostly cosmetic; the per-row vintage is captured from
 * each series' `description.releaseDate` and stamped into the per-row
 * metadata as `onsReleaseDate`.
 */
const ONS_VINTAGE = "ONS UK 2026Q2";

/**
 * License string stamped into per-row references payload. Per
 * `~/civica/plan/ons-uk-resolution-v1.md` §2f + Q4 sign-off.
 *
 * `OGL-UK-3.0` is the canonical short identifier for the UK
 * Open Government Licence v3.0 published by The National Archives.
 * Commercial-use OK with attribution. The per-row attribution string
 * "Source: Office for National Statistics licensed under the Open
 * Government Licence v3.0." renders on the public methodology page
 * (R.23) and the country page provenance footer.
 */
const ONS_LICENSE = "OGL-UK-3.0";

/**
 * `sources` table base URL for ONS-UK.
 */
const ONS_BASE_URL_SOURCES_FIELD = "https://www.ons.gov.uk";

/**
 * UK-only scope. Civica jurisdictions table key = ISO3 'GBR'. ONS's
 * public time-series API at the URL paths we use returns UK-total
 * data only (no sub-national disaggregation in the 5 series we ship).
 *
 * Validated 2026-05-04 against probes — the underlying ONS series
 * carry the K02000001 GSS code for "United Kingdom" (the whole-country
 * aggregate); we don't need to filter client-side.
 */
const ONS_TARGET_ISO3 = "GBR";

/**
 * The scope predicate stamped into per-row references payload for
 * methodology-page rendering. Per `~/civica/plan/ons-uk-resolution-v1.md`
 * §6 Q7 sign-off: `"UK"` matches the user-facing label more naturally
 * than the ISO3 form `"GBR"`.
 */
const ONS_SCOPE_PREDICATE = "UK";

/**
 * One ONS indicator we care about. Each entry pins:
 *   - the 4-letter CDID (Concept and Dataset Identifier, ONS's
 *     canonical time-series ID),
 *   - the URL path (taxonomy + dataset code) needed to construct
 *     the data URL `${ONS_BASE_URL}/{urlPath}/data`,
 *   - the Civica fact-key destination,
 *   - a per-row `civicaRole`.
 *
 * The optional `valueTransform` lets us reshape upstream units to
 * fact-key units. All 5 R.14 indicators ship with identity transforms
 * (ONS `%` matches Civica `%`; ONS `Number of people` matches Civica
 * `people`; ONS `% of GDP` matches Civica `% of GDP`).
 */
export interface OnsUkIndicatorConfig {
  /** ONS CDID (e.g. "UKPOP", "L55O"). 4-letter series identifier. */
  cdid: string;
  /** Taxonomy + timeseries URL path WITHOUT the `/data` suffix or
   *  leading slash. e.g. "economy/inflationandpriceindices/timeseries/l55o/mm23".
   *  We append "/data" at fetch time. The path varies per indicator
   *  domain because ONS's content tree organises series under taxonomy
   *  branches (economy, peoplepopulation..., employmentandlabour..., …). */
  urlPath: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw ONS value before envelope check
   *  and write. Default 1 — used when the ONS unit matches the fact-
   *  key unit verbatim. All 5 R.14 indicators are identity. */
  valueTransform?: (raw: number) => number;
  /** Documentation URL — the human-readable ONS time-series viewer.
   *  Stored in the fact row's references payload so the alternates
   *  panel can link out. We construct this as `${ONS_BASE_URL}/${urlPath}`
   *  by default but allow override per indicator. */
  docUrl?: string;
  /** Civica's editorial role for this ONS indicator. R.14 ships all 5
   *  as `'canonical'` for UK per the resolution §2d. Mirrors R.11
   *  Eurostat's per-indicator `civicaRole`. */
  civicaRole?: CivicaSourceRole;
}

/**
 * The 5 ONS indicators in R.14 ship scope. All from ONS's stable
 * annual surveillance series. Per
 * `~/civica/plan/ons-uk-resolution-v1.md` §2b.
 *
 * URL paths verified live 2026-05-04 — all return HTTP 200 with the
 * expected JSON envelope.
 */
export const ONS_INDICATORS: readonly OnsUkIndicatorConfig[] = [
  {
    cdid: "UKPOP",
    urlPath:
      "peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/ukpop/pop",
    factKey: "population_total",
    label: "United Kingdom population mid-year estimate",
    civicaRole: "canonical",
  },
  {
    // CPIH (Consumer Prices Index including owner occupiers' housing
    // costs) annual rate of change. ONS-preferred headline inflation
    // measure since 2017. Includes owner-occupier housing costs and
    // council tax (the 'H' is for housing).
    //
    // CPI (D7G7) — the older measure that excludes owner-occupier
    // housing — is DEFERRED to v1.1 per resolution §2c + Q1 sign-off.
    // The unique constraint `(jurisdictionId, factKey, sourceId)`
    // prevents shipping both as `ons_uk` rows for the same
    // `(GBR, inflation_rate)` pair without a constraint extension.
    cdid: "L55O",
    urlPath: "economy/inflationandpriceindices/timeseries/l55o/mm23",
    factKey: "inflation_rate",
    label: "CPIH annual rate, all-items, 2015=100",
    civicaRole: "canonical",
  },
  {
    cdid: "IHYP",
    urlPath: "economy/grossdomesticproductgdp/timeseries/ihyp/qna",
    factKey: "gdp_real_growth_rate",
    label: "GDP year-on-year growth, CVM SA",
    civicaRole: "canonical",
  },
  {
    cdid: "MGSX",
    urlPath:
      "employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
    factKey: "unemployment_rate_pct",
    label: "Unemployment rate aged 16+, SA",
    civicaRole: "canonical",
  },
  {
    // R.14 — Public Sector Net Debt excluding public sector banks, as
    // a % of GDP (NSA). Methodologically distinct from IMF Maastricht-
    // style General Government Gross Debt that populates the existing
    // `public_debt_pct_gdp` fact-key. Per R.12 two-fact-key precedent
    // (`exports_merchandise_usd` vs `exports_goods_services_usd`),
    // R.14 ships this as a separate UK-only fact-key
    // `public_debt_psnd_pct_gdp` rather than mixing incommensurable
    // values under the same fact-key.
    //
    // ONS HF6X 2025 = 95.0% GDP. Compare IMF UK 2031 forecast = 102.6%
    // (general government gross debt — different scope). Methodology
    // page (R.23) explains the scope difference + tooltip on the
    // factbook page renders both side-by-side.
    cdid: "HF6X",
    urlPath:
      "economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf",
    factKey: "public_debt_psnd_pct_gdp",
    label:
      "PS Net Debt (excluding public sector banks) as a % of GDP, NSA",
    civicaRole: "canonical",
  },
];

/**
 * One year-resolution data point as parsed from the ONS time-series
 * envelope's `years[]` array. ONS ships months/quarters/years
 * concurrently in a flat envelope; R.14 reads only the `years[]`
 * array since all 5 R.14 fact-keys are annual-cadence in Civica.
 */
interface OnsYearPoint {
  /** 4-digit year string from `date` field (e.g. "2025"). */
  year: number;
  /** Numeric value parsed from string `value` field. ONS ships
   *  values as strings (sometimes empty for unreleased cells); we
   *  drop empty/non-finite values upstream. */
  value: number;
  /** Per-point updateDate from the `updateDate` field. May be empty;
   *  we fall back to the dataset's top-level releaseDate. */
  updateDate: string | null;
}

/**
 * Per-indicator counter shape. Mirrors the IMF / WHO / OECD / ILO /
 * Eurostat patterns.
 */
export interface PerOnsCounters {
  factKey: string;
  cdid: string;
  /** Total annual data-points returned by ONS for the series. */
  observations: number;
  /** Always 0 or 1 for R.14 (single-jurisdiction sync). */
  jurisdictions_with_value: number;
  written: number;
  /** When we couldn't resolve the GBR jurisdiction (should never
   *  happen post-Phase R.7.0 jurisdictions backfill). */
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  /** Years with empty/non-finite value strings, dropped by parser. */
  rejected_no_value: number;
  /** Forecast-year rows landed (year > current calendar year).
   *  Defensive — the 5 R.14 series ship measured-only data; this
   *  counter should stay at 0 in normal sync runs. */
  projection_rows: number;
  /** Per-indicator releaseDate (top-level `description.releaseDate`).
   *  Captured per-fetch and persisted into the per-row references
   *  payload as `onsReleaseDate`. */
  upstreamReleaseDate: string | null;
  /** The picked latest annual year for the canonical row. */
  pickedYear: number | null;
  /** The picked latest annual value (post-transform) for the canonical
   *  row. Useful for log-line confirmation. */
  pickedValue: number | null;
}

export interface OnsSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  vintageLabel: string;
  countersByFactKey: Record<string, PerOnsCounters>;
  totalWritten: number;
  /** Whether the `sources.ons_uk` row was inserted on this run
   *  (true = first run / cron deploy without prior seed; false =
   *  idempotent skip). */
  sourceRowInserted: boolean;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface OnsSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific ONS CDID (for testing). */
  cdid?: string;
  /** When true, no DB writes — just exercise fetch + parse + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(factKey: string, cdid: string): PerOnsCounters {
  return {
    factKey,
    cdid,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_no_jurisdiction: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    projection_rows: 0,
    upstreamReleaseDate: null,
    pickedYear: null,
    pickedValue: null,
  };
}

function payloadHash(payload: object): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/**
 * Build the data URL for an indicator. ONS public time-series API
 * pattern: `{base}/{taxonomy}/timeseries/{cdid}/{dataset_code}/data`.
 *
 * The leading taxonomy + cdid + dataset_code are encoded in
 * `config.urlPath`. We append `/data`.
 */
function buildDataUrl(config: OnsUkIndicatorConfig): string {
  return `${ONS_BASE_URL}/${config.urlPath}/data`;
}

/**
 * Build the human-readable doc URL (the ONS time-series viewer page
 * — same URL minus `/data`). Stored in `references[].url` so the
 * alternates panel and methodology page can link out.
 */
function buildDocUrl(config: OnsUkIndicatorConfig): string {
  return config.docUrl ?? `${ONS_BASE_URL}/${config.urlPath}`;
}

/**
 * ONS time-series envelope shape (subset). Verified live 2026-05-04
 * across 5 series. The envelope contains `description`, `years`,
 * `months`, `quarters` arrays. We read only `years[]` for R.14.
 */
interface OnsTimeSeriesResponse {
  description?: {
    title?: string;
    cdid?: string;
    unit?: string;
    releaseDate?: string;
    nextRelease?: string;
    sourceDataset?: string;
    /** Optional version number / source-text fields exist; we
     *  don't read them at R.14. */
  };
  years?: Array<{
    /** Same as `year` field — 4-digit string e.g. "2025". */
    date?: string;
    /** Numeric value as a string. May be empty for unreleased
     *  reference periods (we drop those). */
    value?: string;
    /** Same as `date` — 4-digit string. */
    year?: string;
    /** Source dataset for this point (often equals
     *  `description.sourceDataset`). */
    sourceDataset?: string;
    /** Per-point release timestamp. May be empty. */
    updateDate?: string;
  }>;
  /** Reserved for future R.14.1 monthly/quarterly support. */
  months?: unknown[];
  quarters?: unknown[];
}

/**
 * Fetch one indicator's full time-series envelope and walk the
 * `years[]` array, returning the latest non-empty year point along
 * with all observations seen for counter visibility.
 */
async function fetchIndicator(
  config: OnsUkIndicatorConfig,
): Promise<{
  latest: OnsYearPoint | null;
  observationCount: number;
  rejectedNoValue: number;
  upstreamReleaseDate: string | null;
}> {
  const url = buildDataUrl(config);
  const res = await fetch(url, {
    headers: {
      "User-Agent": ONS_USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(
      `ONS ${config.cdid} ${config.factKey}: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as OnsTimeSeriesResponse;

  const years = body.years ?? [];
  const upstreamReleaseDate =
    body.description?.releaseDate?.trim() || null;

  let latest: OnsYearPoint | null = null;
  let rejectedNoValue = 0;
  for (const point of years) {
    const yearStr = (point.date ?? point.year ?? "").trim();
    const valueStr = (point.value ?? "").trim();
    if (!yearStr || !valueStr) {
      rejectedNoValue++;
      continue;
    }
    const year = parseInt(yearStr, 10);
    const value = Number(valueStr);
    if (!Number.isFinite(year) || !Number.isFinite(value)) {
      rejectedNoValue++;
      continue;
    }
    const point2: OnsYearPoint = {
      year,
      value,
      updateDate: (point.updateDate ?? "").trim() || null,
    };
    if (!latest || year > latest.year) {
      latest = point2;
    }
  }

  return {
    latest,
    observationCount: years.length,
    rejectedNoValue,
    upstreamReleaseDate,
  };
}

/**
 * Idempotent UPSERT of the `ons_uk` row in the `sources` table. Runs
 * at the start of every sync — a no-op on subsequent runs. Allows the
 * cron to deploy without requiring a separate `npm run seed:sources`
 * pass on the same release.
 *
 * Returns `true` if a row was inserted (first run); `false` if the
 * row already existed (UPSERT no-op).
 */
async function ensureSourceRow(db: Db, log: (line: string) => void): Promise<boolean> {
  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.id, ONS_SOURCE_ID))
    .limit(1);
  const wasMissing = existing.length === 0;

  await db
    .insert(sources)
    .values({
      id: ONS_SOURCE_ID,
      name: "Office for National Statistics (UK)",
      baseUrl: ONS_BASE_URL_SOURCES_FIELD,
      license: ONS_LICENSE,
      isCommercialUseAllowed: true,
      lastSyncAt: null,
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        // Idempotent fields refresh — keeps `name`/`baseUrl`/`license`
        // in sync if the source-config drift across releases. Does NOT
        // touch `lastSyncAt`; that gets stamped at end-of-sync.
        name: "Office for National Statistics (UK)",
        baseUrl: ONS_BASE_URL_SOURCES_FIELD,
        license: ONS_LICENSE,
        isCommercialUseAllowed: true,
      },
    });

  if (wasMissing) {
    log(`  inserted new sources row: ${ONS_SOURCE_ID}`);
  }
  return wasMissing;
}

/**
 * Run the ONS-UK sync end-to-end. Idempotent — re-running on the same
 * data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncOnsUk(
  db: Db,
  options: OnsSyncOptions = {},
): Promise<OnsSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = ONS_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.cdid && c.cdid !== options.cdid) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: ONS_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      sourceRowInserted: false,
      disputes: null,
      errors: ["no ONS indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Defensively upsert the sources row before any writes. Skip in
  // dry-run mode so the dry-run pass is read-only against the DB.
  let sourceRowInserted = false;
  if (!options.dryRun) {
    try {
      sourceRowInserted = await ensureSourceRow(db, log);
    } catch (err) {
      errors.push(
        `ensureSourceRow failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      // Fall through — the row may already exist; downstream writes
      // will surface a foreign-key error if not.
    }
  }

  // Resolve the GBR jurisdiction once. Single-country NSO scope.
  const jrows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.iso3, ONS_TARGET_ISO3));
  const ukJurisdiction = jrows[0] ?? null;
  if (!ukJurisdiction) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: ONS_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      sourceRowInserted,
      disputes: null,
      errors: [
        `UK jurisdiction (iso3='${ONS_TARGET_ISO3}') not found — Phase R.7.0 backfill regression?`,
      ],
      dryRun: options.dryRun ?? false,
    };
  }
  log(
    `Resolved UK jurisdiction: ${ukJurisdiction.slug} (id=${ukJurisdiction.id}, iso2=${ukJurisdiction.iso2}, iso3=${ukJurisdiction.iso3}).`,
  );

  const counters = new Map<string, PerOnsCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.cdid));
  }

  const currentYear = new Date().getUTCFullYear();
  let totalWritten = 0;
  const touchedPairs = new Set<string>();

  for (const config of targets) {
    const counter = counters.get(config.factKey)!;
    const factKeyDef = getFactKey(config.factKey);
    if (!factKeyDef) {
      errors.push(
        `unknown fact-key '${config.factKey}' for ONS ${config.cdid} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.cdid}) "${config.label}" — fetching…`,
    );

    let latest: OnsYearPoint | null = null;
    let observationCount = 0;
    let rejectedNoValue = 0;
    let upstreamReleaseDate: string | null = null;
    try {
      const result = await fetchIndicator(config);
      latest = result.latest;
      observationCount = result.observationCount;
      rejectedNoValue = result.rejectedNoValue;
      upstreamReleaseDate = result.upstreamReleaseDate;
    } catch (err) {
      errors.push(
        `${config.cdid} ${config.factKey} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    counter.observations = observationCount;
    counter.rejected_no_value = rejectedNoValue;
    counter.upstreamReleaseDate = upstreamReleaseDate;
    log(
      `  fetched ${observationCount} annual observations` +
        (rejectedNoValue > 0 ? ` (empty: ${rejectedNoValue})` : "") +
        (latest
          ? ` — latest ${latest.year} = ${latest.value}`
          : " — no usable points") +
        (upstreamReleaseDate ? ` [released ${upstreamReleaseDate}]` : ""),
    );
    if (!latest) continue;

    counter.jurisdictions_with_value = 1;

    const transform = config.valueTransform ?? ((v: number) => v);
    const numericValue = transform(latest.value);

    // Plausibility envelope per fact-key registry §3.6. Same R.1.1
    // fix as R.7 OECD / R.11 Eurostat: when isPercent is true,
    // [-1, 101] is only a fallback for fact-keys that don't declare
    // their own min/max. Explicit min/max take precedence.
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
        errors.push(
          `${config.factKey}: envelope reject — ${numericValue} outside [${min ?? "-∞"}, ${max ?? "+∞"}]`,
        );
        continue;
      }
    }

    counter.pickedYear = latest.year;
    counter.pickedValue = numericValue;

    const factYear = latest.year;
    const asOf = `${factYear}-01-01`;

    // Bug 1 forward policy — defensive year-based discriminator. The
    // 5 R.14 series ship measured-only data (back-looking realized
    // values). Counter stays at 0 in normal runs but fires defensively
    // for any future ONS series that may include forecasts.
    const valueType: "measured" | "projected" =
      factYear > currentYear ? "projected" : "measured";
    if (factYear > currentYear) {
      counter.projection_rows++;
    }

    const docUrl = buildDocUrl(config);

    const upstreamPayload = {
      source: ONS_SOURCE_ID,
      endpoint: buildDataUrl(config),
      iso3: ukJurisdiction.iso3,
      cdid: config.cdid,
      year: factYear,
      rawValue: latest.value,
      transformedValue: numericValue,
      onsVintage: ONS_VINTAGE,
      onsReleaseDate: upstreamReleaseDate,
      onsPointUpdateDate: latest.updateDate,
    };
    const hash = payloadHash(upstreamPayload);

    // Per-row references payload. Mirrors R.7 OECD / R.11 Eurostat
    // shape + adds `onsCdid`, `onsReleaseDate`, `scopePredicate` for
    // the methodology page (R.23) to render scope-bounded canonical
    // attribution.
    const referencesPayload = [
      {
        url: docUrl,
        allowlistTier: 2,
        allowlistName: "ONS (UK)",
        civicaRole: config.civicaRole ?? "alternate",
        license: ONS_LICENSE,
        scopePredicate: ONS_SCOPE_PREDICATE,
        onsCdid: config.cdid,
        onsSourceDataset:
          config.urlPath.split("/").slice(-1)[0]?.toUpperCase() ??
          null,
        onsReleaseDate: upstreamReleaseDate,
      },
    ];

    if (options.dryRun) {
      log(
        `  [DRY] ${ukJurisdiction.slug} ${config.factKey} = ${numericValue} (${factYear}, ${valueType})`,
      );
      counter.written++;
      totalWritten++;
      touchedPairs.add(`${ukJurisdiction.id}|${config.factKey}`);
      continue;
    }

    try {
      // Snapshot dedup — re-runs with identical upstream payloads are
      // no-ops at the snapshot table.
      await db
        .insert(factSnapshots)
        .values({
          sourceId: ONS_SOURCE_ID,
          upstreamRef: `ons:${ukJurisdiction.iso3}:${config.cdid}:${factYear}`,
          payloadHash: hash,
          payload: upstreamPayload as object,
          upstreamVintageLabel: ONS_VINTAGE,
        })
        .onConflictDoNothing({
          target: [factSnapshots.sourceId, factSnapshots.payloadHash],
        });

      const snapshotIdRow = await db
        .select({ id: factSnapshots.id })
        .from(factSnapshots)
        .where(
          sql`${factSnapshots.sourceId} = ${ONS_SOURCE_ID} AND ${factSnapshots.payloadHash} = ${hash}`,
        )
        .limit(1);
      const snapshotId = snapshotIdRow[0]?.id ?? null;

      await db
        .insert(countryFacts)
        .values({
          jurisdictionId: ukJurisdiction.id,
          factKey: config.factKey,
          factGroup: factKeyDef.group,
          category: factKeyDef.category,
          sourceId: ONS_SOURCE_ID,
          sourceUrl: docUrl,
          references: referencesPayload,
          sourceHash: hash,
          factValue: String(numericValue),
          factValueNumeric: numericValue,
          factUnit: factKeyDef.unit ?? null,
          factYear,
          valueJson: null,
          asOf,
          retrievedAt: new Date(),
          upstreamVintageLabel: ONS_VINTAGE,
          methodologyVersion: "v0.1-beta",
          status: "active",
          statusReason: null,
          snapshotId,
          sourceNote: null,
          valueType,
        })
        .onConflictDoUpdate({
          target: [
            countryFacts.jurisdictionId,
            countryFacts.factKey,
            countryFacts.sourceId,
          ],
          // F.5.1 invariant: do NOT add `status` or `statusReason` to
          // this set clause. Reviewer-demoted rows must survive a
          // re-sync so the resolver continues to honour the human
          // decision.
          //
          // Bug 1 — `valueType` IS included in the set clause so
          // per-row tag updates land on subsequent syncs (e.g. a year
          // that was projected in 2026 becomes measured when 2027
          // rolls over).
          set: {
            factValue: String(numericValue),
            factValueNumeric: numericValue,
            factUnit: factKeyDef.unit ?? null,
            factYear,
            asOf,
            sourceUrl: docUrl,
            references: referencesPayload,
            sourceHash: hash,
            retrievedAt: new Date(),
            upstreamVintageLabel: ONS_VINTAGE,
            snapshotId,
            valueType,
            updatedAt: new Date(),
          },
        });
      counter.written++;
      totalWritten++;
      touchedPairs.add(`${ukJurisdiction.id}|${config.factKey}`);
    } catch (err) {
      errors.push(
        `${ukJurisdiction.slug} ${config.factKey}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    log(
      `  wrote ${counter.written} row` +
        (counter.rejected_envelope
          ? ` [envelope rejects: ${counter.rejected_envelope}]`
          : "") +
        (counter.projection_rows
          ? ` [projections: ${counter.projection_rows}]`
          : ""),
    );
  }

  await markSourcesSynced(ONS_SOURCE_ID, {
    rowsWritten: totalWritten,
    dryRun: options.dryRun,
    executor: db,
  });

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
      disputes = await persistProposedDisputes(db, touched, {
        dryRun: options.dryRun,
        onProgress: (line) => {
          if (line.startsWith("[DRY]")) return;
          log(`  ${line}`);
        },
      });
      for (const e of disputes.errors) errors.push(`disputes: ${e}`);
    } catch (err) {
      errors.push(
        `dispute persistence failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  const finishedAtMs = Date.now();
  const countersByFactKey: Record<string, PerOnsCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: 1,
    vintageLabel: ONS_VINTAGE,
    countersByFactKey,
    totalWritten,
    sourceRowInserted,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
