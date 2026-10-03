/**
 * Phase R.3 — UN Population Division (WPP 2024) sync orchestrator.
 *
 * Direct sync from the official UN Population Division WPP 2024 bulk
 * download. The former UNData DownloadHandler now serves the UN Data
 * Commons application HTML instead of ZIP-CSV data, so it is not a valid
 * source endpoint. The replacement gzip CSV carries all seven demographic
 * indicators in one publisher row per country/year/variant.
 *
 * Key architectural differences from `sync-wdi.ts` / `sync-imf-weo.ts`:
 *   - One bounded, timed gzip-CSV download supplies all seven indicators.
 *   - The parser requires the official WPP columns and rejects malformed or
 *     duplicate 2024 country rows before any fact write begins.
 *   - Country join uses UN M49 numeric codes via a hard-coded
 *     `m49ToIso3` map. The bulk CSV's `LocID` is the M49 code; its
 *     `ISO3_code` is cross-checked when the M49 map has an entry.
 *   - One indicator (population_total) needs a unit transform:
 *     UNData ships population in thousands; multiply by 1000.
 *   - Population growth_rate (variableID 47) is in percent — same
 *     unit as Civica's fact-key. No transform.
 *   - Vintage label is the constant `UN_WPP_VINTAGE` —
 *     "UN WPP 2024 Revision" — refresh annually in July when the
 *     next biennial revision lands (next: 2026 Revision, mid-2026).
 *
 * The Phase F resolver picks between UN and WB / CIA / Wikidata
 * per methodology §3.3 — material-error guard + freshness preference.
 * The `civicaRole` field on each indicator config is informational
 * only (NOT used by the resolver); it persists into the fact row's
 * `references[].civicaRole` payload so the methodology page rewrite
 * (Phase R.23) can render canonical-vs-alternate without a separate
 * lookup. See `~/civica/plan/un-data-resolution-v1.md` §2d.
 *
 * UN WPP is canonical for the 5 fact-keys R.1 explicitly handed
 * off (`population_total`, `population_growth_rate`, `fertility_rate`,
 * `birth_rate`, `death_rate`) and canonical-until-WHO for two
 * fact-keys that R.4 will eventually own (`life_expectancy_years`,
 * `infant_mortality_per_1000`). Per R.6 Q5 the canonical-until-WHO
 * state ships as plain `'canonical'` in `civicaRole`; R.4 will
 * flip it to `'alternate'` by re-syncing.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.3
 * Resolution:  ~/civica/plan/un-data-resolution-v1.md
 */
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { sql } from "drizzle-orm";

import { factSnapshots, jurisdictions } from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import { fetchPublicHttpBytes } from "@/lib/net/public-http";
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

type Db = typeof import("@/lib/db").db;

export const UN_WPP_BULK_URL =
  "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz";
const UN_DATA_PORTAL_DOC_URL =
  "https://population.un.org/wpp/downloads?folder=Standard%20Projections&group=CSV%20format";
const UN_USER_AGENT = "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";
const UN_WPP_OBSERVATION_YEAR = 2024;
const UN_WPP_REQUEST_TIMEOUT_MS = 45_000;
const UN_WPP_MAX_COMPRESSED_BYTES = 32 * 1024 * 1024;
const UN_WPP_MAX_DECOMPRESSED_BYTES = 64 * 1024 * 1024;

const UN_WPP_VALUE_COLUMNS = [
  "TPopulation1July",
  "PopGrowthRate",
  "TFR",
  "CBR",
  "CDR",
  "LEx",
  "IMR",
] as const;

type UnWppValueColumn = (typeof UN_WPP_VALUE_COLUMNS)[number];

/**
 * Vintage label for the current WPP revision. WPP releases biennially
 * — the 2024 Revision shipped July 2024; the 2026 Revision is
 * expected mid-2026. Bump this constant when the next revision
 * lands; otherwise stays stable across quarterly cron runs.
 */
const UN_WPP_VINTAGE = "UN WPP 2024 Revision";

/**
 * Former UNData time identifier for 2024. Production no longer sends it to
 * the retired endpoint; it remains only in the legacy injected fixture seam.
 */
const LEGACY_UNDATA_TIME_ID = 75;

/**
 * One WPP bulk-file indicator we care about.
 */
