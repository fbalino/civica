/**
 * Phase R.8 — FAO FAOSTAT sync orchestrator.
 *
 * Direct sync from the FAOSTAT public bulk-download endpoint at
 * `https://bulks-faostat.fao.org/production/`. Mirrors the F.6 / R.1 /
 * R.2 / R.3 / R.4 / R.7 pattern but with a bulk-CSV architecture
 * (closer to R.3 UN's ZIP-CSV pattern than to the REST-API patterns of
 * R.1 / R.2 / R.7).
 *
 * Ships 4 indicators from the FAO Land Use (RL) dataset:
 *   - Item 6610 (Agricultural land), Element 7209 (Share in Land area)
 *     → `agricultural_land_pct`  (NEW fact-key declared at R.8)
 *   - Item 6646 (Forest land),       Element 7209 (Share in Land area)
 *     → `forest_area_pct`         (NEW fact-key declared at R.8)
 *   - Item 6610 (Agricultural land), Element 5110 (Area, 1000 ha)
 *     → `agricultural_land_km2`   (NEW fact-key declared at R.8;
 *                                   transform `× 10` from 1000 ha)
 *   - Item 6611 (Agriculture area actually irrigated), Element 5110
 *     → `irrigated_land_km2`      (existing fact-key, flipped to
 *                                   Group B; transform `× 10`)
 *
 * All 4 ship as `civicaRole: 'canonical'`. FAO is the upstream-canonical
 * publisher for agriculture-, forestry-, and land-use-specific
 * indicators; WB's `AG.LND.AGRI.ZS` and OECD's ENV-AGRI dataflow both
 * republish FAO without methodological adjustment. Per
 * `~/civica/plan/fao-faostat-resolution-v1.md` §2d.
 *
 * Why bulk-download and NOT the REST API at
 * `https://faostatservices.fao.org/api/v1/en/`: the REST API requires
 * an Authorization header (verified live 2026-05-04: every endpoint
 * returns HTTP 401 "Missing Authorization Header"). FAO does not
 * enumerate a keyless tier. The bulk-download endpoint is keyless,
 * 200-OK, and matches Civica's keyless cron architecture. See
 * `~/civica/plan/fao-faostat-resolution-v1.md` §2a.
 *
 * Architecture:
 *   - One round-trip downloads the Land Use ZIP archive (~3 MB
 *     compressed → ~49 MB CSV uncompressed).
 *   - In-memory unzip via `adm-zip` (already a project dep).
 *   - Hand-rolled quote-aware CSV parser (no new dep). FAO escapes
 *     every cell with double-quotes including the leading-apostrophe
 *     M49 code (e.g. `"'076"` for Brazil); the parser strips both.
 *   - Single CSV scan slices all 4 (item-code, element-code) pairs
 *     out simultaneously. ~10× cheaper than 4 separate API calls.
 *   - Per (iso3, item, element), pick the latest non-null year as
 *     the canonical observation. Skip rows with no value (FAO
 *     publishes empty values when a country didn't report).
 *
 * Country join uses UN M49 numeric area codes (FAO's `Area Code (M49)`
 * column) via the `M49_TO_ISO3` map exported from `sync-un-data.ts`
 * (R.8 reuses it rather than duplicating; the FAO M49 codes are the
 * same UN registry codes UN PopDiv uses). Per
 * `~/civica/plan/fao-faostat-resolution-v1.md` §2h + Q7.
 *
 * Forecast handling: every FAO row is `value_type: 'measured'`. FAOSTAT
 * does NOT publish forecasts — every row is either a country-reported
 * measurement (flag 'A'), an FAO imputation from neighboring/regional
 * data (flag 'I'), or a preliminary estimate (flag 'E'). All three are
 * measurements in Bug 1's sense. Per
 * `~/civica/plan/forecast-vs-measurement-v1.md` § Q4 forward policy.
 * The `value_type` is set explicitly per resolution Q9 (defensive
 * convention even though only one value is possible).
 *
 * License: CC-BY 4.0 (commercial use permitted with attribution per
 * the FAO Statistical Database Terms of Use). Per-row
 * `references[].license = 'CC-BY-4.0'` mirrors the R.4 WHO + R.7 OECD
 * precedent for forward-compatible license-aware-filter middleware.
 * The Land Use (RL) dataset specifically confirms CC-BY 4.0 with no
 * exception clause (FAO catalog page at
 * `https://data.apps.fao.org/catalog/dataset/land-use-rl`). Per
 * `~/civica/plan/fao-faostat-resolution-v1.md` §2f + Q3.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.8
 * Resolution:  ~/civica/plan/fao-faostat-resolution-v1.md
 */
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import AdmZip from "adm-zip";

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
import { M49_TO_ISO3 } from "./sync-un-data";

