/**
 * Phase R.12 — WTO Stats sync orchestrator.
 *
 * Direct sync from the WTO Stats public bulk-download endpoint at
 * `https://stats.wto.org/assets/UserGuide/`. Mirrors the F.6 / R.1 /
 * R.8 (FAO) bulk-CSV-from-ZIP pattern.
 *
 * Ships 2 indicators from the WTO merchandise annual dataset:
 *   - `ITS_MTV_AX` (Total merchandise exports, product=TO, partner=World)
 *     → `exports_merchandise_usd`  (NEW fact-key declared at R.12)
 *   - `ITS_MTV_AM` (Total merchandise imports, product=TO, partner=World)
 *     → `imports_merchandise_usd`  (NEW fact-key declared at R.12)
 *
 * Both ship as `civicaRole: 'canonical'`. WTO Stats is the upstream-
 * canonical publisher for merchandise trade (the WTO Statistical
 * Programme's mandate). Per
 * `~/civica/plan/wto-stats-resolution-v1.md` §2d.
 *
 * Why two fact-keys and not one. WTO and World Bank measure different
 * things under similar names: WTO ships merchandise-only (goods
 * crossing borders); WB's `NE.EXP.GNFS.CD` ships goods + commercial
 * services (BoP-style aggregate). Civica declares distinct fact-keys
 * for each measurement rather than reconciling them through the
 * resolver. Per `~/civica/plan/trade-aggregate-fact-keys-v1.md`
 * (ADOPTED 2026-05-04). The WB rows for `*_total_usd` were renamed
 * to `*_goods_services_usd` in-band with R.12's first sync run via
 * the migration helper below; WB's `civicaRole` flipped from
 * `'alternate'` to `'canonical'` at the same time (WB is canonical
 * for the goods+services aggregate; WTO is canonical for the
 * merchandise-only aggregate; they don't compete).
 *
 * Why bulk-download and NOT the REST API at
 * `https://api.wto.org/timeseries/v1/`: the REST API requires Azure
 * APIM `Ocp-Apim-Subscription-Key` header (verified live 2026-05-04
 * — endpoint returns HTTP 401 with WWW-Authenticate confirming the
 * subscription-key requirement). Free registration via
 * `apiportal.wto.org` is available, but Civica's keyless cron
 * architecture is the in-band convention (R.0–R.11 are all keyless;
 * R.8 FAO Q4 sign-off explicitly framed key-acquisition as a
 * master-plan-level scope change). Bulk download is also faster for
 * academic citability — a single ~2 MB ZIP download is more
 * reproducible than an API call sequence. See
 * `~/civica/plan/wto-stats-resolution-v1.md` §2a.
 *
 * Architecture:
 *   - One round-trip downloads the WTO merchandise annual ZIP
 *     archive (~2 MB compressed → ~68 MB CSV uncompressed).
 *   - In-memory unzip via `adm-zip` (already a project dep).
 *   - Hand-rolled quote-aware CSV parser (no new dep). WTO escapes
 *     every cell with double-quotes; the parser strips them.
 *   - Single CSV scan slices both (IndicatorCode='ITS_MTV_AX' or
 *     'ITS_MTV_AM') × (ProductCode='TO') × (PartnerCode='000') rows
 *     simultaneously. ~10× cheaper than 2 separate API calls.
 *   - Per (iso3, indicator), pick the latest non-null year as the
 *     canonical observation.
 *
 * Country join uses the `ReporterISO3A` column directly (literal
 * ISO3 codes for sovereign states; no M49 → ISO3 lookup needed).
 *
 * Forecast handling: every WTO row is `value_type: 'measured'`. WTO
 * Stats does NOT publish forecasts in the merchandise / services
 * datasets — every row is either a final published value (flag ''),
 * a refined estimate (flag 'E'), or a preliminary estimate (flag
 * 'P'). All three are measurements in Bug 1's sense. Per
 * `~/civica/plan/forecast-vs-measurement-v1.md` § Q4 forward policy
 * + `~/civica/plan/wto-stats-resolution-v1.md` §2e + §6 Q6.
 *
 * License: Open Database License (ODbL) v1.0 per WTO Data Portal
 * CKAN package metadata at `data.wto.org/api/3/action/package_show?id=commerchandise`.
 * Commercial use OK with attribution AND share-alike. Per-row
 * `references[].license = 'ODbL-1.0'` mirrors the R.4 WHO + R.7 OECD
 * + R.8 FAO precedent. The R.12 sync also tightens the
 * `sources.license` field for `wto_stats` from
 * `'open_data_attribution'` to `'ODbL-1.0'` on each run (idempotent
 * UPSERT). Per `~/civica/plan/wto-stats-resolution-v1.md` §2i + §6
 * Q2.
 *
 * Migration of legacy fact-keys: R.12's first run also performs an
 * idempotent rename migration of the four legacy trade-aggregate
 * fact-keys (`exports_total_usd`, `imports_total_usd`,
 * `exports_total`, `imports_total`) into the two `_goods_services_usd`
 * fact-keys. The migration is gated by a `WHERE fact_key = '<old>'`
 * filter that no-ops on subsequent runs. Per
 * `~/civica/plan/trade-aggregate-fact-keys-v1.md` §2d steps 1-3.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.12
 * Resolution:  ~/civica/plan/wto-stats-resolution-v1.md
 * Resolution:  ~/civica/plan/trade-aggregate-fact-keys-v1.md
 */
