/**
 * Phase R.22 — quarterly fact-vintage snapshot library.
 *
 * Walks every `(jurisdiction, fact_key)` pair tracked in
 * `country_facts`, runs the resolver to pick the canonical row,
 * and writes a `country_fact_vintages` row with the chosen value
 * frozen at the given vintage label. Exact reruns are no-ops;
 * conflicting reruns fail and require a superseding version.
 *
 * The runtime-vs-snapshot split (resolution v1.0 § 2e):
 *
 *   - Reader-facing factbook pages and the public API call
 *     `getCanonicalFact()` at runtime. New sources are visible
 *     immediately on next page load.
 *   - This snapshot is the *citation handle* surface — a frozen
 *     artefact for academic replication that won't move. Cuts
 *     happen quarterly via
 *     `/api/cron/factbook/snapshot-vintage` at 04:00 UTC on the
 *     15th of January / April / July / October (T+15 days after
 *     each quarter close).
 *
 * Methodology: ~/civica/plan/vintage-cadence-resolution-v1.md
 *
 * Companion: `scripts/snapshot-fact-vintage.ts` is a thin CLI
 * wrapper around `snapshotCurrentVintage()` for diagnostic /
 * manual cuts. The cron route at
 * `src/app/api/cron/factbook/snapshot-vintage/route.ts` is the
 * production caller.
 */

import { createHash } from "node:crypto";

import { eq, sql, and, inArray } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import {
  countryFacts,
  countryFactVintages,
  dataDisputes,
  jurisdictions as jurisdictionsTable,
} from "@/lib/db/schema";
import { resolveFromRows } from "./resolver";
import { getFactKey } from "./fact-keys";
import type { FactRow, ResolverOutput } from "./types";
import { resolveGrowthMethodology } from "@/lib/data/growth-methodology";
import { reconciliationVersionEnvelope } from "./versioning";
import { assertSupersession, parseAtlasVintageLabel, stableStringify } from "@/lib/data/frozen-vintage";

type Db = typeof defaultDb;

/* ────────────────────────────────────────────────────────────────
 * Vintage label derivation
 * ──────────────────────────────────────────────────────────────── */

/**
 * The published release methodology version used at vintage time.
 */
export const VINTAGE_METHODOLOGY_VERSION = "v0.2-beta";

/**
 * The label format for v1.0+ vintage cuts (resolution v1.0 § 2a).
 *
 *   "Civica Atlas Reconciled v<methodology_version> — vintage <YYYY-Qn>"
 *
 * Examples:
 *   - "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1"
 *   - "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q2"
 *   - "Civica Atlas Reconciled v1.0 — vintage 2027-Q1" (post-graduation)
 *
 * Pre-R.22 cuts used the shorter `"Civica Atlas <YYYYQn>"` form
 * (e.g. `"Civica Atlas 2026Q3"`). Those rows are preserved as-is
 * for citation continuity.
 */
export function buildVintageLabel(
  methodologyVersion: string,
  yearQuarter: string,
): string {
  return `Civica Atlas Reconciled ${methodologyVersion} — vintage ${yearQuarter}`;
}

/**
 * Derive the `YYYY-Qn` quarter label from a cut date, applying the
 * T+15-after-quarter-end snapshot rule (resolution v1.0 § 2c +
 * § 2g).
 *
 * Cuts happen on the 15th of Jan / Apr / Jul / Oct UTC. The cut
 * cite-handle quarter is the *previous* calendar quarter:
 *
 *   - Jan 15 cut  → Q4 of (year - 1)   (closes prior-year Q4)
 *   - Apr 15 cut  → Q1 of (year)
 *   - Jul 15 cut  → Q2 of (year)
 *   - Oct 15 cut  → Q3 of (year)
 *
 * The buffer captures upstream cadences that publish 5–10 days
 * after quarter-end (WB WDI, IMF April / October release, etc.)
 * with the smallest reader-visible delay. A cut between two
 * scheduled cron firings (e.g. a manual May 5 cut) maps to
 * whichever quarter most recently closed before the cut, which
 * is **the prior quarter**, NOT the in-progress quarter.
 *
 * Implementation rule:
 *   - Compute the cut date in UTC.
 *   - The "completed quarter" is the most recently *closed*
 *     calendar quarter as of the cut date.
 *   - Q1 closes Mar 31, Q2 closes Jun 30, Q3 closes Sep 30,
 *     Q4 closes Dec 31.
 *   - A cut on Mar 31 itself maps to Q4 of (year-1) — Q1 isn't
 *     yet closed.
 *   - A cut on Apr 1 maps to Q1 of (year). Same for the other
 *     boundary days.
 */
