"use client";

import { useState, useMemo } from "react";

export type ChartSeries = {
  name: string;
  colorVar: string;
  data: { quarter: string; score: number }[];
};

// "2024-Q3" → comparable integer (years * 4 + quarter index)
function qToNum(q: string): number {
  const m = q.match(/^(\d{4})-Q(\d)$/);
  return m ? parseInt(m[1]) * 4 + (parseInt(m[2]) - 1) : 0;
}

function qToYear(q: string): number {
  const m = q.match(/^(\d{4})/);
  return m ? parseInt(m[1]) : 0;
}

// Linear score → SVG Y (viewBox height=340, score 0→340, 100→0)
function scoreToY(score: number): number {
  return (100 - Math.max(0, Math.min(100, score))) * 3.4;
}

const SVG_W = 1120;
const SVG_H = 340;
const PAD_L = 36;

type Range = "1Y" | "5Y" | "10Y" | "Max";
type ScoreType = "CI" | "Pulse" | "Both";

const RANGES: Range[] = ["1Y", "5Y", "10Y", "Max"];

function btnStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono)",
    fontWeight: 500,
    fontSize: 11,
    padding: "6px 12px",
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "var(--color-bg)" : "var(--color-text-40)",
    border: "none",
    cursor: active ? "default" : "pointer",
  };
}