import { sql } from "drizzle-orm";
import AdmZip from "adm-zip";

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

const WTO_BULK_BASE_URL = "https://stats.wto.org/assets/UserGuide";
const WTO_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Civica-side vintage label for WTO rows. WTO Stats refreshes the
 * merchandise + services annual datasets quarterly (CKAN
 * `metadata_modified` field on the `commerchandise` package shows
 * 2026-03-20 for the current cut). Using a quarterly Civica-side
 * label keeps the snapshot table's vintage column consistent with
 * R.7 OECD's + R.8 FAO's convention.
 *
 * Per `~/civica/plan/wto-stats-resolution-v1.md` §2j + §6 Q5.
 */
const WTO_STATS_VINTAGE = "WTO Stats Merchandise 2026Q1";

/**
 * License string stamped into per-row references payload. Per
 * `~/civica/plan/wto-stats-resolution-v1.md` §2i + §6 Q2.
 *
 * ODbL v1.0 is the Open Database License — commercial use OK with
 * attribution AND share-alike. **Stricter than R.4 WHO
 * (CC-BY-NC-SA 3.0 IGO), R.8 FAO (CC-BY-4.0), R.11 Eurostat
 * (CC-BY-4.0).** The share-alike clause requires that any
 * "Derivative Database" incorporating ODbL data and "distributed"
 * publicly also be available under ODbL. Civica's per-row
 * `<SourceDot>` rendering is a "Produced Work" under ODbL §4.4(b)
 * and only requires attribution; the underlying
 * `country_facts` JSON-API publication does require ODbL
 * attribution in the response envelope (R.23 methodology page +
 * api-docs).
 */
const WTO_STATS_LICENSE = "ODbL-1.0";

/**
 * The WTO merchandise annual bulk archive filename.
 */
const WTO_MERCHANDISE_ARCHIVE = "merchandise_values_annual_dataset.zip";

/**
 * Documentation URL for the WTO Statistics Programme. Stamped into
 * `references[].url` for every row so the alternates panel can link
 * out. Points to the WTO Stats merchandise dashboard rather than the
 * raw ZIP since the ZIP isn't a stable human-facing landing page.
 */
const WTO_MERCHANDISE_DOC_URL = "https://stats.wto.org/dashboard/merchandise_en.html";

/**
 * One WTO indicator we care about. The merchandise CSV is indexed
 * by `(IndicatorCode, ProductCode, PartnerCode)`; each entry pins
 * these three plus a Civica fact-key destination. The optional
 * `valueTransform` lets us reshape upstream units to fact-key units
 * (WTO ships in `Million US dollar` — `× 1e6` to plain USD).
 */
