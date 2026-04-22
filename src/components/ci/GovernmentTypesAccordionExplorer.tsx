"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type GovernmentTypeLeaf = {
  id: string;
  label: string;
  colorVar: string;
  fallback: string;
  dots: Array<{ slug: string; name: string; score: number }>;
  countryCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  trajectory: Array<{ quarter: string; avgScore: number }>;
};

export type GovernmentTypeFamily = GovernmentTypeLeaf & {
  subtypes: GovernmentTypeLeaf[];
};

type Props = {
  families: GovernmentTypeFamily[];
  totalCountries: number;
  lensTitle: string;
  lensSummary: string;
  axisLabel: string;
  plotHelper: string;
  footerLabel: string;
  lensTabs: Array<{
    id: "structural" | "regime";
    label: string;
    href: string;
    active: boolean;
  }>;
};

type VisibleRow = {
  kind: "family" | "subtype";
  id: string;
  familyId: string;
  label: string;
  colorVar: string;
  fallback: string;
  dots: Array<{ slug: string; name: string; score: number }>;
  countryCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  trajectory: Array<{ quarter: string; avgScore: number }>;
  expandable: boolean;
  expanded?: boolean;
  depth: 0 | 1;
};

const SUBTYPE_SHADES: Record<string, string[]> = {
  "var(--gov-parl, #4E8BD4)": ["#6b9ddb", "#4d7cb5", "#87b5ee"],
  "var(--gov-pres, #D4764E)": ["#d97757", "#b85a3e", "#e58f72"],
  "var(--gov-semi, #9B6DC6)": ["#a878c7", "#815595", "#c59de1"],
  "var(--gov-mon, #C4A44E)": ["#c9a84e", "#8f763a", "#d8bc6d"],
  "var(--gov-abs, #B8893A)": ["#b8893a", "#8a6528", "#cda058"],
  "var(--gov-one, #D4764E)": ["#c7614d", "#954535", "#e38a77"],
  "var(--gov-mil, #C65A37)": ["#c65a37", "#964126", "#dc7f5d"],
  "var(--gov-theo, #5CAA6E)": ["#5caa6e", "#417a4e", "#7dc18d"],
};

