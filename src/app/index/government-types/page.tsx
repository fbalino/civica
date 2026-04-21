import type { Metadata } from "next";
import Link from "next/link";
import {
  getCIByGovernmentType,
  getCIByGovernmentTypeDots,
  getGovTypeTrajectory,
} from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Governance Outcomes by Government Type — Civica Index",
  description:
    "Empirical observation of Civica Index distribution, spread, and trajectory across parliamentary, presidential, semi-presidential, monarchical, one-party, junta, and theocratic systems.",
  alternates: { canonical: "https://civicaatlas.org/index/government-types" },
  openGraph: {
    title: "Governance Outcomes by Government Type | Civica Index",
    description:
      "How government type actually correlates with governance outcomes — averages, spread, and 10-year trajectory for every system.",
    url: "https://civicaatlas.org/index/government-types",
  },
};

// -- Classification ----------------------------------------------------------

type GovKey =
  | "parliamentary"
  | "presidential"
  | "semi_presidential"
  | "const_monarchy"
  | "abs_monarchy"
  | "one_party"
  | "military_junta"
  | "theocracy"
  | "other";

const GOV_META: Record<
  GovKey,
  { label: string; colorVar: string; fallback: string }
> = {
  parliamentary:     { label: "Parliamentary democracies", colorVar: "var(--gov-parl, #4E8BD4)", fallback: "#4E8BD4" },
  presidential:      { label: "Presidential republics",    colorVar: "var(--gov-pres, #D4764E)", fallback: "#D4764E" },
  semi_presidential: { label: "Semi-presidential",          colorVar: "var(--gov-semi, #9B6DC6)", fallback: "#9B6DC6" },
  const_monarchy:    { label: "Constitutional monarchies",  colorVar: "var(--gov-mon,  #C4A44E)", fallback: "#C4A44E" },
  abs_monarchy:      { label: "Absolute monarchies",        colorVar: "var(--gov-abs,  #C4A44E)", fallback: "#C4A44E" },
  one_party:         { label: "One-party states",           colorVar: "var(--gov-one,  #D4764E)", fallback: "#D4764E" },
  military_junta:    { label: "Military juntas",            colorVar: "var(--gov-mil,  #C65A37)", fallback: "#C65A37" },
  theocracy:         { label: "Theocracies",                colorVar: "var(--gov-theo, #5CAA6E)", fallback: "#5CAA6E" },
  other:             { label: "Other",                      colorVar: "var(--gov-other,#8899AA)", fallback: "#8899AA" },
};

function classifyGovType(raw: string | null | undefined): GovKey {
  const s = (raw ?? "").toLowerCase();
  if (!s) return "other";
  if (s.includes("parliament")) return "parliamentary";
  if (s.includes("semi") && s.includes("presidential")) return "semi_presidential";
  if (s.includes("presidential") || s.includes("federal republic") || s.includes("republic")) {
    if (s.includes("one") || s.includes("single-party") || s.includes("communist")) return "one_party";
    return "presidential";
  }
  if (s.includes("one-party") || s.includes("single-party") || s.includes("communist")) return "one_party";
  if (s.includes("junta") || s.includes("military")) return "military_junta";
  if (s.includes("theocracy") || s.includes("theocratic")) return "theocracy";
  if (s.includes("absolute") && s.includes("monarchy")) return "abs_monarchy";
  if (s.includes("monarchy")) return "const_monarchy";
  return "other";
}

// -- Types -------------------------------------------------------------------

type AggregateRow = {
  governmentType: string;
  countryCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  medianScore: number;
};

type DotRow = {
  governmentType: string;
  slug: string;
  name: string;
  iso2: string | null;
  score: number;
};