export interface WtoStatsIndicatorConfig {
  /** WTO Stats IndicatorCode (e.g. "ITS_MTV_AX" for merchandise
   *  exports). */
  wtoIndicatorCode: string;
  /** Filter on ProductCode column. R.12 only ships product=TO
   *  ("Total merchandise"); future R.12.5 may slice sub-products. */
  wtoProductCode: string;
  /** Filter on PartnerCode column. "000" = World partner (the
   *  whole-world aggregate). Sub-partner codes (bilateral trade)
   *  are out of R.12 scope. */
  wtoPartnerCode: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw WTO value before envelope check
   *  and write. Default 1. R.12 ships both indicators with `× 1e6`
   *  (USM → USD). */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this WTO indicator. R.12 ships both
   *  as `'canonical'` per the resolution. The Phase F resolver does
   *  NOT use this field for runtime selection (the resolver is
   *  freshness-driven per methodology §3.3); the field is
   *  informational metadata for the methodology page rewrite at
   *  Phase R.23. Mirrors R.1's `WdiIndicatorConfig.civicaRole`. */
  civicaRole?: CivicaSourceRole;
}

/**
 * The 2 WTO indicators in R.12 ship scope. Per
 * `~/civica/plan/wto-stats-resolution-v1.md` §2b.
 */
export const WTO_STATS_INDICATORS: readonly WtoStatsIndicatorConfig[] = [
  {
    // WTO IndicatorCode ITS_MTV_AX — Merchandise exports by product
    // group, annual. ProductCode TO = Total merchandise. PartnerCode
    // 000 = World aggregate.
    //
    // Probe (2025): USA $2,185,220 M; Argentina $87,111 M;
    // China $4,500,000+ M (the global leader). 209 ISO3 codes
    // covered.
    wtoIndicatorCode: "ITS_MTV_AX",
    wtoProductCode: "TO",
    wtoPartnerCode: "000",
    factKey: "exports_merchandise_usd",
    label: "Total merchandise exports (annual, USD)",
    docUrl: WTO_MERCHANDISE_DOC_URL,
    // WTO ships values in "Million US dollar" (UnitCode USM); the
    // Civica fact-key envelope is in raw USD. Transform `× 1e6`.
    valueTransform: (raw: number) => raw * 1e6,
    civicaRole: "canonical",
  },
  {
    // WTO IndicatorCode ITS_MTV_AM — Merchandise imports by product
    // group, annual. Same ProductCode + PartnerCode shape as exports.
    //
    // Probe (2025): USA $3,506,554 M; Argentina $75,791 M.
    wtoIndicatorCode: "ITS_MTV_AM",
    wtoProductCode: "TO",
    wtoPartnerCode: "000",
    factKey: "imports_merchandise_usd",
    label: "Total merchandise imports (annual, USD)",
    docUrl: WTO_MERCHANDISE_DOC_URL,
    valueTransform: (raw: number) => raw * 1e6,
    civicaRole: "canonical",
  },
];

/**
 * One observation as parsed from a WTO Stats bulk CSV row. The
 * normalized merchandise CSV ships these columns:
 *   1. IndicatorCategory (e.g. "Merchandise trade values")
 *   2. IndicatorCode (e.g. "ITS_MTV_AX")
 *   3. Indicator (English label)
 *   4. ReporterCode (M49-style, e.g. "840" for USA)
 *   5. ReporterISO3A (literal ISO3, e.g. "USA") — load-bearing
 *   6. Reporter (English country name)
 *   7. PartnerCode (e.g. "000" for World aggregate)
 *   8. PartnerISO3A (empty for aggregates)
 *   9. Partner (English label, e.g. "World")
 *  10. ProductClassificationCode (e.g. "SITC3")
 *  11. ProductClassification (English label)
 *  12. ProductCode (e.g. "TO" for Total merchandise) — load-bearing
 *  13. Product (English label)
 *  14. PeriodCode (e.g. "A" for Annual)
 *  15. Period (English label)
 *  16. FrequencyCode (e.g. "A")
 *  17. Frequency (English label)
 *  18. UnitCode (e.g. "USM" for Million US dollar)
 *  19. Unit (English label)
 *  20. Year (4-digit)
 *  21. ValueFlagCode (e.g. "" final, "E" estimate, "P" preliminary)
 *  22. ValueFlag (English label)
 *  23. Value (numeric)
 */
