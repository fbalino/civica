/**
 * Phase R.11 — Eurostat sync orchestrator.
 *
 * Direct sync from Eurostat's SDMX 2.1 REST API serving JSON-stat 2.0
 * format at `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/`.
 * Mirrors the F.6 / R.1 / R.2 / R.3 / R.4 / R.5 / R.6 / R.7 / R.8 / R.10
 * pattern. Ships 5 indicators from Eurostat's stable annual statistical
 * surveillance datasets:
 *
 *   1. `prc_hicp_aind` (HICP, annual rate of change) → `inflation_rate`
 *   2. `tec00115` (Real GDP growth rate, volume)     → `gdp_real_growth_rate`
 *   3. `une_rt_a`     (LFS unemployment % active pop) → `unemployment_rate_pct`
 *   4. `tec00127` (General gov't deficit/surplus % GDP) → `fiscal_balance_pct_gdp`
 *   5. `tipsgo10` (General gov't gross debt EDP % GDP)  → `public_debt_pct_gdp`
 *
 * All ship as `civicaRole: 'canonical'` for the EU-27 + EFTA-4 subset
 * (31 jurisdictions). Per
 * `~/civica/plan/eurostat-resolution-v1.md` §2d, this is the
 * **multi-canonical-with-scope-predicate** pattern: Eurostat is
 * canonical for those 31 jurisdictions; existing IMF/WB/OECD/ILO
 * `civicaRole='canonical'` tags STAY in place (no re-tagging). The
 * methodology page (R.23) renders multiple canonicals with their
 * scope predicates. User's grounding (2026-05-04 sign-off): "for
 * European countries this is mostly publisher transparency rather
 * than independent verification, and that's a fact about the world
 * to be honest about, not a bug."
 *
 * **EU+EFTA-only scope.** Like R.7 OECD, R.11 writes rows for a
 * bounded member set ONLY. For non-EU/EFTA jurisdictions, Eurostat
 * is not canonical; Civica's resolver continues using IMF/WB/OECD/
 * ILO/etc. The Eurostat API returns ~38–45 geo codes per indicator
 * (incl. UK, US, EU candidates as partner-country republications);
 * the sync filters to the 31-member set client-side via the
 * hardcoded `EU_EFTA_ISO2` set.
 *
 * **JSON-stat 2.0 parsing — observation-keyed, not series-keyed.**
 * Eurostat's API serves a flat `{ value: { K: number } }` map where K
 * is an integer index into the row-major-strided dimension cube. The
 * walker:
 *  1. Reads `id` (dim names in order) + `size` (cardinality per dim).
 *  2. Computes strides per dim (`stride[i] = product(size[i+1..])`).
 *  3. For each `value[K]`, decodes K via repeated div-mod against
 *     strides into the integer index per dim.
 *  4. Looks up the code for that index via `dimension.<name>.category.index`
 *     (or `Object.keys(label)` order if `index` is missing — e.g. for
 *     single-value dims).
 *  5. Returns the (geo_code, year, value) triple after applying the
 *     EU+EFTA filter and translating ISO2 anomalies (EL→GR, UK→GB).
 *
 * **Eurostat geo codes use ISO 3166-1 alpha-2 with two anomalies**
 * inherited from EU institutional practice:
 *  - `EL` = Greece (vs ISO `GR`). Pre-1991 EU/EC convention.
 *  - `UK` = United Kingdom (vs ISO `GB`). Same legacy convention.
 * The sync's `eurostatToIso2()` helper handles both.
 *
 * **value_type per Bug 1 forward policy.** Default `'measured'` for
 * all R.11 rows. Year-based discriminator (year > current_year →
 * 'projected') fires defensively at write time, but the 5 R.11
 * datasets ship measured/realized data only — no forecast horizons
 * expected. The `projection_rows` counter stays at 0 in normal sync
 * runs.
 *
 * **License: Creative Commons Attribution 4.0 International (CC BY 4.0)**
 * per the European Commission Legal Notice. Commercial-use OK with
 * attribution. Same posture as R.8 FAO. The Civica `sources` row
 * already encodes `is_commercial_use_allowed: true` and
 * `license: "CC-BY-4.0"`.
 *
 * The Phase F resolver picks between Eurostat and IMF/WB/OECD/ILO
 * per methodology §3.3 — material-error guard + freshness preference
 * WITH Bug 1's `value_type` partition. The `civicaRole` field on
 * each indicator config is informational only (NOT used by the
 * resolver); it persists into the fact row's `references[].civicaRole`
 * payload so the methodology page rewrite (Phase R.23) can render
 * scope-bounded canonical attribution without a separate lookup.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.11
 * Resolution:  ~/civica/plan/eurostat-resolution-v1.md
 * Bug 1:       ~/civica/plan/forecast-vs-measurement-v1.md
 */
