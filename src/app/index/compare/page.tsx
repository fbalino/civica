import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  getAllJurisdictions,
  compareCICountries,
  getCICountryHistory,
} from "@/lib/db/queries";
import { CIPickerRow, type SlotData, type CountryListItem } from "./CIPickerRow";
import { OverlayChart, type ChartSeries } from "./OverlayChart";

export const metadata: Metadata = {
  title: "Compare Countries — Civica Index",
  description:
    "Overlay CI or Pulse on a shared timeline. Then drill into each of the six weighted dimensions to see where countries actually differ.",
  alternates: { canonical: "https://civicaatlas.org/index/compare" },
  openGraph: {
    title: "Compare Countries — Civica Index | Civica",
    description:
      "Overlay CI or Pulse on a shared timeline. Then drill into each of the six weighted dimensions to see where countries actually differ.",
    url: "https://civicaatlas.org/index/compare",
  },
};

// Mockup tier vocabulary
function ciTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: "Exceptional", color: "#fff", bg: "var(--tier-exceptional)" };
  if (score >= 75) return { label: "Strong",      color: "#fff", bg: "var(--tier-strong)"      };
  if (score >= 50) return { label: "Mixed",       color: "#1a1208", bg: "var(--tier-mixed)"    };
  if (score >= 25) return { label: "Weak",        color: "#fff", bg: "var(--tier-weak)"        };
  return               { label: "Failed",      color: "#fff", bg: "var(--tier-failed)"     };
}

const DIMENSION_ORDER = [
  "democratic_quality",
  "rule_of_law",
  "human_development",
  "freedom_rights",
  "corruption_control",
  "stability_security",
] as const;

const DIMENSION_LABELS: Record<string, string> = {
  democratic_quality: "Democratic quality",
  rule_of_law:        "Rule of law & institutions",
  human_development:  "Human development",
  freedom_rights:     "Freedom & rights",
  corruption_control: "Corruption control",
  stability_security: "Stability & security",
};

const DIMENSION_WEIGHTS: Record<string, string> = {
  democratic_quality: "30%",
  rule_of_law:        "20%",
  human_development:  "15%",
  freedom_rights:     "15%",
  corruption_control: "10%",
  stability_security: "10%",
};

const SERIES_VARS = [
  "var(--series-a)",
  "var(--series-b)",
  "var(--series-c)",
] as const;

type CompareCIResult = Awaited<ReturnType<typeof compareCICountries>>;
type CIHistoryResult = Awaited<ReturnType<typeof getCICountryHistory>>;

// Compute head-to-head editorial callouts for country A vs country B
function buildH2H(
  nameA: string,
  nameB: string,
  dimA: { dimension: string; score: number }[],
  dimB: { dimension: string; score: number }[],
  scoreA: number,
  scoreB: number,
): { eyebrow: string; body: React.ReactNode }[] {
  const deltas: { dim: string; delta: number }[] = [];
  DIMENSION_ORDER.forEach((dim) => {
    const a = dimA.find((d) => d.dimension === dim)?.score ?? null;
    const b = dimB.find((d) => d.dimension === dim)?.score ?? null;
    if (a !== null && b !== null) deltas.push({ dim, delta: a - b });
  });

  if (deltas.length === 0) return [];

  // A's biggest leads (positive delta)
  const aLeads = [...deltas].sort((x, y) => y.delta - x.delta);
  const bLeads = [...deltas].sort((x, y) => x.delta - y.delta);

  const gap = Math.abs(scoreA - scoreB).toFixed(1);

  const cards = [];

  if (aLeads[0]?.delta > 0) {
    const top = aLeads[0];
    const label = DIMENSION_LABELS[top.dim] ?? top.dim;
    cards.push({
      eyebrow: `▲ ${nameA.toUpperCase()} LEADS`,
      body: (
        <>
          {nameA} scores <strong>{top.delta.toFixed(1)} points</strong> higher on{" "}
          <em>{label}</em>
          {Math.abs(scoreA - scoreB) >= 1
            ? `, its largest advantage — explaining most of the ${gap}-point CI gap.`
            : "."}
        </>
      ),
    });
  }

  if (bLeads[0]?.delta < 0) {
    const top = bLeads[0];
    const label = DIMENSION_LABELS[top.dim] ?? top.dim;
    const second = bLeads[1];
    cards.push({
      eyebrow: `▲ ${nameB.toUpperCase()} LEADS`,
      body: (
        <>
          {nameB} leads on <em>{label}</em> by{" "}
          <strong>{Math.abs(top.delta).toFixed(1)} points</strong>
          {second && second.delta < 0 ? (
            <>
              {" "}and on <em>{DIMENSION_LABELS[second.dim] ?? second.dim}</em> by{" "}
              <strong>{Math.abs(second.delta).toFixed(1)}</strong> — the{" "}
              {bLeads.filter((d) => d.delta < 0).length === 1 ? "only dimension" : "dimensions"} where it outranks {nameA}.
            </>
          ) : (
            "."
          )}
        </>
      ),
    });
  }

  return cards;
}

