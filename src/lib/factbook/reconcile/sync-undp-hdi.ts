/**
 * Phase R.6 — UNDP Human Development Report (HDR) sync orchestrator.
 *
 * Direct sync from UNDP's Human Development Report 2025 bulk-download
 * CSV at `https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv`.
 * Mirrors the F.6 / R.1 / R.2 / R.4 sync-orchestrator pattern at
 * `sync-wdi.ts`, `sync-imf-weo.ts`, `sync-who-gho.ts`. Ingests 6
 * indicators from the wide-format CSV (HDI score, HDI rank, GNI per
 * capita PPP, life expectancy, expected years of schooling, mean
 * years of schooling), 5 of which write to **newly-declared Civica
 * fact-keys** introduced in the same R.6 commit:
 *   - `hdi`           → `hdi_score`               (canonical, NEW)
 *   - `hdi_rank_2023` → `hdi_rank`                (canonical, NEW)
 *   - `gnipc`         → `gni_per_capita_ppp_usd`  (alternate, NEW)
 *   - `le`            → `life_expectancy_years`   (alternate; WHO canonical via R.4)
 *   - `eys`           → `expected_years_schooling` (canonical-for-now, NEW; flips to UNESCO at R.7.5)
 *   - `mys`           → `mean_years_schooling`     (canonical-for-now, NEW; flips to UNESCO at R.7.5)
 *
 * Key architectural differences from `sync-wdi.ts` / `sync-who-gho.ts`:
 *   - UNDP ships a **single 1.9 MB wide-format CSV** rather than a
 *     paginated REST API. The sync downloads the file once, parses it
 *     with a small quote-aware reader (country names like "Hong Kong,
 *     China (SAR)" and "Korea, Republic of" embed commas in
 *     double-quoted fields), then iterates configured indicators
 *     against the in-memory rows.
 *   - UNDP HDR ships ~annually in spring; the URL embeds the report
 *     year (`HDR25_*`). When HDR 2026 ships (expected mid-2026), the
 *     URL constant + vintage label both bump in lockstep via a
 *     methodology v1.1 update. See
 *     `~/civica/plan/undp-hdi-resolution-v1.md` §2j + §6 Q5.
 *   - The 5 new fact-keys land in `fact-keys.ts` in the same R.6
 *     commit (per the user's explicit "bend the no-new-fact-keys
 *     rule" decision — HDI is domain-introducing, not a domain-
 *     extension). See resolution §1, §2e, §6 Q4.
 *
 * The Phase F resolver picks between UNDP and WHO / WB / CIA /
 * Wikidata per methodology §3.3 — material-error guard + freshness
 * preference. The `civicaRole` field on each indicator config is
 * informational only (NOT used by the resolver); it persists into
 * the fact row's `references[].civicaRole` payload so the methodology
 * page rewrite (Phase R.23) can render canonical-vs-alternate without
 * a separate lookup. See `~/civica/plan/undp-hdi-resolution-v1.md`
 * §2m.
 *
 * UNDP is **canonical-by-construction** for the HDI composite + rank
 * (no other publisher computes them). UNDP is alternate for life
 * expectancy (WHO canonical via R.4) and for GNI per capita
 * (distinct fact-key from `gdp_per_capita_usd`). UNDP is canonical-
 * for-now for `expected_years_schooling` and `mean_years_schooling`,
 * with a documented flip-to-alternate plan when the R.7.5 fact-key
 * registry expansion phase wires UNESCO direct-sync for these keys.
 *
 * License: UNDP HDR data is published under CC-BY-3.0-IGO (commercial
 * use OK with attribution; no NC clause; no SA clause). Each row's
 * references payload carries `license: 'CC-BY-3.0-IGO'` for forward-
 * compatibility with R.4's license-aware infrastructure plans, but
 * UNDP rows do NOT need the same commercial-monetization filter that
 * WHO rows do. See `~/civica/plan/undp-hdi-resolution-v1.md` §2i.
 *
 * Replaces the legacy prototype at `scripts/sync-undp-hdi.ts` (which
 * wrote 55 hardcoded reference rows to the dormant `country_metrics`
 * legacy table; deleted in the same R.6 commit per resolution §2f).
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.6
 * Resolution:  ~/civica/plan/undp-hdi-resolution-v1.md
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
import type { CivicaSourceRole } from "./sync-wdi";

type Db = typeof import("@/lib/db").db;

/**
 * UNDP HDR 2025 bulk-download CSV. The URL embeds the report year
 * — when HDR 2026 ships (expected mid-2026), both this constant
 * and `UNDP_HDR_VINTAGE` bump together via a methodology v1.1
 * update. See `~/civica/plan/undp-hdi-resolution-v1.md` §2j + §6 Q5.
 *
 * Verified live 2026-05-04: 1.9 MB, 207 rows (1 header + 195
 * country ISO3 + 11 regional aggregates with `ZZA.*` codes), 1,112
 * columns covering 32 indicator families × up to 34 years
 * (1990–2023).
 */
