"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

export interface GovTypeRow {
  governmentType: string;
  countryCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  medianScore: number;
  q1: number;
  q3: number;
}

type SortKey = "avgScore" | "countryCount";

// ── Tier ─────────────────────────────────────────────────────────────────────

function tierInfo(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: "Elite",    color: "#fff",    bg: "oklch(55% 0.18 245)" };
  if (score >= 75) return { label: "Strong",   color: "#fff",    bg: "oklch(52% 0.18 145)" };
  if (score >= 50) return { label: "Moderate", color: "#1a1208", bg: "oklch(82% 0.17 85)"  };
  if (score >= 25) return { label: "Weak",     color: "#fff",    bg: "oklch(60% 0.17 45)"  };
  return              { label: "Critical",  color: "#fff",    bg: "oklch(52% 0.20 25)"  };
}

// ── SVG Box Plot ──────────────────────────────────────────────────────────────

const SVG_W = 920;
const ML = 188; // left margin (labels)
const MR = 72;  // right margin (country count)
const MT = 28;  // top margin (axis labels)
const MB = 44;  // bottom margin (x-axis ticks)
const CHART_W = SVG_W - ML - MR;
const ROW_H = 54;
const BOX_H = 20;
const WHISKER_CAP = 6;

function xPos(score: number): number {
  return ML + (score / 100) * CHART_W;
}

interface BoxPlotProps {
  rows: GovTypeRow[];
}

