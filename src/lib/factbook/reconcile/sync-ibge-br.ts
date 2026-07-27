/**
 * Phase R.18 — IBGE (Brazil) sync orchestrator.
 *
 * **NSO Wave 2 publisher** (alongside R.17 Statistics Canada in
 * parallel; R.16 Destatis-DE deferred to v1.1 per user decision
 * 2026-05-05). Direct sync from IBGE's open SIDRA REST endpoint
 * at `https://apisidra.ibge.gov.br/values/`. Token-less public
 * endpoint — no `IBGE_API_KEY` env var required.
 *
 * Mirrors the F.6 / R.1 / R.2 / R.7 / R.10 / R.11 / R.13 / R.14 /
 * R.15 pattern. SIDRA returns flat JSON (array-of-objects with
 * `D1C/D1N/D2C/D2N/...V` dimension+value shape); no XML parser
 * required (R.15 INSEE used regex on SDMX-XML; R.18 uses
 * `JSON.parse` directly). Ships 4 indicators using the
 * `/values/t/<TABLE>/n1/all/v/<VAR>/p/last%201[/c<CLASS>/<CAT>]`
 * URL pattern:
 *
 *   1. table 6579 / var 9324       → `population_total`
 *   2. table 1737 / var 2265       → `inflation_rate` (IPCA 12-mo)
 *   3. table 6381 / var 4099       → `unemployment_rate_pct` (PNADC)
 *   4. table 5932 / var 6562 (c=11255 cat=90707) → `gdp_real_growth_rate`
 *
 * All 4 ship as `civicaRole: 'canonical'` for the single jurisdiction
 * BRA. Per `~/civica/plan/ibge-br-resolution-v1.md` §2d, this is
 * Option C — multi-canonical-with-scope-predicate (NSO-for-its-own-
 * country) — adopting the R.15 INSEE precedent verbatim. Existing
 * IMF/WB/UN/Wikidata/CIA `civicaRole='canonical'` tags for BRA STAY
 * in place. The Phase F resolver remains freshness-driven; the
 * NSO-priority-tier patch in `nso-overrides.ts` (already shipped
 * with `BRA: "ibge_br"` in the map) gives IBGE the deterministic
 * tie-break for Brazil rows on freshness ties.
 *
 * **Brazil-only scope.** Single jurisdiction (ISO3 BRA, ISO2 BR).
 * Smallest sync in v1 by row count alongside R.15 INSEE.
 *
 * **Portuguese-only API surface.** SIDRA returns Portuguese-only
 * descriptors (no bilingual mechanism comparable to INSEE's SDMX
 * `TITLE_FR`/`TITLE_EN`). The (tableId, variableId) pair is the
 * stable identifier; per-config `labelPt` (verbatim from API) +
 * `labelEn` (Civica-authored translation) live in the indicator
 * config and flow into `sourceNote` + per-row references payload
 * for R.23 transparency. Civica's English label is informational
 * only — never used for filtering or matching.
 *
 * **SIDRA JSON shape (flat array-of-objects).** Each query returns:
 *
 * ```json
 * [
 *   {"NC":"Nível Territorial (Código)","NN":"Nível Territorial",
 *    "MC":"Unidade de Medida (Código)","MN":"Unidade de Medida",
 *    "V":"Valor","D1C":"Brasil (Código)","D1N":"Brasil",
 *    "D2C":"Variável (Código)","D2N":"Variável",
 *    "D3C":"Ano (Código)","D3N":"Ano"},
 *   {"NC":"1","NN":"Brasil","MC":"45","MN":"Pessoas",
 *    "V":"213421037","D1C":"1","D1N":"Brasil",
 *    "D2C":"9324","D2N":"População residente estimada",
 *    "D3C":"2025","D3N":"2025"}
 * ]
 * ```
 *
 * Walker:
 *   1. Skip element [0] (header descriptor).
 *   2. For each data row:
 *      - parse V as decimal number
 *      - extract period code from D3C (or D4C when classification
 *        present)
 *      - parse year prefix from period code (annual=YYYY, monthly=
 *        YYYYMM, quarterly=YYYY0Q, rolling-monthly=YYYYMM)
 *   3. Use `last%201` URL parameter so only one data row returns;
 *      the walker is robust to multiple rows but R.18 always
 *      requests exactly the latest.
 *
 * **value_type per Bug 1 forward policy.** Default `'measured'`.
 * SIDRA is backward-looking statistical surveillance — no forecast
 * horizons. Year-based discriminator fires defensively; counter
 * stays at 0.
 *
 * **License:** Brazilian Federal Open Data Policy via Decreto
 * 8.777/2016 + Lei 12.527/2011 (LAI) + Art. 8 Lei 9.610/1998
 * (official acts excluded from copyright). SPDX-equivalent slug:
 * `public_domain` (matches R.13 US Census convention). Per-row
 * `references[].license` payload carries the explicit Brazilian-
 * framework descriptor for academic citation precision.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.18
 * Resolution:  ~/civica/plan/ibge-br-resolution-v1.md
 * Bug 1:       ~/civica/plan/forecast-vs-measurement-v1.md
 */
