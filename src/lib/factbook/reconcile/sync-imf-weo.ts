/**
 * Phase R.2 — IMF World Economic Outlook (WEO) sync orchestrator.
 *
 * Direct sync from the IMF Datamapper API at
 * `https://www.imf.org/external/datamapper/api/v1/`. Mirrors the F.6 /
 * R.1 World Bank WDI pattern at `sync-wdi.ts`. Ingests the 11 WEO
 * indicators that map cleanly to declared Civica fact-keys (plus the
 * new `fiscal_balance_pct_gdp` fact-key declared in R.2).
 *
 * Key architectural differences from `sync-wdi.ts`:
 *   - IMF WEO ships forward projections through current-year + 5y
 *     (currently 2031). Civica's `pickLatestPerCountry()` analog
 *     intentionally picks the highest-year observation regardless
 *     of whether it's an actual or a forecast. Methodology page
 *     (R.23) will surface actual-vs-forecast distinction at the UI
 *     layer; the data pipe is simple "newest year wins". See
 *     `~/civica/plan/imf-weo-resolution-v1.md` §6 Q3.
 *   - Two indicators require unit transforms: LP (population) ships
 *     in millions, must multiply by 1e6; BCA (current account)
 *     ships in billions of USD, must multiply by 1e9. Civica
 *     fact-key envelopes work in raw units. See resolution §3 step 8.
 *   - IMF WEO publishes twice per year (April + October). The cron
 *     fires at those windows, NOT quarterly like WB WDI.
 *   - Vintage label is read live from the API's `/indicators`
 *     metadata; defaults to the constant `IMF_WEO_VINTAGE` if the
 *     metadata fetch fails. See resolution §3 step 2.
 *
 * The Phase F resolver picks between IMF and WB / CIA / Wikidata
 * per methodology §3.3 — material-error guard + freshness preference.
 * The `civicaRole` field on each indicator config is informational
 * only (NOT used by the resolver); it persists into the fact row's
 * `references[].civicaRole` payload so the methodology page rewrite
 * (Phase R.23) can render canonical-vs-alternate without a separate
 * lookup. See `~/civica/plan/imf-weo-resolution-v1.md` §2d.
 *
 * IMF is canonical for forward-looking projections (debt forecasts,
 * growth forecasts, fiscal balance, current account forecasts) and
 * for PPP variants. IMF is alternate for population (UN WPP canonical
 * at R.3) and unemployment (ILO canonical at R.10). WB stays
 * canonical for actuals on shared keys; the resolver's freshness
 * rule picks per-row at runtime.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.2
 * Resolution:  ~/civica/plan/imf-weo-resolution-v1.md
 */
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import {
  countryFacts,
  factSnapshots,
  jurisdictions,
  sources,
} from "@/lib/db/schema";
import { getFactKey } from "./fact-keys";
import {
  persistProposedDisputes,
  type PersistDisputeSummary,
} from "./dispute-persistence";

type Db = typeof import("@/lib/db").db;

const IMF_BASE_URL = "https://www.imf.org/external/datamapper/api/v1";
const IMF_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Fallback vintage label when the live `/indicators` metadata fetch
 * fails. The sync will read the per-indicator `source` string from
 * the API at startup and prefer that; this is just a safety net.
 *
 * Pattern: "IMF WEO YYYY <Month>". Update when a new WEO release is
 * the safer fallback (typically once after each spring/autumn cut).
 * The live API string for the current vintage is "World Economic
 * Outlook (April 2026)" — we re-format as "IMF WEO 2026 April" to
 * match the WB WDI vintage shape ("World Bank WDI 2026Q3").
 */
const IMF_WEO_VINTAGE_FALLBACK = "IMF WEO 2026 April";

/**
 * Civica's editorial role for a given (source, fact-key) pair.
 *
 * Same convention as `sync-wdi.ts`. Per
 * `~/civica/plan/imf-weo-resolution-v1.md` §2d.
 */
export type CivicaSourceRole = "canonical" | "alternate";

/**
 * One WEO indicator we care about. Each entry maps an upstream IMF
 * Datamapper indicator code to a Civica fact-key. The optional
 * `valueTransform` lets us reshape upstream units to fact-key units
 * (e.g. IMF ships LP in millions of people; our key is people; the
 * transform multiplies by 1e6).
 */
