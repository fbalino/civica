/**
 * Phase R.5 — UNESCO Institute for Statistics (UIS) sync orchestrator.
 *
 * Direct sync from the modern UIS Data API at
 * `https://api.uis.unesco.org/api/public/`. Mirrors the F.6 / R.1 World
 * Bank WDI pattern at `sync-wdi.ts` and the R.4 WHO GHO pattern at
 * `sync-who-gho.ts` (closest precedent — also a tight scope into one
 * already-declared fact-key tagged `civicaRole: 'canonical'`).
 *
 * After R.7.5 ships 8 indicators (R.5's 1 + R.7.5's 5 new education
 * fact-keys + 2 canonical-flips):
 *   - `LR.AG15T99` → `literacy_rate` (canonical)
 *   - `XGDP.FSGOV` → `government_education_expenditure_pct_gdp` (canonical; R.7.5 NEW)
 *   - `MYS.1T8.AG25T99` → `mean_years_schooling` (canonical; R.7.5 CANONICAL-FLIP from UNDP)
 *   - `SLE.1T8` → `expected_years_schooling` (canonical; R.7.5 CANONICAL-FLIP from UNDP)
 *   - `GER.1` → `gross_enrollment_ratio_primary_pct` (canonical; R.7.5 NEW)
 *   - `GER.2T3` → `gross_enrollment_ratio_secondary_pct` (canonical; R.7.5 NEW)
 *   - `CR.1` → `completion_rate_primary_pct` (canonical; R.7.5 NEW)
 *   - `LR.AG15T99.GPIA` → `gender_parity_index_literacy` (canonical; R.7.5 NEW)
 *
 * All ship as `civicaRole: 'canonical'`. The 7 R.7.5 additions cover
 * the deferrals from R.5's original scope (5 new fact-keys) plus the
 * canonical-flip handoff from R.6 UNDP for the 2 schooling-years
 * fact-keys. UNDP HDR republishes UNESCO's values for HDI calculation;
 * UNESCO is the upstream-of-record. Per
 * `~/civica/plan/fact-key-registry-expansion-resolution-v1.md` §2b
 * + §3, UNESCO is now editorial canonical for these indicators and
 * UNDP rows flip to alternate via `sync-undp-hdi.ts` config update.
 * `out_of_school_rate_primary` deferred to v1.1 per resolution Q4.
 *
 * Endpoint shape:
 *   - `GET /api/public/versions/default` returns the current default
 *     version handle + per-theme last-update strings. Read at sync
 *     start to resolve the upstream vintage label (e.g. "UIS February
 *     2026 Data Release"); fall back to the constant on fetch failure.
 *   - `GET /api/public/data/indicators?indicator=<CODE>&start=<Y>&end=<Y>&version=<V>`
 *     returns `{hints, records: [{indicatorId, geoUnit, year, value,
 *     magnitude, qualifier}], indicatorMetadata}`. `geoUnit` is ISO3
 *     for sovereign states; named regional aggregates appear as
 *     non-ISO3 strings (e.g. "AIMS: South and West Asia") and are
 *     filtered out client-side via the `^[A-Z]{3}$` regex. The
 *     100,000-row response cap is well above any single-indicator
 *     query R.5 will issue (~1,000 rows for 10 years × 166 countries).
 *
 * Key architectural differences from `sync-wdi.ts` / `sync-imf-weo.ts` /
 * `sync-un-data.ts`:
 *   - No pagination: UIS API responses fit in one round-trip per
 *     indicator at R.5 scope.
 *   - No ZIP unwrap (unlike UN's legacy portal): the API returns
 *     plain JSON.
 *   - No country-name fallback: `geoUnit` is always ISO3, no M49 →
 *     ISO3 translation needed.
 *   - License is **CC BY-SA 4.0** — verified live 2026-05-04 against
 *     the API's `info.license` block AND
 *     `https://databrowser.uis.unesco.org/terms-and-conditions`. The
 *     seeded `sources.license` value `CC-BY-3.0-IGO` is empirically
 *     wrong (Phase F seed conflated UIS and WHO); the sync corrects
 *     it on every run via the `sources.last_sync_at` UPDATE statement.
 *     See `~/civica/plan/unesco-uis-resolution-v1.md` §2f and Q1.
 *   - The `UIS_EST` qualifier on UIS-modelled estimate rows is
 *     preserved in the snapshot payload but does NOT demote the row;
 *     all UIS rows ship as `civicaRole: 'canonical'` regardless of
 *     qualifier. See resolution §2k.
 *
 * The Phase F resolver picks between UIS and CIA / WB / Wikidata per
 * methodology §3.3 — material-error guard + freshness preference.
 * **UIS does NOT actively measure literacy for high-income OECD
 * countries** (USA, UK, Germany etc. have no `LR.AG15T99` rows for any
 * year 1990-2024). For those countries, CIA's frozen Jan 2026 value
 * displays via the resolver's freshness rule; the methodology page
 * rewrite (R.23) explains the canonical-vs-displayed distinction. See
 * `~/civica/plan/unesco-uis-resolution-v1.md` §2d for the worked
 * example.
 *
 * The `civicaRole` field on each indicator config is informational
 * only (NOT used by the resolver); it persists into the fact row's
 * `references[].civicaRole` payload so the methodology page rewrite
 * (R.23) can render canonical-vs-alternate without a separate lookup.
 * See `~/civica/plan/unesco-uis-resolution-v1.md` §2d.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.5
 * Resolution:  ~/civica/plan/unesco-uis-resolution-v1.md
 */
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
import { payloadHash, type CivicaSourceRole } from "./_sync-common";