const UNDP_CSV_URL =
  "https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv";

const UNDP_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

const UNDP_HDR_VINTAGE = "UNDP HDR 2025";

/**
 * UNDP HDR data is published under CC-BY-3.0-IGO (commercial use
 * OK with attribution; no NC clause; no SA clause). Per-row
 * metadata for forward-compatibility with R.4's license-aware
 * filter infrastructure. UNDP-licensed rows do NOT need the
 * non-commercial filter that WHO rows trigger. See
 * `~/civica/plan/undp-hdi-resolution-v1.md` §2i.
 */
const UNDP_HDR_LICENSE = "CC-BY-3.0-IGO";

/**
 * The reference year UNDP's most recent vintage covers.
 * HDR 2025 covers data through 2023. When HDR 2026 ships,
 * bump this to 2024 alongside the URL/vintage rotation.
 */
const UNDP_LATEST_YEAR = 2023;

/**
 * One UNDP HDR indicator we care about. Each entry maps a CSV
 * column name to a Civica fact-key. The CSV is wide-format: each
 * row is one country, columns of the form `<indicator>_<year>`
 * (e.g. `hdi_2023`, `gnipc_2023`) carry the data. R.6 always
 * reads the latest-year column per the F.6 / R.1 / R.2 / R.4
 * "newest year wins" convention.
 *
 * `hdi_rank` is a special case — it is published in the CSV as a
 * single column `hdi_rank_2023` (no historical series), so the
 * `csvColumn` is set explicitly to that literal rather than being
 * derived from the latest-year template.
 */
export interface UndpHdiIndicatorConfig {
  /** UNDP indicator code prefix — e.g. `"hdi"` reads `hdi_2023`. */
  undpCode: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw CSV value before envelope check
   *  and write. Default 1 — used when the UNDP unit matches the
   *  fact-key unit verbatim (years stay years; index stays index). */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this UNDP indicator. Default
   *  `'alternate'` when omitted. Persisted into the row's
   *  `references[].civicaRole` so the methodology page rewrite
   *  (R.23) can render canonical-vs-alternate without a separate
   *  lookup. Per `~/civica/plan/undp-hdi-resolution-v1.md` §2m. */
   civicaRole?: CivicaSourceRole;
  /** Optional explicit CSV column name. Used for `hdi_rank` which
   *  is published only at the latest year (no `hdi_rank_1990`,
   *  `hdi_rank_1991`, etc. — only `hdi_rank_2023`). When omitted,
   *  the column is computed as `${undpCode}_${UNDP_LATEST_YEAR}`. */
  csvColumnOverride?: string;
  /** Optional explicit fact year. Used when the column does not
   *  carry a year suffix (currently unused; reserved for future
   *  composite fields where the UNDP-published year may differ). */
  factYearOverride?: number;
}