import { eq, sql } from "drizzle-orm";

import {
  factSnapshots,
  jurisdictions,
} from "@/lib/db/schema";
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
  type CivicaSourceRole,
} from "./_sync-common";
import { resolveGrowthMethodology } from "@/lib/data/growth-methodology";

type Db = typeof import("@/lib/db").db;

const IBGE_BASE_URL = "https://apisidra.ibge.gov.br";
const IBGE_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Civica-side vintage label for IBGE rows. Per-indicator vintage
 * detail is captured in the per-row references payload via the
 * `ibgeTableId`/`ibgeVariableId`/`ibgePeriodCode` triplet plus the
 * SIDRA query URL.
 */
const IBGE_VINTAGE = "IBGE SIDRA 2026Q2";

/**
 * License string stamped into per-row references payload. Per
 * R.18 resolution §2e + §6 Q8: explicit Brazilian-framework
 * descriptor for academic citation precision (the sources-table
 * license field uses `public_domain` for SPDX-equivalent practical
 * handling).
 */
const IBGE_LICENSE = "Brazilian Federal Open Data Policy (Decreto 8.777/2016)";

/**
 * The single ISO3 jurisdiction R.18 writes for. Brazil — Civica
 * jurisdiction with slug `brazil`, ISO2 `BR`, ISO3 `BRA`. Confirmed
 * present in `jurisdictions` table per R.7.0 jurisdictions backfill.
 * IBGE SIDRA publishes only Brazilian national / sub-national data;
 * non-Brazil rows are not in upstream scope. R.18 fetches `n1`
 * (national territorial level) only; sub-national IBGE coverage is
 * out of Civica scope (no Brazilian-state rows in `jurisdictions`).
 */
const IBGE_JURISDICTION_ISO3 = "BRA";

/**
 * Period parsing kind — informs how the walker extracts the
 * `factYear` from the SIDRA period code.
 *
 *  - `annual`           — period is `YYYY` (e.g. `2025`)
 *  - `monthly`          — period is `YYYYMM` (e.g. `202603` for
 *                         March 2026)
 *  - `quarterly`        — period is `YYYY0Q` (e.g. `202504` for
 *                         Q4 2025)
 *  - `monthly_rolling_quarter` — period is `YYYYMM`, but the data
 *                         IS a rolling 3-month aggregate (PNADC
 *                         mensal). Year extraction is the same as
 *                         `monthly`.
 */
export type IbgePeriodKind =
  | "annual"
  | "monthly"
  | "quarterly"
  | "monthly_rolling_quarter";

/**
 * One IBGE indicator we care about. Fetched via the
 * `/values/t/<TABLE>/n1/all/v/<VAR>/p/last%201[/c<CLASS>/<CAT>]`
 * URL pattern.
 */
export interface IbgeIndicatorConfig {
  /** SIDRA agregado (table) ID, e.g. "6579". */
  tableId: string;
  /** SIDRA variable ID within the table, e.g. "9324". */
  variableId: string;
  /** Optional classification + category filter (e.g. for GDP growth
   *  to filter to "PIB a preços de mercado" rather than per-sector).
   *  When null, no classification filter is applied. */
  classifications: { c: string; cat: string } | null;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Verbatim Portuguese label from IBGE's API (D2N value). */
  labelPt: string;
  /** Civica-authored English translation (informational; never used
   *  for filtering). */
  labelEn: string;
  /** Period parsing kind — informs `factYear` extraction. */
  periodKind: IbgePeriodKind;
  /** Multiplier applied to the raw IBGE value before envelope
   *  check and write. Default 1 — used when the IBGE unit matches
   *  the fact-key unit verbatim. All 4 R.18 indicators are
   *  identity. */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator (SIDRA web UI for the
   *  table). Stored in per-row references payload so the
   *  alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this IBGE indicator. R.18 ships
   *  all 4 as `'canonical'` per resolution §2d. Mirrors R.15
   *  INSEE's `civicaRole` field. */
  civicaRole?: CivicaSourceRole;
  /** Optional source-level note. Used to document IPCA-vs-INPC
   *  pick (inflation), Census-2022-benchmark (population), 14+
   *  cohort age (unemployment), SCN base year (GDP). */
  sourceNote?: string;
}