export interface UnDataIndicatorConfig {
  /** Legacy UNData variableID retained for CLI/filter compatibility. */
  unVarId: number;
  /** Exact WPP 2024 bulk CSV column. */
  sourceColumn: UnWppValueColumn;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw UN value before envelope check
   *  and write. Default 1 — used when the UN unit matches the
   *  fact-key unit verbatim (e.g. % stays %, per 1000 stays per
   *  1000, years stay years). */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this UN indicator. Defaults to
   *  `'alternate'` when omitted. Persisted into the row's
   *  `references[].civicaRole` so the methodology page rewrite
   *  (R.23) can render canonical-vs-alternate without a separate
   *  lookup. Per `~/civica/plan/un-data-resolution-v1.md` §2d. */
  civicaRole?: CivicaSourceRole;
}

export const UN_DATA_INDICATORS: readonly UnDataIndicatorConfig[] = [
  // ─── Population (1 indicator) — UN canonical (R.1 handed off
  //     `'alternate'` for WB SP.POP.TOTL → R.3 inherits canonical).
  //     CRITICAL TRANSFORM: UN ships population in THOUSANDS;
  //     Civica's `population_total` envelope expects raw people
  //     [1_000, 2_000_000_000]. Transform: multiply by 1000.
  //     Verified 2026-05-04: Nigeria 2024 UN = 232,679.478 thousand
  //     → 232,679,478 ✓ matches WB exactly (WB republishes UN). ───
  {
    unVarId: 12,
    sourceColumn: "TPopulation1July",
    factKey: "population_total",
    label: "Total population, both sexes (Medium variant)",
    docUrl: UN_DATA_PORTAL_DOC_URL,
    valueTransform: (raw: number) => raw * 1000,
    civicaRole: "canonical",
  },

  // ─── Demographic rates (4 indicators) — UN canonical (R.1
  //     handed off `'alternate'` for each → R.3 inherits canonical).
  //     No unit transforms — UN ships in the same units Civica's
  //     fact-keys declare. Verified 2026-05-04: Nigeria 2024 UN
  //     vs Civica's existing WB rows are bit-equal because WB
  //     republishes UN. ───
  {
    unVarId: 47,
    sourceColumn: "PopGrowthRate",
    factKey: "population_growth_rate",
    label: "Population annual growth rate (per cent)",
    docUrl: UN_DATA_PORTAL_DOC_URL,
    civicaRole: "canonical",
  },
  {
    unVarId: 54,
    sourceColumn: "TFR",
    factKey: "fertility_rate",
    label: "Total fertility rate (births per woman)",
    docUrl: UN_DATA_PORTAL_DOC_URL,
    civicaRole: "canonical",
  },
  {
    unVarId: 53,
    sourceColumn: "CBR",
    factKey: "birth_rate",
    label: "Crude birth rate (per 1,000 population)",
    docUrl: UN_DATA_PORTAL_DOC_URL,
    civicaRole: "canonical",
  },
  {
    unVarId: 65,
    sourceColumn: "CDR",
    factKey: "death_rate",
    label: "Crude death rate (per 1,000 population)",
    docUrl: UN_DATA_PORTAL_DOC_URL,
    civicaRole: "canonical",
  },

  // ─── Health-overlap fact-keys (2 indicators) — UN canonical
  //     until WHO ships at R.4. Per R.3 resolution §6 Q5, the
  //     canonical-until-WHO state ships as plain 'canonical' in
  //     civicaRole; R.4 flips by re-sync. ───
  {
    unVarId: 66,
    sourceColumn: "LEx",
    factKey: "life_expectancy_years",
    label: "Life expectancy at birth, both sexes combined (years)",
    docUrl: UN_DATA_PORTAL_DOC_URL,
    civicaRole: "canonical",
  },
  {
    unVarId: 77,
    sourceColumn: "IMR",
    factKey: "infant_mortality_per_1000",
    label: "Infant mortality rate (per 1,000 live births)",
    docUrl: UN_DATA_PORTAL_DOC_URL,
    civicaRole: "canonical",
  },

  // ─── Median age remains deferred. The replacement bulk file carries
  //     `MedianAgePop`, but adding a new UN-backed fact is outside this
  //     source-repair scope and needs its own source/methodology decision. ───
];

