/**
 * Phase R.7 — OECD.Stat sync orchestrator.
 *
 * Direct sync from the OECD Data Explorer SDMX API at
 * `https://sdmx.oecd.org/public/rest/`. Mirrors the F.6 / R.1 / R.2 /
 * R.3 / R.4 pattern. Ships 5 indicators after R.7.5:
 *   - `MEASURE=GNLB` → `fiscal_balance_pct_gdp` (canonical alongside IMF)
 *   - `MEASURE=GGD`  → `public_debt_pct_gdp` (canonical alongside IMF, WB; CIA stays alternate)
 *   - `MSTI MEASURE=G + UNIT=PT_B1GQ` → `gerd_pct_gdp` (canonical; R.7.5 NEW)
 *   - `RSOECD STANDARD_REVENUE=_T` → `tax_revenue_pct_gdp` (canonical; R.7.5 NEW)
 *   - `SHA EXP_HEALTH UNIT=PT_B1GQ` → `health_expenditure_pct_gdp` (shared canonical with WHO GHED; R.7.5 NEW)
 *
 * All ship as `civicaRole: 'canonical'`. The 3 R.7.5 additions cover
 * the deferrals from R.7's original scope per
 * `~/civica/plan/fact-key-registry-expansion-resolution-v1.md` §2c.
 * Note: `health_expenditure_pct_gdp` is **shared canonical** with
 * WHO GHED — both publishers compute SHA-2011 joint methodology and
 * write rows tagged `canonical`; the resolver picks fresher within
 * envelope.
 *
 * **OECD-only-for-OECD-members scope.** Unlike R.1–R.4 (which write
 * rows for ~190 sovereign countries), R.7 writes rows for the 38
 * OECD member states ONLY. For non-members, OECD is not canonical;
 * Civica's resolver continues using WB/IMF/etc. for them. The OECD
 * SDMX API returns data for ~38 members + ~9 partner/aggregate codes
 * per dataflow (e.g. Brazil, Bulgaria, Croatia, Romania, South Africa,
 * EUOECD aggregate); the sync filters partner-country rows out
 * client-side via the hardcoded `OECD_MEMBER_ISO3` set.
 *
 * In v1 R.7 ships with **37 OECD member rows per indicator** because
 * Israel (`ISR`) is missing from Civica's `jurisdictions` table. The
 * separate R.7.0 jurisdictions backfill phase ships in parallel and
 * adds Israel + UAE; on the next quarterly cron after R.7.0 lands,
 * R.7's sync picks Israel up automatically. No R.7 code change
 * required for the Israel onboarding.
 *
 * **SDMX-JSON parsing — `dimensionAtObservation=AllDimensions`.** The
 * OECD endpoint by default returns SDMX-JSON in a series-keyed shape
 * where some series-key values appear MULTIPLE TIMES with different
 * subsets of observations (one occurrence carries 2018+2019+2021,
 * another carries 2020). Standard `JSON.parse` silently keeps only
 * the last occurrence — so AUS 2018/2019/2021 data would be lost,
 * leaving only 2020. The fix is to pass
 * `dimensionAtObservation=AllDimensions`, which flattens the
 * response so each observation gets its own unique 8-tuple key.
 * Verified live 2026-05-04: GNLB returns 218 observations across
 * 48 REF_AREA codes; GGD returns 211 observations.
 *
 * The Phase F resolver picks between OECD and CIA / WB / IMF per
 * methodology §3.3 — material-error guard + freshness preference.
 * The `civicaRole` field on each indicator config is informational
 * only (NOT used by the resolver); it persists into the fact row's
 * `references[].civicaRole` payload so the methodology page rewrite
 * (Phase R.23) can render canonical-vs-alternate without a separate
 * lookup. See `~/civica/plan/oecd-stat-resolution-v1.md` §2d.
 *
 * License: OECD Terms and Conditions; commercial-use-OK with
 * attribution per the `is_commercial_use_allowed: true` flag in the
 * Civica `sources` row. Per-row `references[].license` metadata
 * mirrors the R.4 WHO GHO precedent. Flagged for legal review
 * post-R.7 per resolution §4 Risk 6.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.7
 * Resolution:  ~/civica/plan/oecd-stat-resolution-v1.md
 */