type Db = typeof import("@/lib/db").db;

const FAO_BULK_BASE_URL =
  "https://bulks-faostat.fao.org/production";
const FAO_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Civica-side vintage label for FAO rows. FAOSTAT releases the Land
 * Use dataset annually, typically mid-year; the most recent release as
 * of 2026-05-04 covers data through 2023 with E-flagged estimates
 * extending into 2024-2025. Using a quarterly Civica-side label keeps
 * the snapshot table's vintage column consistent with R.7 OECD's
 * convention. The methodology page rewrite (R.23) can surface the
 * underlying FAO release date.
 *
 * Per `~/civica/plan/fao-faostat-resolution-v1.md` §2j + Q8.
 */
const FAO_FAOSTAT_VINTAGE = "FAO FAOSTAT Land Use 2026Q3";

/**
 * License string stamped into per-row references payload. Per
 * `~/civica/plan/fao-faostat-resolution-v1.md` §2f + Q3.
 *
 * FAO's Statistical Database Terms of Use default all datasets to
 * CC-BY 4.0 unless the dataset metadata says otherwise. The Land Use
 * (RL) dataset confirms CC-BY 4.0 with no exception clause.
 *
 * Materially more permissive than R.4 WHO (CC-BY-NC-SA 3.0 IGO,
 * non-commercial-only) — FAOSTAT permits commercial use with
 * attribution. The "no advertising-promotion" rider in FAO ToU §8 is
 * satisfied by Civica's reference-site posture.
 */
const FAO_FAOSTAT_LICENSE = "CC-BY-4.0";

/**
 * The Land Use (RL) bulk archive filename. FAOSTAT serves the
 * normalized (long-format) variant — one row per (area, item, element,
 * year) tuple with a numeric `Year` column, NOT the wide variant where
 * each year is its own column. The normalized variant is preferable
 * because slice-by-element-code is a single linear scan.
 */
const FAO_LAND_USE_ARCHIVE =
  "Inputs_LandUse_E_All_Data_(Normalized).zip";

/**
 * Documentation URL for the Land Use (RL) dataset (catalog page).
 * Stamped into `references[].url` for every row so the alternates
 * panel can link out.
 */
const FAO_LAND_USE_DOC_URL =
  "https://data.apps.fao.org/catalog/dataset/land-use-rl";

/**
 * One FAO indicator we care about. The FAOSTAT bulk-download CSV is
 * indexed by `(Item Code, Element Code)`; each entry pins these two
 * codes plus a Civica fact-key destination. The optional
 * `valueTransform` lets us reshape upstream units to fact-key units
 * (e.g. FAO ships agricultural area in `1000 ha`; Civica's km² unit
 * needs `× 10`).
 */
export interface FaoFaostatIndicatorConfig {
  /** FAO Item Code (e.g. 6610 for "Agricultural land"). Numeric. */
  itemCode: number;
  /** FAO Element Code (e.g. 7209 for "Share in Land area",
   *  5110 for "Area"). Numeric. */
  elementCode: number;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw FAO value before envelope check
   *  and write. Default 1 — used when the FAO unit matches the
   *  fact-key unit verbatim (e.g. `%` stays `%`). For absolute-area
   *  indicators, FAO ships `1000 ha`; transform `× 10` to `km2`. */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this FAO indicator. R.8 ships all 4
   *  indicators as `'canonical'` per the resolution. The Phase F
   *  resolver does NOT use this field for runtime selection (the
   *  resolver is freshness-driven per methodology §3.3); the field
   *  is informational metadata for the methodology page rewrite at
   *  Phase R.23. Mirrors R.1's `WdiIndicatorConfig.civicaRole`. */
  civicaRole?: CivicaSourceRole;
}

