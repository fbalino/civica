/**
 * Phase R.19 — Stats SA (South Africa) sync orchestrator.
 *
 * **NSO Wave 3 publisher** — first NSO in v1 with NO programmatic
 * API. Stats SA publishes statistical releases as PDFs at stable
 * URLs under `https://www.statssa.gov.za/publications/<P-CODE>/`.
 * R.19 fetches the PDF, passes it to Anthropic SDK as a native
 * `document` content block, asks Claude Haiku 4.5 (tool-use mode,
 * temperature 0) to extract the headline value + verbatim quote,
 * and writes one row per indicator into `country_facts`.
 *
 * **PDF-as-ingest-surface decision** is the load-bearing
 * methodology call documented in
 * `~/civica/plan/stats-sa-resolution-v1.md` §2a. Investigation
 * confirmed Stats SA has neither a JSON/SDMX/REST API nor a
 * non-vintage-stamped Excel bulk-download URL. The PDF route at
 * `/publications/<P-CODE>/<P-CODE><Period>.pdf` is the only
 * stable-URL ingest path.
 *
 * **Anthropic-SDK-PDF-extraction implementation choice** is
 * documented in §2a.1. The SDK is already a v1 dependency
 * (Pulse classifier, bills summariser, /api/chat). Cost ~$0.20/year.
 * No new dependency. Lazy-init the client per the project
 * convention (module-level `new Anthropic()` evaluates before
 * dotenv populates env vars).
 *
 * **Failure-mode behavior (Q5 user override 2026-05-05):** ANY
 * extraction failure → graceful no-op, NEVER a hallucinated row.
 * Specifically:
 *   - Tool-use schema validation (strict JSON via tool_choice).
 *   - Envelope check from `fact-keys.ts` registry.
 *   - Sanity range per indicator (tighter than envelope; catches
 *     hallucinations that survive envelope, e.g. a pop sub-aggregate).
 *   - Verbatim `rawQuote` substring check (the extracted number
 *     must appear in the quoted sentence).
 *   - NO retry-with-different-temperature (the original §2a.1 retry
 *     proposal was superseded by user override; failure → skip + alert).
 *   - Skipped indicators: console.error + summary.errors[]; previous
 *     row stays canonical.
 *
 * Ships **4 indicators** for `iso3='ZAF'` only (single-country NSO):
 *
 *   1. P0302 (Mid-year population estimates, annual)     → `population_total`     (canonical)
 *   2. P0141 (Consumer Price Index, monthly 12-mo YoY)   → `inflation_rate`       (canonical)
 *   3. P0211 (QLFS LU1 unemployment rate, quarterly)     → `unemployment_rate_pct`(canonical)
 *   4. P0441 (GDP, quarterly QoQ seasonally adjusted)    → `gdp_real_growth_rate` (canonical)
 *
 * All 4 ship as `civicaRole: 'canonical'` for ZAF rows ONLY. Per
 * `~/civica/plan/stats-sa-resolution-v1.md` §2d, this is Option C —
 * multi-canonical with scope predicate (NSO-for-its-own-country),
 * inheriting R.13/R.14/R.15/R.18 verbatim. Existing IMF/WB/UN/
 * CIA/ILO `civicaRole='canonical'` tags for ZAF STAY in place.
 *
 * **NSO-priority-tier patch.** `stats_sa` is pre-registered in
 * `nso-overrides.ts` `NSO_SOURCE_BY_ISO3.ZAF` (resolver patch
 * already shipped). The resolver's Group B tiebreak gives Stats SA
 * priority=0 and other Tier-1 publishers priority=1 for ZAF rows
 * ONLY — tied-date races resolve deterministically. For non-ZAF
 * countries this map is a no-op (no `stats_sa` rows exist outside
 * ZAF). Per `~/civica/plan/stats-sa-resolution-v1.md` §2d.
 *
 * **GDP methodology delta.** Stats SA's P0441 reports QoQ
 * seasonally-adjusted growth at constant 2015 prices, NOT YoY
 * annual growth like WB/IMF. Per resolution §2c + Q2 sign-off,
 * R.19 ships the QoQ rate with explicit
 * `payload.statsSaGrowthMethodology = "qoq_seasonally_adjusted"`
 * audit-trail tag and a `sourceNote` documenting the choice.
 * Mirrors R.18 IBGE's "4-Q YoY" precedent of acceptable
 * methodology variation within `gdp_real_growth_rate`.
 *
 * **value_type per Bug 1 forward policy.** Default `'measured'` for
 * all 4 R.19 rows. Year-based discriminator (year > current_year →
 * 'projected') fires defensively at write time, but Stats SA PDFs
 * publish realised statistics only — no forecast horizons.
 *
 * **License:** Stats SA Copyright (CC-BY-4.0 equivalent). Per
 * `~/civica/plan/stats-sa-resolution-v1.md` §2e + Q6 sign-off.
 * Attribution required, commercial-use OK, redistribution OK,
 * modification OK; no share-alike. NOT an SPDX-listed license.
 *
 * **`sources` row upsert.** R.19 inserts the `stats_sa` row
 * defensively at sync start (idempotent UPSERT) so cron deploys
 * without a separate `npm run seed:sources` re-run still work.
 * The row is also added to `scripts/seed-sources.ts` for canonical
 * seeding.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.19
 * Resolution:  ~/civica/plan/stats-sa-resolution-v1.md
 * Bug 1:       ~/civica/plan/forecast-vs-measurement-v1.md
 */
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";

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
import type { CivicaSourceRole } from "./sync-wdi";

type Db = typeof import("@/lib/db").db;

const STATS_SA_BASE_URL = "https://www.statssa.gov.za";
const STATS_SA_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Civica-side source ID for Stats SA. Pre-registered in
 * `nso-overrides.ts` `NSO_SOURCE_BY_ISO3.ZAF` (line 44). The slug
 * is load-bearing — must match the `sources.id` row + the
 * allowlist `civicaSourceId` + the resolver's NSO map entry +
 * the api.ts SOURCE_LABELS key.
 */
const STATS_SA_SOURCE_ID = "stats_sa";

/**
 * Civica-side vintage label for Stats SA rows. Per-indicator
 * vintage detail is captured in the per-row references payload via
 * the `statsSaPCode`/`statsSaPdfUrl`/`statsSaPeriodLabel` triplet.
 * Quarterly cadence per resolution §2g (user override 2026-05-05).
 */
const STATS_SA_VINTAGE = "Stats SA 2026Q2";

