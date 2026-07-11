/**
 * Phase R.17 — Statistics Canada (StatCan) sync orchestrator.
 *
 * NSO Wave 2, fifth NSO phase. Direct sync from Statistics Canada's
 * Web Data Service (WDS) REST API at
 * `https://www150.statcan.gc.ca/t1/wds/rest/`. The WDS API is
 * keyless (no auth scheme exists) and serves data as JSON. All
 * endpoints accept POST with a JSON request body; GET returns 405.
 *
 * Ships 3 indicators across 3 existing fact-keys + 0 new
 * fact-keys:
 *
 *   1. WDS vector v1                    → `population_total`
 *      (Population estimates, quarterly, table 17-10-0009-01)
 *   2. WDS vector v41690973 + 12mo prior → `inflation_rate`
 *      (CPI all-items NSA, monthly, table 18-10-0004-01;
 *       YoY computed in-sync from latest 13 monthly observations)
 *   3. WDS vector v2062815              → `unemployment_rate_pct`
 *      (LFS Canada total, both genders, 15+, seasonally adjusted,
 *       monthly, table 14-10-0287-03)
 *
 * **Canada-only scope.** Statistics Canada is the legal statistical
 * authority for Canada; it has no methodological claim outside
 * Canadian borders. The sync writes rows for `iso2='CA'` ONLY. For
 * non-Canada jurisdictions, Civica's resolver continues using
 * IMF/WB/UN/etc.
 *
 * **Multi-canonical with scope predicate.** Per resolution §2d /
 * §2e (Option C, inherited from R.13 US Census), all R.17
 * indicators ship with `civicaRole='canonical'`. Existing Tier-1
 * (`world_bank`, `un_data`, `imf_weo`, `oecd_stat`, `ilo_ilostat`,
 * `wikidata`, `cia_factbook`) `'canonical'` tags STAY in place —
 * StatCan ADDS as a concurrent canonical publisher bounded by
 * `iso2='CA'` scope. Same pattern as R.13 / R.14 / R.15.
 *
 * **NSO-priority-tier patch coordination.** The
 * `src/lib/factbook/reconcile/nso-overrides.ts` lookup already maps
 * `CAN: "statcan_ca"` (line 42, verified 2026-05-04). The R.13/R.14/
 * R.15 resolver patch ensures `statcan_ca` wins tied-date races
 * against Tier-1 publishers for the Canada jurisdiction. The source
 * ID `"statcan_ca"` MUST match the `NSO_SOURCE_BY_ISO3["CAN"]` entry
 * there. Don't rename.
 *
 * **Inflation single-write — DEVIATION FROM R.7/R.11.** R.7 OECD
 * and R.11 Eurostat ship inflation to BOTH `inflation_rate` AND
 * `inflation_rate_pct`. R.17 writes to `inflation_rate` ONLY per
 * the user override 2026-05-04: `inflation_rate_pct` is a vestigial
 * registry key with 0 rows site-wide; reviving it would re-introduce
 * a key the registry should retire. The R.7/R.11 precedent stands
 * for those phases; R.17 deviates explicitly. See resolution doc
 * §5d + §6 Q3.
 *
 * **value_type per Bug 1 forward policy.** All R.17 rows tag
 * `'measured'`. WDS publishes observed monthly/quarterly estimates
 * with revision flags but never forecasts. The year-based
 * `factYear > currentYear → 'projected'` discriminator fires
 * defensively at write time but never trips for StatCan
 * (publication lag is 3-12 weeks; future-dated data does not
 * exist).
 *
 * **License: Statistics Canada Open Licence.** Worldwide,
 * royalty-free, non-exclusive; commercial-use OK with the required
 * attribution notice — *"Source: Statistics Canada, name of
 * product, reference date. Reproduced and distributed on an 'as is'
 * basis with the permission of Statistics Canada."* Functionally
 * equivalent to CC-BY for our use; NOT formally CC-BY because the
 * licence is governed by Ontario law and includes
 * identification-via-merging + federal-logos prohibitions that
 * CC-BY does not. License slug: `statcan_open_licence`.
 *
 * The Phase F resolver picks between StatCan and existing Tier-1
 * publishers per methodology §3.3 — material-error guard +
 * freshness preference WITH Bug 1's `value_type` partition AND
 * NSO-priority-tier tiebreak. The `civicaRole` field on each
 * indicator config is informational only (NOT used by the
 * resolver); it persists into the fact row's
 * `references[].civicaRole` payload so the methodology page
 * rewrite (Phase R.23) can render scope-bounded canonical
 * attribution without a separate lookup.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.17
 * Resolution:  ~/civica/plan/statcan-resolution-v1.md
 * Bug 1:       ~/civica/plan/forecast-vs-measurement-v1.md
 */