import { sql } from "drizzle-orm";

import { countryFacts, factSnapshots, jurisdictions } from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
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

const EUROSTAT_BASE_URL =
  "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data";
const EUROSTAT_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Civica-side vintage label for Eurostat rows. The Eurostat API
 * does not expose a single vintage string per dataset the way IMF
 * WEO does — different datasets refresh on different cadences (HICP
 * monthly, real GDP quarterly, EDP twice yearly). The per-row
 * vintage is captured from the dataset's `updated` timestamp and
 * stamped into the per-row metadata as `eurostatVintage`. The
 * Civica-side label is mostly cosmetic at the F.6 level.
 */
const EUROSTAT_VINTAGE = "Eurostat ESA 2010 2026Q3";

/**
 * License string stamped into per-row references payload. Mirrors
 * the R.4 / R.7 / R.8 / R.10 precedent.
 */
const EUROSTAT_LICENSE = "CC-BY-4.0";

/**
 * The 31 EU + EFTA member states in R.11 ship scope. ISO 3166-1
 * alpha-3 codes (Civica's `jurisdictions` table key). The sync
 * translates Eurostat's ISO2 anomalies (EL→GR, UK→GB) before the
 * ISO2→ISO3 lookup; this constant is the post-translation set.
 *
 * - **EU-27** (Eurostat's primary scope): AUT, BEL, BGR, HRV, CYP,
 *   CZE, DNK, EST, FIN, FRA, DEU, GRC, HUN, IRL, ITA, LVA, LTU,
 *   LUX, MLT, NLD, POL, PRT, ROU, SVK, SVN, ESP, SWE.
 * - **EFTA-4** (covered via the EEA agreement; Eurostat treats
 *   methodology-equivalently to EU members for the 5 R.11 indicators):
 *   ISL, LIE, NOR, CHE.
 *
 * **Excluded** per the resolution §2c:
 * - **UK** (post-Brexit): canonical defers to ONS (R.14 NSO scope).
 *   Eurostat-published UK data is partner-country republication.
 * - **EU candidates** (ALB, BIH, MKD, MNE, SRB, TUR, UKR, MDA, GEO,
 *   XKX): Eurostat publishes via IPA framework with documented
 *   methodology gaps. NSO is the right canonical (defer to v1.1+).
 * - **US** (HICP partner): Eurostat republishes BLS CPI with
 *   partial harmonization. BLS NSO is the right canonical.
 *
 * When the EU/EFTA member set changes (next plausible accession:
 * Albania, Montenegro, North Macedonia 2027–2030), update this
 * constant + bump the resolution doc to v1.1 with a changelog
 * entry. Per `~/civica/plan/eurostat-resolution-v1.md` §6 Q9.
 */
export const EU_EFTA_ISO3: readonly string[] = [
  // EU-27
  "AUT",
  "BEL",
  "BGR",
  "HRV",
  "CYP",
  "CZE",
  "DNK",
  "EST",
  "FIN",
  "FRA",
  "DEU",
  "GRC",
  "HUN",
  "IRL",
  "ITA",
  "LVA",
  "LTU",
  "LUX",
  "MLT",
  "NLD",
  "POL",
  "PRT",
  "ROU",
  "SVK",
  "SVN",
  "ESP",
  "SWE",
  // EFTA-4
  "ISL",
  "LIE",
  "NOR",
  "CHE",
];

/**
 * Eurostat ISO2 → ISO3-standard ISO2 anomaly translation. Two
 * exceptions from EU institutional practice:
 *  - EL → GR (Greece): pre-1991 EU/EC convention.
 *  - UK → GB (United Kingdom): same legacy convention.
 *
 * For every other ISO2 code, Eurostat aligns with ISO 3166-1 alpha-2
 * verbatim. The sync calls this function before the ISO2→ISO3
 * lookup against Civica's `jurisdictions.iso2` column.
 */