function BoxPlot({ rows }: BoxPlotProps) {
  const svgH = MT + rows.length * ROW_H + MB;

  const xTicks = [0, 25, 50, 75, 100];

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${svgH}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-label="CI score distribution by government type"
    >
      {/* X-axis gridlines */}
      {xTicks.map((t) => (
        <line
          key={t}
          x1={xPos(t)} y1={MT}
          x2={xPos(t)} y2={MT + rows.length * ROW_H}
          stroke="var(--color-card-border)"
          strokeWidth={1}
          strokeDasharray={t === 0 ? undefined : "3 3"}
        />
      ))}

      {/* Tier zone backgrounds */}
      {[
        { from: 75, to: 100, color: "oklch(52% 0.18 145 / 0.06)" },
        { from: 50, to: 75,  color: "oklch(82% 0.17 85  / 0.06)" },
        { from: 25, to: 50,  color: "oklch(60% 0.17 45  / 0.05)" },
        { from:  0, to: 25,  color: "oklch(52% 0.20 25  / 0.05)" },
      ].map(({ from, to, color }) => (
        <rect
          key={from}
          x={xPos(from)} y={MT}
          width={xPos(to) - xPos(from)}
          height={rows.length * ROW_H}
          fill={color}
        />
      ))}

      {/* X-axis tick labels */}
      {xTicks.map((t) => (
        <text
          key={t}
          x={xPos(t)} y={svgH - MB + 16}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-text-30)"
          fontFamily="var(--font-mono)"
          fontWeight={500}
        >
          {t}
        </text>
      ))}

      {/* Tier zone labels along x-axis */}
      {[
        { from: 0,  to: 25,  label: "Critical" },
        { from: 25, to: 50,  label: "Weak"     },
        { from: 50, to: 75,  label: "Moderate" },
        { from: 75, to: 100, label: "Strong"   },
      ].map(({ from, to, label }) => (
        <text
          key={label}
          x={(xPos(from) + xPos(to)) / 2}
          y={svgH - 4}
          textAnchor="middle"
          fontSize={9}
          fill="var(--color-text-20)"
          fontFamily="var(--font-mono)"
          fontWeight={500}
          style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          {label}
        </text>
      ))}

      {/* Rows */}
      {rows.map((row, i) => {
        const cy = MT + i * ROW_H + ROW_H / 2;
        const boxTop = cy - BOX_H / 2;
        const tier = tierInfo(row.avgScore);
        const boxColor = tier.bg;
        const x_min = xPos(row.minScore);
        const x_q1  = xPos(row.q1);
        const x_med = xPos(row.medianScore);
        const x_avg = xPos(row.avgScore);
        const x_q3  = xPos(row.q3);
        const x_max = xPos(row.maxScore);

        return (
          <g key={row.governmentType}>
            {/* Row hover background */}
            <rect
              x={0} y={MT + i * ROW_H}
              width={SVG_W} height={ROW_H}
              fill="transparent"
              className="gt-row-hover"
            />

            {/* Whisker line: min → max */}
            <line
              x1={x_min} y1={cy}
              x2={x_max} y2={cy}
              stroke={boxColor}
              strokeWidth={1.5}
              opacity={0.5}
            />

            {/* Whisker caps */}
            <line x1={x_min} y1={cy - WHISKER_CAP/2} x2={x_min} y2={cy + WHISKER_CAP/2}
              stroke={boxColor} strokeWidth={1.5} opacity={0.6} />
            <line x1={x_max} y1={cy - WHISKER_CAP/2} x2={x_max} y2={cy + WHISKER_CAP/2}
              stroke={boxColor} strokeWidth={1.5} opacity={0.6} />

            {/* IQR box */}
            <rect
              x={x_q1} y={boxTop}
              width={Math.max(x_q3 - x_q1, 2)} height={BOX_H}
              fill={boxColor}
              opacity={0.22}
              rx={2}
            />
            <rect
              x={x_q1} y={boxTop}
              width={Math.max(x_q3 - x_q1, 2)} height={BOX_H}
              fill="none"
              stroke={boxColor}
              strokeWidth={1.5}
              rx={2}
            />

            {/* Median line */}
            <line
              x1={x_med} y1={boxTop - 2}
              x2={x_med} y2={boxTop + BOX_H + 2}
              stroke={boxColor}
              strokeWidth={2.5}
            />

            {/* Average diamond */}
            <polygon
              points={`${x_avg},${cy - 6} ${x_avg + 5},${cy} ${x_avg},${cy + 6} ${x_avg - 5},${cy}`}
              fill="var(--color-accent)"
            />

            {/* Gov type label */}
            <text
              x={ML - 10} y={cy + 4}
              textAnchor="end"
              fontSize={12}
              fill="var(--color-text-60)"
              fontFamily="var(--font-mono)"
              fontWeight={500}
            >
              {row.governmentType}
            </text>

            {/* Country count on right */}
            <text
              x={SVG_W - 4} y={cy + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--color-text-30)"
              fontFamily="var(--font-mono)"
              fontWeight={500}
            >
              {row.countryCount}
            </text>

            {/* Avg score label */}
            <text
              x={x_avg + 8} y={cy - 10}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-accent)"
              fontFamily="var(--font-mono)"
              fontWeight={500}
            >
              {row.avgScore.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Column header for country count */}
      <text
        x={SVG_W - 4} y={MT - 8}
        textAnchor="end"
        fontSize={10}
        fill="var(--color-text-25)"
        fontFamily="var(--font-mono)"
        fontWeight={500}
        style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
      >
        n
      </text>
    </svg>
  );
}

// ── Stats Table ───────────────────────────────────────────────────────────────

function StatsTable({ rows }: { rows: GovTypeRow[] }) {
  const cols: Array<{ key: keyof GovTypeRow; label: string }> = [
    { key: "governmentType", label: "Type"     },
    { key: "countryCount",   label: "Countries" },
    { key: "avgScore",       label: "Avg"       },
    { key: "medianScore",    label: "Median"    },
    { key: "minScore",       label: "Min"       },
    { key: "maxScore",       label: "Max"       },
    { key: "q1",             label: "Q1"        },
    { key: "q3",             label: "Q3"        },
  ];

  return (
    <div style={{ overflowX: "auto", marginTop: 40 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
        }}
      >
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.key === "governmentType" ? "left" : "right",
                  padding: "6px 12px",
                  borderBottom: "1px solid var(--color-card-border)",
                  color: "var(--color-text-30)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontSize: "var(--text-11)",
                  whiteSpace: "nowrap",
                  fontWeight: "var(--font-weight-mono)",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tier = tierInfo(row.avgScore);
            return (
              <tr key={row.governmentType} className="gt-table-row">
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--color-card-border)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: tier.bg,
                        flexShrink: 0,
                      }}
                    />
                    <Link
                      href={`/civica-index?governmentType=${encodeURIComponent(row.governmentType)}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                      className="gt-table-link"
                    >
                      {row.governmentType}
                    </Link>
                  </div>
                </td>
                {(["countryCount", "avgScore", "medianScore", "minScore", "maxScore", "q1", "q3"] as const).map(
                  (k) => (
                    <td
                      key={k}
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--color-card-border)",
                        color: k === "avgScore" ? tier.bg : "var(--color-text-60)",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        fontWeight: k === "avgScore" ? 600 : undefined,
                      }}
                    >
                      {k === "countryCount"
                        ? row[k]
                        : (row[k] as number).toFixed(1)}
                    </td>
                  )
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Explorer ─────────────────────────────────────────────────────────────

export function GovernmentTypesExplorer({ data }: { data: GovTypeRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("avgScore");

  const sorted = useMemo(
    () =>
      [...data].sort((a, b) =>
        sortKey === "avgScore"
          ? b.avgScore - a.avgScore
          : b.countryCount - a.countryCount
      ),
    [data, sortKey]
  );

  return (
    <div>
      {/* Sort controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 28,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-11)",
            color: "var(--color-text-30)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginRight: 4,
          }}
        >
          Sort
        </span>
        {(
          [
            { key: "avgScore",     label: "Avg Score"     },
            { key: "countryCount", label: "Country Count" },
          ] as { key: SortKey; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              border: sortKey === key ? "none" : "1px solid var(--color-card-border)",
              background: sortKey === key ? "var(--color-accent)" : "var(--color-card-bg)",
              color: sortKey === key ? "var(--color-bg)" : "var(--color-text-40)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-11)",
          color: "var(--color-text-30)",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 16,
              height: 4,
              borderRadius: 2,
              background: "var(--color-text-25)",
              opacity: 0.6,
            }}
          />
          Min – Max
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              display: "inline-block",
              width: 16,
              height: 10,
              borderRadius: 2,
              border: "1.5px solid var(--color-text-40)",
              opacity: 0.8,
            }}
          />
          IQR (Q1–Q3)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: 14,
              background: "var(--color-text-40)",
              borderRadius: 1,
            }}
          />
          Median
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={12} height={12} viewBox="0 0 12 12" style={{ display: "block" }}>
            <polygon points="6,0 11,6 6,12 1,6" fill="var(--color-accent)" />
          </svg>
          Average
        </span>
      </div>

      {/* Box plot */}
      {sorted.length > 0 ? (
        <div
          style={{
            background: "var(--color-card-bg)",
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-sm)",
            padding: "16px 8px 8px",
            overflowX: "auto",
          }}
        >
          <BoxPlot rows={sorted} />
        </div>
      ) : (
        <div
          style={{
            padding: "80px 0",
            textAlign: "center",
            color: "var(--color-text-40)",
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-18)",
          }}
        >
          No data available.
        </div>
      )}

      {/* Stats table */}
      {sorted.length > 0 && <StatsTable rows={sorted} />}

      {/* Footer links */}
      <div
        style={{
          marginTop: 40,
          paddingTop: 20,
          borderTop: "1px solid var(--color-card-border)",
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-11)",
          color: "var(--color-text-25)",
        }}
      >
        <Link href="/civica-index" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
          ← All Countries
        </Link>
        <Link href="/civica-index/compare" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
          Compare Countries
        </Link>
        <Link href="/civica-index/methodology" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
          Methodology
        </Link>
      </div>
    </div>
  );
}
