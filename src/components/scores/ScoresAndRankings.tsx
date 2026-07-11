/**
 * P1.1 — `<ScoresAndRankings>`
 *
 * Server-rendered table of governance / democracy / freedom scores for
 * a country. Used by:
 *   - factbook reader page (/factbook/[slug])  — section "Scores & Rankings"
 *   - atlas country page    (/atlas/[slug]/scores)
 *
 * Renders a compact, dense table; one row per available score. Returns
 * `null` when no rows are available so the parent can hide the section.
 *
 * Design contract:
 *   - All styling via role tokens (see DESIGN.md). No hex/rgb/oklch.
 *   - Provenance via `<SourceDot>` per row.
 *   - Trend arrows + tier-colored text via `--color-success` /
 *     `--color-danger` / `--color-text-40`.
 *   - Source-native publisher measures use one neutral row treatment.
 *
 * The atlas tab passes pre-fetched rows in (it lives behind a client
 * boundary) — pass `rows` directly. The factbook section calls without
 * `rows` and the component fetches.
 */

import "@/components/scores/scores.css";
import { SourceDot } from "@/components/SourceDot";
import {
  getScoresForJurisdiction,
  type ScoreRow,
} from "@/lib/db/queries-scores";

export interface ScoresAndRankingsProps {
  /** UUID jurisdictionId or slug. */
  jurisdictionId: string;
  /** Country name — used in empty-state copy. */
  countryName: string;
  /** Visual variant. Atlas pane is narrow (~640px); factbook section is
   *  wider (~960px). The component reads the same in both. */
  variant?: "atlas" | "factbook";
  /** Pre-fetched rows. When present the component skips the DB call.
   *  This is how the atlas client tab integrates without crossing the
   *  server/client boundary. */
  rows?: ScoreRow[];
}

const ARROW_BY_TREND: Record<NonNullable<ScoreRow["trend"]>, string> = {
  up: "↗", // ↗
  down: "↘", // ↘
  flat: "→", // →
};

export async function ScoresAndRankings({
  jurisdictionId,
  countryName,
  variant = "factbook",
  rows: prefetched,
}: ScoresAndRankingsProps) {
  const rows = prefetched ?? (await getScoresForJurisdiction(jurisdictionId));
  if (rows.length === 0) return null;

  return (
    <ScoresAndRankingsView
      rows={rows}
      countryName={countryName}
      variant={variant}
    />
  );
}

/**
 * Pure presentational wrapper. Server- and client-renderable; the atlas
 * client tab uses this directly with pre-fetched rows so it avoids the
 * server/client boundary crossing problem.
 */
export function ScoresAndRankingsView({
  rows,
  countryName,
  variant = "factbook",
}: {
  rows: ScoreRow[];
  countryName: string;
  variant?: "atlas" | "factbook";
}) {
  if (rows.length === 0) {
    return (
      <div
        className={`scores-rankings scores-rankings--${variant}`}
        aria-label={`Scores and rankings for ${countryName}`}
      >
        <div className="scores-rankings__empty">No score data available</div>
      </div>
    );
  }

  return (
    <div
      className={`scores-rankings scores-rankings--${variant}`}
      aria-label={`Scores and rankings for ${countryName}`}
    >
      <div
        className="scores-rankings__head"
        role="row"
        aria-label="Score columns"
      >
        <span>Score</span>
        <span>Value</span>
        <span>Global rank</span>
        <span>Trend</span>
        <span>As of</span>
      </div>

      {rows.map((row) => {
        const arrow = row.trend ? ARROW_BY_TREND[row.trend] : null;
        const trendClass = row.trend
          ? `scores-rankings__trend scores-rankings__trend--${row.trend}`
          : "scores-rankings__trend";
        const rankText =
          row.rank != null && row.totalRanked != null
            ? `${row.rank} / ${row.totalRanked}`
            : row.rank != null
              ? `${row.rank}`
              : "—";

        return (
          <div
            key={row.id}
            className="scores-rankings__row"
            role="row"
          >
            <span className="scores-rankings__label">{row.label}</span>

            <span className="scores-rankings__value">
              <span>{row.scoreFormatted}</span>
              {row.asOf ? (
                <span className="scores-rankings__as-of-inline">
                  as of {row.asOf}
                </span>
              ) : null}
            </span>

            <span className="scores-rankings__rank">{rankText}</span>

            <span className={trendClass}>
              {arrow ? <span aria-hidden>{arrow}</span> : null}
              {row.trendFormatted ? (
                <span>{row.trendFormatted}</span>
              ) : row.trend === "flat" ? (
                <span aria-hidden>—</span>
              ) : null}
            </span>

            <span className="scores-rankings__as-of">
              <span className="scores-rankings__as-of-date">
                {row.asOf ?? "—"}
              </span>
              <SourceDot source={row.source} retrievedAt={row.asOf} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
