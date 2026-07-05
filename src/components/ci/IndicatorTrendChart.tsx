"use client";

/**
 * IndicatorTrendChart — multi-series long-run trend chart for a country's
 * source indicators (V-Dem, WGI, HDI, Freedom House, CPI …).
 *
 * Audit Recommendation 4: "trend evidence is what governance scholars
 * actually cite." Each series is one source indicator's FULL published
 * history (decades of years), drawn as its own line in the dimension's
 * established color (src/lib/ci/dimension-colors.ts).
 *
 * CONSTRUCTION STYLE — follows the factbook hemicycle / EigenvalueChart:
 *   • server-renderable inline SVG, fluid `viewBox` scaling
 *   • hairline 1px ink axes, NO decorative shadows
 *   • Inter tabular-nums axis labels (never monospace)
 *   • all fills/strokes from `var(--*)` design tokens
 *   • every coordinate rounded to 2 decimals (SSR/CSR hydration rule)
 *
 * SHARED Y-AXIS — sources publish on different native scales (0–1, 0–100,
 * −2.5…+2.5). Each series is normalised to a 0–100 "higher is better" index
 * for display (respecting `isInverted`) so the lines share one axis and can
 * be read against each other. The tooltip shows the SOURCE-NATIVE value so
 * the citable number is never hidden.
 *
 * INTERACTIVITY (client) wraps a server-shaped SVG: the SSR render shows the
 * default view (all series, widest range). Series toggles are the canonical
 * `.editorial-chip` filter row; the time-range control is `SegmentedControl`.
 * Hover shows the canonical `Tooltip` primitive with year + per-series values.
 *
 * SOFT-FAIL — no series (or fewer than 2 points across all series) → renders
 * nothing (no empty frame), per the placement spec.
 */

import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/editorial/SegmentedControl";
import { Tooltip } from "@/components/editorial/Tooltip";
import {
  dimensionColorVar,
  dimensionLabel,
} from "@/lib/ci/dimension-colors";

export interface TrendSeriesInput {
  dimension: string;
  indicator: string;
  sourceId: string;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
  points: Array<{ year: number; value: number }>;
  /** Human-readable source label for the legend/tooltip (e.g. "V-Dem"). */
  sourceLabel?: string;
}

interface IndicatorTrendChartProps {
  series: TrendSeriesInput[];
  /** Accessible chart title (also the SVG <title>). */
  title?: string;
}

type RangeKey = "10y" | "25y" | "50y" | "max";

const RANGE_OPTIONS: ReadonlyArray<{ value: RangeKey; label: string }> = [
  { value: "10y", label: "10y" },
  { value: "25y", label: "25y" },
  { value: "50y", label: "50y" },
  { value: "max", label: "Max" },
];

const RANGE_YEARS: Record<RangeKey, number | null> = {
  "10y": 10,
  "25y": 25,
  "50y": 50,
  max: null,
};

// ─── viewBox geometry (authoritative coordinate space) ──────────────
const VIEW_W = 720;
const VIEW_H = 300;
const PLOT_LEFT = 44;
const PLOT_RIGHT = 20;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 40;
const PLOT_X = PLOT_LEFT;
const PLOT_Y = PLOT_TOP;
const PLOT_W = VIEW_W - PLOT_LEFT - PLOT_RIGHT;
const PLOT_H = VIEW_H - PLOT_TOP - PLOT_BOTTOM;

const Y_TICKS = [0, 25, 50, 75, 100];

/** Round to 2 decimals — SSR (Node) and browser must serialise identically. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Native value → 0–100 "higher is better" display index. */
function toDisplayIndex(
  value: number,
  min: number,
  max: number,
  isInverted: boolean
): number {
  const span = max - min || 1;
  let pct = ((value - min) / span) * 100;
  if (isInverted) pct = 100 - pct;
  return Math.max(0, Math.min(100, pct));
}

/** Format a native source value for the tooltip (compact, scale-aware). */
function formatNative(value: number, min: number, max: number): string {
  const span = Math.abs(max - min);
  if (span <= 1.5) return value.toFixed(3); // 0–1 indices
  if (span <= 6) return value.toFixed(2); // −2.5…+2.5 style
  return value.toFixed(0); // 0–100 style
}

