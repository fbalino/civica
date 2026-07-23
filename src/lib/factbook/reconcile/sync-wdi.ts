/**
 * Phase F.6 + R.1 — World Bank WDI sync orchestrator.
 *
 * Direct sync from the World Bank's World Development Indicators API.
 * F.6 shipped 6 fact-keys (inflation, public debt, infant mortality,
 * CO₂, internet users, GDP per capita PPP). R.1 expands to 20 total
 * indicators across demographics, economy, trade, labour, education,
 * energy, and military domains. See `WDI_INDICATORS` below for the
 * full list and per-indicator canonical/alternate role.
 *
 * For each indicator we ask the WB API for the most recent ~10 years
 * of data globally (`country/all/indicator/<code>`), pick the latest
 * non-null observation per country, validate against the fact-key's
 * plausibility envelope, then upsert into `country_facts` keyed by
 * `(jurisdictionId, factKey, sourceId='world_bank')`. Snapshots are
 * deduplicated via `fact_snapshots` (sourceId + payloadHash).
 *
 * The Phase F resolver picks between WB and CIA / Wikidata per
 * methodology §3.3 — material-error guard + freshness preference.
 * The new `civicaRole` field on each indicator config is informational
 * only (NOT used by the resolver); it persists into the fact row's
 * `references[].civicaRole` payload so the methodology page rewrite
 * (Phase R.23) can render canonical-vs-alternate without a separate
 * lookup. See `~/civica/plan/wb-wdi-expansion-resolution-v1.md` §2d.
 *
 * Most R.1 indicators are tagged `'alternate'` because Phases R.2–R.12
 * will introduce canonical Tier-1 publishers (IMF for inflation /
 * public debt, UN WPP for population / fertility / births / deaths,
 * WHO for life expectancy / infant mortality, UNESCO for literacy,
 * ILO for unemployment, WTO for trade). WB stays canonical for
 * domains without a planned upstream Tier-1 (CO₂ via WDI, internet
 * users via ITU republication, electricity access, current account,
 * reserves, urbanization).
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.1
 * Resolution:  ~/civica/plan/wb-wdi-expansion-resolution-v1.md
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

// Re-exported for backward compatibility: this type historically lived
// in this module and is imported as `from "./sync-wdi"` by sibling
// adapters. Canonical definition now lives in `./_sync-common`.
export type { CivicaSourceRole };

type Db = typeof import("@/lib/db").db;

const WB_BASE_URL = "https://api.worldbank.org/v2";
const WB_USER_AGENT = "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";
const WB_PER_PAGE = 1000;
// 10-year window. WB indicators publish 1–2 years after reference
// year, so reaching back this far guarantees most countries have at
// least one non-null observation.
const WB_LOOKBACK_YEARS = 10;

const WDI_VINTAGE = "World Bank WDI 2026Q3";

/**
 * One WDI indicator we care about. Each entry maps an upstream WB
 * indicator code to a Civica fact-key. The optional `valueTransform`
 * lets us reshape upstream units to fact-key units (e.g. WB ships
 * GDP per capita in USD; our key is also USD; identity transform).
 */
export interface WdiIndicatorConfig {
  /** WB API indicator code (e.g. "FP.CPI.TOTL.ZG"). */
  wbCode: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw WB value before envelope check
   *  and write. Default 1 — used when the WB unit matches the
   *  fact-key unit verbatim (e.g. % stays %, USD stays USD). */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this WB indicator. Defaults to
   *  `'alternate'` when omitted. Persisted into the row's
   *  `references[].civicaRole` so the methodology page rewrite
   *  (R.23) can render canonical-vs-alternate without a separate
   *  lookup. Per `~/civica/plan/wb-wdi-expansion-resolution-v1.md`
   *  §2d. */
  civicaRole?: CivicaSourceRole;
}

