/**
 * Phase R.10 — ILO ILOSTAT sync orchestrator.
 *
 * Direct sync from the ILOSTAT public plumber-based API at
 * `https://rplumber.ilo.org/data/indicator`. Mirrors the F.6 / R.1 /
 * R.2 / R.3 / R.4 / R.5 / R.6 / R.7 pattern. Ingests 4 labour-market
 * indicators from the ILO Modelled Estimates database (ILOEST,
 * Nov. 2025 vintage):
 *
 *  1. Unemployment rate (`UNE_2EAP_SEX_AGE_RT_A`) → `unemployment_rate_pct`
 *     — ILO canonical (R.1 + R.2 explicit handoff).
 *  2. Labour force participation rate (`EAP_2WAP_SEX_AGE_RT_A`) →
 *     `labor_force_participation_rate_pct` (NEW fact-key).
 *  3. Employment-to-population ratio (`EMP_2WAP_SEX_AGE_RT_A`) →
 *     `employment_pop_ratio_pct` (NEW fact-key).
 *  4. Working poverty rate (`SDG_0111_SEX_AGE_RT_A`) →
 *     `working_poor_rate_pct` (NEW fact-key).
 *
 * Key architectural notes:
 *   - ILOSTAT publishes both nationally-reported survey series (LFS:
 *     `UNE_DEAP_*`) and harmonised model-imputed series (ILOEST:
 *     `UNE_2EAP_*`). R.10 ships ILOEST per the resolution: WB's
 *     `SL.UEM.TOTL.ZS` is itself an ILOEST republication, so citing
 *     ILOEST upstream is methodologically cleaner. LFS is deferred
 *     to v1.1 per resolution §6 Q6.
 *   - The ILOEST series ships **explicit projection-year rows**
 *     (currently 2025–2027 in the Nov. 2025 vintage). Per the refined
 *     Bug 1 Q4 (master plan updated 2026-05-04), rows whose `factYear
 *     > currentYear` get `value_type='projected'`; everything else
 *     (including `obs_status='I'` imputation rows for low-survey-
 *     coverage countries) gets `value_type='measured'`. The resolver
 *     naturally excludes `'projected'` rows from canonical when any
 *     measured row exists for the same `(jurisdiction, fact-key)`.
 *   - `ref_area` codes returned by ILO are literal ISO3 codes for
 *     sovereign states (ARG, BRA, USA, DEU, NGA…) plus aggregate
 *     codes prefixed with `X` (X64, X88, X90…). The
 *     `iso3ToJurisdiction.get(iso3)` miss-path drops the X-prefixed
 *     aggregates same as the WB / IMF / UN sync pattern.
 *   - ILO returns CSV by default; we parse with a small line-by-line
 *     reader (no extra dependency). Fields are `ref_area`, `source`
 *     (ILO internal source ID like `XA:1868`), `indicator`, `sex`,
 *     `classif1`, `time` (year), `obs_value`, `obs_status` (R=Real,
 *     I=Imputation, M=Model-based extrapolation, A=Adjusted, blank=
 *     projection) and possibly extra `note_*` columns.
 *   - Vintage label is derived per-database from the indicator TOC
 *     (`/metadata/toc/indicator`) at sync startup.
 *
 * The Phase F resolver picks between ILO and WB / CIA / Wikidata /
 * IMF per methodology §3.3 — material-error guard + freshness
 * preference WITH Bug 1's `value_type` partition (any `measured` row
 * beats all `projected` rows). The `civicaRole` field on each
 * indicator config is informational only (NOT used by the resolver);
 * it persists into the fact row's `references[].civicaRole` so the
 * methodology page rewrite (Phase R.23) can render canonical-vs-
 * alternate without a separate lookup.
 *
 * R.1 (`SL.UEM.TOTL.ZS`) and R.2 (`LUR`) both pre-tagged their
 * `unemployment_rate_pct` rows as `civicaRole: 'alternate'` in
 * anticipation of R.10 inheriting canonical. R.10 writes ILO rows
 * tagged `civicaRole: 'canonical'`; the existing pre-tagged
 * alternates flip semantics naturally without re-syncing WB/IMF.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.10
 * Resolution:  ~/civica/plan/ilo-ilostat-resolution-v1.md
 * Bug 1:       ~/civica/plan/forecast-vs-measurement-v1.md (refined
 *              Q4 — year-based discriminator for ILO modelled
 *              imputation vs. modelled projection)
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

const ILO_BASE_URL = "https://rplumber.ilo.org";
const ILO_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Fallback vintage label when the live `/metadata/toc/indicator`
 * fetch fails. The sync reads the per-indicator `database` column from
 * the TOC at startup and prefers a derived label; this is just a
 * safety net.
 *
 * Pattern: "ILO ILOEST <Month> YYYY" for ILO modelled estimates,
 * "ILO SDG <Year>" for the SDG-suite indicators. The Nov. 2025 ILOEST
 * vintage is the current cycle as of 2026-05-04. Updates each November
 * when ILO releases a new vintage.
 */