type Db = typeof import("@/lib/db").db;

const UIS_BASE_URL = "https://api.uis.unesco.org/api/public";
const UIS_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";
// 35-year lookback — UIS publishes adult literacy back to 1970, but
// most countries' coverage is sparse before 1990 and Civica only
// cares about the most-recent observation per country. 35 years is
// generous enough to capture countries with infrequent census-style
// reports while keeping the response payload small.
const UIS_LOOKBACK_YEARS = 35;
// Hard fallback used when the live `/versions/default` probe fails;
// matches the human-readable label the API returns for the EDUCATION
// theme as of 2026-05-04.
const UIS_VINTAGE_FALLBACK = "UIS February 2026 Data Release";
// UIS data is licensed under CC BY-SA 4.0 (verified live 2026-05-04
// at the API `info.license` block AND
// `databrowser.uis.unesco.org/terms-and-conditions`). The seeded
// `sources.license` value `CC-BY-3.0-IGO` is wrong; we both stamp
// per-row license metadata AND correct the sources row on every sync.
// See `~/civica/plan/unesco-uis-resolution-v1.md` §2f.
const UIS_LICENSE = "CC BY-SA 4.0";

/**
 * One UIS indicator we care about. Each entry maps an upstream UIS
 * indicator code to a Civica fact-key. R.5 ships only one entry
 * (`LR.AG15T99` → `literacy_rate`); future fact-key-registry
 * expansion phases extend this array.
 */
export interface UnescoUisIndicatorConfig {
  /** UIS API indicator code (e.g. "LR.AG15T99"). */
  uisCode: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw UIS `value` before envelope check
   *  and write. Default 1 — used when the UIS unit matches the
   *  fact-key unit verbatim. R.5 ships only `literacy_rate` (% stays
   *  %) so no transform is needed. */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this UIS indicator. R.5 ships
   *  `'canonical'` for `literacy_rate`. The Phase F resolver does
   *  NOT use this field for runtime selection (the resolver is
   *  freshness-driven per methodology §3.3); the field is
   *  informational metadata for the methodology page rewrite at
   *  Phase R.23. Mirrors R.1's `WdiIndicatorConfig.civicaRole`. */
  civicaRole?: CivicaSourceRole;
}