/**
 * License string stamped into per-row references payload. Per
 * `~/civica/plan/stats-sa-resolution-v1.md` §2e + Q6 sign-off.
 *
 * Stats SA's terms (copyright + attribution + commercial-OK +
 * redistribution-OK + modification-OK; no share-alike) are
 * functionally equivalent to CC-BY-4.0 but NOT an SPDX-listed
 * license. The license string mirrors R.17 StatCan's non-SPDX
 * human-readable convention. Per-row `references[].license`
 * carries the verbatim citation.
 */
const STATS_SA_LICENSE = "Stats SA Copyright (CC-BY-4.0 equivalent)";
const STATS_SA_LICENSE_CITATION =
  "Stats SA Copyright (https://www.statssa.gov.za/?page_id=425) — attribution required, CC-BY-4.0-equivalent";

/**
 * `sources` table base URL for Stats SA.
 */
const STATS_SA_BASE_URL_SOURCES_FIELD = "https://www.statssa.gov.za";

/**
 * South Africa-only scope. Civica jurisdictions table key = ISO3
 * 'ZAF'. Stats SA publishes only South African national + sub-
 * national data; sub-national is out of scope (Civica's
 * jurisdictions table covers sovereign states only).
 */
const STATS_SA_TARGET_ISO3 = "ZAF";

/**
 * The scope predicate stamped into per-row references payload for
 * methodology-page rendering. Mirrors R.14 ONS's "UK" choice — the
 * common-name form reads more naturally than the ISO3 form.
 */
const STATS_SA_SCOPE_PREDICATE = "South Africa";

/**
 * Anthropic model + extraction-prompt versioning.
 *
 * Locked in resolution §2a.1 + Q5 sign-off:
 *   - Model: `claude-haiku-4-5-20251001` (matches the version
 *     pinned in src/lib/pulse/v2/summarize.ts).
 *   - Temperature: 0 (deterministic).
 *   - Tool-use mode (strict JSON schema; no free-form output).
 *
 * Prompt version captured per-row in
 * `payload.statsSaExtractionPromptVersion` so future revisions can
 * be tracked. Bumping the version is a deliberate methodology
 * change.
 */
const STATS_SA_EXTRACTION_MODEL = "claude-haiku-4-5-20251001";
const STATS_SA_EXTRACTION_PROMPT_VERSION = "v1.0";

/**
 * Lazy-init the Anthropic client per the project convention.
 * Module-level `new Anthropic()` evaluates before dotenv populates
 * env vars in some script contexts.
 */
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_RECONCILIATION });
  }
  return _anthropic;
}

/**
 * Period parsing kind — informs how the URL builder constructs the
 * latest-available PDF filename and how the walker derives
 * `factYear`/`asOf` from the extracted period label.
 *
 *  - `annual`    — P0302 mid-year-pop. URL `/P0302<YYYY>.pdf`.
 *  - `monthly`   — P0141 CPI. URL `/P0141<MonthName><YYYY>.pdf`.
 *  - `quarterly` — P0211 QLFS, P0441 GDP. URL
 *                  `/P0XXX<Nordinal>Quarter<YYYY>.pdf`.
 */
export type StatsSaPeriodKind = "annual" | "monthly" | "quarterly";

/**
 * One Stats SA indicator. Each entry pins a P-code + URL template
 * + Civica fact-key + extraction prompt + sanity-range bounds.
 */
export interface StatsSaIndicatorConfig {
  /** Stats SA publication code (P0302, P0141, P0211, P0441). */
  pCode: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Period parsing kind — drives URL construction + period parsing. */
  periodKind: StatsSaPeriodKind;
  /** Human-readable indicator title (English). */
  title: string;
  /** Indicator-specific extraction prompt fragment.
   *  Prepended to the shared base prompt at extraction time. */
  promptFragment: string;
  /** Sanity range — tighter than the fact-keys.ts envelope.
   *  Catches hallucinations that survive envelope (e.g. a sub-
   *  aggregate, a level instead of a rate). */
  sanityMin: number;
  sanityMax: number;
  /** Civica's editorial role for this Stats SA indicator. R.19
   *  ships all 4 as `'canonical'` per resolution §2d. */
  civicaRole?: CivicaSourceRole;
  /** Optional source-level note attached per-row. Used to document
   *  methodology deltas (QoQ-vs-YoY GDP, LU1-vs-LU2 unemployment). */
  sourceNote?: string;
  /** Optional value transform applied before envelope check. Default
   *  identity. Used to normalise units (Stats SA reports population
   *  in millions in the Summary; the actual value is in absolute
   *  persons). All 4 R.19 indicators rely on the extraction prompt
   *  to return the value in the target unit, so transform is
   *  identity. */
  valueTransform?: (raw: number) => number;
  /** Maximum number of pages to send to the Anthropic SDK. The SDK
   *  caps PDF documents at 100 pages; some Stats SA releases ship
   *  long appendices well past that limit (P0211 QLFS Q4 2025 ships
   *  139 pages; Table A is on page 1). Setting `maxPages` causes
   *  the orchestrator to use `pdf-lib` to extract just the first N
   *  pages before encoding for the SDK. Defaults to 30 — enough
   *  for the headline tables in all 4 R.19 PDFs (verified against
   *  the 2026Q2 vintage; Table A / Key findings / Summary always
   *  appear within the first ~10 pages). */
  maxPages?: number;
}

/**
 * The 4 Stats SA indicators in R.19 ship scope. Per
 * `~/civica/plan/stats-sa-resolution-v1.md` §2b + §7a. P-codes,
 * URL templates, and sample values verified live 2026-05-05.
 */