const ILOEST_VINTAGE_FALLBACK = "ILO ILOEST Nov 2025";
const ILOSDG_VINTAGE_FALLBACK = "ILO SDG Labour Market Indicators 2026";

/**
 * One ILO indicator we care about. Each entry maps an upstream ILOSTAT
 * indicator code to a Civica fact-key. The optional `valueTransform`
 * lets us reshape upstream units to fact-key units (identity for all
 * 4 R.10 indicators — ILO ships `%`, our keys also `%`).
 */
export interface IloIndicatorConfig {
  /** ILOSTAT indicator id (e.g. "UNE_2EAP_SEX_AGE_RT_A"). */
  iloCode: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw ILO value before envelope check
   *  and write. Default 1 — used when the ILO unit matches the
   *  fact-key unit verbatim (% stays %). */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this ILO indicator. Defaults to
   *  `'alternate'` when omitted. Persisted into the row's
   *  `references[].civicaRole`. Per
   *  `~/civica/plan/ilo-ilostat-resolution-v1.md` §2d. */
  civicaRole?: CivicaSourceRole;
  /** Filter dim — sex code. Headline indicators use SEX_T (total). */
  sex: string;
  /** Filter dim — age aggregation. Headline indicators use
   *  AGE_YTHADULT_YGE15 (working-age population 15+). Some SDG
   *  series may use a different age coding; verified per indicator
   *  during R.10 investigation. */
  classif1: string;
  /** ILO database column from the TOC (e.g. "ILOEST", "ILOSDG").
   *  Determines the per-indicator vintage label. */
  database: "ILOEST" | "ILOSDG";
}

export const ILO_ILOSTAT_INDICATORS: readonly IloIndicatorConfig[] = [
  // ─── Unemployment rate — ILO inherits canonical from R.1 + R.2
  //     explicit handoff. ───
  {
    iloCode: "UNE_2EAP_SEX_AGE_RT_A",
    factKey: "unemployment_rate_pct",
    label: "Unemployment rate (ILO modelled estimates)",
    docUrl: "https://ilostat.ilo.org/topics/unemployment-and-labour-underutilization/",
    sex: "SEX_T",
    classif1: "AGE_YTHADULT_YGE15",
    database: "ILOEST",
    // R.1 (`SL.UEM.TOTL.ZS`) and R.2 (`LUR`) pre-tagged their rows as
    // `civicaRole: 'alternate'` in anticipation of R.10 inheriting
    // canonical. ILO is the upstream that WB itself republishes
    // (verified bit-equality for Argentina 2024: WB 7.145% = ILO
    // 7.145%). Methodology: the resolver still picks per row by
    // freshness; the canonical tag is editorial attribution.
    civicaRole: "canonical",
  },

  // ─── Labour force participation rate — NEW fact-key, ILO single-
  //     source canonical at ship time. ───
  {
    iloCode: "EAP_2WAP_SEX_AGE_RT_A",
    factKey: "labor_force_participation_rate_pct",
    label: "Labour force participation rate (ILO modelled estimates)",
    docUrl: "https://ilostat.ilo.org/topics/population-and-labour-force/",
    sex: "SEX_T",
    classif1: "AGE_YTHADULT_YGE15",
    database: "ILOEST",
    civicaRole: "canonical",
  },

  // ─── Employment-to-population ratio — NEW fact-key, ILO single-
  //     source canonical at ship time. ───
  {
    iloCode: "EMP_2WAP_SEX_AGE_RT_A",
    factKey: "employment_pop_ratio_pct",
    label: "Employment-to-population ratio (ILO modelled estimates)",
    docUrl: "https://ilostat.ilo.org/topics/employment/",
    sex: "SEX_T",
    classif1: "AGE_YTHADULT_YGE15",
    database: "ILOEST",
    civicaRole: "canonical",
  },

  // ─── Working poverty rate (SDG 1.1.1) — NEW fact-key, ILO is the
  //     SDG custodian agency for indicator 1.1.1. ───
  {
    iloCode: "SDG_0111_SEX_AGE_RT_A",
    factKey: "working_poor_rate_pct",
    label: "Working poverty rate (SDG indicator 1.1.1)",
    docUrl: "https://ilostat.ilo.org/topics/working-poor/",
    sex: "SEX_T",
    classif1: "AGE_YTHADULT_YGE15",
    database: "ILOSDG",
    civicaRole: "canonical",
  },
];