export const UNESCO_UIS_INDICATORS: readonly UnescoUisIndicatorConfig[] = [
  // ─── R.5 ship list (1 indicator) — see resolution §2b. ───
  {
    // Adult literacy rate, population 15+ years, both sexes (%).
    // UIS is the global authority for literacy and hosts the
    // SDG 4.6.1 indicator. R.1 explicitly tagged WB's
    // `SE.ADT.LITR.ZS` as `'alternate'` so R.5 inherits canonical
    // without re-deciding. CIA Factbook stays alternate (Tier 3,
    // frozen Jan 2026). High-income OECD countries (USA, UK,
    // Germany, etc.) have no UIS row — UIS does not actively
    // measure them. The resolver's freshness rule picks CIA for
    // those countries; the methodology page rewrite (R.23) explains
    // the canonical-vs-displayed distinction. See resolution §2d
    // for the Brazil + Nigeria + South Africa worked examples.
    uisCode: "LR.AG15T99",
    factKey: "literacy_rate",
    label: "Adult literacy rate, population 15+ years, both sexes (%)",
    docUrl: "https://databrowser.uis.unesco.org/indicator/LR.AG15T99",
    civicaRole: "canonical",
  },

  // ─── R.7.5 ship list (5 new education fact-keys + 2 canonical-flips
  //     for the schooling-years fact-keys originally registered by R.6
  //     UNDP). See `~/civica/plan/fact-key-registry-expansion-resolution-v1.md`
  //     §2b + §3. UNESCO is the upstream-of-record for these indicators;
  //     UNDP HDR republishes UNESCO's values for HDI calculation.
  //     `out_of_school_rate_primary` deferred to v1.1 per §7 Q4. ───
  {
    // Government expenditure on education as % of GDP. Probe
    // (2020-2025): per-country range ~0.5-16.4% (Cuba historic
    // high). 205 ISO3 coverage. UNESCO is the upstream-of-record;
    // World Bank republishes UIS as `SE.XPD.TOTL.GD.ZS` (alternate).
    uisCode: "XGDP.FSGOV",
    factKey: "government_education_expenditure_pct_gdp",
    label: "Government expenditure on education as % of GDP",
    docUrl: "https://databrowser.uis.unesco.org/indicator/XGDP.FSGOV",
    civicaRole: "canonical",
  },
  {
    // Mean years of schooling (ISCED 1+, population 25+).
    // CANONICAL-FLIP: UNDP HDR R.6 originally tagged this canonical;
    // R.7.5 §3 flips UNESCO to canonical (upstream-of-record) and
    // UNDP to alternate. The flip is enacted by the next idempotent
    // sync re-run on `sync-undp-hdi.ts` (UNDP rows write
    // `civicaRole: 'alternate'`).
    //
    // Probe (2018-2024): min Mali 1.6, max Germany 14.3. 199 ISO3
    // coverage.
    uisCode: "MYS.1T8.AG25T99",
    factKey: "mean_years_schooling",
    label: "Mean years of schooling (ISCED 1+), population 25+",
    docUrl: "https://databrowser.uis.unesco.org/indicator/MYS.1T8.AG25T99",
    civicaRole: "canonical",
  },
  {
    // Expected years of schooling (school life expectancy, ISCED
    // 1-8). CANONICAL-FLIP: UNDP HDR R.6 originally tagged this
    // canonical; R.7.5 §3 flips UNESCO to canonical (upstream-of-
    // record) and UNDP to alternate. Probe (2024+): min Burkina
    // Faso 7.5, max Monaco 21.0. 144+ ISO3 coverage.
    uisCode: "SLE.1T8",
    factKey: "expected_years_schooling",
    label: "School life expectancy from primary to tertiary (ISCED 1-8), both sexes",
    docUrl: "https://databrowser.uis.unesco.org/indicator/SLE.1T8",
    civicaRole: "canonical",
  },
  {
    // Gross enrollment ratio, primary, both sexes. Probe (2020+):
    // min Somalia 20.9, max Sierra Leone 162. 220 ISO3 coverage.
    // GER routinely exceeds 100% because over-age and under-age
    // children get enrolled in primary — fact-key envelope max 200
    // (NOT isPercent: true; would clamp to 101).
    uisCode: "GER.1",
    factKey: "gross_enrollment_ratio_primary_pct",
    label: "Gross enrollment ratio, primary, both sexes",
    docUrl: "https://databrowser.uis.unesco.org/indicator/GER.1",
    civicaRole: "canonical",
  },
  {
    // Gross enrollment ratio, secondary, both sexes (combined lower
    // + upper secondary). Probe (2020+): min Somalia 3.3, max
    // Monaco 158.5. 220 ISO3 coverage.
    uisCode: "GER.2T3",
    factKey: "gross_enrollment_ratio_secondary_pct",
    label: "Gross enrollment ratio, secondary, both sexes",
    docUrl: "https://databrowser.uis.unesco.org/indicator/GER.2T3",
    civicaRole: "canonical",
  },
  {
    // Completion rate, primary education, both sexes. Probe (2020+):
    // min Niger 35.8, max Norway/Qatar 100. 159 ISO3 coverage.
    uisCode: "CR.1",
    factKey: "completion_rate_primary_pct",
    label: "Primary education completion rate, both sexes",
    docUrl: "https://databrowser.uis.unesco.org/indicator/CR.1",
    civicaRole: "canonical",
  },
  {
    // Gender parity index, adult literacy. Probe (2018+): min Chad
    // 0.42, max Lesotho 1.14. 166 ISO3 coverage. GPI = (female
    // literacy rate) / (male literacy rate); 1.0 = parity.
    uisCode: "LR.AG15T99.GPIA",
    factKey: "gender_parity_index_literacy",
    label: "Gender parity index, adult literacy",
    docUrl: "https://databrowser.uis.unesco.org/indicator/LR.AG15T99.GPIA",
    civicaRole: "canonical",
  },
];

