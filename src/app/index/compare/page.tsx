import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAllJurisdictions, compareCICountries, getCICountryHistory } from "@/lib/db/queries";
import { CountryFlag } from "@/components/CountryFlag";
import { CICompareSelector } from "./CICompareSelector";

export const metadata: Metadata = {
  title: "Compare Countries — Civica Index",
  description:
    "Compare governance scores across 2–3 countries. Side-by-side CI dimension breakdowns and historical trajectories.",
  alternates: { canonical: "https://civicaatlas.org/index/compare" },
  openGraph: {
    title: "Compare Countries — Civica Index | Civica",
    description:
      "Compare governance scores across 2–3 countries. Side-by-side CI dimension breakdowns and historical trajectories.",
    url: "https://civicaatlas.org/index/compare",
  },
};

const DIMENSION_LABELS: Record<string, string> = {
  democratic_quality: "Democratic Quality",
  rule_of_law: "Rule of Law",
  human_development: "Human Development",
  freedom_rights: "Freedom & Rights",
  corruption_control: "Corruption Control",
  stability_security: "Stability & Security",
};

const DIMENSION_ORDER = [
  "democratic_quality",
  "rule_of_law",
  "human_development",
  "freedom_rights",
  "corruption_control",
  "stability_security",
];

// Per-country palette — distinct in both dark and light mode
const COUNTRY_COLORS = [
  "oklch(55% 0.18 245)",  // blue
  "oklch(62% 0.20 30)",   // orange-red
  "oklch(52% 0.18 145)",  // green
];

function ciTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: "Elite",    color: "#fff",     bg: "oklch(55% 0.18 245)" };
  if (score >= 75) return { label: "Strong",   color: "#fff",     bg: "oklch(52% 0.18 145)" };
  if (score >= 50) return { label: "Moderate", color: "#1a1208",  bg: "oklch(82% 0.17 85)"  };
  if (score >= 25) return { label: "Weak",     color: "#fff",     bg: "oklch(60% 0.17 45)"  };
  return               { label: "Critical",  color: "#fff",     bg: "oklch(52% 0.20 25)"  };
}

function formatQuarter(q: string): string {
  const m = q.match(/^(\d{4})-Q(\d)$/);
  if (!m) return q;
  return `Q${m[2]} '${m[1].slice(2)}`;
}

type HistoryPoint = { quarter: string; score: number };