/** ILO TOC row (subset — only fields the sync needs). */
interface IloIndicatorTocRow {
  /** Indicator id, e.g. "UNE_2EAP_SEX_AGE_RT_A". */
  id: string;
  /** Indicator base code without frequency suffix. */
  indicator: string;
  /** Indicator label. */
  indicatorLabel: string;
  /** Last-update timestamp string from the TOC, e.g. "02/12/2025 16:36:06". */
  lastUpdate: string;
  /** Database code, e.g. "ILOEST" / "ILOSDG" / "LFS". */
  database: string;
}

/** Parsed ILO data CSV row. */
interface IloDataRow {
  refArea: string;
  /** ILO internal source ID, e.g. "XA:1868" (ILOEST) or "BA:150"
   *  (Argentina household survey). Persisted as forensic metadata. */
  source: string;
  indicator: string;
  sex: string;
  classif1: string;
  time: number;
  obsValue: number;
  obsStatus: string | null;
}

export interface PerIloCounters {
  factKey: string;
  iloCode: string;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  skipped_no_iso3: number;
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
  /** Counter for projection-year rows landed (factYear > current
   *  calendar year). Tagged `value_type='projected'`. */
  projection_rows: number;
  /** Counter for imputation rows landed (`obs_status='I'`). Tagged
   *  `value_type='measured'` per refined Bug 1 Q4 — model-imputed
   *  measurements ARE measurements. */
  imputation_rows: number;
}

export interface IloSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  /** Vintage labels keyed by database ("ILOEST" / "ILOSDG"). */
  vintageLabels: Record<string, string>;
  countersByFactKey: Record<string, PerIloCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface IloSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific ILO indicator code (for testing). */
  iloCode?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(factKey: string, iloCode: string): PerIloCounters {
  return {
    factKey,
    iloCode,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_no_iso3: 0,
    skipped_no_jurisdiction: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    projection_rows: 0,
    imputation_rows: 0,
  };
}

/**
 * Minimal CSV reader. ILO CSV uses `"`-quoted fields (sometimes empty)
 * and may include extra `note_*` columns. We extract by named header
 * lookup so the reader is resilient to ordering.
 */
function parseCsv(body: string): { headers: string[]; rows: string[][] } {
  // Strip BOM if present.
  const text = body.replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    rows.push(parseCsvLine(line));
  }
  return { headers, rows };
}

/**
 * Single-line CSV parse with `"`-quoted-field handling. ILO CSV does
 * NOT contain embedded newlines in quoted fields (verified across all
 * 4 indicator probes), so a per-line scan is safe.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        buf += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        out.push(buf);
        buf = "";
      } else {
        buf += c;
      }
    }
  }
  out.push(buf);
  return out;
}

/**
 * Fetch the ILO indicator TOC (`/metadata/toc/indicator`) and return a
 * map of `iloCode → { lastUpdate, database, indicatorLabel }`. Used at
 * sync startup to derive vintage labels per indicator.
 *
 * If the TOC fetch fails, the caller falls back to the
 * `ILOEST_VINTAGE_FALLBACK` / `ILOSDG_VINTAGE_FALLBACK` constants.
 */
