/**
 * Phase R.15 — INSEE (France) sync orchestrator.
 *
 * **First NSO publisher in v1** (alongside R.13 US Census + R.14
 * ONS-UK running in parallel). Direct sync from INSEE's open
 * Banque de Données Macro-économiques (BDM) SDMX 2.1 REST endpoint
 * at `https://www.bdm.insee.fr/series/sdmx/`. Token-less public
 * endpoint — no `INSEE_API_KEY` env var required.
 *
 * Mirrors the F.6 / R.1 / R.2 / R.7 / R.10 / R.11 pattern but
 * parses SDMX 2.1 StructureSpecificData XML rather than JSON-stat
 * 2.0 (Eurostat) or SDMX-JSON (OECD). Ships 5 indicators using
 * the `SERIES_BDM/<idbank>` URL pattern (single-fetch multi-series
 * via `+`-joined idbanks):
 *
 *   1. `001760077` (TCRED-ESTIMATIONS-POPULATION) → `population_total`
 *   2. `011814640` (IPC-2025 annual variation)    → `inflation_rate`
 *   3. `001688527` (CHOMAGE-TRIM-NATIONAL)        → `unemployment_rate_pct`
 *   4. `011779995` (CNA-2020-PIB volume change)   → `gdp_real_growth_rate`
 *   5. `010777608` (DETTE-TRIM-APU-2020 % GDP)    → `public_debt_pct_gdp`
 *
 * All 5 ship as `civicaRole: 'canonical'` for the single jurisdiction
 * FRA. Per `~/civica/plan/insee-fr-resolution-v1.md` §2d, this is
 * Option C — multi-canonical-with-scope-predicate (NSO-for-its-own-
 * country): existing IMF/WB/OECD/Eurostat `civicaRole='canonical'`
 * tags for FRA STAY in place. The Phase F resolver remains
 * freshness-driven; INSEE typically wins because the NSO publishes
 * earliest. Bit-exact-tied freshness (e.g. INSEE inflation 0.9%
 * 2025 = Eurostat HICP 0.9% 2025; identical `as_of`) is broken by
 * a separate resolver `sourcePriority` patch (parallel commit by
 * the NSO-priority-tier patch agent) covering all 8 NSO Wave 1
 * sources up front. The patch's hardcoded map matches on the
 * exact source slug `insee_fr`.
 *
 * **France-only scope.** Single jurisdiction (ISO3 FRA, ISO2 FR).
 * Smallest sync in v1 by row count (5 rows total) — this is correct
 * given NSO scope is by definition single-country.
 *
 * **REF_AREA scope (FE vs FR-D976).** INSEE's headline scope codes:
 *  - `FE` = France entière (whole territory incl. all 5 DOM-TOM)
 *  - `FM` = France métropolitaine (mainland only)
 *  - `FR-D976` = France hors Mayotte (mainland + 4 of 5 DOMs;
 *    Mayotte's LFS not yet integrated, ~310k pop ~0.45% of FE)
 *
 * R.15 uses `FE` for population, inflation, GDP growth, debt and
 * `FR-D976` for unemployment (INSEE's published headline LFS scope).
 * The Mayotte exclusion shifts headline rate by <0.5pp;
 * `sourceNote` documents the caveat for R.23 methodology rendering.
 *
 * **SDMX 2.1 StructureSpecificData XML parsing.** INSEE's open SDMX
 * endpoint serves `application/xml` with the following shape (one
 * `<Series>` per requested idbank when using SERIES_BDM endpoint):
 *
 * ```xml
 * <message:DataSet>
 *   <Series IDBANK="001760077" FREQ="A"
 *           TITLE_EN="Population estimates - All - France"
 *           TITLE_FR="Estimations de population - Ensemble - France"
 *           LAST_UPDATE="2026-01-14"
 *           UNIT_MEASURE="INDIVIDUS" UNIT_MULT="0"
 *           REF_AREA="FE" DECIMALS="0">
 *     <Obs TIME_PERIOD="2026" OBS_VALUE="69081996"
 *          OBS_STATUS="P" OBS_QUAL="P" OBS_TYPE="A"/>
 *     <Obs TIME_PERIOD="2025" OBS_VALUE="68851996" .../>
 *   </Series>
 * </message:DataSet>
 * ```
 *
 * SDMX-Compact is shape-stable enough for regex extraction (no XML
 * parser dependency). The walker:
 *  1. Find each `<Series ... IDBANK="<id>" ...>` block.
 *  2. Parse Series-level attributes (FREQ, REF_AREA, UNIT_MULT,
 *     UNIT_MEASURE, LAST_UPDATE, TITLE_EN, TITLE_FR, DECIMALS).
 *  3. Extract `<Obs ... />` self-closing elements.
 *  4. Pick the latest by TIME_PERIOD lexicographic order
 *     (works for "2026" / "2025-Q4" / "2025-12").
 *  5. Apply UNIT_MULT scaling (10^n where n is the multiplier).
 *  6. Compute factYear from TIME_PERIOD (year prefix).
 *
 * **value_type per Bug 1 forward policy.** Default `'measured'`.
 * INSEE BDM is backward-looking statistical surveillance — no
 * forecast horizons. Year-based discriminator fires defensively;
 * counter stays at 0.
 *
 * **License: Etalab Open Licence v2.0** (SPDX `Etalab-2.0`).
 * Commercial use OK with attribution: name of producer (INSEE),
 * URL of source page, date of last update. Compatible with CC-BY
 * family per Etalab's compatibility statement.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.15
 * Resolution:  ~/civica/plan/insee-fr-resolution-v1.md
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

const INSEE_BASE_URL = "https://www.bdm.insee.fr/series/sdmx";
const INSEE_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";

/**
 * Civica-side vintage label for INSEE rows. Each indicator carries
 * its own LAST_UPDATE attribute from the SDMX response; the
 * Civica-side label is mostly cosmetic at the F.6 level. The
 * methodology page (R.23) renders the per-row INSEE LAST_UPDATE
 * captured into `payload.inseeLastUpdate`.
 */