import { eq, sql } from "drizzle-orm";

import {
  countryFacts,
  factSnapshots,
  jurisdictions,
} from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import { getFactKey } from "./fact-keys";
import {
  persistProposedDisputes,
  type PersistDisputeSummary,
} from "./dispute-persistence";
import { payloadHash, type CivicaSourceRole } from "./_sync-common";

type Db = typeof import("@/lib/db").db;

const STATCAN_BASE_URL = "https://www150.statcan.gc.ca/t1/wds/rest";
const STATCAN_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * License string stamped into per-row references payload.
 *
 * Statistics Canada Open Licence — commercial-use OK with the
 * required attribution notice. Per
 * `~/civica/plan/statcan-resolution-v1.md` §2f.
 */
const STATCAN_LICENSE = "statcan_open_licence";

/**
 * Required attribution notice per Statistics Canada Open Licence.
 * The methodology page (R.23) will surface this prominently in the
 * per-source attribution block. Stamped here so machine consumers
 * (the public API envelope) can carry it through.
 *
 * Per `~/civica/plan/statcan-resolution-v1.md` §2f.
 */
const STATCAN_ATTRIBUTION =
  "Source: Statistics Canada, Web Data Service (WDS). Reproduced and distributed on an 'as is' basis with the permission of Statistics Canada.";

/**
 * Civica-side vintage label. StatCan publishes via WDS vector IDs
 * (e.g. v1 = Canada quarterly population). Each indicator carries
 * its own table reference because population, CPI, and LFS publish
 * on different cadences and from different StatCan tables.
 */
const STATCAN_VINTAGE_LABEL_PREFIX = "Statistics Canada WDS";

/**
 * One StatCan WDS indicator we care about. Encodes the vector ID,
 * the destination Civica fact-key, and (for the inflation indicator)
 * a YoY-computation flag because the CPI is published as an index
 * value rather than a percent change.
 *
 * `valueTransform` lets us reshape upstream units to fact-key units.
 * Most R.17 indicators are identity transforms; `inflation_rate` is
 * the lone exception — it pulls 13 monthly observations and computes
 * `(idx_t / idx_{t-12} - 1) × 100`.
 */