export const UNDP_HDI_INDICATORS: readonly UndpHdiIndicatorConfig[] = [
  // ─── R.6 ship list (6 indicators) — see resolution §2c. ───
  // HDI composite — UNDP's flagship index. Sole publisher; canonical
  // by construction. Spot-checks (2023 vintage): USA 0.938, Norway
  // 0.97, Brazil 0.78, Niger 0.419.
  {
    undpCode: "hdi",
    factKey: "hdi_score",
    label: "Human Development Index (HDI)",
    docUrl: "https://hdr.undp.org/data-center/human-development-index",
    civicaRole: "canonical",
  },

  // HDI rank — single-year column. Sole publisher; canonical by
  // construction. Spot-checks (2023): USA #17, Norway #2, Brazil
  // #84, Niger #188.
  {
    undpCode: "hdi_rank",
    factKey: "hdi_rank",
    label: "HDI rank (UNDP)",
    docUrl: "https://hdr.undp.org/data-center/human-development-index",
    civicaRole: "canonical",
    csvColumnOverride: "hdi_rank_2023",
  },

  // GNI per capita, PPP (constant 2017 international $). UNDP's
  // methodology differs from WB's `NY.GDP.PCAP.PP.CD` (current PPP);
  // distinct fact-key, no double-write conflict. UNDP is alternate
  // because WB is canonical for the conceptual neighbour
  // `gdp_per_capita_usd`. Spot-checks (2023): USA $73,650,
  // Norway $112,710, Niger $1,590.
  {
    undpCode: "gnipc",
    factKey: "gni_per_capita_ppp_usd",
    label: "GNI per capita (PPP, constant 2017 international $)",
    docUrl: "https://hdr.undp.org/data-center/composite-indices",
    civicaRole: "alternate",
  },

  // Life expectancy at birth — UNDP republishes UN WPP / WHO data.
  // R.4 made WHO canonical for `life_expectancy_years`; UNDP joins
  // as a 5th source (CIA + Wikidata + WB + WHO + UN + UNDP = 6
  // total). Spot-checks (2023): USA 79.30, Norway 83.31, Niger 61.18.
  {
    undpCode: "le",
    factKey: "life_expectancy_years",
    label: "Life expectancy at birth (UNDP HDR)",
    docUrl: "https://hdr.undp.org/data-center/composite-indices",
    civicaRole: "alternate",
  },

  // Expected years of schooling. UNDP canonical-for-now; the
  // R.7.5 fact-key registry expansion phase will wire UNESCO
  // direct-sync, at which point UNDP flips to alternate via a
  // methodology v1.1 update (no code churn beyond the civicaRole
  // flag). Spot-checks (2023): USA 15.92, Norway 18.79, Niger 8.31.
  {
    undpCode: "eys",
    factKey: "expected_years_schooling",
    label: "Expected years of schooling",
    docUrl: "https://hdr.undp.org/data-center/composite-indices",
    civicaRole: "canonical",
  },

  // Mean years of schooling (adults 25+). Same R.7.5 flip plan as
  // expected_years_schooling. Spot-checks (2023): USA 13.91,
  // Norway 13.12, Niger 1.41.
  {
    undpCode: "mys",
    factKey: "mean_years_schooling",
    label: "Mean years of schooling (adults 25+)",
    docUrl: "https://hdr.undp.org/data-center/composite-indices",
    civicaRole: "canonical",
  },
];

export interface PerUndpCounters {
  factKey: string;
  undpCode: string;
  csvColumn: string;
  rowsScanned: number;
  jurisdictions_with_value: number;
  written: number;
  skipped_no_iso3: number;
  skipped_no_jurisdiction: number;
  skipped_aggregate: number;
  rejected_envelope: number;
  rejected_no_value: number;
}

export interface UndpHdiSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  /** Total ISO3 rows in the CSV (excludes regional aggregates with
   *  `ZZA.*` prefix codes). Diagnostic — should be ~195 for
   *  HDR 2025. */
  csvCountryRows: number;
  /** Vintage label used for all R.6 rows. Currently the constant
   *  `UNDP_HDR_VINTAGE` (`UNDP HDR 2025`); future HDR 2026 release
   *  bumps this in lockstep with the URL constant. */
  vintageLabel: string;
  countersByFactKey: Record<string, PerUndpCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface UndpHdiSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific UNDP indicator code (for testing). */
  undpCode?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(
  factKey: string,
  undpCode: string,
  csvColumn: string,
): PerUndpCounters {
  return {
    factKey,
    undpCode,
    csvColumn,
    rowsScanned: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_no_iso3: 0,
    skipped_no_jurisdiction: 0,
    skipped_aggregate: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
  };
}

function payloadHash(payload: object): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/**
 * Resolve the actual CSV column name for an indicator. Most
 * indicators read `${undpCode}_${UNDP_LATEST_YEAR}` (e.g.
 * `hdi_2023`); `hdi_rank` overrides with the explicit
 * `hdi_rank_2023` literal because no historical series exists.
 */