/**
 * The 4 IBGE indicators in R.18 ship scope. Per
 * `~/civica/plan/ibge-br-resolution-v1.md` §2b. All (table, variable)
 * pairs verified live 2026-05-05 against apisidra.ibge.gov.br.
 */
export const IBGE_INDICATORS: readonly IbgeIndicatorConfig[] = [
  {
    tableId: "6579",
    variableId: "9324",
    classifications: null,
    factKey: "population_total",
    labelPt: "População residente estimada",
    labelEn: "Estimated resident population",
    periodKind: "annual",
    docUrl: "https://sidra.ibge.gov.br/tabela/6579",
    civicaRole: "canonical",
    sourceNote:
      "IBGE Estimativas de População (table 6579, var 9324). " +
      "Annual mid-year estimate; PNAD/projection-based, published " +
      "late-August each year. Census 2022 benchmark population was " +
      "203,080,756 (IBGE table 4709, var 93). The estimate-vs-census " +
      "gap reflects Brazilian net-migration outflows + lower " +
      "fertility than the pre-2022 IBGE projection assumed.",
  },
  {
    tableId: "1737",
    variableId: "2265",
    classifications: null,
    factKey: "inflation_rate",
    labelPt: "IPCA - Variação acumulada em 12 meses",
    labelEn: "IPCA - Cumulative variation over 12 months",
    periodKind: "monthly",
    docUrl: "https://sidra.ibge.gov.br/tabela/1737",
    civicaRole: "canonical",
    sourceNote:
      "IBGE IPCA (Índice Nacional de Preços ao Consumidor Amplo). " +
      "Headline inflation measure used by Banco Central do Brasil " +
      "for the inflation-targeting regime (current target 3.0% ± " +
      "1.5pp). Monthly-published 12-month-rolling YoY rate. INPC " +
      "(low-income households) is a separate IBGE measure and is " +
      "not the inflation-targeting reference.",
  },
  {
    tableId: "6381",
    variableId: "4099",
    classifications: null,
    factKey: "unemployment_rate_pct",
    labelPt:
      "Taxa de desocupação, na semana de referência, das pessoas de 14 anos ou mais de idade",
    labelEn:
      "Unemployment rate, reference week, persons aged 14 years or older",
    periodKind: "monthly_rolling_quarter",
    docUrl: "https://sidra.ibge.gov.br/tabela/6381",
    civicaRole: "canonical",
    sourceNote:
      "IBGE PNAD Contínua mensal (table 6381, var 4099). Rolling " +
      "3-month aggregate, 14+ age cohort (Brazilian domestic " +
      "working-age definition). ILOSTAT publishes the international- " +
      "comparable 15+ rate; the age-cohort difference shifts the " +
      "rate by <0.2pp at Brazilian demographics.",
  },
  {
    tableId: "5932",
    variableId: "6562",
    classifications: { c: "11255", cat: "90707" },
    factKey: "gdp_real_growth_rate",
    labelPt:
      "Taxa acumulada em quatro trimestres (em relação ao mesmo período do ano anterior) — PIB a preços de mercado",
    labelEn:
      "Four-quarter cumulative rate (vs. same period of previous year) — GDP at market prices",
    periodKind: "quarterly",
    docUrl: "https://sidra.ibge.gov.br/tabela/5932",
    civicaRole: "canonical",
    sourceNote:
      "IBGE Sistema de Contas Nacionais Trimestrais (SCN-T), " +
      "table 5932 var 6562 c=11255 cat=90707. Four-quarter " +
      "accumulated YoY rate (the published headline annual GDP " +
      "growth rate matching IBGE press releases + Banco Central's " +
      "annual GDP print). Chained-volume index, base year 1995.",
  },
];