function eurostatToIso2(eurostatCode: string): string {
  if (eurostatCode === "EL") return "GR";
  if (eurostatCode === "UK") return "GB";
  return eurostatCode;
}

/**
 * One Eurostat indicator we care about. The Eurostat dissemination
 * API queries the SDMX 2.1 endpoint with a positional dot-separated
 * dimension filter per dataset. Each entry encodes the dataset code
 * plus the dimension filter string.
 *
 * The optional `valueTransform` lets us reshape upstream units to
 * fact-key units. All 5 R.11 indicators ship with identity transforms
 * (Eurostat's % matches our %; Eurostat's % of GDP matches our % of
 * GDP).
 */
export interface EurostatIndicatorConfig {
  /** Eurostat dataset code, e.g. "prc_hicp_aind". */
  dataset: string;
  /** Positional dimension filter. Dot-separated, with empty
   *  positions for wildcards. The geo dimension is always wildcard
   *  so the response covers all EU+EFTA + partner countries; the
   *  filter pins the methodologically-canonical (UNIT, MEASURE,
   *  COICOP, etc.) values. */
  dimensionFilter: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw Eurostat value before envelope
   *  check and write. Default 1 — used when the Eurostat unit
   *  matches the fact-key unit verbatim. All 5 R.11 indicators are
   *  identity. */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this Eurostat indicator. R.11
   *  ships all 5 indicators as `'canonical'` for EU+EFTA per the
   *  resolution §2d. The Phase F resolver does NOT use this field
   *  for runtime selection (the resolver is freshness-driven per
   *  methodology §3.3); the field is informational metadata for
   *  the methodology page rewrite at Phase R.23. Mirrors R.7's
   *  `OecdStatIndicatorConfig.civicaRole`. */
  civicaRole?: CivicaSourceRole;
}

/**
 * The 5 Eurostat indicators in R.11 ship scope. All from Eurostat's
 * stable annual surveillance datasets. Per
 * `~/civica/plan/eurostat-resolution-v1.md` §2b.
 *
 * Filter dimension positions per dataset (verified live 2026-05-04):
 *
 *  - `prc_hicp_aind` (HICP annual rate of change):
 *      0. FREQ (A = annual)
 *      1. UNIT (RCH_A_AVG = annual rate of change, average)
 *      2. COICOP (CP00 = all-items)
 *      3. GEO (wildcard)
 *
 *  - `tec00115` (Real GDP growth rate, volume):
 *      0. FREQ (A = annual)
 *      1. UNIT (CLV_PCH_PRE = chain-linked volumes, % change on prev period)
 *      2. NA_ITEM (B1GQ = GDP at market prices)
 *      3. GEO (wildcard)
 *
 *  - `une_rt_a` (Unemployment by sex and age, annual):
 *      0. FREQ (A)
 *      1. AGE (Y15-74 = working-age population, harmonised LFS)
 *      2. UNIT (PC_ACT = % of active population)
 *      3. SEX (T = total)
 *      4. GEO (wildcard)
 *
 *  - `tec00127` (General gov't deficit/surplus, % GDP):
 *      0. FREQ (A)
 *      1. UNIT (PC_GDP = % of GDP)
 *      2. SECTOR (S13 = general government)
 *      3. NA_ITEM (B9 = net lending(+) / net borrowing(-))
 *      4. GEO (wildcard)
 *
 *  - `tipsgo10` (General gov't gross debt EDP, consolidated, % GDP):
 *      0. FREQ (A)
 *      1. NA_ITEM (GD = government consolidated gross debt)
 *      2. SECTOR (S13)
 *      3. UNIT (PC_GDP)
 *      4. GEO (wildcard)
 */