function resolveCsvColumn(config: UndpHdiIndicatorConfig): string {
  if (config.csvColumnOverride) return config.csvColumnOverride;
  return `${config.undpCode}_${UNDP_LATEST_YEAR}`;
}

/**
 * Resolve the fact year for an indicator. Currently always
 * `UNDP_LATEST_YEAR` (2023 for HDR 2025); reserved for future
 * indicators that may carry a different reference year.
 */
function resolveFactYear(config: UndpHdiIndicatorConfig): number {
  return config.factYearOverride ?? UNDP_LATEST_YEAR;
}

/**
 * Parse a single CSV line, respecting double-quoted fields that
 * contain commas (UNDP names like "Hong Kong, China (SAR)" and
 * "Korea, Republic of" require this). Returns the field array.
 *
 * Hand-rolled (no new dep) per the R.3 UN-data sync precedent
 * and Civica's "extend file, don't restructure" parallel-edit
 * discipline. Tested against the live UNDP CSV's quoted-comma
 * country names.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("") or end of quoted field.
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Fetch and parse the UNDP HDR composite-indices CSV. Returns a
 * tuple of (header column → index map, body rows as field arrays).
 * Skips regional-aggregate rows (codes starting with `ZZA`) at this
 * layer so downstream callers iterate only ISO3 country rows.
 */
async function fetchAndParseCsv(): Promise<{
  columnIndex: Map<string, number>;
  countryRows: string[][];
}> {
  const res = await fetch(UNDP_CSV_URL, {
    headers: {
      "User-Agent": UNDP_USER_AGENT,
      Accept: "text/csv,*/*",
    },
  });
  if (!res.ok) {
    throw new Error(
      `UNDP HDR CSV fetch: ${res.status} ${res.statusText}`,
    );
  }
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error(
      `UNDP HDR CSV: unexpected length ${lines.length} (need ≥ header + 1 row)`,
    );
  }
  const header = parseCsvLine(lines[0]!);
  const columnIndex = new Map<string, number>();
  for (let i = 0; i < header.length; i += 1) {
    columnIndex.set(header[i]!, i);
  }
  const countryRows: string[][] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!line) continue; // tolerate trailing blank line
    const fields = parseCsvLine(line);
    const iso3 = (fields[0] ?? "").trim();
    if (!iso3) continue;
    if (iso3.startsWith("ZZA")) continue; // regional aggregate
    if (iso3.length !== 3) continue; // must be a 3-letter ISO3
    countryRows.push(fields);
  }
  return { columnIndex, countryRows };
}