export interface StatCanIndicatorConfig {
  /**
   * Primary vector ID (e.g. 1 for Canada population, 41690973 for
   * CPI all-items). The sync ALWAYS calls
   * `getDataFromVectorsAndLatestNPeriods` with this vector and
   * `latestN`.
   */
  vectorId: number;
  /**
   * Number of latest periods to pull. For identity-transform
   * indicators (population, unemployment), `latestN: 1`. For the
   * CPI YoY composition, `latestN: 13` (latest + 12 months prior).
   */
  latestN: number;
  /**
   * StatCan productId (table number padded to 8 digits without
   * separator: e.g. 17100009 for table 17-10-0009-01). Stamped into
   * the row's references payload so consumers can link to the
   * underlying StatCan table.
   */
  productId: number;
  /**
   * Human-readable StatCan table reference (e.g. "17-10-0009-01"
   * for "Population estimates, quarterly"). Used in the vintage
   * label.
   */
  tableRef: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /**
   * Optional reshape function applied to the raw 1-13 observations
   * before envelope check and write. Default: identity on the LATEST
   * observation's value (parsed as float).
   *
   * For the YoY-composition indicator, `valueTransform` receives the
   * full observation array (oldest first) and returns the composed
   * numeric value (percent change).
   */
  valueTransform?: (observations: StatCanObservation[]) => number;
  /**
   * Documentation URL for the indicator. Stored in the fact row's
   * references payload so the alternates panel can link out.
   */
  docUrl: string;
  /**
   * Civica's editorial role for this StatCan indicator. R.17 ships
   * all 3 indicators as `'canonical'` for Canada per the resolution
   * §2d / §2e (Option C — multi-canonical with scope predicate).
   * The Phase F resolver does NOT use this field for runtime
   * selection (the resolver is freshness-driven per methodology
   * §3.3); the field is informational metadata for the methodology
   * page rewrite at Phase R.23. Mirrors R.13 US Census's
   * `UsCensusIndicatorConfig.civicaRole`.
   */
  civicaRole?: CivicaSourceRole;
}

/**
 * Single observation returned by the WDS API
 * `getDataFromVectorsAndLatestNPeriods` endpoint. Pruned shape; we
 * ignore most metadata fields (decimals, scalarFactorCode,
 * symbolCode, etc.) because the numeric value plus reference period
 * are the only fields the sync actually consumes.
 */
export interface StatCanObservation {
  refPer: string;
  refPerRaw: string;
  value: number;
  releaseTime: string;
  frequencyCode: number;
}

/**
 * The 3 StatCan indicators in R.17 ship scope. Per
 * `~/civica/plan/statcan-resolution-v1.md` §2b.
 *
 * Live probes verified 2026-05-04:
 *   - v1 (Canada quarterly population) Q1 2026 = 41,472,081
 *   - v41690973 (Canada CPI all-items NSA) 2026-03 = 167.4;
 *     2025-03 = 163.5; YoY = (167.4 / 163.5 - 1) × 100 = 2.39%
 *   - v2062815 (Canada LFS unemployment rate, total gender, 15+,
 *     seasonally adjusted) 2026-03 = 6.7%
 *
 * Per resolution §2c.4 / §2c.5 / §2c.6, GDP growth, median age,
 * urbanization rate, and CAD-denominated income are NOT in R.17
 * scope — see resolution doc for deferral rationale.
 */
export const STATCAN_INDICATORS: readonly StatCanIndicatorConfig[] = [
  {
    vectorId: 1,
    latestN: 1,
    productId: 17100009,
    tableRef: "17-10-0009-01",
    factKey: "population_total",
    label: "Population estimates, quarterly (Canada total)",
    docUrl:
      "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000901",
    civicaRole: "canonical",
  },
  {
    // CPI YoY computation — published as monthly NSA index, not
    // a percent change. Pull the latest 13 monthly observations
    // and compute (idx_t / idx_{t-12} - 1) × 100.
    //
    // Live probe 2026-05-04:
    //   GET v41690973, latestN=13
    //   → CPI 2026-03 = 167.4 ; CPI 2025-03 = 163.5
    //   → YoY = (167.4 / 163.5 - 1) × 100 = 2.39%
    //
    // **DEVIATION FROM R.7 / R.11:** writes to `inflation_rate`
    // ONLY (not also `inflation_rate_pct`). Per user override
    // 2026-05-04 — see resolution §5d + §6 Q3.
    vectorId: 41690973,
    latestN: 13,
    productId: 18100004,
    tableRef: "18-10-0004-01",
    factKey: "inflation_rate",
    label: "Consumer Price Index, all-items NSA, monthly (Canada YoY)",
    docUrl:
      "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401",
    civicaRole: "canonical",
    valueTransform: (observations: StatCanObservation[]) => {
      // Observations come back oldest-first per WDS spec; the
      // latest is the last element, the 12-month-prior anchor is
      // the first element when latestN=13.
      if (observations.length < 13) return Number.NaN;
      const sorted = [...observations].sort(
        (a, b) => Date.parse(a.refPer) - Date.parse(b.refPer),
      );
      const latest = sorted[sorted.length - 1];
      const prior = sorted[0];
      if (
        !latest ||
        !prior ||
        !Number.isFinite(latest.value) ||
        !Number.isFinite(prior.value) ||
        prior.value === 0
      ) {
        return Number.NaN;
      }
      return (latest.value / prior.value - 1) * 100;
    },
  },
  {
    vectorId: 2062815,
    latestN: 1,
    productId: 14100287,
    tableRef: "14-10-0287-03",
    factKey: "unemployment_rate_pct",
    label:
      "Unemployment rate, both genders, 15+, seasonally adjusted, monthly",
    docUrl:
      "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028703",
    civicaRole: "canonical",
  },
];

