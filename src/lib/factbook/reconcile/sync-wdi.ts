/**
 * Phase F.6 — World Bank WDI sync orchestrator.
 *
 * Direct sync from the World Bank's World Development Indicators API
 * for the six fact-keys deferred from F.2:
 *
 *   - inflation_rate            (FP.CPI.TOTL.ZG, consumer prices annual %)
 *   - public_debt_pct_gdp       (GC.DOD.TOTL.GD.ZS, central gov debt %GDP)
 *   - infant_mortality_per_1000 (SP.DYN.IMRT.IN, per 1000 live births)
 *   - co2_emissions_total_mt    (EN.GHG.CO2.MT.CE.AR5, Mt CO2 eq)
 *   - internet_users_pct        (IT.NET.USER.ZS, % of population)
 *   - gdp_per_capita_usd        (NY.GDP.PCAP.PP.CD, GDP per capita PPP USD)
 *
 * For each indicator we ask the WB API for the most recent ~10 years
 * of data globally (`country/all/indicator/<code>`), pick the latest
 * non-null observation per country, validate against the fact-key's
 * plausibility envelope, then upsert into `country_facts` keyed by
 * `(jurisdictionId, factKey, sourceId='world_bank')`. Snapshots are
 * deduplicated via `fact_snapshots` (sourceId + payloadHash).
 *
 * The Phase F resolver picks between WB and CIA / Wikidata per
 * methodology §3.3 — material-error guard + freshness preference.
 *
 * Why some indicators benefit from a future IMF/UN supplement (out of
 * scope for v1):
 *   - Public debt: WB coverage is patchy; IMF WEO has better coverage.
 *   - CO2: WB indicator is annual; UN/EDGAR ship more granular updates.
 * F.6 v1 ships WB-only; an IMF/UN extension can land as F.6.1 without
 * touching this file.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/phase-f-implementation-plan.md F.6
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

type Db = typeof import("@/lib/db").db;

const WB_BASE_URL = "https://api.worldbank.org/v2";
const WB_USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";
const WB_PER_PAGE = 1000;
// 10-year window. WB indicators publish 1–2 years after reference
// year, so reaching back this far guarantees most countries have at
// least one non-null observation.
const WB_LOOKBACK_YEARS = 10;

const WDI_VINTAGE = "World Bank WDI 2026Q3";

/**
 * One WDI indicator we care about. Each entry maps an upstream WB
 * indicator code to a Civica fact-key. The optional `valueTransform`
 * lets us reshape upstream units to fact-key units (e.g. WB ships
 * GDP per capita in USD; our key is also USD; identity transform).
 */
export interface WdiIndicatorConfig {
  /** WB API indicator code (e.g. "FP.CPI.TOTL.ZG"). */
  wbCode: string;
  /** Civica fact-key the resulting row writes to. */
  factKey: string;
  /** Human-readable indicator label for log lines. */
  label: string;
  /** Multiplier applied to the raw WB value before envelope check
   *  and write. Default 1 — used when the WB unit matches the
   *  fact-key unit verbatim (e.g. % stays %, USD stays USD). */
  valueTransform?: (raw: number) => number;
  /** Documentation URL for the indicator. Stored in the fact row's
   *  references payload so the alternates panel can link out. */
  docUrl: string;
}

export const WDI_INDICATORS: readonly WdiIndicatorConfig[] = [
  {
    wbCode: "FP.CPI.TOTL.ZG",
    factKey: "inflation_rate",
    label: "Inflation, consumer prices (annual %)",
    docUrl: "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
  },
  {
    // WB code for central government debt as % of GDP. Coverage is
    // partial — IMF WEO is a better source and is left as a future
    // F.6.1 extension.
    wbCode: "GC.DOD.TOTL.GD.ZS",
    factKey: "public_debt_pct_gdp",
    label: "Central government debt, total (% of GDP)",
    docUrl: "https://data.worldbank.org/indicator/GC.DOD.TOTL.GD.ZS",
  },
  {
    wbCode: "SP.DYN.IMRT.IN",
    factKey: "infant_mortality_per_1000",
    label: "Mortality rate, infant (per 1,000 live births)",
    docUrl: "https://data.worldbank.org/indicator/SP.DYN.IMRT.IN",
  },
  {
    // CO2 emissions. WB ships in kt CO2 eq under EN.GHG.CO2.MT.CE.AR5;
    // converting to Mt by /1000 to match our fact-key's `Mt` unit.
    // (The WB API serialises this indicator's values directly in Mt
    // — no division needed; verified via spot check on USA = ~5,000 Mt.
    // Identity transform.)
    wbCode: "EN.GHG.CO2.MT.CE.AR5",
    factKey: "co2_emissions_total_mt",
    label: "CO₂ emissions (Mt CO₂ eq)",
    docUrl: "https://data.worldbank.org/indicator/EN.GHG.CO2.MT.CE.AR5",
  },
  {
    wbCode: "IT.NET.USER.ZS",
    factKey: "internet_users_pct",
    label: "Individuals using the Internet (% of population)",
    docUrl: "https://data.worldbank.org/indicator/IT.NET.USER.ZS",
  },
  {
    // GDP per capita, PPP (current international $). Matches the
    // existing `gdp_per_capita_usd` envelope (50 .. 300_000 USD).
    wbCode: "NY.GDP.PCAP.PP.CD",
    factKey: "gdp_per_capita_usd",
    label: "GDP per capita, PPP (current international $)",
    docUrl: "https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.CD",
  },
];

