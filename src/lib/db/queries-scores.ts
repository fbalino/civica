/**
 * P1.1 — `<ScoresAndRankings>` data layer.
 *
 * Pulls the canonical governance / democracy / freedom score rows for a
 * single country, in display order:
 *   1. Civica Index (composite, 0-100)
 *   2. V-Dem Liberal Democracy (native 0-1 + global rank from CI dimension)
 *   3. Freedom House status (Free / Partly Free / Not Free + score)
 *   4. RSF Press Freedom (ingested dimension history)
 *   5. UNDP HDI (0-1, with rank)
 *   6. Transparency CPI (0-100, with rank)
 *
 * Trend = current value vs the oldest comparable value we have, capped at
 * "4y trend" — when ≥ 4 years of history exist we compare to the value
 * 4y ago; otherwise we fall back to the oldest available point and the
 * caller is responsible for any "since YYYY" labelling. We pass through
 * a raw `trendDelta` so the consumer can format it however the row
 * format demands (CI uses ±N.N points, V-Dem uses ±0.0X, HDI uses ±0.0XX).
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ciCompositeScores,
  ciDimensionScores,
  countryMetrics,
  jurisdictions,
} from "@/lib/db/schema";
import { CURRENT_CI_METHODOLOGY_VERSION } from "@/lib/ci/current-release";

export interface ScoreRow {
  /** Stable id used as React key + automation hook. */
  id: string;
  /** Display label, e.g. "Civica Index", "V-Dem Liberal Democracy". */
  label: string;
  /** Native (or 0-100 normalised) numeric score. NULL means render
   *  whatever we have from `scoreFormatted` only. */
  score: number | null;
  /** Pre-formatted value for the Value column. e.g. "41 / 100",
   *  "Partly Free (47/100)", "0.535". */
  scoreFormatted: string;
  /** Global rank, when available. */
  rank: number | null;
  /** Total ranked countries, when available. */
  totalRanked: number | null;
  /** Trend bucket — direction-only. */
  trend: "up" | "down" | "flat" | null;
  /** Signed numeric delta (latest minus oldest in window). NULL if
   *  no history is available. */
  trendDelta: number | null;
  /** Pre-formatted trend label including the unit ("+2.3", "−0.04"). */
  trendFormatted: string | null;
  /** Source id for `<SourceDot>` — must be a key in SOURCE_NAMES. */
  source: string;
  /** Display-friendly "as of" stamp. ISO date, year, or quarter. */
  asOf: string | null;
}

const FLAT_THRESHOLD = 0.0001;

/** Resolve a slug or id (tolerates both) into a jurisdictionId. The
 *  page already has the id but the public surfaces accept slugs, so
 *  we accept either. */
async function resolveJurisdiction(
  slugOrId: string,
): Promise<{ id: string; slug: string; iso3: string | null } | null> {
  // UUID heuristic — if the input parses as 8-4-4-4-12 hex, treat as id.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    slugOrId,
  );
  const rows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(
      isUuid
        ? eq(jurisdictions.id, slugOrId)
        : eq(jurisdictions.slug, slugOrId),
    )
    .limit(1);
  return rows[0] ?? null;
}

