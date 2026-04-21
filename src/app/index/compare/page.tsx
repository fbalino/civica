import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  getAllJurisdictions,
  compareCICountries,
  getCICountryHistory,
} from "@/lib/db/queries";
import { CICompareSelector } from "./CICompareSelector";

export const metadata: Metadata = {
  title: "Compare Countries — Civica Index",
  description:
    "Compare two or three countries side by side. CI overlay on a shared timeline, dimension-by-dimension breakdown, and auto-generated head-to-head insights.",
  alternates: { canonical: "https://civicaatlas.org/index/compare" },
  openGraph: {
    title: "Compare Countries — Civica Index | Civica",
    description:
      "Overlay CI on a shared timeline, then drill into the six weighted dimensions to see where countries actually diverge.",
    url: "https://civicaatlas.org/index/compare",
  },
};

const DIMENSION_LABELS: Record<string, string> = {
  democratic_quality: "Democratic quality",
  rule_of_law: "Rule of law & institutions",
  human_development: "Human development",
  freedom_rights: "Freedom & rights",
  corruption_control: "Corruption control",
  stability_security: "Stability & security",
};

const DIMENSION_ORDER = [
  "democratic_quality",
  "rule_of_law",
  "human_development",
  "freedom_rights",
  "corruption_control",
  "stability_security",
];

const DIMENSION_WEIGHTS: Record<string, number> = {
  democratic_quality: 30,
  rule_of_law: 20,
  human_development: 15,
  freedom_rights: 15,
  corruption_control: 10,
  stability_security: 10,
};

const SERIES_VARS = [
  "var(--series-a, oklch(72% 0.15 35))",
  "var(--series-b, oklch(68% 0.13 220))",
  "var(--series-c, oklch(72% 0.14 150))",
];

const SERIES_LETTERS = ["A", "B", "C"];

function formatQuarter(q: string): string {
  const m = q.match(/^(\d{4})-Q(\d)$/);
  if (!m) return q;
  return `Q${m[2]} ${m[1]}`;
}

function fmtPop(pop: number | null): string {
  if (!pop || pop <= 0) return "—";
  if (pop >= 1_000_000_000) return `${(pop / 1_000_000_000).toFixed(1)}B`;
  if (pop >= 1_000_000) return `${Math.round(pop / 1_000_000)}M`;
  if (pop >= 1_000) return `${Math.round(pop / 1_000)}K`;
  return `${pop}`;
}