/**
 * The 4 FAO indicators in R.8 ship scope. All from the Land Use (RL)
 * dataset, all sliced from one CSV scan. Per
 * `~/civica/plan/fao-faostat-resolution-v1.md` §2b.
 */
export const FAO_FAOSTAT_INDICATORS: readonly FaoFaostatIndicatorConfig[] = [
  {
    // FAOSTAT Land Use Item 6610 (Agricultural land), Element 7209
    // (Share in Land area). Probe (2023): min Suriname ~1%, max
    // Saudi Arabia ~81%, Brazil 28.33%, USA 45%. 260 areas covered
    // for vintage 2023.
    //
    // Master-plan flagship indicator. FAO is upstream of WB's
    // AG.LND.AGRI.ZS (WB metadata cites FAO directly); R.1 explicitly
    // excluded the WB equivalent because R.8 was the planned FAO
    // canonical.
    itemCode: 6610,
    elementCode: 7209,
    factKey: "agricultural_land_pct",
    label: "Agricultural land (% of land area)",
    docUrl: FAO_LAND_USE_DOC_URL,
    civicaRole: "canonical",
  },
  {
    // FAOSTAT Land Use Item 6646 (Forest land), Element 7209 (Share
    // in Land area). Probe (2023): min Egypt 0.04%, max Suriname
    // 97%, Brazil 59.33%, USA 33.79%. 261 areas covered for vintage
    // 2023.
    //
    // Master-plan flagship indicator. FAO is upstream of WB's
    // AG.LND.FRST.ZS (Forest Resources Assessment).
    itemCode: 6646,
    elementCode: 7209,
    factKey: "forest_area_pct",
    label: "Forest area (% of land area)",
    docUrl: FAO_LAND_USE_DOC_URL,
    civicaRole: "canonical",
  },
  {
    // FAOSTAT Land Use Item 6610 (Agricultural land), Element 5110
    // (Area, in 1000 ha). Transform: `× 10` to convert 1000 ha → km²
    // (1 ha = 0.01 km²; 1000 ha = 10 km²). Probe (2023): Brazil
    // 236782.8 1000 ha → 2,367,828 km² ✓ (matches Brazil's
    // ~2.37M km² agricultural area widely cited).
    //
    // Absolute-area counterpart to indicator #1. Useful as a sanity-
    // check denominator for downstream reasoning and for absolute-
    // area cross-country comparisons.
    itemCode: 6610,
    elementCode: 5110,
    factKey: "agricultural_land_km2",
    label: "Agricultural land area (km²)",
    docUrl: FAO_LAND_USE_DOC_URL,
    valueTransform: (raw: number) => raw * 10,
    civicaRole: "canonical",
  },
  {
    // FAOSTAT Land Use Item 6611 (Agriculture area actually
    // irrigated), Element 5110 (Area, in 1000 ha). Transform:
    // `× 10` to km². Probe (2023): Afghanistan 2,279 1000 ha →
    // 22,790 km², Australia 1,945 1000 ha → 19,450 km², India and
    // China are the global leaders.
    //
    // Existing fact-key `irrigated_land_km2` (envelope `[0, 1_000_000]`,
    // unit `km2`). FAO publishes irrigated-area selectively — many
    // semi-arid rainfed-agriculture countries report 0 or no value;
    // expected coverage ~140 ISO3 (vs ~210 for share/area indicators).
    itemCode: 6611,
    elementCode: 5110,
    factKey: "irrigated_land_km2",
    label: "Irrigated land area (km²)",
    docUrl: FAO_LAND_USE_DOC_URL,
    valueTransform: (raw: number) => raw * 10,
    civicaRole: "canonical",
  },
];

/**
 * One observation as parsed from a FAOSTAT bulk CSV row. The
 * normalized format ships these columns:
 *   1. Area Code (FAO internal, NOT M49)
 *   2. Area Code (M49) — the load-bearing column for ISO3 lookup
 *   3. Area (English country name)
 *   4. Item Code
 *   5. Item (English label)
 *   6. Element Code
 *   7. Element (English label, e.g. "Share in Land area")
 *   8. Year Code (4-digit for annual; 8-digit for 3-year averages —
 *                R.8 indicators are all 4-digit annual)
 *   9. Year (display string, same as Year Code for 4-digit)
 *  10. Unit (e.g. "%", "1000 ha")
 *  11. Value (numeric or empty)
 *  12. Flag (e.g. "A", "E", "I" — see file header)
 *  13. Note (free-text annotation, usually empty)
 */