export interface WtoCsvRow {
  iso3: string;
  reporterName: string;
  partnerCode: string;
  productCode: string;
  indicatorCode: string;
  year: number;
  unitCode: string;
  valueFlag: string;
  value: number;
}

export interface PerWtoStatsCounters {
  factKey: string;
  wtoIndicatorCode: string;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  /** Rows whose ReporterISO3A column was empty or non-3-letter
   *  (typically WTO's regional aggregates like "World" or "G7"). */
  skipped_no_iso3: number;
  /** ISO3 codes that don't match any Civica jurisdiction row. */
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
}

export interface WtoStatsSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  vintageLabel: string;
  archiveBytes: number;
  countersByFactKey: Record<string, PerWtoStatsCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  /** R.12 migration step — count of rows renamed from legacy
   *  trade-aggregate fact-keys (`*_total_usd`, `*_total`) into the
   *  two `*_goods_services_usd` fact-keys. Reported separately so
   *  post-implementation reality (§3a in the resolution) can record
   *  the actual count. */
  legacyMigration: {
    expectedFactKeysRemoved: string[];
    rowsMigrated: number;
    rowsRoleFlipped: number;
    /** Whether the `sources.license` field for `wto_stats` was
     *  tightened to `'ODbL-1.0'` this run (idempotent UPSERT;
     *  always returns true on the first run, false on subsequent). */
    licenseTightened: boolean;
  };
  errors: string[];
  dryRun: boolean;
}

export interface WtoStatsSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
  /** Deterministic fixture seams; production callers omit these. */
  runMigration?: typeof runLegacyMigration;
  fetchArchive?: typeof fetchAndParseMerchandiseCsv;
  jurisdictions?: WtoStatsJurisdiction[];
  persistDisputes?: typeof persistProposedDisputes;
  markSynced?: typeof markSourcesSynced;
}

export interface WtoStatsJurisdiction {
  id: string;
  slug: string;
  iso3: string | null;
}

function freshCounters(
  factKey: string,
  wtoIndicatorCode: string,
): PerWtoStatsCounters {
  return {
    factKey,
    wtoIndicatorCode,
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
 * Quote-aware CSV row splitter. Mirrors R.8 FAO's parser. WTO Stats
 * escapes every cell with double-quotes (verified live 2026-05-04);
 * the parser strips them.
 */
function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      let buf = "";
      while (j < line.length) {
        if (line[j] === '"' && line[j + 1] === '"') {
          buf += '"';
          j += 2;
          continue;
        }
        if (line[j] === '"') break;
        buf += line[j];
        j += 1;
      }
      cells.push(buf);
      i = j + 1;
      if (line[i] === ",") i += 1;
    } else if (line[i] === ",") {
      cells.push("");
      i += 1;
    } else {
      let j = i;
      while (j < line.length && line[j] !== ",") j += 1;
      cells.push(line.slice(i, j));
      i = j + 1;
    }
  }
  return cells;
}

/**
 * Fetch the merchandise bulk archive, unzip in memory, and parse
 * the merchandise CSV. Returns ALL rows (caller filters per
 * indicator).
 *
 * Bandwidth: ~2 MB compressed → ~68 MB CSV uncompressed → ~240k
 * rows. Memory peak ~120 MB during parse; well within Node
 * serverless function limits (default 1 GB).
 */