export const EUROSTAT_INDICATORS: readonly EurostatIndicatorConfig[] = [
  {
    dataset: "prc_hicp_aind",
    dimensionFilter: "A.RCH_A_AVG.CP00.",
    factKey: "inflation_rate",
    label: "HICP — annual rate of change (Eurostat harmonized)",
    docUrl:
      "https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_aind/default/table",
    civicaRole: "canonical",
  },
  {
    dataset: "tec00115",
    dimensionFilter: "A.CLV_PCH_PRE.B1GQ.",
    factKey: "gdp_real_growth_rate",
    label: "Real GDP growth rate (volume, ESA 2010)",
    docUrl:
      "https://ec.europa.eu/eurostat/databrowser/view/tec00115/default/table",
    civicaRole: "canonical",
  },
  {
    dataset: "une_rt_a",
    dimensionFilter: "A.Y15-74.PC_ACT.T.",
    factKey: "unemployment_rate_pct",
    label: "Unemployment rate, ages 15–74 (LFS, % of active population)",
    docUrl:
      "https://ec.europa.eu/eurostat/databrowser/view/une_rt_a/default/table",
    civicaRole: "canonical",
  },
  {
    dataset: "tec00127",
    dimensionFilter: "A.PC_GDP.S13.B9.",
    factKey: "fiscal_balance_pct_gdp",
    label: "General government deficit / surplus, % of GDP (EDP / Maastricht)",
    docUrl:
      "https://ec.europa.eu/eurostat/databrowser/view/tec00127/default/table",
    civicaRole: "canonical",
  },
  {
    dataset: "tipsgo10",
    dimensionFilter: "A.GD.S13.PC_GDP.",
    factKey: "public_debt_pct_gdp",
    label:
      "General government gross debt, EDP, consolidated, % of GDP (Maastricht)",
    docUrl:
      "https://ec.europa.eu/eurostat/databrowser/view/tipsgo10/default/table",
    civicaRole: "canonical",
  },
];

/**
 * JSON-stat 2.0 envelope as served by Eurostat's dissemination API.
 * Subset — only the fields the parser needs.
 */
interface EurostatJsonStatResponse {
  /** JSON-stat version. Always "2.0" for the Eurostat API. */
  version?: string;
  /** Always "dataset" for our queries. */
  class?: string;
  /** Human-readable dataset label (e.g. "HICP — annual data ..."). */
  label?: string;
  /** Source string ("ESTAT"). */
  source?: string;
  /** Last-update ISO8601 timestamp string. */
  updated?: string;
  /** Sparse map of integer index → numeric value. */
  value?: Record<string, number | null>;
  /** Status map keyed identically to `value` — flags like "OBSOLETE",
   *  "BREAK", "PROVISIONAL". Not yet surfaced; reserved for future
   *  per-row metadata. */
  status?: Record<string, string>;
  /** Dimension-name order, e.g. ["freq", "unit", "geo", "time"]. */
  id?: string[];
  /** Dimension cardinalities aligned with `id`. */
  size?: number[];
  /** Per-dim metadata keyed by dim name. */
  dimension?: Record<string, EurostatJsonStatDimension>;
  /** Optional error envelope for client-side validation failures. */
  error?: Array<{ status?: number; id?: number; label?: string }>;
}

interface EurostatJsonStatDimension {
  /** Optional human-readable dim label. */
  label?: string;
  /** The lookup the parser cares about. */
  category: {
    /** Map of code → integer index. May be absent for single-value
     *  dims; build from `Object.keys(label)` order if missing. */
    index?: Record<string, number>;
    /** Map of code → human-readable label. */
    label: Record<string, string>;
  };
}

/**
 * Per-indicator counter shape. Mirrors the IMF / WHO / OECD / ILO
 * patterns.
 */
export interface PerEurostatCounters {
  factKey: string;
  dataset: string;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  /** Observations belonging to non-EU+EFTA countries (UK, US,
   *  candidates, aggregates). Silently dropped per the resolution §2c
   *  scope decision. */
  skipped_non_eu_efta_member: number;
  /** Observations whose ISO2 doesn't resolve to a Civica jurisdiction
   *  (after the EL→GR / UK→GB translation). Should be zero in normal
   *  runs because all 31 EU+EFTA targets are confirmed in
   *  jurisdictions; non-zero indicates a coverage regression. */
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
  /** Counter for forecast-year rows landed (year > current calendar
   *  year). Defensive — the 5 R.11 datasets ship measured-only data;
   *  this counter should stay at 0 in normal sync runs. */
  projection_rows: number;
  /** Per-indicator vintage timestamp (Eurostat's `updated` field).
   *  Captured per-fetch and persisted into the per-row references
   *  payload as `eurostatVintage`. */
  upstreamUpdated: string | null;
}