/**
 * Per-indicator counter shape. Mirrors the US Census / INSEE patterns.
 */
export interface PerStatCanCounters {
  factKey: string;
  vectorId: number;
  productId: number;
  /**
   * Number of API rows received for this indicator (1 for
   * identity-transform indicators; 13 for the CPI YoY composition).
   */
  observations: number;
  /** 1 when the indicator successfully resolved to a value; 0 otherwise. */
  jurisdictions_with_value: number;
  written: number;
  rejected_envelope: number;
  rejected_no_value: number;
  /**
   * Rows rejected because the value didn't parse to a finite
   * number (e.g. WDS returned `null` for a suppressed observation).
   */
  rejected_parse_error: number;
  /**
   * Counter for forecast-year rows. Defensive — StatCan doesn't
   * publish forecasts; this counter should stay at 0 in normal runs.
   */
  projection_rows: number;
}

export interface StatCanSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  countersByFactKey: Record<string, PerStatCanCounters>;
  totalWritten: number;
  /**
   * Phase F.6.1 — disputes the resolver flagged as needing review,
   * written to `data_disputes` after the sync completes. Null on
   * dry runs.
   */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface StatCanSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(
  factKey: string,
  vectorId: number,
  productId: number,
): PerStatCanCounters {
  return {
    factKey,
    vectorId,
    productId,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    rejected_parse_error: 0,
    projection_rows: 0,
  };
}

/**
 * Fetch one StatCan WDS vector and parse the observations.
 *
 * WDS API endpoint:
 *   POST /getDataFromVectorsAndLatestNPeriods
 *   Body: [{"vectorId": <int>, "latestN": <int>}]
 *   → [{
 *       "status": "SUCCESS",
 *       "object": {
 *         "responseStatusCode": 0,
 *         "productId": 17100009,
 *         "coordinate": "1.0.0.0.0.0.0.0.0.0",
 *         "vectorId": 1,
 *         "vectorDataPoint": [
 *           {
 *             "refPer": "2026-01-01",
 *             "refPerRaw": "2026-01-01",
 *             "value": 4.1472081E7,
 *             "decimals": 0,
 *             "scalarFactorCode": 0,
 *             "symbolCode": 0,
 *             "statusCode": 0,
 *             "securityLevelCode": 0,
 *             "releaseTime": "2026-03-18T08:30",
 *             "frequencyCode": 9
 *           }
 *         ]
 *       }
 *     }]
 *
 * Returns the array of observations. Suppressed observations
 * (`value === null`) pass through; the caller's parse-error counter
 * handles them.
 */