interface FaoCsvRow {
  m49Code: number;
  areaName: string;
  itemCode: number;
  elementCode: number;
  year: number;
  unit: string;
  value: number;
  flag: string;
}

/**
 * Per-indicator counter shape. Mirrors the OECD / IMF / WHO
 * conventions.
 */
export interface PerFaoFaostatCounters {
  factKey: string;
  itemCode: number;
  elementCode: number;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  /** Rows with no M49 → ISO3 mapping (FAO regional aggregates,
   *  unmapped territories). Counted but not retained. */
  skipped_no_iso3: number;
  /** ISO3 codes that don't match any Civica jurisdiction row. */
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
}

export interface FaoFaostatSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  vintageLabel: string;
  archiveBytes: number;
  countersByFactKey: Record<string, PerFaoFaostatCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface FaoFaostatSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(
  factKey: string,
  itemCode: number,
  elementCode: number,
): PerFaoFaostatCounters {
  return {
    factKey,
    itemCode,
    elementCode,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_no_iso3: 0,
    skipped_no_jurisdiction: 0,
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
 * Quote-aware CSV row splitter. FAOSTAT escapes every cell with
 * double-quotes, including the leading-apostrophe M49 code (e.g.
 * `"'076"` for Brazil). The parser:
 *   - Treats `"..."` runs as a single field, stripping the surrounding
 *     quotes.
 *   - Leaves bare `,` (between two `"`-delimited fields) as the field
 *     separator.
 *   - Strips a leading apostrophe from the second field (the M49 code
 *     comes formatted `'076` to prevent Excel from interpreting it as
 *     octal — we strip the apostrophe before parseInt).
 *
 * Empty values (`""` or unquoted blank between commas) yield empty
 * strings; the caller checks for value-presence before parsing.
 */
function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field — accumulate until matching close quote.
      let j = i + 1;
      let buf = "";
      while (j < line.length) {
        if (line[j] === '"' && line[j + 1] === '"') {
          // Escaped quote inside field.
          buf += '"';
          j += 2;
          continue;
        }
        if (line[j] === '"') break;
        buf += line[j];
        j += 1;
      }
      cells.push(buf);
      // Skip past close quote + optional comma.
      i = j + 1;
      if (line[i] === ",") i += 1;
    } else if (line[i] === ",") {
      cells.push("");
      i += 1;
    } else {
      // Unquoted bare field (rare in FAO CSVs, but possible in trailing
      // empty cells).
      let j = i;
      while (j < line.length && line[j] !== ",") j += 1;
      cells.push(line.slice(i, j));
      i = j + 1;
    }
  }
  return cells;
}

/**
 * Fetch the Land Use bulk archive, unzip in memory, and parse the
 * normalized data CSV. Returns ALL rows (caller filters per indicator).
 *
 * Bandwidth: ~3 MB compressed → ~49 MB CSV uncompressed → ~1M rows.
 * Memory peak ~80 MB during parse; well within Node serverless
 * function limits (default 1 GB).
 */
