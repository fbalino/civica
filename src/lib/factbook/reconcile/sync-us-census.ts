/**
 * Phase R.13 — US Census Bureau sync orchestrator.
 *
 * NSO Wave 1, first phase. Direct sync from the US Census Bureau's
 * REST API at `https://api.census.gov/data/`. The Census API is
 * keyless for our quarterly query volume (7 fetches per cron run,
 * well under the 500/day anonymous limit) and serves data as JSON
 * arrays with a header row.
 *
 * Ships 7 indicators across 6 existing fact-keys + 1 new
 * fact-key declared at R.13:
 *
 *   1. ACS 1-Year Profile DP05_0001E      → `population_total`
 *   2. ACS 1-Year Profile DP05_0018E      → `median_age`
 *   3. Decennial 2020 DHC P1_001U + P1_001N → `urbanization_rate` (urban / total × 100)
 *   4. ACS 1-Year Subject S2301_C04_001E  → `unemployment_rate_pct`
 *   5. ACS 1-Year Profile DP02_0153PE     → `internet_users_pct`
 *   6. ACS 1-Year Profile DP03_0062E      → `median_household_income_usd` (NEW)
 *
 * **United-States-only scope.** The Census Bureau is the legal
 * statistical authority for the United States; it has no
 * methodological claim outside US borders. The sync writes rows
 * for `iso2='US'` ONLY. For non-US jurisdictions, Civica's
 * resolver continues using IMF/WB/UN/etc.
 *
 * **Multi-canonical with scope predicate.** Per resolution §2d /
 * §2e (Option C), all R.13 indicators ship with
 * `civicaRole='canonical'`. Existing Tier-1 (`world_bank`,
 * `un_data`, `who_gho`, etc.) `'canonical'` tags STAY in place —
 * US Census ADDS as a concurrent canonical publisher bounded by
 * `iso2='US'` scope. The methodology page (R.23) renders
 * multi-canonical attribution with scope predicates. Same
 * architectural pattern as R.7 OECD (member-only) and R.11
 * Eurostat (EU+EFTA-only), applied at country grain.
 *
 * **NSO-priority-tier patch coordination.** A separate small
 * patch ships `src/lib/factbook/reconcile/nso-overrides.ts` +
 * a resolver tweak that ensures `us_census` wins tied-date
 * races against Tier-1 publishers for the USA jurisdiction.
 * The source ID `"us_census"` MUST match the
 * `NSO_SOURCE_BY_ISO3["USA"]` entry there. Don't rename.
 *
 * **value_type per Bug 1 forward policy.** Default `'measured'`
 * for all R.13 rows. ACS estimates have margins of error attached
 * but the central estimate is a measurement, not a forecast.
 * Decennial is a 10-year cadence (2020, 2030, …) and is the legal
 * census; tagged `'measured'` with `factYear=2020`. The
 * year-based `factYear > currentYear → 'projected'` discriminator
 * fires defensively at write time but never trips for Census
 * (publication lag is 1–2 years; future-dated data does not
 * exist).
 *
 * **License: U.S. Government works — public domain.** 17 U.S.C.
 * § 105. The Census Bureau's published Terms of Service require
 * only an attribution notice — *"This product uses the Census
 * Bureau Data API but is not endorsed or certified by the Census
 * Bureau"* — and prohibit using the Bureau's name to imply
 * endorsement. Commercial use OK; modification OK; redistribution
 * OK. Cleanest license posture in v1 — strictly more permissive
 * than R.4 WHO (CC-BY-NC-SA), R.7 OECD (OECD attribution),
 * R.8 FAO (CC-BY-4.0), R.11 Eurostat (CC-BY-4.0), R.12 WTO
 * (ODbL-1.0).
 *
 * The Phase F resolver picks between US Census and existing
 * Tier-1 publishers per methodology §3.3 — material-error guard
 * + freshness preference WITH Bug 1's `value_type` partition. The
 * `civicaRole` field on each indicator config is informational
 * only (NOT used by the resolver); it persists into the fact
 * row's `references[].civicaRole` payload so the methodology
 * page rewrite (Phase R.23) can render scope-bounded canonical
 * attribution without a separate lookup.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.13
 * Resolution:  ~/civica/plan/us-census-resolution-v1.md
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

const CENSUS_BASE_URL = "https://api.census.gov/data";
const CENSUS_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Civica-side vintage label for ACS 1-Year rows. Latest available
 * vintage at R.13 ship time is **2024** (verified live 2026-05-05;
 * ACS 2024 1-Year published Sept 2025).
 *
 * Per `~/civica/plan/us-census-resolution-v1.md` §6 Q6.
 */