export interface ImfWeoIndicatorConfig {
  /** IMF Datamapper indicator code (e.g. "NGDP_RPCH"). */
  weoCode: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw IMF value before envelope check
   *  and write. Default 1 — used when the IMF unit matches the
   *  fact-key unit verbatim (e.g. % stays %, USD billions stays
   *  USD billions). */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this IMF indicator. Defaults to
   *  `'alternate'` when omitted. Persisted into the row's
   *  `references[].civicaRole` so the methodology page rewrite
   *  (R.23) can render canonical-vs-alternate without a separate
   *  lookup. Per `~/civica/plan/imf-weo-resolution-v1.md` §2d. */
  civicaRole?: CivicaSourceRole;
}

export const IMF_WEO_INDICATORS: readonly ImfWeoIndicatorConfig[] = [
  // ─── Forward-projection economy keys (6 indicators) — IMF
  //     canonical for forecast years; WB stays canonical for actuals
  //     via the resolver's freshness rule per resolution §2d. ───
  {
    weoCode: "NGDP_RPCH",
    factKey: "gdp_real_growth_rate",
    label: "Real GDP growth (annual %)",
    docUrl: "https://www.imf.org/external/datamapper/NGDP_RPCH@WEO",
    // IMF canonical for forward GDP-growth projections; WB stays
    // canonical for actuals via resolver freshness.
    civicaRole: "canonical",
  },
  {
    // IMF NGDPD ships nominal GDP DIRECTLY in billions of USD per
    // the Datamapper unit string ("Billions of U.S. dollars"). No
    // transform needed — Civica's `gdp_nominal_usd_billions`
    // envelope is also in billions [0.05, 30_000]. Verified
    // 2026-05-03: USA 2024 IMF = 28,832 billion ≈ WB 28,750.957. ✓
    weoCode: "NGDPD",
    factKey: "gdp_nominal_usd_billions",
    label: "GDP, current prices (USD billions, nominal)",
    docUrl: "https://www.imf.org/external/datamapper/NGDPD@WEO",
    civicaRole: "canonical",
  },
  {
    weoCode: "PCPIPCH",
    factKey: "inflation_rate",
    label: "Inflation, average consumer prices (annual %)",
    docUrl: "https://www.imf.org/external/datamapper/PCPIPCH@WEO",
    // IMF canonical for forward inflation projections; WB stays
    // canonical for actuals via resolver freshness. WB itself
    // republishes IMF data for hyperinflationary cases (Argentina
    // 2024: IMF 219.9 ≈ WB 219.88).
    civicaRole: "canonical",
  },
  {
    // IMF BCA ships current account in BILLIONS of USD. Civica's
    // `current_account_balance_usd` envelope is in raw USD
    // [-2e12, 2e12]. Transform: multiply by 1e9. Verified
    // 2026-05-03: USA peak ~−$1.0T = -1000 billion → -1e12 ≤
    // envelope max 2e12. ✓
    weoCode: "BCA",
    factKey: "current_account_balance_usd",
    label: "Current account balance (USD billions)",
    docUrl: "https://www.imf.org/external/datamapper/BCA@WEO",
    valueTransform: (raw: number) => raw * 1_000_000_000,
    // IMF canonical for forward CA forecasts; WB stays canonical
    // for actuals via resolver freshness.
    civicaRole: "canonical",
  },
  {
    weoCode: "GGXCNL_NGDP",
    factKey: "fiscal_balance_pct_gdp",
    label: "General government net lending/borrowing (% of GDP)",
    docUrl: "https://www.imf.org/external/datamapper/GGXCNL_NGDP@WEO",
    // New fact-key declared in R.2 (`fact-keys.ts`). Currently 0
    // rows in `country_facts` — IMF closes 0→~189 single-source
    // coverage. OECD (R.7) and Eurostat (R.11) will alternate
    // for OECD members + EU members.
    civicaRole: "canonical",
  },
  {
    weoCode: "GGXWDG_NGDP",
    factKey: "public_debt_pct_gdp",
    label: "General government gross debt (% of GDP)",
    docUrl: "https://www.imf.org/external/datamapper/GGXWDG_NGDP@WEO",
    // IMF canonical for forward debt projections; WB stays
    // canonical for actuals via resolver freshness.
    civicaRole: "canonical",
  },

  // ─── PPP variants (2 indicators) — IMF is the standard global
  //     PPP reference; CIA already alternate. ───
  {
    weoCode: "PPPGDP",
    factKey: "gdp_ppp_usd_billions",
    label: "GDP, PPP (international $ billions)",
    docUrl: "https://www.imf.org/external/datamapper/PPPGDP@WEO",
    // CIA has 218 rows currently; IMF closes the multi-source
    // gap from 1 → 2 sources.
    civicaRole: "canonical",
  },
  {
    // PPPPC writes to canonical `gdp_per_capita_usd` alongside WB's
    // `NY.GDP.PCAP.PP.CD` row per resolution §6 Q1 (user signed off
    // 2026-05-03). Different sourceId (`imf_weo` vs `world_bank`)
    // means the unique constraint
    // (jurisdictionId, factKey, sourceId) accommodates both rows.
    weoCode: "PPPPC",
    factKey: "gdp_per_capita_usd",
    label: "GDP per capita, PPP (international $)",
    docUrl: "https://www.imf.org/external/datamapper/PPPPC@WEO",
    civicaRole: "canonical",
  },

  // ─── Population (1 indicator) — IMF alternate; UN WPP canonical
  //     at R.3. ───
  {
    // CRITICAL TRANSFORM: IMF LP ships population in MILLIONS;
    // Civica's `population_total` envelope expects raw people
    // [1_000, 2_000_000_000]. Transform: multiply by 1e6.
    // Verified 2026-05-03: USA 2024 IMF = 341.0 (millions) →
    // 341,000,000 ✓; smallest country (Tuvalu ~0.011 millions)
    // → 11,000 ≥ envelope min 1,000 ✓.
    weoCode: "LP",
    factKey: "population_total",
    label: "Population (millions)",
    docUrl: "https://www.imf.org/external/datamapper/LP@WEO",
    valueTransform: (raw: number) => raw * 1_000_000,
    // UN WPP canonical at R.3; IMF alternate. (IMF's population
    // is itself a republication of UN WPP for many countries.)
    civicaRole: "alternate",
  },

  // ─── Unemployment (1 indicator) — IMF alternate; ILO canonical
  //     at R.10. Coverage gap: only 122 codes (advanced + emerging
  //     economies). ───
  {
    weoCode: "LUR",
    factKey: "unemployment_rate_pct",
    label: "Unemployment rate (%)",
    docUrl: "https://www.imf.org/external/datamapper/LUR@WEO",
    // ILO ILOSTAT canonical at R.10; IMF alternate. WB's 504-row
    // ILO-modelled coverage already exists; IMF expands the
    // multi-source coverage selectively.
    civicaRole: "alternate",
  },
];