import { sql } from "drizzle-orm";

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

const OECD_BASE_URL = "https://sdmx.oecd.org/public/rest";
const OECD_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";
const OECD_ACCEPT =
  "application/vnd.sdmx.data+json;charset=utf-8;version=1.0";
/**
 * The OECD Data Explorer SDMX endpoint requires an Accept-Language
 * header for content negotiation. Without it, requests with the
 * `application/vnd.sdmx.data+json` Accept return HTTP 500 with body
 * `"languageTag1"` (verified live 2026-05-04). curl gets a default
 * via libcurl; Node fetch does not. This is independent of the
 * date range, the UA, or the dataflow — purely a content-negotiation
 * server-side requirement. Set to "en" since Civica is English-only.
 */
const OECD_ACCEPT_LANGUAGE = "en";

/**
 * Civica-side vintage label for OECD rows. The OECD Data Explorer
 * does not expose a single vintage string per dataflow the way IMF
 * WEO does — different dataflows refresh on different cadences.
 * Using a quarterly Civica-side label keeps the snapshot table's
 * vintage column meaningful at the F.6 level. The methodology page
 * rewrite (R.23) can surface the underlying dataflow edition (e.g.
 * "Government at a Glance 2023 edition" for the v1 indicators).
 */
const OECD_STAT_VINTAGE = "OECD Data Explorer 2026Q3";

/**
 * License string stamped into per-row references payload. Mirrors
 * the R.4 WHO precedent — methodology page rewrite (R.23) can
 * license-aware-filter when commercial endpoints land.
 */
const OECD_STAT_LICENSE = "OECD Terms and Conditions";

/**
 * The 38 OECD member states (as of 2024). Hardcoded rather than
 * fetched from a codelist because the OECD member set changes only
 * on rare member-accession events — typical cadence 1–2 years per
 * round. Next plausible additions: Argentina, Brazil, Bulgaria,
 * Romania, Croatia (all roadmapped). Russia was suspended in 2022.
 *
 * When the set changes, update this constant + bump the resolution
 * doc to v1.1 with a changelog entry. Per
 * `~/civica/plan/oecd-stat-resolution-v1.md` §6 Q9.
 *
 * **In v1 sync (pre-R.7.0), Israel will fall through the
 * `iso3ToJurisdiction` filter and increment `skipped_no_jurisdiction`
 * because Civica's jurisdictions table is missing the row.** R.7.0
 * adds Israel; on the next cron after R.7.0 lands, the row count
 * grows from 37 → 38 per indicator with no R.7 code change.
 */
export const OECD_MEMBER_ISO3: readonly string[] = [
  "AUS", "AUT", "BEL", "CAN", "CHL", "COL", "CRI", "CZE",
  "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "ISL",
  "IRL", "ISR", "ITA", "JPN", "KOR", "LVA", "LTU", "LUX",
  "MEX", "NLD", "NZL", "NOR", "POL", "PRT", "SVK", "SVN",
  "ESP", "SWE", "CHE", "TUR", "GBR", "USA",
];
const OECD_MEMBER_SET = new Set(OECD_MEMBER_ISO3);

/**
 * One OECD indicator we care about. The OECD Data Explorer queries
 * the SDMX-JSON endpoint with a positional dot-separated dimension
 * filter per dataflow. Each entry encodes the dataflow's
 * `<AGENCY>,<DSD@DATAFLOW_ID>,<VERSION>` triple plus the dimension
 * filter string.
 *
 * The optional `valueTransform` lets us reshape upstream units to
 * fact-key units. Both R.7 indicators ship with identity transforms
 * (% of GDP stays % of GDP).
 */