const ACS_1YEAR_VINTAGE_YEAR = 2024;
const ACS_1YEAR_VINTAGE_LABEL = `US Census ACS 1-Year ${ACS_1YEAR_VINTAGE_YEAR}`;

/**
 * Decennial vintage. Locked at 2020 until the 2030 Decennial.
 *
 * Per `~/civica/plan/us-census-resolution-v1.md` §6 Q6.
 */
const DECENNIAL_VINTAGE_YEAR = 2020;
const DECENNIAL_VINTAGE_LABEL = `US Census ${DECENNIAL_VINTAGE_YEAR} Decennial DHC`;

/**
 * License string stamped into per-row references payload.
 *
 * U.S. Government works are public domain under 17 U.S.C. § 105.
 * Commercial use OK with the required attribution notice. Stricter
 * licenses in v1 are R.4 WHO (CC-BY-NC-SA-3.0-IGO), R.12 WTO
 * (ODbL-1.0). Per `~/civica/plan/us-census-resolution-v1.md` §2f.
 */
const US_CENSUS_LICENSE = "public_domain";

/**
 * Required attribution notice per Census Bureau Terms of Service.
 * The methodology page (R.23) will surface this prominently in the
 * per-source attribution block. Stamped here so machine consumers
 * (the public API envelope) can carry it through.
 *
 * Per `~/civica/plan/us-census-resolution-v1.md` §2f.
 */
const US_CENSUS_ATTRIBUTION =
  "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.";

/**
 * One US Census indicator we care about. Encodes the dataset path
 * (e.g. `acs/acs1/profile`), the vintage year, the variable code
 * (e.g. `DP05_0001E`), and the destination Civica fact-key.
 *
 * `valueTransform` lets us reshape upstream units to fact-key units
 * (most R.13 indicators are identity transforms; `urbanization_rate`
 * is the lone exception — it's computed as `urban / total × 100`).
 */
export interface UsCensusIndicatorConfig {
  /**
   * Census API dataset path under `https://api.census.gov/data/{vintage}/`.
   * Examples: `acs/acs1/profile`, `acs/acs1/subject`, `dec/dhc`,
   * `dec/dp`.
   */
  dataset: string;
  /** Vintage year (e.g. 2024 for ACS 2024 1-Year, 2020 for Decennial). */
  vintage: number;
  /**
   * Variable code(s) requested in the `get=` query parameter. For
   * `urbanization_rate` we request two variables (urban + total
   * population) and divide; for all other indicators we request one.
   */
  variables: readonly string[];
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /**
   * Multiplier or composition function applied to the raw response
   * cells before envelope check and write. Default: identity on the
   * first variable (parsed as float).
   *
   * For multi-variable indicators (urbanization_rate), `valueTransform`
   * receives ALL parsed cells in `variables` order and returns the
   * composed numeric value.
   */
  valueTransform?: (cells: number[]) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /**
   * The vintage label stamped into the row's
   * `upstream_vintage_label` column. Per-indicator because Decennial
   * + ACS share the same source slug but have different vintage
   * cadences.
   */
  vintageLabel: string;
  /**
   * Civica's editorial role for this US Census indicator. R.13 ships
   * all 6 indicators as `'canonical'` for the United States per the
   * resolution §2d / §2e (Option C — multi-canonical with scope
   * predicate). The Phase F resolver does NOT use this field for
   * runtime selection (the resolver is freshness-driven per
   * methodology §3.3); the field is informational metadata for the
   * methodology page rewrite at Phase R.23. Mirrors R.11 Eurostat's
   * `EurostatIndicatorConfig.civicaRole`.
   */
  civicaRole?: CivicaSourceRole;
}