/**
 * UN M49 numeric country code → ISO 3166-1 alpha-3 mapping for
 * sovereign states + territories Civica covers. Built from the
 * standard UN M49 registry; covers 197 sovereign states plus
 * commonly-recognized territories. Restricted to entities Civica's
 * `jurisdictions` table can plausibly match.
 *
 * The WPP bulk CSV ships the M49 numeric code as `LocID`. We use this rather
 * than country-name
 * matching because UN's English names sometimes diverge from
 * Civica's slug-derived names (e.g. "Bolivia (Plurinational State
 * of)", "Iran (Islamic Republic of)", "China, Taiwan Province of
 * China"). M49 codes are stable and standardized.
 *
 * Coverage: 237 countries+territories per WPP. Of those, ~191 map
 * to Civica jurisdictions with ISO3 codes. Aggregates (regions,
 * unions, BRICS) get M49 codes >900 and are filtered out by ISO3
 * lookup failing.
 *
 * R.8 / 2026-05-04: exported so `sync-fao-faostat.ts` can reuse
 * the same map without duplication. FAO FAOSTAT uses the same
 * UN M49 numeric area codes (in the `Area Code (M49)` column of
 * each CSV row). Per
 * `~/civica/plan/fao-faostat-resolution-v1.md` §2h + Q7. A future
 * Wave-3+ phase may promote this constant to a shared `m49.ts`
 * module; for now, importing from sync-un-data is zero-conflict.
 */
export const M49_TO_ISO3: Record<number, string> = {
  4: "AFG",
  8: "ALB",
  12: "DZA",
  16: "ASM",
  20: "AND",
  24: "AGO",
  28: "ATG",
  31: "AZE",
  32: "ARG",
  36: "AUS",
  40: "AUT",
  44: "BHS",
  48: "BHR",
  50: "BGD",
  51: "ARM",
  52: "BRB",
  56: "BEL",
  60: "BMU",
  64: "BTN",
  68: "BOL",
  70: "BIH",
  72: "BWA",
  76: "BRA",
  84: "BLZ",
  90: "SLB",
  92: "VGB",
  96: "BRN",
  100: "BGR",
  104: "MMR",
  108: "BDI",
  112: "BLR",
  116: "KHM",
  120: "CMR",
  124: "CAN",
  132: "CPV",
  136: "CYM",
  140: "CAF",
  144: "LKA",
  148: "TCD",
  152: "CHL",
  156: "CHN",
  158: "TWN",
  170: "COL",
  174: "COM",
  175: "MYT",
  178: "COG",
  180: "COD",
  184: "COK",
  188: "CRI",
  191: "HRV",
  192: "CUB",
  196: "CYP",
  203: "CZE",
  204: "BEN",
  208: "DNK",
  212: "DMA",
  214: "DOM",
  218: "ECU",
  222: "SLV",
  226: "GNQ",
  231: "ETH",
  232: "ERI",
  233: "EST",
  234: "FRO",
  238: "FLK",
  242: "FJI",
  246: "FIN",
  250: "FRA",
  254: "GUF",
  258: "PYF",
  262: "DJI",
  266: "GAB",
  268: "GEO",
  270: "GMB",
  275: "PSE",
  276: "DEU",
  288: "GHA",
  292: "GIB",
  296: "KIR",
  300: "GRC",
  304: "GRL",
  308: "GRD",
  312: "GLP",
  316: "GUM",
  320: "GTM",
  324: "GIN",
  328: "GUY",
  332: "HTI",
  336: "VAT",
  340: "HND",
  344: "HKG",
  348: "HUN",
  352: "ISL",
  356: "IND",
  360: "IDN",
  364: "IRN",
  368: "IRQ",
  372: "IRL",
  376: "ISR",
  380: "ITA",
  384: "CIV",
  388: "JAM",
  392: "JPN",
  398: "KAZ",
  400: "JOR",
  404: "KEN",
  408: "PRK",
  410: "KOR",
  414: "KWT",
  417: "KGZ",
  418: "LAO",
  422: "LBN",
  426: "LSO",
  428: "LVA",
  430: "LBR",
  434: "LBY",
  438: "LIE",
  440: "LTU",
  442: "LUX",
  446: "MAC",
  450: "MDG",
  454: "MWI",
  458: "MYS",
  462: "MDV",
  466: "MLI",
  470: "MLT",
  474: "MTQ",
  478: "MRT",
  480: "MUS",
  484: "MEX",
  492: "MCO",
  496: "MNG",
  498: "MDA",
  499: "MNE",
  500: "MSR",
  504: "MAR",
  508: "MOZ",
  512: "OMN",
  516: "NAM",
  520: "NRU",
  524: "NPL",
  528: "NLD",
  530: "ANT",
  531: "CUW",
  533: "ABW",
  534: "SXM",
  535: "BES",
  540: "NCL",
  548: "VUT",
  554: "NZL",
  558: "NIC",
  562: "NER",
  566: "NGA",
  570: "NIU",
  574: "NFK",
  578: "NOR",
  580: "MNP",
  581: "UMI",
  583: "FSM",
  584: "MHL",
  585: "PLW",
  586: "PAK",
  591: "PAN",
  598: "PNG",
  600: "PRY",
  604: "PER",
  608: "PHL",
  612: "PCN",
  616: "POL",
  620: "PRT",
  624: "GNB",
  626: "TLS",
  630: "PRI",
  634: "QAT",
  638: "REU",
  642: "ROU",
  643: "RUS",
  646: "RWA",
  652: "BLM",
  654: "SHN",
  659: "KNA",
  660: "AIA",
  662: "LCA",
  663: "MAF",
  666: "SPM",
  670: "VCT",
  674: "SMR",
  678: "STP",
  682: "SAU",
  686: "SEN",
  688: "SRB",
  690: "SYC",
  694: "SLE",
  702: "SGP",
  703: "SVK",
  704: "VNM",
  705: "SVN",
  706: "SOM",
  710: "ZAF",
  716: "ZWE",
  724: "ESP",
  728: "SSD",
  729: "SDN",
  732: "ESH",
  740: "SUR",
  744: "SJM",
  748: "SWZ",
  752: "SWE",
  756: "CHE",
  760: "SYR",
  762: "TJK",
  764: "THA",
  768: "TGO",
  772: "TKL",
  776: "TON",
  780: "TTO",
  784: "ARE",
  788: "TUN",
  792: "TUR",
  795: "TKM",
  796: "TCA",
  798: "TUV",
  800: "UGA",
  804: "UKR",
  807: "MKD",
  818: "EGY",
  826: "GBR",
  831: "GGY",
  832: "JEY",
  833: "IMN",
  834: "TZA",
  840: "USA",
  850: "VIR",
  854: "BFA",
  858: "URY",
  860: "UZB",
  862: "VEN",
  876: "WLF",
  882: "WSM",
  887: "YEM",
  894: "ZMB",
};

