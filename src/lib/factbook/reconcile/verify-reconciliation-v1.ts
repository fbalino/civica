/**
 * v1.0 reconciliation verification suite — pure library.
 *
 * Runs every gate from `v1ReconciliationGates` (in
 * `src/lib/content/site-state.ts`) against the live DB and emits a
 * structured pass/warn/fail report. The cron handler at
 * `src/app/api/cron/factbook/verify-reconciliation/route.ts` calls
 * `runVerificationSuite()` and decides whether to alert based on
 * `overallStatus`. The CLI driver at
 * `scripts/verify-reconciliation-v1.ts` re-exports this for manual
 * runs (`npx tsx scripts/verify-reconciliation-v1.ts`).
 *
 * Pure-helper-vs-DB-IO split mirrors `auto-resolve-disputes.ts`'s
 * `StalenessVerdict` shape — every comparator and softener is a small
 * exported function so unit tests can exercise the classification
 * logic without touching the DB.
 *
 * Adopted via: ~/civica/plan/v1-verification-suite-resolution-v1.md
 */
import { sql } from "drizzle-orm";

import {
  v1ReconciliationGates,
  launchPhase as defaultLaunchPhase,
} from "@/lib/content/site-state";

// `db` type re-export pattern matches auto-resolve-disputes.ts.
type Db = typeof import("@/lib/db").db;

// ─────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────

export type VerificationStatus = "pass" | "warn" | "fail";

export type VerificationCategory =
  | "coverage"
  | "freshness"
  | "vintage"
  | "methodology"
  | "disputes";

export type Comparator = ">=" | "<=" | "==" | "!=" | "regex_match";

export interface VerificationMetric {
  /** Stable string ID. Used as the metric handle in logs and tests. */
  id: string;
  /** Human-readable label. */
  label: string;
  category: VerificationCategory;
  status: VerificationStatus;
  /** When false, even a `fail` does not bubble up to overallStatus. */
  gating: boolean;
  comparator: Comparator;
  /** Threshold value as configured in `v1ReconciliationGates`. */
  threshold: number | string;
  /** Live-DB measurement. */
  actual: number | string;
  /** One-line human-readable narrative. */
  message: string;
}

export interface VerificationReport {
  timestamp: string;
  /** Aggregated worst-case status across gating metrics. */
  overallStatus: VerificationStatus;
  /** When true, the cron handler skipped failure escalation due to
   *  pre-launch posture (failures reported as `warn`). */
  preLaunchSoftened: boolean;
  passCount: number;
  warnCount: number;
  failCount: number;
  metrics: VerificationMetric[];
}