const INSEE_VINTAGE = "INSEE BDM 2026Q2";

/**
 * License string stamped into per-row references payload. Mirrors
 * the R.4 / R.7 / R.8 / R.10 / R.11 precedent (per-row license
 * metadata for R.23 alternates-panel rendering).
 *
 * Etalab Open Licence v2.0 (SPDX `Etalab-2.0`). Commercial use OK
 * with attribution. Two existing seeded sources already use this
 * exact license string in seed-sources.ts.
 */
const INSEE_LICENSE = "Etalab Open Licence v2.0";

/**
 * The single ISO3 jurisdiction R.15 writes for. France entière —
 * the Civica jurisdiction "France" maps to the FULL territory
 * including all 5 overseas departments. INSEE's REF_AREA="FE"
 * encodes this scope; REF_AREA="FR-D976" (France hors Mayotte) is
 * INSEE's published headline LFS scope and used for unemployment
 * only. Both REF_AREA scopes write to the same Civica jurisdiction
 * "France" with `sourceNote` documenting the per-indicator scope
 * caveat for R.23 transparency.
 */
const INSEE_JURISDICTION_ISO3 = "FRA";

/**
 * One INSEE indicator we care about. Fetched via the
 * `SERIES_BDM/<idbank>` URL pattern. The optional `valueTransform`
 * lets us reshape upstream units to fact-key units. All 5 R.15
 * indicators ship with identity transforms after UNIT_MULT scaling
 * (INSEE's % matches our %; INSEE's individual count matches our
 * 'people' for population_total when UNIT_MULT=0).
 */