interface WbDataPoint {
  country: { id: string; value: string };
  /** ISO3 code for the country — sometimes empty for aggregates. */
  countryiso3code: string;
  date: string;
  value: number | null;
  /** Indicator metadata is repeated on every row. */
  indicator: { id: string; value: string };
}

export interface PerWdiCounters {
  factKey: string;
  wbCode: string;
  observations: number;
  jurisdictions_with_value: number;
  written: number;
  skipped_no_iso3: number;
  skipped_no_jurisdiction: number;
  rejected_envelope: number;
  rejected_no_value: number;
}

export interface WdiSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsInScope: number;
  countersByFactKey: Record<string, PerWdiCounters>;
  totalWritten: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  errors: string[];
  dryRun: boolean;
}

export interface WdiSyncOptions {
  /** Limit to a specific fact-key (for testing). */
  factKey?: string;
  /** Limit to a specific WB indicator code (for testing). */
  wbCode?: string;
  /** When true, no DB writes — just exercise fetch + filter + log. */
  dryRun?: boolean;
  /** Optional progress callback for streaming logs. */
  onProgress?: (line: string) => void;
}

function freshCounters(
  factKey: string,
  wbCode: string,
): PerWdiCounters {
  return {
    factKey,
    wbCode,
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
 * Fetch every page of an indicator from WB. WB paginates at
 * `per_page` rows per page; for ~265 economies × 10 years we expect
 * 2–3 pages with `per_page=1000`.
 */
async function fetchIndicator(
  wbCode: string,
  startYear: number,
  endYear: number,
): Promise<WbDataPoint[]> {
  const out: WbDataPoint[] = [];
  let page = 1;
  let totalPages = 1;
  const dateRange = `${startYear}:${endYear}`;

  while (page <= totalPages) {
    const url = `${WB_BASE_URL}/country/all/indicator/${wbCode}?format=json&per_page=${WB_PER_PAGE}&date=${dateRange}&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": WB_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(
        `WB WDI ${wbCode} page ${page}: ${res.status} ${res.statusText}`,
      );
    }
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body) || body.length < 2) {
      // WB returns a single-element array when the indicator code is
      // unrecognised — the array has just an error envelope.
      throw new Error(
        `WB WDI ${wbCode}: unexpected response shape (length ${
          Array.isArray(body) ? body.length : "n/a"
        })`,
      );
    }
    const meta = body[0] as { pages: number };
    totalPages = meta?.pages ?? 1;
    const rows = body[1] as WbDataPoint[] | null;
    if (rows) out.push(...rows);
    page += 1;
  }
  return out;
}

/**
 * Pick the most recent non-null observation per country. Returns a
 * map keyed by uppercase iso3.
 */
function pickLatestPerCountry(
  rows: WbDataPoint[],
): Map<string, WbDataPoint> {
  const latest = new Map<string, WbDataPoint>();
  for (const r of rows) {
    if (r.value === null || r.value === undefined) continue;
    const iso3 = (r.countryiso3code ?? "").toUpperCase();
    if (!iso3 || iso3.length !== 3) continue;
    const existing = latest.get(iso3);
    if (!existing) {
      latest.set(iso3, r);
      continue;
    }
    // Higher year wins.
    if (parseInt(r.date, 10) > parseInt(existing.date, 10)) {
      latest.set(iso3, r);
    }
  }
  return latest;
}

/**
 * Run the WDI sync end-to-end. Idempotent — re-running on the same
 * data is a no-op (snapshot dedup + content-equal upsert).
 */
export async function syncWorldBankWdi(
  db: Db,
  options: WdiSyncOptions = {},
): Promise<WdiSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const targets = WDI_INDICATORS.filter((c) => {
    if (options.factKey && c.factKey !== options.factKey) return false;
    if (options.wbCode && c.wbCode !== options.wbCode) return false;
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
      errors: ["no WDI indicators matched the filter"],
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

  const counters = new Map<string, PerWdiCounters>();
  for (const c of targets) {
    counters.set(c.factKey, freshCounters(c.factKey, c.wbCode));
  }

  const endYear = new Date().getFullYear();
  const startYear = endYear - WB_LOOKBACK_YEARS;

  let totalWritten = 0;
  // Phase F.6.1 — track every (jurisdictionId, factKey) pair we
  // upserted so the resolver can re-evaluate them and we can persist
  // any disputes after the write loop. Using a Set keyed by
  // `${jurisdictionId}|${factKey}` to dedup across indicators that
  // happen to write to the same key (none today, but cheap).
  const touchedPairs = new Set<string>();

  for (const config of targets) {
    const counter = counters.get(config.factKey)!;
    const factKeyDef = getFactKey(config.factKey);
    if (!factKeyDef) {
      errors.push(
        `unknown fact-key '${config.factKey}' for WDI ${config.wbCode} (registry mismatch)`,
      );
      continue;
    }

    log(
      `→ ${config.factKey} (${config.wbCode}) "${config.label}" — fetching ${startYear}:${endYear}…`,
    );

    let rows: WbDataPoint[];
    try {
      rows = await fetchIndicator(config.wbCode, startYear, endYear);
    } catch (err) {
      errors.push(
        `${config.wbCode} fetch failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }
    counter.observations = rows.length;
    log(`  fetched ${rows.length} observations`);

    const latestByIso3 = pickLatestPerCountry(rows);
    counter.jurisdictions_with_value = latestByIso3.size;
    log(`  ${latestByIso3.size} countries with at least one non-null value`);

    for (const [iso3, dp] of latestByIso3) {
      const j = iso3ToJurisdiction.get(iso3);
      if (!j) {
        counter.skipped_no_jurisdiction++;
        continue;
      }

      const transform = config.valueTransform ?? ((v: number) => v);
      const numericValue = transform(dp.value as number);

      // Plausibility envelope per fact-key registry §3.6.
      const env = factKeyDef.envelope;
      if (env) {
        const min = env.isPercent
          ? Math.max(env.min ?? -1, -1)
          : env.min;
        const max = env.isPercent
          ? Math.min(env.max ?? 101, 101)
          : env.max;
        if (
          (min !== undefined && numericValue < min) ||
          (max !== undefined && numericValue > max)
        ) {
          counter.rejected_envelope++;
          continue;
        }
      }

      const factYear = parseInt(dp.date, 10);
      const asOf = Number.isFinite(factYear) ? `${factYear}-01-01` : null;

      const upstreamPayload = {
        source: "world_bank",
        endpoint: `${WB_BASE_URL}/country/${j.iso3}/indicator/${config.wbCode}`,
        iso3: j.iso3,
        wbCode: config.wbCode,
        wbCountryId: dp.country?.id ?? null,
        date: dp.date,
        value: dp.value,
        wbVintage: WDI_VINTAGE,
      };
      const hash = payloadHash(upstreamPayload);

      const referencesPayload = [
        {
          url: config.docUrl,
          allowlistTier: 1,
          allowlistName: "World Bank Open Data",
        },
      ];

      if (options.dryRun) {
        log(
          `  [DRY] ${j.slug} ${config.factKey} = ${numericValue} (${dp.date})`,
        );
        counter.written++;
        totalWritten++;
        touchedPairs.add(`${j.id}|${config.factKey}`);
        continue;
      }

      try {
        // Snapshot dedup — re-runs with identical upstream payloads are
        // no-ops at the snapshot table.
        await db
          .insert(factSnapshots)
          .values({
            sourceId: "world_bank",
            upstreamRef: `wb:${j.iso3}:${config.wbCode}:${dp.date}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: WDI_VINTAGE,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          });

        let snapshotIdRow = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'world_bank' AND ${factSnapshots.payloadHash} = ${hash}`,
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
            sourceId: "world_bank",
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
            upstreamVintageLabel: WDI_VINTAGE,
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
              upstreamVintageLabel: WDI_VINTAGE,
              snapshotId,
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
        `(envelope rejects: ${counter.rejected_envelope}, ` +
        `unmatched ISO3: ${counter.skipped_no_jurisdiction})`,
    );
  }

  if (!options.dryRun) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, "world_bank"));
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
  const countersByFactKey: Record<string, PerWdiCounters> = {};
  for (const c of counters.values()) {
    countersByFactKey[c.factKey] = c;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsInScope: allJurisdictions.length,
    countersByFactKey,
    totalWritten,
    disputes,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