/**
 * One row as returned by the UIS data endpoint. Field names are
 * case-sensitive and match the upstream JSON exactly.
 */
export interface UisDataPoint {
  indicatorId: string;
  /** ISO3 for sovereign states; non-ISO3 string for regional
   *  aggregates (e.g. "AIMS: South and West Asia"). */
  geoUnit: string;
  year: number;
  value: number;
  /** Optional magnitude qualifier; usually null. Preserved in the
   *  snapshot payload but does not affect Civica's processing. */
  magnitude: string | null;
  /** Optional qualifier — most commonly "UIS_EST" indicating a
   *  UIS-modelled estimate rather than a direct national report.
   *  Preserved in the snapshot payload. R.5 does NOT demote
   *  UIS_EST rows; all UIS rows ship as `civicaRole: 'canonical'`
   *  regardless. See resolution §2k. */
  qualifier: string | null;
}

/**
 * Shape of `/api/public/versions/default` response. Only the
 * fields R.5 reads are typed.
 */
interface UisVersionResponse {
  version: string;
  publicationDate: string;
  description: string;
  themeDataStatus: Array<{
    theme: string;
    lastUpdate: string;
    description: string;
  }>;
}

/**
 * Shape of `/api/public/data/indicators` response. Only the fields
 * R.5 reads are typed.
 */
interface UisDataResponse {
  hints: unknown[];
  records: UisDataPoint[];
  indicatorMetadata: unknown[];
}

export interface PerUisCounters {
  factKey: string;
  uisCode: string;
  observations: number;
  iso3_records: number;
  jurisdictions_with_value: number;
  written: number;
  skipped_no_iso3: number;
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
  /** UIS_EST-qualifier rows. Counted for diagnostic purposes; not
   *  rejected. */
  uis_estimates: number;
}