export interface InseeIndicatorConfig {
  /** INSEE BDM idbank — stable 9-digit series identifier. */
  idbank: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines (English). */
  label: string;
  /** Multiplier applied to the raw INSEE value AFTER UNIT_MULT
   *  scaling, before envelope check and write. Default 1 — used
   *  when the INSEE unit matches the fact-key unit verbatim. All 5
   *  R.15 indicators are identity post-UNIT_MULT. */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
  /** Civica's editorial role for this INSEE indicator. R.15 ships
   *  all 5 as `'canonical'` per resolution §2d (multi-canonical-
   *  with-scope-predicate; NSO-for-its-own-country wins on
   *  freshness ties via the parallel resolver patch). The Phase F
   *  resolver does NOT use this field for runtime selection (the
   *  resolver is freshness-driven per methodology §3.3); the field
   *  is informational metadata for the methodology page rewrite at
   *  Phase R.23. Mirrors R.7's `OecdStatIndicatorConfig.civicaRole`. */
  civicaRole?: CivicaSourceRole;
  /** Optional source-level note. Used to document the
   *  REF_AREA=FR-D976 (France hors Mayotte) scope caveat for
   *  unemployment_rate_pct per resolution §2c + §6 Q3. */
  sourceNote?: string;
}

/**
 * The 5 INSEE indicators in R.15 ship scope. Per
 * `~/civica/plan/insee-fr-resolution-v1.md` §2b. All idbanks
 * verified live 2026-05-05 against the open SDMX endpoint.
 */
export const INSEE_INDICATORS: readonly InseeIndicatorConfig[] = [
  {
    idbank: "001760077",
    factKey: "population_total",
    label: "Population estimates — All — France entière (TCRED)",
    docUrl:
      "https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM/001760077",
    civicaRole: "canonical",
  },
  {
    idbank: "011814640",
    factKey: "inflation_rate",
    label:
      "Annual CPI all-items (IPC base 2025) — Annual change — All households — France entière",
    docUrl:
      "https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM/011814640",
    civicaRole: "canonical",
  },
  {
    idbank: "001688527",
    factKey: "unemployment_rate_pct",
    label:
      "ILO unemployment rate — Total — France hors Mayotte — SA (CHOMAGE-TRIM-NATIONAL)",
    docUrl:
      "https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM/001688527",
    civicaRole: "canonical",
    sourceNote:
      "INSEE-published headline unemployment rate is for France hors Mayotte (population coverage 99.55% of France entière). Mayotte's LFS integration is ongoing; harmonised France entière LFS data not yet available as a stable INSEE series.",
  },
  {
    idbank: "011779995",
    factKey: "gdp_real_growth_rate",
    label:
      "Annual real GDP growth — chained-volume — base 2020 (CNA-2020-PIB)",
    docUrl:
      "https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM/011779995",
    civicaRole: "canonical",
  },
  {
    idbank: "010777608",
    factKey: "public_debt_pct_gdp",
    label:
      "Maastricht general government gross debt — % of GDP — base 2020 (DETTE-TRIM-APU-2020)",
    docUrl:
      "https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM/010777608",
    civicaRole: "canonical",
  },
];

/**
 * Per-indicator counter shape. Mirrors the R.7 / R.10 / R.11
 * patterns, simplified for single-jurisdiction scope.
 */
export interface PerInseeCounters {
  factKey: string;
  idbank: string;
  /** Number of `<Obs>` elements parsed from the upstream `<Series>`. */
  observations: number;
  /** 1 when a non-null latest observation was successfully extracted
   *  for FRA, else 0. */
  jurisdictions_with_value: number;
  /** 1 on a successful upsert, else 0. */
  written: number;
  /** 1 if the parsed value violated the fact-key envelope. */
  rejected_envelope: number;
  /** 1 if the upstream returned no `<Obs>` rows at all. */
  rejected_no_value: number;
  /** Counter for forecast-year rows landed (year > current calendar
   *  year). Defensive — INSEE BDM ships measured-only data; this
   *  counter should stay at 0 in normal sync runs. */
  projection_rows: number;
  /** Per-indicator vintage timestamp from the SDMX response's
   *  Series-level LAST_UPDATE attribute. Captured per-fetch and
   *  persisted into the per-row references payload as
   *  `inseeLastUpdate`. */
  upstreamUpdated: string | null;
  /** REF_AREA code captured from the SDMX response (e.g. "FE",
   *  "FR-D976"). Stamped into payload for transparency. */
  refArea: string | null;
  /** TIME_PERIOD of the latest observation (e.g. "2026", "2025-Q4"). */
  latestTimePeriod: string | null;
}