/**
 * The 6 US Census indicators in R.13 ship scope. Per
 * `~/civica/plan/us-census-resolution-v1.md` §2b.
 *
 * Live probes verified 2026-05-05:
 *   - DP05_0001E (population_total) ACS 2024 1-Year = 340,110,990
 *   - DP05_0018E (median_age) ACS 2023 1-Year = 39.2
 *   - P1_001N (Decennial 2020 total population) = 331,449,281
 *   - DP1_0086C (Decennial 2020 urban population) = 235,411,507
 *     → urbanization rate = 235.4M / 331.4M × 100 = 71.04%
 *   - S2301_C04_001E (unemployment_rate_pct) ACS 2023 1-Year = 4.3%
 *   - DP02_0153PE (internet_users_pct, broadband subscription) — see Q4
 *   - DP03_0062E (median_household_income_usd) ACS 2023 1-Year = $77,719
 *
 * Note that fertility_rate, life_expectancy_years, and
 * gdp_per_capita_usd are NOT in R.13 scope — see resolution §2c.5,
 * §2c.6, §2c.7. CDC NCHS / BEA are out of v1 scope.
 */
export const US_CENSUS_INDICATORS: readonly UsCensusIndicatorConfig[] = [
  {
    dataset: "acs/acs1/profile",
    vintage: ACS_1YEAR_VINTAGE_YEAR,
    variables: ["DP05_0001E"],
    factKey: "population_total",
    label: "Total population (ACS 1-Year estimate)",
    docUrl:
      "https://api.census.gov/data/2024/acs/acs1/profile/variables/DP05_0001E.json",
    vintageLabel: ACS_1YEAR_VINTAGE_LABEL,
    civicaRole: "canonical",
  },
  {
    dataset: "acs/acs1/profile",
    vintage: ACS_1YEAR_VINTAGE_YEAR,
    variables: ["DP05_0018E"],
    factKey: "median_age",
    label: "Median age (ACS 1-Year estimate)",
    docUrl:
      "https://api.census.gov/data/2024/acs/acs1/profile/variables/DP05_0018E.json",
    vintageLabel: ACS_1YEAR_VINTAGE_LABEL,
    civicaRole: "canonical",
  },
  {
    // Urbanization rate — computed from Decennial 2020 DHC + DP datasets.
    // Probe results 2026-05-05:
    //   GET /data/2020/dec/dp?get=NAME,DP1_0086C&for=us:1
    //     → ["United States","235411507","1"]    (urban population)
    //   GET /data/2020/dec/dhc?get=NAME,P1_001N&for=us:1
    //     → ["United States","331449281","1"]    (total population)
    //   ratio = 235,411,507 / 331,449,281 × 100 = 71.04%
    //
    // The 2022 Census urban-area redefinition produces a notably
    // lower urban share than CIA (83.3%, 2023) and WB (80.1%, 2024),
    // both of which appear to use the pre-2022 definition. Gap is
    // ~12 pp — below `materialErrorPpThreshold: 50` so the row
    // passes. Methodology page (R.23) will explain the redefinition.
    //
    // This indicator queries the Decennial DP dataset; the total
    // population reading comes from the Decennial DHC dataset in a
    // second fetch. The fetcher handles the two-fetch composition
    // via the `composeFromDatasets` field below.
    dataset: "dec/dp",
    vintage: DECENNIAL_VINTAGE_YEAR,
    variables: ["DP1_0086C"],
    factKey: "urbanization_rate",
    label: "Urbanization rate (Decennial 2020, post-2022 definition)",
    docUrl:
      "https://api.census.gov/data/2020/dec/dp/variables/DP1_0086C.json",
    vintageLabel: DECENNIAL_VINTAGE_LABEL,
    civicaRole: "canonical",
    // valueTransform receives [urbanPop, totalPop] in the order
    // returned by the composed-dataset fetch (urban first, total
    // second). Returns urban share as a percentage in [0, 100].
    valueTransform: (cells: number[]) => {
      const urban = cells[0];
      const total = cells[1];
      if (!Number.isFinite(urban) || !Number.isFinite(total) || total === 0)
        return Number.NaN;
      return (urban / total) * 100;
    },
  },
  {
    dataset: "acs/acs1/subject",
    vintage: ACS_1YEAR_VINTAGE_YEAR,
    variables: ["S2301_C04_001E"],
    factKey: "unemployment_rate_pct",
    label: "Unemployment rate, civilian population 16+ (ACS 1-Year)",
    docUrl:
      "https://api.census.gov/data/2024/acs/acs1/subject/variables/S2301_C04_001E.json",
    vintageLabel: ACS_1YEAR_VINTAGE_LABEL,
    civicaRole: "canonical",
  },
  {
    // DP02_0153PE = "Percent!!HOUSEHOLDS BY TYPE!!Total households!!
    //                COMPUTERS AND INTERNET USE!!With a broadband
    //                Internet subscription"
    // ACS measures household-level broadband subscription, which is the
    // closest US-specific analog to the WB `IT.NET.USER.ZS` indicator
    // (% individuals using the internet). The two are not identical
    // (households vs individuals; broadband-only vs any internet use)
    // but for US purposes ACS is the authoritative direct measurement.
    // Methodology page (R.23) will surface the household-vs-individual
    // distinction in the alternates panel.
    dataset: "acs/acs1/profile",
    vintage: ACS_1YEAR_VINTAGE_YEAR,
    variables: ["DP02_0153PE"],
    factKey: "internet_users_pct",
    label:
      "Households with broadband internet subscription (ACS 1-Year, % of households)",
    docUrl:
      "https://api.census.gov/data/2024/acs/acs1/profile/variables/DP02_0153PE.json",
    vintageLabel: ACS_1YEAR_VINTAGE_LABEL,
    civicaRole: "canonical",
  },
  {
    // NEW fact-key declared at R.13. Per resolution §2c.4 + §6 Q3
    // (sign-off Option A: declare inline). All 8 NSOs in Wave 1
    // publish median household income as a foundational statistic.
    dataset: "acs/acs1/profile",
    vintage: ACS_1YEAR_VINTAGE_YEAR,
    variables: ["DP03_0062E"],
    factKey: "median_household_income_usd",
    label: "Median household income (ACS 1-Year, USD)",
    docUrl:
      "https://api.census.gov/data/2024/acs/acs1/profile/variables/DP03_0062E.json",
    vintageLabel: ACS_1YEAR_VINTAGE_LABEL,
    civicaRole: "canonical",
  },
];