export interface OecdStatIndicatorConfig {
  /** Dataflow agency ID (e.g. "OECD.GOV.GIP"). */
  agency: string;
  /** Dataflow ID with optional `@DATAFLOW_ID` suffix (e.g.
   *  "DSD_GOV@DF_GOV_2023"). */
  dataflowId: string;
  /** Dataflow version (e.g. "1.0"). */
  dataflowVersion: string;
  /** Positional dimension filter. Dot-separated, with empty
   *  positions for wildcards. The first position is typically FREQ;
   *  REF_AREA is left wildcard so the response covers all OECD
   *  members; the dimensions controlling MEASURE / UNIT_MEASURE /
   *  SECTOR are pinned to the canonical values. */
  dimensionFilter: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw OECD value before envelope check
   *  and write. Default 1 — used when the OECD unit matches the
   *  fact-key unit verbatim. Both R.7 indicators are identity. */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this OECD indicator. R.7 ships
   *  both indicators as `'canonical'` per the resolution. The Phase
   *  F resolver does NOT use this field for runtime selection (the
   *  resolver is freshness-driven per methodology §3.3); the field
   *  is informational metadata for the methodology page rewrite at
   *  Phase R.23. Mirrors R.1's `WdiIndicatorConfig.civicaRole`. */
  civicaRole?: CivicaSourceRole;
  /** Whether to filter the upstream observation set to OECD members
   *  only. Default `true` — applies the `OECD_MEMBER_SET` filter so
   *  partner-country rows are silently dropped. R.7 indicators
   *  (Government at a Glance: fiscal balance, public debt) all use
   *  the default because IMF / WB / Eurostat are canonical for
   *  non-members on those indicators.
   *
   *  R.7.5 introduces two indicators where OECD is the ONLY Tier-1
   *  publisher and partner-country coverage is in scope:
   *  - `gerd_pct_gdp` (MSTI; 46 ISO3 native scope incl ARG, BGR,
   *    CHN, HRV, ROU, SGP, TWN, ZAF)
   *  - `health_expenditure_pct_gdp` (SHA; 51 ISO3 native scope incl
   *    ARG, BRA, CHN, COL, IDN, IND, MLT, PER, ROU, ZAF)
   *  These set `oecdMemberOnly: false` so the full native scope
   *  writes. See `~/civica/plan/fact-key-registry-expansion-resolution-v1.md`
   *  §5d / §5e. */
  oecdMemberOnly?: boolean;
}

/**
 * The 2 OECD indicators in R.7 ship scope (post-sign-off
 * narrowing). Both come from the Government at a Glance 2023
 * dataflow `OECD.GOV.GIP.DSD_GOV@DF_GOV_2023/1.0`. The deferred 3
 * indicators (GERD, tax revenue, health expenditure) ship in R.7.5
 * alongside the new fact-key declarations they each require.
 *
 * Filter dimension positions for DSD_GOV@DF_GOV_2023:
 *   0. FREQ (A = annual)
 *   1. REF_AREA (wildcard — return all countries)
 *   2. MEASURE (GNLB or GGD)
 *   3. UNIT_MEASURE (PT_B1GQ = percentage of GDP)
 *   4. SECTOR (S13 = General government)
 *   5. EDITION (wildcard — only one edition)
 *   6. CATEGORY (wildcard — only PF for fiscal-balance/debt)
 *
 * Per `~/civica/plan/oecd-stat-resolution-v1.md` §2b.
 */