/**
 * Normalized single-indicator row used by the established sync fixture seam
 * and derived from one field in a WPP bulk row in production.
 */
export interface UnDataRow {
  countryCode: number;
  countryName: string;
  year: number;
  variant: string;
  value: number;
}

export interface PerUnDataCounters {
  factKey: string;
  unVarId: number;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  skipped_no_iso3: number;
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
  /** Variant rows ignored (we only keep `Variant === "Medium"`). */
  skipped_non_medium: number;
}

export interface UnDataSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  vintageLabel: string;
  countersByFactKey: Record<string, PerUnDataCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface UnDataSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific UN PopDiv variableID (for testing). */
  unVarId?: number;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
  /** Deterministic fixture seams; production callers omit these. */
  fetchBulk?: () => Promise<Uint8Array>;
  /** Legacy per-indicator fixture seam retained for existing tests. */
  fetchIndicator?: (unVarId: number, timeId: number) => Promise<UnDataRow[]>;
  jurisdictions?: UnDataJurisdiction[];
  persistDisputes?: typeof persistProposedDisputes;
  markSynced?: typeof markSourcesSynced;
  atlasReleaseId?: string;
  writeFact?: CountryFactHistoryWriter;
}

export interface UnDataJurisdiction {
  id: string;
  slug: string;
  iso3: string | null;
}

function freshCounters(factKey: string, unVarId: number): PerUnDataCounters {
  return {
    factKey,
    unVarId,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_no_iso3: 0,
    skipped_no_jurisdiction: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    skipped_non_medium: 0,
  };
}

interface UnWppBulkRow {
  countryCode: number;
  countryName: string;
  iso3: string;
  year: number;
  variant: "Medium";
  values: Record<UnWppValueColumn, number>;
}