export function deriveQuarterFromCutDate(cutDate: Date): string {
  // UTC components — vintages are calendar-quarter handles, no
  // timezone semantics.
  const year = cutDate.getUTCFullYear();
  const month = cutDate.getUTCMonth(); // 0-11
  const day = cutDate.getUTCDate();

  // Determine the most recently closed quarter as of the cut date.
  // Quarter boundaries (last day of last month):
  //   Q1 closes Mar 31 (month=2, day=31)
  //   Q2 closes Jun 30 (month=5, day=30)
  //   Q3 closes Sep 30 (month=8, day=30)
  //   Q4 closes Dec 31 (month=11, day=31)
  //
  // A cut date is "after Qn close" iff (month, day) > (closeMonth,
  // closeDay) lexicographically. We compute by checking the cut's
  // ordinal day-of-year against the close-of-quarter ordinal.

  // Convert the cut to an "ordinal" comparable across the year.
  // Use month + 1 + day/100 for a strictly-increasing comparison.
  const cutOrd = (month + 1) * 100 + day;

  if (cutOrd > 12 * 100 + 31) {
    // Past Dec 31 — impossible by date arithmetic, but defensive.
    return `${year}-Q4`;
  }
  if (cutOrd > 9 * 100 + 30) {
    // Past Sep 30 — Q3 is closed.
    return `${year}-Q3`;
  }
  if (cutOrd > 6 * 100 + 30) {
    // Past Jun 30 — Q2 is closed.
    return `${year}-Q2`;
  }
  if (cutOrd > 3 * 100 + 31) {
    // Past Mar 31 — Q1 is closed.
    return `${year}-Q1`;
  }
  // On or before Mar 31 — only the prior year's Q4 is closed.
  return `${year - 1}-Q4`;
}

/**
 * Top-level convenience: derive the full vintage label for a cut
 * happening at the given date under the given methodology
 * version. If `methodologyVersion` is omitted, defaults to
 * `VINTAGE_METHODOLOGY_VERSION`.
 */
export function deriveVintageLabel(
  cutDate: Date,
  methodologyVersion: string = VINTAGE_METHODOLOGY_VERSION,
): string {
  const yearQuarter = deriveQuarterFromCutDate(cutDate);
  return buildVintageLabel(methodologyVersion, yearQuarter);
}

/* ────────────────────────────────────────────────────────────────
 * Content hash
 * ──────────────────────────────────────────────────────────────── */

/**
 * SHA-256 of the canonical row's reproducibility-relevant fields.
 * Lets a downstream replication script detect content drift
 * between identical-label re-cuts.
 *
 * Recipe (resolution v1.0 § 2f):
 *   sha256(`${source_id}|${value_text ?? ""}|${value_numeric ?? ""}|${as_of ?? ""}|${methodology_version}`)
 *
 * The recipe is documented here AND in
 * `~/civica/plan/vintage-cadence-resolution-v1.md` § 2f. A future
 * recipe revision must bump methodology version (which itself
 * lives in the recipe), keeping hashes self-anchored to their
 * methodology.
 */
export function computeContentHash(input: {
  sourceId: string;
  valueText: string | null;
  valueNumeric: number | null;
  asOf: string | null;
  methodologyVersion: string;
}): string {
  const recipe = [
    input.sourceId,
    input.valueText ?? "",
    input.valueNumeric === null ? "" : String(input.valueNumeric),
    input.asOf ?? "",
    input.methodologyVersion,
  ].join("|");
  return createHash("sha256").update(recipe).digest("hex");
}