export interface InseeSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  vintageLabel: string;
  countersByFactKey: Record<string, PerInseeCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface InseeSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific INSEE idbank (for testing). */
  idbank?: string;
  /** When true, no DB writes — just exercise fetch + parse + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(
  factKey: string,
  idbank: string,
): PerInseeCounters {
  return {
    factKey,
    idbank,
    observations: 0,
    jurisdictions_with_value: 0,
    written: 0,
    rejected_envelope: 0,
    rejected_no_value: 0,
    projection_rows: 0,
    upstreamUpdated: null,
    refArea: null,
    latestTimePeriod: null,
  };
}

/**
 * Build the SERIES_BDM data URL for a single idbank.
 *
 * `lastNObservations=10` keeps payload sizes ~2KB per indicator
 * while giving a generous 10-period window so the latest-non-null
 * selector finds something even when the most recent period has
 * been published with a placeholder. INSEE's quarterly series use
 * "2025-Q4" lexicographic ordering; annual use "2025" plain.
 */
function buildDataUrl(idbank: string): string {
  return `${INSEE_BASE_URL}/data/SERIES_BDM/${idbank}?lastNObservations=10`;
}

/**
 * Parsed Series block from the SDMX-Compact XML response.
 */
interface InseeSeries {
  idbank: string;
  freq: string | null;
  refArea: string | null;
  unitMeasure: string | null;
  unitMult: number;
  lastUpdate: string | null;
  titleEn: string | null;
  titleFr: string | null;
  decimals: number | null;
  obs: Array<{
    timePeriod: string;
    value: number;
    obsStatus: string | null;
  }>;
}

/**
 * Extract a single attribute value from a Series open tag. The
 * attribute ordering in INSEE's SDMX-Compact is not guaranteed
 * stable, so the parser walks attribute-by-attribute via regex
 * rather than positional split.
 */
function getAttr(open: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(open);
  return m ? m[1] : null;
}

/**
 * Parse INSEE SDMX-Compact XML into one or more `InseeSeries`
 * structures. SDMX-Compact is shape-stable enough that regex
 * extraction is reliable:
 *  - Each `<Series ... >` open tag has positional-independent
 *    attributes; we extract by name.
 *  - Each `<Obs ... />` is self-closing inside a `<Series>` block.
 *  - The walker matches the `<Series>...</Series>` block first,
 *    then iterates `<Obs>` self-closing tags inside.
 *
 * Returns one `InseeSeries` per matched block. The caller filters
 * to the idbank it's looking for (multi-idbank fetches via "+"
 * return multiple Series in one response).
 */
export function parseInseeXml(xml: string): InseeSeries[] {
  const series: InseeSeries[] = [];
  const seriesBlockRe = /<Series\s([^>]+?)>([\s\S]*?)<\/Series>/g;
  let m: RegExpExecArray | null;
  while ((m = seriesBlockRe.exec(xml)) !== null) {
    const openAttrs = m[1];
    const inner = m[2];
    const idbank = getAttr(openAttrs, "IDBANK");
    if (!idbank) continue;
    const freq = getAttr(openAttrs, "FREQ");
    const refArea = getAttr(openAttrs, "REF_AREA");
    const unitMeasure = getAttr(openAttrs, "UNIT_MEASURE");
    const unitMultRaw = getAttr(openAttrs, "UNIT_MULT");
    const unitMult = unitMultRaw ? parseInt(unitMultRaw, 10) : 0;
    const lastUpdate = getAttr(openAttrs, "LAST_UPDATE");
    const titleEn = getAttr(openAttrs, "TITLE_EN");
    const titleFr = getAttr(openAttrs, "TITLE_FR");
    const decimalsRaw = getAttr(openAttrs, "DECIMALS");
    const decimals = decimalsRaw ? parseInt(decimalsRaw, 10) : null;

    const obs: InseeSeries["obs"] = [];
    const obsRe = /<Obs\s([^/>]+?)\/>/g;
    let om: RegExpExecArray | null;
    while ((om = obsRe.exec(inner)) !== null) {
      const obsAttrs = om[1];
      const tp = getAttr(obsAttrs, "TIME_PERIOD");
      const valStr = getAttr(obsAttrs, "OBS_VALUE");
      if (!tp || valStr === null) continue;
      const v = Number(valStr);
      if (!Number.isFinite(v)) continue;
      obs.push({
        timePeriod: tp,
        value: v,
        obsStatus: getAttr(obsAttrs, "OBS_STATUS"),
      });
    }

    series.push({
      idbank,
      freq,
      refArea,
      unitMeasure,
      unitMult: Number.isFinite(unitMult) ? unitMult : 0,
      lastUpdate,
      titleEn,
      titleFr,
      decimals,
      obs,
    });
  }
  return series;
}