export const OECD_STAT_INDICATORS: readonly OecdStatIndicatorConfig[] = [
  {
    agency: "OECD.GOV.GIP",
    dataflowId: "DSD_GOV@DF_GOV_2023",
    dataflowVersion: "1.0",
    dimensionFilter: "A..GNLB.PT_B1GQ.S13..",
    factKey: "fiscal_balance_pct_gdp",
    label: "Government fiscal balance (% of GDP)",
    docUrl:
      "https://www.oecd.org/governance/government-at-a-glance/",
    civicaRole: "canonical",
  },
  {
    agency: "OECD.GOV.GIP",
    dataflowId: "DSD_GOV@DF_GOV_2023",
    dataflowVersion: "1.0",
    dimensionFilter: "A..GGD.PT_B1GQ.S13..",
    factKey: "public_debt_pct_gdp",
    label: "Government gross debt (% of GDP)",
    docUrl:
      "https://www.oecd.org/governance/government-at-a-glance/",
    civicaRole: "canonical",
  },

  // ─── R.7.5 ship list (3 new economy fact-keys; resolution §2c). ───
  {
    // OECD MSTI Main Science and Technology Indicators — gross
    // domestic expenditure on R&D as % of GDP.
    //
    // Filter dimension positions for DSD_MSTI@DF_MSTI/1.3 are:
    //   0. REF_AREA (wildcard)
    //   1. FREQ (A = annual)
    //   2. MEASURE (G = gross domestic R&D)
    //   3. UNIT_MEASURE (PT_B1GQ = % of GDP)
    //   4. PRICE_BASE (wildcard)
    //   5. TRANSFORMATION (_Z = no transformation)
    // See resolution §2c.i + Appendix A. Probe (2022-2024): min
    // ~1.8% (Canada/Greece), max Israel 6.7%. 46 ISO3 native scope.
    //
    // R.7.5 §5d — OECD MSTI extends beyond 38 OECD members
    // (ARG, BGR, CHN, HRV, ROU, SGP, TWN, ZAF). OECD is the ONLY
    // Tier-1 publisher of GERD; partner-country coverage IS in
    // scope. `oecdMemberOnly: false` opts out of the OECD-member
    // filter.
    agency: "OECD.STI.STP",
    dataflowId: "DSD_MSTI@DF_MSTI",
    dataflowVersion: "1.3",
    dimensionFilter: ".A.G.PT_B1GQ.._Z",
    factKey: "gerd_pct_gdp",
    label: "Gross domestic expenditure on R&D (GERD) as % of GDP",
    docUrl: "https://data-explorer.oecd.org/vis?fs[0]=Topic%2C0%7CInnovation%20and%20Technology%23INT%23&pg=0&fc=Topic&bp=true&snb=27&df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_MSTI%40DF_MSTI&df[ag]=OECD.STI.STP",
    civicaRole: "canonical",
    oecdMemberOnly: false,
  },
  {
    // OECD CTP Revenue Statistics — total tax revenue (general
    // government, all standard revenue categories, OECD-harmonized
    // methodology) as % of GDP.
    //
    // Filter dimension positions for DSD_REV_COMP_OECD@DF_RSOECD/2.0:
    //   0. REF_AREA (wildcard)
    //   1. MEASURE (TAX_REV = tax revenue)
    //   2. SECTOR (S13 = general government)
    //   3. STANDARD_REVENUE (_T = total tax revenue)
    //   4. CTRY_SPECIFIC_REVENUE (_T = total)
    //   5. UNIT_MEASURE (PT_B1GQ = % of GDP)
    //   6. FREQ (A = annual)
    // See resolution §2c.ii + Appendix A. Probe (2022): min Mexico
    // 16.8%, max France 45.9%.
    //
    // OECD-member-only scope retained. Only OECD members report
    // via Revenue Statistics; partner-country coverage is not in
    // scope here. `oecdMemberOnly` defaults to `true`.
    //
    // Distinct from the (now-removed) legacy `taxes_revenues_pct_gdp`
    // CIA-prose-mapped slot — methodologically distinct (OECD
    // harmonized SHA-equivalent for taxes).
    agency: "OECD.CTP.TPS",
    dataflowId: "DSD_REV_COMP_OECD@DF_RSOECD",
    dataflowVersion: "2.0",
    dimensionFilter: ".TAX_REV.S13._T._T.PT_B1GQ.A",
    factKey: "tax_revenue_pct_gdp",
    label: "Total tax revenue, general government (% of GDP)",
    docUrl: "https://data-explorer.oecd.org/vis?fs[0]=Topic%2C0%7CGovernment%23GOV%23&pg=0&fc=Topic&bp=true&snb=12&df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_REV_COMP_OECD%40DF_RSOECD&df[ag]=OECD.CTP.TPS",
    civicaRole: "canonical",
  },
  {
    // OECD ELS HD System of Health Accounts (SHA-2011) — current
    // health expenditure as % of GDP. SHARED CANONICAL with WHO
    // GHED (`GHED_CHEGDP_SHA2011` from `sync-who-gho.ts`); both
    // publishers compute SHA-2011 joint methodology and converge
    // to ~0.1pp.
    //
    // Filter dimension positions for DSD_SHA@DF_SHA/1.0:
    //   0.  REF_AREA (wildcard)
    //   1.  FREQ (A = annual)
    //   2.  MEASURE (EXP_HEALTH = health expenditure)
    //   3.  UNIT_MEASURE (PT_B1GQ = % of GDP)
    //   4.  FINANCING_SCHEME (_T = all financing schemes)
    //   5.  FINANCING_SCHEME_REV (wildcard)
    //   6.  FUNCTION (_T = all health functions)
    //   7.  MODE_PROVISION (_T = all modes)
    //   8.  PROVIDER (_T = all providers)
    //   9.  FACTOR_PROVISION (wildcard)
    //   10. ASSET_TYPE (wildcard)
    //   11. PRICE_BASE (wildcard)
    // See resolution §2a.v + §2c.iii + Appendix A. Probe (2022):
    // 51 ISO3 native scope (38 OECD members + 13 SHA partners
    // ARG, BRA, BGR, CHN, COL, HRV, CYP, IDN, IND, MLT, PER, ROU,
    // ZAF). Min Indonesia 2.7%, max USA 16.5%.
    //
    // R.7.5 §5e — `oecdMemberOnly: false` opts out of the
    // OECD-member filter; SHA partners are in scope and the
    // shared-canonical pattern with WHO GHED handles 38 OECD
    // members + WHO covers ~190 ISO3 globally.
    agency: "OECD.ELS.HD",
    dataflowId: "DSD_SHA@DF_SHA",
    dataflowVersion: "1.0",
    dimensionFilter: ".A.EXP_HEALTH.PT_B1GQ._T.._T._T._T...",
    factKey: "health_expenditure_pct_gdp",
    label: "Current health expenditure (% of GDP), SHA-2011",
    docUrl: "https://data-explorer.oecd.org/vis?fs[0]=Topic%2C0%7CHealth%23HEA%23&pg=0&fc=Topic&bp=true&snb=27&df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_SHA%40DF_SHA&df[ag]=OECD.ELS.HD",
    civicaRole: "canonical",
    oecdMemberOnly: false,
  },
];