/**
 * Run the UNDP HDI sync end-to-end. Idempotent — re-running on
 * the same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncUndpHdi(
  db: Db,
  options: UndpHdiSyncOptions = {},
): Promise<UndpHdiSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = UNDP_HDI_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.undpCode && c.undpCode !== options.undpCode) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      csvCountryRows: 0,
      vintageLabel: UNDP_HDR_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no UNDP HDI indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
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

  // Fetch + parse the bulk CSV exactly once; iterate per-indicator
  // against the in-memory parse.
  log(`→ fetching UNDP HDR 2025 CSV (${UNDP_CSV_URL})…`);
  let columnIndex: Map<string, number>;
  let countryRows: string[][];
  try {
    ({ columnIndex, countryRows } = await fetchAndParseCsv());
  } catch (err) {
    errors.push(
      `CSV fetch/parse failed: ${err instanceof Error ? err.message : err}`,
    );
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: allJurisdictions.length,
      csvCountryRows: 0,
      vintageLabel: UNDP_HDR_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors,
      dryRun: options.dryRun ?? false,
    };
  }
  log(`  parsed ${columnIndex.size} columns × ${countryRows.length} country rows`);

  const counters = new Map<string, PerUndpCounters>();
  for (const c of targets) {
    counters.set(
      c.factKey,
      freshCounters(c.factKey, c.undpCode, resolveCsvColumn(c)),
    );
  }

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
        `unknown fact-key '${config.factKey}' for UNDP ${config.undpCode} (registry mismatch)`,
      );
      continue;
    }

    const csvColumn = resolveCsvColumn(config);
    const factYear = resolveFactYear(config);
    const colIdx = columnIndex.get(csvColumn);
    if (colIdx === undefined) {
      errors.push(
        `UNDP CSV missing expected column '${csvColumn}' for fact-key '${config.factKey}'`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.undpCode} → CSV column '${csvColumn}', year ${factYear}) "${config.label}"…`,
    );

    const iso3ColIdx = columnIndex.get("iso3") ?? 0;

    for (const fields of countryRows) {
      counter.rowsScanned += 1;
      const iso3 = (fields[iso3ColIdx] ?? "").trim().toUpperCase();
      if (!iso3 || iso3.length !== 3) {
        counter.skipped_no_iso3 += 1;
        continue;
      }
      const j = iso3ToJurisdiction.get(iso3);
      if (!j) {
        counter.skipped_no_jurisdiction += 1;
        continue;
      }

      const rawValue = (fields[colIdx] ?? "").trim();
      if (!rawValue) {
        counter.rejected_no_value += 1;
        continue;
      }
      const parsedValue = Number(rawValue);
      if (!Number.isFinite(parsedValue)) {
        counter.rejected_no_value += 1;
        continue;
      }
      counter.jurisdictions_with_value += 1;

      const transform = config.valueTransform ?? ((v: number) => v);
      const numericValue = transform(parsedValue);

      // Plausibility envelope per fact-key registry §3.6.
      // R.1.1 fix mirrored inline (matches the WHO sync's pattern):
      // when isPercent is true, the [-1, 101] range is only a fallback
      // for fact-keys that do not declare their own min/max. When
      // min/max are explicitly set in the fact-key definition, those
      // values take precedence. Helper extraction deferred until R.5
      // / R.7 also land to avoid parallel-edit conflicts.
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
          counter.rejected_envelope += 1;
          continue;
        }
      }

      const asOf = `${factYear}-01-01`;

      const upstreamPayload = {
        source: "undp_hdi",
        endpoint: UNDP_CSV_URL,
        iso3: j.iso3,
        undpCode: config.undpCode,
        csvColumn,
        year: factYear,
        rawValue,
        parsedValue,
        transformedValue: numericValue,
        undpVintage: UNDP_HDR_VINTAGE,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "UNDP Human Development Reports",
          // Civica's canonical/alternate editorial role for this
          // (source, fact-key) pair. Default 'alternate' when
          // omitted on the indicator config. See
          // `~/civica/plan/undp-hdi-resolution-v1.md` §2m.
          civicaRole: config.civicaRole ?? "alternate",
          // Per-row license metadata for forward-compatibility
          // with R.4's license-aware filter infrastructure. UNDP
          // HDR data is CC-BY-3.0-IGO (commercial-use OK with
          // attribution; no NC clause; no SA clause).
          license: UNDP_HDR_LICENSE,
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${factYear})`,
        );
        counter.written += 1;
        totalWritten += 1;
        touchedPairs.add(`${j.id}|${config.factKey}`);
        continue;
      }

      try {
        // Snapshot dedup — re-runs with identical upstream payloads
        // are no-ops at the snapshot table.
        await db
          .insert(factSnapshots)
          .values({
            sourceId: "undp_hdi",
            upstreamRef: `undp:${j.iso3}:${config.undpCode}:${factYear}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: UNDP_HDR_VINTAGE,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          });

        const snapshotIdRow = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'undp_hdi' AND ${factSnapshots.payloadHash} = ${hash}`,
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
            sourceId: "undp_hdi",
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
            upstreamVintageLabel: UNDP_HDR_VINTAGE,
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
              upstreamVintageLabel: UNDP_HDR_VINTAGE,
              snapshotId,
              updatedAt: new Date(),
            },
          });
        counter.written += 1;
        totalWritten += 1;
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
        `(scanned ${counter.rowsScanned}, ` +
        `with-value ${counter.jurisdictions_with_value}, ` +
        `unmatched ISO3: ${counter.skipped_no_jurisdiction}, ` +
        `no-value: ${counter.rejected_no_value}, ` +
        `envelope rejects: ${counter.rejected_envelope})`,
    );
  }

  if (!options.dryRun) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, "undp_hdi"));
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
  const countersByFactKey: Record<string, PerUndpCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    csvCountryRows: countryRows.length,
    vintageLabel: UNDP_HDR_VINTAGE,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