/**
 * Per-indicator counter shape. Mirrors the Eurostat / WTO patterns.
 */
export interface PerUsCensusCounters {
  factKey: string;
  dataset: string;
  vintage: number;
  /** Number of API rows received for this indicator (typically 1
   *  for a `for=us:1` query). */
  observations: number;
  /** 1 when the indicator successfully resolved to a value; 0 otherwise. */
  jurisdictions_with_value: number;
  written: number;
  rejected_envelope: number;
  rejected_no_value: number;
  /** Rows rejected because the value didn't parse to a finite
   *  number (e.g. Census API "null" or "(X)" for suppressed values). */
  rejected_parse_error: number;
  /** Counter for forecast-year rows. Defensive — Census doesn't
   *  publish forecasts; this counter should stay at 0 in normal runs. */
  projection_rows: number;
}

export interface UsCensusSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  countersByFactKey: Record<string, PerUsCensusCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface UsCensusSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(
  factKey: string,
  dataset: string,
  vintage: number,
): PerUsCensusCounters {
  return {
    factKey,
    dataset,
    vintage,
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
 * Build the Census API fetch URL.
 *
 * Pattern: `<BASE>/<vintage>/<dataset>?get=NAME,<vars>&for=us:1`
 *
 * No API key required at our query volume (≤500 requests/day per
 * anonymous IP; we ship 7 fetches per quarterly cron run).
 */
function buildDataUrl(
  dataset: string,
  vintage: number,
  variables: readonly string[],
): string {
  const vars = ["NAME", ...variables].join(",");
  return `${CENSUS_BASE_URL}/${vintage}/${dataset}?get=${vars}&for=us:1`;
}

/**
 * Fetch one Census API endpoint and parse the value cells.
 *
 * Census API response shape:
 *   [
 *     ["NAME", "DP05_0001E", "us"],     // header row
 *     ["United States", "340110990", "1"]  // data row
 *   ]
 *
 * Returns numeric values for each requested variable in the order
 * given by `variables`. Census uses string-typed values throughout
 * (even numerics); the parser parses to float. Suppressed cells
 * sometimes appear as "null", "-666666666" (the Census null sentinel),
 * or "(X)"; the parser returns NaN for those, which the caller
 * treats as a parse error.
 */
async function fetchIndicatorValues(
  dataset: string,
  vintage: number,
  variables: readonly string[],
): Promise<number[]> {
  const url = buildDataUrl(dataset, vintage, variables);
  const res = await fetch(url, {
    headers: {
      "User-Agent": CENSUS_USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(
      `US Census ${dataset} ${variables.join(",")} (${vintage}): ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body) || body.length < 2) {
    throw new Error(
      `US Census ${dataset} ${variables.join(",")} (${vintage}): unexpected response shape`,
    );
  }
  const header = body[0] as unknown[];
  const dataRow = body[1] as unknown[];
  if (!Array.isArray(header) || !Array.isArray(dataRow)) {
    throw new Error(
      `US Census ${dataset} ${variables.join(",")} (${vintage}): rows are not arrays`,
    );
  }

  // Locate each requested variable in the header row and read the
  // matching cell from the data row. The first column is "NAME"; the
  // last column is the geography descriptor ("us"). Variable cells
  // sit in between.
  const out: number[] = [];
  for (const v of variables) {
    const idx = header.indexOf(v);
    if (idx === -1) {
      // Surface as NaN — caller's parse-error counter handles it.
      out.push(Number.NaN);
      continue;
    }
    const cell = dataRow[idx];
    if (typeof cell !== "string") {
      out.push(Number.NaN);
      continue;
    }
    // Census suppression markers — return NaN. Common forms:
    // "(X)" (not applicable), "-666666666" (null sentinel), "null".
    if (cell === "(X)" || cell === "null" || cell === "-666666666") {
      out.push(Number.NaN);
      continue;
    }
    const parsed = parseFloat(cell);
    out.push(parsed);
  }
  return out;
}

/**
 * Compose the urbanization rate from Decennial 2020 DP (urban
 * population) + DHC (total population) datasets. Returns the urban
 * share as a percentage in [0, 100], or NaN on failure.
 */
async function fetchUrbanizationRate(): Promise<number> {
  const [urbanCells, totalCells] = await Promise.all([
    fetchIndicatorValues("dec/dp", DECENNIAL_VINTAGE_YEAR, ["DP1_0086C"]),
    fetchIndicatorValues("dec/dhc", DECENNIAL_VINTAGE_YEAR, ["P1_001N"]),
  ]);
  const urban = urbanCells[0];
  const total = totalCells[0];
  if (!Number.isFinite(urban) || !Number.isFinite(total) || total === 0)
    return Number.NaN;
  return (urban / total) * 100;
}

/**
 * Run the US Census sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncUsCensus(
  db: Db,
  options: UsCensusSyncOptions = {},
): Promise<UsCensusSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = US_CENSUS_INDICATORS.filter((c) => {
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
      errors: ["no US Census indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Resolve the USA jurisdiction once; the sync is single-jurisdiction
  // by design (Census Bureau scope is US-only).
  const usaRows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.iso2, "US"));
  if (usaRows.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: [
        "USA jurisdiction not found in jurisdictions table (iso2='US')",
      ],
      dryRun: options.dryRun ?? false,
    };
  }
  const usa = usaRows[0];
  log(
    `USA jurisdiction resolved: id=${usa.id}, slug=${usa.slug}, iso3=${usa.iso3}.`,
  );

  const counters = new Map<string, PerUsCensusCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.dataset, c.vintage));
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
        `unknown fact-key '${config.factKey}' for US Census ${config.dataset} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.dataset} ${config.vintage}) "${config.label}" — fetching…`,
    );

    let numericValue: number;
    let rawCells: number[];
    try {
      if (config.factKey === "urbanization_rate") {
        // Two-dataset composition for urbanization rate.
        const composed = await fetchUrbanizationRate();
        rawCells = [composed];
        numericValue = composed;
      } else {
        rawCells = await fetchIndicatorValues(
          config.dataset,
          config.vintage,
          config.variables,
        );
        const transform =
          config.valueTransform ?? ((cells: number[]) => cells[0]);
        numericValue = transform(rawCells);
      }
      counter.observations = 1;
    } catch (err) {
      errors.push(
        `${config.dataset} ${config.factKey} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }

    if (!Number.isFinite(numericValue)) {
      counter.rejected_parse_error++;
      log(
        `  rejected_parse_error: Census returned non-finite value for ${config.factKey} (cells=${JSON.stringify(rawCells)})`,
      );
      continue;
    }
    counter.jurisdictions_with_value = 1;

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
        log(
          `  rejected_envelope: ${config.factKey} = ${numericValue} outside [${min}, ${max}]`,
        );
        continue;
      }
    }

    const factYear = config.vintage;
    const asOf = `${factYear}-01-01`;

    // Bug 1 forward policy — defensive year-based discriminator.
    // Census does NOT publish forecasts; this counter should stay
    // at 0 in normal runs but is wired for future Census datasets
    // that may include nowcast-style projections.
    const valueType: "measured" | "projected" =
      factYear > currentYear ? "projected" : "measured";
    if (factYear > currentYear) {
      counter.projection_rows++;
    }

    const upstreamPayload = {
      source: "us_census",
      endpoint: buildDataUrl(config.dataset, config.vintage, config.variables),
      iso2: usa.iso2,
      iso3: usa.iso3,
      dataset: config.dataset,
      vintage: config.vintage,
      variables: [...config.variables],
      year: factYear,
      rawCells,
      transformedValue: numericValue,
      vintageLabel: config.vintageLabel,
    };
    const hash = payloadHash(upstreamPayload);

    // R.13 — per-row references payload. Mirrors R.11 Eurostat / R.12
    // WTO shape. The required Census Bureau attribution notice is
    // stamped into `attributionNotice` so the methodology page (R.23)
    // and the public API envelope can surface it.
    const referencesPayload = [
      {
        url: config.docUrl,
        allowlistTier: 2,
        allowlistName: "US Census Bureau",
        civicaRole: config.civicaRole ?? "alternate",
        license: US_CENSUS_LICENSE,
        attributionNotice: US_CENSUS_ATTRIBUTION,
        censusDataset: config.dataset,
        censusVintage: config.vintage,
        censusVariables: [...config.variables],
      },
    ];

    if (options.dryRun) {
      log(
        `  [DRY] ${usa.slug} ${config.factKey} = ${numericValue} (${factYear}, ${valueType})`,
      );
      counter.written++;
      totalWritten++;
      touchedPairs.add(`${usa.id}|${config.factKey}`);
      continue;
    }

    try {
      // Snapshot dedup — re-runs with identical upstream payloads
      // are no-ops at the snapshot table.
      await db
        .insert(factSnapshots)
        .values({
          sourceId: "us_census",
          upstreamRef: `us_census:${usa.iso2}:${config.dataset}:${config.factKey}:${factYear}`,
          payloadHash: hash,
          payload: upstreamPayload as object,
          upstreamVintageLabel: config.vintageLabel,
        })
        .onConflictDoNothing({
          target: [factSnapshots.sourceId, factSnapshots.payloadHash],
        });

      const snapshotIdRow = await db
        .select({ id: factSnapshots.id })
        .from(factSnapshots)
        .where(
          sql`${factSnapshots.sourceId} = 'us_census' AND ${factSnapshots.payloadHash} = ${hash}`,
        )
        .limit(1);
      const snapshotId = snapshotIdRow[0]?.id ?? null;

      await db
        .insert(countryFacts)
        .values({
          jurisdictionId: usa.id,
          factKey: config.factKey,
          factGroup: factKeyDef.group,
          category: factKeyDef.category,
          sourceId: "us_census",
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
          upstreamVintageLabel: config.vintageLabel,
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
            upstreamVintageLabel: config.vintageLabel,
            snapshotId,
            valueType,
            updatedAt: new Date(),
          },
        });
      counter.written++;
      totalWritten++;
      touchedPairs.add(`${usa.id}|${config.factKey}`);
      log(
        `  wrote ${config.factKey} = ${numericValue} (${factYear}, ${valueType})`,
      );
    } catch (err) {
      errors.push(
        `${usa.slug} ${config.factKey}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  await markSourcesSynced("us_census", {
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
  const countersByFactKey: Record<string, PerUsCensusCounters> = {};
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