/**
 * Per-indicator counter shape. Mirrors the R.7 / R.10 / R.11 / R.15
 * patterns, simplified for single-jurisdiction scope.
 */
export interface PerIbgeCounters {
  factKey: string;
  tableId: string;
  variableId: string;
  /** Number of data rows (excluding header) parsed from the SIDRA
   *  response. */
  observations: number;
  /** 1 when a non-null latest observation was successfully extracted
   *  for BRA, else 0. */
  jurisdictions_with_value: number;
  /** 1 on a successful upsert, else 0. */
  written: number;
  /** 1 if the parsed value violated the fact-key envelope. */
  rejected_envelope: number;
  /** 1 if the upstream returned no data rows at all. */
  rejected_no_value: number;
  /** Counter for forecast-year rows landed (year > current calendar
   *  year). Defensive — SIDRA ships measured-only data; this counter
   *  should stay at 0 in normal sync runs. */
  projection_rows: number;
  /** Period code (D3C/D4C) of the latest observation. */
  latestPeriodCode: string | null;
  /** Period human label (D3N/D4N) of the latest observation. */
  latestPeriodLabel: string | null;
  /** Unit of measure (MN) reported by the API. */
  unitMeasure: string | null;
}

export interface IbgeSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  vintageLabel: string;
  countersByFactKey: Record<string, PerIbgeCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface IbgeSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific IBGE table ID (for testing). */
  tableId?: string;
  /** When true, no DB writes — just exercise fetch + parse + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
  /** Deterministic fixture seams; production callers omit these. */
  jurisdiction?: IbgeJurisdiction;
  fetchIndicator?: typeof fetchIndicator;
  persistDisputes?: typeof persistProposedDisputes;
  markSynced?: typeof markSourcesSynced;
  atlasReleaseId?: string;
  writeFact?: CountryFactHistoryWriter;
}

export interface IbgeJurisdiction {
  id: string;
  slug: string;
  iso2: string | null;
  iso3: string | null;
}

function freshCounters(
  factKey: string,
  tableId: string,
  variableId: string,
): PerIbgeCounters {
  return {
    factKey,
    tableId,
    variableId,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    projection_rows: 0,
    latestPeriodCode: null,
    latestPeriodLabel: null,
    unitMeasure: null,
  };
}

/**
 * Build the SIDRA values URL for a single (table, variable) pair.
 *
 * `last%201` (URL-encoded "last 1") fetches the most recent
 * observation only, so payloads are ~700 bytes each. R.18 uses this
 * for vintage stability — re-runs always pick up the latest period
 * without enumerating an explicit period list.
 *
 * The optional classification suffix `/c<CLASS>/<CAT>` is appended
 * for indicators that need it (e.g. GDP growth filters to
 * `c=11255 cat=90707` "PIB a preços de mercado").
 */
export function buildDataUrl(config: IbgeIndicatorConfig): string {
  const base = `${IBGE_BASE_URL}/values/t/${config.tableId}/n1/all/v/${config.variableId}/p/last%201`;
  if (config.classifications) {
    return `${base}/c${config.classifications.c}/${config.classifications.cat}`;
  }
  return base;
}

/**
 * One parsed SIDRA data row. SIDRA's response shape varies in the
 * number of D-position dimensions (D1, D2, D3, ... D6 typical) but
 * always carries `V`, `MC`/`MN`, and at least one D-position.
 */
export interface IbgeDataRow {
  V: string;
  MC: string | undefined;
  MN: string | undefined;
  /** All D-position pairs (D1C/D1N, D2C/D2N, ...). Used for period
   *  extraction (the period typically lives at D3 or D4 depending
   *  on whether a classification dimension is present). */
  dimensions: Array<{ position: number; code: string; name: string }>;
}

/**
 * Parsed SIDRA response — header element [0] describes which
 * D-position holds which kind of dimension. We use this to identify
 * the period D-position rather than guessing from data-row codes.
 *
 * Example header element:
 *   { D1N: "Brasil", D2N: "Variável", D3N: "Trimestre",
 *     D4N: "Setores e subsetores", ... }
 *
 * `periodPosition` is the D-index whose header name matches one of
 * the known period descriptors ("Ano", "Mês", "Trimestre",
 * "Trimestre Móvel"). When none matches, the period falls back to
 * the highest-numbered D-position (legacy heuristic).
 */
