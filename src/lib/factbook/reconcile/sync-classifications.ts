/**
 * Phase F.2.1 — Peer-grouping classification syncs.
 *
 * Three sync orchestrators sharing the same upsert logic:
 *
 * 1. `syncWorldBankClassifications` — WB region + income group
 *    via the public Country API. Annual cadence (WB updates July).
 * 2. `syncVdemRow` — V-Dem Regimes of the World via QoG cross-
 *    section CSV. Annual cadence (V-Dem releases ~March).
 * 3. `syncMonarchyAndGovernmentForm` — derives `monarchy_status`
 *    and `government_form_description` from existing CIA
 *    `governmentTypeDetail` prose on `jurisdictions`. CIA-sourced
 *    metadata; runs whenever the CIA seed refreshes.
 *
 * All three honour the `dryRun` and `onProgress` options so they
 * can be invoked from CLI scripts AND the combined cron handler.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2
 * Plan:        ~/civica/plan/phase-f-implementation-plan.md F.2.1
 * Resolution:  ~/Downloads/resolution\ \(2\).md
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

type Db = typeof import("@/lib/db").db;

function payloadHash(payload: object): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/* ────────────────────────────────────────────────────────────────
 * 1. World Bank classifications
 * ──────────────────────────────────────────────────────────────── */

export interface WbClassificationsSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsMatched: number;
  regionRowsWritten: number;
  incomeRowsWritten: number;
  skippedNoIso3: number;
  skippedNoIncome: number;
  errors: string[];
  dryRun: boolean;
}

interface WbCountry {
  id: string; // iso3
  iso2Code: string;
  name: string;
  region: { id: string; iso2code: string; value: string };
  incomeLevel: { id: string; iso2code: string; value: string };
}

const WB_API_URL =
  "https://api.worldbank.org/v2/country?format=json&per_page=400";
const WB_USER_AGENT = "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com)";
// Vintage handle — updates ~July annually. Hand-edit on each refresh
// or compute from year of the upstream release date. Keeping a code
// constant for now; F.6's WB WDI sync will share this.
const WB_VINTAGE = "WB Country Classifications FY2026";

/**
 * Fetch all jurisdictions with their iso3 from the WB Country API.
 * Returns a deduplicated list; the API also returns aggregate "regions"
 * (e.g. "World", "OECD members") that we filter out by checking
 * `region.value !== 'Aggregates'`.
 */