export const WDI_INDICATORS: readonly WdiIndicatorConfig[] = [
  // ─── F.6 originals (6 indicators) — civicaRole per
  //     `~/civica/plan/wb-wdi-expansion-resolution-v1.md` §2b. ───
  {
    wbCode: "FP.CPI.TOTL.ZG",
    factKey: "inflation_rate",
    label: "Inflation, consumer prices (annual %)",
    docUrl: "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
    // IMF WEO becomes canonical at R.2; WB stays as alternate per
    // resolution §2d.
    civicaRole: "alternate",
  },
  {
    // WB code for central government debt as % of GDP. Coverage is
    // partial — IMF WEO is a better source and is left as a future
    // F.6.1 extension.
    wbCode: "GC.DOD.TOTL.GD.ZS",
    factKey: "public_debt_pct_gdp",
    label: "Central government debt, total (% of GDP)",
    docUrl: "https://data.worldbank.org/indicator/GC.DOD.TOTL.GD.ZS",
    // IMF WEO canonical at R.2; WB alternate.
    civicaRole: "alternate",
  },
  {
    wbCode: "SP.DYN.IMRT.IN",
    factKey: "infant_mortality_per_1000",
    label: "Mortality rate, infant (per 1,000 live births)",
    docUrl: "https://data.worldbank.org/indicator/SP.DYN.IMRT.IN",
    // WHO GHO canonical at R.4; WB alternate.
    civicaRole: "alternate",
  },
  {
    // CO2 emissions. WB ships in kt CO2 eq under EN.GHG.CO2.MT.CE.AR5;
    // converting to Mt by /1000 to match our fact-key's `Mt` unit.
    // (The WB API serialises this indicator's values directly in Mt
    // — no division needed; verified via spot check on USA = ~5,000 Mt.
    // Identity transform.)
    wbCode: "EN.GHG.CO2.MT.CE.AR5",
    factKey: "co2_emissions_total_mt",
    label: "CO₂ emissions (Mt CO₂ eq)",
    docUrl: "https://data.worldbank.org/indicator/EN.GHG.CO2.MT.CE.AR5",
    // WB is the standard reference for CO₂ via the WDI; UNFCCC /
    // EDGAR alternates exist but are not in v1 scope. WB canonical.
    civicaRole: "canonical",
  },
  {
    wbCode: "IT.NET.USER.ZS",
    factKey: "internet_users_pct",
    label: "Individuals using the Internet (% of population)",
    docUrl: "https://data.worldbank.org/indicator/IT.NET.USER.ZS",
    // ITU is technically canonical for telecom indicators; not in
    // v1 scope. WB republishes ITU and is the practical canonical.
    civicaRole: "canonical",
  },
  {
    // GDP per capita, PPP (current international $). Matches the
    // existing `gdp_per_capita_usd` envelope (50 .. 300_000 USD).
    wbCode: "NY.GDP.PCAP.PP.CD",
    factKey: "gdp_per_capita_usd",
    label: "GDP per capita, PPP (current international $)",
    docUrl: "https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.CD",
    // WB PPP-per-capita is the standard reference; IMF has matching
    // PPP estimates but WB's are the most-cited. WB canonical until
    // R.2 IMF WEO ships, after which the resolver picks the fresher
    // — informationally WB stays canonical for v1 publication.
    civicaRole: "canonical",
  },

  // ─── R.1 expansion (14 indicators) — see resolution §2b. ───
  // Demographics: 6 indicators (population, life expectancy, growth,
  // fertility, birth rate, death rate).
  {
    wbCode: "SP.POP.TOTL",
    factKey: "population_total",
    label: "Population, total",
    docUrl: "https://data.worldbank.org/indicator/SP.POP.TOTL",
    // UN WPP becomes canonical at R.3. Per resolution §6 Q4 + Q6,
    // WB tagged 'alternate' now so R.3 inherits without re-deciding.
    civicaRole: "alternate",
  },
  {
    wbCode: "SP.DYN.LE00.IN",
    factKey: "life_expectancy_years",
    label: "Life expectancy at birth, total (years)",
    docUrl: "https://data.worldbank.org/indicator/SP.DYN.LE00.IN",
    // WHO GHO canonical at R.4; WB alternate.
    civicaRole: "alternate",
  },
  {
    wbCode: "SP.POP.GROW",
    factKey: "population_growth_rate",
    label: "Population growth (annual %)",
    docUrl: "https://data.worldbank.org/indicator/SP.POP.GROW",
    // UN WPP canonical at R.3; WB alternate.
    civicaRole: "alternate",
  },
  {
    wbCode: "SP.DYN.TFRT.IN",
    factKey: "fertility_rate",
    label: "Fertility rate, total (births per woman)",
    docUrl: "https://data.worldbank.org/indicator/SP.DYN.TFRT.IN",
    // UN WPP / WHO canonical; WB alternate. WB displaces the
    // 2014-vintage UNESCO Wikidata stale data surfaced in R.0.
    civicaRole: "alternate",
  },
  {
    wbCode: "SP.DYN.CBRT.IN",
    factKey: "birth_rate",
    label: "Birth rate, crude (per 1,000 people)",
    docUrl: "https://data.worldbank.org/indicator/SP.DYN.CBRT.IN",
    // UN WPP canonical; WB alternate.
    civicaRole: "alternate",
  },
  {
    wbCode: "SP.DYN.CDRT.IN",
    factKey: "death_rate",
    label: "Death rate, crude (per 1,000 people)",
    docUrl: "https://data.worldbank.org/indicator/SP.DYN.CDRT.IN",
    // UN WPP canonical; WB alternate.
    civicaRole: "alternate",
  },

  // Economy: 4 indicators (GDP nominal, GDP growth, urbanization,
  // current account, reserves). Skipping NY.GDP.PCAP.CD (nominal
  // per-capita) per resolution §2b row #9 + §6 Q5 — would conflict
  // with existing NY.GDP.PCAP.PP.CD on the unique constraint.
  // Deferred to v1.1 fact-key split.
  {
    // WB nominal GDP ships in raw USD (e.g. USA = 28_750_957_000_000).
    // Civica's `gdp_nominal_usd_billions` envelope is in billions
    // [0.05, 30_000]. Transform: divide by 1e9. Verified
    // 2026-05-03 against probe: USA 28_750_957_000_000 → 28,750.957
    // billions → passes envelope. Per resolution §2b + §3 step 3.
    wbCode: "NY.GDP.MKTP.CD",
    factKey: "gdp_nominal_usd_billions",
    label: "GDP (current US$, nominal)",
    docUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD",
    valueTransform: (raw: number) => raw / 1e9,
    // WB canonical for nominal GDP until IMF WEO ships at R.2;
    // resolver's freshness rule then picks per row.
    civicaRole: "canonical",
  },
  {
    wbCode: "NY.GDP.MKTP.KD.ZG",
    factKey: "gdp_real_growth_rate",
    label: "GDP growth (annual %)",
    docUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG",
    // WB canonical until R.2 IMF WEO; WB stays canonical for v1
    // publication.
    civicaRole: "canonical",
  },
  {
    wbCode: "SP.URB.TOTL.IN.ZS",
    factKey: "urbanization_rate",
    label: "Urban population (% of total population)",
    docUrl: "https://data.worldbank.org/indicator/SP.URB.TOTL.IN.ZS",
    // UN-HABITAT is technically canonical; not in v1 scope. WB
    // republishes UN data; functionally canonical for v1.
    civicaRole: "canonical",
  },
  {
    wbCode: "BN.CAB.XOKA.CD",
    factKey: "current_account_balance_usd",
    label: "Current account balance (current US$)",
    docUrl: "https://data.worldbank.org/indicator/BN.CAB.XOKA.CD",
    // IMF tracks for surveillance but WB BoP is the open data; this
    // fact-key currently has 0 rows in country_facts — WB closes the
    // gap entirely. Canonical for v1 publication.
    civicaRole: "canonical",
  },
  {
    wbCode: "FI.RES.TOTL.CD",
    factKey: "foreign_exchange_reserves_usd",
    label: "Total reserves (includes gold, current US$)",
    docUrl: "https://data.worldbank.org/indicator/FI.RES.TOTL.CD",
    // Same as current account — currently 0 rows in country_facts;
    // WB canonical for v1.
    civicaRole: "canonical",
  },

  // Trade: 2 indicators (exports, imports). Phase R.12 split the
  // single `exports_total_usd` / `imports_total_usd` fact-keys into a
  // two-fact-key shape because WTO and WB measure different things
  // under similar names. WB's `NE.EXP.GNFS.CD` ships goods+services
  // (BoP concept); WTO's `ITS_MTV_AX` ships merchandise only. Civica
  // declares one fact-key per measurement and treats them as distinct
  // facts rather than alternates of one. Per
  // `~/civica/plan/trade-aggregate-fact-keys-v1.md` (ADOPTED
  // 2026-05-04). WB writes to `*_goods_services_usd`, WTO writes to
  // `*_merchandise_usd`. Both publishers tag canonical for their
  // respective fact-key; no alternate handoff at R.12 since they no
  // longer share a fact-key.
  {
    wbCode: "NE.EXP.GNFS.CD",
    factKey: "exports_goods_services_usd",
    label: "Exports of goods and services (current US$)",
    docUrl: "https://data.worldbank.org/indicator/NE.EXP.GNFS.CD",
    // WB canonical for the goods+services aggregate (BoP/national-
    // accounts-style measurement). WTO at R.12 ships the
    // merchandise-only counterpart at `exports_merchandise_usd`.
    civicaRole: "canonical",
  },
  {
    wbCode: "NE.IMP.GNFS.CD",
    factKey: "imports_goods_services_usd",
    label: "Imports of goods and services (current US$)",
    docUrl: "https://data.worldbank.org/indicator/NE.IMP.GNFS.CD",
    // WB canonical for the goods+services aggregate (see exports).
    civicaRole: "canonical",
  },

  // Labour: 1 indicator (unemployment).
  {
    wbCode: "SL.UEM.TOTL.ZS",
    factKey: "unemployment_rate_pct",
    label: "Unemployment, total (% of total labor force)",
    docUrl: "https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS",
    // ILO ILOSTAT canonical at R.10; WB alternate.
    civicaRole: "alternate",
  },

  // Education: 1 indicator (literacy).
  {
    wbCode: "SE.ADT.LITR.ZS",
    factKey: "literacy_rate",
    label: "Literacy rate, adult total (% of people ages 15+)",
    docUrl: "https://data.worldbank.org/indicator/SE.ADT.LITR.ZS",
    // UNESCO UIS canonical at R.5; WB alternate.
    civicaRole: "alternate",
  },

  // Energy: 1 indicator (electricity access).
  {
    wbCode: "EG.ELC.ACCS.ZS",
    factKey: "electricity_access",
    label: "Access to electricity (% of population)",
    docUrl: "https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS",
    // WB is the standard reference for access-to-electricity
    // globally. IEA paywalled for non-OECD. WB canonical.
    civicaRole: "canonical",
  },

  // Military: 1 indicator (mil. expenditure as % GDP).
  {
    wbCode: "MS.MIL.XPND.GD.ZS",
    factKey: "military_expenditure_pct_gdp",
    label: "Military expenditure (% of GDP)",
    docUrl: "https://data.worldbank.org/indicator/MS.MIL.XPND.GD.ZS",
    // SIPRI is canonical for military expenditure; not in v1 scope.
    // WB republishes SIPRI; functionally canonical for v1.
    civicaRole: "alternate",
  },
];

