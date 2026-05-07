/**
 * Inline SVG eigenvalue / scree chart for the PCA appendix.
 *
 *   Authored for: /civica-index/methodology/pca-appendix §4
 *   Replaces:     public/methodology/phase-5-3-scree-plot.png
 *   Data source:  analysis/phase-5-3/eigenvalues.csv (real PCA output)
 *
 * Print-inspired editorial aesthetic per DESIGN.md: flat fills, hard
 * 1px ink axis rules, no decorative shadows. Bars use design-token
 * colors only — `var(--color-accent)` for the dominant PC (the only
 * one above the Kaiser threshold), `var(--color-text-30)` for
 * subordinate components. Cumulative-variance overlay uses the
 * accent color as a thin path. Kaiser threshold (eigenvalue = 1.0) is
 * a dashed horizontal rule.
 *
 * Server-rendered. No client JS. Dark mode is automatic via the
 * design-token variables flipping in the layout's `data-theme`
 * attribute.
 *
 * Accessibility: outer SVG declares `role="img"` + `aria-labelledby`
 * pointing at an inline `<title>` and `<desc>`, mirroring the
 * factbook hemicycle convention.
 */

export interface EigenvalueDatum {
  /** Component label, e.g. "PC1". */
  pc: string;
  /** Raw eigenvalue. */
  eigenvalue: number;
  /** Cumulative variance share (0–1). */
  cumulative: number;
}

export interface EigenvalueChartProps {
  /** Data points in component order (PC1 first). */
  data: ReadonlyArray<EigenvalueDatum>;
  /** Kaiser threshold for retain-vs-discard. Standard practice = 1.0. */
  kaiserThreshold?: number;
  /** Optional accessible title. Default describes the figure. */
  title?: string;
}

// ─── Geometry constants ────────────────────────────────────────────
//
// All coordinates are in viewBox units. The SVG scales fluidly in CSS;
// the `viewBox` is the authoritative coordinate space.

const VIEW_W = 720;
const VIEW_H = 360;

// Inner plot rectangle (inside the axis labels + caption gutter).
const PLOT_LEFT = 64;
const PLOT_RIGHT = 64;
const PLOT_TOP = 32;
const PLOT_BOTTOM = 56;

const PLOT_X = PLOT_LEFT;
const PLOT_Y = PLOT_TOP;
const PLOT_W = VIEW_W - PLOT_LEFT - PLOT_RIGHT;
const PLOT_H = VIEW_H - PLOT_TOP - PLOT_BOTTOM;

// The y-axis spans 0 → Y_MAX in eigenvalue units. We pick 4.0 because
// the largest plausible eigenvalue (3.71 on the live data) sits a
// little below it and we want a clean gridline at 4.
const Y_MAX = 4;

// Cumulative-variance overlay reuses the same plot area but with its
// own scale (0 → 1 = 0% → 100%).

const TICKS_LEFT = [0, 1, 2, 3, 4];
const TICKS_RIGHT = [0, 25, 50, 75, 100];