function* csvRecords(csv: string): Generator<string[]> {
  let field = "";
  let record: string[] = [];
  let quoted = false;

  for (let index = 0; index < csv.length; index++) {
    const character = csv[index];
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error("UN WPP CSV contains an unexpected quote");
      }
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field);
      field = "";
      if (record.some((cell) => cell.length > 0)) yield record;
      record = [];
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) throw new Error("UN WPP CSV contains an unterminated quote");
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    if (record.some((cell) => cell.length > 0)) yield record;
  }
}

function parseStrictNumber(value: string, label: string): number {
  const trimmed = value.trim();
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    throw new Error(`UN WPP ${label} is not a finite number`);
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`UN WPP ${label} is not a finite number`);
  }
  return parsed;
}

function parseUnWppBulk(archive: Uint8Array): UnWppBulkRow[] {
  if (archive.byteLength === 0) throw new Error("UN WPP gzip payload is empty");
  if (archive.byteLength > UN_WPP_MAX_COMPRESSED_BYTES) {
    throw new Error("UN WPP gzip payload exceeds the compressed-byte limit");
  }
  if (archive[0] !== 0x1f || archive[1] !== 0x8b) {
    throw new Error("UN WPP source did not return a gzip payload");
  }

  let csv: string;
  try {
    csv = gunzipSync(Buffer.from(archive), {
      maxOutputLength: UN_WPP_MAX_DECOMPRESSED_BYTES,
    }).toString("utf8");
  } catch (error) {
    throw new Error(
      `UN WPP gzip decode failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  const records = csvRecords(csv);
  const headerRecord = records.next();
  if (headerRecord.done) throw new Error("UN WPP CSV is empty");
  const headers = headerRecord.value.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "") : header,
  );
  if (new Set(headers).size !== headers.length) {
    throw new Error("UN WPP CSV contains duplicate headers");
  }
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = [
    "LocID",
    "ISO3_code",
    "Location",
    "Variant",
    "Time",
    ...UN_WPP_VALUE_COLUMNS,
  ];
  const missingHeaders = requiredHeaders.filter(
    (header) => !headerIndex.has(header),
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `UN WPP CSV is missing required headers: ${missingHeaders.join(", ")}`,
    );
  }

  const valueAt = (record: string[], header: string) =>
    record[headerIndex.get(header)!];
  const seenCountryYears = new Set<string>();
  const rows: UnWppBulkRow[] = [];
  let recordNumber = 1;
  for (const record of records) {
    recordNumber++;
    if (record.length !== headers.length) {
      throw new Error(
        `UN WPP CSV row ${recordNumber} has ${record.length} columns; expected ${headers.length}`,
      );
    }

    const iso3 = valueAt(record, "ISO3_code").trim().toUpperCase();
    if (!iso3) continue;
    if (!/^[A-Z]{3}$/.test(iso3)) {
      throw new Error(`UN WPP row ${recordNumber} has an invalid ISO3 code`);
    }

    const year = parseStrictNumber(
      valueAt(record, "Time"),
      `row ${recordNumber} Time`,
    );
    if (!Number.isInteger(year)) {
      throw new Error(`UN WPP row ${recordNumber} Time is not an integer year`);
    }
    if (year !== UN_WPP_OBSERVATION_YEAR) continue;

    const variant = valueAt(record, "Variant").trim();
    if (variant !== "Medium") {
      throw new Error(
        `UN WPP row ${recordNumber} has unexpected variant '${variant}'`,
      );
    }
    const countryCode = parseStrictNumber(
      valueAt(record, "LocID"),
      `row ${recordNumber} LocID`,
    );
    if (!Number.isInteger(countryCode) || countryCode < 1) {
      throw new Error(`UN WPP row ${recordNumber} LocID is not a positive integer`);
    }
    const countryName = valueAt(record, "Location").trim();
    if (!countryName) {
      throw new Error(`UN WPP row ${recordNumber} has an empty Location`);
    }
    const expectedIso3 = M49_TO_ISO3[countryCode];
    if (expectedIso3 && expectedIso3 !== iso3) {
      throw new Error(
        `UN WPP row ${recordNumber} ISO3 does not match its LocID`,
      );
    }

    const duplicateKey = `${iso3}:${year}`;
    if (seenCountryYears.has(duplicateKey)) {
      throw new Error(`UN WPP CSV contains duplicate country-year ${duplicateKey}`);
    }
    seenCountryYears.add(duplicateKey);

    const values = Object.fromEntries(
      UN_WPP_VALUE_COLUMNS.map((column) => [
        column,
        parseStrictNumber(
          valueAt(record, column),
          `row ${recordNumber} ${column}`,
        ),
      ]),
    ) as Record<UnWppValueColumn, number>;
    rows.push({
      countryCode,
      countryName,
      iso3,
      year,
      variant: "Medium",
      values,
    });
  }

  if (rows.length === 0) {
    throw new Error(
      `UN WPP CSV has no ISO3 country observations for ${UN_WPP_OBSERVATION_YEAR}`,
    );
  }
  return rows;
}

async function fetchUnWppBulk(): Promise<Uint8Array> {
  const response = await fetchPublicHttpBytes(UN_WPP_BULK_URL, {
    headers: {
      "User-Agent": UN_USER_AGENT,
      Accept: "application/gzip, application/octet-stream",
    },
    maxBodyBytes: UN_WPP_MAX_COMPRESSED_BYTES,
    maxWireBytes: UN_WPP_MAX_COMPRESSED_BYTES,
    signal: AbortSignal.timeout(UN_WPP_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`UN WPP bulk download failed with HTTP ${response.status}`);
  }
  return response.body;
}

function rowsForIndicator(
  bulkRows: readonly UnWppBulkRow[],
  config: UnDataIndicatorConfig,
): UnDataRow[] {
  return bulkRows.map((row) => ({
    countryCode: row.countryCode,
    countryName: row.countryName,
    year: row.year,
    variant: row.variant,
    value: row.values[config.sourceColumn],
  }));
}

/**
 * From all-variant rows for a single (indicator, year), pick the
 * one Medium-variant row per country. Returns a map keyed by
 * uppercase ISO3 (translated from M49 via `M49_TO_ISO3`).
 *
 * UN aggregate codes (>900 etc.) and codes not in our M49 mapping
 * are filtered out — they correspond to regions/unions/BRICS not
 * to sovereign states.
 */
function pickMediumPerCountry(rows: UnDataRow[]): Map<string, UnDataRow> {
  const out = new Map<string, UnDataRow>();
  for (const r of rows) {
    if (r.variant !== "Medium") continue;
    const iso3 = M49_TO_ISO3[r.countryCode];
    if (!iso3) continue; // aggregate or unmapped territory
    out.set(iso3, r);
  }
  return out;
}

/**
 * Run the UN WPP sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncUnData(
  db: Db,
  options: UnDataSyncOptions = {},
): Promise<UnDataSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = UN_DATA_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.unVarId && c.unVarId !== options.unVarId) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: UN_WPP_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no UN PopDiv indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }
  const atlasReleaseId = options.dryRun
    ? undefined
    : resolveAtlasReleaseId(options.atlasReleaseId);
  const writeFact = options.writeFact ?? upsertCountryFactWithHistory;

  // Build iso3 → jurisdictionId map once; reused across all
  // indicators.
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

  const counters = new Map<string, PerUnDataCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.unVarId));
  }

  let bulkRows: UnWppBulkRow[] | null = null;
  let bulkInputSha256: string | null = null;
  let bulkCompressedBytes: number | null = null;
  if (!options.fetchIndicator) {
    try {
      const archive = await (options.fetchBulk ?? fetchUnWppBulk)();
      bulkInputSha256 = createHash("sha256").update(archive).digest("hex");
      bulkCompressedBytes = archive.byteLength;
      bulkRows = parseUnWppBulk(archive);
      log(
        `Fetched one WPP 2024 bulk file with ${bulkRows.length} ISO3 country rows.`,
      );
    } catch (error) {
      errors.push(
        `UN WPP bulk fetch failed: ${error instanceof Error ? error.message : error}`,
      );
    }
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
        `unknown fact-key '${config.factKey}' for UN variableID ${config.unVarId} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (UN vid=${config.unVarId}) "${config.label}" — reading ${config.sourceColumn}…`,
    );

    let rows: UnDataRow[];
    if (options.fetchIndicator) {
      try {
        rows = await options.fetchIndicator(
          config.unVarId,
          LEGACY_UNDATA_TIME_ID,
        );
      } catch (err) {
        errors.push(
          `UN vid ${config.unVarId} fetch failed: ${
            err instanceof Error ? err.message : err
          }`,
        );
        recordRequiredSubfeedOutcome({
          errors,
          source: "UN Data",
          target: `${config.factKey} (variable ${config.unVarId})`,
          rowsWritten: 0,
        });
        continue;
      }
    } else if (bulkRows) {
      rows = rowsForIndicator(bulkRows, config);
    } else {
      recordRequiredSubfeedOutcome({
        errors,
        source: "UN Data",
        target: `${config.factKey} (column ${config.sourceColumn})`,
        rowsWritten: 0,
      });
      continue;
    }
    counter.observations = rows.length;
    counter.skipped_non_medium = rows.filter(
      (r) => r.variant !== "Medium",
    ).length;
    log(
      `  fetched ${rows.length} rows (${counter.skipped_non_medium} non-Medium variants will be skipped)`,
    );

    const mediumByIso3 = pickMediumPerCountry(rows);
    counter.jurisdictions_with_value = mediumByIso3.size;
    log(`  ${mediumByIso3.size} sovereign-state ISO3 codes mapped from M49`);

    for (const [iso3, dp] of mediumByIso3) {
      const j = iso3ToJurisdiction.get(iso3);
      if (!j) {
        counter.skipped_no_jurisdiction++;
        continue;
      }

      const transform = config.valueTransform ?? ((v: number) => v);
      const numericValue = transform(dp.value);

      // Plausibility envelope per fact-key registry §3.6.
      // R.1.1 fix: when isPercent is true, the [-1, 101] range is
      // only a fallback for fact-keys that do not declare their own
      // min/max. When min/max are explicitly set in the fact-key
      // definition (e.g. population_growth_rate min:-10), the
      // per-fact-key values take precedence. Inline-implemented per
      // user sign-off Q2: do NOT extract a shared helper this round
      // (R.2 + R.4 in parallel would tangle the audit trail). Mirror
      // the pattern from `sync-wdi.ts` lines 619–633 verbatim;
      // shared-helper extraction is a small follow-up after R.3 +
      // R.4 land. See ~/civica/plan/un-data-resolution-v1.md §6 Q2.
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

      const upstreamPayload = {
        source: "un_data",
        endpoint: UN_WPP_BULK_URL,
        inputSha256: bulkInputSha256,
        inputCompressedBytes: bulkCompressedBytes,
        iso3: j.iso3,
        legacyUnDataVariableId: config.unVarId,
        sourceColumn: config.sourceColumn,
        m49Code: dp.countryCode,
        countryName: dp.countryName,
        year: factYear,
        variant: dp.variant,
        rawValue: dp.value,
        transformedValue: numericValue,
        wppVintage: UN_WPP_VINTAGE,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "UN Statistics Division",
          // Civica's canonical/alternate editorial role for this
          // (source, fact-key) pair. Default 'alternate' when
          // omitted on the indicator config. See
          // `~/civica/plan/un-data-resolution-v1.md` §2d.
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
            sourceId: "un_data",
            upstreamRef: `un:${j.iso3}:${config.unVarId}:${factYear}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: UN_WPP_VINTAGE,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          });

        const snapshotIdRow = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'un_data' AND ${factSnapshots.payloadHash} = ${hash}`,
          )
          .limit(1);
        const snapshotId = snapshotIdRow[0]?.id ?? null;

        const values = {
          jurisdictionId: j.id,
          factKey: config.factKey,
          factGroup: factKeyDef.group,
          category: factKeyDef.category,
          sourceId: "un_data",
          sourceUrl: UN_WPP_BULK_URL,
          references: referencesPayload,
          sourceHash: hash,
          factValue: String(numericValue),
          factValueNumeric: numericValue,
          factUnit: factKeyDef.unit ?? null,
          factYear,
          valueJson: null,
          asOf,
          retrievedAt: new Date(),
          upstreamVintageLabel: UN_WPP_VINTAGE,
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
      source: "UN Data",
      target: `${config.factKey} (variable ${config.unVarId})`,
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
    sourceIds: "un_data",
    rowsWritten: totalWritten,
    dryRun: options.dryRun,
    executor: db,
    errors,
    markSynced: options.markSynced ?? markSourcesSynced,
  });

  const finishedAtMs = Date.now();
  const countersByFactKey: Record<string, PerUnDataCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    vintageLabel: UN_WPP_VINTAGE,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