/**
 * One observation as returned by the OECD Data Explorer SDMX-JSON
 * endpoint. Field shape varies between request modes:
 *   - Default mode: series-keyed with year-indexed observations
 *     (subject to duplicate-key bug — see file header).
 *   - `dimensionAtObservation=AllDimensions` mode: flat
 *     observations keyed by full-tuple integer indices. R.7 uses
 *     this mode.
 *
 * In AllDimensions mode the observation value array is:
 *   [number, ...attribute_indices]
 * Only the first element is the numeric value; the rest are
 * attribute references we don't use today.
 */
  interface OecdSdmxResponse {
  data: {
    dataSets: Array<{
      observations?: Record<string, Array<number | null>>;
    }>;
    structure?: OecdSdmxStructure;
  };
  /** Some responses put structure at top-level instead of under
   *  data. The parser falls back accordingly. */
  structure?: OecdSdmxStructure;
  errors?: Array<{ code?: number; message?: string }>;
}

interface OecdSdmxStructure {
  dimensions: {
    series?: Array<OecdSdmxDimension>;
    observation: Array<OecdSdmxDimension>;
  };
}

interface OecdSdmxDimension {
  id: string;
  values: Array<{ id: string; name?: string }>;
}

/**
 * Per-indicator counter shape. Mirrors the IMF / WHO patterns.
 */
export interface PerOecdStatCounters {
  factKey: string;
  agency: string;
  dataflowId: string;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  /** Observations belonging to non-OECD-member countries. These
   *  are silently dropped per the resolution §2c member-only-scope
   *  decision. */
  skipped_non_oecd_member: number;
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
  /** Counter for forecast-year rows landed (year > current calendar
   *  year). Government at a Glance can include projection years for
   *  some measures; mirrors the IMF `forecast_rows` pattern. */
  forecast_rows: number;
}

export interface OecdStatSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  vintageLabel: string;
  countersByFactKey: Record<string, PerOecdStatCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface OecdStatSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
  /** Deterministic fixture seams; production callers omit these. */
  fetchIndicator?: typeof fetchIndicator;
  jurisdictions?: OecdStatJurisdiction[];
  persistDisputes?: typeof persistProposedDisputes;
  markSynced?: typeof markSourcesSynced;
}

export interface OecdStatJurisdiction {
  id: string;
  slug: string;
  iso3: string | null;
}