export interface SidraResponse {
  /** Which D-position holds the period dimension. */
  periodPosition: number;
  /** Human label for the period dimension (from header). */
  periodHeaderLabel: string | null;
  /** Data rows (header excluded). */
  dataRows: IbgeDataRow[];
}

/** Period-dimension header labels we recognise (match by inclusion;
 *  SIDRA's header values include the bare dimension name, not the
 *  "(Código)" variant which is the descriptive map for D{n}C). */
const PERIOD_HEADER_KEYWORDS = [
  "Trimestre Móvel",
  "Trimestre",
  "Mês",
  "Ano",
] as const;

/**
 * Parse the SIDRA JSON response into typed data rows + the resolved
 * period D-position. SIDRA's response is shape-stable: element [0]
 * is a header descriptor mapping D-position → human dimension label;
 * elements [1..] are data rows. We use the header to identify the
 * period D-position without guessing from data-row codes.
 *
 * Throws when the response is not a JSON array.
 */
export function parseSidraJson(json: unknown): SidraResponse {
  if (!Array.isArray(json)) {
    throw new Error("SIDRA response is not a JSON array");
  }
  if (json.length < 1) {
    return { periodPosition: -1, periodHeaderLabel: null, dataRows: [] };
  }

  // Walk the header element to find which D-position is the period.
  // SIDRA's header values for D{n}N look like "Brasil (Código)",
  // "Variável", "Ano (Código)", "Trimestre Móvel (Código)", etc.
  // We pick the D-position whose D{n}C header label CONTAINS a
  // known period keyword (Ano, Mês, Trimestre, Trimestre Móvel).
  // The D{n}C header is more reliable than D{n}N because the data
  // rows' D{n}C values are codes (period codes are what we extract).
  const header = json[0];
  let periodPosition = -1;
  let periodHeaderLabel: string | null = null;
  if (header && typeof header === "object") {
    const h = header as Record<string, unknown>;
    // Highest position wins on tie — SIDRA puts period at the
    // highest D-position when no classification follows it. When
    // a classification is present, the classification is later
    // (e.g. D4 for GDP growth) and the period is earlier (D3).
    // We pick by keyword match, NOT by position rank — keyword
    // matching disambiguates correctly.
    for (let p = 1; p <= 8; p++) {
      const codeHeader = h[`D${p}C`];
      const nameHeader = h[`D${p}N`];
      const labelToMatch =
        (typeof codeHeader === "string" ? codeHeader : "") +
        " " +
        (typeof nameHeader === "string" ? nameHeader : "");
      for (const kw of PERIOD_HEADER_KEYWORDS) {
        if (labelToMatch.includes(kw)) {
          periodPosition = p;
          periodHeaderLabel =
            typeof nameHeader === "string" ? nameHeader : kw;
          break;
        }
      }
      if (periodPosition === p) break;
    }
  }

  const dataRows: IbgeDataRow[] = [];
  for (let i = 1; i < json.length; i++) {
    const row = json[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.V !== "string") continue;
    const dimensions: IbgeDataRow["dimensions"] = [];
    for (let p = 1; p <= 8; p++) {
      const ck = `D${p}C`;
      const nk = `D${p}N`;
      const codeVal = r[ck];
      const nameVal = r[nk];
      if (typeof codeVal === "string" && typeof nameVal === "string") {
        dimensions.push({
          position: p,
          code: codeVal,
          name: nameVal,
        });
      }
    }
    dataRows.push({
      V: r.V,
      MC: typeof r.MC === "string" ? r.MC : undefined,
      MN: typeof r.MN === "string" ? r.MN : undefined,
      dimensions,
    });
  }
  return { periodPosition, periodHeaderLabel, dataRows };
}

/**
 * Find the period dimension in a SIDRA data row using the header-
 * resolved D-position. When the header didn't yield a period
 * D-position (legacy / unexpected response shape), fall back to
 * the highest-numbered D-position whose code looks like a year-
 * prefixed numeric (4-digit year prefix between 1900 and current+5).
 */