function MultiLineHistoryChart({
  series,
}: {
  series: { name: string; color: string; data: HistoryPoint[] }[];
}) {
  const allPoints = series.flatMap((s) => s.data);
  if (allPoints.length === 0) return null;

  // Build a unified quarter axis
  const quartersSet = new Set(allPoints.map((p) => p.quarter));
  const quarters = [...quartersSet].sort();
  if (quarters.length < 2) return null;

  const W = 800;
  const H = 200;
  const PAD = { top: 16, right: 32, bottom: 36, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allScores = allPoints.map((p) => p.score);
  const minScore = Math.max(0, Math.floor(Math.min(...allScores) / 10) * 10 - 10);
  const maxScore = Math.min(100, Math.ceil(Math.max(...allScores) / 10) * 10 + 10);
  const scoreRange = maxScore - minScore || 1;

  const xStep = chartW / (quarters.length - 1);

  function xAt(i: number) { return PAD.left + i * xStep; }
  function yAt(score: number) { return PAD.top + chartH - ((score - minScore) / scoreRange) * chartH; }

  const yTicks = [minScore, minScore + Math.round(scoreRange / 2), maxScore];

  const xLabelIndices = new Set<number>([0, quarters.length - 1]);
  if (quarters.length > 6) {
    xLabelIndices.add(Math.round(quarters.length / 3));
    xLabelIndices.add(Math.round((2 * quarters.length) / 3));
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-label="Historical CI score comparison chart"
    >
      {/* Y-axis grid lines */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left} y1={yAt(tick)}
            x2={PAD.left + chartW} y2={yAt(tick)}
            stroke="currentColor" strokeOpacity="0.07" strokeWidth="1"
          />
          <text
            x={PAD.left - 6} y={yAt(tick)}
            textAnchor="end" dominantBaseline="middle"
            fontSize="10" fontFamily="var(--font-mono)"
            fill="currentColor" fillOpacity="0.35"
          >
            {tick}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {quarters.map((q, i) =>
        xLabelIndices.has(i) ? (
          <text
            key={`xl-${q}`}
            x={xAt(i)} y={PAD.top + chartH + 16}
            textAnchor="middle" fontSize="9"
            fontFamily="var(--font-mono)" fill="currentColor" fillOpacity="0.35"
          >
            {formatQuarter(q)}
          </text>
        ) : null
      )}

      {/* Lines per country */}
      {series.map((s) => {
        const points = quarters
          .map((q, i) => {
            const pt = s.data.find((d) => d.quarter === q);
            return pt ? { x: xAt(i), y: yAt(pt.score) } : null;
          })
          .filter(Boolean) as { x: number; y: number }[];

        if (points.length < 2) return null;

        // Split into segments (skip gaps)
        const segments: { x: number; y: number }[][] = [];
        let seg: { x: number; y: number }[] = [];
        quarters.forEach((q, i) => {
          const pt = s.data.find((d) => d.quarter === q);
          if (pt) {
            seg.push({ x: xAt(i), y: yAt(pt.score) });
          } else {
            if (seg.length >= 2) segments.push(seg);
            seg = [];
          }
        });
        if (seg.length >= 2) segments.push(seg);

        return (
          <g key={s.name}>
            {segments.map((sg, si) => {
              const d = sg.map((p, pi) => `${pi === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
              return (
                <path key={si} d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              );
            })}
            {points.map((p, pi) => (
              <circle key={pi} cx={p.x} cy={p.y} r="3.5" fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function DimensionCompareChart({
  series,
}: {
  series: { name: string; color: string; dimensions: { dimension: string; score: number }[] }[];
}) {
  if (series.length === 0) return null;

  const dims = DIMENSION_ORDER.filter((dim) =>
    series.some((s) => s.dimensions.find((d) => d.dimension === dim))
  );

  if (dims.length === 0) return null;

  const BAR_H = 10;
  const GAP = 3;
  const GROUP_GAP = 18;
  const groupH = series.length * BAR_H + (series.length - 1) * GAP;
  const rowH = groupH + GROUP_GAP;
  const totalH = dims.length * rowH - GROUP_GAP + 2;
  const LABEL_W = 130;
  const SCORE_W = 36;
  const W = 760;
  const barW = W - LABEL_W - SCORE_W - 16;

  return (
    <svg
      viewBox={`0 0 ${W} ${totalH}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-label="Dimension score comparison"
    >
      {dims.map((dim, di) => {
        const y0 = di * rowH;
        return (
          <g key={dim}>
            {/* Dimension label */}
            <text
              x={0} y={y0 + groupH / 2}
              dominantBaseline="middle"
              fontSize="10" fontFamily="var(--font-mono)"
              fill="currentColor" fillOpacity="0.5"
              style={{ textTransform: "uppercase" }}
            >
              {DIMENSION_LABELS[dim] ?? dim}
            </text>

            {/* Bars per country */}
            {series.map((s, si) => {
              const d = s.dimensions.find((x) => x.dimension === dim);
              const score = d ? Math.round(d.score) : 0;
              const barFill = LABEL_W + (score / 100) * barW;
              const y = y0 + si * (BAR_H + GAP);

              return (
                <g key={s.name}>
                  {/* Background track */}
                  <rect x={LABEL_W} y={y} width={barW} height={BAR_H} rx={3} fill="currentColor" fillOpacity="0.06" />
                  {/* Filled bar */}
                  {score > 0 && (
                    <rect x={LABEL_W} y={y} width={(score / 100) * barW} height={BAR_H} rx={3} fill={s.color} />
                  )}
                  {/* Score label */}
                  <text
                    x={LABEL_W + barW + 8} y={y + BAR_H / 2}
                    dominantBaseline="middle"
                    fontSize="10" fontFamily="var(--font-mono)"
                    fill={s.color} fillOpacity="0.9"
                  >
                    {score}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function countryFlag(iso2: string | null): string {
  if (!iso2) return "";
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

type CompareCIResult = Awaited<ReturnType<typeof compareCICountries>>;
type CIHistoryResult = Awaited<ReturnType<typeof getCICountryHistory>>;

export default async function CIComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const rawC = resolvedParams?.c;
  const slugs: string[] = Array.isArray(rawC) ? rawC : rawC ? [rawC] : [];
  const validSlugs = slugs.filter((s) => typeof s === "string" && s.length > 0).slice(0, 3);

  let allCountries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    allCountries = await getAllJurisdictions();
  } catch {}

  const countryList = allCountries.map((c) => ({ slug: c.slug, name: c.name, iso2: c.iso2 }));

  let compareData: CompareCIResult = [];
  let historyData: CIHistoryResult[] = [];

  if (validSlugs.length >= 2) {
    try {
      [compareData, ...historyData] = await Promise.all([
        compareCICountries(validSlugs),
        ...validSlugs.map((s) => getCICountryHistory(s)),
      ]);
    } catch {}
  }

  // Sort compareData to match validSlugs order
  const ordered = validSlugs
    .map((slug) => compareData.find((c) => c.jurisdiction.slug === slug))
    .filter(Boolean) as CompareCIResult;

  // Build per-country history series
  const historySeries = ordered.map((country, i) => {
    const hist = historyData[validSlugs.indexOf(country.jurisdiction.slug)] ?? [];
    const histArr = Array.isArray(hist) ? hist : (hist as { rows: unknown[] }).rows ?? [];
    return {
      name: country.jurisdiction.name,
      color: COUNTRY_COLORS[i] ?? COUNTRY_COLORS[0],
      data: (histArr as { quarter: string; score: number }[]).map((h) => ({
        quarter: h.quarter,
        score: h.score,
      })),
    };
  });

  // Build dimension series
  const dimensionSeries = ordered.map((country, i) => ({
    name: country.jurisdiction.name,
    color: COUNTRY_COLORS[i] ?? COUNTRY_COLORS[0],
    dimensions: country.dimensions.map((d) => ({
      dimension: d.dimension,
      score: Math.round(d.normalizedScore ?? 0),
    })),
  }));

  const hasData = ordered.length >= 2;

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      {/* Breadcrumb */}
      <Link href="/index" className="breadcrumb" style={{ marginBottom: 24, display: "inline-flex" }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 12L6 8l4-4" />
        </svg>
        Civica Index
      </Link>

      <h1 className="page-heading" style={{ marginBottom: 8 }}>Compare CI</h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-30)",
          marginBottom: 36,
        }}
      >
        Select 2–3 countries to compare governance scores side by side.
      </p>

      {/* Country selector */}
      <Suspense fallback={null}>
        <CICompareSelector countries={countryList} />
      </Suspense>

      {/* Prompt when fewer than 2 countries */}
      {validSlugs.length === 0 && (
        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-40)",
            padding: "48px 0",
          }}
        >
          Choose countries above to begin comparing.
        </p>
      )}

      {validSlugs.length === 1 && (
        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-40)",
            padding: "48px 0",
          }}
        >
          Select at least one more country to compare.
        </p>
      )}

      {/* Main comparison content */}
      {hasData && (
        <>
          {/* Color legend */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 32 }}>
            {ordered.map((country, i) => (
              <span
                key={country.jurisdiction.slug}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-60)",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: COUNTRY_COLORS[i],
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                {countryFlag(country.jurisdiction.iso2)} {country.jurisdiction.name}
              </span>
            ))}
          </div>

          {/* Score cards side-by-side */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${ordered.length}, 1fr)`,
              gap: 16,
              marginBottom: 32,
            }}
          >
            {ordered.map((country, i) => {
              const score = country.composite ? Math.round(country.composite.score) : null;
              const tier = score !== null ? ciTier(score) : null;
              const color = COUNTRY_COLORS[i];

              return (
                <div
                  key={country.jurisdiction.slug}
                  className="cv-card"
                  style={{ borderTop: `3px solid ${color}` }}
                >
                  {/* Country name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <CountryFlag iso2={country.jurisdiction.iso2} size={24} />
                    <Link
                      href={`/index/${country.jurisdiction.slug}`}
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--text-15)",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        textDecoration: "none",
                      }}
                    >
                      {country.jurisdiction.name}
                    </Link>
                  </div>

                  {score !== null && tier ? (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "var(--text-48, 48px)",
                            lineHeight: 1,
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {score}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: "var(--font-weight-mono)",
                            fontSize: "var(--text-13)",
                            color: "var(--color-text-30)",
                          }}
                        >
                          / 100
                        </span>
                      </div>

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          background: tier.bg,
                          color: tier.color,
                          borderRadius: "var(--radius-sm)",
                          padding: "3px 12px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: "var(--font-weight-mono)",
                          fontSize: "var(--text-11)",
                          marginBottom: 8,
                        }}
                      >
                        {tier.label}
                      </span>

                      {country.composite?.rank && country.composite.totalRanked && (
                        <p
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: "var(--font-weight-mono)",
                            fontSize: "var(--text-10)",
                            color: "var(--color-text-30)",
                            margin: "8px 0 0",
                          }}
                        >
                          Rank #{country.composite.rank} of {country.composite.totalRanked}
                        </p>
                      )}

                      {country.composite?.quarter && (
                        <p
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: "var(--font-weight-mono)",
                            fontSize: "var(--text-10)",
                            color: "var(--color-text-25)",
                            margin: "4px 0 0",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {country.composite.quarter}
                        </p>
                      )}
                    </>
                  ) : (
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: "var(--font-weight-mono)",
                        fontSize: "var(--text-13)",
                        color: "var(--color-text-40)",
                        margin: 0,
                      }}
                    >
                      No score available
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dimension comparison chart */}
          {dimensionSeries.some((s) => s.dimensions.length > 0) && (
            <div className="cv-card" style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-30)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "0 0 20px",
                }}
              >
                Dimension Breakdown
              </h2>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                {dimensionSeries.map((s) => (
                  <span
                    key={s.name}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-10)",
                      color: "var(--color-text-40)",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: s.color,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {s.name}
                  </span>
                ))}
              </div>

              <DimensionCompareChart series={dimensionSeries} />
            </div>
          )}

          {/* Multi-line history chart */}
          {historySeries.some((s) => s.data.length >= 2) && (
            <div className="cv-card" style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-30)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "0 0 8px",
                }}
              >
                CI Score History
              </h2>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                {historySeries.map((s) => (
                  <span
                    key={s.name}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-10)",
                      color: "var(--color-text-40)",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 2.5,
                        background: s.color,
                        display: "inline-block",
                        flexShrink: 0,
                        borderRadius: 2,
                      }}
                    />
                    {s.name}
                  </span>
                ))}
              </div>

              <MultiLineHistoryChart series={historySeries} />
            </div>
          )}

          {/* Footer links */}
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              borderTop: "1px solid var(--color-card-border)",
              paddingTop: 24,
            }}
          >
            {ordered.map((country) => (
              <Link
                key={country.jurisdiction.slug}
                href={`/index/${country.jurisdiction.slug}`}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-40)",
                  textDecoration: "none",
                }}
              >
                {country.jurisdiction.name} detail →
              </Link>
            ))}
            <Link
              href="/index/methodology"
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-40)",
                textDecoration: "none",
              }}
            >
              Methodology →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