function freshCounters(
  factKey: string,
  agency: string,
  dataflowId: string,
): PerOecdStatCounters {
  return {
    factKey,
    agency,
    dataflowId,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_non_oecd_member: 0,
    skipped_no_jurisdiction: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    forecast_rows: 0,
  };
}

/**
 * Build the SDMX data fetch URL.
 *
 * Pattern: `/data/<AGENCY>,<DSD@DATAFLOW_ID>,<VERSION>/<FILTER>?startPeriod=YYYY&endPeriod=YYYY&dimensionAtObservation=AllDimensions`
 *
 * `dimensionAtObservation=AllDimensions` is critical — it produces
 * one observation per record key, avoiding the duplicate-series-key
 * bug described in the file header.
 */
function buildDataUrl(
  config: OecdStatIndicatorConfig,
  startYear: number,
  endYear: number,
): string {
  const path = `data/${config.agency},${config.dataflowId},${config.dataflowVersion}/${config.dimensionFilter}`;
  const query = `startPeriod=${startYear}&endPeriod=${endYear}&dimensionAtObservation=AllDimensions`;
  return `${OECD_BASE_URL}/${path}?${query}`;
}

/**
 * Fetch one indicator's full payload. Returns a map of
 * `iso3 → { year, value }` already filtered to the latest non-null
 * year per OECD member (the filter is applied here so the caller
 * gets a clean ready-to-write structure).
 *
 * Non-OECD-member observations are NOT included in the returned
 * map; they're counted via the `nonMemberCount` return field for
 * counter visibility.
 */
