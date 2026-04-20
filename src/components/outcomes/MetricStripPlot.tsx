"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classifyGovernment } from "@/lib/data/government-category";
import { formatGovernmentType } from "@/lib/text/clean";

// ─── Data types ──────────────────────────────────────────────────────────────

export interface StripDot {
  countryId: string;
  countryName: string;
  govType: string;
  value: number;
  rank: number | null;
  totalRanked: number | null;
  asOfYear: number;
  isStale: boolean;
  slug?: string;
  iso2?: string;
}

export interface GovTypeBand {
  govType: string;
  count: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  min: number;
  max: number;
}

export interface MetricDef {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  unit?: string | null;
  higherIsBetter: boolean;
  valueMin?: number | null;
  valueMax?: number | null;
  sourceName?: string | null;
}

export interface MetricStripPlotProps {
  data: StripDot[];
  govTypeBands: Record<string, GovTypeBand>;
  metricDef: MetricDef;
  year: number;
  onCountryClick?: (slug: string) => void;
  highlightCountryId?: string;
  coverage?: { total: number; withData: number };
  caption?: string;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const SVG_W = 900;
const MARGIN = { top: 20, right: 20, bottom: 72, left: 200 };
const CHART_W = SVG_W - MARGIN.left - MARGIN.right; // 680
const ROW_H = 60;
const JITTER_RANGE = 20;
const DOT_R = 5;
const MEDIAN_TICK_H = 24;
const NO_DATA_LANE = "__no_data__";

// ─── Utilities ────────────────────────────────────────────────────────────────

function seededJitter(seed: string, range: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  h = Math.imul(16807, h) ^ (h >>> 11);
  return ((h >>> 0) / 0xffffffff - 0.5) * range;
}

function xScale(
  value: number,
  domainMin: number,
  domainMax: number,
): number {
  if (domainMax === domainMin) return CHART_W / 2;
  return ((value - domainMin) / (domainMax - domainMin)) * CHART_W;
}

function formatValue(value: number, unit?: string | null): string {
  const formatted =
    Math.abs(value) >= 1000
      ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}

// ─── Tooltip types ────────────────────────────────────────────────────────────

interface TooltipState {
  dotIdx: number;
  x: number; // SVG coords
  y: number;
  dot: StripDot;
}

// ─── Visually-hidden style ────────────────────────────────────────────────────

const srOnly: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MetricStripPlot({
  data,
  govTypeBands,
  metricDef,
  year,
  onCountryClick,
  highlightCountryId,
  coverage,
  caption,
}: MetricStripPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);

  // Detect prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const transition = reducedMotion ? "none" : `opacity 120ms ease, r 150ms ease`;

  // ── Separate dots with and without data ──
  const dotsWithData = useMemo(
    () => data.filter((d) => d.value != null && !isNaN(d.value)),
    [data],
  );
  const dotsNoData = useMemo(
    () => data.filter((d) => d.value == null || isNaN(d.value)),
    [data],
  );