export function IndicatorTrendChart({
  series,
  title = "Long-run governance indicators",
}: IndicatorTrendChartProps) {
  // Stable, defensive default: only series with ≥2 points are drawable.
  const drawable = useMemo(
    () => series.filter((s) => s.points.length >= 2),
    [series]
  );

  // Default state: all drawable series on, widest range that isn't "max"
  // for a legible SSR default (50y), or max when data is shorter.
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(drawable.map((s) => [s.indicator, true]))
  );
  const [range, setRange] = useState<RangeKey>("50y");
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  const activeSeries = useMemo(
    () => drawable.filter((s) => enabled[s.indicator] !== false),
    [drawable, enabled]
  );

  // Full year span across ALL drawable series (for "Max" + range clamping).
  const { minYearAll, maxYearAll } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of drawable)
      for (const p of s.points) {
        if (p.year < lo) lo = p.year;
        if (p.year > hi) hi = p.year;
      }
    return {
      minYearAll: Number.isFinite(lo) ? lo : 0,
      maxYearAll: Number.isFinite(hi) ? hi : 0,
    };
  }, [drawable]);

  // Visible window from the selected range.
  const rangeYears = RANGE_YEARS[range];
  const windowMin =
    rangeYears == null
      ? minYearAll
      : Math.max(minYearAll, maxYearAll - rangeYears + 1);
  const windowMax = maxYearAll;
  const yearSpan = windowMax - windowMin || 1;

  // All distinct years in-window, sorted — hover columns + x-ticks index this.
  const windowYears = useMemo(() => {
    const set = new Set<number>();
    for (const s of activeSeries)
      for (const p of s.points)
        if (p.year >= windowMin && p.year <= windowMax) set.add(p.year);
    return Array.from(set).sort((a, b) => a - b);
  }, [activeSeries, windowMin, windowMax]);

  // Soft-fail: nothing drawable at all → render nothing (no empty frame).
  if (drawable.length === 0) return null;

  const xAt = (year: number) =>
    r2(PLOT_X + ((year - windowMin) / yearSpan) * PLOT_W);
  const yAt = (displayIndex: number) =>
    r2(PLOT_Y + PLOT_H - (displayIndex / 100) * PLOT_H);

  // Build one path per active series over the visible window.
  const seriesPaths = activeSeries.map((s) => {
    const pts = s.points
      .filter((p) => p.year >= windowMin && p.year <= windowMax)
      .sort((a, b) => a.year - b.year);
    const d = pts
      .map((p, i) => {
        const x = xAt(p.year);
        const y = yAt(
          toDisplayIndex(p.value, s.nativeMin, s.nativeMax, s.isInverted)
        );
        return `${i === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
    return { series: s, d, pts };
  });

  // X-axis year ticks: first, last, and a few evenly-spaced interior years.
  const xTickYears = (() => {
    if (windowYears.length <= 1) return windowYears;
    const first = windowYears[0];
    const last = windowYears[windowYears.length - 1];
    const ticks = new Set<number>([first, last]);
    const interior = 3;
    for (let i = 1; i <= interior; i++) {
      const y = Math.round(first + ((last - first) * i) / (interior + 1));
      ticks.add(y);
    }
    return Array.from(ticks).sort((a, b) => a - b);
  })();

  // Tooltip content for the hovered year: per-active-series native values.
  const hoverTooltip = (year: number) => {
    const rows = activeSeries
      .map((s) => {
        const p = s.points.find((pt) => pt.year === year);
        if (!p) return null;
        return {
          label: dimensionLabel(s.dimension),
          color: dimensionColorVar(s.dimension),
          native: formatNative(p.value, s.nativeMin, s.nativeMax),
          sourceLabel: s.sourceLabel ?? s.sourceId,
        };
      })
      .filter(Boolean) as Array<{
      label: string;
      color: string;
      native: string;
      sourceLabel: string;
    }>;
    return (
      <div className="indicator-trend-tip">
        <div className="indicator-trend-tip-year">{year}</div>
        {rows.map((row) => (
          <div key={row.label} className="indicator-trend-tip-row">
            <span
              className="indicator-trend-tip-swatch"
              style={{ background: row.color }}
              aria-hidden
            />
            <span className="indicator-trend-tip-label">{row.label}</span>
            <span className="indicator-trend-tip-value">{row.native}</span>
          </div>
        ))}
      </div>
    );
  };

  const columnW = windowYears.length > 0 ? PLOT_W / windowYears.length : PLOT_W;

  return (
    <div className="indicator-trend">
      {/* Controls: series toggle chips + time-range segmented control. */}
      <div className="indicator-trend-controls">
        <div
          className="editorial-filter-row indicator-trend-legend"
          role="group"
          aria-label="Toggle indicator series"
        >
          {drawable.map((s) => {
            const on = enabled[s.indicator] !== false;
            return (
              <button
                key={s.indicator}
                type="button"
                className={`editorial-chip indicator-trend-chip${
                  on ? " is-on" : " is-off"
                }`}
                aria-pressed={on}
                onClick={() =>
                  setEnabled((prev) => ({
                    ...prev,
                    [s.indicator]: !(prev[s.indicator] !== false),
                  }))
                }
              >
                <span
                  className="indicator-trend-chip-swatch"
                  style={{ background: dimensionColorVar(s.dimension) }}
                  aria-hidden
                />
                {dimensionLabel(s.dimension)}
              </button>
            );
          })}
        </div>
        <SegmentedControl
          value={range}
          options={RANGE_OPTIONS}
          onChange={(v) => setRange(v as RangeKey)}
          ariaLabel="Time range"
          className="indicator-trend-range"
        />
      </div>

      <div className="indicator-trend-chart-wrap">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width="100%"
          role="img"
          aria-label={`${title}. Normalised 0 to 100 index, higher is better, ${windowMin} to ${windowMax}.`}
          className="indicator-trend-svg"
        >
          {/* Horizontal gridlines + y-axis tick labels (Inter tabular-nums). */}
          {Y_TICKS.map((t) => {
            const y = yAt(t);
            return (
              <g key={`y-${t}`}>
                <line
                  x1={PLOT_X}
                  x2={PLOT_X + PLOT_W}
                  y1={y}
                  y2={y}
                  stroke="var(--color-divider)"
                  strokeWidth={t === 0 ? 1 : 0.75}
                  strokeOpacity={t === 0 ? 1 : 0.6}
                />
                <text
                  x={PLOT_X - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize={11}
                  fontFamily="var(--font-body)"
                  fill="var(--color-text-50)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* Y axis (left, ink hairline). */}
          <line
            x1={PLOT_X}
            x2={PLOT_X}
            y1={PLOT_Y}
            y2={PLOT_Y + PLOT_H}
            stroke="var(--color-text-primary)"
            strokeWidth={1}
          />

          {/* Hovered-year vertical guide. */}
          {hoverYear != null ? (
            <line
              x1={xAt(hoverYear)}
              x2={xAt(hoverYear)}
              y1={PLOT_Y}
              y2={PLOT_Y + PLOT_H}
              stroke="var(--color-text-primary)"
              strokeWidth={1}
              strokeOpacity={0.35}
              strokeDasharray="3 3"
            />
          ) : null}

          {/* One line per active series, in its dimension color. */}
          {seriesPaths.map(({ series: s, d }) => (
            <path
              key={s.indicator}
              d={d}
              fill="none"
              stroke={dimensionColorVar(s.dimension)}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Emphasised marker dots for the hovered year. */}
          {hoverYear != null
            ? seriesPaths.map(({ series: s }) => {
                const p = s.points.find((pt) => pt.year === hoverYear);
                if (!p) return null;
                return (
                  <circle
                    key={`hp-${s.indicator}`}
                    cx={xAt(p.year)}
                    cy={yAt(
                      toDisplayIndex(
                        p.value,
                        s.nativeMin,
                        s.nativeMax,
                        s.isInverted
                      )
                    )}
                    r={3.5}
                    fill="var(--color-bg)"
                    stroke={dimensionColorVar(s.dimension)}
                    strokeWidth={2}
                  />
                );
              })
            : null}

          {/* X axis baseline + year tick labels. */}
          <line
            x1={PLOT_X}
            x2={PLOT_X + PLOT_W}
            y1={PLOT_Y + PLOT_H}
            y2={PLOT_Y + PLOT_H}
            stroke="var(--color-text-primary)"
            strokeWidth={1}
          />
          {xTickYears.map((year) => (
            <text
              key={`xt-${year}`}
              x={xAt(year)}
              y={PLOT_Y + PLOT_H + 18}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-body)"
              fill="var(--color-text-50)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {year}
            </text>
          ))}
        </svg>

        {/*
          HTML hover overlay — one hit column per in-window year, positioned in
          PERCENT over the fluid SVG (percent maps 1:1 to the viewBox because
          the SVG is width:100% with a fixed aspect ratio). This lives OUTSIDE
          the <svg> so each column can be wrapped in the canonical <Tooltip>
          primitive (an HTML <span> wrapper is invalid inside <svg>). Columns
          span only the plot rectangle so they don't overlap the axes/legend.
        */}
        <div className="indicator-trend-hover-layer">
          {windowYears.map((year) => {
            const leftPct = (xAt(year) / VIEW_W) * 100;
            const widthPct = (columnW / VIEW_W) * 100;
            const topPct = (PLOT_Y / VIEW_H) * 100;
            const heightPct = (PLOT_H / VIEW_H) * 100;
            return (
              <Tooltip
                key={`hz-${year}`}
                content={hoverTooltip(year)}
                className="indicator-trend-hover-col"
                triggerStyle={{
                  left: `${r2(leftPct - widthPct / 2)}%`,
                  width: `${r2(widthPct)}%`,
                  top: `${r2(topPct)}%`,
                  height: `${r2(heightPct)}%`,
                }}
              >
                <span
                  className="indicator-trend-hover-hit"
                  aria-label={`${year} values`}
                  onMouseEnter={() => setHoverYear(year)}
                  onMouseLeave={() => setHoverYear(null)}
                  onFocus={() => setHoverYear(year)}
                  onBlur={() => setHoverYear(null)}
                />
              </Tooltip>
            );
          })}
        </div>
      </div>

      <p className="indicator-trend-axis-note">
        Each series is rescaled to a 0–100 index (higher is better) so
        different source scales share one axis; hover a year for the original
        published values. {windowMin}–{windowMax}.
      </p>
    </div>
  );
}