type TrajectoryRow = {
  quarter: string;
  governmentType: string;
  avgScore: number;
  countryCount: number;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAggregates(raw: unknown): AggregateRow[] {
  const rows = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : (((raw as { rows?: unknown[] })?.rows as Record<string, unknown>[]) ?? []);
  return rows
    .filter((r) => typeof r.governmentType === "string")
    .map((r) => ({
      governmentType: r.governmentType as string,
      countryCount: toNum(r.countryCount),
      avgScore: toNum(r.avgScore),
      minScore: toNum(r.minScore),
      maxScore: toNum(r.maxScore),
      medianScore: toNum(r.medianScore),
    }));
}

function normalizeDots(raw: unknown): DotRow[] {
  const rows = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : (((raw as { rows?: unknown[] })?.rows as Record<string, unknown>[]) ?? []);
  return rows
    .filter((r) => typeof r.governmentType === "string" && typeof r.slug === "string")
    .map((r) => ({
      governmentType: r.governmentType as string,
      slug: r.slug as string,
      name: (r.name as string) ?? "",
      iso2: (r.iso2 as string | null) ?? null,
      score: toNum(r.score),
    }));
}

function normalizeTrajectory(raw: unknown): TrajectoryRow[] {
  const rows = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : (((raw as { rows?: unknown[] })?.rows as Record<string, unknown>[]) ?? []);
  return rows
    .filter((r) => typeof r.quarter === "string" && typeof r.governmentType === "string")
    .map((r) => ({
      quarter: r.quarter as string,
      governmentType: r.governmentType as string,
      avgScore: toNum(r.avgScore),
      countryCount: toNum(r.countryCount),
    }));
}

// -- Group key to readable ordering -----------------------------------------

const ROW_ORDER: GovKey[] = [
  "parliamentary",
  "presidential",
  "semi_presidential",
  "const_monarchy",
  "one_party",
  "military_junta",
  "theocracy",
  "abs_monarchy",
  "other",
];

// -- Page --------------------------------------------------------------------

export default async function GovernmentTypesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const quarter = typeof sp?.quarter === "string" ? sp.quarter : undefined;

  let aggregates: AggregateRow[] = [];
  let dots: DotRow[] = [];
  let trajectory: TrajectoryRow[] = [];

  try {
    const [aggRaw, dotsRaw, trajRaw] = await Promise.all([
      getCIByGovernmentType(quarter),
      getCIByGovernmentTypeDots(quarter),
      getGovTypeTrajectory(),
    ]);
    aggregates = normalizeAggregates(aggRaw);
    dots = normalizeDots(dotsRaw);
    trajectory = normalizeTrajectory(trajRaw);
  } catch {
    // DB not seeded
  }

  // Group dots + aggregates by GovKey
  const grouped = new Map<
    GovKey,
    {
      key: GovKey;
      meta: (typeof GOV_META)[GovKey];
      rawLabels: Set<string>;
      dots: DotRow[];
      countryCount: number;
      avgScore: number;
      minScore: number;
      maxScore: number;
      medianScore: number;
    }
  >();

  for (const row of aggregates) {
    const key = classifyGovType(row.governmentType);
    const bucket = grouped.get(key) ?? {
      key,
      meta: GOV_META[key],
      rawLabels: new Set<string>(),
      dots: [],
      countryCount: 0,
      avgScore: 0,
      minScore: 100,
      maxScore: 0,
      medianScore: 0,
    };
    bucket.rawLabels.add(row.governmentType);
    // Merge: weighted avg, extreme min/max, and approximate median (weighted mean of medians)
    const prevN = bucket.countryCount;
    const newN = prevN + row.countryCount;
    bucket.avgScore =
      newN > 0 ? (bucket.avgScore * prevN + row.avgScore * row.countryCount) / newN : 0;
    bucket.medianScore =
      newN > 0
        ? (bucket.medianScore * prevN + row.medianScore * row.countryCount) / newN
        : 0;
    bucket.minScore = Math.min(bucket.minScore, row.minScore);
    bucket.maxScore = Math.max(bucket.maxScore, row.maxScore);
    bucket.countryCount = newN;
    grouped.set(key, bucket);
  }
  for (const d of dots) {
    const key = classifyGovType(d.governmentType);
    const bucket = grouped.get(key);
    if (bucket) bucket.dots.push(d);
  }

  const groups = ROW_ORDER.map((k) => grouped.get(k)).filter(
    (g): g is NonNullable<typeof g> => !!g && g.countryCount > 0
  );

  // Trajectory: map GovKey → quarters list sorted ascending
  const traj = new Map<GovKey, { quarter: string; avgScore: number }[]>();
  for (const t of trajectory) {
    const key = classifyGovType(t.governmentType);
    if (!traj.has(key)) traj.set(key, []);
    traj.get(key)!.push({ quarter: t.quarter, avgScore: t.avgScore });
  }
  // Merge same-key multi-raw-labels at quarter level: average
  const trajAgg = new Map<GovKey, { quarter: string; avgScore: number }[]>();
  for (const [key, rows] of traj) {
    const byQ = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      const cur = byQ.get(r.quarter) ?? { sum: 0, n: 0 };
      cur.sum += r.avgScore;
      cur.n += 1;
      byQ.set(r.quarter, cur);
    }
    const merged = [...byQ.entries()]
      .map(([q, v]) => ({ quarter: q, avgScore: v.sum / v.n }))
      .sort((a, b) => a.quarter.localeCompare(b.quarter));
    trajAgg.set(key, merged);
  }

  function tenYearDelta(key: GovKey): number | null {
    const rows = trajAgg.get(key);
    if (!rows || rows.length < 2) return null;
    const last = rows[rows.length - 1];
    // pick earliest available within last ~10 years (40 quarters). If short history,
    // fall back to the earliest data point.
    const target = Math.max(0, rows.length - 40);
    const prev = rows[target];
    return last.avgScore - prev.avgScore;
  }

  // Callout calculations
  const highestAvg = [...groups].sort((a, b) => b.avgScore - a.avgScore)[0];
  const widestSpread = [...groups].sort(
    (a, b) => b.maxScore - b.minScore - (a.maxScore - a.minScore)
  )[0];
  const groupsWithDelta = groups
    .map((g) => ({ g, delta: tenYearDelta(g.key) }))
    .filter((x): x is { g: (typeof groups)[number]; delta: number } => x.delta !== null);
  const mostImproved = [...groupsWithDelta].sort((a, b) => b.delta - a.delta)[0];
  const mostDeclined = [...groupsWithDelta].sort((a, b) => a.delta - b.delta)[0];

  const totalCountries = groups.reduce((s, g) => s + g.countryCount, 0);

  const hasData = groups.length > 0;

  return (
    <div className="civica-govtypes">
      <section className="page-hero">
        <div className="breadcrumb">
          <Link href="/index">← Index</Link> / Government types
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
      </section>

      {hasData ? (
        <>
          <section className="callout-strip">
            <Callout
              label="Highest avg. CI"
              value={highestAvg ? highestAvg.avgScore.toFixed(1) : "—"}
              color={highestAvg?.meta.colorVar}
              hint={
                highestAvg
                  ? `${highestAvg.meta.label} (n=${highestAvg.countryCount})`
                  : ""
              }
            />
            <Callout
              label="Widest spread"
              value={
                widestSpread
                  ? `${Math.round(widestSpread.maxScore - widestSpread.minScore)} pt`
                  : "—"
              }
              color={widestSpread?.meta.colorVar}
              hint={
                widestSpread
                  ? `${widestSpread.meta.label} (${Math.round(widestSpread.minScore)} → ${Math.round(widestSpread.maxScore)})`
                  : ""
              }
            />
            <Callout
              label="Most improved (10y)"
              value={
                mostImproved ? formatDelta(mostImproved.delta) : "—"
              }
              color={mostImproved?.g.meta.colorVar}
              hint={mostImproved ? mostImproved.g.meta.label : "Insufficient history"}
            />
            <Callout
              label="Most declined (10y)"
              value={
                mostDeclined ? formatDelta(mostDeclined.delta) : "—"
              }
              color="var(--tier-failed)"
              hint={mostDeclined ? mostDeclined.g.meta.label : "Insufficient history"}
            />
          </section>

          <section>
            <div className="section-eyebrow">
              The full distribution · every country placed by CI
            </div>
            <h2 className="section-title">Each dot is a country.</h2>

            <div className="dist-plot-wrap">
              <div className="dist-plot-head">
                <div className="dist-plot-axis-label">
                  Y-AXIS: GOVERNMENT TYPE · X-AXIS: CIVICA INDEX 0–100 · WHITE BAR: AVG
                </div>
                <div className="dist-legend">
                  {groups.map((g) => (
                    <div key={g.key} className="dist-legend-item">
                      <span
                        className="dist-legend-dot"
                        style={{ background: g.meta.colorVar }}
                      />
                      {g.meta.label}
                    </div>
                  ))}
                </div>
              </div>

              <BeeSwarm groups={groups} />
            </div>
          </section>

          <section>
            <div className="section-eyebrow">
              By the numbers · every government type
            </div>
            <h2 className="section-title">Average, spread, and trajectory.</h2>

            <div className="gov-list">
              <div className="gov-list-header">
                <div />
                <div>Government type</div>
                <div className="right">Countries</div>
                <div>Spread (min–max) · avg</div>
                <div className="right">Avg CI</div>
                <div>Trajectory</div>
              </div>

              {groups.map((g) => {
                const range = g.maxScore - g.minScore;
                const fillLeft = g.minScore;
                const fillWidth = Math.max(2, range);
                const avgLeft = g.avgScore;
                const traj = trajAgg.get(g.key) ?? [];
                return (
                  <div key={g.key} className="gov-list-row">
                    <div
                      className="gov-stripe"
                      style={{ background: g.meta.colorVar }}
                    />
                    <div className="gov-name-block">
                      <div className="gov-name">{g.meta.label}</div>
                      <div className="gov-examples">
                        {g.dots
                          .slice(0, 6)
                          .map((d) => d.name)
                          .join(" · ")}
                        {g.dots.length > 6 ? ` · ${g.dots.length - 6} more` : ""}
                      </div>
                    </div>
                    <div className="gov-count right">
                      {g.countryCount}
                      <small>countries</small>
                    </div>
                    <div>
                      <div className="gov-spread-bar">
                        <div
                          className="gov-spread-fill"
                          style={{
                            left: `${fillLeft}%`,
                            width: `${fillWidth}%`,
                            background: `color-mix(in oklab, ${g.meta.fallback} 30%, transparent)`,
                          }}
                        />
                        <div
                          className="gov-spread-avg"
                          style={{ left: `${avgLeft}%` }}
                        />
                      </div>
                      <div className="gov-spread-label">
                        <span>{Math.round(g.minScore)}</span>
                        <span>avg {g.avgScore.toFixed(1)}</span>
                        <span>{Math.round(g.maxScore)}</span>
                      </div>
                    </div>
                    <div
                      className="gov-avg right"
                      style={{ color: g.meta.colorVar }}
                    >
                      {g.avgScore.toFixed(1)}
                    </div>
                    <div>
                      <Trajectory points={traj} color={g.meta.colorVar} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="detail-grid">
            <div className="panel">
              <div className="section-eyebrow no-margin">
                What the data says
              </div>
              <h3>
                {highestAvg
                  ? `${highestAvg.meta.label} cluster at the top.`
                  : "Clustering patterns by system."}{" "}
                {widestSpread
                  ? `${widestSpread.meta.label} do not cluster at all.`
                  : ""}
              </h3>
              <p className="panel-lede">
                {highestAvg && widestSpread
                  ? `The narrowest high-performing band (avg ${highestAvg.avgScore.toFixed(
                      1,
                    )}, min ${Math.round(highestAvg.minScore)}) belongs to ${highestAvg.meta.label.toLowerCase()}. ${widestSpread.meta.label} span ${Math.round(
                      widestSpread.maxScore - widestSpread.minScore,
                    )} points, from ${Math.round(widestSpread.minScore)} to ${Math.round(widestSpread.maxScore)}. System type predicts outcomes only at the extremes.`
                  : "System type predicts outcomes only at the extremes. Individual country trajectories vary more than their system."}
              </p>
            </div>
            <div className="panel">
              <div className="section-eyebrow no-margin">
                What the data does not say
              </div>
              <h3>
                &ldquo;{highestAvg ? highestAvg.meta.label : "Some systems"} are
                better.&rdquo; The data says these systems{" "}
                <em>cluster at the top in {new Date().getFullYear()}</em> —
                which may reflect where they exist more than what they are.
              </h3>
              <p className="panel-lede">
                The Civica Index does not argue that any single government type
                is best. Correlation is shown; causation is left to researchers
                and historians who can control for confounders that the Index
                cannot.
              </p>
              <p className="panel-note">
                Read this chart with caution.{" "}
                <Link href="/index/methodology#limitations">
                  Methodology §6 →
                </Link>
              </p>
            </div>
          </section>

          <footer className="gov-footer">
            <div>
              Civica Index · n={totalCountries} · {groups.length} system types
            </div>
            <div>
              <Link href="/index">← Back to Civica Index</Link>
            </div>
          </footer>
        </>
      ) : (
        <div className="empty-state">
          <p>No Civica Index data available yet.</p>
          <p className="empty-hint">
            Run <code>npm run ingest:ci</code> and{" "}
            <code>npm run calculate:ci</code> to populate scores.
          </p>
          <Link href="/index">← Back to Index</Link>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

// -- Subcomponents -----------------------------------------------------------

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

function formatDelta(d: number): string {
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  return `${sign}${Math.abs(d).toFixed(1)}`;
}

function BeeSwarm({
  groups,
}: {
  groups: {
    key: GovKey;
    meta: (typeof GOV_META)[GovKey];
    dots: { score: number; slug: string; name: string }[];
    avgScore: number;
  }[];
}) {
  // viewBox: 1120 × 360. Y-label gutter ~150, X-axis at bottom ~y=330.
  const W = 1120;
  const H = 360;
  const LEFT = 150;
  const RIGHT = 60;
  const TOP = 28;
  const BOTTOM_AXIS_Y = 330;
  const plotW = W - LEFT - RIGHT;
  const rowH = (BOTTOM_AXIS_Y - TOP) / Math.max(1, groups.length);
  const DOT_R = 4.5;

  function xFor(score: number) {
    return LEFT + (Math.max(0, Math.min(100, score)) / 100) * plotW;
  }

  // Simple 1D bee-swarm: sort by score, then push dots vertically when they collide on x
  function layoutRow(
    scores: number[],
    rowY: number,
  ): { cx: number; cy: number }[] {
    const sorted = [...scores]
      .map((s, i) => ({ s, i }))
      .sort((a, b) => a.s - b.s);
    const placed: { cx: number; cy: number; i: number }[] = [];
    for (const { s, i } of sorted) {
      const cx = xFor(s);
      let cy = rowY;
      const maxOffset = rowH / 2 - DOT_R - 2;
      for (let step = 0; step < 40; step++) {
        const collides = placed.some(
          (p) =>
            Math.hypot(p.cx - cx, p.cy - cy) < DOT_R * 2 + 0.5,
        );
        if (!collides) break;
        const direction = step % 2 === 0 ? 1 : -1;
        const magnitude = Math.ceil((step + 1) / 2) * (DOT_R * 0.9);
        cy = rowY + direction * Math.min(magnitude, maxOffset);
      }
      placed.push({ cx, cy, i });
    }
    // Restore original order
    return placed
      .sort((a, b) => a.i - b.i)
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
      {/* x gridlines */}
      <g stroke="var(--color-divider)" strokeWidth="1">
        {[0, 20, 40, 60, 80, 100].map((v) => (
          <line
            key={v}
            x1={xFor(v)}
            y1={TOP - 8}
            x2={xFor(v)}
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
        {[0, 20, 40, 60, 80, 100].map((v) => (
          <text key={v} x={xFor(v) - 5} y={BOTTOM_AXIS_Y + 18}>
            {v}
          </text>
        ))}
      </g>

      {groups.map((g, idx) => {
        const rowY = TOP + rowH * (idx + 0.5);
        const positions = layoutRow(
          g.dots.map((d) => d.score),
          rowY,
        );
        const avgX = xFor(g.avgScore);
        return (
          <g key={g.key}>
            {/* y label */}
            <text
              x={16}
              y={rowY + 4}
              fontFamily="'Fraunces', serif"
              fontSize="14"
              fill="var(--color-text-primary)"
            >
              {g.meta.label.replace(/ies$/, "y")}
            </text>
            {/* baseline */}
            <line
              x1={LEFT}
              y1={rowY}
              x2={W - RIGHT}
              y2={rowY}
              stroke="var(--color-divider)"
              strokeDasharray="2 4"
            />
            {/* avg marker */}
            <rect
              x={avgX - 1.5}
              y={rowY - 9}
              width={3}
              height={18}
              fill="var(--color-text-primary)"
            />
            {/* dots */}
            <g fill={g.meta.colorVar}>
              {positions.map((p, i) => {
                const d = g.dots[i];
                return (
                  <circle
                    key={`${d.slug}-${i}`}
                    cx={p.cx}
                    cy={p.cy}
                    r={DOT_R}
                  >
                    <title>
                      {d.name}: {d.score.toFixed(1)}
                    </title>
                  </circle>
                );
              })}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function Trajectory({
  points,
  color,
}: {
  points: { quarter: string; avgScore: number }[];
  color: string;
}) {
  if (points.length === 0) {
    return <div className="gov-traj-empty">—</div>;
  }
  const W = 120;
  const H = 36;
  const values = points.map((p) => p.avgScore);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = points.length;

  if (n === 1) {
    const y = H / 2;
    return (
      <svg
        className="gov-trajectory"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        <circle cx={W / 2} cy={y} r={2} fill={color} />
      </svg>
    );
  }

  const path = points
    .map((p, i) => {
      const x = (i / (n - 1)) * W;
      const y = H - ((p.avgScore - min) / range) * (H - 6) - 3;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="gov-trajectory"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trajectory over ${n} quarters`}
    >
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// -- CSS ---------------------------------------------------------------------

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
  .civica-govtypes .dist-legend {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .civica-govtypes .dist-legend-item {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-40);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .civica-govtypes .dist-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
  .civica-govtypes .dist-plot {
    width: 100%;
    height: 360px;
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
    grid-template-columns: 6px minmax(0, 1.6fr) 120px minmax(0, 1.5fr) 120px 100px;
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
  .civica-govtypes .gov-name {
    font-family: var(--font-serif);
    font-size: 20px;
    line-height: 1.1;
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
  .civica-govtypes .empty-state p { margin-bottom: 8px; font-family: var(--font-serif); font-size: 18px; }
  .civica-govtypes .empty-state .empty-hint { font-family: var(--font-mono); font-size: 12px; color: var(--color-text-25); }
  .civica-govtypes .empty-state a { color: var(--color-accent); text-decoration: none; font-family: var(--font-mono); font-size: 12px; margin-top: 24px; display: inline-block; }

  @media (max-width: 900px) {
    .civica-govtypes { padding: 0 20px; }
    .civica-govtypes .page-title { font-size: 40px; }
    .civica-govtypes .callout-strip { grid-template-columns: 1fr 1fr; }
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
`;