function fmtSigned(n: number, digits: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}`;
}

function trendBucket(delta: number | null): "up" | "down" | "flat" | null {
  if (delta == null) return null;
  if (Math.abs(delta) < FLAT_THRESHOLD) return "flat";
  return delta > 0 ? "up" : "down";
}

// ---- Civica Index ----------------------------------------------------------

const CI_METHODOLOGY_VERSION = CURRENT_CI_METHODOLOGY_VERSION;

async function buildCivicaIndexRow(jId: string): Promise<ScoreRow | null> {
  // Pin the methodology version (beta) — 47 jurisdictions carry both v1.0
  // and beta rows at 2023-Q4, so an unpinned read lets Postgres row-order
  // decide which value leaks into a beta-labeled row / trend arrow. Matches
  // the pin on compareCICountries / getCICountryHistory.
  const [latest] = await db
    .select({
      quarter: ciCompositeScores.quarter,
      score: ciCompositeScores.score,
      rank: ciCompositeScores.rank,
      totalRanked: ciCompositeScores.totalRanked,
    })
    .from(ciCompositeScores)
    .where(
      and(
        eq(ciCompositeScores.jurisdictionId, jId),
        eq(ciCompositeScores.methodologyVersion, CI_METHODOLOGY_VERSION),
      ),
    )
    .orderBy(desc(ciCompositeScores.quarter))
    .limit(1);
  if (!latest) return null;

  // 4y-ago comparison — find the row whose quarter sits closest to (and
  // ≤) "current quarter minus 4 years". Quarters are strings like
  // "2026-Q1" so lexicographic ordering works for comparison.
  const fourYearTarget = (() => {
    const m = /^(\d{4})-Q([1-4])$/.exec(latest.quarter);
    if (!m) return null;
    return `${parseInt(m[1], 10) - 4}-Q${m[2]}`;
  })();

  let trendDelta: number | null = null;
  if (fourYearTarget) {
    const [past] = await db
      .select({ score: ciCompositeScores.score })
      .from(ciCompositeScores)
      .where(
        and(
          eq(ciCompositeScores.jurisdictionId, jId),
          eq(ciCompositeScores.methodologyVersion, CI_METHODOLOGY_VERSION),
          sql`${ciCompositeScores.quarter} <= ${fourYearTarget}`,
        ),
      )
      .orderBy(desc(ciCompositeScores.quarter))
      .limit(1);
    if (past) trendDelta = Number(latest.score) - Number(past.score);
  }
  if (trendDelta == null) {
    // Fall back to the oldest available row in history.
    const [oldest] = await db
      .select({ score: ciCompositeScores.score })
      .from(ciCompositeScores)
      .where(
        and(
          eq(ciCompositeScores.jurisdictionId, jId),
          eq(ciCompositeScores.methodologyVersion, CI_METHODOLOGY_VERSION),
        ),
      )
      .orderBy(asc(ciCompositeScores.quarter))
      .limit(1);
    if (oldest && oldest.score !== latest.score) {
      trendDelta = Number(latest.score) - Number(oldest.score);
    }
  }

  const score = Number(latest.score);
  return {
    id: "civica-index",
    label: "Civica Index",
    score,
    scoreFormatted: `${score.toFixed(1)} / 100`,
    rank: latest.rank ?? null,
    totalRanked: latest.totalRanked ?? null,
    trend: trendBucket(trendDelta),
    trendDelta,
    trendFormatted: trendDelta != null ? fmtSigned(trendDelta, 1) : null,
    source: "civica_curated",
    asOf: latest.quarter,
  };
}

// ---- CI dimension rows (V-Dem, Freedom House) -----------------------------

interface DimRowOpts {
  jId: string;
  dimension: string;
  sourceId: string;
}

async function fetchDimensionHistory({ jId, dimension, sourceId }: DimRowOpts) {
  const rows = await db
    .select({
      quarter: ciDimensionScores.quarter,
      normalizedScore: ciDimensionScores.normalizedScore,
      rawValue: ciDimensionScores.rawValue,
    })
    .from(ciDimensionScores)
    .where(
      and(
        eq(ciDimensionScores.jurisdictionId, jId),
        eq(ciDimensionScores.dimension, dimension),
        eq(ciDimensionScores.sourceId, sourceId),
      ),
    )
    .orderBy(asc(ciDimensionScores.quarter));
  return rows;
}

/** Compute global rank for a country on a (dimension, sourceId, quarter)
 *  by counting jurisdictions with strictly higher normalized scores. */
async function rankWithinDimension(
  jId: string,
  dimension: string,
  sourceId: string,
  quarter: string,
): Promise<{ rank: number; total: number } | null> {
  const result = await db.execute(sql`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM ci_dimension_scores cds
        WHERE cds.dimension = ${dimension}
          AND cds.source_id = ${sourceId}
          AND cds.quarter = ${quarter}
          AND cds.normalized_score > (
            SELECT normalized_score FROM ci_dimension_scores
            WHERE jurisdiction_id = ${jId}
              AND dimension = ${dimension}
              AND source_id = ${sourceId}
              AND quarter = ${quarter}
            LIMIT 1
          )
      ) AS "higher",
      (
        SELECT COUNT(*)::int FROM ci_dimension_scores cds
        WHERE cds.dimension = ${dimension}
          AND cds.source_id = ${sourceId}
          AND cds.quarter = ${quarter}
      ) AS "total"
  `);
  const row = (
    Array.isArray(result)
      ? result[0]
      : (result as { rows?: unknown[] }).rows?.[0]
  ) as { higher?: number; total?: number } | undefined;
  if (!row || !row.total) return null;
  return { rank: (row.higher ?? 0) + 1, total: row.total };
}

async function buildVDemRow(jId: string): Promise<ScoreRow | null> {
  const history = await fetchDimensionHistory({
    jId,
    dimension: "democratic_quality",
    sourceId: "vdem",
  });
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  if (latest.rawValue == null) return null;

  // Trend in native space (0-1) — academically more meaningful than the
  // normalized 0-100 score (which is pegged to an annually-shifting
  // observed range).
  const trendDelta =
    history.length > 1 && history[0].rawValue != null
      ? Number(latest.rawValue) - Number(history[0].rawValue)
      : null;

  const ranking = await rankWithinDimension(
    jId,
    "democratic_quality",
    "vdem",
    latest.quarter,
  );

  const native = Number(latest.rawValue);
  return {
    id: "vdem-libdem",
    label: "V-Dem Liberal Democracy",
    score: native,
    scoreFormatted: native.toFixed(2),
    rank: ranking?.rank ?? null,
    totalRanked: ranking?.total ?? null,
    trend: trendBucket(trendDelta),
    trendDelta,
    trendFormatted: trendDelta != null ? fmtSigned(trendDelta, 2) : null,
    source: "vdem",
    asOf: latest.quarter,
  };
}

function freedomHouseLabel(rawValue: number): string {
  // `rawValue` is stored on the 2–14 SUM scale (avg × 2), not the retired
  // 1–7 AVERAGE — see scripts/ingest-ci-freedom-house.ts:33-50 and the
  // freedom_house bounds in src/lib/ci/normalize-v2.ts. Freedom in the
  // World status thresholds on the average map to the sum as:
  //   Free:        avg ≤ 2.5  ⇔ sum ≤ 5.0
  //   Partly Free: avg ≤ 5.0  ⇔ sum ≤ 10.0
  //   Not Free:    otherwise
  if (rawValue <= 5.0) return "Free";
  if (rawValue <= 10.0) return "Partly Free";
  return "Not Free";
}

async function buildFreedomHouseRow(jId: string): Promise<ScoreRow | null> {
  const history = await fetchDimensionHistory({
    jId,
    dimension: "freedom_rights",
    sourceId: "freedom_house",
  });
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  if (latest.rawValue == null) return null;

  const native = Number(latest.rawValue);
  // FH is inverted (lower = freer). Flip the sign so up = improved.
  const trendDelta =
    history.length > 1 && history[0].rawValue != null
      ? -(native - Number(history[0].rawValue))
      : null;

  const status = freedomHouseLabel(native);
  // The CI normalised score is 0-100 (higher = freer). Show the score
  // alongside the categorical label, since "Partly Free" alone is
  // coarse.
  const normalized = Math.round(latest.normalizedScore);

  return {
    id: "freedom-house",
    label: "Freedom House Status",
    score: normalized,
    scoreFormatted: `${status} (${normalized}/100)`,
    rank: null,
    totalRanked: null,
    trend: trendBucket(trendDelta),
    trendDelta,
    trendFormatted: trendDelta != null ? fmtSigned(trendDelta, 1) : null,
    source: "freedom_house",
    asOf: latest.quarter,
  };
}

// ---- RSF Press Freedom -----------------------------------------------------

async function buildRsfRow(jId: string): Promise<ScoreRow | null> {
  const history = await fetchDimensionHistory({
    jId,
    dimension: "freedom_rights",
    sourceId: "rsf_press_freedom",
  });
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  if (latest.normalizedScore == null) return null;
  const score = Math.round(Number(latest.normalizedScore));
  const oldest = history[0];
  const trendDelta =
    history.length > 1 && oldest.normalizedScore != null
      ? score - Number(oldest.normalizedScore)
      : null;
  return {
    id: "rsf",
    label: "Press Freedom (RSF)",
    score,
    scoreFormatted: `${score} / 100`,
    rank: null,
    totalRanked: null,
    trend: trendBucket(trendDelta),
    trendDelta,
    trendFormatted: trendDelta != null ? fmtSigned(trendDelta, 1) : null,
    source: "rsf_press_freedom",
    asOf: latest.quarter,
  };
}

// ---- country_metrics (HDI, CPI) -------------------------------------------

interface MetricRowOpts {
  jId: string;
  metricId: "hdi" | "cpi";
  label: string;
  source: string;
  /** Decimals for the value — HDI 3, CPI 0. */
  digits: number;
  /** When true, divisor is 1.0 (HDI). Otherwise ` / 100` is appended. */
  fractional: boolean;
  /** Decimals for the trend label. */
  trendDigits: number;
}

async function buildMetricRow(opts: MetricRowOpts): Promise<ScoreRow | null> {
  const history = await db
    .select({
      year: countryMetrics.year,
      value: countryMetrics.value,
      rank: countryMetrics.rank,
      totalRanked: countryMetrics.totalRanked,
    })
    .from(countryMetrics)
    .where(
      and(
        eq(countryMetrics.jurisdictionId, opts.jId),
        eq(countryMetrics.metricId, opts.metricId),
      ),
    )
    .orderBy(asc(countryMetrics.year));
  if (history.length === 0) return null;
  const latest = history[history.length - 1];

  let trendDelta: number | null = null;
  if (history.length > 1) {
    // Find the row 4y ago, falling back to oldest.
    const target = latest.year - 4;
    const candidate =
      [...history].reverse().find((r) => r.year <= target) ?? history[0];
    if (candidate && candidate !== latest) {
      trendDelta = Number(latest.value) - Number(candidate.value);
    }
  }

  const value = Number(latest.value);
  const formatted = opts.fractional
    ? value.toFixed(opts.digits)
    : `${value.toFixed(opts.digits)} / 100`;

  return {
    id: opts.metricId,
    label: opts.label,
    score: value,
    scoreFormatted: formatted,
    rank: latest.rank ?? null,
    totalRanked: latest.totalRanked ?? null,
    trend: trendBucket(trendDelta),
    trendDelta,
    trendFormatted:
      trendDelta != null ? fmtSigned(trendDelta, opts.trendDigits) : null,
    source: opts.source,
    asOf: String(latest.year),
  };
}

// ---- Public entry point ----------------------------------------------------

export async function getScoresForJurisdiction(
  jurisdictionIdOrSlug: string,
): Promise<ScoreRow[]> {
  const jur = await resolveJurisdiction(jurisdictionIdOrSlug);
  if (!jur) return [];

  // Run all data fetches in parallel — none depend on each other.
  const [
    civicaIndex,
    vdem,
    freedomHouse,
    hdi,
    cpi,
    rsf,
  ] = await Promise.all([
    buildCivicaIndexRow(jur.id).catch(() => null),
    buildVDemRow(jur.id).catch(() => null),
    buildFreedomHouseRow(jur.id).catch(() => null),
    buildMetricRow({
      jId: jur.id,
      metricId: "hdi",
      label: "Human Development Index",
      source: "undp_hdi",
      digits: 3,
      fractional: true,
      trendDigits: 3,
    }).catch(() => null),
    buildMetricRow({
      jId: jur.id,
      metricId: "cpi",
      label: "Corruption Perceptions Index",
      source: "transparency_intl",
      digits: 0,
      fractional: false,
      trendDigits: 1,
    }).catch(() => null),
    buildRsfRow(jur.id).catch(() => null),
  ]);

  // Display order is the same as the brief — most important first.
  const ordered: Array<ScoreRow | null> = [
    civicaIndex,
    vdem,
    freedomHouse,
    rsf,
    hdi,
    cpi,
  ];
  return ordered.filter((r): r is ScoreRow => r != null);
}