export interface UnescoUisSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  /** The vintage label resolved live from `/versions/default`, or
   *  `UIS_VINTAGE_FALLBACK` if the probe failed. */
  vintageLabel: string;
  /** The opaque version handle from the API
   *  (`{version: "20260311-78618c3e", ...}`); preserved for
   *  diagnostic purposes. Null if the version probe failed. */
  versionHandle: string | null;
  countersByFactKey: Record<string, PerUisCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface UnescoUisSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific UIS indicator code (for testing). */
  uisCode?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
  /** Deterministic fixture seams; production callers omit these. */
  fetchVersion?: typeof fetchDefaultVersion;
  fetchIndicator?: typeof fetchIndicator;
  jurisdictions?: UnescoUisJurisdiction[];
  persistDisputes?: typeof persistProposedDisputes;
  markSynced?: typeof markSourcesSynced;
  updateSourceLicense?: (db: Db) => Promise<void>;
}

export interface UnescoUisJurisdiction {
  id: string;
  slug: string;
  iso3: string | null;
}

function freshCounters(
  factKey: string,
  uisCode: string,
): PerUisCounters {
  return {
    factKey,
    uisCode,
    observations: 0,
    iso3_records: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_no_iso3: 0,
    skipped_no_jurisdiction: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    uis_estimates: 0,
  };
}

/**
 * Fetch the live default version handle + EDUCATION theme label.
 * Returns `{handle, label}` on success; `{handle: null, label:
 * UIS_VINTAGE_FALLBACK}` on failure (logged but non-fatal — the
 * sync proceeds with the fallback label so we never block on a
 * version-metadata blip).
 */
async function fetchDefaultVersion(): Promise<{
  handle: string | null;
  label: string;
}> {
  const url = `${UIS_BASE_URL}/versions/default`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UIS_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      return { handle: null, label: UIS_VINTAGE_FALLBACK };
    }
    const body = (await res.json()) as UisVersionResponse;
    const eduTheme = body.themeDataStatus?.find(
      (t) => t.theme === "EDUCATION",
    );
    const description = eduTheme?.description?.trim();
    const label = description ? `UIS ${description}` : UIS_VINTAGE_FALLBACK;
    return { handle: body.version ?? null, label };
  } catch {
    return { handle: null, label: UIS_VINTAGE_FALLBACK };
  }
}

/**
 * Fetch all rows for one indicator across the lookback window. UIS
 * caps responses at 100,000 records; R.5's single-indicator queries
 * return ~1,000 records (10 years × ~166 countries) — well below the
 * cap. If the API ever surfaces a 100k-row truncation hint we log
 * a warning and proceed with whatever was returned; future expansion
 * phases would split into per-year queries.
 */
async function fetchIndicator(
  config: UnescoUisIndicatorConfig,
  startYear: number,
  endYear: number,
  versionHandle: string | null,
  log: (line: string) => void,
): Promise<UisDataPoint[]> {
  const params = new URLSearchParams({
    indicator: config.uisCode,
    start: String(startYear),
    end: String(endYear),
  });
  if (versionHandle) params.append("version", versionHandle);

  const url = `${UIS_BASE_URL}/data/indicators?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UIS_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `UIS ${config.uisCode}: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as UisDataResponse;
  if (Array.isArray(body.hints) && body.hints.length > 0) {
    log(`  ! UIS hints returned: ${JSON.stringify(body.hints)}`);
  }
  return Array.isArray(body.records) ? body.records : [];
}

const ISO3_REGEX = /^[A-Z]{3}$/;

/**
 * Pick the most recent non-null observation per ISO3 country. UIS
 * `geoUnit` field carries ISO3 for sovereign states and non-ISO3
 * strings for named aggregates (e.g. "AIMS: South and West Asia",
 * "ALECSO: Gulf countries"). The regex filter drops aggregates so
 * regional rollups never land in `country_facts`.
 */