export interface RunOptions {
  /** Override the launch phase (used by tests + dryRun). Defaults
   *  to `launchPhase` from site-state. */
  launchPhase?: "pre-launch-beta" | "launched";
  /** Restrict evaluation to a single metric. Useful for smoke tests. */
  metricId?: string;
  /** Reserved for future per-source / per-NSO detail in `actual`. */
  verbose?: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Pure comparator helpers — exported for unit tests
// ─────────────────────────────────────────────────────────────────────

/**
 * Pure status classifier given a comparator and a (threshold, actual)
 * pair. No DB IO. Returns `"pass"` when the comparison is satisfied,
 * `"fail"` otherwise. Pre-launch softening is applied separately by
 * `softenStatus()`.
 */
export function classifyComparator(
  comparator: Comparator,
  threshold: number | string,
  actual: number | string,
): "pass" | "fail" {
  switch (comparator) {
    case ">=":
      return Number(actual) >= Number(threshold) ? "pass" : "fail";
    case "<=":
      return Number(actual) <= Number(threshold) ? "pass" : "fail";
    case "==":
      // String-typed comparison so e.g. "v0.2-beta" == "v0.2-beta" works.
      return String(actual) === String(threshold) ? "pass" : "fail";
    case "!=":
      return String(actual) !== String(threshold) ? "pass" : "fail";
    case "regex_match":
      return new RegExp(String(threshold)).test(String(actual))
        ? "pass"
        : "fail";
    default: {
      const _never: never = comparator;
      throw new Error(`Unknown comparator: ${String(_never)}`);
    }
  }
}

/**
 * Apply pre-launch softening: while `launchPhase === "pre-launch-beta"`,
 * a gating `fail` becomes `warn` (no public traffic to harm).
 * Non-gating metrics never escalate beyond `warn`.
 */
export function softenStatus(
  rawStatus: "pass" | "fail",
  gating: boolean,
  launchPhase: "pre-launch-beta" | "launched",
): VerificationStatus {
  if (rawStatus === "pass") return "pass";
  // Non-gating metrics: failures are advisory only.
  if (!gating) return "warn";
  // Gating metrics: harden once launched, soften pre-launch.
  return launchPhase === "launched" ? "fail" : "warn";
}

/**
 * Aggregate the per-metric statuses into a top-level report status.
 * `fail` if any metric is fail; `warn` if any metric is warn; else
 * `pass`. Pre-launch softening is already applied per-metric.
 */
export function aggregateStatus(
  metrics: VerificationMetric[],
): VerificationStatus {
  let worst: VerificationStatus = "pass";
  for (const m of metrics) {
    if (m.status === "fail") return "fail"; // short-circuit
    if (m.status === "warn") worst = "warn";
  }
  return worst;
}

// ─────────────────────────────────────────────────────────────────────
// SQL helpers (private; mirror site-stats.ts shape)
// ─────────────────────────────────────────────────────────────────────

async function queryScalar(
  db: Db,
  query: ReturnType<typeof sql>,
): Promise<number> {
  const res = await db.execute(query);
  const rows = (res as unknown as { rows?: unknown[] }).rows ?? res;
  const row = (rows as Array<{ n?: number | string }>)[0];
  return Number(row?.n ?? 0);
}

async function queryRows<T>(
  db: Db,
  query: ReturnType<typeof sql>,
): Promise<T[]> {
  const res = await db.execute(query);
  const rows = (res as unknown as { rows?: unknown[] }).rows ?? res;
  return rows as T[];
}

// ─────────────────────────────────────────────────────────────────────
// Per-metric evaluators
// ─────────────────────────────────────────────────────────────────────

async function evalActiveSources(db: Db): Promise<{ actual: number }> {
  const n = await queryScalar(
    db,
    sql`SELECT COUNT(DISTINCT source_id)::int AS n FROM country_facts`,
  );
  return { actual: n };
}

async function evalMultiSourced(
  db: Db,
  threshold: 2 | 3,
): Promise<{ actual: number }> {
  const n = await queryScalar(
    db,
    sql`SELECT COUNT(DISTINCT fact_key)::int AS n FROM (
          SELECT fact_key, jurisdiction_id
          FROM country_facts
          GROUP BY fact_key, jurisdiction_id
          HAVING COUNT(DISTINCT source_id) >= ${threshold}
        ) sub`,
  );
  return { actual: n };
}

async function evalTotalFacts(db: Db): Promise<{ actual: number }> {
  const n = await queryScalar(
    db,
    sql`SELECT COUNT(*)::int AS n FROM country_facts`,
  );
  return { actual: n };
}

async function evalWikidataFreshness(
  db: Db,
): Promise<{ actual: number; total: number; fresh: number }> {
  const total = await queryScalar(
    db,
    sql`SELECT COUNT(*)::int AS n FROM country_facts WHERE source_id = 'wikidata'`,
  );
  const fresh = await queryScalar(
    db,
    sql`SELECT COUNT(*)::int AS n
        FROM country_facts
        WHERE source_id = 'wikidata'
          AND retrieved_at > NOW() - INTERVAL '2 years'`,
  );
  // 0/0 → ratio 0 (the activeSources gate catches the no-Wikidata-rows case).
  const ratio = total > 0 ? fresh / total : 0;
  return { actual: +ratio.toFixed(4), total, fresh };
}

async function evalWikidataZeroGlobally(
  db: Db,
  expectedFactKeys: readonly string[],
): Promise<{ actual: number; missing: string[] }> {
  const rows = await queryRows<{ fact_key: string }>(
    db,
    sql`SELECT DISTINCT fact_key FROM country_facts WHERE source_id = 'wikidata'`,
  );
  const present = new Set(rows.map((r) => r.fact_key));
  const missing = expectedFactKeys.filter((k) => !present.has(k));
  return { actual: missing.length, missing };
}

async function evalSourceSyncStatus(
  db: Db,
  sourceIds: readonly string[],
  maxDays: number,
): Promise<{
  actualMissing: number;
  actualStale: number;
  details: Array<{ id: string; lastSyncAt: string | null; freshness: string }>;
}> {
  // The `sources` registry table is small (~30 rows in production); a
  // full SELECT + in-memory filter is simpler than wiring drizzle's
  // inArray() and avoids the Neon HTTP "ANY/ALL requires array on
  // right side" issue on parameterised text[] casts.
  const allRows = await queryRows<{
    id: string;
    last_sync_at: string | null;
  }>(
    db,
    sql`SELECT id, last_sync_at::text AS last_sync_at FROM sources`,
  );
  const wanted = new Set(sourceIds);
  const rows = allRows.filter((r) => wanted.has(r.id));
  const now = Date.now();
  let missing = 0;
  let stale = 0;
  const details = sourceIds.map((id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) {
      missing++;
      return { id, lastSyncAt: null, freshness: "absent_from_sources" };
    }
    if (!row.last_sync_at) {
      missing++;
      return { id, lastSyncAt: null, freshness: "never_synced" };
    }
    const ageMs = now - new Date(row.last_sync_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > maxDays) {
      stale++;
      return {
        id,
        lastSyncAt: row.last_sync_at,
        freshness: `stale_${Math.round(ageDays)}d`,
      };
    }
    return { id, lastSyncAt: row.last_sync_at, freshness: "fresh" };
  });
  return { actualMissing: missing, actualStale: stale, details };
}

