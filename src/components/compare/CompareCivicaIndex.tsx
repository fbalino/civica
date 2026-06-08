import {
  V2_DIMENSIONS,
  V2_DIMENSION_LABELS,
  V2_WEIGHTS,
  type CIDimensionV2,
} from "@/lib/ci/dimensions-v2";
import { CompareTimelineOverlay } from "./CompareTimelineOverlay";
import type { compareCICountries, getCICountryHistory } from "@/lib/db/queries";
import { ciTier } from "@/lib/ci/tiers";
import { displayDimensionScore } from "@/lib/ci/normalize-v2";

/**
 * Per-dimension DISPLAY score on the v2 fixed-bound scale so /compare
 * reconciles with the country page, the public API, and the embed card.
 * Falls back to the stored legacy normalized_score only when raw value /
 * source is unavailable (then the dimension didn't reach the headline
 * either). See src/lib/ci/normalize-v2.ts.
 */
function dimDisplayScore(d: {
  normalizedScore: number | null;
  rawValue: number | null;
  sourceId: string;
}): number | null {
  const v2 = displayDimensionScore(d.rawValue, d.sourceId);
  if (v2 !== null) return v2;
  return d.normalizedScore !== null && d.normalizedScore !== undefined
    ? Number(d.normalizedScore)
    : null;
}

type CompareRow = Awaited<ReturnType<typeof compareCICountries>>[number];
type HistoryRow = Awaited<ReturnType<typeof getCICountryHistory>>;

export interface CompareCivicaIndexProps {
  ordered: CompareRow[];
  histories: HistoryRow[];
  seriesColors: string[];
}