function pickLatestPerCountry(
  rows: UisDataPoint[],
  counter: PerUisCounters,
): Map<string, UisDataPoint> {
  const latest = new Map<string, UisDataPoint>();
  for (const r of rows) {
    if (r.value === null || r.value === undefined || !Number.isFinite(r.value)) {
      counter.rejected_no_value++;
      continue;
    }
    const geo = (r.geoUnit ?? "").toUpperCase();
    if (!ISO3_REGEX.test(geo)) {
      counter.skipped_no_iso3++;
      continue;
    }
    counter.iso3_records++;
    if (r.qualifier === "UIS_EST") counter.uis_estimates++;
    const existing = latest.get(geo);
    if (!existing) {
      latest.set(geo, r);
      continue;
    }
    if (r.year > existing.year) {
      latest.set(geo, r);
    }
  }
  return latest;
}

/**
 * Run the UIS sync end-to-end. Idempotent — re-running on the same
 * data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncUnescoUis(
  db: Db,
  options: UnescoUisSyncOptions = {},
): Promise<UnescoUisSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = UNESCO_UIS_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.uisCode && c.uisCode !== options.uisCode) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: UIS_VINTAGE_FALLBACK,
      versionHandle: null,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no UIS indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Resolve the live default version + vintage label once at sync
  // startup. Future runs will pick up new EDUCATION theme releases
  // (e.g. "August 2026 Data Release") automatically without code
  // changes.
  const { handle: versionHandle, label: vintageLabel } =
    await (options.fetchVersion ?? fetchDefaultVersion)();
  log(
    `Resolved UIS vintage: "${vintageLabel}"` +
      (versionHandle ? ` (version=${versionHandle})` : " (fallback)"),
  );

  // Build iso3 → jurisdictionId map once; reused across all
  // indicators.
  const allJurisdictions = options.jurisdictions ?? await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(sql`${jurisdictions.iso3} IS NOT NULL`);
  const iso3ToJurisdiction = new Map<
    string,
    { id: string; slug: string; iso3: string | null }
  >();
  for (const j of allJurisdictions) {
    if (j.iso3) iso3ToJurisdiction.set(j.iso3.toUpperCase(), j);
  }
  log(
    `${allJurisdictions.length} jurisdictions with ISO3 codes loaded.`,
  );

  const counters = new Map<string, PerUisCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.uisCode));
  }

  const endYear = new Date().getFullYear();
  const startYear = endYear - UIS_LOOKBACK_YEARS;

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
        `unknown fact-key '${config.factKey}' for UIS ${config.uisCode} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.uisCode}) "${config.label}" — fetching ${startYear}:${endYear}…`,
    );

    let rows: UisDataPoint[];
    try {
      rows = await (options.fetchIndicator ?? fetchIndicator)(
        config,
        startYear,
        endYear,
        versionHandle,
        log,
      );
    } catch (err) {
      errors.push(
        `${config.uisCode} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    counter.observations = rows.length;
    log(`  fetched ${rows.length} observations`);

    const latestByIso3 = pickLatestPerCountry(rows, counter);
    counter.jurisdictions_with_value = latestByIso3.size;
    log(
      `  ${latestByIso3.size} ISO3 countries with at least one non-null value` +
        (counter.uis_estimates
          ? ` (UIS-modelled estimates flagged: ${counter.uis_estimates})`
          : ""),
    );

    for (const [iso3, dp] of latestByIso3) {
      const j = iso3ToJurisdiction.get(iso3);
      if (!j) {
        counter.skipped_no_jurisdiction++;
        continue;
      }

      const transform = config.valueTransform ?? ((v: number) => v);
      const numericValue = transform(dp.value);

      // Plausibility envelope per fact-key registry §3.6.
      // R.1.1 fix mirrored inline (per R.3 / R.4 sign-off Q2 — do
      // NOT extract a shared helper this round; helper extraction
      // is a small follow-up after R.5/R.6/R.7 wave 2 lands per
      // resolution §6 Q3): when isPercent is true, the [-1, 101]
      // range is only a fallback for fact-keys that do not declare
      // their own min/max. When min/max are explicitly set in the
      // fact-key definition, those values take precedence.
      // See `~/civica/plan/unesco-uis-resolution-v1.md` §2e.
      const env = factKeyDef.envelope;
      if (env) {
        const min = env.isPercent
          ? (env.min !== undefined ? env.min : -1)
          : env.min;
        const max = env.isPercent
          ? (env.max !== undefined ? env.max : 101)
          : env.max;
        if (
          (min !== undefined && numericValue < min) ||
          (max !== undefined && numericValue > max)
        ) {
          counter.rejected_envelope++;
          continue;
        }
      }

      const factYear = dp.year;
      const asOf = Number.isFinite(factYear) ? `${factYear}-01-01` : null;

      const upstreamPayload = {
        source: "unesco_uis",
        endpoint: `${UIS_BASE_URL}/data/indicators?indicator=${config.uisCode}&geoUnit=${j.iso3}`,
        iso3: j.iso3,
        uisCode: config.uisCode,
        year: factYear,
        rawValue: dp.value,
        transformedValue: numericValue,
        magnitude: dp.magnitude,
        qualifier: dp.qualifier,
        uisVintage: vintageLabel,
        uisVersionHandle: versionHandle,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "UNESCO Institute for Statistics",
          // Civica's canonical/alternate editorial role for this
          // (source, fact-key) pair. R.5 ships `'canonical'` for
          // `literacy_rate`. The resolver does not consult this
          // field; the methodology page rewrite (R.23) reads it to
          // render the editorial canonical alongside the freshest
          // displayed value. See
          // `~/civica/plan/unesco-uis-resolution-v1.md` §2j.
          civicaRole: config.civicaRole ?? "canonical",
          // Per-row license metadata. UIS data is CC BY-SA 4.0
          // (verified live 2026-05-04). Future commercial-monetization
          // paths can use this field via license-aware response
          // middleware to filter SA-licensed rows. See
          // `~/civica/plan/unesco-uis-resolution-v1.md` §2f.
          license: UIS_LICENSE,
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${dp.year}` +
            (dp.qualifier ? `, ${dp.qualifier}` : "") +
            `)`,
        );
        counter.written++;
        totalWritten++;
        touchedPairs.add(`${j.id}|${config.factKey}`);
        continue;
      }

      try {
        // Snapshot dedup — re-runs with identical upstream payloads
        // are no-ops at the snapshot table.
        await db
          .insert(factSnapshots)
          .values({
            sourceId: "unesco_uis",
            upstreamRef: `uis:${j.iso3}:${config.uisCode}:${dp.year}`,
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
            sql`${factSnapshots.sourceId} = 'unesco_uis' AND ${factSnapshots.payloadHash} = ${hash}`,
          )
          .limit(1);
        const snapshotId = snapshotIdRow[0]?.id ?? null;

        await db
          .insert(countryFacts)
          .values({
            jurisdictionId: j.id,
            factKey: config.factKey,
            factGroup: factKeyDef.group,
            category: factKeyDef.category,
            sourceId: "unesco_uis",
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
              updatedAt: new Date(),
            },
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
  }

  if (!options.dryRun && errors.length === 0) {
    // Correct the seeded license string (CC-BY-3.0-IGO → CC-BY-SA-4.0)
    // per resolution Q1. This correction is applied on every non-dry
    // run regardless of whether rows were written — it is NOT a
    // freshness stamp, so it stays a direct `sources` update.
    if (options.updateSourceLicense) await options.updateSourceLicense(db);
    else {
      await db
        .update(sources)
        .set({ license: "CC-BY-SA-4.0" })
        .where(eq(sources.id, "unesco_uis"));
    }
  }
  // Freshness stamp routed through the sole sanctioned helper, which
  // stamps `last_sync_at` only when the run actually wrote rows.
  await (options.markSynced ?? markSourcesSynced)("unesco_uis", {
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
      disputes = await (options.persistDisputes ?? persistProposedDisputes)(db, touched, {
        dryRun: options.dryRun,
        onProgress: (line) => {
          if (line.startsWith("[DRY]")) return; // too verbose
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
  const countersByFactKey: Record<string, PerUisCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    vintageLabel,
    versionHandle,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