/**
 * Pick the latest observation by TIME_PERIOD lexicographic order.
 * Works for INSEE's three observation cadences:
 *  - Annual:    "2026" > "2025" > "2024"
 *  - Quarterly: "2025-Q4" > "2025-Q3" > "2025-Q2"
 *  - Monthly:   "2025-12" > "2025-11"
 * (Lexicographic order matches chronological order for these
 *  fixed-width prefixes.)
 *
 * Returns null if `obs` is empty.
 */
export function latestObs(
  obs: InseeSeries["obs"],
): InseeSeries["obs"][number] | null {
  if (obs.length === 0) return null;
  let best = obs[0];
  for (const o of obs) {
    if (o.timePeriod > best.timePeriod) best = o;
  }
  return best;
}

/**
 * Compute the calendar year from an INSEE TIME_PERIOD string. The
 * year is the 4-digit prefix in all three cadences:
 *  - "2026"     → 2026
 *  - "2025-Q4"  → 2025
 *  - "2025-12"  → 2025
 *
 * Returns null on parse failure.
 */
export function timeperiodToYear(tp: string): number | null {
  const m = /^(\d{4})/.exec(tp);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return Number.isFinite(y) ? y : null;
}

/**
 * Apply UNIT_MULT scaling to a raw value. INSEE's UNIT_MULT is the
 * power-of-10 multiplier:
 *   0 → units (no scaling)
 *   3 → thousands (× 1,000)
 *   6 → millions (× 1,000,000)
 *   9 → billions (× 1,000,000,000)
 * For the 5 R.15 indicators all UNIT_MULT values are 0 (verified
 * 2026-05-05) so the helper is a no-op in the common case but is
 * defensively wired.
 */
export function applyUnitMult(raw: number, unitMult: number): number {
  if (!Number.isFinite(unitMult) || unitMult === 0) return raw;
  return raw * Math.pow(10, unitMult);
}

/**
 * Fetch one indicator's payload from INSEE's SERIES_BDM endpoint.
 * Returns the parsed Series + the latest non-null observation
 * already filtered. Throws on HTTP error or upstream error
 * envelope.
 */
async function fetchIndicator(
  config: InseeIndicatorConfig,
): Promise<{
  series: InseeSeries;
  latest: InseeSeries["obs"][number];
  observationCount: number;
}> {
  const url = buildDataUrl(config.idbank);
  // INSEE's open SDMX endpoint accepts default Node fetch headers;
  // explicit Accept: application/xml is belt-and-braces. No
  // Accept-Language requirement (unlike R.7 OECD).
  const res = await fetch(url, {
    headers: {
      "User-Agent": INSEE_USER_AGENT,
      Accept: "application/xml",
    },
  });
  if (!res.ok) {
    // INSEE returns an SDMX error envelope on 404/400 (mes:Error),
    // surface the body for diagnostics.
    let bodySnippet = "";
    try {
      bodySnippet = (await res.text()).slice(0, 400);
    } catch {
      // ignore
    }
    throw new Error(
      `INSEE ${config.idbank} ${config.factKey}: HTTP ${res.status} ${res.statusText} — ${bodySnippet}`,
    );
  }
  const xml = await res.text();

  // Surface SDMX error envelopes (mes:Error) explicitly. The HTTP
  // status may be 200 even for "no data" responses with an
  // ErrorMessage body; defensive parse.
  if (xml.includes("<mes:Error") || xml.includes("<message:Error")) {
    const errMatch = /<com:Text[^>]*>([^<]+)<\/com:Text>/.exec(xml);
    const msg = errMatch ? errMatch[1] : "(unparsed error body)";
    throw new Error(
      `INSEE ${config.idbank} ${config.factKey}: SDMX error — ${msg}`,
    );
  }

  const all = parseInseeXml(xml);
  const series = all.find((s) => s.idbank === config.idbank);
  if (!series) {
    throw new Error(
      `INSEE ${config.idbank} ${config.factKey}: no Series block matched in response (got ${all.length} series)`,
    );
  }
  const latest = latestObs(series.obs);
  if (!latest) {
    throw new Error(
      `INSEE ${config.idbank} ${config.factKey}: Series has zero observations`,
    );
  }
  return { series, latest, observationCount: series.obs.length };
}