export function EigenvalueChart({
  data,
  kaiserThreshold = 1.0,
  title = "Eigenvalue scree plot — PC1 dominates with eigenvalue 3.71; PC2–PC4 below the Kaiser threshold.",
}: EigenvalueChartProps) {
  if (data.length === 0) {
    return null;
  }

  const titleId = "eigenvalue-chart-title";
  const descId = "eigenvalue-chart-desc";

  // Bar geometry: each PC gets a bar centered in its column.
  const colW = PLOT_W / data.length;
  const barW = Math.min(72, colW * 0.55);

  // Eigenvalue → y coordinate (flipped: 0 at bottom, Y_MAX at top).
  const yEigen = (v: number) =>
    PLOT_Y + PLOT_H - (Math.max(0, Math.min(Y_MAX, v)) / Y_MAX) * PLOT_H;

  // Cumulative variance (0..1) → y coordinate. 100% sits at the top
  // of the plot rectangle.
  const yCumul = (v: number) =>
    PLOT_Y + PLOT_H - Math.max(0, Math.min(1, v)) * PLOT_H;

  const cumulPath = data
    .map((d, i) => {
      const cx = PLOT_X + colW * (i + 0.5);
      const cy = yCumul(d.cumulative);
      return `${i === 0 ? "M" : "L"}${cx.toFixed(2)} ${cy.toFixed(2)}`;
    })
    .join(" ");

  return (
    <figure className="meth-figure">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        className="meth-eigenvalue-chart"
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>
          Bar chart of eigenvalues per principal component, with a
          cumulative-variance line overlaid and a dashed reference rule
          at the Kaiser threshold of 1.0.
          {data
            .map(
              (d) =>
                ` ${d.pc}: eigenvalue ${d.eigenvalue.toFixed(3)}, cumulative ${(
                  d.cumulative * 100
                ).toFixed(1)} percent.`,
            )
            .join("")}
        </desc>

        {/* ─── Plot frame (subtle paper-tone fill) ──────────────── */}
        <rect
          x={PLOT_X}
          y={PLOT_Y}
          width={PLOT_W}
          height={PLOT_H}
          fill="var(--color-grid-cell)"
        />

        {/* ─── Y-axis gridlines (hairline rules at integer ticks) ──── */}
        {TICKS_LEFT.map((t) => {
          const y = yEigen(t);
          return (
            <line
              key={`gl-${t}`}
              x1={PLOT_X}
              x2={PLOT_X + PLOT_W}
              y1={y}
              y2={y}
              stroke="var(--color-divider)"
              strokeWidth={0.75}
            />
          );
        })}

        {/* ─── Kaiser threshold (dashed reference) ──────────────── */}
        <line
          x1={PLOT_X}
          x2={PLOT_X + PLOT_W}
          y1={yEigen(kaiserThreshold)}
          y2={yEigen(kaiserThreshold)}
          stroke="var(--color-text-primary)"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.55}
        />
        <text
          x={PLOT_X + PLOT_W - 6}
          y={yEigen(kaiserThreshold) - 6}
          textAnchor="end"
          fontSize={11}
          fontFamily="var(--font-mono)"
          letterSpacing="0.06em"
          fill="var(--color-text-50)"
        >
          KAISER λ = {kaiserThreshold.toFixed(1)}
        </text>

        {/* ─── Bars (one per principal component) ───────────────── */}
        {data.map((d, i) => {
          const cx = PLOT_X + colW * (i + 0.5);
          const x = cx - barW / 2;
          const y = yEigen(d.eigenvalue);
          const h = PLOT_Y + PLOT_H - y;
          const isDominant = d.eigenvalue >= kaiserThreshold;
          return (
            <g key={d.pc}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={
                  isDominant
                    ? "var(--color-accent)"
                    : "var(--color-text-30)"
                }
                stroke="var(--color-text-primary)"
                strokeWidth={1}
              />
              {/* Eigenvalue label above each bar */}
              <text
                x={cx}
                y={y - 8}
                textAnchor="middle"
                fontSize={12}
                fontFamily="var(--font-mono)"
                fill="var(--color-text-primary)"
                fontWeight={500}
              >
                {d.eigenvalue.toFixed(3)}
              </text>
            </g>
          );
        })}

        {/* ─── Cumulative-variance line (overlay) ──────────────── */}
        <path
          d={cumulPath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          strokeOpacity={0.8}
        />
        {data.map((d, i) => {
          const cx = PLOT_X + colW * (i + 0.5);
          const cy = yCumul(d.cumulative);
          return (
            <g key={`cum-${d.pc}`}>
              <circle
                cx={cx}
                cy={cy}
                r={3.5}
                fill="var(--color-bg)"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
              />
              <text
                x={cx + 8}
                y={cy + 4}
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--color-accent)"
              >
                {(d.cumulative * 100).toFixed(1)}%
              </text>
            </g>
          );
        })}

        {/* ─── Y axis (left, eigenvalue scale) ──────────────────── */}
        <line
          x1={PLOT_X}
          x2={PLOT_X}
          y1={PLOT_Y}
          y2={PLOT_Y + PLOT_H}
          stroke="var(--color-text-primary)"
          strokeWidth={1}
        />
        {TICKS_LEFT.map((t) => {
          const y = yEigen(t);
          return (
            <g key={`tl-${t}`}>
              <line
                x1={PLOT_X - 4}
                x2={PLOT_X}
                y1={y}
                y2={y}
                stroke="var(--color-text-primary)"
                strokeWidth={1}
              />
              <text
                x={PLOT_X - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--color-text-50)"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* ─── Y axis (right, cumulative percent scale) ─────────── */}
        <line
          x1={PLOT_X + PLOT_W}
          x2={PLOT_X + PLOT_W}
          y1={PLOT_Y}
          y2={PLOT_Y + PLOT_H}
          stroke="var(--color-text-primary)"
          strokeWidth={1}
        />
        {TICKS_RIGHT.map((pct) => {
          const y = yCumul(pct / 100);
          return (
            <g key={`tr-${pct}`}>
              <line
                x1={PLOT_X + PLOT_W}
                x2={PLOT_X + PLOT_W + 4}
                y1={y}
                y2={y}
                stroke="var(--color-text-primary)"
                strokeWidth={1}
              />
              <text
                x={PLOT_X + PLOT_W + 8}
                y={y + 4}
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--color-text-50)"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* ─── X axis baseline + tick labels ────────────────────── */}
        <line
          x1={PLOT_X}
          x2={PLOT_X + PLOT_W}
          y1={PLOT_Y + PLOT_H}
          y2={PLOT_Y + PLOT_H}
          stroke="var(--color-text-primary)"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const cx = PLOT_X + colW * (i + 0.5);
          return (
            <text
              key={`xl-${d.pc}`}
              x={cx}
              y={PLOT_Y + PLOT_H + 22}
              textAnchor="middle"
              fontSize={12}
              fontFamily="var(--font-mono)"
              fill="var(--color-text-primary)"
              fontWeight={500}
              letterSpacing="0.05em"
            >
              {d.pc}
            </text>
          );
        })}

        {/* ─── Axis-edge labels ─────────────────────────────────── */}
        <text
          x={PLOT_X - 44}
          y={PLOT_Y + PLOT_H / 2}
          textAnchor="middle"
          fontSize={10}
          fontFamily="var(--font-mono)"
          fill="var(--color-text-30)"
          letterSpacing="0.12em"
          transform={`rotate(-90 ${PLOT_X - 44} ${PLOT_Y + PLOT_H / 2})`}
        >
          EIGENVALUE λ
        </text>
        <text
          x={PLOT_X + PLOT_W + 44}
          y={PLOT_Y + PLOT_H / 2}
          textAnchor="middle"
          fontSize={10}
          fontFamily="var(--font-mono)"
          fill="var(--color-text-30)"
          letterSpacing="0.12em"
          transform={`rotate(-90 ${PLOT_X + PLOT_W + 44} ${
            PLOT_Y + PLOT_H / 2
          })`}
        >
          CUMULATIVE %
        </text>
      </svg>
      <figcaption className="meth-figure-caption">
        Eigenvalue scree. Bars show the eigenvalue per principal
        component (left axis); the line overlay is the cumulative
        share of total variance (right axis). The dashed rule is the
        Kaiser threshold (λ = {kaiserThreshold.toFixed(1)}); only PC1
        sits above it. Source:{" "}
        <code>analysis/phase-5-3/eigenvalues.csv</code>.
      </figcaption>
    </figure>
  );
}