  // ── Collect unique gov types from data ──
  const govTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const d of dotsWithData) seen.add(d.govType);
    return Array.from(seen);
  }, [dotsWithData]);

  // ── Sort gov type rows by median descending; those missing bands go last ──
  const sortedGovTypes = useMemo(() => {
    return [...govTypes].sort((a, b) => {
      const bandA = govTypeBands[a];
      const bandB = govTypeBands[b];
      if (!bandA && !bandB) return 0;
      if (!bandA) return 1;
      if (!bandB) return -1;
      return bandB.median - bandA.median;
    });
  }, [govTypes, govTypeBands]);

  // Rows: sorted gov types + "No data" lane at end if needed
  const rows = useMemo(() => {
    const r: string[] = [...sortedGovTypes];
    if (dotsNoData.length > 0) r.push(NO_DATA_LANE);
    return r;
  }, [sortedGovTypes, dotsNoData]);

  // ── X-axis domain ──
  const { domainMin, domainMax } = useMemo(() => {
    const vals = dotsWithData.map((d) => d.value);
    if (!vals.length) return { domainMin: 0, domainMax: 100 };
    const raw_min =
      metricDef.valueMin != null
        ? Math.min(metricDef.valueMin, Math.min(...vals))
        : Math.min(...vals);
    const raw_max =
      metricDef.valueMax != null
        ? Math.max(metricDef.valueMax, Math.max(...vals))
        : Math.max(...vals);
    return {
      domainMin: raw_min * 0.97,
      domainMax: raw_max * 1.03,
    };
  }, [dotsWithData, metricDef]);

  // ── Build all dots in flat array (for keyboard nav) ──
  // Row order, left-to-right within each row
  const allDots = useMemo(() => {
    const result: Array<{
      dot: StripDot | null; // null = no-data dot
      rowIdx: number;
      cx: number;
      cy: number;
      isNoData: boolean;
    }> = [];

    for (let ri = 0; ri < rows.length; ri++) {
      const govType = rows[ri];
      const rowCenterY = MARGIN.top + ri * ROW_H + ROW_H / 2;

      if (govType === NO_DATA_LANE) {
        // No-data dots placed at right edge
        const cx = CHART_W + 20; // just past right margin as a "lane"
        for (const dot of dotsNoData) {
          const jitter = seededJitter(dot.countryName, JITTER_RANGE);
          result.push({
            dot,
            rowIdx: ri,
            cx: CHART_W - 10, // stack near right edge
            cy: rowCenterY + jitter,
            isNoData: true,
          });
        }
      } else {
        const rowDots = dotsWithData
          .filter((d) => d.govType === govType)
          .sort(
            (a, b) =>
              xScale(a.value, domainMin, domainMax) -
              xScale(b.value, domainMin, domainMax),
          );
        for (const dot of rowDots) {
          const cx = xScale(dot.value, domainMin, domainMax);
          const jitter = seededJitter(dot.countryName, JITTER_RANGE);
          result.push({
            dot,
            rowIdx: ri,
            cx,
            cy: rowCenterY + jitter,
            isNoData: false,
          });
        }
      }
    }
    return result;
  }, [rows, dotsWithData, dotsNoData, domainMin, domainMax]);

  // SVG height is dynamic
  const SVG_H = rows.length * ROW_H + MARGIN.top + MARGIN.bottom;

  // ── X axis ticks ──
  const xTicks = useMemo(() => {
    const count = 5;
    const step = (domainMax - domainMin) / (count - 1);
    return Array.from({ length: count }, (_, i) => domainMin + i * step);
  }, [domainMin, domainMax]);

  // ── Caption auto-generation ──
  const autoCaption = useMemo(() => {
    if (caption) return caption;
    if (!sortedGovTypes.length) return "";
    // Top row = highest median
    const topGov = sortedGovTypes[0];
    const govCat = classifyGovernment(topGov);
    return `${govCat.label} systems cluster in the upper half of ${metricDef.name} scores across ${year} data.`;
  }, [caption, sortedGovTypes, metricDef.name, year]);

  // ── Coverage ──
  const coveragePct =
    coverage && coverage.total > 0
      ? Math.round((coverage.withData / coverage.total) * 100)
      : null;

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (allDots.length === 0) return;
      let idx = focusedIdx < 0 ? 0 : focusedIdx;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          idx = Math.min(idx + 1, allDots.length - 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          idx = Math.max(idx - 1, 0);
          break;
        case "ArrowDown": {
          e.preventDefault();
          // move to next row
          const currentRow = allDots[idx].rowIdx;
          const nextRowIdx = Math.min(currentRow + 1, rows.length - 1);
          const nextRowDots = allDots.filter((d) => d.rowIdx === nextRowIdx);
          if (nextRowDots.length) {
            const closest = nextRowDots.reduce((best, d) => {
              return Math.abs(d.cx - allDots[idx].cx) <
                Math.abs(best.cx - allDots[idx].cx)
                ? d
                : best;
            });
            idx = allDots.indexOf(closest);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const currentRow = allDots[idx].rowIdx;
          const prevRowIdx = Math.max(currentRow - 1, 0);
          const prevRowDots = allDots.filter((d) => d.rowIdx === prevRowIdx);
          if (prevRowDots.length) {
            const closest = prevRowDots.reduce((best, d) => {
              return Math.abs(d.cx - allDots[idx].cx) <
                Math.abs(best.cx - allDots[idx].cx)
                ? d
                : best;
            });
            idx = allDots.indexOf(closest);
          }
          break;
        }
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIdx >= 0 && allDots[focusedIdx]?.dot?.slug) {
            onCountryClick?.(allDots[focusedIdx].dot!.slug!);
          }
          return;
        case "Escape":
          setTooltip(null);
          setFocusedIdx(-1);
          return;
        default:
          return;
      }

      setFocusedIdx(idx);
      const d = allDots[idx];
      if (d?.dot) {
        setTooltip({
          dotIdx: idx,
          x: MARGIN.left + d.cx,
          y: MARGIN.top + d.rowIdx * ROW_H + ROW_H / 2 + (d.cy - (MARGIN.top + d.rowIdx * ROW_H + ROW_H / 2)),
          dot: d.dot,
        });
      }
    },
    [allDots, focusedIdx, rows.length, onCountryClick],
  );

  const svgId = useMemo(
    () => `strip-plot-${metricDef.id}`,
    [metricDef.id],
  );
  const headingId = `${svgId}-heading`;

  return (
    <div
      role="figure"
      aria-labelledby={headingId}
      style={{ position: "relative", width: "100%" }}
    >
      {/* Visually hidden heading for figure label */}
      <h2 id={headingId} style={srOnly}>
        Strip plot: {metricDef.name} by government type, {year}
      </h2>

      {/* Accessible hidden table */}
      <table style={srOnly} aria-label={`${metricDef.name} data table`}>
        <thead>
          <tr>
            <th scope="col">Government Type</th>
            <th scope="col">Country</th>
            <th scope="col">
              Value{metricDef.unit ? ` (${metricDef.unit})` : ""}
            </th>
            <th scope="col">Year</th>
          </tr>
        </thead>
        <tbody>
          {dotsWithData.map((d) => (
            <tr key={d.countryId}>
              <td>{formatGovernmentType(d.govType)}</td>
              <td>{d.countryName}</td>
              <td>{d.value}</td>
              <td>{d.asOfYear}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Interactive container */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setFocusedIdx(-1);
          setTooltip(null);
        }}
        style={{
          position: "relative",
          outline: "none",
          width: "100%",
        }}
        aria-label={`Interactive strip plot. Use arrow keys to navigate between countries. Press Enter to view country profile.`}
      >
        {/* SVG */}
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: "block", overflow: "visible" }}
        >
          {/* Row backgrounds and labels */}
          {rows.map((govType, ri) => {
            const isNoData = govType === NO_DATA_LANE;
            const govCat = isNoData
              ? { key: "other", label: "No data", color: "var(--color-text-40)" }
              : classifyGovernment(govType);
            const band = govTypeBands[govType];
            const rowY = MARGIN.top + ri * ROW_H;
            const rowCenterY = rowY + ROW_H / 2;

            return (
              <g key={govType}>
                {/* Alternating row background */}
                <rect
                  x={0}
                  y={rowY}
                  width={SVG_W}
                  height={ROW_H}
                  fill={
                    ri % 2 === 0
                      ? "var(--color-surface-elevated)"
                      : "transparent"
                  }
                  opacity={0.4}
                />

                {/* Row label */}
                <text
                  x={MARGIN.left - 12}
                  y={rowCenterY + 1}
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{
                    fill: govCat.color,
                    fontSize: "var(--text-12)",
                    fontFamily: "var(--font-body-sans)",
                    fontWeight: 500,
                  }}
                >
                  {isNoData ? "No data" : govCat.label}
                </text>

                {/* Country count badge */}
                {!isNoData && band && (
                  <text
                    x={MARGIN.left - 12}
                    y={rowCenterY + 14}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{
                      fill: "var(--color-text-30)",
                      fontSize: "var(--text-10)",
                      fontFamily: "var(--font-body-sans)",
                    }}
                  >
                    n={band.count}
                  </text>
                )}

                {/* IQR band */}
                {!isNoData && band && (
                  <rect
                    x={MARGIN.left + xScale(band.q1, domainMin, domainMax)}
                    y={rowCenterY - ROW_H * 0.28}
                    width={
                      xScale(band.q3, domainMin, domainMax) -
                      xScale(band.q1, domainMin, domainMax)
                    }
                    height={ROW_H * 0.56}
                    rx={2}
                    fill={`color-mix(in oklab, ${govCat.color} 18%, transparent)`}
                  />
                )}

                {/* Median tick */}
                {!isNoData && band && (
                  <line
                    x1={MARGIN.left + xScale(band.median, domainMin, domainMax)}
                    x2={MARGIN.left + xScale(band.median, domainMin, domainMax)}
                    y1={rowCenterY - MEDIAN_TICK_H / 2}
                    y2={rowCenterY + MEDIAN_TICK_H / 2}
                    stroke={`color-mix(in oklab, ${govCat.color} 60%, transparent)`}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                )}

                {/* Row divider */}
                <line
                  x1={MARGIN.left}
                  x2={SVG_W - MARGIN.right}
                  y1={rowY + ROW_H}
                  y2={rowY + ROW_H}
                  stroke="var(--color-card-border)"
                  strokeWidth={0.5}
                  opacity={0.5}
                />
              </g>
            );
          })}

          {/* X axis */}
          <g>
            {/* Axis line */}
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + CHART_W}
              y1={MARGIN.top + rows.length * ROW_H + 8}
              y2={MARGIN.top + rows.length * ROW_H + 8}
              stroke="var(--color-card-border)"
              strokeWidth={1}
            />
            {/* Tick marks and labels */}
            {xTicks.map((tick, i) => {
              const cx = MARGIN.left + xScale(tick, domainMin, domainMax);
              const axisY = MARGIN.top + rows.length * ROW_H + 8;
              return (
                <g key={i}>
                  <line
                    x1={cx}
                    x2={cx}
                    y1={axisY}
                    y2={axisY + 5}
                    stroke="var(--color-text-40)"
                    strokeWidth={1}
                  />
                  <text
                    x={cx}
                    y={axisY + 18}
                    textAnchor="middle"
                    style={{
                      fill: "var(--color-text-40)",
                      fontSize: "var(--text-10)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                    }}
                  >
                    {tick.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}
                  </text>
                </g>
              );
            })}
            {/* Unit label */}
            {metricDef.unit && (
              <text
                x={MARGIN.left + CHART_W / 2}
                y={MARGIN.top + rows.length * ROW_H + 38}
                textAnchor="middle"
                style={{
                  fill: "var(--color-text-30)",
                  fontSize: "var(--text-10)",
                  fontFamily: "var(--font-body-sans)",
                  letterSpacing: "0.08em",
                }}
              >
                {metricDef.unit.toUpperCase()}
              </text>
            )}
          </g>

          {/* Dots */}
          <g>
            {allDots.map((entry, idx) => {
              const { dot, cx, cy, isNoData } = entry;
              if (!dot) return null;

              const govCat = isNoData
                ? { color: "var(--color-text-40)" }
                : classifyGovernment(dot.govType);

              const isHighlighted =
                highlightCountryId != null &&
                dot.countryId === highlightCountryId;
              const isFocused = focusedIdx === idx;

              const dotColor = govCat.color;
              const opacity = dot.isStale ? 0.5 : 1;
              const r = isHighlighted || isFocused ? DOT_R + 2 : DOT_R;

              return (
                <circle
                  key={`${dot.countryId}-${idx}`}
                  cx={MARGIN.left + cx}
                  cy={cy}
                  r={r}
                  fill={isNoData ? "transparent" : dotColor}
                  stroke={
                    isNoData
                      ? dotColor
                      : isHighlighted || isFocused
                      ? "var(--color-text-primary)"
                      : dotColor
                  }
                  strokeWidth={isNoData ? 1.5 : isHighlighted || isFocused ? 2 : 0}
                  opacity={opacity}
                  style={{
                    cursor: dot.slug ? "pointer" : "default",
                    transition: transition,
                  }}
                  onMouseEnter={() => {
                    setTooltip({ dotIdx: idx, x: MARGIN.left + cx, y: cy, dot });
                    setFocusedIdx(idx);
                  }}
                  onMouseLeave={() => {
                    setTooltip(null);
                    setFocusedIdx(-1);
                  }}
                  onClick={() => {
                    if (dot.slug) onCountryClick?.(dot.slug);
                  }}
                  role={dot.slug ? "button" : undefined}
                  aria-label={
                    dot.slug
                      ? `${dot.countryName}: ${formatValue(dot.value, metricDef.unit)}`
                      : undefined
                  }
                  tabIndex={-1}
                />
              );
            })}
          </g>

          {/* Focus ring for keyboard-focused dot (extra ring outside) */}
          {focusedIdx >= 0 && allDots[focusedIdx] && (() => {
            const entry = allDots[focusedIdx];
            return (
              <circle
                cx={MARGIN.left + entry.cx}
                cy={entry.cy}
                r={DOT_R + 5}
                fill="transparent"
                stroke="var(--color-accent)"
                strokeWidth={2}
                strokeDasharray="3 2"
                pointerEvents="none"
                style={{ transition: reducedMotion ? "none" : "all 120ms ease" }}
              />
            );
          })()}

          {/* Source line */}
          <text
            x={MARGIN.left}
            y={SVG_H - 12}
            style={{
              fill: "var(--color-text-25)",
              fontSize: "var(--text-10)",
              fontFamily: "var(--font-body-sans)",
              letterSpacing: "0.12em",
            }}
          >
            SOURCE:{" "}
            {(metricDef.sourceName ?? metricDef.name).toUpperCase()} ·
            CIVICA CLASSIFICATION · METHODOLOGY ↗
          </text>

          {/* Coverage badge */}
          {coverage && coveragePct != null && (
            <text
              x={SVG_W - MARGIN.right}
              y={SVG_H - 12}
              textAnchor="end"
              style={{
                fill: "var(--color-text-25)",
                fontSize: "var(--text-10)",
                fontFamily: "var(--font-body-sans)",
                letterSpacing: "0.1em",
              }}
            >
              COVERAGE: {coverage.withData} OF {coverage.total} COUNTRIES (
              {coveragePct}%)
            </text>
          )}
        </svg>

        {/* Tooltip (positioned as absolute div over container) */}
        {tooltip && tooltip.dot && (() => {
          const { x, y, dot } = tooltip;
          const pctX = (x / SVG_W) * 100;
          const pctY = (y / SVG_H) * 100;
          const flipLeft = x > SVG_W * 0.7;

          return (
            <div
              role="tooltip"
              style={{
                position: "absolute",
                left: flipLeft ? undefined : `${pctX}%`,
                right: flipLeft ? `${100 - pctX}%` : undefined,
                top: `${pctY}%`,
                transform: "translateY(-50%)",
                pointerEvents: "none",
                zIndex: 10,
                background: "var(--color-tooltip-bg)",
                border: "1px solid var(--color-tooltip-border)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px",
                minWidth: 160,
                maxWidth: 220,
                boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-body-sans)",
                  fontWeight: 600,
                  fontSize: "var(--text-13)",
                  color: "var(--color-text-primary)",
                  marginBottom: 2,
                }}
              >
                {dot.countryName}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
                  fontSize: "var(--text-14)",
                  color: "var(--color-accent)",
                  marginBottom: 4,
                }}
              >
                {formatValue(dot.value, metricDef.unit)}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-40)",
                  fontFamily: "var(--font-body-sans)",
                }}
              >
                <span>{dot.asOfYear}</span>
                {dot.rank != null && dot.totalRanked != null && (
                  <span>
                    Rank {dot.rank}/{dot.totalRanked}
                  </span>
                )}
                {dot.isStale && (
                  <span style={{ color: "var(--color-text-30)" }}>
                    (stale data)
                  </span>
                )}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: "var(--text-10)",
                  color: "var(--color-text-30)",
                  fontFamily: "var(--font-body-sans)",
                }}
              >
                {formatGovernmentType(dot.govType)}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Caption */}
      {autoCaption && (
        <p
          style={{
            marginTop: 8,
            fontSize: "var(--text-12)",
            color: "var(--color-text-40)",
            fontFamily: "var(--font-body-sans)",
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          {autoCaption}
        </p>
      )}
    </div>
  );
}

export default MetricStripPlot;