function toneFor(row: VisibleRow, familyIndex: number, subtypeIndex: number): string {
  if (row.kind === "family") return row.colorVar;
  const shades = SUBTYPE_SHADES[row.colorVar] ?? [row.fallback];
  return shades[(familyIndex + subtypeIndex) % shades.length] ?? row.fallback;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${Math.abs(delta).toFixed(1)}`;
}

function trajectoryDelta(points: Array<{ quarter: string; avgScore: number }>): number | null {
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const earlier = points[Math.max(0, points.length - 40)];
  return latest.avgScore - earlier.avgScore;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{
        transition: "transform 180ms ease",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        opacity: 0.65,
      }}
    >
      <path
        d="M3 2 L7 5 L3 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronMark({
  open,
  x,
  y,
}: {
  open: boolean;
  x: number;
  y: number;
}) {
  return (
    <path
      d="M0 0 L4 3 L0 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      transform={`translate(${x} ${y}) rotate(${open ? 90 : 0} 2 3)`}
    />
  );
}

function Trajectory({
  points,
  color,
}: {
  points: Array<{ quarter: string; avgScore: number }>;
  color: string;
}) {
  if (points.length === 0) return <div className="gov-traj-empty">—</div>;

  const W = 120;
  const H = 36;
  const values = points.map((point) => point.avgScore);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  if (points.length === 1) {
    return (
      <svg className="gov-trajectory" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <circle cx={W / 2} cy={H / 2} r={2} fill={color} />
      </svg>
    );
  }

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * W;
      const y = H - ((point.avgScore - min) / range) * (H - 6) - 3;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="gov-trajectory"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trajectory over ${points.length} quarters`}
    >
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function BeeSwarm({
  rows,
  toggleRow,
}: {
  rows: VisibleRow[];
  toggleRow: (familyId: string) => void;
}) {
  const W = 1180;
  const LEFT = 292;
  const RIGHT = 42;
  const TOP = 28;
  const H = Math.max(360, TOP + rows.length * 42 + 60);
  const BOTTOM_AXIS_Y = H - 34;
  const plotW = W - LEFT - RIGHT;
  const rowH = (BOTTOM_AXIS_Y - TOP) / Math.max(1, rows.length);
  const DOT_R = 4.5;

  function xFor(score: number) {
    return LEFT + (Math.max(0, Math.min(100, score)) / 100) * plotW;
  }

  function layoutRow(
    scores: number[],
    rowY: number,
  ): { cx: number; cy: number }[] {
    const sorted = [...scores]
      .map((score, index) => ({ score, index }))
      .sort((a, b) => a.score - b.score);
    const placed: { cx: number; cy: number; index: number }[] = [];

    for (const { score, index } of sorted) {
      const cx = xFor(score);
      let cy = rowY;
      const maxOffset = rowH / 2 - DOT_R - 2;
      for (let step = 0; step < 40; step++) {
        const collides = placed.some(
          (point) => Math.hypot(point.cx - cx, point.cy - cy) < DOT_R * 2 + 0.5,
        );
        if (!collides) break;
        const direction = step % 2 === 0 ? 1 : -1;
        const magnitude = Math.ceil((step + 1) / 2) * (DOT_R * 0.9);
        cy = rowY + direction * Math.min(magnitude, maxOffset);
      }
      placed.push({ cx, cy, index });
    }

    return placed
      .sort((a, b) => a.index - b.index)
      .map(({ cx, cy }) => ({ cx, cy }));
  }

  return (
    <svg
      className="dist-plot"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Distribution of Civica Index scores by government type"
    >
      <g stroke="var(--color-divider)" strokeWidth="1">
        {[0, 20, 40, 60, 80, 100].map((tick) => (
          <line
            key={tick}
            x1={xFor(tick)}
            y1={TOP - 8}
            x2={xFor(tick)}
            y2={BOTTOM_AXIS_Y}
          />
        ))}
      </g>
      <g
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fontWeight={500}
        fill="var(--color-text-30)"
      >
        {[0, 20, 40, 60, 80, 100].map((tick) => (
          <text key={tick} x={xFor(tick) - 5} y={BOTTOM_AXIS_Y + 18}>
            {tick}
          </text>
        ))}
      </g>

      {rows.map((row, index) => {
        const rowY = TOP + rowH * (index + 0.5);
        const points = layoutRow(
          row.dots.map((dot) => dot.score),
          rowY,
        );
        const avgX = xFor(row.avgScore);
        const color = toneFor(row, index, index);
        const labelX = row.depth === 0 ? LEFT - 14 : LEFT - 14;
        const buttonX = 14 + row.depth * 18;
        const textX = row.expandable ? buttonX + 18 : buttonX + 8;
        const isInteractive = row.kind === "family" && row.expandable;

        return (
          <g key={row.id}>
            {isInteractive ? (
              <g
                role="button"
                tabIndex={0}
                aria-expanded={Boolean(row.expanded)}
                aria-label={`${row.expanded ? "Collapse" : "Expand"} ${row.label}`}
                onClick={() => toggleRow(row.familyId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleRow(row.familyId);
                  }
                }}
                style={{ cursor: "pointer", color: "var(--color-text-35)" }}
              >
                <rect
                  x={0}
                  y={rowY - rowH / 2 + 6}
                  width={LEFT - 12}
                  height={Math.max(28, rowH - 12)}
                  fill="transparent"
                />
                <ChevronMark open={Boolean(row.expanded)} x={buttonX} y={rowY - 3} />
              </g>
            ) : null}
            <text
              x={labelX}
              y={rowY + 4}
              textAnchor="end"
              fontFamily="'Fraunces', serif"
              fontSize={row.kind === "family" ? "14" : "13"}
              fill="var(--color-text-primary)"
            >
              {row.label}
            </text>
            <line
              x1={LEFT}
              y1={rowY}
              x2={W - RIGHT}
              y2={rowY}
              stroke="var(--color-divider)"
              strokeDasharray="2 4"
            />
            <rect
              x={avgX - 1.5}
              y={rowY - 9}
              width={3}
              height={18}
              fill="var(--color-text-primary)"
            />
            <g fill={color}>
              {points.map((point, dotIndex) => {
                const dot = row.dots[dotIndex];
                return (
                  <circle
                    key={`${dot.slug}-${dotIndex}`}
                    cx={point.cx}
                    cy={point.cy}
                    r={DOT_R}
                    fillOpacity={row.kind === "subtype" ? 0.88 : 0.92}
                  >
                    <title>{`${dot.name}: ${dot.score.toFixed(1)}`}</title>
                  </circle>
                );
              })}
            </g>
            {row.kind === "subtype" ? (
              <g aria-hidden="true">
                <line
                  x1={textX - 22}
                  y1={rowY}
                  x2={textX - 12}
                  y2={rowY}
                  stroke={color}
                  strokeWidth="1.2"
                  opacity="0.55"
                />
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function GovernmentTypesAccordionExplorer({
  families,
  totalCountries,
  lensTitle,
  lensSummary,
  axisLabel,
  plotHelper,
  footerLabel,
  lensTabs,
}: Props) {
  const expandableIds = useMemo(
    () => families.filter((family) => family.subtypes.length > 0).map((family) => family.id),
    [families],
  );

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const visibleRows = useMemo<VisibleRow[]>(() => {
    const rows: VisibleRow[] = [];
    families.forEach((family) => {
      rows.push({
        kind: "family",
        id: family.id,
        familyId: family.id,
        label: family.label,
        colorVar: family.colorVar,
        fallback: family.fallback,
        dots: family.dots,
        countryCount: family.countryCount,
        avgScore: family.avgScore,
        minScore: family.minScore,
        maxScore: family.maxScore,
        trajectory: family.trajectory,
        expandable: family.subtypes.length > 0,
        expanded: Boolean(expanded[family.id]),
        depth: 0,
      });
      if (expanded[family.id]) {
        family.subtypes.forEach((subtype) => {
          rows.push({
            kind: "subtype",
            id: subtype.id,
            familyId: family.id,
            label: subtype.label,
            colorVar: subtype.colorVar,
            fallback: subtype.fallback,
            dots: subtype.dots,
            countryCount: subtype.countryCount,
            avgScore: subtype.avgScore,
            minScore: subtype.minScore,
            maxScore: subtype.maxScore,
            trajectory: subtype.trajectory,
            expandable: false,
            depth: 1,
          });
        });
      }
    });
    return rows;
  }, [expanded, families]);

  const highestAvg = useMemo(
    () => [...families].sort((a, b) => b.avgScore - a.avgScore)[0],
    [families],
  );
  const widestSpread = useMemo(
    () =>
      [...families].sort(
        (a, b) => (b.maxScore - b.minScore) - (a.maxScore - a.minScore),
      )[0],
    [families],
  );
  const groupsWithDelta = useMemo(
    () =>
      families
        .map((family) => ({
          family,
          delta: trajectoryDelta(family.trajectory),
        }))
        .filter(
          (entry): entry is { family: GovernmentTypeFamily; delta: number } =>
            entry.delta !== null,
        ),
    [families],
  );
  const mostImproved = useMemo(
    () => [...groupsWithDelta].sort((a, b) => b.delta - a.delta)[0],
    [groupsWithDelta],
  );
  const mostDeclined = useMemo(
    () => [...groupsWithDelta].sort((a, b) => a.delta - b.delta)[0],
    [groupsWithDelta],
  );

  function toggleRow(familyId: string) {
    setExpanded((current) => ({
      ...current,
      [familyId]: !current[familyId],
    }));
  }

  function expandAll() {
    setExpanded(
      Object.fromEntries(expandableIds.map((id) => [id, true])),
    );
  }

  function collapseAll() {
    setExpanded({});
  }

  const allExpanded =
    expandableIds.length > 0 && expandableIds.every((id) => expanded[id]);

  return (
    <div className="civica-govtypes">
      <section className="page-hero">
        <div className="breadcrumb">
          <Link href="/civica-index">← Index</Link> / Government types
        </div>
        <div className="page-eyebrow">Empirical observation · not a ranking</div>
        <h1 className="page-title">
          How does government type actually correlate with governance outcomes?
        </h1>
        <p className="page-lede">
          The Civica Index does not bake bonuses or penalties into government
          types. Instead, we publish what the data says: average CI,
          distribution spread, and long-run trajectory per category — so you can
          see whether any government type <em>systematically</em> produces
          better outcomes, or whether individual countries matter more than
          their system.
        </p>

        <div className="lens-switcher" role="tablist" aria-label="Government taxonomy lens">
          {lensTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={tab.active}
              className={`lens-switch ${tab.active ? "is-active" : ""}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="accordion-controls">
          <div className="accordion-controls-copy">
            <div className="accordion-controls-label">{lensTitle}</div>
            <p className="accordion-controls-note">
              {lensSummary}
            </p>
          </div>
        </div>

        <div className="taxonomy-explainer">
          <div className="taxonomy-explainer-label">How to read this page</div>
          <p>
            <strong>Structural form</strong> answers what the system is:
            parliamentary republic, constitutional monarchy, directorial
            republic, and related forms.
          </p>
          <p>
            <strong>Regime type</strong> answers how executive-legislative
            accountability works in the Bjornskov-Rode / CGV tradition:
            parliamentary, semi-presidential, or presidential democracy, plus
            civilian, military, or royal dictatorship.
          </p>
          <p>
            These lenses can disagree for valid academic reasons. Switzerland,
            for example, can appear as a <em>presidential democracy</em> in the
            accountability sense while remaining a <em>federal directorial
            republic</em> structurally.
          </p>
        </div>
      </section>

      {families.length > 0 ? (
        <>
          <section className="callout-strip">
            <Callout
              label="Highest avg. CI"
              value={highestAvg ? highestAvg.avgScore.toFixed(1) : "—"}
              color={highestAvg?.colorVar}
              hint={highestAvg ? `${highestAvg.label} (n=${highestAvg.countryCount})` : ""}
            />
            <Callout
              label="Widest spread"
              value={
                widestSpread
                  ? `${Math.round(widestSpread.maxScore - widestSpread.minScore)} pt`
                  : "—"
              }
              color={widestSpread?.colorVar}
              hint={
                widestSpread
                  ? `${widestSpread.label} (${Math.round(widestSpread.minScore)} → ${Math.round(widestSpread.maxScore)})`
                  : ""
              }
            />
            <Callout
              label="Most improved (10y)"
              value={mostImproved ? formatDelta(mostImproved.delta) : "—"}
              color={mostImproved?.family.colorVar}
              hint={mostImproved ? mostImproved.family.label : "Insufficient history"}
            />
            <Callout
              label="Most declined (10y)"
              value={mostDeclined ? formatDelta(mostDeclined.delta) : "—"}
              color="var(--tier-failed)"
              hint={mostDeclined ? mostDeclined.family.label : "Insufficient history"}
            />
          </section>

          <section>
            <div className="section-eyebrow">
              The full distribution · every country placed by CI
            </div>
            <h2 className="section-title">Each dot is a country.</h2>
            {expandableIds.length > 0 ? (
              <div className="section-actions">
                <button
                  type="button"
                  className="accordion-action"
                  onClick={expandAll}
                  disabled={allExpanded}
                >
                  Expand all families
                </button>
                <button
                  type="button"
                  className="accordion-action"
                  onClick={collapseAll}
                  disabled={!allExpanded && Object.keys(expanded).length === 0}
                >
                  Collapse all
                </button>
              </div>
            ) : null}

            <div className="dist-plot-wrap">
              <div className="dist-plot-head">
                <div className="dist-plot-axis-label">
                  {axisLabel}
                </div>
                <div className="dist-plot-side">
                  <div className="dist-plot-helper">
                    {plotHelper}
                  </div>
                </div>
              </div>

              <BeeSwarm rows={visibleRows} toggleRow={toggleRow} />
            </div>
          </section>

          <section>
            <div className="section-eyebrow">
              By the numbers · families first, subtypes on demand
            </div>
            <h2 className="section-title">Average, spread, and trajectory.</h2>

            <div className="gov-list">
              <div className="gov-list-header">
                <div />
                <div>Government family or subtype</div>
                <div className="right">Countries</div>
                <div>Spread (min–max) · avg</div>
                <div className="right">Avg CI</div>
                <div>Trajectory</div>
              </div>

              {visibleRows.map((row, index) => {
                const color = toneFor(row, index, index);
                return (
                  <div
                    key={row.id}
                    className={`gov-list-row ${row.kind === "subtype" ? "is-subtype" : ""}`}
                  >
                    <div
                      className="gov-stripe"
                      style={{ background: color }}
                    />
                    <div className="gov-name-block">
                      <div className="gov-name-row">
                        {row.kind === "family" && row.expandable ? (
                          <button
                            type="button"
                            className="gov-row-toggle"
                            onClick={() => toggleRow(row.familyId)}
                            aria-expanded={Boolean(row.expanded)}
                            aria-controls={`gov-row-${row.familyId}`}
                          >
                            <Chevron open={Boolean(row.expanded)} />
                          </button>
                        ) : (
                          <span className="gov-row-toggle-placeholder" aria-hidden="true" />
                        )}
                        {row.kind === "subtype" ? (
                          <span className="gov-indent" aria-hidden="true" />
                        ) : null}
                        <div className="gov-name">{row.label}</div>
                      </div>
                      <div className="gov-examples" id={`gov-row-${row.familyId}`}>
                        <span
                          style={{
                            display: "block",
                            marginLeft: row.kind === "subtype" ? 48 : 28,
                          }}
                        >
                          {row.dots
                            .slice(0, 6)
                            .map((dot) => dot.name)
                            .join(" · ")}
                          {row.dots.length > 6 ? ` · ${row.dots.length - 6} more` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="gov-count right">
                      {row.countryCount}
                      <small>countries</small>
                    </div>
                    <div>
                      <div className="gov-spread-bar">
                        <div
                          className="gov-spread-fill"
                          style={{
                            left: `${row.minScore}%`,
                            width: `${Math.max(2, row.maxScore - row.minScore)}%`,
                            background: `color-mix(in oklab, ${row.fallback} 30%, transparent)`,
                          }}
                        />
                        <div
                          className="gov-spread-avg"
                          style={{ left: `${row.avgScore}%` }}
                        />
                      </div>
                      <div className="gov-spread-label">
                        <span>{Math.round(row.minScore)}</span>
                        <span>avg {row.avgScore.toFixed(1)}</span>
                        <span>{Math.round(row.maxScore)}</span>
                      </div>
                    </div>
                    <div className="gov-avg right" style={{ color }}>
                      {row.avgScore.toFixed(1)}
                    </div>
                    <div>
                      <Trajectory points={row.trajectory} color={color} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="detail-grid">
            <div className="panel">
              <div className="section-eyebrow no-margin">What the data says</div>
              <h3>
                {highestAvg
                  ? `${highestAvg.label} tends to cluster at the top.`
                  : "Clustering patterns vary by system."}{" "}
                {widestSpread
                  ? `${widestSpread.label} shows the widest spread.`
                  : ""}
              </h3>
              <p className="panel-lede">
                {highestAvg && widestSpread
                  ? `The strongest family visible today averages ${highestAvg.avgScore.toFixed(
                      1,
                    )} and bottoms out at ${Math.round(highestAvg.minScore)}. ${widestSpread.label} spans ${Math.round(
                      widestSpread.maxScore - widestSpread.minScore,
                    )} points, from ${Math.round(widestSpread.minScore)} to ${Math.round(
                      widestSpread.maxScore,
                    )}. Expanding rows helps show whether that signal comes from one subtype or from the whole family.`
                  : "System type alone does not explain governance performance. Country-specific trajectories still matter."}
              </p>
            </div>
            <div className="panel">
              <div className="section-eyebrow no-margin">What the data does not say</div>
              <h3>
                &ldquo;{highestAvg ? highestAvg.label : "Some systems"} are better.&rdquo;
                The data only shows where systems cluster today.
              </h3>
              <p className="panel-lede">
                The Civica Index does not argue that any single government type
                is best. Correlation is shown; causation is left to researchers
                and historians who can control for confounders that the Index
                cannot.
              </p>
              <p className="panel-note">
                Read this chart with caution.{" "}
                <Link href="/civica-index/methodology#limitations">
                  Methodology §6 →
                </Link>
              </p>
            </div>
          </section>

          <footer className="gov-footer">
            <div>
              Civica Index · n={totalCountries} · {families.length} {footerLabel}
            </div>
            <div>
              <Link href="/civica-index">← Back to Civica Index</Link>
            </div>
          </footer>
        </>
      ) : (
        <div className="empty-state">
          <p>No Civica Index data available yet.</p>
          <p className="empty-hint">
            Run <code>npm run ingest:ci</code> and <code>npm run calculate:ci</code> to populate scores.
          </p>
          <Link href="/civica-index">← Back to Index</Link>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

function Callout({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color?: string;
}) {
  return (
    <div className="callout">
      <div className="callout-label">{label}</div>
      <div className="callout-value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="callout-hint">{hint}</div>
    </div>
  );
}

const CSS = `
  .civica-govtypes {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 40px;
    color: var(--color-text-primary);
  }
  .civica-govtypes .page-hero { padding: 72px 0 32px; }
  .civica-govtypes .breadcrumb {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: 0.03em;
    color: var(--color-text-30);
    margin-bottom: 18px;
  }
  .civica-govtypes .breadcrumb a {
    color: var(--color-text-30);
    text-decoration: none;
  }
  .civica-govtypes .page-eyebrow {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-30);
    margin-bottom: 14px;
  }
  .civica-govtypes .page-title {
    font-family: var(--font-serif);
    font-size: 56px;
    font-weight: 400;
    letter-spacing: -0.04em;
    line-height: 1.02;
    margin-bottom: 16px;
    max-width: 900px;
  }
  .civica-govtypes .page-lede {
    font-size: 17px;
    color: var(--color-text-60);
    max-width: 720px;
    line-height: 1.6;
  }

  .civica-govtypes .lens-switcher {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    margin-top: 28px;
    padding-bottom: 2px;
    border-bottom: 1px solid var(--color-divider);
  }
  .civica-govtypes .lens-switch {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-40);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 8px 0 10px;
    margin-bottom: -3px;
    text-decoration: none;
  }
  .civica-govtypes .lens-switch.is-active {
    color: var(--color-text-primary);
    border-bottom-color: var(--color-accent);
  }

  .civica-govtypes .accordion-controls {
    margin-top: 28px;
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .civica-govtypes .accordion-controls-copy {
    max-width: 720px;
  }
  .civica-govtypes .accordion-controls-label {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-30);
    margin-bottom: 8px;
  }
  .civica-govtypes .accordion-controls-note {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--color-text-50);
  }
  .civica-govtypes .accordion-actions {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .civica-govtypes .accordion-action {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-40);
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .civica-govtypes .accordion-action:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .civica-govtypes .taxonomy-explainer {
    margin-top: 22px;
    max-width: 820px;
    border: 1px solid var(--color-card-border);
    border-radius: 4px;
    background: var(--color-surface-elevated);
    padding: 16px 18px;
  }
  .civica-govtypes .taxonomy-explainer-label {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-30);
    margin-bottom: 10px;
  }
  .civica-govtypes .taxonomy-explainer p {
    margin: 0 0 10px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--color-text-60);
  }
  .civica-govtypes .taxonomy-explainer p:last-child {
    margin-bottom: 0;
  }

  .civica-govtypes .callout-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: var(--color-divider);
    border: 1px solid var(--color-card-border);
    border-radius: 4px;
    overflow: hidden;
    margin: 40px 0 48px;
  }
  .civica-govtypes .callout {
    background: var(--color-surface-elevated);
    padding: 24px 26px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .civica-govtypes .callout-label {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-30);
  }
  .civica-govtypes .callout-value {
    font-family: var(--font-serif);
    font-size: 34px;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .civica-govtypes .callout-hint {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11px;
    color: var(--color-text-40);
    margin-top: 4px;
  }

  .civica-govtypes .section-eyebrow {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-30);
    margin-bottom: 14px;
  }
  .civica-govtypes .section-eyebrow.no-margin { margin-bottom: 6px; }
  .civica-govtypes .section-title {
    font-family: var(--font-serif);
    font-size: 32px;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin-bottom: 28px;
  }
  .civica-govtypes .section-actions {
    display: flex;
    gap: 14px;
    justify-content: flex-end;
    flex-wrap: wrap;
    margin: -14px 0 18px;
  }

  .civica-govtypes .dist-plot-wrap {
    border: 1px solid var(--color-card-border);
    border-radius: 4px;
    background: var(--color-surface-elevated);
    padding: 32px 40px 28px;
    margin-bottom: 48px;
  }
  .civica-govtypes .dist-plot-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .civica-govtypes .dist-plot-axis-label {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11px;
    color: var(--color-text-30);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .civica-govtypes .dist-plot-side {
    display: flex;
    align-items: flex-end;
    flex-direction: column;
    gap: 0;
  }
  .civica-govtypes .dist-plot-helper {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--color-text-30);
    text-transform: uppercase;
  }
  .civica-govtypes .dist-plot {
    width: 100%;
    height: auto;
  }
  .civica-govtypes .gov-list {
    border: 1px solid var(--color-card-border);
    border-radius: 4px;
    background: var(--color-divider);
    overflow: hidden;
    display: grid;
    gap: 1px;
    margin-bottom: 48px;
  }
  .civica-govtypes .gov-list-header,
  .civica-govtypes .gov-list-row {
    background: var(--color-surface-elevated);
    padding: 20px 28px;
    display: grid;
    grid-template-columns: 6px minmax(0, 1.8fr) 120px minmax(0, 1.5fr) 120px 100px;
    gap: 18px;
    align-items: center;
  }
  .civica-govtypes .gov-list-header {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-30);
    padding: 14px 28px;
  }
  .civica-govtypes .gov-list-header .right,
  .civica-govtypes .gov-list-row .right { text-align: right; }
  .civica-govtypes .gov-stripe {
    width: 6px;
    height: 56px;
    border-radius: 1px;
  }
  .civica-govtypes .gov-name-block {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .civica-govtypes .gov-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .civica-govtypes .gov-row-toggle {
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    padding: 0;
    background: transparent;
    color: var(--color-text-35);
    cursor: pointer;
    flex-shrink: 0;
  }
  .civica-govtypes .gov-row-toggle-placeholder {
    width: 20px;
    height: 20px;
    display: inline-block;
    flex-shrink: 0;
  }
  .civica-govtypes .gov-indent {
    width: 12px;
    height: 1px;
    display: inline-block;
    background: var(--color-divider);
    flex-shrink: 0;
  }
  .civica-govtypes .gov-list-row.is-subtype .gov-name {
    font-size: 18px;
  }
  .civica-govtypes .gov-name {
    font-family: var(--font-serif);
    font-size: 20px;
    line-height: 1.1;
    min-width: 0;
  }
  .civica-govtypes .gov-examples {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11px;
    color: var(--color-text-30);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .civica-govtypes .gov-count {
    font-family: var(--font-serif);
    font-size: 20px;
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1;
  }
  .civica-govtypes .gov-count small {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11px;
    color: var(--color-text-25);
    display: block;
    margin-top: 2px;
  }
  .civica-govtypes .gov-spread-bar {
    position: relative;
    height: 20px;
    background: var(--color-divider);
    border-radius: 2px;
    overflow: visible;
  }
  .civica-govtypes .gov-spread-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 1px;
  }
  .civica-govtypes .gov-spread-avg {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    background: var(--color-text-primary);
  }
  .civica-govtypes .gov-spread-label {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 10px;
    color: var(--color-text-30);
    margin-top: 6px;
    display: flex;
    justify-content: space-between;
  }
  .civica-govtypes .gov-avg {
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1;
  }
  .civica-govtypes .gov-trajectory {
    width: 100%;
    height: 36px;
  }
  .civica-govtypes .gov-traj-empty {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-25);
  }

  .civica-govtypes .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-bottom: 60px;
  }
  .civica-govtypes .panel {
    border: 1px solid var(--color-card-border);
    border-radius: 4px;
    background: var(--color-surface-elevated);
    padding: 28px 32px;
  }
  .civica-govtypes .panel h3 {
    font-family: var(--font-serif);
    font-size: 24px;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin-bottom: 8px;
  }
  .civica-govtypes .panel-lede {
    color: var(--color-text-60);
    margin-bottom: 18px;
    font-size: 14px;
  }
  .civica-govtypes .panel-note {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 12px;
    color: var(--color-text-40);
    letter-spacing: 0.04em;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-divider);
  }
  .civica-govtypes .panel-note a {
    color: var(--color-accent);
    text-decoration: none;
  }

  .civica-govtypes .gov-footer {
    margin: 40px 0 60px;
    padding: 32px 0 0;
    border-top: 1px solid var(--color-divider);
    display: flex;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--color-text-30);
  }
  .civica-govtypes .gov-footer a {
    color: var(--color-accent);
    text-decoration: none;
  }

  .civica-govtypes .empty-state {
    padding: 80px 0;
    text-align: center;
    color: var(--color-text-40);
  }
  .civica-govtypes .empty-state p {
    margin-bottom: 8px;
    font-family: var(--font-serif);
    font-size: 18px;
  }
  .civica-govtypes .empty-state .empty-hint {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-25);
  }
  .civica-govtypes .empty-state a {
    color: var(--color-accent);
    text-decoration: none;
    font-family: var(--font-mono);
    font-size: 12px;
    margin-top: 24px;
    display: inline-block;
  }

  @media (max-width: 900px) {
    .civica-govtypes { padding: 0 20px; }
    .civica-govtypes .page-title { font-size: 40px; }
    .civica-govtypes .callout-strip { grid-template-columns: 1fr 1fr; }
    .civica-govtypes .section-actions { justify-content: flex-start; }
    .civica-govtypes .gov-list-header,
    .civica-govtypes .gov-list-row {
      grid-template-columns: 6px 1fr 80px;
      gap: 14px;
      padding: 16px 20px;
    }
    .civica-govtypes .gov-list-row > :nth-child(4),
    .civica-govtypes .gov-list-row > :nth-child(6),
    .civica-govtypes .gov-list-header > :nth-child(4),
    .civica-govtypes .gov-list-header > :nth-child(6) { display: none; }
    .civica-govtypes .detail-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 640px) {
    .civica-govtypes .callout-strip { grid-template-columns: 1fr; }
    .civica-govtypes .dist-plot-wrap { padding: 24px 18px 20px; }
    .civica-govtypes .accordion-controls { align-items: stretch; }
  }
`;