export interface EurostatSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  vintageLabel: string;
  countersByFactKey: Record<string, PerEurostatCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface EurostatSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific Eurostat dataset code (for testing). */
  dataset?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
  /** Deterministic fixture seams; production callers omit these. */
  fetchIndicator?: typeof fetchIndicator;
  jurisdictions?: EurostatJurisdiction[];
  persistDisputes?: typeof persistProposedDisputes;
  markSynced?: typeof markSourcesSynced;
}

export interface EurostatJurisdiction {
  id: string;
  slug: string;
  iso2: string | null;
  iso3: string | null;
}

function freshCounters(factKey: string, dataset: string): PerEurostatCounters {
  return {
    factKey,
    dataset,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    skipped_non_eu_efta_member: 0,
    skipped_no_jurisdiction: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    projection_rows: 0,
    upstreamUpdated: null,
  };
}

/**
 * Build the JSON-stat data fetch URL.
 *
 * Pattern: `<BASE>/<DATASET>/<FILTER>?format=JSON&lastTimePeriod=N`
 *
 * `lastTimePeriod=10` keeps payload sizes ~30KB per indicator while
 * giving a generous 10-year window so the latest-non-null-year
 * selector finds something even for indicators with publication
 * lags (e.g. EDP debt for some smaller members lags ~2 years).
 */
function buildDataUrl(config: EurostatIndicatorConfig): string {
  return (
    `${EUROSTAT_BASE_URL}/${config.dataset}/${config.dimensionFilter}` +
    `?format=JSON&lastTimePeriod=10`
  );
}

/**
 * Build the integer-index → code lookup for one dimension. Eurostat
 * sometimes ships `category.index` (a map of code→index) and sometimes
 * doesn't (for single-value dims). When absent, we infer from the
 * key order in `category.label`.
 */
function buildIndexToCode(dim: EurostatJsonStatDimension): string[] {
  const labels = dim.category.label;
  const index = dim.category.index;
  const codes = Object.keys(labels);
  if (!index) {
    // Single-value dim or implicit ordering — codes are in label-key
    // insertion order.
    return codes;
  }
  const indexToCode = new Array<string>(codes.length);
  for (const [code, idx] of Object.entries(index)) {
    if (typeof idx === "number" && idx >= 0 && idx < codes.length) {
      indexToCode[idx] = code;
    }
  }
  // Defensive: backfill any holes from insertion order.
  for (let i = 0; i < codes.length; i++) {
    if (indexToCode[i] === undefined) indexToCode[i] = codes[i];
  }
  return indexToCode;
}

/**
 * Compute row-major strides per dimension. For dim layout
 * `[d0, d1, d2, d3]` with sizes `[s0, s1, s2, s3]`:
 *   stride[3] = 1
 *   stride[2] = s3
 *   stride[1] = s2 * s3
 *   stride[0] = s1 * s2 * s3
 */
function computeStrides(size: number[]): number[] {
  const strides = new Array<number>(size.length);
  strides[size.length - 1] = 1;
  for (let i = size.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * size[i + 1];
  }
  return strides;
}

/**
 * Fetch one indicator's full payload. Returns a map of
 * `iso2 → { year, value }` already filtered to the latest non-null
 * year per Eurostat geo code (the filter is applied here so the
 * caller gets a clean ready-to-write structure).
 *
 * Non-EU+EFTA observations are NOT included in the returned map;
 * they're counted via the `nonMemberCount` return field for counter
 * visibility. The ISO2 keys returned are post-translation
 * (EL→GR, UK→GB) so the caller can lookup directly against
 * `jurisdictions.iso2`.
 */