export const STATS_SA_INDICATORS: readonly StatsSaIndicatorConfig[] = [
  {
    pCode: "P0302",
    factKey: "population_total",
    periodKind: "annual",
    title: "Mid-year population estimates (South Africa)",
    promptFragment:
      "Extract the total mid-year population for South Africa as a " +
      "whole, in absolute persons (NOT millions, NOT a sub-aggregate, " +
      'NOT a provincial breakdown). The Summary section reports it as ' +
      'e.g. "63,10 million people" — convert this to absolute persons ' +
      "(63,100,000). Stats SA uses comma as decimal separator and " +
      "space as thousands separator; normalise both before returning. " +
      "The value is the mid-year point of the reporting year.",
    sanityMin: 50_000_000,
    sanityMax: 80_000_000,
    civicaRole: "canonical",
    sourceNote:
      "Stats SA Mid-year population estimates (P0302). Annual " +
      "cohort-component projection from the 2022 Census benchmark, " +
      "released end of July each year for the mid-year reference of " +
      "the same calendar year. Provisional pending the next census " +
      "update; methodology page treats provisional measurements as " +
      "measured (per Bug 1 forward policy).",
  },
  {
    pCode: "P0141",
    factKey: "inflation_rate",
    periodKind: "monthly",
    title: "Consumer Price Index — annual rate (South Africa)",
    promptFragment:
      'Extract the headline "annual consumer price inflation" rate ' +
      "for the most recent reference month, as a decimal percent " +
      '(e.g. 3.1 for 3,1%). The Key Findings section reports it as ' +
      'e.g. "Annual consumer price inflation was 3,1% in March 2026". ' +
      "This is the 12-month YoY all-urban headline measure used by " +
      "the South African Reserve Bank for inflation targeting (target " +
      "3.0–6.0% band). Stats SA uses comma as decimal separator; " +
      "normalise to dot. Do NOT extract goods-only, services-only, " +
      "or month-on-month rates — only the headline annual rate.",
    sanityMin: -5,
    sanityMax: 100,
    civicaRole: "canonical",
    sourceNote:
      "Stats SA Consumer Price Index (P0141). Monthly all-urban " +
      "headline 12-month YoY rate. CPI excluding owner-occupiers' " +
      "imputed rents; the inflation-targeting reference for the " +
      "South African Reserve Bank.",
  },
  {
    pCode: "P0211",
    factKey: "unemployment_rate_pct",
    periodKind: "quarterly",
    title: "Quarterly Labour Force Survey — LU1 unemployment rate (South Africa)",
    promptFragment:
      'Extract the "LU1 - Unemployment rate" value for the most ' +
      'recent quarter from "Table A: Key labour market indicators", ' +
      "as a decimal percent (e.g. 31.4 for 31,4%). LU1 is the " +
      "official ILO-definition unemployment rate (the headline). Do " +
      "NOT extract LU2 (combined with time-related underemployment), " +
      "LU3 (combined with potential labour force), or LU4 (composite " +
      "measure of labour underutilisation) — only LU1. Stats SA uses " +
      "comma as decimal separator; normalise to dot. The most recent " +
      "quarter's column is typically labelled e.g. \"Oct-Dec 2025\" " +
      "for Q4 2025.",
    sanityMin: 5,
    sanityMax: 60,
    civicaRole: "canonical",
    sourceNote:
      "Stats SA Quarterly Labour Force Survey (P0211), LU1 official " +
      "ILO-definition unemployment rate. Aligns with WB/IMF/OECD/ " +
      "ILOSTAT methodology. Stats SA also publishes LU2/LU3/LU4 " +
      "expanded labour-underutilisation rates in the same release; " +
      "those are deferred to a v1.1 fact-key registry expansion.",
  },
  {
    pCode: "P0441",
    factKey: "gdp_real_growth_rate",
    periodKind: "quarterly",
    title: "Gross Domestic Product — quarter-on-quarter real growth (South Africa)",
    promptFragment:
      "Extract the headline real GDP quarter-on-quarter (QoQ) growth " +
      "rate for the most recent quarter, as a decimal percent " +
      '(e.g. 0.4 for 0,4%). Key Findings reports it as e.g. ' +
      '"Real gross domestic product (GDP) measured by production ' +
      'increased by 0,4% in the fourth quarter of 2025". This is the ' +
      "seasonally-adjusted growth rate at constant 2015 prices, NOT " +
      "the year-on-year (YoY) rate. Stats SA uses comma as decimal " +
      "separator; normalise to dot. Do NOT extract YoY growth, " +
      "expenditure-side growth, or annual estimates — only the " +
      "production-side QoQ headline.",
    sanityMin: -20,
    sanityMax: 20,
    civicaRole: "canonical",
    sourceNote:
      "Stats SA Gross Domestic Product (P0441). Quarter-on-quarter " +
      "seasonally adjusted real growth at constant 2015 prices. " +
      "Methodology delta against WB/IMF (which publish annual YoY " +
      "growth) and against R.18 IBGE (which publishes 4-Q " +
      "accumulated YoY) is acknowledged in the methodology page; " +
      "all three NSOs ship under `gdp_real_growth_rate` per the " +
      "Wave 1+2 precedent of accepting genuine cross-NSO " +
      "methodology heterogeneity. A 2022-base-year + ESA " +
      "rebase of P0441 is flagged by Stats SA for later in 2026.",
  },
];

/**
 * Per-indicator counter shape. Mirrors R.18 IBGE / R.14 ONS
 * patterns, simplified for single-jurisdiction scope.
 */
export interface PerStatsSaCounters {
  factKey: string;
  pCode: string;
  /** PDF URL fetched on this run (or attempted). */
  pdfUrl: string | null;
  /** HTTP status of the PDF fetch. */
  pdfStatus: number | null;
  /** Number of bytes downloaded. */
  pdfBytes: number;
  /** 1 when extraction succeeded; 0 otherwise. */
  jurisdictions_with_value: number;
  /** 1 on a successful upsert; 0 otherwise. */
  written: number;
  /** 1 if the PDF fetch returned 404 / non-2xx. */
  rejected_no_pdf: number;
  /** 1 if the Anthropic call failed (network, schema-violation,
   *  empty response, etc.). */
  rejected_extraction: number;
  /** 1 if the extracted value violated the per-fact-key envelope
   *  (envelope check from `fact-keys.ts`). */
  rejected_envelope: number;
  /** 1 if the extracted value violated the per-indicator sanity
   *  range (tighter than envelope; catches hallucinations). */
  rejected_sanity: number;
  /** 1 if the verbatim `rawQuote` did not contain the extracted
   *  number as a substring (catches free-form hallucinations
   *  even when tool-use enforces JSON shape). */
  rejected_quote_mismatch: number;
  /** Counter for forecast-year rows landed (year > current calendar
   *  year). Defensive — Stats SA publishes realised statistics
   *  only; this counter should stay at 0 in normal sync runs. */
  projection_rows: number;
  /** The latest period label as printed on the PDF (e.g. "March
   *  2026", "Q4 2025", "2025"). */
  latestPeriodLabel: string | null;
  /** The factYear derived from the period label. */
  pickedYear: number | null;
  /** The numeric value written. */
  pickedValue: number | null;
  /** Verbatim quote from the PDF that contains the value
   *  (audit-trail). */
  rawQuote: string | null;
}