async function fetchVectorObservations(
  vectorId: number,
  latestN: number,
): Promise<StatCanObservation[]> {
  const url = `${STATCAN_BASE_URL}/getDataFromVectorsAndLatestNPeriods`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": STATCAN_USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ vectorId, latestN }]),
  });
  if (!res.ok) {
    throw new Error(
      `StatCan WDS v${vectorId} latestN=${latestN}: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error(
      `StatCan WDS v${vectorId}: expected non-empty array, got ${typeof body}`,
    );
  }
  const head = body[0] as { status?: string; object?: unknown };
  if (head.status !== "SUCCESS" || !head.object) {
    throw new Error(
      `StatCan WDS v${vectorId}: status=${head.status} (not SUCCESS)`,
    );
  }
  const obj = head.object as {
    responseStatusCode?: number;
    vectorDataPoint?: unknown;
  };
  if (obj.responseStatusCode !== 0) {
    throw new Error(
      `StatCan WDS v${vectorId}: responseStatusCode=${obj.responseStatusCode} (not 0)`,
    );
  }
  if (!Array.isArray(obj.vectorDataPoint)) {
    throw new Error(
      `StatCan WDS v${vectorId}: vectorDataPoint is not an array`,
    );
  }
  const out: StatCanObservation[] = [];
  for (const p of obj.vectorDataPoint as unknown[]) {
    if (!p || typeof p !== "object") continue;
    const point = p as Record<string, unknown>;
    const refPer = typeof point.refPer === "string" ? point.refPer : "";
    const refPerRaw =
      typeof point.refPerRaw === "string" ? point.refPerRaw : refPer;
    const valueRaw = point.value;
    const value =
      typeof valueRaw === "number"
        ? valueRaw
        : typeof valueRaw === "string"
          ? parseFloat(valueRaw)
          : Number.NaN;
    const releaseTime =
      typeof point.releaseTime === "string" ? point.releaseTime : "";
    const frequencyCode =
      typeof point.frequencyCode === "number" ? point.frequencyCode : 0;
    out.push({ refPer, refPerRaw, value, releaseTime, frequencyCode });
  }
  return out;
}

/**
 * Pick the canonical reference year for a StatCan observation set.
 *
 * For identity-transform indicators (latestN=1), it's the year of
 * the single observation. For YoY-composition indicators (latestN=13),
 * it's the year of the LATEST observation (the one whose YoY change
 * we're publishing).
 */
function pickFactYear(observations: StatCanObservation[]): number {
  if (observations.length === 0) return 0;
  const sorted = [...observations].sort(
    (a, b) => Date.parse(a.refPer) - Date.parse(b.refPer),
  );
  const latest = sorted[sorted.length - 1];
  const m = /^(\d{4})/.exec(latest.refPer);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Pick the canonical `as_of` date string. Mirrors the year picker
 * but returns ISO-8601 date format (`YYYY-MM-DD`) using the latest
 * observation's reference period (which is always a 1st-of-month
 * date in WDS responses).
 */
function pickAsOf(observations: StatCanObservation[]): string {
  if (observations.length === 0) return "";
  const sorted = [...observations].sort(
    (a, b) => Date.parse(a.refPer) - Date.parse(b.refPer),
  );
  const latest = sorted[sorted.length - 1];
  return latest.refPer.slice(0, 10);
}

/**
 * Build the per-indicator vintage label stamped into the row's
 * `upstream_vintage_label` column. Mirrors R.13 / R.14 / R.15
 * convention `<Source> <Dataset> <YYYY[-MM]>`.
 */
function buildVintageLabel(
  config: StatCanIndicatorConfig,
  observations: StatCanObservation[],
): string {
  const asOf = pickAsOf(observations);
  // Population is quarterly (frequencyCode 9), so the vintage label
  // shows "YYYY-Qn"; CPI and LFS are monthly (frequencyCode 6), so
  // they show "YYYY-MM". Unemployment uses the same monthly format.
  const latest = observations[observations.length - 1];
  if (latest && latest.frequencyCode === 9) {
    // Quarterly. refPer is the first day of the quarter.
    const m = /^(\d{4})-(\d{2})/.exec(asOf);
    if (m) {
      const year = m[1];
      const month = parseInt(m[2], 10);
      const quarter = Math.floor((month - 1) / 3) + 1;
      return `${STATCAN_VINTAGE_LABEL_PREFIX} ${config.tableRef} ${year}-Q${quarter}`;
    }
  }
  if (latest && latest.frequencyCode === 6) {
    // Monthly. refPer is YYYY-MM-01.
    const m = /^(\d{4})-(\d{2})/.exec(asOf);
    if (m) {
      return `${STATCAN_VINTAGE_LABEL_PREFIX} ${config.tableRef} ${m[1]}-${m[2]}`;
    }
  }
  // Fallback — annual or unknown frequency.
  const m = /^(\d{4})/.exec(asOf);
  return `${STATCAN_VINTAGE_LABEL_PREFIX} ${config.tableRef} ${m ? m[1] : "unknown"}`;
}

/**
 * Run the StatCan sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncStatCanCa(
  db: Db,
  options: StatCanSyncOptions = {},
): Promise<StatCanSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = STATCAN_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
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
      errors: ["no StatCan indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Resolve the Canada jurisdiction once; the sync is single-jurisdiction
  // by design (Statistics Canada scope is Canada-only).
  const canRows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.iso2, "CA"));
  if (canRows.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: [
        "Canada jurisdiction not found in jurisdictions table (iso2='CA')",
      ],
      dryRun: options.dryRun ?? false,
    };
  }
  const can = canRows[0];
  log(
    `Canada jurisdiction resolved: id=${can.id}, slug=${can.slug}, iso3=${can.iso3}.`,
  );

  const counters = new Map<string, PerStatCanCounters>();
  for (const c of targets) {
    counters.set(
      c.factKey,
      freshCounters(c.factKey, c.vectorId, c.productId),
    );
  }

  const currentYear = new Date().getUTCFullYear();
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
        `unknown fact-key '${config.factKey}' for StatCan v${config.vectorId} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (v${config.vectorId} / ${config.tableRef}) "${config.label}" — fetching…`,
    );

    let observations: StatCanObservation[];
    let numericValue: number;
    try {
      observations = await fetchVectorObservations(
        config.vectorId,
        config.latestN,
      );
      counter.observations = observations.length;
      const transform =
        config.valueTransform ??
        ((obs: StatCanObservation[]) =>
          obs.length > 0 ? obs[obs.length - 1].value : Number.NaN);
      numericValue = transform(observations);
    } catch (err) {
      errors.push(
        `v${config.vectorId} ${config.factKey} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }

    if (!Number.isFinite(numericValue)) {
      counter.rejected_parse_error++;
      log(
        `  rejected_parse_error: StatCan returned non-finite value for ${config.factKey} (observations=${observations.length})`,
      );
      continue;
    }
    counter.jurisdictions_with_value = 1;

    // Plausibility envelope per fact-key registry §3.6. Same R.1.1
    // fix as R.7 OECD / R.11 Eurostat / R.13 US Census: when isPercent
    // is true, [-1, 101] is only a fallback for fact-keys that don't
    // declare their own min/max. Explicit min/max take precedence.
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
        log(
          `  rejected_envelope: ${config.factKey} = ${numericValue} outside [${min}, ${max}]`,
        );
        continue;
      }
    }

    const factYear = pickFactYear(observations);
    const asOf = pickAsOf(observations);
    const vintageLabel = buildVintageLabel(config, observations);

    // Bug 1 forward policy — defensive year-based discriminator.
    // StatCan does NOT publish forecasts; this counter should stay
    // at 0 in normal runs.
    const valueType: "measured" | "projected" =
      factYear > currentYear ? "projected" : "measured";
    if (factYear > currentYear) {
      counter.projection_rows++;
    }

    const upstreamPayload = {
      source: "statcan_ca",
      endpoint: `${STATCAN_BASE_URL}/getDataFromVectorsAndLatestNPeriods`,
      iso2: can.iso2,
      iso3: can.iso3,
      vectorId: config.vectorId,
      productId: config.productId,
      tableRef: config.tableRef,
      latestN: config.latestN,
      year: factYear,
      asOf,
      observations,
      transformedValue: numericValue,
      vintageLabel,
    };
    const hash = payloadHash(upstreamPayload);

    // R.17 — per-row references payload. Mirrors R.13 / R.14 / R.15
    // shape. The required Statistics Canada attribution notice is
    // stamped into `attributionNotice` so the methodology page (R.23)
    // and the public API envelope can surface it.
    const referencesPayload = [
      {
        url: config.docUrl,
        allowlistTier: 2,
        allowlistName: "Statistics Canada",
        civicaRole: config.civicaRole ?? "alternate",
        license: STATCAN_LICENSE,
        attributionNotice: STATCAN_ATTRIBUTION,
        statcanProductId: config.productId,
        statcanTableRef: config.tableRef,
        statcanVectorId: config.vectorId,
      },
    ];

    if (options.dryRun) {
      log(
        `  [DRY] ${can.slug} ${config.factKey} = ${numericValue} (${factYear}, ${valueType}, vintage=${vintageLabel})`,
      );
      counter.written++;
      totalWritten++;
      touchedPairs.add(`${can.id}|${config.factKey}`);
      continue;
    }

    try {
      // Snapshot dedup — re-runs with identical upstream payloads
      // are no-ops at the snapshot table.
      await db
        .insert(factSnapshots)
        .values({
          sourceId: "statcan_ca",
          upstreamRef: `statcan_ca:${can.iso2}:v${config.vectorId}:${config.factKey}:${factYear}`,
          payloadHash: hash,
          payload: upstreamPayload as object,
          upstreamVintageLabel: vintageLabel,
        })
        .onConflictDoNothing({
          target: [factSnapshots.sourceId, factSnapshots.payloadHash],
        });

      const snapshotIdRow = await db
        .select({ id: factSnapshots.id })
        .from(factSnapshots)
        .where(
          sql`${factSnapshots.sourceId} = 'statcan_ca' AND ${factSnapshots.payloadHash} = ${hash}`,
        )
        .limit(1);
      const snapshotId = snapshotIdRow[0]?.id ?? null;

      await db
        .insert(countryFacts)
        .values({
          jurisdictionId: can.id,
          factKey: config.factKey,
          factGroup: factKeyDef.group,
          category: factKeyDef.category,
          sourceId: "statcan_ca",
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
          upstreamVintageLabel: vintageLabel,
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
          // F.5.1 invariant: do NOT add `status` or `statusReason`
          // to this set clause. Reviewer-demoted rows must survive
          // a re-sync so the resolver continues to honour the
          // human decision.
          //
          // Bug 1 — `valueType` IS included in the set clause so
          // per-row tag updates land on subsequent syncs.
          set: {
            factValue: String(numericValue),
            factValueNumeric: numericValue,
            factUnit: factKeyDef.unit ?? null,
            factYear,
            asOf,
            sourceUrl: config.docUrl,
            references: referencesPayload,
            sourceHash: hash,
            retrievedAt: new Date(),
            upstreamVintageLabel: vintageLabel,
            snapshotId,
            valueType,
            updatedAt: new Date(),
          },
        });
      counter.written++;
      totalWritten++;
      touchedPairs.add(`${can.id}|${config.factKey}`);
      log(
        `  wrote ${config.factKey} = ${numericValue} (${factYear}, ${valueType}, vintage=${vintageLabel})`,
      );
    } catch (err) {
      errors.push(
        `${can.slug} ${config.factKey}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  await markSourcesSynced("statcan_ca", {
    rowsWritten: errors.length === 0 ? totalWritten : 0,
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
  const countersByFactKey: Record<string, PerStatCanCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: 1,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