async function fetchAndParseMerchandiseCsv(
  log: (line: string) => void,
): Promise<{ rows: WtoCsvRow[]; archiveBytes: number }> {
  const url = `${WTO_BULK_BASE_URL}/${WTO_MERCHANDISE_ARCHIVE}`;
  log(`→ fetching ${url}…`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": WTO_USER_AGENT,
      Accept: "application/zip,application/x-zip-compressed",
    },
  });
  if (!res.ok) {
    throw new Error(
      `WTO bulk download ${WTO_MERCHANDISE_ARCHIVE}: ${res.status} ${res.statusText}`,
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const archiveBytes = buffer.length;
  log(`  fetched ${(archiveBytes / 1024 / 1024).toFixed(2)} MB compressed`);

  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const dataEntry = entries.find((e) => e.entryName.endsWith(".csv"));
  if (!dataEntry) {
    throw new Error(
      `WTO archive ${WTO_MERCHANDISE_ARCHIVE}: no .csv entry`,
    );
  }
  const csvText = dataEntry.getData().toString("utf-8");
  log(
    `  unzipped CSV ${(csvText.length / 1024 / 1024).toFixed(2)} MB (${dataEntry.entryName})`,
  );

  const rows: WtoCsvRow[] = [];
  const lines = csvText.split(/\r?\n/);
  // Header row — skip line 0.
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = parseCsvRow(line);
    if (cells.length < 23) continue; // malformed / blank row

    // Column indices per file header documented in `WtoCsvRow`.
    const indicatorCode = cells[1];
    const iso3 = cells[4]?.toUpperCase() ?? "";
    if (iso3.length !== 3) continue;

    const partnerCode = cells[6];
    const productCode = cells[11];

    const yearStr = cells[19];
    if (yearStr.length !== 4) continue;
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) continue;

    const valueStr = cells[22];
    if (!valueStr) continue;
    const value = parseFloat(valueStr);
    if (!Number.isFinite(value)) continue;

    rows.push({
      iso3,
      reporterName: cells[5],
      partnerCode,
      productCode,
      indicatorCode,
      year,
      unitCode: cells[17],
      valueFlag: cells[20],
      value,
    });
  }

  return { rows, archiveBytes };
}

/**
 * From the full row set, slice rows matching this (indicator,
 * product, partner) tuple, then pick the latest non-null year per
 * ISO3 country.
 */
function pickLatestPerCountry(
  rows: WtoCsvRow[],
  config: WtoStatsIndicatorConfig,
): {
  latestByIso3: Map<string, WtoCsvRow>;
  observationCount: number;
} {
  const latestByIso3 = new Map<string, WtoCsvRow>();
  let observationCount = 0;

  for (const r of rows) {
    if (r.indicatorCode !== config.wtoIndicatorCode) continue;
    if (r.productCode !== config.wtoProductCode) continue;
    if (r.partnerCode !== config.wtoPartnerCode) continue;
    observationCount++;

    const existing = latestByIso3.get(r.iso3);
    if (!existing || r.year > existing.year) {
      latestByIso3.set(r.iso3, r);
    }
  }

  return { latestByIso3, observationCount };
}

/**
 * R.12 migration helper — rename rows on the four legacy
 * trade-aggregate fact-keys into the two `*_goods_services_usd`
 * fact-keys, flip WB role from alternate to canonical, and tighten
 * the `sources.license` field for `wto_stats`. Idempotent: each
 * UPDATE is a no-op on subsequent runs because the `WHERE` clauses
 * filter on the legacy fact-key names that no longer match.
 *
 * Per `~/civica/plan/trade-aggregate-fact-keys-v1.md` §2d steps 1-3
 * + `~/civica/plan/wto-stats-resolution-v1.md` §3 step 11.
 */