async function fetchIndicator(config: EurostatIndicatorConfig): Promise<{
  latestByIso2: Map<string, { year: number; value: number }>;
  observationCount: number;
  nonMemberCount: number;
  upstreamUpdated: string | null;
}> {
  const url = buildDataUrl(config);
  // Note on `Accept-Encoding`: Node's undici fetch handles gzip
  // decompression transparently when no `Accept-Encoding` header is
  // set by the caller. Setting `Accept-Encoding: gzip` ourselves
  // disables the auto-decompression and leaves the caller to
  // un-gzip the body, which is unnecessary complexity. Verified
  // 2026-05-05: omitting the header gives clean JSON; including it
  // returns garbled bytes.
  const res = await fetch(url, {
    headers: {
      "User-Agent": EUROSTAT_USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(
      `Eurostat ${config.dataset} ${config.factKey}: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as EurostatJsonStatResponse;
  if (body.error && body.error.length > 0) {
    const msg = body.error
      .map((e) => `${e.status ?? "?"}/${e.id ?? "?"}:${e.label ?? "?"}`)
      .join("; ");
    throw new Error(
      `Eurostat ${config.dataset} ${config.factKey} returned errors: ${msg}`,
    );
  }

  const id = body.id;
  const size = body.size;
  const dimensions = body.dimension;
  const values = body.value ?? {};
  if (!id || !size || !dimensions) {
    throw new Error(
      `Eurostat ${config.factKey}: missing id/size/dimension in response`,
    );
  }
  if (id.length !== size.length) {
    throw new Error(
      `Eurostat ${config.factKey}: id/size length mismatch (${id.length} vs ${size.length})`,
    );
  }
  const geoPos = id.indexOf("geo");
  const timePos = id.indexOf("time");
  if (geoPos === -1 || timePos === -1) {
    throw new Error(
      `Eurostat ${config.factKey}: missing geo or time dim in id list (${id.join(",")})`,
    );
  }
  const geoDim = dimensions["geo"];
  const timeDim = dimensions["time"];
  if (!geoDim || !timeDim) {
    throw new Error(
      `Eurostat ${config.factKey}: geo or time dim metadata missing`,
    );
  }
  const geoIndexToCode = buildIndexToCode(geoDim);
  const timeIndexToCode = buildIndexToCode(timeDim);
  const strides = computeStrides(size);

  const latestByIso2 = new Map<string, { year: number; value: number }>();
  let observationCount = 0;
  let nonMemberCount = 0;

  for (const [keyStr, rawValue] of Object.entries(values)) {
    observationCount++;
    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;

    let k = parseInt(keyStr, 10);
    if (!Number.isFinite(k) || k < 0) continue;

    // Decode the integer key into per-dim positional indices via
    // repeated div-mod against strides.
    const dimIdx = new Array<number>(size.length);
    for (let i = 0; i < size.length; i++) {
      dimIdx[i] = Math.floor(k / strides[i]);
      k = k % strides[i];
    }

    const geoIdx = dimIdx[geoPos];
    const timeIdx = dimIdx[timePos];
    if (
      geoIdx === undefined ||
      timeIdx === undefined ||
      geoIdx < 0 ||
      geoIdx >= geoIndexToCode.length ||
      timeIdx < 0 ||
      timeIdx >= timeIndexToCode.length
    ) {
      continue;
    }
    const eurostatGeo = geoIndexToCode[geoIdx]?.toUpperCase();
    const yearStr = timeIndexToCode[timeIdx];
    if (!eurostatGeo || !yearStr) continue;

    // Eurostat aggregates ("EU27_2020", "EA20", "EEA", etc.) are not
    // ISO2-like 2-character codes. Filter them out before the EU+EFTA
    // membership check so they're counted under "non-member" along
    // with partner countries (UK, US, candidates).
    if (eurostatGeo.length !== 2) {
      nonMemberCount++;
      continue;
    }

    // Years come in as 4-digit strings ("2024"). LFS unemployment
    // also has annual codes only (no monthly granularity); HICP
    // annual is also year-only. No defensive year-month parsing
    // needed at this layer.
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) continue;

    // Apply EU+EFTA-only scope filter. Per resolution §2c: for
    // non-EU/EFTA, Eurostat is not canonical and rows are not
    // written. The Eurostat API returns ~7-14 partner/aggregate
    // codes per indicator (UK, US, AL, BA, ME, MK, RS, TR, XK, UA,
    // MD, GE, plus EU/EA aggregates already filtered above); these
    // get counted but not retained.
    const iso2Standard = eurostatToIso2(eurostatGeo);
    if (!isEuEftaIso2(iso2Standard)) {
      nonMemberCount++;
      continue;
    }

    const existing = latestByIso2.get(iso2Standard);
    if (!existing || year > existing.year) {
      latestByIso2.set(iso2Standard, { year, value: rawValue });
    }
  }

  return {
    latestByIso2,
    observationCount,
    nonMemberCount,
    upstreamUpdated: body.updated ?? null,
  };
}

/**
 * Build the EU+EFTA ISO2 set lazily so we can keep the canonical
 * source-of-truth list in ISO3 (matching `jurisdictions.iso3` keys).
 * Consumed by `fetchIndicator` to decide which observations to
 * retain. The mapping is static — the 4 EFTA codes plus EU-27.
 */
const EU_EFTA_ISO2_SET: Set<string> = new Set([
  // EU-27 ISO2 (matches Eurostat verbatim except EL→GR / no UK):
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  // EFTA-4 ISO2:
  "IS",
  "LI",
  "NO",
  "CH",
]);
function isEuEftaIso2(iso2: string): boolean {
  return EU_EFTA_ISO2_SET.has(iso2);
}

/**
 * Run the Eurostat sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncEurostat(
  db: Db,
  options: EurostatSyncOptions = {},
): Promise<EurostatSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = EUROSTAT_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.dataset && c.dataset !== options.dataset) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: EUROSTAT_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no Eurostat indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Build iso2 → jurisdictionId map once; reused across all
  // indicators. Filter to ISO2-keyed jurisdictions up-front. The
  // Eurostat sync uses ISO2 (not ISO3) lookup because Eurostat's
  // geo codes are ISO2 with two well-documented anomalies handled
  // at the fetcher layer.
  const allJurisdictions =
    options.jurisdictions ??
    (await db
      .select({
        id: jurisdictions.id,
        slug: jurisdictions.slug,
        iso2: jurisdictions.iso2,
        iso3: jurisdictions.iso3,
      })
      .from(jurisdictions)
      .where(sql`${jurisdictions.iso2} IS NOT NULL`));
  const iso2ToJurisdiction = new Map<
    string,
    { id: string; slug: string; iso2: string | null; iso3: string | null }
  >();
  for (const j of allJurisdictions) {
    if (j.iso2) iso2ToJurisdiction.set(j.iso2.toUpperCase(), j);
  }
  log(`${allJurisdictions.length} jurisdictions with ISO2 codes loaded.`);

  // EU+EFTA coverage check — log how many target ISO3s exist in the
  // jurisdictions table. Should be 31/31 per resolution §2g.
  const euEftaIso3sFound = EU_EFTA_ISO3.filter((iso3) =>
    [...iso2ToJurisdiction.values()].some((j) => j.iso3 === iso3),
  );
  const euEftaIso3sMissing = EU_EFTA_ISO3.filter(
    (iso3) => ![...iso2ToJurisdiction.values()].some((j) => j.iso3 === iso3),
  );
  log(
    `EU+EFTA member coverage: ${euEftaIso3sFound.length}/${EU_EFTA_ISO3.length} present in jurisdictions table.`,
  );
  if (euEftaIso3sMissing.length > 0) {
    log(
      `  missing EU+EFTA members (will be skipped this run): ${euEftaIso3sMissing.join(", ")}`,
    );
  }

  const counters = new Map<string, PerEurostatCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.dataset));
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
        `unknown fact-key '${config.factKey}' for Eurostat ${config.dataset} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.dataset}) "${config.label}" — fetching…`,
    );

    let latestByIso2: Map<string, { year: number; value: number }>;
    let observationCount = 0;
    let nonMemberCount = 0;
    let upstreamUpdated: string | null = null;
    try {
      const result = await (options.fetchIndicator ?? fetchIndicator)(config);
      latestByIso2 = result.latestByIso2;
      observationCount = result.observationCount;
      nonMemberCount = result.nonMemberCount;
      upstreamUpdated = result.upstreamUpdated;
    } catch (err) {
      errors.push(
        `${config.dataset} ${config.factKey} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    counter.observations = observationCount;
    counter.skipped_non_eu_efta_member = nonMemberCount;
    counter.jurisdictions_with_value = latestByIso2.size;
    counter.upstreamUpdated = upstreamUpdated;
    log(
      `  fetched ${observationCount} observations (${nonMemberCount} non-EU+EFTA, ${latestByIso2.size} EU+EFTA members with non-null value, updated=${upstreamUpdated ?? "?"})`,
    );

    for (const [iso2, dp] of latestByIso2) {
      const j = iso2ToJurisdiction.get(iso2);
      if (!j) {
        // EU+EFTA member that's not in Civica's jurisdictions table
        // by ISO2 — should not happen in v1 (all 31 confirmed
        // present per audit_eurostat.ts 2026-05-04). If it fires,
        // it indicates a regression.
        counter.skipped_no_jurisdiction++;
        continue;
      }

      const transform = config.valueTransform ?? ((v: number) => v);
      const numericValue = transform(dp.value);

      // Plausibility envelope per fact-key registry §3.6. Same
      // R.1.1 fix as R.7 OECD: when isPercent is true, [-1, 101] is
      // only a fallback for fact-keys that don't declare their own
      // min/max. Explicit min/max take precedence. All 5 R.11 fact-
      // keys declare explicit envelopes (verified §2h in the
      // resolution).
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

      // Bug 1 forward policy — defensive year-based discriminator.
      // The 5 R.11 datasets ship measured/realized data only (HICP
      // annual, real GDP growth, LFS unemployment, EDP fiscal/debt
      // are all back-looking surveillance series). Counter stays at
      // 0 in normal runs but is wired for future Eurostat datasets
      // that may include forecasts.
      const valueType: "measured" | "projected" =
        factYear > currentYear ? "projected" : "measured";
      if (factYear > currentYear) {
        counter.projection_rows++;
      }

      const upstreamPayload = {
        source: "eurostat",
        endpoint: buildDataUrl(config),
        iso2: j.iso2,
        iso3: j.iso3,
        dataset: config.dataset,
        dimensionFilter: config.dimensionFilter,
        year: factYear,
        rawValue: dp.value,
        transformedValue: numericValue,
        eurostatVintage: EUROSTAT_VINTAGE,
        eurostatUpstreamUpdated: upstreamUpdated,
      };
      const hash = payloadHash(upstreamPayload);

      // R.11 — per-row references payload. Mirrors R.7 OECD shape +
      // adds `eurostatDataset` + `eurostatUpstreamUpdated` for
      // future R.23 methodology-page rendering. The
      // `civicaRole='canonical'` + multi-canonical-with-scope-predicate
      // pattern (resolution §2d) coexists with existing
      // IMF/WB/OECD/ILO `'canonical'` tags for the same EU+EFTA
      // (jurisdiction, fact-key) pair.
      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "Eurostat",
          civicaRole: config.civicaRole ?? "alternate",
          license: EUROSTAT_LICENSE,
          eurostatDataset: config.dataset,
          eurostatUpstreamUpdated: upstreamUpdated,
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${factYear}, ${valueType})`,
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
            sourceId: "eurostat",
            upstreamRef: `eurostat:${j.iso2}:${config.dataset}:${config.factKey}:${factYear}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: EUROSTAT_VINTAGE,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          });

        const snapshotIdRow = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'eurostat' AND ${factSnapshots.payloadHash} = ${hash}`,
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
            sourceId: "eurostat",
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
            upstreamVintageLabel: EUROSTAT_VINTAGE,
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
            // per-row tag updates land on subsequent syncs (e.g. a
            // year that was projected in 2026 becomes measured when
            // 2027 rolls over).
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
              upstreamVintageLabel: EUROSTAT_VINTAGE,
              snapshotId,
              valueType,
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
        `(non-EU+EFTA: ${counter.skipped_non_eu_efta_member}, ` +
        `unmatched ISO2: ${counter.skipped_no_jurisdiction}, ` +
        `envelope rejects: ${counter.rejected_envelope}, ` +
        `projections: ${counter.projection_rows})`,
    );
    recordRequiredSubfeedOutcome({
      errors,
      source: "Eurostat",
      target: `${config.factKey} (${config.dataset})`,
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
            if (line.startsWith("[DRY]")) return;
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
    sourceIds: "eurostat",
    rowsWritten: totalWritten,
    dryRun: options.dryRun,
    executor: db,
    errors,
    markSynced: options.markSynced ?? markSourcesSynced,
  });

  const finishedAtMs = Date.now();
  const countersByFactKey: Record<string, PerEurostatCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    vintageLabel: EUROSTAT_VINTAGE,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