export default async function CIComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const slugA = typeof sp?.a === "string" ? sp.a : null;
  const slugB = typeof sp?.b === "string" ? sp.b : null;
  const slugC = typeof sp?.c === "string" ? sp.c : null;
  const validSlugs = [slugA, slugB, slugC].filter(Boolean) as string[];

  // Fetch all jurisdictions for the search dropdown
  let allCountries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    allCountries = await getAllJurisdictions();
  } catch {}

  const countryList: CountryListItem[] = allCountries.map((c) => ({
    slug: c.slug,
    name: c.name,
    iso2: c.iso2,
    governmentType: c.governmentType,
    continent: c.continent,
    population: c.population,
  }));

  // Fetch comparison data when at least 2 slugs are selected
  let compareData: CompareCIResult = [];
  let historyBySlug: Record<string, CIHistoryResult> = {};

  if (validSlugs.length >= 2) {
    try {
      const [cmp, ...hists] = await Promise.all([
        compareCICountries(validSlugs),
        ...validSlugs.map((s) => getCICountryHistory(s)),
      ]);
      compareData = cmp;
      validSlugs.forEach((s, i) => { historyBySlug[s] = hists[i]; });
    } catch {}
  }

  // Build ordered slot data aligned to a/b/c positions
  function buildSlot(slug: string | null): SlotData {
    if (!slug) return null;
    const found = compareData.find((c) => c.jurisdiction.slug === slug);
    const jurisdiction = found?.jurisdiction ?? allCountries.find((c) => c.slug === slug);
    if (!jurisdiction) return null;
    const composite = found?.composite ?? null;
    return {
      slug: jurisdiction.slug,
      name: jurisdiction.name,
      score: composite ? composite.score : null,
      rank: composite?.rank ?? null,
      quarter: composite?.quarter ?? null,
      governmentType: jurisdiction.governmentType ?? null,
      continent: jurisdiction.continent ?? null,
      population: jurisdiction.population ?? null,
    };
  }

  const slots: [SlotData, SlotData, SlotData] = [
    buildSlot(slugA),
    buildSlot(slugB),
    buildSlot(slugC),
  ];

  const orderedData = [slugA, slugB, slugC]
    .filter(Boolean)
    .map((slug) => compareData.find((c) => c.jurisdiction.slug === slug))
    .filter(Boolean) as CompareCIResult;

  const hasData = orderedData.length >= 2;

  // Build chart series
  const chartSeries: ChartSeries[] = orderedData.map((country, i) => {
    const slug = country.jurisdiction.slug;
    const hist = historyBySlug[slug] ?? [];
    const histArr = Array.isArray(hist) ? hist : (hist as { rows: unknown[] }).rows ?? [];
    return {
      name: country.jurisdiction.name,
      colorVar: SERIES_VARS[i] ?? SERIES_VARS[0],
      data: (histArr as { quarter: string; score: number }[]).map((h) => ({
        quarter: h.quarter,
        score: h.score,
      })),
    };
  });

  // Build dimension rows (shared DIMENSION_ORDER)
  const dimRows = DIMENSION_ORDER.map((dim) => {
    const cells = orderedData.map((country) => {
      const d = country.dimensions.find((x) => x.dimension === dim);
      return d ? Math.round(d.normalizedScore ?? 0) : null;
    });
    return { dim, cells };
  });

  // H2H callouts (A vs B only)
  const h2hCards =
    orderedData.length >= 2
      ? buildH2H(
          orderedData[0].jurisdiction.name,
          orderedData[1].jurisdiction.name,
          orderedData[0].dimensions.map((d) => ({
            dimension: d.dimension,
            score: d.normalizedScore ?? 0,
          })),
          orderedData[1].dimensions.map((d) => ({
            dimension: d.dimension,
            score: d.normalizedScore ?? 0,
          })),
          orderedData[0].composite?.score ?? 0,
          orderedData[1].composite?.score ?? 0,
        )
      : [];

  // Share URL
  const shareUrl = (() => {
    const p = new URLSearchParams();
    if (slugA) p.set("a", slugA);
    if (slugB) p.set("b", slugB);
    if (slugC) p.set("c", slugC);
    const qs = p.toString();
    return `civicaatlas.org/index/compare${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div
      className="ci-compare-page"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 40px",
      }}
    >
      {/* Hero */}
      <section style={{ padding: "64px 0 32px" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: "0.03em",
            color: "var(--color-text-30)",
            marginBottom: 20,
          }}
        >
          <Link href="/index" style={{ color: "var(--color-text-30)", textDecoration: "none" }}>
            ← Index
          </Link>{" "}
          / Compare
        </div>
        <h1
          className="ci-compare-hero-title"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 56,
            fontWeight: 400,
            letterSpacing: "-0.04em",
            lineHeight: 1.02,
            marginBottom: 12,
          }}
        >
          Compare two or three countries, side by side.
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "var(--color-text-60)",
            maxWidth: 700,
          }}
        >
          Overlay CI or Pulse on a shared timeline. Then drill into each of the six weighted
          dimensions to see where countries actually differ — not just what their headline score
          says.
        </p>
      </section>

      {/* Picker row */}
      <Suspense fallback={null}>
        <CIPickerRow
          countryList={countryList}
          slots={slots}
          selectedA={slugA}
          selectedB={slugB}
          selectedC={slugC}
        />
      </Suspense>

      {/* Prompt when 0 or 1 country selected */}
      {validSlugs.length === 0 && (
        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 14,
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
            fontWeight: 500,
            fontSize: 14,
            color: "var(--color-text-40)",
            padding: "48px 0",
          }}
        >
          Select at least one more country to compare.
        </p>
      )}

      {hasData && (
        <>
          {/* Overlay timeline chart */}
          <Suspense fallback={null}>
            <OverlayChart series={chartSeries} />
          </Suspense>

          {/* Dimension-by-dimension table */}
          <section style={{ marginBottom: 40 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-30)",
                marginBottom: 12,
              }}
            >
              DIMENSION-BY-DIMENSION · LATEST CI COMPONENTS
            </div>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 26,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                marginBottom: 24,
              }}
            >
              Where they diverge.
            </h2>

            <div
              style={{
                border: "1px solid var(--color-card-border)",
                borderRadius: 4,
                background: "var(--color-grid-bg)",
                overflow: "hidden",
                display: "grid",
                gap: 1,
              }}
            >
              {/* Header row */}
              <div
                className="ci-compare-dim-header"
                style={{
                  background: "var(--color-grid-cell)",
                  padding: "18px 28px",
                  display: "grid",
                  gridTemplateColumns: `minmax(200px, 1.3fr) repeat(${orderedData.length}, 1fr) 80px`,
                  gap: 18,
                  alignItems: "center",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--color-text-30)",
                }}
              >
                <div>Dimension</div>
                {orderedData.map((c) => (
                  <div key={c.jurisdiction.slug}>{c.jurisdiction.name}</div>
                ))}
                {/* Pad empty column(s) if fewer than 3 countries */}
                {orderedData.length < 3 && <div>Country {orderedData.length === 1 ? "B" : "C"} —</div>}
                <div style={{ textAlign: "right" }}>Weight</div>
              </div>

              {/* Dimension rows */}
              {dimRows.map(({ dim, cells }) => (
                <div
                  key={dim}
                  className="ci-compare-dim-row"
                  style={{
                    background: "var(--color-grid-cell)",
                    padding: "18px 28px",
                    display: "grid",
                    gridTemplateColumns: `minmax(200px, 1.3fr) repeat(${orderedData.length}, 1fr) 80px`,
                    gap: 18,
                    alignItems: "center",
                  }}
                >
                  {/* Dimension name */}
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: 17,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {DIMENSION_LABELS[dim] ?? dim}
                  </div>

                  {/* Score cells */}
                  {orderedData.map((_, ci) => {
                    const score = cells[ci];
                    return (
                      <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: 20,
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                            lineHeight: 1,
                            color: score !== null ? SERIES_VARS[ci] : "var(--color-text-20)",
                          }}
                        >
                          {score !== null ? score : "—"}
                        </div>
                        {score !== null && (
                          <div
                            style={{
                              height: 3,
                              background: "var(--color-divider)",
                              borderRadius: 1,
                              overflow: "hidden",
                            }}
                          >
                            <span
                              style={{
                                display: "block",
                                height: "100%",
                                width: `${score}%`,
                                background: SERIES_VARS[ci],
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Placeholder column if < 3 countries */}
                  {orderedData.length < 3 && (
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: 20,
                        color: "var(--color-text-20)",
                      }}
                    >
                      —
                    </div>
                  )}

                  {/* Weight */}
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      fontSize: 12,
                      color: "var(--color-text-30)",
                      textAlign: "right",
                    }}
                  >
                    {DIMENSION_WEIGHTS[dim] ?? ""}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Head-to-head editorial callouts */}
          {h2hCards.length > 0 && (
            <section style={{ marginBottom: 60 }}>
              <div
                className="ci-compare-h2h"
                style={{
                  display: "grid",
                  gridTemplateColumns: h2hCards.length === 2 ? "1fr 1fr" : "1fr",
                  gap: 16,
                }}
              >
                {h2hCards.map((card, i) => (
                  <div
                    key={i}
                    className="ci-compare-h2h-card"
                    style={{
                      background: "var(--color-grid-cell)",
                      border: "1px solid var(--color-card-border)",
                      borderRadius: 4,
                      padding: "28px 32px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 500,
                        fontSize: 10,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "var(--color-text-30)",
                        marginBottom: 8,
                      }}
                    >
                      {card.eyebrow}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: 22,
                        fontWeight: 400,
                        lineHeight: 1.35,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {card.body}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Footer */}
      <footer
        style={{
          marginTop: 60,
          padding: "40px 0",
          borderTop: "1px solid var(--color-divider)",
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 11,
          letterSpacing: "0.08em",
          color: "var(--color-text-30)",
        }}
      >
        <div>Civica Index v1.0 · Methodology published April 2026</div>
        {hasData && <div>Share this comparison: {shareUrl}</div>}
      </footer>
    </div>
  );
}