async function runLegacyMigration(
  db: Db,
  log: (line: string) => void,
  dryRun: boolean,
): Promise<{
  expectedFactKeysRemoved: string[];
  rowsMigrated: number;
  rowsRoleFlipped: number;
  licenseTightened: boolean;
}> {
  const expectedFactKeysRemoved = [
    "exports_total_usd",
    "imports_total_usd",
    "exports_total",
    "imports_total",
  ];

  if (dryRun) {
    // Still report counts for visibility.
    const result = await db.execute(sql`
      SELECT fact_key, source_id, COUNT(*)::int AS n
      FROM country_facts
      WHERE fact_key IN ('exports_total_usd', 'imports_total_usd', 'exports_total', 'imports_total')
      GROUP BY fact_key, source_id
      ORDER BY fact_key, source_id`);
    const rows = (result as unknown as { rows?: Array<{ fact_key: string; source_id: string; n: number }> }).rows ?? [];
    let toMigrate = 0;
    for (const r of rows) {
      log(`  [DRY] would migrate ${r.n} rows from ${r.fact_key} (${r.source_id})`);
      toMigrate += Number(r.n);
    }
    return {
      expectedFactKeysRemoved,
      rowsMigrated: toMigrate,
      rowsRoleFlipped: 0,
      licenseTightened: false,
    };
  }

  // Step 1 — rename WB and CIA rows for exports.
  // CIA reports goods+services in its Factbook prose per CIA's
  // glossary; routing CIA into `_goods_services_usd` matches the
  // intended denominator. `fact_unit` is updated from '$' to 'USD'
  // for CIA rows (the new fact-key declares unit USD); WB rows
  // already carry unit USD.
  const renameExportsWb = await db.execute(sql`
    UPDATE country_facts
    SET fact_key = 'exports_goods_services_usd',
        fact_unit = 'USD',
        updated_at = NOW()
    WHERE fact_key = 'exports_total_usd' AND source_id = 'world_bank'`);
  const renameExportsCia = await db.execute(sql`
    UPDATE country_facts
    SET fact_key = 'exports_goods_services_usd',
        fact_unit = 'USD',
        updated_at = NOW()
    WHERE fact_key = 'exports_total' AND source_id = 'cia_factbook'`);

  // Step 2 — same for imports.
  const renameImportsWb = await db.execute(sql`
    UPDATE country_facts
    SET fact_key = 'imports_goods_services_usd',
        fact_unit = 'USD',
        updated_at = NOW()
    WHERE fact_key = 'imports_total_usd' AND source_id = 'world_bank'`);
  const renameImportsCia = await db.execute(sql`
    UPDATE country_facts
    SET fact_key = 'imports_goods_services_usd',
        fact_unit = 'USD',
        updated_at = NOW()
    WHERE fact_key = 'imports_total' AND source_id = 'cia_factbook'`);

  // Drizzle's neon-http driver returns row counts via `rowCount` in
  // an SQL execute result; defensive access since the type signature
  // varies across Drizzle versions.
  const rc = (r: unknown): number => {
    if (typeof r === "object" && r !== null) {
      const o = r as { rowCount?: number; rows?: unknown[] };
      if (typeof o.rowCount === "number") return o.rowCount;
      if (Array.isArray(o.rows)) return o.rows.length;
    }
    return 0;
  };

  const rowsMigrated =
    rc(renameExportsWb) +
    rc(renameExportsCia) +
    rc(renameImportsWb) +
    rc(renameImportsCia);

  if (rowsMigrated > 0) {
    log(
      `  legacy fact-key migration: renamed ${rowsMigrated} rows ` +
        `(WB exports ${rc(renameExportsWb)} + CIA exports ${rc(renameExportsCia)} + ` +
        `WB imports ${rc(renameImportsWb)} + CIA imports ${rc(renameImportsCia)})`,
    );
  } else {
    log(`  legacy fact-key migration: 0 rows (already migrated; idempotent no-op)`);
  }

  // Step 3 — flip WB role from 'alternate' to 'canonical' on the
  // newly-renamed goods+services rows. WB is the canonical publisher
  // of the goods+services aggregate post-R.12 (it's no longer a
  // deferred-canonical handoff to WTO since the two-fact-key split
  // means WB and WTO no longer compete on the same fact-key).
  // Per `~/civica/plan/trade-aggregate-fact-keys-v1.md` §2d step 3.
  const flipExports = await db.execute(sql`
    UPDATE country_facts
    SET "references" = jsonb_set(
          "references"::jsonb,
          '{0,civicaRole}',
          '"canonical"'::jsonb,
          true
        ),
        updated_at = NOW()
    WHERE fact_key = 'exports_goods_services_usd'
      AND source_id = 'world_bank'
      AND "references"::jsonb -> 0 ->> 'civicaRole' = 'alternate'`);
  const flipImports = await db.execute(sql`
    UPDATE country_facts
    SET "references" = jsonb_set(
          "references"::jsonb,
          '{0,civicaRole}',
          '"canonical"'::jsonb,
          true
        ),
        updated_at = NOW()
    WHERE fact_key = 'imports_goods_services_usd'
      AND source_id = 'world_bank'
      AND "references"::jsonb -> 0 ->> 'civicaRole' = 'alternate'`);

  const rowsRoleFlipped = rc(flipExports) + rc(flipImports);
  if (rowsRoleFlipped > 0) {
    log(`  WB civicaRole flipped alternate→canonical on ${rowsRoleFlipped} rows`);
  }

  // Step 4 — tighten `sources.license` for `wto_stats` from
  // `'open_data_attribution'` to `'ODbL-1.0'`. Idempotent: only fires
  // when the license is still the loose pre-R.12 value. Note: the
  // `sources` table has no `updated_at` column (verified live in
  // schema.ts) — the per-row `last_sync_at` timestamp is what
  // sync orchestrators stamp at end-of-run.
  const licenseUpdate = await db.execute(sql`
    UPDATE sources
    SET license = 'ODbL-1.0'
    WHERE id = 'wto_stats' AND license = 'open_data_attribution'`);
  const licenseTightened = rc(licenseUpdate) > 0;
  if (licenseTightened) {
    log(`  sources.license for wto_stats tightened from 'open_data_attribution' → 'ODbL-1.0'`);
  }

  return {
    expectedFactKeysRemoved,
    rowsMigrated,
    rowsRoleFlipped,
    licenseTightened,
  };
}