/* ────────────────────────────────────────────────────────────────
 * Snapshot orchestration
 * ──────────────────────────────────────────────────────────────── */

export interface SnapshotOptions {
  /** Override the auto-derived vintage label. When omitted, the
   *  label is derived from the cut date via
   *  `deriveVintageLabel(NOW())`. */
  vintageLabel?: string;
  /** Override the cut date used for label derivation + the
   *  cut-batch timestamp. Defaults to `new Date()`. Useful for
   *  diagnostic re-cuts where the operator wants the historical
   *  cut date stamped onto the rows. */
  cutDate?: Date;
  /** Override the methodology version embedded in the auto-derived
   *  label. No effect when `vintageLabel` is supplied. */
  methodologyVersion?: string;
  /** Explicit lineage for a corrected cut of an already-published quarter. */
  supersedesVintageLabel?: string;
  /** Restrict the snapshot to a single jurisdiction by slug
   *  (diagnostic / smoke-test convenience — e.g. "argentina"). */
  jurisdictionSlug?: string;
  /** When true, performs all the resolver work but does NOT
   *  write to `country_fact_vintages`. */
  dryRun?: boolean;
  /** Per-row progress callback (`!`-prefixed lines indicate
   *  warnings / errors). Defaults to silent. */
  onProgress?: (line: string) => void;
  pairs?: SnapshotPair[];
  disputedKeys?: Set<string>;
  readRows?: (pair: SnapshotPair) => Promise<FactRowDb[]>;
  /** Test/controlled-run injection. Production reads existing frozen rows. */
  existingFrozenRows?: ExistingFrozenFactRow[];
}

export interface ExistingFrozenFactRow {
  jurisdictionId: string;
  factKey: string;
  vintageLabel: string;
  supersedesVintageLabel: string | null;
  canonicalFactId: string;
  valueText: string | null;
  valueNumeric: number | null;
  valueUnit: string | null;
  valueJson: unknown;
  asOf: string | null;
  sourceId: string;
  methodologyVersion: string;
  derivationVersionKey: string;
  derivationVersions: unknown;
  cutAtTimestamp: Date | string | null;
  contentHash: string | null;
  isDisputedAtCut: boolean | null;
}

export interface SnapshotPair {
  jurisdictionId: string;
  factKey: string;
  slug: string;
  name: string;
}

export interface SnapshotSummary {
  vintageLabel: string;
  cutAt: string;
  scanned: number;
  snapshotted: number;
  unchanged: number;
  skippedNoFactKey: number;
  skippedNoCanonical: number;
  errors: Array<{ jurisdictionSlug: string; factKey: string; error: string }>;
}

/* ────────────────────────────────────────────────────────────────
 * Internal helpers
 * ──────────────────────────────────────────────────────────────── */

interface FactRowDb {
  id: string;
  jurisdictionId: string;
  factKey: string;
  factGroup: string;
  category: string;
  sourceId: string;
  sourceUrl: string | null;
  wikidataQid: string | null;
  wikidataPid: string | null;
  wikidataRank: string | null;
  references: unknown;
  factValue: string | null;
  factValueNumeric: number | null;
  factUnit: string | null;
  factYear: number | null;
  valueJson: unknown;
  asOf: string | null;
  /** Real measurement year when it differs from the prose stamp;
   *  drives resolver freshness on replay. */
  dataVintageYear?: number | null;
  retrievedAt: Date | string;
  upstreamVintageLabel: string | null;
  methodologyVersion: string;
  status: string;
  statusReason: string | null;
  sourceNote: string | null;
  /** Bug 1 — `'measured'` (default) or `'projected'`. */
  valueType?: string | null;
  /** Growth-methodology discriminator; NULL on non-growth fact-keys. */
  growthMethodology?: string | null;
}