export function findPeriodDimension(
  row: IbgeDataRow,
  periodPosition: number,
): { code: string; name: string } | null {
  if (periodPosition > 0) {
    const dim = row.dimensions.find((d) => d.position === periodPosition);
    if (dim) return { code: dim.code, name: dim.name };
  }
  // Fallback: code is purely numeric AND has a 4-digit year prefix
  // in plausible range (1900..current+5). This rejects classification
  // codes like "90707" (which has a 4-digit prefix "9070" out of
  // range).
  const nowYear = new Date().getUTCFullYear();
  for (let i = row.dimensions.length - 1; i >= 0; i--) {
    const dim = row.dimensions[i];
    if (!/^\d+$/.test(dim.code)) continue;
    const yearPrefix = parseInt(dim.code.slice(0, 4), 10);
    if (yearPrefix >= 1900 && yearPrefix <= nowYear + 5) {
      return { code: dim.code, name: dim.name };
    }
  }
  return null;
}

/**
 * Compute the calendar year from a SIDRA period code. The year is
 * the 4-digit prefix in all R.18 periodKinds:
 *  - annual `"2025"`            → 2025
 *  - monthly `"202603"`         → 2026
 *  - quarterly `"202504"`       → 2025
 *  - monthly_rolling_quarter `"202603"` → 2026
 *
 * Returns null on parse failure.
 */
export function periodCodeToYear(code: string): number | null {
  const m = /^(\d{4})/.exec(code);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return Number.isFinite(y) ? y : null;
}

/**
 * Fetch one indicator's payload from the SIDRA API. Returns the
 * parsed data rows, the latest row, and the period dimension.
 * Throws on HTTP error or upstream error envelope.
 */