async function fetchWbCountries(): Promise<WbCountry[]> {
  const res = await fetch(WB_API_URL, {
    headers: { "User-Agent": WB_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`WB Country API ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json) || json.length < 2) {
    throw new Error(`WB Country API: unexpected shape`);
  }
  const rows = json[1] as WbCountry[];
  // WB returns aggregate buckets ("Arab World", "OECD members" etc.)
  // alongside countries; their region.value is "Aggregates".
  return rows.filter((r) => r.region?.value?.trim() !== "Aggregates");
}

export async function syncWorldBankClassifications(
  db: Db,
  options: {
    dryRun?: boolean;
    onProgress?: (line: string) => void;
  } = {}
): Promise<WbClassificationsSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  let wbCountries: WbCountry[] = [];
  try {
    wbCountries = await fetchWbCountries();
    log(`Fetched ${wbCountries.length} non-aggregate WB country rows.`);
  } catch (err) {
    errors.push(`fetch failed: ${err instanceof Error ? err.message : err}`);
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsMatched: 0,
      regionRowsWritten: 0,
      incomeRowsWritten: 0,
      skippedNoIso3: 0,
      skippedNoIncome: 0,
      errors,
      dryRun: options.dryRun ?? false,
    };
  }

  const wbByIso3 = new Map<string, WbCountry>();
  for (const c of wbCountries) {
    if (c.id) wbByIso3.set(c.id.toUpperCase(), c);
  }

  // Match WB rows to civica jurisdictions by iso3.
  const civicaJurisdictions = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions);

  const regionDef = getFactKey("world_bank_region");
  const incomeDef = getFactKey("world_bank_income_group");
  if (!regionDef || !incomeDef) {
    errors.push("missing fact-key registry entries for WB classifications");
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsMatched: 0,
      regionRowsWritten: 0,
      incomeRowsWritten: 0,
      skippedNoIso3: 0,
      skippedNoIncome: 0,
      errors,
      dryRun: options.dryRun ?? false,
    };
  }

  let matched = 0;
  let regionWritten = 0;
  let incomeWritten = 0;
  let skippedNoIso3 = 0;
  let skippedNoIncome = 0;

  for (const j of civicaJurisdictions) {
    if (!j.iso3) {
      skippedNoIso3++;
      continue;
    }
    const wb = wbByIso3.get(j.iso3.toUpperCase());
    if (!wb) continue;
    matched++;

    // ── Region row ──
    const regionValue = wb.region?.value?.trim();
    const regionId = wb.region?.id;
    if (regionValue && regionId) {
      const payload = {
        source: "world_bank",
        endpoint: WB_API_URL,
        iso3: j.iso3,
        regionId,
        regionValue,
        wbVintage: WB_VINTAGE,
      };
      const hash = payloadHash(payload);
      const referencesPayload = [
        {
          url: `https://api.worldbank.org/v2/country/${j.iso3}?format=json`,
          allowlistTier: 1,
          allowlistName: "World Bank Open Data",
        },
      ];

      if (options.dryRun) {
        log(
          `[DRY] ${j.slug} world_bank_region = ${regionValue} (${regionId})`
        );
        regionWritten++;
      } else {
        try {
          await upsertSnapshot(db, "world_bank", payload, hash, WB_VINTAGE);
          await db
            .insert(countryFacts)
            .values({
              jurisdictionId: j.id,
              factKey: "world_bank_region",
              factGroup: regionDef.group,
              category: regionDef.category,
              sourceId: "world_bank",
              sourceUrl: `https://api.worldbank.org/v2/country/${j.iso3}?format=json`,
              references: referencesPayload,
              sourceHash: hash,
              factValue: regionValue,
              factValueNumeric: null,
              factUnit: null,
              factYear: new Date().getFullYear(),
              valueJson: { regionId, regionValue },
              asOf: `${new Date().getFullYear()}-07-01`,
              retrievedAt: new Date(),
              upstreamVintageLabel: WB_VINTAGE,
              methodologyVersion: "v0.1-beta",
              status: "active",
            })
            .onConflictDoUpdate({
              target: [
                countryFacts.jurisdictionId,
                countryFacts.factKey,
                countryFacts.sourceId,
              ],
              set: {
                factValue: regionValue,
                valueJson: { regionId, regionValue },
                references: referencesPayload,
                sourceHash: hash,
                upstreamVintageLabel: WB_VINTAGE,
                retrievedAt: new Date(),
                updatedAt: new Date(),
              },
            });
          regionWritten++;
        } catch (err) {
          errors.push(
            `${j.slug} world_bank_region: ${err instanceof Error ? err.message : err}`
          );
        }
      }
    }

    // ── Income group row ──
    const incomeValue = wb.incomeLevel?.value?.trim();
    const incomeId = wb.incomeLevel?.id;
    // WB uses "INX" / blank for unclassified. Skip those.
    if (!incomeValue || !incomeId || incomeId === "INX" || incomeId === "NA") {
      skippedNoIncome++;
      continue;
    }
    const incomePayload = {
      source: "world_bank",
      endpoint: WB_API_URL,
      iso3: j.iso3,
      incomeId,
      incomeValue,
      wbVintage: WB_VINTAGE,
    };
    const incomeHash = payloadHash(incomePayload);
    const incomeRefs = [
      {
        url: `https://api.worldbank.org/v2/country/${j.iso3}?format=json`,
        allowlistTier: 1,
        allowlistName: "World Bank Open Data",
      },
    ];

    if (options.dryRun) {
      log(
        `[DRY] ${j.slug} world_bank_income_group = ${incomeValue} (${incomeId})`
      );
      incomeWritten++;
    } else {
      try {
        await upsertSnapshot(
          db,
          "world_bank",
          incomePayload,
          incomeHash,
          WB_VINTAGE
        );
        await db
          .insert(countryFacts)
          .values({
            jurisdictionId: j.id,
            factKey: "world_bank_income_group",
            factGroup: incomeDef.group,
            category: incomeDef.category,
            sourceId: "world_bank",
            sourceUrl: `https://api.worldbank.org/v2/country/${j.iso3}?format=json`,
            references: incomeRefs,
            sourceHash: incomeHash,
            factValue: incomeValue,
            factValueNumeric: null,
            factUnit: null,
            factYear: new Date().getFullYear(),
            valueJson: { incomeId, incomeValue },
            asOf: `${new Date().getFullYear()}-07-01`,
            retrievedAt: new Date(),
            upstreamVintageLabel: WB_VINTAGE,
            methodologyVersion: "v0.1-beta",
            status: "active",
          })
          .onConflictDoUpdate({
            target: [
              countryFacts.jurisdictionId,
              countryFacts.factKey,
              countryFacts.sourceId,
            ],
            set: {
              factValue: incomeValue,
              valueJson: { incomeId, incomeValue },
              references: incomeRefs,
              sourceHash: incomeHash,
              upstreamVintageLabel: WB_VINTAGE,
              retrievedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        incomeWritten++;
      } catch (err) {
        errors.push(
          `${j.slug} world_bank_income_group: ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }

  if (!options.dryRun) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, "world_bank"));
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    jurisdictionsMatched: matched,
    regionRowsWritten: regionWritten,
    incomeRowsWritten: incomeWritten,
    skippedNoIso3,
    skippedNoIncome,
    errors,
    dryRun: options.dryRun ?? false,
  };
}

async function upsertSnapshot(
  db: Db,
  sourceId: string,
  payload: object,
  hash: string,
  vintage: string
): Promise<void> {
  await db
    .insert(factSnapshots)
    .values({
      sourceId,
      upstreamRef: `${sourceId}:${(payload as { iso3?: string }).iso3 ?? "—"}`,
      payloadHash: hash,
      payload: payload as object,
      upstreamVintageLabel: vintage,
    })
    .onConflictDoNothing({
      target: [factSnapshots.sourceId, factSnapshots.payloadHash],
    });
}

/* ────────────────────────────────────────────────────────────────
 * 2. V-Dem Regimes of the World
 * ──────────────────────────────────────────────────────────────── */

export interface VdemRowSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsMatched: number;
  rowsWritten: number;
  skippedNoIso3: number;
  skippedNoData: number;
  errors: string[];
  dryRun: boolean;
}

const QOG_CS_CSV_URL = "https://www.qogdata.pol.gu.se/data/qog_std_cs_jan26.csv";
const VDEM_VINTAGE = "V-Dem v14 (via QoG CS Jan26)";

/**
 * Map V-Dem `v2x_regime_amb` (ambiguous 10-point scale, 0–9) to
 * the 4-bucket Regimes of the World labels per Lührmann,
 * Tannenberg & Lindberg (2018).
 *
 * QoG ships `vdem_regimeamb` (which is V-Dem's `v2x_regime_amb`)
 * rather than the clean `v2x_regime`. The ambiguous version
 * preserves V-Dem's coding uncertainty as half-step variants;
 * collapse to the four clean categories per V-Dem codebook v14:
 *
 *   0–1 → Closed Autocracy
 *   2–4 → Electoral Autocracy
 *   5–7 → Electoral Democracy
 *   8–9 → Liberal Democracy
 */
function mapV2xRegime(value: number | null): string | null {
  if (value === null) return null;
  const v = Math.round(value);
  if (v >= 0 && v <= 1) return "Closed Autocracy";
  if (v >= 2 && v <= 4) return "Electoral Autocracy";
  if (v >= 5 && v <= 7) return "Electoral Democracy";
  if (v >= 8 && v <= 9) return "Liberal Democracy";
  return null;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((v) => v.replace(/\r$/, ""));
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

interface VdemRowCsvRow {
  iso3: string;
  v2xRegime: number | null;
}

async function fetchVdemRowFromQog(): Promise<Map<string, VdemRowCsvRow>> {
  const response = await fetch(QOG_CS_CSV_URL, {
    headers: { "User-Agent": "Civica taxonomy ingest" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download QoG CS CSV (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let header: string[] | null = null;
  let columnIndex: Record<string, number> | null = null;
  const latestByIso3 = new Map<string, VdemRowCsvRow>();

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const columns = parseCsvLine(line);
    if (!header) {
      header = columns;
      columnIndex = Object.fromEntries(
        header.map((name, index) => [name, index])
      );
      return;
    }
    if (!columnIndex) return;

    const iso3 = columns[columnIndex.ccodealp]?.trim().toUpperCase();
    if (!iso3) return;

    const row: VdemRowCsvRow = {
      iso3,
      // QoG's column for V-Dem RoW is `vdem_regimeamb` (the
      // ambiguous 10-point version). The 4-bucket label gets
      // derived in `mapV2xRegime()`.
      v2xRegime: toNumber(columns[columnIndex.vdem_regimeamb]),
    };
    latestByIso3.set(iso3, row);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
    if (done) break;
  }
  if (buffer.trim()) handleLine(buffer);

  return latestByIso3;
}

export async function syncVdemRow(
  db: Db,
  options: { dryRun?: boolean; onProgress?: (line: string) => void } = {}
): Promise<VdemRowSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  let qogByIso3 = new Map<string, VdemRowCsvRow>();
  try {
    qogByIso3 = await fetchVdemRowFromQog();
    log(`Loaded ${qogByIso3.size} QoG rows.`);
  } catch (err) {
    errors.push(`QoG fetch: ${err instanceof Error ? err.message : err}`);
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsMatched: 0,
      rowsWritten: 0,
      skippedNoIso3: 0,
      skippedNoData: 0,
      errors,
      dryRun: options.dryRun ?? false,
    };
  }

  const civicaJurisdictions = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions);

  const def = getFactKey("vdem_row");
  if (!def) {
    errors.push("missing fact-key registry entry for vdem_row");
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsMatched: 0,
      rowsWritten: 0,
      skippedNoIso3: 0,
      skippedNoData: 0,
      errors,
      dryRun: options.dryRun ?? false,
    };
  }

  let matched = 0;
  let written = 0;
  let skippedNoIso3 = 0;
  let skippedNoData = 0;

  for (const j of civicaJurisdictions) {
    if (!j.iso3) {
      skippedNoIso3++;
      continue;
    }
    const row = qogByIso3.get(j.iso3.toUpperCase());
    if (!row) continue;
    matched++;
    const label = mapV2xRegime(row.v2xRegime);
    if (!label) {
      skippedNoData++;
      continue;
    }

    const payload = {
      source: "vdem_via_qog",
      endpoint: QOG_CS_CSV_URL,
      iso3: j.iso3,
      v2xRegime: row.v2xRegime,
      label,
      vintage: VDEM_VINTAGE,
    };
    const hash = payloadHash(payload);
    const refs = [
      {
        url: "https://www.v-dem.net/data/the-v-dem-dataset/",
        allowlistTier: 1,
        allowlistName: "V-Dem (Varieties of Democracy)",
      },
      {
        url: QOG_CS_CSV_URL,
        allowlistTier: 1,
        allowlistName: "Quality of Government Standard Dataset (QoG)",
      },
    ];

    if (options.dryRun) {
      log(`[DRY] ${j.slug} vdem_row = ${label} (${row.v2xRegime})`);
      written++;
      continue;
    }

    try {
      await upsertSnapshot(db, "vdem", payload, hash, VDEM_VINTAGE);
      await db
        .insert(countryFacts)
        .values({
          jurisdictionId: j.id,
          factKey: "vdem_row",
          factGroup: def.group,
          category: def.category,
          sourceId: "vdem",
          sourceUrl: "https://www.v-dem.net/data/the-v-dem-dataset/",
          references: refs,
          sourceHash: hash,
          factValue: label,
          factValueNumeric: row.v2xRegime,
          factUnit: null,
          factYear: 2024,
          valueJson: { v2xRegime: row.v2xRegime, label },
          asOf: "2024-03-01",
          retrievedAt: new Date(),
          upstreamVintageLabel: VDEM_VINTAGE,
          methodologyVersion: "v0.1-beta",
          status: "active",
        })
        .onConflictDoUpdate({
          target: [
            countryFacts.jurisdictionId,
            countryFacts.factKey,
            countryFacts.sourceId,
          ],
          set: {
            factValue: label,
            factValueNumeric: row.v2xRegime,
            valueJson: { v2xRegime: row.v2xRegime, label },
            references: refs,
            sourceHash: hash,
            upstreamVintageLabel: VDEM_VINTAGE,
            retrievedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      written++;
    } catch (err) {
      errors.push(`${j.slug} vdem_row: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!options.dryRun) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, "vdem"));
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    jurisdictionsMatched: matched,
    rowsWritten: written,
    skippedNoIso3,
    skippedNoData,
    errors,
    dryRun: options.dryRun ?? false,
  };
}

/* ────────────────────────────────────────────────────────────────
 * 3. Monarchy status + government_form_description (CIA-derived)
 * ──────────────────────────────────────────────────────────────── */

export interface MonarchySummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsConsidered: number;
  monarchyRowsWritten: number;
  formDescriptionRowsWritten: number;
  monarchyBuckets: Record<string, number>;
  errors: string[];
  dryRun: boolean;
}

/**
 * Curated overrides per the canonical coding spec at
 * `~/civica/plan/structural-family-removal-implementation-plan.md` §C-Q2.
 *
 * The spec pins a specific value for each of these jurisdictions;
 * the resolver does NOT derive them from CIA prose alone. CIA
 * prose for these cases is ambiguous, contradictory, or absent —
 * see the spec for the reasoning per case.
 *
 * Implementation note: `~/civica/plan/monarchy-status-coding-v1.md`
 * documents the regex + override choices needed to match §C-Q2,
 * plus the open questions for jurisdictions the spec doesn't pin.
 *
 * IMPORTANT: order of operations matters.
 *   - ELECTIVE overrides apply BEFORE the absolute-prose rule so
 *     Vatican (prose says "ecclesiastical elective monarchy;
 *     self-described as an 'absolute monarchy'") lands as elective
 *     per spec, not absolute.
 *   - CEREMONIAL overrides apply BEFORE the generic-monarchy rule
 *     so UK/Sweden/Spain/Japan/Cambodia don't fall through to
 *     "constitutional".
 */
const ELECTIVE_OVERRIDES = new Set<string>([
  "malaysia", // rotating sultanate elected from state rulers
  "holy-see-vatican-city", // conclave model
]);

const CONSTITUTIONAL_OVERRIDES = new Set<string>([
  "united-arab-emirates", // federation of monarchies; treat as one state-level monarchy
]);

const CEREMONIAL_OVERRIDES = new Set<string>([
  // §C-Q2 original pinned set
  "united-kingdom",
  "sweden",
  "spain",
  "japan",
  "cambodia",
  // §C-Q2 2026-05-02 amendment — pinned after Phase F.2.1
  // surfaced these as open questions
  "norway",
  "denmark",
  "netherlands",
  "luxembourg",
  "lesotho",
  // Thailand pinned ceremonial *(contested)* — formal
  // constitutional position is ceremonial per 2017 Constitution;
  // contestation (lèse-majesté regime, 2014 endorsement of
  // military rule) documented in §C-Q2 amendment notes and
  // routed into `government_form_description`, not into a
  // separate enum value.
  "thailand",
]);

/**
 * Derive monarchy_status from CIA `government_type_detail` prose
 * plus jurisdiction slug.
 *
 * 6-value enum per §C-Q2:
 *   none | constitutional | absolute | ceremonial | elective | theocratic
 *
 * Implementation order (first match wins):
 *   1. Slug in ELECTIVE_OVERRIDES        → "elective"
 *   2. Slug in CONSTITUTIONAL_OVERRIDES  → "constitutional"
 *   3. Slug in CEREMONIAL_OVERRIDES      → "ceremonial"
 *   4. Absolute monarchy prose keywords  → "absolute"
 *   5. "[democracy] ... under a
 *       constitutional monarchy"          → "ceremonial"
 *      (Commonwealth realms + dependent territories; UK NOT
 *      caught because its prose lacks this phrase)
 *   6. Generic "monarchy" keyword        → "constitutional"
 *   7. Default                           → "none"
 *
 * The "theocratic" enum value is reserved per §C-Q2 but no
 * jurisdiction is currently pinned to it. Iran (CIA prose:
 * "theocratic republic") defaults to "none" per the spec —
 * non-monarchical regimes belong in `government_form_description`
 * for the nuance, not in this enum.
 */
function deriveMonarchyStatus(
  prose: string | null,
  slug: string
): string {
  // Overrides FIRST — the spec pins these regardless of prose.
  if (ELECTIVE_OVERRIDES.has(slug)) return "elective";
  if (CONSTITUTIONAL_OVERRIDES.has(slug)) return "constitutional";
  if (CEREMONIAL_OVERRIDES.has(slug)) return "ceremonial";

  if (!prose) return "none";
  const lower = prose.toLowerCase();

  // Rule 4 — explicit absolute monarchy prose. Catches Brunei,
  // Eswatini, Oman, Qatar, Saudi Arabia. NB: we deliberately do
  // NOT match "ecclesiastical" or "theocra" here — Vatican is
  // pinned via ELECTIVE_OVERRIDES above, and Iran's "theocratic
  // republic" prose must NOT match (Iran defaults to none per
  // §C-Q2's "Where ambiguity exists (Iran: theocratic state with
  // non-monarchical constitution), default to `none`" rule).
  if (
    /\babsolute (?:monarchy|monarch)\b/.test(lower) ||
    /\babsolute\b.*\bmonarchy\b/.test(lower)
  ) {
    return "absolute";
  }

  // Rule 5 — Commonwealth realm + dependent-territory pattern.
  // Catches jurisdictions where CIA prose contains both
  // "democracy" and "under a constitutional monarchy" (parenthetical
  // between the two words is allowed). The UK is NOT caught
  // because its prose lacks the "under a constitutional monarchy"
  // phrase entirely.
  if (
    lower.includes("under a constitutional monarchy") &&
    /\bdemocracy\b/.test(lower)
  ) {
    return "ceremonial";
  }

  // Rule 6 — generic monarchy keyword → constitutional. Covers
  // Bahrain, Bhutan, Jordan, Kuwait, Liechtenstein, Monaco,
  // Morocco, Tonga, plus any non-pinned country with "monarchy"
  // in its CIA prose. Per §C-Q2: countries the spec does NOT pin
  // that fall here are open questions, NOT silent ceremonial
  // overrides — see the implementation note for the list.
  if (/\bmonarchy\b/.test(lower)) {
    return "constitutional";
  }

  // Rule 7 — default. Andorra (co-principality, no "monarchy"
  // keyword), Iran (theocratic republic), and other non-monarchies
  // land here. §C-Q2 explicitly pins Andorra to "none" and routes
  // the co-principality nuance into `government_form_description`.
  return "none";
}

export async function syncMonarchyAndGovernmentForm(
  db: Db,
  options: { dryRun?: boolean; onProgress?: (line: string) => void } = {}
): Promise<MonarchySummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];

  const monarchyDef = getFactKey("monarchy_status");
  const formDef = getFactKey("government_form_description");
  if (!monarchyDef || !formDef) {
    errors.push(
      "missing fact-key registry entries for monarchy_status / government_form_description"
    );
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      jurisdictionsConsidered: 0,
      monarchyRowsWritten: 0,
      formDescriptionRowsWritten: 0,
      monarchyBuckets: {},
      errors,
      dryRun: options.dryRun ?? false,
    };
  }

  const civicaJurisdictions = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      governmentTypeDetail: jurisdictions.governmentTypeDetail,
      governmentType: jurisdictions.governmentType,
    })
    .from(jurisdictions);

  let monarchyWritten = 0;
  let formWritten = 0;
  const buckets: Record<string, number> = {
    none: 0,
    constitutional: 0,
    absolute: 0,
    ceremonial: 0,
  };

  for (const j of civicaJurisdictions) {
    const prose =
      (j.governmentTypeDetail && j.governmentTypeDetail.trim()) ||
      (j.governmentType && j.governmentType.trim()) ||
      null;

    // ── monarchy_status row ──
    const monarchy = deriveMonarchyStatus(prose, j.slug);
    buckets[monarchy] = (buckets[monarchy] ?? 0) + 1;

    const monarchyPayload = {
      source: "cia_factbook",
      derivation: "regex over governmentTypeDetail",
      slug: j.slug,
      prose: prose ?? "",
      monarchy,
    };
    const monarchyHash = payloadHash(monarchyPayload);

    if (options.dryRun) {
      log(`[DRY] ${j.slug} monarchy_status = ${monarchy}`);
      monarchyWritten++;
    } else {
      try {
        await db
          .insert(countryFacts)
          .values({
            jurisdictionId: j.id,
            factKey: "monarchy_status",
            factGroup: monarchyDef.group,
            category: monarchyDef.category,
            sourceId: "cia_factbook",
            sourceUrl: `https://www.cia.gov/the-world-factbook/countries/${j.slug}/`,
            sourceHash: monarchyHash,
            factValue: monarchy,
            factUnit: null,
            asOf: "2026-01-23",
            retrievedAt: new Date(),
            upstreamVintageLabel: "CIA Factbook 2026-01-frozen",
            methodologyVersion: "v0.1-beta",
            status: "active",
            sourceNote:
              "Derived from CIA government_type_detail prose (regex)",
          })
          .onConflictDoUpdate({
            target: [
              countryFacts.jurisdictionId,
              countryFacts.factKey,
              countryFacts.sourceId,
            ],
            set: {
              factValue: monarchy,
              sourceHash: monarchyHash,
              retrievedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        monarchyWritten++;
      } catch (err) {
        errors.push(
          `${j.slug} monarchy_status: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    // ── government_form_description row ──
    if (!prose) continue;

    const formPayload = {
      source: "cia_factbook",
      slug: j.slug,
      prose,
    };
    const formHash = payloadHash(formPayload);

    if (options.dryRun) {
      log(`[DRY] ${j.slug} government_form_description = ${prose.slice(0, 80)}`);
      formWritten++;
    } else {
      try {
        await db
          .insert(countryFacts)
          .values({
            jurisdictionId: j.id,
            factKey: "government_form_description",
            factGroup: formDef.group,
            category: formDef.category,
            sourceId: "cia_factbook",
            sourceUrl: `https://www.cia.gov/the-world-factbook/countries/${j.slug}/`,
            sourceHash: formHash,
            factValue: prose,
            factUnit: null,
            asOf: "2026-01-23",
            retrievedAt: new Date(),
            upstreamVintageLabel: "CIA Factbook 2026-01-frozen",
            methodologyVersion: "v0.1-beta",
            status: "active",
            sourceNote: "CIA government_type_detail prose, verbatim",
          })
          .onConflictDoUpdate({
            target: [
              countryFacts.jurisdictionId,
              countryFacts.factKey,
              countryFacts.sourceId,
            ],
            set: {
              factValue: prose,
              sourceHash: formHash,
              retrievedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        formWritten++;
      } catch (err) {
        errors.push(
          `${j.slug} government_form_description: ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }

  if (!options.dryRun) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, "cia_factbook"));
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    jurisdictionsConsidered: civicaJurisdictions.length,
    monarchyRowsWritten: monarchyWritten,
    formDescriptionRowsWritten: formWritten,
    monarchyBuckets: buckets,
    errors,
    dryRun: options.dryRun ?? false,
  };
}