function dbRowToFactRow(row: FactRowDb): FactRow {
  return {
    id: row.id,
    jurisdictionId: row.jurisdictionId,
    factKey: row.factKey,
    factGroup: row.factGroup as "A" | "B" | "C",
    category: row.category,
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    wikidataQid: row.wikidataQid,
    wikidataPid: row.wikidataPid,
    wikidataRank:
      row.wikidataRank === "preferred" ||
      row.wikidataRank === "normal" ||
      row.wikidataRank === "deprecated"
        ? row.wikidataRank
        : null,
    references: Array.isArray(row.references)
      ? (row.references as unknown[])
      : null,
    factValue: row.factValue,
    factValueNumeric: row.factValueNumeric,
    factUnit: row.factUnit,
    factYear: row.factYear,
    valueJson: row.valueJson,
    asOf: row.asOf,
    dataVintageYear: row.dataVintageYear ?? null,
    retrievedAt:
      typeof row.retrievedAt === "string"
        ? row.retrievedAt
        : row.retrievedAt.toISOString(),
    upstreamVintageLabel: row.upstreamVintageLabel,
    methodologyVersion: row.methodologyVersion,
    status:
      row.status === "active" ||
      row.status === "rejected" ||
      row.status === "superseded" ||
      row.status === "demoted"
        ? row.status
        : "active",
    statusReason: row.statusReason,
    sourceNote: row.sourceNote,
    valueType: row.valueType === "projected" ? "projected" : "measured",
    growthMethodology: resolveGrowthMethodology(
      row.growthMethodology,
      row.sourceId,
      row.factKey
    ),
  };
}

/**
 * Fetch the set of `(jurisdiction_id, fact_key)` pairs currently
 * carrying open / in-review disputes. Used to stamp
 * `is_disputed_at_cut` per row without 1+N database hits.
 */
async function readDisputedKeys(
  db: Db,
  jurisdictionFilterId?: string,
): Promise<Set<string>> {
  const rows = await db
    .select({
      jurisdictionId: dataDisputes.jurisdictionId,
      factKey: dataDisputes.factKey,
    })
    .from(dataDisputes)
    .where(
      and(
        inArray(dataDisputes.status, ["open", "in_review"]),
        jurisdictionFilterId
          ? eq(dataDisputes.jurisdictionId, jurisdictionFilterId)
          : sql`1=1`,
      ),
    );

  const set = new Set<string>();
  for (const row of rows) {
    set.add(`${row.jurisdictionId} ${row.factKey}`);
  }
  return set;
}

/* ────────────────────────────────────────────────────────────────
 * Public entry point
 * ──────────────────────────────────────────────────────────────── */

/**
 * Run the snapshot end-to-end. Returns a summary that the caller
 * (cron route or CLI script) renders as JSON / log.
 *
 * Idempotency: an exact existing row is verified and skipped. Any
 * changed row under the same label fails. Database triggers also
 * reject UPDATE/DELETE, including from code that bypasses this writer.
 *
 * Disputes: per-row `is_disputed_at_cut` is stamped from the
 * `data_disputes` table state at cut time. This is a *frozen
 * copy* — disputes that resolve post-cut do not retroactively
 * update the snapshot row.
 */