async function fetchIndicator(
  config: IbgeIndicatorConfig,
): Promise<{
  rows: IbgeDataRow[];
  latest: IbgeDataRow;
  periodCode: string;
  periodName: string;
  periodHeaderLabel: string | null;
}> {
  const url = buildDataUrl(config);
  const res = await fetch(url, {
    headers: {
      "User-Agent": IBGE_USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    let bodySnippet = "";
    try {
      bodySnippet = (await res.text()).slice(0, 400);
    } catch {
      // ignore
    }
    throw new Error(
      `IBGE table ${config.tableId} var ${config.variableId} (${config.factKey}): HTTP ${res.status} ${res.statusText} — ${bodySnippet}`,
    );
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `IBGE table ${config.tableId} var ${config.variableId} (${config.factKey}): JSON parse failed — ${
        err instanceof Error ? err.message : err
      }; body snippet: ${text.slice(0, 200)}`,
    );
  }

  const parsed = parseSidraJson(json);
  if (parsed.dataRows.length === 0) {
    throw new Error(
      `IBGE table ${config.tableId} var ${config.variableId} (${config.factKey}): SIDRA returned no data rows`,
    );
  }
  // Use the LAST row as latest. With `last%201`, exactly one data
  // row is returned; the loop is defensive.
  const latest = parsed.dataRows[parsed.dataRows.length - 1];
  const period = findPeriodDimension(latest, parsed.periodPosition);
  if (!period) {
    throw new Error(
      `IBGE table ${config.tableId} var ${config.variableId} (${config.factKey}): could not locate period dimension in row (header periodPosition=${parsed.periodPosition}, dimensions: ${latest.dimensions
        .map((d) => `D${d.position}=${d.code}`)
        .join(", ")})`,
    );
  }
  return {
    rows: parsed.dataRows,
    latest,
    periodCode: period.code,
    periodName: period.name,
    periodHeaderLabel: parsed.periodHeaderLabel,
  };
}

/**
 * Run the IBGE BR sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncIbgeBr(
  db: Db,
  options: IbgeSyncOptions = {},
): Promise<IbgeSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];
  const atlasReleaseId = options.dryRun
    ? null
    : resolveAtlasReleaseId(options.atlasReleaseId);
  const writeFact = options.writeFact ?? upsertCountryFactWithHistory;

  const targets = IBGE_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.tableId && c.tableId !== options.tableId) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: IBGE_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no IBGE indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Resolve the BRA jurisdiction once. R.18 writes for a single
  // jurisdiction; if the lookup fails, ship a clean error rather
  // than silently no-op.
  const jurisdictionRows = options.jurisdiction ? [options.jurisdiction] : await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.iso3, IBGE_JURISDICTION_ISO3))
    .limit(1);
  const jurisdiction = jurisdictionRows[0];
  if (!jurisdiction) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: IBGE_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: [
        `Brazil (${IBGE_JURISDICTION_ISO3}) not found in jurisdictions table — cannot sync IBGE`,
      ],
      dryRun: options.dryRun ?? false,
    };
  }
  log(
    `Brazil jurisdiction resolved: id=${jurisdiction.id} slug=${jurisdiction.slug} iso2=${jurisdiction.iso2}.`,
  );

  const counters = new Map<string, PerIbgeCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.tableId, c.variableId));
  }

  const currentYear = new Date().getUTCFullYear();
  let totalWritten = 0;
  // Phase F.6.1 — track every (jurisdictionId, factKey) pair we
  // upserted so the resolver can re-evaluate them and we can
  // persist any disputes after the write loop.
  const touchedPairs = new Set<string>();

  for (const config of targets) {
    const counter = counters.get(config.factKey)!;
    const factKeyDef = getFactKey(config.factKey);
    if (!factKeyDef) {
      errors.push(
        `unknown fact-key '${config.factKey}' for IBGE table ${config.tableId} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (table ${config.tableId} var ${config.variableId}) "${config.labelEn}" — fetching…`,
    );

    let rows: IbgeDataRow[];
    let latest: IbgeDataRow;
    let periodCode: string;
    let periodName: string;
    try {
      const r = await (options.fetchIndicator ?? fetchIndicator)(config);
      rows = r.rows;
      latest = r.latest;
      periodCode = r.periodCode;
      periodName = r.periodName;
      counter.observations = rows.length;
    } catch (err) {
      errors.push(
        `${config.tableId}:${config.variableId} ${config.factKey} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    counter.latestPeriodCode = periodCode;
    counter.latestPeriodLabel = periodName;
    counter.unitMeasure = latest.MN ?? null;
    counter.jurisdictions_with_value = 1;
    log(
      `  fetched ${counter.observations} row${counter.observations === 1 ? "" : "s"} (period ${periodCode}/"${periodName}", V=${latest.V}, unit=${latest.MN ?? "?"})`,
    );

    // Parse the value. SIDRA's V is always a decimal string with no
    // thousands separators in API responses (only the human SIDRA
    // web UI uses separators).
    const rawValue = Number(latest.V);
    if (!Number.isFinite(rawValue)) {
      counter.rejected_no_value++;
      errors.push(
        `${config.tableId}:${config.variableId} ${config.factKey}: V="${latest.V}" did not parse as a finite number`,
      );
      continue;
    }
    const transform = config.valueTransform ?? ((v: number) => v);
    const numericValue = transform(rawValue);

    // Plausibility envelope per fact-key registry §3.6. Same
    // R.1.1 pattern as R.7 OECD / R.11 Eurostat / R.15 INSEE.
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
          `${config.tableId}:${config.variableId} ${config.factKey}: value ${numericValue} (period ${periodCode}) out of envelope [${min ?? "-∞"}, ${max ?? "+∞"}]`,
        );
        continue;
      }
    }

    const factYear = periodCodeToYear(periodCode);
    if (factYear === null) {
      counter.rejected_no_value++;
      errors.push(
        `${config.tableId}:${config.variableId} ${config.factKey}: could not parse year from periodCode="${periodCode}"`,
      );
      continue;
    }
    const asOf = `${factYear}-01-01`;

    // Bug 1 forward policy — defensive year-based discriminator.
    // SIDRA is backward-looking; this counter should stay at 0.
    const valueType: "measured" | "projected" =
      factYear > currentYear ? "projected" : "measured";
    if (factYear > currentYear) {
      counter.projection_rows++;
    }

    // Growth-methodology label — NULL on non-growth fact-keys; the
    // per-source default (IBGE table 5932 → four-quarter accumulated YoY)
    // on the growth key. Written to `country_facts.growth_methodology`.
    const growthMethodology = resolveGrowthMethodology(
      null,
      "ibge_br",
      config.factKey,
    );

    const upstreamPayload = {
      source: "ibge_br",
      endpoint: buildDataUrl(config),
      iso2: jurisdiction.iso2,
      iso3: jurisdiction.iso3,
      tableId: config.tableId,
      variableId: config.variableId,
      classifications: config.classifications,
      periodCode,
      periodName,
      periodKind: config.periodKind,
      year: factYear,
      rawValue,
      transformedValue: numericValue,
      unitMeasure: latest.MN,
      labelPt: config.labelPt,
      labelEn: config.labelEn,
      ibgeVintage: IBGE_VINTAGE,
    };
    const hash = payloadHash(upstreamPayload);

    // R.18 — per-row references payload. Mirrors R.15 INSEE shape +
    // adds `ibgeTableId` + `ibgeVariableId` + `ibgePeriodCode` for
    // R.23 methodology-page rendering. Multi-canonical-with-scope-
    // predicate (NSO-for-its-own-country) coexists with existing
    // IMF/WB/UN/Wikidata/CIA `'canonical'` tags for BRA on the same
    // fact-key; the Phase F resolver remains freshness-driven; the
    // NSO-priority-tier patch (`nso-overrides.ts`, already shipped)
    // ensures IBGE wins bit-exact-tied freshness for Brazil rows
    // via `isNsoForJurisdiction("ibge_br", "BRA")`.
    const referencesPayload = [
      {
        url: config.docUrl,
        allowlistTier: 2,
        allowlistName: "IBGE (Brazil)",
        civicaRole: config.civicaRole ?? "alternate",
        license: IBGE_LICENSE,
        ibgeTableId: config.tableId,
        ibgeVariableId: config.variableId,
        ibgeClassifications: config.classifications,
        ibgePeriodCode: periodCode,
        ibgePeriodLabel: periodName,
        ibgePeriodKind: config.periodKind,
        ibgeLabelPt: config.labelPt,
        ibgeLabelEn: config.labelEn,
        ibgeUnitMeasure: latest.MN,
      },
    ];

    if (options.dryRun) {
      log(
        `  [DRY] ${jurisdiction.slug} ${config.factKey} = ${numericValue} (${factYear}, ${valueType})`,
      );
      counter.written++;
      totalWritten++;
      touchedPairs.add(`${jurisdiction.id}|${config.factKey}`);
      continue;
    }

    try {
      // Snapshot dedup — re-runs with identical upstream payloads
      // are no-ops at the snapshot table.
      await db
        .insert(factSnapshots)
        .values({
          sourceId: "ibge_br",
          upstreamRef: `ibge_br:${jurisdiction.iso3}:${config.tableId}:${config.variableId}:${config.factKey}:${periodCode}`,
          payloadHash: hash,
          payload: upstreamPayload as object,
          upstreamVintageLabel: IBGE_VINTAGE,
        })
        .onConflictDoNothing({
          target: [factSnapshots.sourceId, factSnapshots.payloadHash],
        });

      const snapshotIdRow = await db
        .select({ id: factSnapshots.id })
        .from(factSnapshots)
        .where(
          sql`${factSnapshots.sourceId} = 'ibge_br' AND ${factSnapshots.payloadHash} = ${hash}`,
        )
        .limit(1);
      const snapshotId = snapshotIdRow[0]?.id ?? null;

      const values = {
        jurisdictionId: jurisdiction.id,
        factKey: config.factKey,
        factGroup: factKeyDef.group,
        category: factKeyDef.category,
        sourceId: "ibge_br",
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
        upstreamVintageLabel: IBGE_VINTAGE,
        methodologyVersion: "v0.1-beta",
        status: "active",
        statusReason: null,
        snapshotId,
        sourceNote: config.sourceNote ?? null,
        valueType,
        growthMethodology,
      };
      await writeFact(db, {
        values,
        history: routineCountryFactHistory(values, atlasReleaseId!),
      });
      counter.written++;
      totalWritten++;
      touchedPairs.add(`${jurisdiction.id}|${config.factKey}`);
    } catch (err) {
      errors.push(
        `${jurisdiction.slug} ${config.factKey}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    log(
      `  wrote ${counter.written} row` +
        (counter.rejected_envelope
          ? ` [envelope reject: ${counter.rejected_envelope}]`
          : "") +
        (counter.projection_rows
          ? ` [projections: ${counter.projection_rows}]`
          : ""),
    );
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
      disputes = await (options.persistDisputes ?? persistProposedDisputes)(db, touched, {
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

  await markExternalSourceSyncedAfterAggregateSuccess({
    sourceIds: "ibge_br",
    rowsWritten: totalWritten,
    dryRun: options.dryRun,
    executor: db,
    errors,
    markSynced: options.markSynced ?? markSourcesSynced,
  });

  const finishedAtMs = Date.now();
  const countersByFactKey: Record<string, PerIbgeCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: 1,
    vintageLabel: IBGE_VINTAGE,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