async function fetchIndicator(
  config: OecdStatIndicatorConfig,
  startYear: number,
  endYear: number,
): Promise<{
  latestByIso3: Map<string, { year: number; value: number }>;
  observationCount: number;
  nonMemberCount: number;
}> {
  const url = buildDataUrl(config, startYear, endYear);
  const res = await fetch(url, {
    headers: {
      "User-Agent": OECD_USER_AGENT,
      Accept: OECD_ACCEPT,
      "Accept-Language": OECD_ACCEPT_LANGUAGE,
    },
  });
  if (!res.ok) {
    throw new Error(
      `OECD ${config.agency}/${config.dataflowId} ${config.factKey}: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as OecdSdmxResponse;
  if (body.errors && body.errors.length > 0) {
    const msg = body.errors
      .map((e) => `${e.code ?? "?"}:${e.message ?? "?"}`)
      .join("; ");
    throw new Error(
      `OECD ${config.agency}/${config.dataflowId} ${config.factKey} returned errors: ${msg}`,
    );
  }

  const structure = body.data?.structure ?? body.structure;
  if (!structure) {
    throw new Error(
      `OECD ${config.factKey}: missing structure in response`,
    );
  }
  const obsDims = structure.dimensions.observation;
  if (!obsDims || obsDims.length === 0) {
    throw new Error(
      `OECD ${config.factKey}: no observation dimensions (did you pass dimensionAtObservation=AllDimensions?)`,
    );
  }
  const refAreaPos = obsDims.findIndex((d) => d.id === "REF_AREA");
  const timePos = obsDims.findIndex((d) => d.id === "TIME_PERIOD");
  if (refAreaPos === -1 || timePos === -1) {
    throw new Error(
      `OECD ${config.factKey}: missing REF_AREA or TIME_PERIOD in observation dims`,
    );
  }
  const refAreaValues = obsDims[refAreaPos].values;
  const timeValues = obsDims[timePos].values;

  const observations = body.data?.dataSets?.[0]?.observations ?? {};
  const latestByIso3 = new Map<string, { year: number; value: number }>();
  let observationCount = 0;
  let nonMemberCount = 0;

  for (const [tupleKey, valueArr] of Object.entries(observations)) {
    observationCount++;
    if (!Array.isArray(valueArr) || valueArr.length === 0) continue;
    const numericValue = valueArr[0];
    if (numericValue === null || numericValue === undefined) continue;
    if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) continue;

    const positions = tupleKey.split(":").map((n) => parseInt(n, 10));
    const refAreaIdx = positions[refAreaPos];
    const timeIdx = positions[timePos];
    if (
      refAreaIdx === undefined ||
      timeIdx === undefined ||
      refAreaIdx < 0 ||
      refAreaIdx >= refAreaValues.length ||
      timeIdx < 0 ||
      timeIdx >= timeValues.length
    ) {
      continue;
    }
    const iso3 = refAreaValues[refAreaIdx]?.id?.toUpperCase();
    const yearStr = timeValues[timeIdx]?.id;
    if (!iso3 || iso3.length !== 3) continue;
    if (!yearStr) continue;
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) continue;

    // Apply OECD-member-only scope filter. Per R.7 resolution §2c:
    // for non-members, OECD is not canonical and rows are not
    // written. The OECD endpoint returns ~9 partner/aggregate codes
    // (Brazil, Bulgaria, Croatia, Romania, South Africa, China,
    // OECD aggregate, EUOECD aggregate, OECD_REP); these get
    // counted but not retained.
    //
    // R.7.5 §5d/§5e — for fact-keys where OECD is the ONLY Tier-1
    // publisher (`gerd_pct_gdp`, `health_expenditure_pct_gdp`),
    // partner-country coverage IS in scope and the indicator config
    // sets `oecdMemberOnly: false` to opt out of this filter. The
    // default (true) preserves R.7's OECD-member-only behavior for
    // `fiscal_balance_pct_gdp`, `public_debt_pct_gdp`, and
    // `tax_revenue_pct_gdp`.
    const memberOnly = config.oecdMemberOnly !== false;
    if (memberOnly && !OECD_MEMBER_SET.has(iso3)) {
      nonMemberCount++;
      continue;
    }

    const existing = latestByIso3.get(iso3);
    if (!existing || year > existing.year) {
      latestByIso3.set(iso3, { year, value: numericValue });
    }
  }

  return { latestByIso3, observationCount, nonMemberCount };
}

/**
 * Run the OECD.Stat sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncOecdStat(
  db: Db,
  options: OecdStatSyncOptions = {},
): Promise<OecdStatSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = OECD_STAT_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: OECD_STAT_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no OECD.Stat indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Build iso3 → jurisdictionId map once; reused across all
  // indicators. Filter to OECD members up-front so the iso3 lookup
  // misses cleanly count as `skipped_no_jurisdiction` (which Israel
  // will trigger in v1 until R.7.0 lands).
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

  // OECD member coverage check — log how many OECD members exist
  // in the jurisdictions table. Helps surface the Israel gap.
  const oecdMembersFound = OECD_MEMBER_ISO3.filter((iso) =>
    iso3ToJurisdiction.has(iso),
  );
  const oecdMembersMissing = OECD_MEMBER_ISO3.filter(
    (iso) => !iso3ToJurisdiction.has(iso),
  );
  log(
    `OECD member coverage: ${oecdMembersFound.length}/${OECD_MEMBER_ISO3.length} present in jurisdictions table.`,
  );
  if (oecdMembersMissing.length > 0) {
    log(
      `  missing OECD members (will be skipped this run; R.7.0 backfills): ${oecdMembersMissing.join(", ")}`,
    );
  }

  const counters = new Map<string, PerOecdStatCounters>();
  for (const c of targets) {
    counters.set(
      c.factKey,
      freshCounters(c.factKey, c.agency, c.dataflowId),
    );
  }

  // Government at a Glance 2023 edition exposes years 2018–2022.
  // We request a wider [2018, current_year + 5] window so the sync
  // forward-compatibly handles future OECD edition publications
  // (e.g. when DSD_GOV@DF_GOV_2025 starts serving data) without code
  // change. The endpoint clamps to whatever data exists.
  const currentYear = new Date().getFullYear();
  const startYear = 2018;
  const endYear = currentYear + 5;

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
        `unknown fact-key '${config.factKey}' for OECD ${config.agency}/${config.dataflowId} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.agency}/${config.dataflowId}) "${config.label}" — fetching…`,
    );

    let latestByIso3: Map<string, { year: number; value: number }>;
    let observationCount = 0;
    let nonMemberCount = 0;
    try {
      const result = await (options.fetchIndicator ?? fetchIndicator)(config, startYear, endYear);
      latestByIso3 = result.latestByIso3;
      observationCount = result.observationCount;
      nonMemberCount = result.nonMemberCount;
    } catch (err) {
      errors.push(
        `${config.agency}/${config.dataflowId} ${config.factKey} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    counter.observations = observationCount;
    counter.skipped_non_oecd_member = nonMemberCount;
    counter.jurisdictions_with_value = latestByIso3.size;
    log(
      `  fetched ${observationCount} observations (${nonMemberCount} non-OECD-member, ${latestByIso3.size} OECD members with non-null value)`,
    );

    for (const [iso3, dp] of latestByIso3) {
      const j = iso3ToJurisdiction.get(iso3);
      if (!j) {
        // OECD member that's not in Civica's jurisdictions table.
        // In v1 this fires for Israel (`ISR`) until R.7.0 ships.
        // After R.7.0 lands and the next quarterly cron runs,
        // Israel will land cleanly without code change here.
        counter.skipped_no_jurisdiction++;
        continue;
      }

      const transform = config.valueTransform ?? ((v: number) => v);
      const numericValue = transform(dp.value);

      // Plausibility envelope per fact-key registry §3.6.
      // R.1.1 fix mirrored inline: when isPercent is true, the
      // [-1, 101] range is only a fallback for fact-keys that do
      // not declare their own min/max. When min/max are explicitly
      // set, those values take precedence. Both R.7 fact-keys
      // (fiscal_balance_pct_gdp, public_debt_pct_gdp) declare
      // explicit min/max — fiscal_balance was widened by R.2.1 to
      // [-100, 50] to handle IMF forecast horizons; public_debt is
      // [0, 400]. Both comfortably handle the OECD value range
      // (Greece 2020 GGD ~237%, Japan 2020 GGD ~247%, both within).
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

      const factYear = dp.year;
      const asOf = `${factYear}-01-01`;

      // Track forecast rows (year > current year). Government at a
      // Glance 2023 edition exposes only 2018–2022 (no forecasts);
      // counter stays at 0 in v1 but is wired in for forward
      // compatibility with future OECD editions that include
      // projection years. Mirrors IMF's forecast tracking.
      if (factYear > currentYear) {
        counter.forecast_rows++;
      }

      const upstreamPayload = {
        source: "oecd_stat",
        endpoint: buildDataUrl(config, startYear, endYear),
        iso3: j.iso3,
        agency: config.agency,
        dataflowId: config.dataflowId,
        dataflowVersion: config.dataflowVersion,
        dimensionFilter: config.dimensionFilter,
        year: factYear,
        rawValue: dp.value,
        transformedValue: numericValue,
        oecdVintage: OECD_STAT_VINTAGE,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "OECD.Stat",
          // R.7 — Civica's canonical/alternate editorial role for
          // this (source, fact-key) pair. Default 'alternate' when
          // omitted on the indicator config; both v1 indicators
          // are explicitly 'canonical'. See
          // `~/civica/plan/oecd-stat-resolution-v1.md` §2d.
          civicaRole: config.civicaRole ?? "alternate",
          // R.7 — per-row license metadata. Mirrors the R.4 WHO
          // GHO precedent so downstream consumers can
          // license-aware-filter when commercial endpoints land.
          // Per `~/civica/plan/oecd-stat-resolution-v1.md` §2f.
          license: OECD_STAT_LICENSE,
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
            sourceId: "oecd_stat",
            upstreamRef: `oecd:${j.iso3}:${config.dataflowId}:${config.factKey}:${factYear}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: OECD_STAT_VINTAGE,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          });

        const snapshotIdRow = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'oecd_stat' AND ${factSnapshots.payloadHash} = ${hash}`,
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
            sourceId: "oecd_stat",
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
            upstreamVintageLabel: OECD_STAT_VINTAGE,
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
              upstreamVintageLabel: OECD_STAT_VINTAGE,
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
        `(non-OECD: ${counter.skipped_non_oecd_member}, ` +
        `unmatched ISO3: ${counter.skipped_no_jurisdiction}, ` +
        `envelope rejects: ${counter.rejected_envelope})`,
    );
  }

  await (options.markSynced ?? markSourcesSynced)("oecd_stat", {
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
  const countersByFactKey: Record<string, PerOecdStatCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    vintageLabel: OECD_STAT_VINTAGE,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