export interface StatsSaSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  vintageLabel: string;
  countersByFactKey: Record<string, PerStatsSaCounters>;
  totalWritten: number;
  /** Whether the `sources.stats_sa` row was inserted on this run
   *  (true on first run; false on subsequent UPSERT no-ops). */
  sourceRowInserted: boolean;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface StatsSaSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific Stats SA P-code (for testing). */
  pCode?: string;
  /** When true, no DB writes — just exercise fetch + extract + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(
  factKey: string,
  pCode: string,
): PerStatsSaCounters {
  return {
    factKey,
    pCode,
    pdfUrl: null,
    pdfStatus: null,
    pdfBytes: 0,
    jurisdictions_with_value: 0,
    written: 0,
    rejected_no_pdf: 0,
    rejected_extraction: 0,
    rejected_envelope: 0,
    rejected_sanity: 0,
    rejected_quote_mismatch: 0,
    projection_rows: 0,
    latestPeriodLabel: null,
    pickedYear: null,
    pickedValue: null,
    rawQuote: null,
  };
}

function payloadHash(payload: object): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/**
 * The 12 month names Stats SA uses in P0141 PDF filenames.
 * Capitalised English (`P0141March2026.pdf`).
 */
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * The 4 quarter ordinals Stats SA uses in P0211/P0441 PDF
 * filenames (e.g. `P02114thQuarter2025.pdf`).
 */
const QUARTER_ORDINALS = ["1st", "2nd", "3rd", "4th"] as const;

/**
 * Build a Stats SA publication PDF URL for a given (P-code, year,
 * month, quarter). Used by `enumerateCandidateUrls()` below to
 * generate the list of candidate URLs to try for "latest available".
 */
function buildPdfUrl(
  pCode: string,
  year: number,
  month?: number,
  quarter?: number,
): string {
  if (month !== undefined) {
    const monthName = MONTH_NAMES[month - 1];
    return `${STATS_SA_BASE_URL}/publications/${pCode}/${pCode}${monthName}${year}.pdf`;
  }
  if (quarter !== undefined) {
    const ord = QUARTER_ORDINALS[quarter - 1];
    return `${STATS_SA_BASE_URL}/publications/${pCode}/${pCode}${ord}Quarter${year}.pdf`;
  }
  // Annual.
  return `${STATS_SA_BASE_URL}/publications/${pCode}/${pCode}${year}.pdf`;
}

/**
 * Enumerate candidate URLs for the latest-available PDF, newest
 * first. The fetch loop tries each URL in order and uses the first
 * 200-OK response.
 *
 * Stats SA's release lag varies by indicator:
 *   - P0302 (annual): published end of July → for Jan-July, fall
 *     back to previous year. Cap at 2 candidates.
 *   - P0141 (monthly): embargoed ~22nd of next month → at any cron
 *     run, the most recent published is current month minus 1 (or
 *     2 if cron runs early in the month). Cap at 4 candidates.
 *   - P0211 (quarterly): embargoed ~6 weeks after quarter end → at
 *     any cron run, fall back to most recent fully-released
 *     quarter. Cap at 4 candidates.
 *   - P0441 (quarterly): embargoed ~10 weeks after quarter end →
 *     same as P0211 but typically 1 quarter further behind. Cap at
 *     5 candidates.
 *
 * The cap defends against unbounded staleness from URL pattern
 * changes — if all candidates 404, the indicator skips with an
 * alert rather than walking back through years.
 */
function enumerateCandidateUrls(
  config: StatsSaIndicatorConfig,
  now: Date,
): string[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  const quarter = Math.floor((month - 1) / 3) + 1; // 1-4

  const urls: string[] = [];

  if (config.periodKind === "annual") {
    // P0302 — released end of July. If we're past Aug, current year
    // is available; else fall back to previous year.
    if (month >= 8) {
      urls.push(buildPdfUrl(config.pCode, year));
    }
    urls.push(buildPdfUrl(config.pCode, year - 1));
    // Cap: 2 candidates (current and previous calendar year).
  } else if (config.periodKind === "monthly") {
    // P0141 — most recent published month. Try current month - 1,
    // then - 2, then - 3, then - 4. Cap at 4 candidates.
    for (let lag = 1; lag <= 4; lag++) {
      let candYear = year;
      let candMonth = month - lag;
      if (candMonth <= 0) {
        candYear -= 1;
        candMonth += 12;
      }
      urls.push(buildPdfUrl(config.pCode, candYear, candMonth));
    }
  } else if (config.periodKind === "quarterly") {
    // P0211 / P0441 — most recent published quarter. Try current
    // quarter - 1, then - 2, then - 3, then - 4. Cap at 5
    // candidates (defensive against P0441's longer lag).
    for (let lag = 1; lag <= 5; lag++) {
      let candYear = year;
      let candQuarter = quarter - lag;
      while (candQuarter <= 0) {
        candYear -= 1;
        candQuarter += 4;
      }
      urls.push(buildPdfUrl(config.pCode, candYear, undefined, candQuarter));
    }
  }

  return urls;
}

/**
 * One fetched PDF — buffer + URL + status — ready for Anthropic
 * extraction.
 */
interface FetchedPdf {
  url: string;
  status: number;
  bytes: number;
  /** Total page count of the source PDF. */
  totalPages: number;
  /** Page count of the (possibly truncated) base64 buffer. */
  pagesSent: number;
  base64: string;
  /** True when `pdf-lib` truncated the source to fit `maxPages`. */
  truncated: boolean;
}

/**
 * Truncate a PDF to its first N pages. Used to fit Anthropic's
 * 100-page document limit when Stats SA ships long appendices
 * (P0211 QLFS Q4 2025 = 139 pages; Table A is on page 1).
 *
 * Returns the truncated buffer + the new page count. Mutates
 * nothing — the original buffer is left intact.
 */
async function truncatePdfPages(
  buf: ArrayBuffer,
  maxPages: number,
): Promise<{ buf: Buffer; pages: number }> {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (total <= maxPages) {
    // No truncation needed — re-emit the original.
    return { buf: Buffer.from(buf), pages: total };
  }
  const dst = await PDFDocument.create();
  const pageIndices = Array.from({ length: maxPages }, (_, i) => i);
  const copied = await dst.copyPages(src, pageIndices);
  for (const p of copied) dst.addPage(p);
  const out = await dst.save();
  return { buf: Buffer.from(out), pages: maxPages };
}

/**
 * Try each candidate URL in order; return the first 200-OK
 * response with the PDF body base64-encoded for the Anthropic SDK
 * `document` content block.
 *
 * Returns null when ALL candidates 404. The sync logs the failure
 * and skips the indicator (graceful no-op; existing row stays
 * canonical until the next successful run).
 */