/** IMF Datamapper API response for an indicator catalog entry. */
interface ImfIndicatorMeta {
  label: string;
  /** "World Economic Outlook (April 2026)" — used to derive vintage. */
  source: string;
  unit: string;
  dataset: string;
}

/** IMF Datamapper API response for a full indicator data fetch. */
interface ImfIndicatorResponse {
  values: {
    [indicatorCode: string]: {
      [iso3: string]: {
        [year: string]: number;
      };
    };
  };
}

export interface PerImfWeoCounters {
  factKey: string;
  weoCode: string;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  skipped_no_iso3: number;
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
  /** Counter for forecast-year rows landed (year > current calendar
   *  year). Informational; helps quantify the proportion of IMF
   *  rows that are forecasts vs actuals for the methodology page. */
  forecast_rows: number;
}

export interface ImfWeoSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  /** Vintage label as discovered from the live API metadata, OR the
   *  fallback constant if the metadata fetch failed. */
  vintageLabel: string;
  countersByFactKey: Record<string, PerImfWeoCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface ImfWeoSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific WEO indicator code (for testing). */
  weoCode?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(
  factKey: string,
  weoCode: string,
): PerImfWeoCounters {
  return {
    factKey,
    weoCode,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_no_iso3: 0,
    skipped_no_jurisdiction: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    forecast_rows: 0,
  };
}

function payloadHash(payload: object): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/**
 * Fetch the catalog of IMF Datamapper indicators and return a map
 * of `weoCode → ImfIndicatorMeta`. Used at sync startup to read the
 * live WEO vintage label (e.g. "World Economic Outlook (April 2026)").
 *
 * If the catalog fetch fails, the caller falls back to
 * `IMF_WEO_VINTAGE_FALLBACK`.
 */
async function fetchIndicatorCatalog(): Promise<
  Map<string, ImfIndicatorMeta>