async function evalVintageLabel(
  db: Db,
): Promise<{
  actualMatching: number;
  mostRecentLabel: string | null;
  mostRecentCutAt: string | null;
}> {
  const rows = await queryRows<{
    vintage_label: string;
    last_cut: string | null;
  }>(
    db,
    sql`SELECT vintage_label,
               MAX(cut_at_timestamp)::text AS last_cut
        FROM country_fact_vintages
        GROUP BY vintage_label
        ORDER BY last_cut DESC NULLS LAST`,
  );
  const regex = new RegExp(v1ReconciliationGates.vintageLabelRegex);
  const matching = rows.filter((r) => regex.test(r.vintage_label));
  return {
    actualMatching: matching.length,
    mostRecentLabel: matching[0]?.vintage_label ?? null,
    mostRecentCutAt: matching[0]?.last_cut ?? null,
  };
}

async function evalVintageFreshness(
  db: Db,
): Promise<{ actualDaysSinceCut: number; mostRecentCutAt: string | null }> {
  const rows = await queryRows<{ last_cut: string | null }>(
    db,
    sql`SELECT MAX(cut_at_timestamp)::text AS last_cut
        FROM country_fact_vintages
        WHERE cut_at_timestamp IS NOT NULL`,
  );
  const lastCut = rows[0]?.last_cut ?? null;
  if (!lastCut) {
    return { actualDaysSinceCut: Number.MAX_SAFE_INTEGER, mostRecentCutAt: null };
  }
  const ageMs = Date.now() - new Date(lastCut).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return { actualDaysSinceCut: Math.round(ageDays), mostRecentCutAt: lastCut };
}

async function evalMethodologyVersionDistinct(
  db: Db,
): Promise<{ actual: number; distribution: Record<string, number> }> {
  const rows = await queryRows<{ methodology_version: string; n: number }>(
    db,
    sql`SELECT methodology_version, COUNT(*)::int AS n
        FROM country_facts
        GROUP BY methodology_version`,
  );
  const distribution: Record<string, number> = {};
  for (const r of rows) {
    distribution[r.methodology_version ?? "null"] = Number(r.n);
  }
  return { actual: rows.length, distribution };
}

async function evalOpenDisputes(db: Db): Promise<{ actual: number }> {
  const n = await queryScalar(
    db,
    sql`SELECT COUNT(*)::int AS n FROM data_disputes WHERE status = 'open'`,
  );
  return { actual: n };
}

// ─────────────────────────────────────────────────────────────────────
// Metric builders
// ─────────────────────────────────────────────────────────────────────