async function fetchLatestPdf(
  candidates: string[],
  maxPages: number,
  log: (line: string) => void,
): Promise<FetchedPdf | null> {
  for (const url of candidates) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": STATS_SA_USER_AGENT,
          Accept: "application/pdf",
        },
      });
    } catch (err) {
      log(`  fetch failed on ${url}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (res.status === 404) {
      log(`  404 ${url} (trying next candidate…)`);
      continue;
    }
    if (!res.ok) {
      log(`  ${res.status} ${url} (treating as no-data; trying next candidate…)`);
      continue;
    }
    const buf = await res.arrayBuffer();
    const bytes = buf.byteLength;
    // PDF magic-number sanity: must start with %PDF.
    const head = new Uint8Array(buf.slice(0, 4));
    const isPdfMagic =
      head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
    if (!isPdfMagic) {
      log(`  ${res.status} ${url} returned ${bytes} bytes but no %PDF magic; skipping`);
      continue;
    }

    // Page-truncate when the PDF exceeds Anthropic's 100-page cap
    // (we use `maxPages` as a tighter ceiling — the headline data
    // for all 4 R.19 PDFs lives in the first ~10 pages).
    let outBuf: Buffer;
    let totalPages: number;
    let pagesSent: number;
    let truncated: boolean;
    try {
      const truncated_ = await truncatePdfPages(buf, maxPages);
      // Re-load to get the source page count.
      const probe = await PDFDocument.load(buf, { ignoreEncryption: true });
      totalPages = probe.getPageCount();
      pagesSent = truncated_.pages;
      outBuf = truncated_.buf;
      truncated = totalPages > maxPages;
    } catch (err) {
      log(
        `  ${res.status} ${url}: pdf-lib failed to load — ${
          err instanceof Error ? err.message : err
        }; skipping`,
      );
      continue;
    }
    const base64 = outBuf.toString("base64");
    log(
      `  ${res.status} ${url} (${bytes} bytes, ${totalPages} pages` +
        (truncated ? `, truncated to first ${pagesSent} for SDK` : "") +
        `) — fetched OK`,
    );
    return {
      url,
      status: res.status,
      bytes,
      totalPages,
      pagesSent,
      base64,
      truncated,
    };
  }
  return null;
}

/**
 * The structured extraction result returned by the Anthropic
 * tool-use call. Schema enforced via tool input_schema below.
 */
export interface StatsSaExtraction {
  value: number;
  asOfPeriodLabel: string;
  asOfYear: number;
  asOfMonth: number | null;
  asOfQuarter: number | null;
  rawQuote: string;
  tableReference: string;
}

/**
 * The tool-use schema. Strict — required fields must be present;
 * unknown fields are not silently dropped (the SDK validates).
 */
const EXTRACTION_TOOL_SCHEMA: Anthropic.Tool = {
  name: "extractStatsSaIndicator",
  description:
    "Extract the headline numeric value for a single indicator " +
    "from a Statistics South Africa statistical-release PDF.",
  input_schema: {
    type: "object",
    properties: {
      value: {
        type: "number",
        description:
          "The headline numeric value, in the unit specified by the " +
          "indicator prompt (e.g. percent as decimal, absolute persons).",
      },
      asOfPeriodLabel: {
        type: "string",
        description:
          'The verbatim period label as printed in the PDF (e.g. ' +
          '"March 2026", "Q4 2025", "2025").',
      },
      asOfYear: {
        type: "integer",
        description: "The calendar year of the reference period.",
      },
      asOfMonth: {
        type: ["integer", "null"],
        description:
          "Month 1-12 for monthly indicators; null for non-monthly.",
      },
      asOfQuarter: {
        type: ["integer", "null"],
        description:
          "Quarter 1-4 for quarterly indicators; null for non-quarterly.",
      },
      rawQuote: {
        type: "string",
        description:
          "The verbatim sentence from the PDF containing the value. " +
          "Must contain the extracted number as a substring " +
          "(allowing for comma vs. dot decimal separator " +
          "normalisation).",
      },
      tableReference: {
        type: "string",
        description:
          'Which table or section the value came from (e.g. "Table A", ' +
          '"Key Findings", "Summary").',
      },
    },
    required: [
      "value",
      "asOfPeriodLabel",
      "asOfYear",
      "asOfMonth",
      "asOfQuarter",
      "rawQuote",
    ],
  },
};

const EXTRACTION_BASE_PROMPT = `\
You are extracting a specific number from a Statistics South Africa \
statistical release PDF. The number is the "headline" value — the \
single official aggregate value for South Africa as a whole, NOT a \
sub-aggregate or breakdown.

You MUST call the extractStatsSaIndicator tool exactly once with \
the extracted value. Do NOT respond with prose. If the value cannot \
be located in the PDF, still call the tool with your best estimate \
and a rawQuote explaining the situation — the calling code will \
validate the result.

Per-indicator instruction:`;

/**
 * Run the Anthropic SDK extraction. Returns null when the model
 * fails to produce a valid tool-use response. Caller treats null
 * as "skip this indicator" per the Q5 failure-mode contract.
 */
async function extractFromPdf(
  config: StatsSaIndicatorConfig,
  pdf: FetchedPdf,
  log: (line: string) => void,
): Promise<StatsSaExtraction | null> {
  const client = getAnthropic();
  const prompt = `${EXTRACTION_BASE_PROMPT}\n${config.promptFragment}`;

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: STATS_SA_EXTRACTION_MODEL,
      max_tokens: 1024,
      temperature: 0,
      tools: [EXTRACTION_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL_SCHEMA.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf.base64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });
  } catch (err) {
    log(
      `  EXTRACTION FAILURE: Anthropic SDK call threw — ${
        err instanceof Error ? err.message : err
      }`,
    );
    return null;
  }

  // Find the tool_use block in the response.
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse || toolUse.name !== EXTRACTION_TOOL_SCHEMA.name) {
    log(
      `  EXTRACTION FAILURE: model did not invoke the tool ` +
        `(stop_reason=${response.stop_reason}, content blocks=${response.content
          .map((b) => b.type)
          .join(",")})`,
    );
    return null;
  }

  // The SDK's typed input is `unknown`; we shape-check at runtime.
  const input = toolUse.input as Record<string, unknown>;
  const value = typeof input.value === "number" ? input.value : null;
  const asOfPeriodLabel =
    typeof input.asOfPeriodLabel === "string" ? input.asOfPeriodLabel : null;
  const asOfYear = typeof input.asOfYear === "number" ? input.asOfYear : null;
  const asOfMonth =
    input.asOfMonth === null
      ? null
      : typeof input.asOfMonth === "number"
        ? input.asOfMonth
        : null;
  const asOfQuarter =
    input.asOfQuarter === null
      ? null
      : typeof input.asOfQuarter === "number"
        ? input.asOfQuarter
        : null;
  const rawQuote = typeof input.rawQuote === "string" ? input.rawQuote : null;
  // tableReference is required by schema but the model occasionally
  // returns null/empty even on successful extractions; fall back to
  // "(unspecified)" rather than failing the indicator. The verbatim
  // `rawQuote` substring check downstream is the load-bearing
  // hallucination guard, not the table reference.
  const tableReference =
    typeof input.tableReference === "string" && input.tableReference.length > 0
      ? input.tableReference
      : "(unspecified)";

  // The actual hallucination-guard fields: value (must be numeric),
  // asOfYear (must be numeric), and rawQuote (must contain the
  // value as a substring — checked downstream in
  // `quoteContainsValue`).
  if (
    value === null ||
    !Number.isFinite(value) ||
    !asOfPeriodLabel ||
    asOfYear === null ||
    !Number.isFinite(asOfYear) ||
    !rawQuote
  ) {
    log(
      `  EXTRACTION FAILURE: tool input missing required fields ` +
        `(value=${value} year=${asOfYear} period="${asOfPeriodLabel}" ` +
        `rawQuote="${rawQuote?.slice(0, 50)}…")`,
    );
    return null;
  }

  return {
    value,
    asOfPeriodLabel,
    asOfYear,
    asOfMonth,
    asOfQuarter,
    rawQuote,
    tableReference,
  };
}

/**
 * Verify that the extracted value appears in the rawQuote as a
 * substring, allowing for Stats SA's comma-as-decimal-separator
 * convention and thousands-separator variations.
 *
 * Returns true when the value is locatable in the quote; false
 * otherwise (caller treats as extraction failure → skip).
 */
function quoteContainsValue(value: number, rawQuote: string): boolean {
  // Generate candidate string representations of the value:
  //   - bare numeric ("3.1", "31.4", "0.4", "63100000")
  //   - comma-decimal ("3,1", "31,4", "0,4")
  //   - thousands-grouped variants for large numbers ("63,100,000",
  //     "63 100 000", "63.10 million")
  //
  // The model is instructed to return the rawQuote verbatim, which
  // for percentages means the comma-decimal form will appear.
  const candidates = new Set<string>();

  // Drop trailing .0 for integer-valued floats.
  const normalised =
    Number.isInteger(value) && Math.abs(value) < 1e9
      ? String(value)
      : String(value);
  candidates.add(normalised);

  // Bare number.
  candidates.add(String(value));

  // Round to 1 decimal for percentages-shape values.
  if (Math.abs(value) < 1000) {
    const oneDp = value.toFixed(1);
    candidates.add(oneDp);
    candidates.add(oneDp.replace(".", ","));
    const twoDp = value.toFixed(2);
    candidates.add(twoDp);
    candidates.add(twoDp.replace(".", ","));
  }

  // For large counts (population), also accept the millions form.
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    candidates.add(millions.toFixed(2));
    candidates.add(millions.toFixed(2).replace(".", ","));
    candidates.add(millions.toFixed(1));
    candidates.add(millions.toFixed(1).replace(".", ","));
    candidates.add(`${millions.toFixed(2)} million`);
    candidates.add(`${millions.toFixed(2).replace(".", ",")} million`);
    candidates.add(`${millions.toFixed(1).replace(".", ",")} million`);
    // Thousands-grouped with comma or space separator
    const grouped = value.toLocaleString("en-US");
    candidates.add(grouped);
    candidates.add(grouped.replace(/,/g, " "));
  }

  for (const c of candidates) {
    if (rawQuote.includes(c)) return true;
  }
  return false;
}

/**
 * Idempotent UPSERT of the `stats_sa` row in the `sources` table.
 * Mirrors R.14 ONS / R.18 IBGE pattern — a no-op on subsequent
 * runs. Allows cron deploys without a separate `npm run
 * seed:sources` re-run.
 */
async function ensureSourceRow(
  db: Db,
  log: (line: string) => void,
): Promise<boolean> {
  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.id, STATS_SA_SOURCE_ID))
    .limit(1);
  const wasMissing = existing.length === 0;

  await db
    .insert(sources)
    .values({
      id: STATS_SA_SOURCE_ID,
      name: "Statistics South Africa",
      baseUrl: STATS_SA_BASE_URL_SOURCES_FIELD,
      license: STATS_SA_LICENSE,
      isCommercialUseAllowed: true,
      lastSyncAt: null,
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        // Idempotent fields refresh — keeps `name`/`baseUrl`/`license`
        // in sync if the source-config drift across releases. Does NOT
        // touch `lastSyncAt`; that gets stamped at end-of-sync.
        name: "Statistics South Africa",
        baseUrl: STATS_SA_BASE_URL_SOURCES_FIELD,
        license: STATS_SA_LICENSE,
        isCommercialUseAllowed: true,
      },
    });

  if (wasMissing) {
    log(`  inserted new sources row: ${STATS_SA_SOURCE_ID}`);
  }
  return wasMissing;
}

/**
 * Compute the as_of date string from the extracted period
 * components. Mirrors the R.18 IBGE convention of using
 * "YYYY-01-01" for the cross-source freshness comparison anchor;
 * the actual reference period end is captured in the per-row
 * audit-trail payload.
 *
 * For mid-year-population (annual), we use mid-year (06-30) to
 * reflect the actual reference moment. For monthly/quarterly,
 * we use end-of-period.
 */
function deriveAsOf(
  config: StatsSaIndicatorConfig,
  ext: StatsSaExtraction,
): string {
  if (config.periodKind === "annual" && config.pCode === "P0302") {
    return `${ext.asOfYear}-06-30`;
  }
  if (config.periodKind === "monthly" && ext.asOfMonth !== null) {
    // End-of-month for the reference month.
    const m = String(ext.asOfMonth).padStart(2, "0");
    // Use last day of that month — month-end semantically anchors
    // monthly observations.
    const lastDay = new Date(Date.UTC(ext.asOfYear, ext.asOfMonth, 0))
      .getUTCDate();
    return `${ext.asOfYear}-${m}-${String(lastDay).padStart(2, "0")}`;
  }
  if (config.periodKind === "quarterly" && ext.asOfQuarter !== null) {
    // End-of-quarter month (3, 6, 9, 12), last day.
    const lastMonth = ext.asOfQuarter * 3;
    const m = String(lastMonth).padStart(2, "0");
    const lastDay = new Date(Date.UTC(ext.asOfYear, lastMonth, 0)).getUTCDate();
    return `${ext.asOfYear}-${m}-${String(lastDay).padStart(2, "0")}`;
  }
  // Fallback for unparsed period components — use Jan 1 of the
  // year (matches the R.18 IBGE convention).
  return `${ext.asOfYear}-01-01`;
}

/**
 * Run the Stats SA sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncStatsSa(
  db: Db,
  options: StatsSaSyncOptions = {},
): Promise<StatsSaSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = STATS_SA_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.pCode && c.pCode !== options.pCode) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: STATS_SA_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      sourceRowInserted: false,
      disputes: null,
      errors: ["no Stats SA indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Defensive sources-row upsert. Skip in dry-run to keep the
  // dry-run pass read-only against the DB.
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

  // Resolve the ZAF jurisdiction once. Single-country NSO scope.
  const jrows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.iso3, STATS_SA_TARGET_ISO3))
    .limit(1);
  const jurisdiction = jrows[0] ?? null;
  if (!jurisdiction) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: STATS_SA_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      sourceRowInserted,
      disputes: null,
      errors: [
        `South Africa jurisdiction (iso3='${STATS_SA_TARGET_ISO3}') not found — Phase R.7.0 backfill regression?`,
      ],
      dryRun: options.dryRun ?? false,
    };
  }
  log(
    `Resolved South Africa jurisdiction: ${jurisdiction.slug} (id=${jurisdiction.id}, iso2=${jurisdiction.iso2}, iso3=${jurisdiction.iso3}).`,
  );

  // Pre-flight: missing ANTHROPIC_API_KEY_RECONCILIATION should fail fast
  // rather than per-indicator. If unset, skip the whole sync gracefully.
  if (!process.env.ANTHROPIC_API_KEY_RECONCILIATION) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 1,
      vintageLabel: STATS_SA_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      sourceRowInserted,
      disputes: null,
      errors: [
        "ANTHROPIC_API_KEY_RECONCILIATION is not set — Stats SA sync requires the Anthropic SDK for PDF extraction. Aborting.",
      ],
      dryRun: options.dryRun ?? false,
    };
  }

  const counters = new Map<string, PerStatsSaCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.pCode));
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
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
        `unknown fact-key '${config.factKey}' for Stats SA ${config.pCode} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.pCode}) "${config.title}" — fetching latest PDF…`,
    );

    // 1. Fetch the latest available PDF (page-truncated if needed
    //    for the Anthropic SDK 100-page cap).
    const candidates = enumerateCandidateUrls(config, now);
    log(`  candidate URLs (${candidates.length}): trying newest first.`);
    const maxPages = config.maxPages ?? 30;
    const pdf = await fetchLatestPdf(candidates, maxPages, log);
    if (!pdf) {
      counter.rejected_no_pdf++;
      errors.push(
        `${config.pCode} ${config.factKey}: no candidate PDF returned 200 OK ` +
          `(tried ${candidates.length} URLs starting from ${candidates[0]})`,
      );
      continue;
    }
    counter.pdfUrl = pdf.url;
    counter.pdfStatus = pdf.status;
    counter.pdfBytes = pdf.bytes;

    // 2. Extract via Anthropic SDK. Failure → skip (Q5 contract).
    log(
      `  extracting via ${STATS_SA_EXTRACTION_MODEL} (tool-use, temp 0)…`,
    );
    const ext = await extractFromPdf(config, pdf, log);
    if (!ext) {
      counter.rejected_extraction++;
      errors.push(
        `${config.pCode} ${config.factKey}: Anthropic extraction failed (see logs)`,
      );
      continue;
    }
    log(
      `  extracted: value=${ext.value} period="${ext.asOfPeriodLabel}" ` +
        `(year=${ext.asOfYear} month=${ext.asOfMonth} q=${ext.asOfQuarter}) ` +
        `from "${ext.tableReference}"`,
    );
    counter.latestPeriodLabel = ext.asOfPeriodLabel;
    counter.rawQuote = ext.rawQuote;

    const transform = config.valueTransform ?? ((v: number) => v);
    const numericValue = transform(ext.value);

    // 3. Sanity range check (tighter than envelope; catches
    //    hallucinations).
    if (
      numericValue < config.sanityMin ||
      numericValue > config.sanityMax
    ) {
      counter.rejected_sanity++;
      errors.push(
        `${config.pCode} ${config.factKey}: SANITY REJECT — value ${numericValue} ` +
          `outside per-indicator range [${config.sanityMin}, ${config.sanityMax}]`,
      );
      log(
        `  EXTRACTION FAILURE: ${config.pCode} value ${numericValue} outside ` +
          `sanity range [${config.sanityMin}, ${config.sanityMax}] — skipping`,
      );
      continue;
    }

    // 4. Envelope check from `fact-keys.ts` (broader plausibility
    //    bound). Defensive — sanity range above is tighter.
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
          `${config.pCode} ${config.factKey}: ENVELOPE REJECT — value ${numericValue} ` +
            `outside [${min ?? "-∞"}, ${max ?? "+∞"}]`,
        );
        continue;
      }
    }

    // 5. Verbatim-quote substring check — catches hallucinations
    //    even when tool-use enforces JSON shape (the model could
    //    invent both the value AND a fake quote).
    if (!quoteContainsValue(numericValue, ext.rawQuote)) {
      counter.rejected_quote_mismatch++;
      errors.push(
        `${config.pCode} ${config.factKey}: QUOTE MISMATCH — value ${numericValue} ` +
          `not found in rawQuote="${ext.rawQuote.slice(0, 100)}…"`,
      );
      log(
        `  EXTRACTION FAILURE: ${config.pCode} value ${numericValue} not found ` +
          `in rawQuote — likely hallucination, skipping`,
      );
      continue;
    }

    counter.jurisdictions_with_value = 1;
    counter.pickedYear = ext.asOfYear;
    counter.pickedValue = numericValue;

    const factYear = ext.asOfYear;
    const asOf = deriveAsOf(config, ext);

    // Bug 1 forward policy — defensive year-based discriminator.
    // Stats SA publishes realised data; counter stays at 0 in
    // normal runs.
    const valueType: "measured" | "projected" =
      factYear > currentYear ? "projected" : "measured";
    if (factYear > currentYear) {
      counter.projection_rows++;
    }

    // Build upstream payload for snapshot dedup + audit trail.
    const upstreamPayload: Record<string, unknown> = {
      source: STATS_SA_SOURCE_ID,
      endpoint: pdf.url,
      iso2: jurisdiction.iso2,
      iso3: jurisdiction.iso3,
      pCode: config.pCode,
      periodKind: config.periodKind,
      year: factYear,
      asOfMonth: ext.asOfMonth,
      asOfQuarter: ext.asOfQuarter,
      rawValue: ext.value,
      transformedValue: numericValue,
      statsSaPeriodLabel: ext.asOfPeriodLabel,
      statsSaTableReference: ext.tableReference,
      statsSaRawQuote: ext.rawQuote,
      statsSaPdfBytes: pdf.bytes,
      statsSaPdfTotalPages: pdf.totalPages,
      statsSaPdfPagesSent: pdf.pagesSent,
      statsSaPdfTruncated: pdf.truncated,
      statsSaExtractionPromptVersion: STATS_SA_EXTRACTION_PROMPT_VERSION,
      statsSaExtractionModel: STATS_SA_EXTRACTION_MODEL,
      statsSaVintage: STATS_SA_VINTAGE,
    };
    // Mark the GDP methodology choice explicitly per resolution §2c.
    if (config.pCode === "P0441") {
      upstreamPayload.statsSaGrowthMethodology = "qoq_seasonally_adjusted";
    }
    const hash = payloadHash(upstreamPayload);

    // Per-row references payload. Mirrors R.18 IBGE / R.14 ONS shape
    // + adds Stats SA-specific fields for R.23 methodology-page
    // rendering. Multi-canonical-with-scope-predicate (NSO-for-its-
    // own-country) coexists with existing IMF/WB/UN/ILO/CIA
    // `'canonical'` tags for ZAF on the same fact-key; the Phase F
    // resolver remains freshness-driven; the NSO-priority-tier
    // patch (`nso-overrides.ts`, already shipped) ensures Stats SA
    // wins bit-exact-tied freshness for South Africa rows via
    // `isNsoForJurisdiction("stats_sa", "ZAF")`.
    const referencesPayload: Record<string, unknown>[] = [
      {
        url: pdf.url,
        allowlistTier: 2,
        allowlistName: "Statistics South Africa",
        civicaRole: config.civicaRole ?? "alternate",
        license: STATS_SA_LICENSE_CITATION,
        scopePredicate: STATS_SA_SCOPE_PREDICATE,
        statsSaPCode: config.pCode,
        statsSaPdfUrl: pdf.url,
        statsSaPeriodLabel: ext.asOfPeriodLabel,
        statsSaTableReference: ext.tableReference,
        statsSaRawQuote: ext.rawQuote,
        statsSaExtractionPromptVersion: STATS_SA_EXTRACTION_PROMPT_VERSION,
        statsSaExtractionModel: STATS_SA_EXTRACTION_MODEL,
      },
    ];
    if (config.pCode === "P0441") {
      referencesPayload[0].statsSaGrowthMethodology =
        "qoq_seasonally_adjusted";
    }

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
          sourceId: STATS_SA_SOURCE_ID,
          upstreamRef: `stats_sa:${jurisdiction.iso3}:${config.pCode}:${config.factKey}:${ext.asOfPeriodLabel}`,
          payloadHash: hash,
          payload: upstreamPayload as object,
          upstreamVintageLabel: STATS_SA_VINTAGE,
        })
        .onConflictDoNothing({
          target: [factSnapshots.sourceId, factSnapshots.payloadHash],
        });

      const snapshotIdRow = await db
        .select({ id: factSnapshots.id })
        .from(factSnapshots)
        .where(
          sql`${factSnapshots.sourceId} = ${STATS_SA_SOURCE_ID} AND ${factSnapshots.payloadHash} = ${hash}`,
        )
        .limit(1);
      const snapshotId = snapshotIdRow[0]?.id ?? null;

      await db
        .insert(countryFacts)
        .values({
          jurisdictionId: jurisdiction.id,
          factKey: config.factKey,
          factGroup: factKeyDef.group,
          category: factKeyDef.category,
          sourceId: STATS_SA_SOURCE_ID,
          sourceUrl: pdf.url,
          references: referencesPayload,
          sourceHash: hash,
          factValue: String(numericValue),
          factValueNumeric: numericValue,
          factUnit: factKeyDef.unit ?? null,
          factYear,
          valueJson: null,
          asOf,
          retrievedAt: new Date(),
          upstreamVintageLabel: STATS_SA_VINTAGE,
          methodologyVersion: "v0.1-beta",
          status: "active",
          statusReason: null,
          snapshotId,
          sourceNote: config.sourceNote ?? null,
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
          //
          // `sourceNote` IS included so future R.19 updates that
          // refine methodology notes land cleanly.
          set: {
            factValue: String(numericValue),
            factValueNumeric: numericValue,
            factUnit: factKeyDef.unit ?? null,
            factYear,
            asOf,
            sourceUrl: pdf.url,
            references: referencesPayload,
            sourceHash: hash,
            retrievedAt: new Date(),
            upstreamVintageLabel: STATS_SA_VINTAGE,
            snapshotId,
            sourceNote: config.sourceNote ?? null,
            valueType,
            updatedAt: new Date(),
          },
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
          ? ` [envelope rejects: ${counter.rejected_envelope}]`
          : "") +
        (counter.rejected_sanity
          ? ` [sanity rejects: ${counter.rejected_sanity}]`
          : "") +
        (counter.rejected_quote_mismatch
          ? ` [quote-mismatch rejects: ${counter.rejected_quote_mismatch}]`
          : "") +
        (counter.projection_rows
          ? ` [projections: ${counter.projection_rows}]`
          : ""),
    );
  }

  if (!options.dryRun) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, STATS_SA_SOURCE_ID));
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
  const countersByFactKey: Record<string, PerStatsSaCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: 1,
    vintageLabel: STATS_SA_VINTAGE,
    countersByFactKey,
    totalWritten,
    sourceRowInserted,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}

/**
 * Test-helper exports for `__tests__`. Internal helpers exposed to
 * keep the unit-test surface stable as the implementation evolves.
 */
export const __test = {
  buildPdfUrl,
  enumerateCandidateUrls,
  quoteContainsValue,
  deriveAsOf,
  STATS_SA_EXTRACTION_PROMPT_VERSION,
  STATS_SA_EXTRACTION_MODEL,
  STATS_SA_LICENSE,
  STATS_SA_LICENSE_CITATION,
};