/**
 * Run the INSEE FR sync end-to-end. Idempotent — re-running on the
 * same data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncInseeFr(
  db: Db,
  options: InseeSyncOptions = {},
): Promise<InseeSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = INSEE_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.idbank && c.idbank !== options.idbank) return false;
    return true;
  });
  if (targets.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: INSEE_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: ["no INSEE indicators matched the filter"],
      dryRun: options.dryRun ?? false,
    };
  }

  // Resolve the FRA jurisdiction once. R.15 writes for a single
  // jurisdiction; if the lookup fails, ship a clean error rather
  // than silently no-op.
  const jurisdictionRows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.iso3, INSEE_JURISDICTION_ISO3))
    .limit(1);
  const jurisdiction = jurisdictionRows[0];
  if (!jurisdiction) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsInScope: 0,
      vintageLabel: INSEE_VINTAGE,
      countersByFactKey: {},
      totalWritten: 0,
      disputes: null,
      errors: [
        `France (${INSEE_JURISDICTION_ISO3}) not found in jurisdictions table — cannot sync INSEE`,
      ],
      dryRun: options.dryRun ?? false,
    };
  }
  log(
    `France jurisdiction resolved: id=${jurisdiction.id} slug=${jurisdiction.slug} iso2=${jurisdiction.iso2}.`,
  );

  const counters = new Map<string, PerInseeCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.idbank));
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
        `unknown fact-key '${config.factKey}' for INSEE ${config.idbank} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (idbank ${config.idbank}) "${config.label}" — fetching…`,
    );

    let series: InseeSeries;
    let latest: InseeSeries["obs"][number];
    try {
      const r = await fetchIndicator(config);
      series = r.series;
      latest = r.latest;
      counter.observations = r.observationCount;
    } catch (err) {
      errors.push(
        `${config.idbank} ${config.factKey} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    counter.upstreamUpdated = series.lastUpdate;
    counter.refArea = series.refArea;
    counter.latestTimePeriod = latest.timePeriod;
    counter.jurisdictions_with_value = 1;
    log(
      `  fetched ${counter.observations} observations (REF_AREA=${series.refArea ?? "?"}, UNIT_MULT=${series.unitMult}, latest=${latest.timePeriod}=${latest.value}, status=${latest.obsStatus ?? "?"}, updated=${series.lastUpdate ?? "?"})`,
    );

    // Apply UNIT_MULT scaling first (e.g. UNIT_MULT=3 means
    // thousands). Then apply optional fact-key valueTransform.
    const scaled = applyUnitMult(latest.value, series.unitMult);
    const transform = config.valueTransform ?? ((v: number) => v);
    const numericValue = transform(scaled);

    // Plausibility envelope per fact-key registry §3.6. Same
    // R.1.1 pattern as R.7 OECD / R.11 Eurostat: explicit min/max
    // take precedence over isPercent fallbacks.
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
          `${config.idbank} ${config.factKey}: value ${numericValue} (year ${latest.timePeriod}) out of envelope [${min ?? "-∞"}, ${max ?? "+∞"}]`,
        );
        continue;
      }
    }

    const factYear = timeperiodToYear(latest.timePeriod);
    if (factYear === null) {
      counter.rejected_no_value++;
      errors.push(
        `${config.idbank} ${config.factKey}: could not parse year from TIME_PERIOD="${latest.timePeriod}"`,
      );
      continue;
    }
    const asOf = `${factYear}-01-01`;

    // Bug 1 forward policy — defensive year-based discriminator.
    // INSEE BDM is backward-looking; this counter should stay at 0.
    const valueType: "measured" | "projected" =
      factYear > currentYear ? "projected" : "measured";
    if (factYear > currentYear) {
      counter.projection_rows++;
    }

    const upstreamPayload = {
      source: "insee_fr",
      endpoint: buildDataUrl(config.idbank),
      iso2: jurisdiction.iso2,
      iso3: jurisdiction.iso3,
      idbank: config.idbank,
      timePeriod: latest.timePeriod,
      year: factYear,
      rawValue: latest.value,
      unitMult: series.unitMult,
      scaledValue: scaled,
      transformedValue: numericValue,
      unitMeasure: series.unitMeasure,
      refArea: series.refArea,
      obsStatus: latest.obsStatus,
      titleEn: series.titleEn,
      titleFr: series.titleFr,
      inseeVintage: INSEE_VINTAGE,
      inseeLastUpdate: series.lastUpdate,
    };
    const hash = payloadHash(upstreamPayload);

    // R.15 — per-row references payload. Mirrors R.11 Eurostat
    // shape + adds `inseeIdbank` + `inseeLastUpdate` + `refArea`
    // for R.23 methodology-page rendering. Multi-canonical-with-
    // scope-predicate (NSO-for-its-own-country) coexists with
    // existing IMF/WB/OECD/Eurostat `'canonical'` tags for FRA on
    // the same fact-key; the Phase F resolver remains freshness-
    // driven; the parallel resolver `sourcePriority` patch ensures
    // INSEE wins bit-exact-tied freshness via the
    // `isNsoForJurisdiction("insee_fr", FRA)` predicate.
    const referencesPayload = [
      {
        url: config.docUrl,
        allowlistTier: 2,
        allowlistName: "INSEE (France)",
        civicaRole: config.civicaRole ?? "alternate",
        license: INSEE_LICENSE,
        inseeIdbank: config.idbank,
        inseeLastUpdate: series.lastUpdate,
        inseeRefArea: series.refArea,
        inseeTimePeriod: latest.timePeriod,
        inseeTitleEn: series.titleEn,
        inseeTitleFr: series.titleFr,
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
          sourceId: "insee_fr",
          upstreamRef: `insee_fr:${jurisdiction.iso3}:${config.idbank}:${config.factKey}:${latest.timePeriod}`,
          payloadHash: hash,
          payload: upstreamPayload as object,
          upstreamVintageLabel: INSEE_VINTAGE,
        })
        .onConflictDoNothing({
          target: [factSnapshots.sourceId, factSnapshots.payloadHash],
        });

      const snapshotIdRow = await db
        .select({ id: factSnapshots.id })
        .from(factSnapshots)
        .where(
          sql`${factSnapshots.sourceId} = 'insee_fr' AND ${factSnapshots.payloadHash} = ${hash}`,
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
          sourceId: "insee_fr",
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
          upstreamVintageLabel: INSEE_VINTAGE,
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
          // F.5.1 invariant: do NOT add `status` or `statusReason`
          // to this set clause. Reviewer-demoted rows must survive
          // a re-sync so the resolver continues to honour the
          // human decision.
          //
          // Bug 1 — `valueType` IS included in the set clause so
          // per-row tag updates land on subsequent syncs.
          //
          // `sourceNote` IS included so a future R.15 update that
          // refines the Mayotte caveat lands cleanly.
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
            upstreamVintageLabel: INSEE_VINTAGE,
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
          ? ` [envelope reject: ${counter.rejected_envelope}]`
          : "") +
        (counter.projection_rows
          ? ` [projections: ${counter.projection_rows}]`
          : ""),
    );
  }

  await markSourcesSynced("insee_fr", {
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
  const countersByFactKey: Record<string, PerInseeCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: 1,
    vintageLabel: INSEE_VINTAGE,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