function buildMetric(args: {
  id: string;
  label: string;
  category: VerificationCategory;
  comparator: Comparator;
  threshold: number | string;
  actual: number | string;
  gating: boolean;
  launchPhase: "pre-launch-beta" | "launched";
  message: string;
}): VerificationMetric {
  const raw = classifyComparator(args.comparator, args.threshold, args.actual);
  const status = softenStatus(raw, args.gating, args.launchPhase);
  return {
    id: args.id,
    label: args.label,
    category: args.category,
    status,
    gating: args.gating,
    comparator: args.comparator,
    threshold: args.threshold,
    actual: args.actual,
    message: args.message,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Suite runner
// ─────────────────────────────────────────────────────────────────────

/**
 * Runs every v1.0 verification gate against the supplied DB and
 * returns a structured report. Pure of console.log / process.exit;
 * the CLI driver and cron route do their own output formatting.
 */
export async function runVerificationSuite(
  db: Db,
  options: RunOptions = {},
): Promise<VerificationReport> {
  const launchPhase = options.launchPhase ?? defaultLaunchPhase;
  const onlyId = options.metricId;
  const includes = (id: string) => !onlyId || onlyId === id;

  const metrics: VerificationMetric[] = [];

  // ── 1. coverage / activeSources ──
  if (includes("active_sources")) {
    const r = await evalActiveSources(db);
    metrics.push(
      buildMetric({
        id: "active_sources",
        label: "Distinct source_ids writing to country_facts",
        category: "coverage",
        comparator: ">=",
        threshold: v1ReconciliationGates.activeSources.threshold,
        actual: r.actual,
        gating: v1ReconciliationGates.activeSources.gating,
        launchPhase,
        message: `${r.actual} active sources (need ≥ ${v1ReconciliationGates.activeSources.threshold})`,
      }),
    );
  }

  // ── 2. coverage / multi-sourced ≥2 ──
  if (includes("multi_sourced_two")) {
    const r = await evalMultiSourced(db, 2);
    metrics.push(
      buildMetric({
        id: "multi_sourced_two",
        label: "Fact-keys with ≥2 sources for ≥1 country",
        category: "coverage",
        comparator: ">=",
        threshold: v1ReconciliationGates.multiSourcedTwoOrMore.threshold,
        actual: r.actual,
        gating: v1ReconciliationGates.multiSourcedTwoOrMore.gating,
        launchPhase,
        message: `${r.actual} fact-keys ≥ 2 sources (need ≥ ${v1ReconciliationGates.multiSourcedTwoOrMore.threshold})`,
      }),
    );
  }

  // ── 3. coverage / multi-sourced ≥3 ──
  if (includes("multi_sourced_three")) {
    const r = await evalMultiSourced(db, 3);
    metrics.push(
      buildMetric({
        id: "multi_sourced_three",
        label: "Fact-keys with ≥3 sources for ≥1 country",
        category: "coverage",
        comparator: ">=",
        threshold: v1ReconciliationGates.multiSourcedThreeOrMore.threshold,
        actual: r.actual,
        gating: v1ReconciliationGates.multiSourcedThreeOrMore.gating,
        launchPhase,
        message: `${r.actual} fact-keys ≥ 3 sources (need ≥ ${v1ReconciliationGates.multiSourcedThreeOrMore.threshold})`,
      }),
    );
  }

  // ── 4. coverage / total facts ──
  if (includes("total_facts")) {
    const r = await evalTotalFacts(db);
    metrics.push(
      buildMetric({
        id: "total_facts",
        label: "Total country_facts row count",
        category: "coverage",
        comparator: ">=",
        threshold: v1ReconciliationGates.totalFactsMin.threshold,
        actual: r.actual,
        gating: v1ReconciliationGates.totalFactsMin.gating,
        launchPhase,
        message: `${r.actual.toLocaleString()} rows (need ≥ ${v1ReconciliationGates.totalFactsMin.threshold.toLocaleString()})`,
      }),
    );
  }

  // ── 5. freshness / Wikidata retrieved-at ──
  if (includes("wikidata_freshness_retrieved")) {
    const r = await evalWikidataFreshness(db);
    metrics.push(
      buildMetric({
        id: "wikidata_freshness_retrieved",
        label: "% Wikidata rows retrieved within 2 years",
        category: "freshness",
        comparator: ">=",
        threshold: v1ReconciliationGates.wikidataFreshnessRatio.threshold,
        actual: r.actual,
        gating: v1ReconciliationGates.wikidataFreshnessRatio.gating,
        launchPhase,
        message: `${(r.actual * 100).toFixed(1)}% fresh (${r.fresh}/${r.total}; need ≥ ${(v1ReconciliationGates.wikidataFreshnessRatio.threshold * 100).toFixed(0)}%)`,
      }),
    );
  }

  // ── 6. freshness / Wikidata zero-globally ──
  if (includes("wikidata_zero_globally")) {
    const r = await evalWikidataZeroGlobally(
      db,
      v1ReconciliationGates.wikidataFactKeys,
    );
    metrics.push(
      buildMetric({
        id: "wikidata_zero_globally",
        label: "Wikidata fact-keys with zero rows globally",
        category: "freshness",
        comparator: "==",
        threshold: 0,
        actual: r.actual,
        gating: true,
        launchPhase,
        message:
          r.actual === 0
            ? `All ${v1ReconciliationGates.wikidataFactKeys.length} expected Wikidata fact-keys present`
            : `Missing fact-keys: ${r.missing.join(", ")}`,
      }),
    );
  }

  // ── 7. freshness / NSO sync presence ──
  if (includes("nso_sync_status")) {
    const r = await evalSourceSyncStatus(
      db,
      v1ReconciliationGates.activeNsoSources,
      v1ReconciliationGates.syncFreshnessMaxDays.threshold,
    );
    metrics.push(
      buildMetric({
        id: "nso_sync_status",
        label: "NSO sources with last_sync_at NOT NULL",
        category: "freshness",
        comparator: "==",
        threshold: 0,
        actual: r.actualMissing,
        gating: true,
        launchPhase,
        message:
          r.actualMissing === 0
            ? `All ${v1ReconciliationGates.activeNsoSources.length} NSOs have sync timestamp`
            : `${r.actualMissing} NSO(s) missing sync: ${r.details
                .filter((d) => d.freshness === "never_synced" || d.freshness === "absent_from_sources")
                .map((d) => d.id)
                .join(", ")}`,
      }),
    );
  }

  // ── 8. freshness / NSO sync freshness ──
  if (includes("nso_sync_freshness")) {
    const r = await evalSourceSyncStatus(
      db,
      v1ReconciliationGates.activeNsoSources,
      v1ReconciliationGates.syncFreshnessMaxDays.threshold,
    );
    metrics.push(
      buildMetric({
        id: "nso_sync_freshness",
        label: `All NSOs synced within ${v1ReconciliationGates.syncFreshnessMaxDays.threshold} days`,
        category: "freshness",
        comparator: "==",
        threshold: 0,
        actual: r.actualStale,
        gating: true,
        launchPhase,
        message:
          r.actualStale === 0
            ? `All NSOs fresh (within ${v1ReconciliationGates.syncFreshnessMaxDays.threshold} days)`
            : `${r.actualStale} NSO(s) stale: ${r.details
                .filter((d) => d.freshness.startsWith("stale_"))
                .map((d) => `${d.id} (${d.freshness})`)
                .join(", ")}`,
      }),
    );
  }

  // ── 9. freshness / Tier-1 sync presence ──
  if (includes("tier1_sync_status")) {
    const r = await evalSourceSyncStatus(
      db,
      v1ReconciliationGates.activeTier1Sources,
      v1ReconciliationGates.syncFreshnessMaxDays.threshold,
    );
    metrics.push(
      buildMetric({
        id: "tier1_sync_status",
        label: "Tier-1 sources with last_sync_at NOT NULL",
        category: "freshness",
        comparator: "==",
        threshold: 0,
        actual: r.actualMissing,
        gating: true,
        launchPhase,
        message:
          r.actualMissing === 0
            ? `All ${v1ReconciliationGates.activeTier1Sources.length} Tier-1 sources have sync timestamp`
            : `${r.actualMissing} Tier-1 source(s) missing sync: ${r.details
                .filter((d) => d.freshness === "never_synced" || d.freshness === "absent_from_sources")
                .map((d) => d.id)
                .join(", ")}`,
      }),
    );
  }

  // ── 10. freshness / Tier-1 sync freshness ──
  if (includes("tier1_sync_freshness")) {
    const r = await evalSourceSyncStatus(
      db,
      v1ReconciliationGates.activeTier1Sources,
      v1ReconciliationGates.syncFreshnessMaxDays.threshold,
    );
    metrics.push(
      buildMetric({
        id: "tier1_sync_freshness",
        label: `All Tier-1 sources synced within ${v1ReconciliationGates.syncFreshnessMaxDays.threshold} days`,
        category: "freshness",
        comparator: "==",
        threshold: 0,
        actual: r.actualStale,
        gating: true,
        launchPhase,
        message:
          r.actualStale === 0
            ? `All Tier-1 sources fresh (within ${v1ReconciliationGates.syncFreshnessMaxDays.threshold} days)`
            : `${r.actualStale} Tier-1 source(s) stale: ${r.details
                .filter((d) => d.freshness.startsWith("stale_"))
                .map((d) => `${d.id} (${d.freshness})`)
                .join(", ")}`,
      }),
    );
  }

  // ── 11. vintage / label format ──
  if (includes("vintage_label_format")) {
    const r = await evalVintageLabel(db);
    metrics.push(
      buildMetric({
        id: "vintage_label_format",
        label: "Vintage labels matching v1.0 format regex",
        category: "vintage",
        comparator: ">=",
        threshold: 1,
        actual: r.actualMatching,
        gating: true,
        launchPhase,
        message:
          r.actualMatching > 0
            ? `Most recent matching label: '${r.mostRecentLabel}'`
            : "No vintage label matches the v1.0 format regex",
      }),
    );
  }

  // ── 12. vintage / freshness ──
  if (includes("vintage_freshness")) {
    const r = await evalVintageFreshness(db);
    metrics.push(
      buildMetric({
        id: "vintage_freshness",
        label: `Most recent vintage cut within ${v1ReconciliationGates.vintageFreshnessMaxDays.threshold} days`,
        category: "vintage",
        comparator: "<=",
        threshold: v1ReconciliationGates.vintageFreshnessMaxDays.threshold,
        actual: r.actualDaysSinceCut,
        gating: v1ReconciliationGates.vintageFreshnessMaxDays.gating,
        launchPhase,
        message:
          r.mostRecentCutAt === null
            ? "No vintage cut has ever happened"
            : `${r.actualDaysSinceCut} days since last cut (${r.mostRecentCutAt})`,
      }),
    );
  }

  // ── 13. methodology / version distinct ──
  if (includes("methodology_version_consistency")) {
    const r = await evalMethodologyVersionDistinct(db);
    metrics.push(
      buildMetric({
        id: "methodology_version_consistency",
        label: "Distinct methodology_version values in country_facts",
        category: "methodology",
        comparator: "<=",
        threshold: v1ReconciliationGates.methodologyVersionMaxDistinct.threshold,
        actual: r.actual,
        gating: v1ReconciliationGates.methodologyVersionMaxDistinct.gating,
        launchPhase,
        message: `${r.actual} distinct value(s): ${Object.entries(r.distribution)
          .map(([v, n]) => `${v}=${n.toLocaleString()}`)
          .join(", ")}`,
      }),
    );
  }

  // ── 14. disputes / open queue ──
  if (includes("open_disputes_bottleneck")) {
    const r = await evalOpenDisputes(db);
    metrics.push(
      buildMetric({
        id: "open_disputes_bottleneck",
        label: "Open disputes (informational ceiling)",
        category: "disputes",
        comparator: "<=",
        threshold: v1ReconciliationGates.openDisputesMax.threshold,
        actual: r.actual,
        gating: v1ReconciliationGates.openDisputesMax.gating,
        launchPhase,
        message: `${r.actual} open disputes (advisory ceiling: ${v1ReconciliationGates.openDisputesMax.threshold})`,
      }),
    );
  }

  const passCount = metrics.filter((m) => m.status === "pass").length;
  const warnCount = metrics.filter((m) => m.status === "warn").length;
  const failCount = metrics.filter((m) => m.status === "fail").length;
  const overallStatus = aggregateStatus(metrics);

  return {
    timestamp: new Date().toISOString(),
    overallStatus,
    preLaunchSoftened: launchPhase === "pre-launch-beta",
    passCount,
    warnCount,
    failCount,
    metrics,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Plain-text formatter (CLI + log-friendly)
// ─────────────────────────────────────────────────────────────────────

const STATUS_GLYPH: Record<VerificationStatus, string> = {
  pass: "✓",
  warn: "!",
  fail: "✗",
};

/**
 * Renders a report as a plain-text block. Used by the CLI driver and
 * by the cron handler when it logs the report to console.
 */
export function formatReport(report: VerificationReport): string {
  const lines: string[] = [];
  lines.push("v1.0 reconciliation verification suite");
  lines.push(`  timestamp:        ${report.timestamp}`);
  lines.push(`  overall status:   ${report.overallStatus.toUpperCase()}`);
  lines.push(
    `  pre-launch:       ${report.preLaunchSoftened ? "yes (failures softened to warn)" : "no"}`,
  );
  lines.push(
    `  pass / warn / fail: ${report.passCount} / ${report.warnCount} / ${report.failCount}`,
  );
  lines.push("");
  lines.push("metrics:");
  for (const m of report.metrics) {
    const flag = m.gating ? "" : "  (advisory)";
    lines.push(
      `  ${STATUS_GLYPH[m.status]} ${m.status.padEnd(4)} ${m.id.padEnd(36)}${flag}`,
    );
    lines.push(`        ${m.message}`);
  }
  return lines.join("\n");
}