async function fetchIndicatorToc(): Promise<Map<string, IloIndicatorTocRow>> {
  const url = `${ILO_BASE_URL}/metadata/toc/indicator?lang=en&format=.csv`;
  const res = await fetch(url, {
    headers: { "User-Agent": ILO_USER_AGENT, Accept: "text/csv" },
  });
  if (!res.ok) {
    throw new Error(`ILO TOC: ${res.status} ${res.statusText}`);
  }
  const body = await res.text();
  const { headers, rows } = parseCsv(body);
  const idIdx = headers.indexOf("id");
  const indicatorIdx = headers.indexOf("indicator");
  const labelIdx = headers.indexOf("indicator.label");
  const lastUpdateIdx = headers.indexOf("last.update");
  const databaseIdx = headers.indexOf("database");
  if (
    idIdx < 0 ||
    indicatorIdx < 0 ||
    lastUpdateIdx < 0 ||
    databaseIdx < 0
  ) {
    throw new Error(
      `ILO TOC: missing expected headers (got ${headers.join(",")})`,
    );
  }
  const out = new Map<string, IloIndicatorTocRow>();
  for (const r of rows) {
    if (r.length <= idIdx) continue;
    const id = r[idIdx];
    if (!id) continue;
    out.set(id, {
      id,
      indicator: r[indicatorIdx] ?? "",
      indicatorLabel: labelIdx >= 0 ? (r[labelIdx] ?? "") : "",
      lastUpdate: r[lastUpdateIdx] ?? "",
      database: r[databaseIdx] ?? "",
    });
  }
  return out;
}

/**
 * Derive a Civica vintage label for an ILO indicator. Uses the
 * indicator label (which often contains the vintage e.g. "ILO modelled
 * estimates, Nov. 2025") with a fallback to the database constant.
 */
function deriveVintageLabel(
  toc: IloIndicatorTocRow | undefined,
  database: "ILOEST" | "ILOSDG",
): string {
  if (toc?.indicatorLabel) {
    // ILOEST labels look like "Unemployment rate by sex and age — ILO
    // modelled estimates, Nov. 2025 (%)". Extract "Nov. 2025" or
    // similar.
    const m = toc.indicatorLabel.match(
      /modelled estimates,\s*([A-Za-z]+\.?\s+\d{4})/i,
    );
    if (m) return `ILO ILOEST ${m[1].replace(/\.+$/, "")}`;
  }
  if (database === "ILOEST") return ILOEST_VINTAGE_FALLBACK;
  return ILOSDG_VINTAGE_FALLBACK;
}

/**
 * Fetch all observations for an ILO indicator at the configured
 * `sex` + `classif1` filters with `latestyear=TRUE` (one row per
 * country, the most-recent year ILO publishes — typically the
 * projection horizon for ILOEST series, or the most-recent
 * historical year for SDG series).
 *
 * Returns an array of typed `IloDataRow`. ~150–200KB CSV per
 * indicator at this filter; ~280 rows.
 */