export function CompareCivicaIndex({
  ordered,
  histories,
  seriesColors,
}: CompareCivicaIndexProps) {
  if (ordered.length === 0) return null;

  const timelineSeries = ordered.map((country, i) => {
    const hist = histories[i] ?? [];
    const arr = (Array.isArray(hist)
      ? hist
      : (hist as { rows: unknown[] }).rows ?? []) as {
      quarter: string;
      score: number;
    }[];
    return {
      name: country.jurisdiction.name,
      colorVar: seriesColors[i] ?? seriesColors[0],
      data: arr.map((h) => ({
        quarter: h.quarter,
        score: Number(h.score),
      })),
    };
  });

  const hasTimeline = timelineSeries.some((s) => s.data.length >= 2);

  // Head-to-head insights only when exactly 2 countries
  type DimRow = { dim: CIDimensionV2; values: (number | null)[] };
  const dimRows: DimRow[] = V2_DIMENSIONS.map((dim) => {
    const values = ordered.map((country) => {
      const d = country.dimensions.find((x) => x.dimension === dim);
      return d ? dimDisplayScore(d) : null;
    });
    return { dim, values };
  });

  let insightA: { country: string; dim: CIDimensionV2; delta: number } | null = null;
  let insightB: { country: string; dim: CIDimensionV2; delta: number } | null = null;

  if (ordered.length === 2) {
    const diffs = dimRows
      .map((r) => {
        const a = r.values[0];
        const b = r.values[1];
        if (a === null || b === null) return null;
        return { dim: r.dim, a, b, delta: a - b };
      })
      .filter(Boolean) as { dim: CIDimensionV2; a: number; b: number; delta: number }[];
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
    <>
      {/* Score cards row */}
      <div className="compare-ci-score-cards">
        {ordered.map((country, i) => {
          const seriesColor = seriesColors[i] ?? seriesColors[0];
          const score =
            country.composite && country.composite.score !== null
              ? Number(country.composite.score)
              : null;
          const tier = score != null ? ciTier(score) : null;
          const rank = country.composite?.rank ?? null;
          return (
            <div
              key={country.jurisdiction.slug}
              className="compare-ci-card"
              style={{ borderTopColor: seriesColor }}
            >
              <div className="compare-ci-card-country">
                {country.jurisdiction.name}
              </div>
              {score != null ? (
                <>
                  <div
                    className="compare-ci-card-score"
                    style={{ color: seriesColor }}
                  >
                    {score.toFixed(1)}
                  </div>
                  <div className="compare-ci-card-meta">
                    {tier ? tier.label : "—"}
                    {rank ? ` · rank ${rank}` : ""}
                  </div>
                </>
              ) : (
                <div className="compare-ci-card-placeholder">
                  No Civica Index score yet.<br />
                  <span style={{ opacity: 0.7 }}>Data coverage pending.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasTimeline && (
        <section className="compare-ci-timeline" aria-label="CI timeline overlay">
          <div className="compare-ci-eyebrow">CI TIMELINE · OVERLAY</div>
          <h3 className="compare-ci-heading">
            {ordered.map((o) => o.jurisdiction.name).join(" vs. ")}
          </h3>
          <CompareTimelineOverlay series={timelineSeries} />
          <div className="compare-ci-legend">
            {timelineSeries.map((s) => (
              <span key={s.name}>
                <span
                  className="compare-ci-legend-swatch"
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

      <section aria-labelledby="compare-ci-dim-title">
        <div className="compare-ci-eyebrow">
          DIMENSION-BY-DIMENSION · LATEST CI COMPONENTS
        </div>
        <h3 id="compare-ci-dim-title" className="compare-ci-heading">
          Where they diverge.
        </h3>
        <div className="dim-compare">
          <div className="dim-compare-header">
            <div>Dimension</div>
            {ordered.map((o, i) => (
              <div key={o.jurisdiction.slug}>
                {o.jurisdiction.name}
                <span
                  className="hdr-dot"
                  style={{ background: seriesColors[i] }}
                />
              </div>
            ))}
            {ordered.length < 3 &&
              Array.from({ length: 3 - ordered.length }).map((_, i) => (
                <div key={`empty-${i}`} style={{ color: "var(--color-text-20)" }}>
                  Country {["A", "B", "C"][ordered.length + i]} —
                </div>
              ))}
            <div style={{ textAlign: "right" }}>Weight</div>
          </div>
          {V2_DIMENSIONS.map((dim) => {
            const weight = Math.round(V2_WEIGHTS[dim] * 100);
            return (
              <div key={dim} className="dim-compare-row">
                <div className="dim-name">{V2_DIMENSION_LABELS[dim]}</div>
                {ordered.map((country, i) => {
                  const d = country.dimensions.find(
                    (x) => x.dimension === dim
                  );
                  const val = d ? dimDisplayScore(d) : null;
                  const color = seriesColors[i] ?? seriesColors[0];
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
                        <div
                          className="val"
                          style={{ color: "var(--color-text-20)" }}
                        >
                          —
                        </div>
                      )}
                    </div>
                  );
                })}
                {ordered.length < 3 &&
                  Array.from({ length: 3 - ordered.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="dim-compare-cell">
                      <div
                        className="val"
                        style={{ color: "var(--color-text-20)" }}
                      >
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
              <div className="h2h-eyebrow">
                ▲ {insightA.country.toUpperCase()} LEADS
              </div>
              <div className="h2h-body">
                {insightA.country} scores{" "}
                <strong>{insightA.delta.toFixed(1)} points</strong> higher on{" "}
                <em>{V2_DIMENSION_LABELS[insightA.dim]}</em>, its largest advantage
                in this matchup.
              </div>
            </article>
          )}
          {insightB && (
            <article className="h2h-card">
              <div className="h2h-eyebrow">
                ▲ {insightB.country.toUpperCase()} LEADS
              </div>
              <div className="h2h-body">
                {insightB.country} leads on{" "}
                <em>{V2_DIMENSION_LABELS[insightB.dim]}</em> by{" "}
                <strong>{insightB.delta.toFixed(1)} points</strong> — its
                biggest win across the {V2_DIMENSIONS.length} dimensions.
              </div>
            </article>
          )}
        </section>
      )}
    </>
  );
}