export async function snapshotCurrentVintage(
  options: SnapshotOptions = {},
  dbInstance: Db = defaultDb,
): Promise<SnapshotSummary> {
  const cutDate = options.cutDate ?? new Date();
  const vintageLabel =
    options.vintageLabel ??
    deriveVintageLabel(
      cutDate,
      options.methodologyVersion ?? VINTAGE_METHODOLOGY_VERSION,
    );
  const identity = parseAtlasVintageLabel(vintageLabel);
  if (options.methodologyVersion && options.methodologyVersion !== identity.methodologyVersion) {
    throw new Error(`Vintage label publishes ${identity.methodologyVersion}, not requested methodology ${options.methodologyVersion}.`);
  }
  const onProgress = options.onProgress ?? (() => {});

  onProgress(
    `Snapshot starting — vintage="${vintageLabel}"${options.dryRun ? " (DRY RUN)" : ""}` +
      (options.jurisdictionSlug
        ? ` jurisdiction=${options.jurisdictionSlug}`
        : ""),
  );

  // Resolve jurisdiction filter once if applicable.
  let jurisdictionFilterId: string | undefined;
  if (options.jurisdictionSlug) {
    const j = await dbInstance
      .select({ id: jurisdictionsTable.id })
      .from(jurisdictionsTable)
      .where(eq(jurisdictionsTable.slug, options.jurisdictionSlug))
      .limit(1);
    if (j.length === 0) {
      throw new Error(
        `Jurisdiction not found: ${options.jurisdictionSlug}`,
      );
    }
    jurisdictionFilterId = j[0].id;
  }

  // 1. Walk every (jurisdiction, fact_key) pair in country_facts.
  const pairs = options.pairs ?? await dbInstance
    .select({
      jurisdictionId: countryFacts.jurisdictionId,
      factKey: countryFacts.factKey,
      slug: jurisdictionsTable.slug,
      name: jurisdictionsTable.name,
    })
    .from(countryFacts)
    .innerJoin(
      jurisdictionsTable,
      eq(countryFacts.jurisdictionId, jurisdictionsTable.id),
    )
    .where(
      jurisdictionFilterId
        ? eq(countryFacts.jurisdictionId, jurisdictionFilterId)
        : sql`1=1`,
    )
    .groupBy(
      countryFacts.jurisdictionId,
      countryFacts.factKey,
      jurisdictionsTable.slug,
      jurisdictionsTable.name,
    );

  onProgress(`  ${pairs.length} (jurisdiction, fact_key) pairs to snapshot.`);

  // 2. Pre-fetch the disputed-keys set so we don't 1+N the dispute
  //    table for every pair.
  const disputedKeys = options.disputedKeys ?? await readDisputedKeys(dbInstance, jurisdictionFilterId);

  const existingFrozenRows = options.existingFrozenRows ?? await dbInstance
    .select({
      jurisdictionId: countryFactVintages.jurisdictionId,
      factKey: countryFactVintages.factKey,
      vintageLabel: countryFactVintages.vintageLabel,
      supersedesVintageLabel: countryFactVintages.supersedesVintageLabel,
      canonicalFactId: countryFactVintages.canonicalFactId,
      valueText: countryFactVintages.valueText,
      valueNumeric: countryFactVintages.valueNumeric,
      valueUnit: countryFactVintages.valueUnit,
      valueJson: countryFactVintages.valueJson,
      asOf: countryFactVintages.asOf,
      sourceId: countryFactVintages.sourceId,
      methodologyVersion: countryFactVintages.methodologyVersion,
      derivationVersionKey: countryFactVintages.derivationVersionKey,
      derivationVersions: countryFactVintages.derivationVersions,
      cutAtTimestamp: countryFactVintages.cutAtTimestamp,
      contentHash: countryFactVintages.contentHash,
      isDisputedAtCut: countryFactVintages.isDisputedAtCut,
    })
    .from(countryFactVintages)
    .where(sql`${countryFactVintages.vintageLabel} = ${vintageLabel}
      OR ${countryFactVintages.vintageLabel} LIKE ${`%vintage ${identity.period}`}`);
  const priorLabels = existingFrozenRows
    .filter((row) => row.vintageLabel !== vintageLabel)
    .map((row) => row.vintageLabel);
  assertSupersession({ label: vintageLabel, supersedes: options.supersedesVintageLabel, priorLabels });
  const existingByKey = new Map(
    existingFrozenRows
      .filter((row) => row.vintageLabel === vintageLabel)
      .map((row) => [`${row.jurisdictionId}\0${row.factKey}`, row]),
  );

  const summary: SnapshotSummary = {
    vintageLabel,
    cutAt: cutDate.toISOString(),
    scanned: 0,
    snapshotted: 0,
    unchanged: 0,
    skippedNoFactKey: 0,
    skippedNoCanonical: 0,
    errors: [],
  };

  for (const pair of pairs) {
    summary.scanned += 1;
    const factKeyDef = getFactKey(pair.factKey);
    if (!factKeyDef) {
      summary.skippedNoFactKey += 1;
      continue;
    }

    try {
      // 3. Pull all rows for this pair, resolve, snapshot the winner.
      const rowsRaw = options.readRows
        ? await options.readRows(pair)
        : (await dbInstance
            .select()
            .from(countryFacts)
            .where(
              sql`${countryFacts.jurisdictionId} = ${pair.jurisdictionId}
                AND ${countryFacts.factKey} = ${pair.factKey}`,
            )) as unknown as FactRowDb[];

      const rows = rowsRaw.map(dbRowToFactRow);
      const result = resolveFromRows(rows, factKeyDef);

      if (!result.canonical) {
        summary.skippedNoCanonical += 1;
        continue;
      }

      const isDisputedAtCut = disputedKeys.has(
        `${pair.jurisdictionId} ${pair.factKey}`,
      );

      const contentHash = computeContentHash({
        sourceId: result.canonical.sourceId,
        valueText: result.canonical.factValue,
        valueNumeric: result.canonical.factValueNumeric,
        asOf: result.canonical.asOf,
        methodologyVersion: identity.methodologyVersion,
      });
      const versions = reconciliationVersionEnvelope({
        methodologyVersion: identity.methodologyVersion,
        sourceIds: rows.map((row) => row.sourceId),
      });

      if (options.dryRun) {
        onProgress(
          `  [DRY] ${pair.slug} / ${pair.factKey} → ${result.canonical.sourceId} (${result.decisionReason}, hash=${contentHash.slice(0, 12)}…, disputed=${isDisputedAtCut})`,
        );
        summary.snapshotted += 1;
        continue;
      }

      const frozenValue = {
          jurisdictionId: pair.jurisdictionId,
          factKey: pair.factKey,
          vintageLabel,
          supersedesVintageLabel: options.supersedesVintageLabel ?? null,
          canonicalFactId: result.canonical.id,
          valueText: result.canonical.factValue,
          valueNumeric: result.canonical.factValueNumeric,
          valueUnit: result.canonical.factUnit,
          valueJson: result.canonical.valueJson as object | null,
          asOf: result.canonical.asOf,
          sourceId: result.canonical.sourceId,
          methodologyVersion: identity.methodologyVersion,
          derivationVersionKey: versions.key,
          derivationVersions: versions.envelope,
          cutAtTimestamp: cutDate,
          contentHash,
          isDisputedAtCut,
      };
      const existing = existingByKey.get(`${pair.jurisdictionId}\0${pair.factKey}`);
      if (existing) {
        const normalize = (value: ExistingFrozenFactRow | typeof frozenValue) => ({
          ...value,
          cutAtTimestamp: value.cutAtTimestamp instanceof Date
            ? value.cutAtTimestamp.toISOString()
            : value.cutAtTimestamp,
        });
        if (stableStringify(normalize(existing)) !== stableStringify(normalize(frozenValue))) {
          throw new Error(`Frozen vintage conflict for ${vintageLabel}; publish a new superseding version instead.`);
        }
        summary.unchanged += 1;
        continue;
      }

      await dbInstance
        .insert(countryFactVintages)
        .values(frozenValue)
        .onConflictDoNothing();

      summary.snapshotted += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push({
        jurisdictionSlug: pair.slug,
        factKey: pair.factKey,
        error: msg,
      });
      onProgress(`! ${pair.slug} / ${pair.factKey}: ${msg}`);
    }
  }

  onProgress(
    `Done. snapshotted=${summary.snapshotted} skippedNoFactKey=${summary.skippedNoFactKey} skippedNoCanonical=${summary.skippedNoCanonical} errors=${summary.errors.length}`,
  );

  return summary;
}

// Re-export `ResolverOutput` for callers that want to type the
// resolver pre-write payload (rare; unit tests).
export type { ResolverOutput };