async function fetchIndicator(
  config: IloIndicatorConfig,
): Promise<IloDataRow[]> {
  const params = new URLSearchParams({
    id: config.iloCode,
    sex: config.sex,
    classif1: config.classif1,
    latestyear: "TRUE",
    format: ".csv",
  });
  const url = `${ILO_BASE_URL}/data/indicator?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": ILO_USER_AGENT, Accept: "text/csv" },
  });
  if (!res.ok) {
    throw new Error(
      `ILO ${config.iloCode}: ${res.status} ${res.statusText}`,
    );
  }
  const body = await res.text();
  const { headers, rows } = parseCsv(body);
  const refAreaIdx = headers.indexOf("ref_area");
  const sourceIdx = headers.indexOf("source");
  const indicatorIdx = headers.indexOf("indicator");
  const sexIdx = headers.indexOf("sex");
  const classif1Idx = headers.indexOf("classif1");
  const timeIdx = headers.indexOf("time");
  const obsValueIdx = headers.indexOf("obs_value");
  const obsStatusIdx = headers.indexOf("obs_status");
  if (
    refAreaIdx < 0 ||
    sourceIdx < 0 ||
    indicatorIdx < 0 ||
    timeIdx < 0 ||
    obsValueIdx < 0
  ) {
    throw new Error(
      `ILO ${config.iloCode}: missing expected headers (got ${headers.join(",")})`,
    );
  }
  const out: IloDataRow[] = [];
  for (const r of rows) {
    if (r.length <= obsValueIdx) continue;
    const time = parseInt(r[timeIdx] ?? "", 10);
    const value = parseFloat(r[obsValueIdx] ?? "");
    if (!Number.isFinite(time) || !Number.isFinite(value)) continue;
    out.push({
      refArea: (r[refAreaIdx] ?? "").toUpperCase(),
      source: r[sourceIdx] ?? "",
      indicator: r[indicatorIdx] ?? "",
      sex: sexIdx >= 0 ? (r[sexIdx] ?? "") : "",
      classif1: classif1Idx >= 0 ? (r[classif1Idx] ?? "") : "",
      time,
      obsValue: value,
      obsStatus:
        obsStatusIdx >= 0 ? (r[obsStatusIdx] || null) : null,
    });
  }
  return out;
}

/**
 * Run the ILO ILOSTAT sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncIloIlostat(
  db: Db,
  options: IloSyncOptions = {},
): Promise<IloSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = ILO_ILOSTAT_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.iloCode && c.iloCode !== options.iloCode) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabels: {},
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no ILO ILOSTAT indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Discover live vintage labels per database from the TOC.
  // Falls back to constants if the TOC fetch fails.
  const vintageLabels: Record<string, string> = {
    ILOEST: ILOEST_VINTAGE_FALLBACK,
    ILOSDG: ILOSDG_VINTAGE_FALLBACK,
  };
  let toc: Map<string, IloIndicatorTocRow> | null = null;
  try {
    toc = await fetchIndicatorToc();
    log(`ILO TOC loaded (${toc.size} indicators)`);
    for (const t of targets) {
      const tocRow = toc.get(t.iloCode);
      const label = deriveVintageLabel(tocRow, t.database);
      vintageLabels[t.database] = label;
    }
    log(`Vintage labels: ${JSON.stringify(vintageLabels)}`);
  } catch (err) {
    errors.push(
      `vintage discovery failed (using fallbacks): ${
        err instanceof Error ? err.message : err
      }`,
    );
    log(`Vintage discovery failed; using fallbacks ${JSON.stringify(vintageLabels)}`);
  }

  // Build iso3 → jurisdictionId map once; reused across all indicators.
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
  log(`${allJurisdictions.length} jurisdictions with ISO3 codes loaded.`);

  const counters = new Map<string, PerIloCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.iloCode));
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
        `unknown fact-key '${config.factKey}' for ILO ${config.iloCode} (registry mismatch)`,
      );
      continue;
    }

    const vintageLabel = vintageLabels[config.database] ??
      (config.database === "ILOEST"
        ? ILOEST_VINTAGE_FALLBACK
        : ILOSDG_VINTAGE_FALLBACK);

    log(
      `→ ${config.factKey} (${config.iloCode}) "${config.label}" — fetching latestyear=TRUE…`,
    );

    let rows: IloDataRow[];
    try {
      rows = await fetchIndicator(config);
    } catch (err) {
      errors.push(
        `${config.iloCode} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    counter.observations = rows.length;
    log(`  fetched ${rows.length} latest-year observations`);

    // ILO returns one row per ref_area at latestyear=TRUE; no
    // pickLatest step needed unless the API changes. We still
    // dedup by ref_area defensively.
    const byIso3 = new Map<string, IloDataRow>();
    for (const r of rows) {
      if (!r.refArea || r.refArea.length !== 3) continue;
      const existing = byIso3.get(r.refArea);
      if (!existing || r.time > existing.time) {
        byIso3.set(r.refArea, r);
      }
    }
    counter.jurisdictions_with_value = byIso3.size;

    for (const [iso3, dp] of byIso3) {
      const j = iso3ToJurisdiction.get(iso3);
      if (!j) {
        counter.skipped_no_jurisdiction++;
        continue;
      }

      const transform = config.valueTransform ?? ((v: number) => v);
      const numericValue = transform(dp.obsValue);

      // Plausibility envelope per fact-key registry §3.6.
      // R.1.1 fix: when isPercent is true, the [-1, 101] range is only a
      // fallback for fact-keys that do not declare their own min/max.
      // Mirrored from `sync-wdi.ts` / `sync-imf-weo.ts`.
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

      const factYear = dp.time;
      const asOf = `${factYear}-01-01`;

      // Bug 1 (refined Q4) — value-type discriminator.
      //
      // Year-based rule, mirrors IMF WEO:
      //   - factYear > currentYear  → 'projected' (model nowcast for
      //     future year; e.g. ILOEST 2027 projection rows in the
      //     Nov. 2025 vintage)
      //   - factYear ≤ currentYear  → 'measured' (includes ILOEST
      //     imputation rows tagged obs_status='I' for low-survey-
      //     coverage countries — model-imputed measurements ARE
      //     measurements per Bug 1 Q4 spirit)
      //
      // See ~/civica/plan/ilo-ilostat-resolution-v1.md §2e and the
      // refined ~/civica/plan/forecast-vs-measurement-v1.md Q4.
      const valueType: "measured" | "projected" =
        factYear > currentYear ? "projected" : "measured";
      if (factYear > currentYear) {
        counter.projection_rows++;
      }
      if (dp.obsStatus === "I") {
        counter.imputation_rows++;
      }

      const upstreamPayload = {
        source: "ilo_ilostat",
        endpoint: `${ILO_BASE_URL}/data/indicator?id=${config.iloCode}&ref_area=${j.iso3}&sex=${config.sex}&classif1=${config.classif1}`,
        iso3: j.iso3,
        iloCode: config.iloCode,
        iloIndicator: dp.indicator,
        iloSourceId: dp.source,
        iloSex: dp.sex,
        iloClassif1: dp.classif1,
        year: factYear,
        rawValue: dp.obsValue,
        transformedValue: numericValue,
        obsStatus: dp.obsStatus,
        iloVintage: vintageLabel,
        iloDatabase: config.database,
      };
      const hash = payloadHash(upstreamPayload);

      // R.10 §6 Q5: persist `obs_status` and ILO internal source ID
      // (e.g. "XA:1868") on the row's references payload as
      // `iloMeta`. Lets the SourceDot tooltip surface
      // "ILO modelled estimate (imputation)" vs "...real value" at
      // R.23.
      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "ILO ILOSTAT",
          // Civica's canonical/alternate editorial role for this
          // (source, fact-key) pair. Default 'alternate' when omitted
          // on the indicator config. See
          // `~/civica/plan/ilo-ilostat-resolution-v1.md` §2d.
          civicaRole: config.civicaRole ?? "alternate",
          iloMeta: {
            obsStatus: dp.obsStatus,
            sourceId: dp.source,
            indicator: dp.indicator,
            database: config.database,
            sex: dp.sex,
            classif1: dp.classif1,
          },
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${factYear}, ${valueType}, obs=${dp.obsStatus ?? "·"})`,
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
            sourceId: "ilo_ilostat",
            upstreamRef: `ilo:${j.iso3}:${config.iloCode}:${factYear}`,
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
            sql`${factSnapshots.sourceId} = 'ilo_ilostat' AND ${factSnapshots.payloadHash} = ${hash}`,
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
            sourceId: "ilo_ilostat",
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
            // Bug 1 — `valueType` IS included in the set clause.
            // As the calendar year advances, ILO rows that were
            // projections become measurements (e.g. a 2026 row
            // written in 2026 is a projection in the 2026 sync run
            // and would be a measurement in the 2027 sync run).
            // Re-sync must reflect the current year-vs-fact_year
            // relationship.
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
        `(projections: ${counter.projection_rows}, ` +
        `imputations: ${counter.imputation_rows}, ` +
        `envelope rejects: ${counter.rejected_envelope}, ` +
        `unmatched ISO3: ${counter.skipped_no_jurisdiction})`,
    );
  }

  await markSourcesSynced("ilo_ilostat", {
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
  const countersByFactKey: Record<string, PerIloCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    vintageLabels,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