async function fetchAndParseLandUseCsv(
  log: (line: string) => void,
): Promise<{ rows: FaoCsvRow[]; archiveBytes: number }> {
  const url = `${FAO_BULK_BASE_URL}/${FAO_LAND_USE_ARCHIVE}`;
  log(`→ fetching ${url}…`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": FAO_USER_AGENT,
      Accept: "application/zip,application/x-zip-compressed",
    },
  });
  if (!res.ok) {
    throw new Error(
      `FAO bulk download ${FAO_LAND_USE_ARCHIVE}: ${res.status} ${res.statusText}`,
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const archiveBytes = buffer.length;
  log(`  fetched ${(archiveBytes / 1024 / 1024).toFixed(2)} MB compressed`);

  // Unzip in-memory via adm-zip.
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  // The data CSV is the largest entry by far (~49 MB) and follows the
  // pattern `Inputs_LandUse_E_All_Data_(Normalized).csv`. Pick by
  // suffix match for robustness.
  const dataEntry = entries.find((e) =>
    e.entryName.endsWith("(Normalized).csv"),
  );
  if (!dataEntry) {
    throw new Error(
      `FAO archive ${FAO_LAND_USE_ARCHIVE}: no (Normalized).csv entry`,
    );
  }
  const csvText = dataEntry.getData().toString("utf-8");
  log(
    `  unzipped CSV ${(csvText.length / 1024 / 1024).toFixed(2)} MB (${dataEntry.entryName})`,
  );

  const rows: FaoCsvRow[] = [];
  const lines = csvText.split(/\r?\n/);
  // Header row — skip line 0.
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = parseCsvRow(line);
    if (cells.length < 11) continue; // malformed / blank row

    // Column indices per file header documented in `FaoCsvRow`.
    const m49Raw = cells[1];
    const m49Stripped = m49Raw.startsWith("'") ? m49Raw.slice(1) : m49Raw;
    const m49Code = parseInt(m49Stripped, 10);
    if (!Number.isFinite(m49Code)) continue;

    const itemCode = parseInt(cells[3], 10);
    const elementCode = parseInt(cells[5], 10);
    if (!Number.isFinite(itemCode) || !Number.isFinite(elementCode)) continue;

    const yearStr = cells[7];
    // R.8 only handles 4-digit annual year codes. 8-digit range codes
    // (e.g. `20222024` for 3-year-average food security indicators)
    // are deferred to a future R.8.5+ phase per resolution Q6 / §2b.
    if (yearStr.length !== 4) continue;
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) continue;

    const valueStr = cells[10];
    if (!valueStr) continue; // empty value (country didn't report)
    const value = parseFloat(valueStr);
    if (!Number.isFinite(value)) continue;

    rows.push({
      m49Code,
      areaName: cells[2],
      itemCode,
      elementCode,
      year,
      unit: cells[9],
      value,
      flag: cells[11] ?? "",
    });
  }

  return { rows, archiveBytes };
}

/**
 * From the full row set, slice rows matching this (itemCode, elementCode)
 * pair, then pick the latest non-null year per ISO3 country.
 *
 * The `M49_TO_ISO3` map filters out FAO regional aggregates (codes
 * >900: Africa 5100, Americas 5200, Asia 5300, Europe 5400, etc.)
 * and unmapped territories. Aggregates are counted via `nonIso3Count`
 * for visibility.
 */
function pickLatestPerCountry(
  rows: FaoCsvRow[],
  config: FaoFaostatIndicatorConfig,
): {
  latestByIso3: Map<string, FaoCsvRow>;
  observationCount: number;
  nonIso3Count: number;
} {
  const latestByIso3 = new Map<string, FaoCsvRow>();
  let observationCount = 0;
  let nonIso3Count = 0;

  for (const r of rows) {
    if (r.itemCode !== config.itemCode) continue;
    if (r.elementCode !== config.elementCode) continue;
    observationCount++;

    const iso3 = M49_TO_ISO3[r.m49Code];
    if (!iso3) {
      nonIso3Count++;
      continue;
    }

    const existing = latestByIso3.get(iso3);
    if (!existing || r.year > existing.year) {
      latestByIso3.set(iso3, r);
    }
  }

  return { latestByIso3, observationCount, nonIso3Count };
}