export function OverlayChart({ series }: { series: ChartSeries[] }) {
  const [scoreType, setScoreType] = useState<ScoreType>("CI");
  const [range, setRange] = useState<Range>("10Y");

  const now = new Date();
  const currentNum = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3);

  const filtered = useMemo(() => {
    const yearsBack = range === "1Y" ? 1 : range === "5Y" ? 5 : range === "10Y" ? 10 : 9999;
    const cutoff = currentNum - yearsBack * 4;
    return series.map((s) => ({
      ...s,
      data: s.data.filter((d) => range === "Max" || qToNum(d.quarter) >= cutoff),
    }));
  }, [series, range, currentNum]);

  // Build sorted quarter axis across all series
  const allQuarters = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach((s) => s.data.forEach((d) => set.add(d.quarter)));
    return [...set].sort((a, b) => qToNum(a) - qToNum(b));
  }, [filtered]);

  const hasData = allQuarters.length >= 2;

  // X position (time-proportional)
  const chartW = SVG_W - PAD_L - 12;
  const minNum = hasData ? qToNum(allQuarters[0]) : 0;
  const maxNum = hasData ? qToNum(allQuarters[allQuarters.length - 1]) : 1;
  const numRange = maxNum - minNum || 1;

  function xAt(q: string): number {
    return PAD_L + ((qToNum(q) - minNum) / numRange) * chartW;
  }

  // Year x-axis labels: first occurrence of each year in the data
  const yearPositions = useMemo(() => {
    const seen = new Map<number, number>();
    allQuarters.forEach((q) => {
      const y = qToYear(q);
      if (!seen.has(y)) seen.set(y, xAt(q));
    });
    return [...seen.entries()].map(([year, x]) => ({ year, x }));
  }, [allQuarters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build chart lines for each series
  const lines = useMemo(() => {
    return filtered.map((s) => {
      const pts = s.data
        .filter((d) => allQuarters.includes(d.quarter))
        .sort((a, b) => qToNum(a.quarter) - qToNum(b.quarter))
        .map((d) => ({ x: xAt(d.quarter), y: scoreToY(d.score) }));

      if (pts.length < 2) return null;
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      return { d, color: s.colorVar, name: s.name };
    }).filter(Boolean);
  }, [filtered, allQuarters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chart title
  const names = series.map((s) => s.name).filter(Boolean);
  const chartTitle = names.length >= 2
    ? `${names.slice(0, -1).join(", ")} vs. ${names[names.length - 1]} · ${scoreType === "Both" ? "CI and Pulse" : scoreType === "Pulse" ? "Pulse" : "CI"}`
    : "Select countries to compare";

  const yearRange = allQuarters.length >= 2
    ? `${qToYear(allQuarters[0])} → ${qToYear(allQuarters[allQuarters.length - 1])}`
    : "";

  return (
    <div
      style={{
        border: "1px solid var(--color-card-border)",
        borderRadius: 4,
        background: "var(--color-grid-cell)",
        padding: "32px 36px",
        marginBottom: 40,
      }}
      aria-label="Timeline overlay"
    >
      {/* Chart header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          {yearRange && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 11,
                color: "var(--color-text-30)",
                letterSpacing: "0.08em",
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              TIMELINE OVERLAY · {yearRange}
            </div>
          )}
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 26,
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            {chartTitle}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Score type toggle */}
          <div
            role="group"
            aria-label="Score type"
            style={{
              display: "inline-flex",
              border: "1px solid var(--color-card-border)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {(["CI", "Pulse", "Both"] as ScoreType[]).map((t) => (
              <button
                key={t}
                onClick={() => t === "CI" && setScoreType(t)}
                disabled={t !== "CI"}
                style={{
                  ...btnStyle(scoreType === t),
                  opacity: t !== "CI" ? 0.4 : 1,
                  cursor: t !== "CI" ? "not-allowed" : scoreType === t ? "default" : "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Range tabs */}
          <div
            role="group"
            aria-label="Range"
            style={{
              display: "inline-flex",
              border: "1px solid var(--color-card-border)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={btnStyle(range === r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ position: "relative", height: 340 }}>
        {hasData ? (
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%" }}
            aria-label="CI score timeline"
          >
            {/* Tier bands */}
            <rect x={0} y={0}   width={SVG_W} height={34} fill="var(--tier-exceptional)" opacity="0.06" />
            <rect x={0} y={34}  width={SVG_W} height={51} fill="var(--tier-strong)"      opacity="0.05" />
            <rect x={0} y={85}  width={SVG_W} height={85} fill="var(--tier-mixed)"       opacity="0.06" />
            <rect x={0} y={170} width={SVG_W} height={85} fill="var(--tier-weak)"        opacity="0.05" />
            <rect x={0} y={255} width={SVG_W} height={85} fill="var(--tier-failed)"      opacity="0.06" />

            {/* Horizontal grid lines at tier boundaries */}
            <g stroke="var(--color-divider)" strokeWidth="1" opacity="0.6">
              <line x1={0} y1={34}  x2={SVG_W} y2={34} />
              <line x1={0} y1={85}  x2={SVG_W} y2={85} />
              <line x1={0} y1={170} x2={SVG_W} y2={170} />
              <line x1={0} y1={255} x2={SVG_W} y2={255} />
            </g>

            {/* Vertical dashed year lines */}
            {yearPositions.slice(1).map(({ year, x }) => (
              <line
                key={year}
                x1={x} y1={0} x2={x} y2={SVG_H}
                stroke="var(--color-divider)"
                strokeWidth="1"
                strokeDasharray="2 4"
                opacity="0.5"
              />
            ))}

            {/* Country lines */}
            {lines.map((line, i) =>
              line ? (
                <path
                  key={i}
                  d={line.d}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null
            )}

            {/* X-axis year labels */}
            <g
              fontFamily="ui-monospace, SF Mono, Menlo, monospace"
              fontSize="10"
              fill="var(--color-text-30)"
              fontWeight="500"
            >
              {yearPositions.map(({ year, x }) => (
                <text key={year} x={x} y={SVG_H - 5}>
                  {year}
                </text>
              ))}
            </g>

            {/* Y-axis labels */}
            <g
              fontFamily="ui-monospace, SF Mono, Menlo, monospace"
              fontSize="10"
              fill="var(--color-text-30)"
              fontWeight="500"
            >
              <text x={4} y={12}>100</text>
              <text x={4} y={44}>90</text>
              <text x={4} y={95}>75</text>
              <text x={4} y={180}>50</text>
              <text x={4} y={265}>25</text>
            </g>
          </svg>
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 13,
              color: "var(--color-text-30)",
            }}
          >
            Not enough history data to display chart.
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 11,
          color: "var(--color-text-40)",
          marginTop: 18,
        }}
      >
        {series.map((s) => (
          <span key={s.name} style={{ display: "inline-flex", alignItems: "center" }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 3,
                background: s.colorVar,
                marginRight: 6,
                verticalAlign: "middle",
                borderRadius: 1,
              }}
            />
            {s.name}
            {s.data.length === 0 && (
              <span style={{ color: "var(--color-text-20)", marginLeft: 4 }}>— no data</span>
            )}
          </span>
        ))}
        <span style={{ color: "var(--color-text-20)" }}>
          Tier bands shown in background
        </span>
      </div>
    </div>
  );
}