/**
 * Run the WTO Stats sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert +
 * gated migration).
 */
export async function syncWtoStats(
  db: Db,
  options: WtoStatsSyncOptions = {},
): Promise<WtoStatsSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = WTO_STATS_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: WTO_STATS_VINTAGE,
      archiveBytes: 0,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      legacyMigration: {
        expectedFactKeysRemoved: [],
        rowsMigrated: 0,
        rowsRoleFlipped: 0,
        licenseTightened: false,
      },
      errors: ["no WTO Stats indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Run the legacy fact-key migration first. Idempotent and gated by
  // `WHERE fact_key = '<old>'` filters; subsequent runs no-op.
  log("→ R.12 legacy trade-aggregate fact-key migration…");
  let legacyMigration: WtoStatsSyncSummary["legacyMigration"];
  try {
    legacyMigration = await (options.runMigration ?? runLegacyMigration)(
      db,
      log,
      options.dryRun ?? false,
    );
  } catch (err) {
    errors.push(
      `legacy migration failed: ${
        err instanceof Error ? err.message : err
      }`,
    );
    legacyMigration = {
      expectedFactKeysRemoved: [],
      rowsMigrated: 0,
      rowsRoleFlipped: 0,
      licenseTightened: false,
    };
  }

  // Build iso3 → jurisdictionId map once; reused across all indicators.
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
  log(`${allJurisdictions.length} jurisdictions with ISO3 codes loaded.`);

  // Single bulk-download fetch + parse (vs. one per indicator).
  let allRows: WtoCsvRow[];
  let archiveBytes = 0;
  try {
    const result = await (options.fetchArchive ?? fetchAndParseMerchandiseCsv)(log);
    allRows = result.rows;
    archiveBytes = result.archiveBytes;
    log(`  parsed ${allRows.length} CSV rows (after filter)`);
  } catch (err) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: allJurisdictions.length,
      vintageLabel: WTO_STATS_VINTAGE,
      archiveBytes: 0,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      legacyMigration,
      errors: [
        `bulk-download fetch/parse failed: ${
          err instanceof Error ? err.message : err
        }`,
      ],
      dryRun: options.dryRun ?? false,
    };
  }

  const counters = new Map<string, PerWtoStatsCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.wtoIndicatorCode));
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
        `unknown fact-key '${config.factKey}' for WTO ${config.wtoIndicatorCode} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.wtoIndicatorCode} / product=${config.wtoProductCode} / partner=${config.wtoPartnerCode}) "${config.label}" — slicing…`,
    );

    const { latestByIso3, observationCount } = pickLatestPerCountry(
      allRows,
      config,
    );
    counter.observations = observationCount;
    counter.jurisdictions_with_value = latestByIso3.size;
    log(
      `  ${observationCount} observations matched; ${latestByIso3.size} ISO3 countries with latest value`,
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
      // not declare their own min/max. For the new R.12 trade
      // fact-keys, the envelope is `[100_000, 5_000_000_000_000]`
      // (USD raw, not percent), so neither isPercent fallback fires.
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

      // Bug 1 — value-type discriminator. WTO Stats does NOT publish
      // forecasts; every row is a measurement (final, refined
      // estimate, or preliminary estimate — all three are
      // measurements at `factYear` in Bug 1's sense). Set explicitly
      // per resolution Q6 (defensive convention).
      //
      // See ~/civica/plan/forecast-vs-measurement-v1.md +
      // ~/civica/plan/wto-stats-resolution-v1.md §2e + §6 Q6.
      const valueType: "measured" | "projected" = "measured";

      const upstreamPayload = {
        source: "wto_stats",
        endpoint: `${WTO_BULK_BASE_URL}/${WTO_MERCHANDISE_ARCHIVE}`,
        iso3: j.iso3,
        wtoIndicatorCode: config.wtoIndicatorCode,
        wtoProductCode: config.wtoProductCode,
        wtoPartnerCode: config.wtoPartnerCode,
        year: factYear,
        rawValue: dp.value,
        rawUnit: dp.unitCode,
        rawValueFlag: dp.valueFlag,
        transformedValue: numericValue,
        wtoVintage: WTO_STATS_VINTAGE,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "WTO Stats",
          // R.12 — Civica's canonical/alternate editorial role for
          // this (source, fact-key) pair. All R.12 indicators ship
          // as 'canonical' per resolution. WTO is canonical for the
          // merchandise-only aggregate; WB is canonical for the
          // goods+services aggregate at a different fact-key. Per
          // `~/civica/plan/wto-stats-resolution-v1.md` §2d.
          civicaRole: config.civicaRole ?? "canonical",
          // R.12 — per-row license metadata. ODbL v1.0 (commercial
          // use OK with attribution + share-alike). Per
          // `~/civica/plan/wto-stats-resolution-v1.md` §2i + §6 Q2.
          license: WTO_STATS_LICENSE,
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${factYear}, flag=${dp.valueFlag})`,
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
            sourceId: "wto_stats",
            upstreamRef: `wto:${j.iso3}:${config.wtoIndicatorCode}:${config.wtoProductCode}:${factYear}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: WTO_STATS_VINTAGE,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          });

        const snapshotIdRow = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'wto_stats' AND ${factSnapshots.payloadHash} = ${hash}`,
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
            sourceId: "wto_stats",
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
            upstreamVintageLabel: WTO_STATS_VINTAGE,
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
              upstreamVintageLabel: WTO_STATS_VINTAGE,
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
        `(unmatched ISO3: ${counter.skipped_no_jurisdiction}, ` +
        `envelope rejects: ${counter.rejected_envelope})`,
    );
  }

  await (options.markSynced ?? markSourcesSynced)("wto_stats", {
    rowsWritten: errors.length === 0 ? totalWritten : 0,
    dryRun: options.dryRun,
    executor: db,
  });

  // Phase F.6.1 — re-run the resolver on every (jurisdictionId,
  // factKey) we touched and persist any new disputes. Idempotent:
  // duplicates are filtered out by `persistProposedDisputes`. Note
  // post-R.12 the dispute volume on these fact-keys should be small
  // because WTO and WB no longer share fact-keys (the two-fact-key
  // split eliminates the WB-vs-WTO disagreement axis).
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

  const finishedAtMs = Date.now();
  const countersByFactKey: Record<string, PerWtoStatsCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    vintageLabel: WTO_STATS_VINTAGE,
    archiveBytes,
    countersByFactKey,
    totalWritten,
    disputes,
    legacyMigration,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