function govShort(g: string | null): string {
  if (!g) return "—";
  return g
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type HistoryPoint = { quarter: string; score: number };

type CompareCIResult = Awaited<ReturnType<typeof compareCICountries>>;
type CIHistoryResult = Awaited<ReturnType<typeof getCICountryHistory>>;

function TimelineOverlay({
  series,
}: {
  series: { name: string; colorVar: string; data: HistoryPoint[] }[];
}) {
  const allPoints = series.flatMap((s) => s.data);
  if (allPoints.length === 0) return null;

  const quartersSet = new Set(allPoints.map((p) => p.quarter));
  const quarters = [...quartersSet].sort();
  if (quarters.length < 2) return null;

  const W = 1120;
  const H = 340;
  const PAD = { top: 0, right: 0, bottom: 24, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const minScore = 0;
  const maxScore = 100;
  const xStep = chartW / (quarters.length - 1);

  function xAt(i: number) {
    return PAD.left + i * xStep;
  }
  function yAt(score: number) {
    return PAD.top + chartH - ((score - minScore) / (maxScore - minScore)) * chartH;
  }

  // Tier band vertical extents (top→bottom: 100→90, 90→75, 75→50, 50→25, 25→0)
  const bandTops = [
    { from: 100, to: 90, color: "var(--tier-exceptional)" },
    { from: 90, to: 75, color: "var(--tier-strong)" },
    { from: 75, to: 50, color: "var(--tier-mixed)" },
    { from: 50, to: 25, color: "var(--tier-weak)" },
    { from: 25, to: 0, color: "var(--tier-failed)" },
  ];

  const xLabelIdx = new Set<number>([0, quarters.length - 1]);
  if (quarters.length > 6) {
    xLabelIdx.add(Math.round(quarters.length / 3));
    xLabelIdx.add(Math.round((2 * quarters.length) / 3));
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: 340 }}
      aria-label="CI timeline overlay"
    >
      {bandTops.map((b) => (
        <rect
          key={b.from}
          x={PAD.left}
          y={yAt(b.from)}
          width={chartW}
          height={yAt(b.to) - yAt(b.from)}
          fill={b.color}
          opacity="0.06"
        />
      ))}
      <g stroke="var(--color-divider)" strokeWidth="1" opacity="0.6">
        {[90, 75, 50, 25].map((v) => (
          <line
            key={v}
            x1={PAD.left}
            y1={yAt(v)}
            x2={PAD.left + chartW}
            y2={yAt(v)}
          />
        ))}
      </g>
      {[100, 90, 75, 50, 25].map((v) => (
        <text
          key={v}
          x={4}
          y={yAt(v) + 3}
          fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
          fontSize="10"
          fill="var(--color-text-30)"
          fontWeight="500"
        >
          {v}
        </text>
      ))}
      {series.map((s) => {
        const pts = quarters
          .map((q, i) => {
            const pt = s.data.find((d) => d.quarter === q);
            return pt ? { x: xAt(i), y: yAt(pt.score) } : null;
          })
          .filter(Boolean) as { x: number; y: number }[];
        if (pts.length < 2) return null;
        const d = pts
          .map((p, pi) => `${pi === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" ");
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.colorVar} strokeWidth="2" />
            {pts.map((p, pi) => (
              <circle
                key={pi}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={s.colorVar}
              />
            ))}
          </g>
        );
      })}
      <g
        fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
        fontSize="10"
        fill="var(--color-text-30)"
        fontWeight="500"
      >
        {quarters.map((q, i) =>
          xLabelIdx.has(i) ? (
            <text
              key={q}
              x={xAt(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === quarters.length - 1 ? "end" : "middle"}
            >
              {formatQuarter(q)}
            </text>
          ) : null
        )}
      </g>
    </svg>
  );
}

export default async function CIComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawC = sp?.c;
  const slugs: string[] = Array.isArray(rawC) ? rawC : rawC ? [rawC] : [];
  const validSlugs = slugs
    .filter((s) => typeof s === "string" && s.length > 0)
    .slice(0, 3);

  let allCountries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    allCountries = await getAllJurisdictions();
  } catch {}
  const countryList = allCountries.map((c) => ({
    slug: c.slug,
    name: c.name,
    iso2: c.iso2,
  }));

  let compareData: CompareCIResult = [];
  let historyArrays: CIHistoryResult[] = [];
  if (validSlugs.length >= 1) {
    try {
      const results = await Promise.all([
        compareCICountries(validSlugs),
        ...validSlugs.map((s) => getCICountryHistory(s)),
      ]);
      compareData = results[0] as CompareCIResult;
      historyArrays = results.slice(1) as CIHistoryResult[];
    } catch {}
  }

  const ordered = validSlugs
    .map((slug) => compareData.find((c) => c.jurisdiction.slug === slug))
    .filter(Boolean) as CompareCIResult;

  const selectedCards = [0, 1, 2].map((index) => {
    const country = ordered[index];
    if (!country) return null;
    return {
      slug: country.jurisdiction.slug,
      name: country.jurisdiction.name,
      iso2: country.jurisdiction.iso2 ?? null,
      score:
        country.composite && country.composite.score !== null
          ? Number(country.composite.score)
          : null,
      rank: country.composite?.rank ?? null,
      governmentType: country.jurisdiction.governmentType
        ? govShort(country.jurisdiction.governmentType)
        : null,
      continent: country.jurisdiction.continent ?? null,
      populationLabel:
        country.jurisdiction.population && country.jurisdiction.population > 0
          ? fmtPop(country.jurisdiction.population)
          : null,
    };
  });

  const timelineSeries = ordered.map((country, i) => {
    const hist = historyArrays[validSlugs.indexOf(country.jurisdiction.slug)] ?? [];
    const arr = (Array.isArray(hist) ? hist : (hist as { rows: unknown[] }).rows ?? []) as {
      quarter: string;
      score: number;
    }[];
    return {
      name: country.jurisdiction.name,
      colorVar: SERIES_VARS[i] ?? SERIES_VARS[0],
      data: arr.map((h) => ({ quarter: h.quarter, score: Number(h.score) })),
    };
  });

  const hasTimeline = timelineSeries.some((s) => s.data.length >= 2);
  const hasData = ordered.length >= 2;

  // Head-to-head insight generation (only if exactly 2 countries and both have dims)
  type DimRow = { dim: string; values: (number | null)[] };
  const dimRows: DimRow[] = DIMENSION_ORDER.map((dim) => {
    const values = ordered.map((country) => {
      const d = country.dimensions.find((x) => x.dimension === dim);
      return d && d.normalizedScore !== null && d.normalizedScore !== undefined
        ? Number(d.normalizedScore)
        : null;
    });
    return { dim, values };
  });

  let insightA: { country: string; dim: string; delta: number } | null = null;
  let insightB: { country: string; dim: string; delta: number } | null = null;

  if (ordered.length === 2) {
    const diffs = dimRows
      .map((r) => {
        const a = r.values[0];
        const b = r.values[1];
        if (a === null || b === null) return null;
        return { dim: r.dim, a, b, delta: a - b };
      })
      .filter(Boolean) as { dim: string; a: number; b: number; delta: number }[];
    const aLead = diffs.filter((d) => d.delta > 0).sort((x, y) => y.delta - x.delta);
    const bLead = diffs.filter((d) => d.delta < 0).sort((x, y) => x.delta - y.delta);
    if (aLead[0]) {
      insightA = {
        country: ordered[0].jurisdiction.name,
        dim: aLead[0].dim,
        delta: aLead[0].delta,
      };
    }
    if (bLead[0]) {
      insightB = {
        country: ordered[1].jurisdiction.name,
        dim: bLead[0].dim,
        delta: Math.abs(bLead[0].delta),
      };
    }
  }

  return (
    <main className="civica-compare-page">
      <section className="page-hero">
        <nav className="breadcrumb">
          <Link href="/index">← Civica Index</Link>
          <span>/</span>
          Compare
        </nav>
        <h1 className="page-title">Compare two or three countries, side by side.</h1>
        <p className="page-lede">
          Overlay CI on a shared timeline, then drill into each of the six
          weighted dimensions to see where countries actually differ — not just
          what their headline score says.
        </p>
      </section>

      <section className="picker-row" aria-label="Country slots">
        <Suspense fallback={null}>
          <CICompareSelector
            countries={countryList}
            selectedCards={selectedCards}
          />
        </Suspense>
      </section>

      {validSlugs.length === 0 && (
        <div className="ci-empty">
          <p className="ci-empty-title">Choose countries above to begin comparing.</p>
          <p className="ci-empty-sub">
            Pick two countries to see an overlay; pick three to compare across
            the full dimension grid.
          </p>
        </div>
      )}

      {validSlugs.length === 1 && (
        <div className="ci-empty">
          <p className="ci-empty-title">Pick one more country to start the overlay.</p>
        </div>
      )}

      {hasData && (
        <>
          {hasTimeline && (
            <section className="chart-block" aria-label="Timeline overlay">
              <div className="chart-header">
                <div>
                  <div className="chart-sub">CI TIMELINE · OVERLAY</div>
                  <div className="chart-title">
                    {ordered.map((o) => o.jurisdiction.name).join(" vs. ")}
                  </div>
                </div>
              </div>
              <div className="chart-plot">
                <TimelineOverlay series={timelineSeries} />
              </div>
              <div className="chart-legend">
                {timelineSeries.map((s) => (
                  <span key={s.name}>
                    <span
                      className="legend-swatch"
                      style={{ background: s.colorVar }}
                    />
                    {s.name}
                  </span>
                ))}
                <span style={{ color: "var(--color-text-20)" }}>
                  Tier bands shown in background
                </span>
              </div>
            </section>
          )}

          <section aria-labelledby="dim-compare-title">
            <div className="chart-sub" style={{ marginBottom: 12 }}>
              DIMENSION-BY-DIMENSION · LATEST CI COMPONENTS
            </div>
            <h2 id="dim-compare-title" className="chart-title">
              Where they diverge.
            </h2>
            <div className="dim-compare">
              <div className="dim-compare-header">
                <div>Dimension</div>
                {ordered.map((o, i) => (
                  <div key={o.jurisdiction.slug}>
                    {o.jurisdiction.name}
                    <span
                      className="hdr-dot"
                      style={{ background: SERIES_VARS[i] }}
                    />
                  </div>
                ))}
                {ordered.length < 3 &&
                  Array.from({ length: 3 - ordered.length }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ color: "var(--color-text-20)" }}>
                      Country {SERIES_LETTERS[ordered.length + i]} —
                    </div>
                  ))}
                <div style={{ textAlign: "right" }}>Weight</div>
              </div>
              {DIMENSION_ORDER.map((dim) => {
                const weight = DIMENSION_WEIGHTS[dim];
                return (
                  <div key={dim} className="dim-compare-row">
                    <div className="dim-name">
                      {DIMENSION_LABELS[dim] ?? dim}
                    </div>
                    {ordered.map((country, i) => {
                      const d = country.dimensions.find((x) => x.dimension === dim);
                      const val =
                        d && d.normalizedScore !== null && d.normalizedScore !== undefined
                          ? Number(d.normalizedScore)
                          : null;
                      const color = SERIES_VARS[i] ?? SERIES_VARS[0];
                      return (
                        <div
                          key={country.jurisdiction.slug}
                          className="dim-compare-cell"
                        >
                          {val !== null ? (
                            <>
                              <div className="val" style={{ color }}>
                                {val.toFixed(1)}
                              </div>
                              <div className="bar">
                                <span
                                  style={{
                                    width: `${Math.max(0, Math.min(100, val))}%`,
                                    background: color,
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="val" style={{ color: "var(--color-text-20)" }}>
                              —
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {ordered.length < 3 &&
                      Array.from({ length: 3 - ordered.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="dim-compare-cell">
                          <div className="val" style={{ color: "var(--color-text-20)" }}>
                            —
                          </div>
                        </div>
                      ))}
                    <div className="dim-wt">{weight}%</div>
                  </div>
                );
              })}
            </div>
          </section>

          {(insightA || insightB) && (
            <section className="h2h" aria-label="Head-to-head insights">
              {insightA && (
                <article className="h2h-card">
                  <div className="h2h-eyebrow">▲ {insightA.country.toUpperCase()} LEADS</div>
                  <div className="h2h-body">
                    {insightA.country} scores{" "}
                    <strong>{insightA.delta.toFixed(1)} points</strong> higher
                    on <em>{DIMENSION_LABELS[insightA.dim]}</em>, its largest
                    advantage in this matchup.
                  </div>
                </article>
              )}
              {insightB && (
                <article className="h2h-card">
                  <div className="h2h-eyebrow">▲ {insightB.country.toUpperCase()} LEADS</div>
                  <div className="h2h-body">
                    {insightB.country} leads on{" "}
                    <em>{DIMENSION_LABELS[insightB.dim]}</em> by{" "}
                    <strong>{insightB.delta.toFixed(1)} points</strong> — its
                    biggest win across the six dimensions.
                  </div>
                </article>
              )}
            </section>
          )}

          <footer className="ci-page-footer">
            {ordered.map((country) => (
              <Link
                key={country.jurisdiction.slug}
                href={`/index/${country.jurisdiction.slug}`}
              >
                {country.jurisdiction.name} detail →
              </Link>
            ))}
            <Link href="/index/methodology">Methodology →</Link>
            <span className="footer-meta">
              Civica Index v1.0 · weighted composite of 6 dimensions
            </span>
          </footer>
        </>
      )}

      <style>{`
        .civica-compare-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px var(--spacing-page-x, 40px) 64px;
          color: var(--color-text-primary);
        }
        .page-hero { padding: 32px 0 32px; }
        .breadcrumb {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          letter-spacing: 0.03em;
          color: var(--color-text-30);
          margin-bottom: 20px;
          display: flex; gap: 8px; align-items: center;
        }
        .breadcrumb a { color: var(--color-text-30); text-decoration: none; }
        .breadcrumb a:hover { color: var(--color-text-primary); }

        .page-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 56px;
          font-weight: 400;
          letter-spacing: -0.04em;
          line-height: 1.02;
          margin-bottom: 12px;
        }
        .page-lede {
          font-size: 17px;
          color: var(--color-text-60);
          max-width: 700px;
          line-height: 1.55;
          margin: 0;
        }

        .picker-row { margin: 40px 0 24px; }
        .compare-selector-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .ci-compare-picker-card {
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-top: 3px solid var(--series-a);
          border-radius: 4px;
          padding: 20px 22px;
          min-height: 196px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ci-compare-picker-slot {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--color-text-30);
        }
        .ci-compare-picker-name {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 28px;
          font-family: var(--font-heading, var(--font-serif));
          font-size: 28px;
          font-weight: 400;
          letter-spacing: -0.02em;
          line-height: 1;
          color: var(--color-text-primary);
        }
        .ci-compare-picker-score {
          display: flex;
          align-items: baseline;
          gap: 8px;
          min-height: 38px;
          font-family: var(--font-heading, var(--font-serif));
        }
        .ci-compare-picker-score-val {
          font-size: 32px;
          font-weight: 500;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .ci-compare-picker-score-label {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-30);
        }
        .ci-compare-picker-meta {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 11px;
          color: var(--color-text-30);
          min-height: 32px;
        }
        .ci-compare-picker-remove {
          margin-top: auto;
          width: fit-content;
          background: transparent;
          border: 1px solid var(--color-card-border);
          border-radius: 2px;
          padding: 6px 10px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-40);
          cursor: pointer;
          transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
        }
        .ci-compare-picker-remove:hover {
          color: var(--color-text-primary);
          border-color: var(--color-card-hover-border);
          background: color-mix(in oklch, var(--color-card-hover-bg) 55%, transparent);
        }
        .ci-compare-picker-search {
          width: 100%;
          margin-top: 2px;
          background: var(--color-bg);
          color: var(--color-text-primary);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          padding: 10px 12px;
          font-family: var(--font-mono);
          font-size: 13px;
          outline: none;
        }
        .ci-compare-picker-search::placeholder {
          color: var(--color-text-30);
        }
        .ci-compare-picker-search:focus {
          border-color: var(--color-card-hover-border);
          box-shadow: 0 0 0 1px color-mix(in oklch, var(--color-card-hover-border) 60%, transparent);
        }
        .ci-compare-picker-empty {
          margin-top: auto;
          padding-top: 12px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          letter-spacing: 0.04em;
          color: var(--color-text-30);
        }
        .ci-compare-picker-menu {
          border-radius: 4px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.16);
        }
        .ci-compare-picker-option {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--color-text-primary);
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 13px;
          transition: background 120ms ease, color 120ms ease;
        }
        .ci-compare-picker-option:hover {
          background: var(--color-card-hover-bg);
        }

        .ci-empty {
          padding: 80px 0;
          text-align: center;
        }
        .ci-empty-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 20px;
          color: var(--color-text-40);
          margin-bottom: 8px;
        }
        .ci-empty-sub {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-25);
        }

        .chart-block {
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          background: var(--color-grid-cell);
          padding: 32px 36px;
          margin-bottom: 40px;
        }
        .chart-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 24px; flex-wrap: wrap; margin-bottom: 20px;
        }
        .chart-sub {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 11px;
          color: var(--color-text-30);
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }
        .chart-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 26px;
          font-weight: 400;
          letter-spacing: -0.02em;
          margin: 0 0 24px;
        }
        .chart-plot { position: relative; height: 340px; }
        .chart-legend {
          display: flex; gap: 24px; flex-wrap: wrap;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 11px;
          color: var(--color-text-40);
          margin-top: 18px;
        }
        .legend-swatch {
          display: inline-block;
          width: 14px; height: 3px;
          margin-right: 6px; vertical-align: middle;
        }

        .dim-compare {
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          background: var(--color-grid-bg);
          overflow: hidden;
          display: grid; gap: 1px;
          margin-bottom: 40px;
        }
        .dim-compare-header,
        .dim-compare-row {
          background: var(--color-grid-cell);
          padding: 18px 28px;
          display: grid;
          grid-template-columns: minmax(200px, 1.3fr) repeat(3, 1fr) 80px;
          gap: 18px;
          align-items: center;
        }
        .dim-compare-header {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--color-text-30);
        }
        .dim-compare-header .hdr-dot {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
          margin-left: 8px;
          vertical-align: middle;
        }
        .dim-compare-row .dim-name {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 17px;
          color: var(--color-text-primary);
        }
        .dim-compare-row .dim-wt {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          color: var(--color-text-30);
          text-align: right;
        }
        .dim-compare-cell {
          display: flex; flex-direction: column; gap: 6px;
        }
        .dim-compare-cell .val {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 20px;
          font-weight: 500;
          letter-spacing: -0.01em;
          line-height: 1;
        }
        .dim-compare-cell .bar {
          height: 3px;
          background: var(--color-divider);
          border-radius: 1px;
          overflow: hidden;
        }
        .dim-compare-cell .bar > span {
          display: block;
          height: 100%;
        }

        .h2h {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 40px;
        }
        .h2h-card {
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          padding: 28px 32px;
        }
        .h2h-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 8px;
        }
        .h2h-body {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 22px;
          font-weight: 400;
          line-height: 1.35;
          letter-spacing: -0.01em;
          color: var(--color-text-primary);
        }
        .h2h-body strong { font-weight: 500; }
        .h2h-body em { font-style: italic; color: var(--color-text-60); }

        .ci-page-footer {
          margin-top: 20px;
          padding-top: 24px;
          border-top: 1px solid var(--color-divider);
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          align-items: center;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--color-text-30);
        }
        .ci-page-footer a {
          color: var(--color-accent);
          text-decoration: none;
        }
        .ci-page-footer .footer-meta {
          margin-left: auto;
          color: var(--color-text-30);
        }

        @media (max-width: 900px) {
          .page-title { font-size: 40px; }
          .compare-selector-grid { grid-template-columns: 1fr; }
          .dim-compare-header,
          .dim-compare-row {
            grid-template-columns: 1fr;
            padding: 14px 20px;
          }
          .dim-compare-header > :not(:first-child) { display: none; }
          .h2h { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