> {
  const url = `${IMF_BASE_URL}/indicators`;
  const res = await fetch(url, {
    headers: { "User-Agent": IMF_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `IMF /indicators: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as {
    indicators?: Record<string, ImfIndicatorMeta>;
  };
  const out = new Map<string, ImfIndicatorMeta>();
  if (body.indicators) {
    for (const [code, meta] of Object.entries(body.indicators)) {
      out.set(code, meta);
    }
  }
  return out;
}

/**
 * Convert IMF's `source` string ("World Economic Outlook (April 2026)")
 * to Civica's vintage label shape ("IMF WEO 2026 April").
 */
function deriveVintageLabel(imfSource: string): string {
  // Match patterns like "World Economic Outlook (April 2026)" or
  // "World Economic Outlook (October 2025)".
  const match = imfSource.match(
    /World Economic Outlook \(([A-Za-z]+) (\d{4})\)/,
  );
  if (match) {
    const [, month, year] = match;
    return `IMF WEO ${year} ${month}`;
  }
  return IMF_WEO_VINTAGE_FALLBACK;
}

/**
 * Fetch all observations for an IMF indicator. Returns a nested
 * object: `{ <ISO3>: { <YEAR>: value } }`. The IMF Datamapper API
 * does NOT support a real path-filter (passing /USA/CHN returns the
 * full payload regardless), so we always fetch the full set and
 * filter client-side per Civica's 189 ISO3 jurisdictions.
 *
 * The full-payload size per indicator is 50–200 KB; 11 indicators
 * × ~150 KB ≈ 1.5 MB total per sync run. Negligible bandwidth cost.
 */
async function fetchIndicator(
  weoCode: string,
): Promise<Record<string, Record<string, number>>> {
  const url = `${IMF_BASE_URL}/${weoCode}`;
  const res = await fetch(url, {
    headers: { "User-Agent": IMF_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `IMF ${weoCode}: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as ImfIndicatorResponse;
  const indicatorBlock = body.values?.[weoCode];
  if (!indicatorBlock) {
    throw new Error(
      `IMF ${weoCode}: response shape missing values.${weoCode}`,
    );
  }
  return indicatorBlock;
}

/**
 * Pick the most recent non-null observation per country. Returns a
 * map keyed by uppercase iso3 with `{ year, value }`. Includes
 * forecast years per resolution §6 Q3 — newest year wins, regardless
 * of whether it's an actual or a forecast.
 */
function pickLatestPerCountry(
  rows: Record<string, Record<string, number>>,
): Map<string, { year: number; value: number }> {
  const latest = new Map<string, { year: number; value: number }>();
  for (const [iso3Raw, yearMap] of Object.entries(rows)) {
    const iso3 = iso3Raw.toUpperCase();
    if (!iso3 || iso3.length !== 3) continue;
    let bestYear = -Infinity;
    let bestValue: number | undefined;
    for (const [yearStr, value] of Object.entries(yearMap)) {
      if (value === null || value === undefined) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const year = parseInt(yearStr, 10);
      if (!Number.isFinite(year)) continue;
      if (year > bestYear) {
        bestYear = year;
        bestValue = value;
      }
    }
    if (bestValue !== undefined && Number.isFinite(bestYear)) {
      latest.set(iso3, { year: bestYear, value: bestValue });
    }
  }
  return latest;
}

/**
 * Run the IMF WEO sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncImfWeo(
  db: Db,
  options: ImfWeoSyncOptions = {},
): Promise<ImfWeoSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = IMF_WEO_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.weoCode && c.weoCode !== options.weoCode) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: IMF_WEO_VINTAGE_FALLBACK,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no IMF WEO indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Discover live vintage label from /indicators metadata. Falls
  // back to the constant if the catalog fetch fails — sync still
  // proceeds.
  let vintageLabel = IMF_WEO_VINTAGE_FALLBACK;
  try {
    const catalog = await fetchIndicatorCatalog();
    // Use the first target indicator's source to derive the vintage.
    // All WEO indicators share the same vintage string within a
    // release.
    for (const t of targets) {
      const meta = catalog.get(t.weoCode);
      if (meta?.source) {
        vintageLabel = deriveVintageLabel(meta.source);
        break;
      }
    }
    log(`Vintage label resolved: ${vintageLabel}`);
  } catch (err) {
    errors.push(
      `vintage discovery failed (using fallback ${IMF_WEO_VINTAGE_FALLBACK}): ${
        err instanceof Error ? err.message : err
      }`,
    );
    log(`Vintage discovery failed; using fallback ${vintageLabel}`);
  }

  // Build iso3 → jurisdictionId map once; reused across all
  // indicators.
  const allJurisdictions = await db
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

  const counters = new Map<string, PerImfWeoCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.weoCode));
  }

  const currentYear = new Date().getFullYear();

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
        `unknown fact-key '${config.factKey}' for IMF WEO ${config.weoCode} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.weoCode}) "${config.label}" — fetching…`,
    );

    let rows: Record<string, Record<string, number>>;
    try {
      rows = await fetchIndicator(config.weoCode);
    } catch (err) {
      errors.push(
        `${config.weoCode} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    const observationCount = Object.values(rows).reduce(
      (sum, yearMap) => sum + Object.keys(yearMap).length,
      0,
    );
    counter.observations = observationCount;
    log(`  fetched ${observationCount} observations across ${Object.keys(rows).length} country codes`);

    const latestByIso3 = pickLatestPerCountry(rows);
    counter.jurisdictions_with_value = latestByIso3.size;
    log(`  ${latestByIso3.size} country codes with at least one non-null value`);

    for (const [iso3, dp] of latestByIso3) {
      const j = iso3ToJurisdiction.get(iso3);
      if (!j) {
        counter.skipped_no_jurisdiction++;
        continue;
      }

      const transform = config.valueTransform ?? ((v: number) => v);
      const numericValue = transform(dp.value);

      // Plausibility envelope per fact-key registry §3.6.
      // R.1.1 fix: when isPercent is true, the [-1, 101] range is only a
      // fallback for fact-keys that do not declare their own min/max. When
      // min/max are explicitly set in the fact-key definition, the
      // per-fact-key values take precedence. Mirrored from
      // `sync-wdi.ts` lines 620–625 per implementation guidance —
      // helper extraction deferred until R.3 + R.4 land to avoid
      // parallel-edit conflicts.
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
      const asOf = `${factYear}-01-01`;

      // Bug 1 — value-type discriminator. A row whose fact_year is in
      // the future is a forecast (IMF's WEO ships projections through
      // current_year + 5y); a row whose fact_year is in the past is
      // either a measurement at the current vintage or a terminal-year
      // measurement for a country whose IMF series ended (Syria 2010,
      // Eritrea 2019, etc. — those countries have no recent IMF data
      // because of state collapse / sanctions). Both classes of past
      // rows are 'measured' for resolver purposes.
      //
      // See ~/civica/plan/forecast-vs-measurement-v1.md.
      const valueType: "measured" | "projected" =
        factYear > currentYear ? "projected" : "measured";

      // Track forecast rows (year > current year) for the methodology
      // page rewrite at R.23.
      if (factYear > currentYear) {
        counter.forecast_rows++;
      }

      const upstreamPayload = {
        source: "imf_weo",
        endpoint: `${IMF_BASE_URL}/${config.weoCode}`,
        iso3: j.iso3,
        weoCode: config.weoCode,
        year: factYear,
        rawValue: dp.value,
        transformedValue: numericValue,
        weoVintage: vintageLabel,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "International Monetary Fund (WEO / IFS)",
          // Civica's canonical/alternate editorial role for this
          // (source, fact-key) pair. Default 'alternate' when
          // omitted on the indicator config. See
          // `~/civica/plan/imf-weo-resolution-v1.md` §2d.
          civicaRole: config.civicaRole ?? "alternate",
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${factYear})`,
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
            sourceId: "imf_weo",
            upstreamRef: `imf:${j.iso3}:${config.weoCode}:${factYear}`,
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
            sql`${factSnapshots.sourceId} = 'imf_weo' AND ${factSnapshots.payloadHash} = ${hash}`,
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
            sourceId: "imf_weo",
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
            // Bug 1 — `valueType` IS included in the set clause. As
            // the calendar year advances, IMF rows that were forecasts
            // become measurements (e.g. a 2026 row written in April
            // 2026 is a forecast; the same year-key row in 2027 is a
            // measurement). Re-sync must reflect the current
            // year-vs-fact_year relationship.
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
              valueType,
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
        `(forecasts: ${counter.forecast_rows}, ` +
        `envelope rejects: ${counter.rejected_envelope}, ` +
        `unmatched ISO3: ${counter.skipped_no_jurisdiction})`,
    );
  }

  if (!options.dryRun) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, "imf_weo"));
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
      disputes = await persistProposedDisputes(db, touched, {
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
  const countersByFactKey: Record<string, PerImfWeoCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    vintageLabel,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