export interface WbDataPoint {
  country: { id: string; value: string };
  /** ISO3 code for the country — sometimes empty for aggregates. */
  countryiso3code: string;
  date: string;
  value: number | null;
  /** Indicator metadata is repeated on every row. */
  indicator: { id: string; value: string };
}

export interface PerWdiCounters {
  factKey: string;
  wbCode: string;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  skipped_no_iso3: number;
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
}

export interface WdiSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  countersByFactKey: Record<string, PerWdiCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface WdiSyncOptions {
  /** Override configured targets for deterministic aggregate fixtures. */
  targets?: readonly WdiIndicatorConfig[];
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific WB indicator code (for testing). */
  wbCode?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
  /** Deterministic fixture seams; production callers omit these. */
  fetchIndicator?: (
    wbCode: string,
    startYear: number,
    endYear: number,
  ) => Promise<WbDataPoint[]>;
  jurisdictions?: WdiJurisdiction[];
  persistDisputes?: typeof persistProposedDisputes;
  markSynced?: typeof markSourcesSynced;
  atlasReleaseId?: string;
  writeFact?: CountryFactHistoryWriter;
}

export interface WdiJurisdiction {
  id: string;
  slug: string;
  iso3: string | null;
}

function freshCounters(factKey: string, wbCode: string): PerWdiCounters {
  return {
    factKey,
    wbCode,
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
 * Fetch every page of an indicator from WB. WB paginates at
 * `per_page` rows per page; for ~265 economies × 10 years we expect
 * 2–3 pages with `per_page=1000`.
 */
async function fetchIndicator(
  wbCode: string,
  startYear: number,
  endYear: number,
): Promise<WbDataPoint[]> {
  const out: WbDataPoint[] = [];
  let page = 1;
  let totalPages = 1;
  const dateRange = `${startYear}:${endYear}`;

  while (page <= totalPages) {
    const url = `${WB_BASE_URL}/country/all/indicator/${wbCode}?format=json&per_page=${WB_PER_PAGE}&date=${dateRange}&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": WB_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(
        `WB WDI ${wbCode} page ${page}: ${res.status} ${res.statusText}`,
      );
    }
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body) || body.length < 2) {
      // WB returns a single-element array when the indicator code is
      // unrecognised — the array has just an error envelope.
      throw new Error(
        `WB WDI ${wbCode}: unexpected response shape (length ${
          Array.isArray(body) ? body.length : "n/a"
        })`,
      );
    }
    const meta = body[0] as { pages: number };
    totalPages = meta?.pages ?? 1;
    const rows = body[1] as WbDataPoint[] | null;
    if (rows) out.push(...rows);
    page += 1;
  }
  return out;
}

/**
 * Pick the most recent non-null observation per country. Returns a
 * map keyed by uppercase iso3.
 */
function pickLatestPerCountry(rows: WbDataPoint[]): Map<string, WbDataPoint> {
  const latest = new Map<string, WbDataPoint>();
  for (const r of rows) {
    if (r.value === null || r.value === undefined) continue;
    const iso3 = (r.countryiso3code ?? "").toUpperCase();
    if (!iso3 || iso3.length !== 3) continue;
    const existing = latest.get(iso3);
    if (!existing) {
      latest.set(iso3, r);
      continue;
    }
    // Higher year wins.
    if (parseInt(r.date, 10) > parseInt(existing.date, 10)) {
      latest.set(iso3, r);
    }
  }
  return latest;
}

/**
 * Run the WDI sync end-to-end. Idempotent — re-running on the same
 * data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncWorldBankWdi(
  db: Db,
  options: WdiSyncOptions = {},
): Promise<WdiSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = (options.targets ?? WDI_INDICATORS).filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.wbCode && c.wbCode !== options.wbCode) return false;
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
      errors: ["no WDI indicators matched the filter"],
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

  const counters = new Map<string, PerWdiCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.wbCode));
  }

  const endYear = new Date().getFullYear();
  const startYear = endYear - WB_LOOKBACK_YEARS;

  let totalWritten = 0;
  // Phase F.6.1 — track every (jurisdictionId, factKey) pair we
  // upserted so the resolver can re-evaluate them and we can persist
  // any disputes after the write loop. Using a Set keyed by
  // `${jurisdictionId}|${factKey}` to dedup across indicators that
  // happen to write to the same key (none today, but cheap).
  const touchedPairs = new Set<string>();

  for (const config of targets) {
    const counter = counters.get(config.factKey)!;
    const factKeyDef = getFactKey(config.factKey);
    if (!factKeyDef) {
      errors.push(
        `unknown fact-key '${config.factKey}' for WDI ${config.wbCode} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.wbCode}) "${config.label}" — fetching ${startYear}:${endYear}…`,
    );

    let rows: WbDataPoint[];
    try {
      rows = await (options.fetchIndicator ?? fetchIndicator)(
        config.wbCode,
        startYear,
        endYear,
      );
    } catch (err) {
      errors.push(
        `${config.wbCode} fetch failed: ${
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
      const numericValue = transform(dp.value as number);

      // Plausibility envelope per fact-key registry §3.6.
      // R.1.1 fix: when isPercent is true, the [-1, 101] range is only a
      // fallback for fact-keys that do not declare their own min/max. When
      // min/max are explicitly set in the fact-key definition (e.g.
      // gdp_real_growth_rate min:-50, population_growth_rate min:-10), the
      // per-fact-key values take precedence. This prevents the coarse
      // isPercent guard from silently dropping legitimate negative growth
      // rates, contraction episodes, and population-decline figures.
      // See ~/civica/plan/wb-wdi-expansion-resolution-v1.md §3b.
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

      const factYear = parseInt(dp.date, 10);
      const asOf = Number.isFinite(factYear) ? `${factYear}-01-01` : null;

      const upstreamPayload = {
        source: "world_bank",
        endpoint: `${WB_BASE_URL}/country/${j.iso3}/indicator/${config.wbCode}`,
        iso3: j.iso3,
        wbCode: config.wbCode,
        wbCountryId: dp.country?.id ?? null,
        date: dp.date,
        value: dp.value,
        wbVintage: WDI_VINTAGE,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "World Bank Open Data",
          // R.1 — Civica's canonical/alternate editorial role for
          // this (source, fact-key) pair. Default 'alternate' when
          // omitted on the indicator config. See
          // `~/civica/plan/wb-wdi-expansion-resolution-v1.md` §2d.
          civicaRole: config.civicaRole ?? "alternate",
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${dp.date})`,
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
            sourceId: "world_bank",
            upstreamRef: `wb:${j.iso3}:${config.wbCode}:${dp.date}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: WDI_VINTAGE,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          });

        const snapshotIdRow = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'world_bank' AND ${factSnapshots.payloadHash} = ${hash}`,
          )
          .limit(1);
        const snapshotId = snapshotIdRow[0]?.id ?? null;

        const values = {
          jurisdictionId: j.id,
          factKey: config.factKey,
          factGroup: factKeyDef.group,
          category: factKeyDef.category,
          sourceId: "world_bank",
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
          upstreamVintageLabel: WDI_VINTAGE,
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
      source: "WDI",
      target: `${config.factKey} (${config.wbCode})`,
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
    sourceIds: "world_bank",
    rowsWritten: totalWritten,
    dryRun: options.dryRun,
    executor: db,
    errors,
    markSynced: options.markSynced ?? markSourcesSynced,
  });

  const finishedAtMs = Date.now();
  const countersByFactKey: Record<string, PerWdiCounters> = {};
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