/**
 * Run the FAO FAOSTAT sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncFaoFaostat(
  db: Db,
  options: FaoFaostatSyncOptions = {},
): Promise<FaoFaostatSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = FAO_FAOSTAT_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: FAO_FAOSTAT_VINTAGE,
      archiveBytes: 0,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no FAO FAOSTAT indicators matched the filter"],
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
  log(
    `${allJurisdictions.length} jurisdictions with ISO3 codes loaded.`,
  );

  // Single bulk-download fetch + parse (vs. one per indicator).
  let allRows: FaoCsvRow[];
  let archiveBytes = 0;
  try {
    const result = await fetchAndParseLandUseCsv(log);
    allRows = result.rows;
    archiveBytes = result.archiveBytes;
    log(`  parsed ${allRows.length} CSV rows (after empty-value filter)`);
  } catch (err) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: allJurisdictions.length,
      vintageLabel: FAO_FAOSTAT_VINTAGE,
      archiveBytes: 0,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: [
        `bulk-download fetch/parse failed: ${
          err instanceof Error ? err.message : err
        }`,
      ],
      dryRun: options.dryRun ?? false,
    };
  }

  const counters = new Map<string, PerFaoFaostatCounters>();
  for (const c of targets) {
    counters.set(
      c.factKey,
      freshCounters(c.factKey, c.itemCode, c.elementCode),
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
        `unknown fact-key '${config.factKey}' for FAO ${config.itemCode}/${config.elementCode} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.itemCode}/${config.elementCode}) "${config.label}" — slicing…`,
    );

    const { latestByIso3, observationCount, nonIso3Count } = pickLatestPerCountry(
      allRows,
      config,
    );
    counter.observations = observationCount;
    counter.skipped_no_iso3 = nonIso3Count;
    counter.jurisdictions_with_value = latestByIso3.size;
    log(
      `  ${observationCount} observations matched; ${nonIso3Count} non-ISO3 aggregates skipped; ${latestByIso3.size} ISO3 countries with latest value`,
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
      // R.1.1 fix mirrored inline: when isPercent is true, the
      // [-1, 101] range is only a fallback for fact-keys that do
      // not declare their own min/max. When min/max are explicitly
      // set, those values take precedence. Both R.8 percentage
      // fact-keys (agricultural_land_pct, forest_area_pct) declare
      // explicit `[0, 100]` envelopes — well-bounded for a share-
      // of-land-area domain.
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

      // Bug 1 — value-type discriminator. FAOSTAT does NOT publish
      // forecasts; every row is a measurement (country-reported,
      // FAO-imputed, or preliminary estimate — all three are
      // measurements at `factYear` in Bug 1's sense). Set explicitly
      // per resolution Q9 (defensive convention; prevents schema-
      // drift surprises if FAO ever adds a forecast capability).
      //
      // See ~/civica/plan/forecast-vs-measurement-v1.md.
      const valueType: "measured" | "projected" = "measured";

      const upstreamPayload = {
        source: "fao_faostat",
        endpoint: `${FAO_BULK_BASE_URL}/${FAO_LAND_USE_ARCHIVE}`,
        iso3: j.iso3,
        itemCode: config.itemCode,
        elementCode: config.elementCode,
        year: factYear,
        rawValue: dp.value,
        rawUnit: dp.unit,
        rawFlag: dp.flag,
        transformedValue: numericValue,
        faoVintage: FAO_FAOSTAT_VINTAGE,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "FAO FAOSTAT",
          // R.8 — Civica's canonical/alternate editorial role for
          // this (source, fact-key) pair. All 4 R.8 indicators
          // ship as 'canonical' per resolution. See
          // `~/civica/plan/fao-faostat-resolution-v1.md` §2d.
          civicaRole: config.civicaRole ?? "canonical",
          // R.8 — per-row license metadata. Mirrors the R.4 WHO +
          // R.7 OECD precedent for forward-compatible license-
          // aware-filter middleware. CC-BY 4.0 is materially more
          // permissive than R.4 WHO; commercial use is permitted.
          // Per `~/civica/plan/fao-faostat-resolution-v1.md` §2f.
          license: FAO_FAOSTAT_LICENSE,
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${factYear}, flag=${dp.flag})`,
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
            sourceId: "fao_faostat",
            upstreamRef: `fao:${j.iso3}:${config.itemCode}:${config.elementCode}:${factYear}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: FAO_FAOSTAT_VINTAGE,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          });

        const snapshotIdRow = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'fao_faostat' AND ${factSnapshots.payloadHash} = ${hash}`,
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
            sourceId: "fao_faostat",
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
            upstreamVintageLabel: FAO_FAOSTAT_VINTAGE,
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
            // `valueType` IS included in the set clause for forward-
            // compatibility (see Bug 1 / IMF precedent). For FAO it
            // always evaluates to 'measured' since FAOSTAT doesn't
            // ship forecasts.
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
              upstreamVintageLabel: FAO_FAOSTAT_VINTAGE,
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
        `(non-ISO3 aggregates: ${counter.skipped_no_iso3}, ` +
        `unmatched ISO3: ${counter.skipped_no_jurisdiction}, ` +
        `envelope rejects: ${counter.rejected_envelope})`,
    );
  }

  if (!options.dryRun) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, "fao_faostat"));
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
  const countersByFactKey: Record<string, PerFaoFaostatCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    vintageLabel: FAO_FAOSTAT_VINTAGE,
    archiveBytes,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
