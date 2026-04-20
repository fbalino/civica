"use client";

import { useEffect, useState } from "react";
import { classifyGovernment } from "@/lib/data/government-category";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeerStats {
  metricId: string;
  peerCount: number;
  peerMin: number;
  peerMedian: number;
  peerMax: number;
}

interface MetricRow {
  metricId: string;
  name: string;
  category: string;
  unit: string | null;
  higherIsBetter: boolean;
  value: number;
  asOfYear: number;
  rank: number | null;
  totalRanked: number | null;
  isStale: boolean;
  peer: PeerStats | null;
}

interface OutcomesPayload {
  countryId: string;
  countrySlug: string;
  countryName: string;
  govType: string | null;
  year: number;
  metrics: MetricRow[];
}

export interface CountryOutcomeBarsProps {
  slug: string;
  countryName: string;
  year?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ordinal(n: number): string {
  const abs = Math.abs(n);
  const suffix =
    abs % 100 >= 11 && abs % 100 <= 13
      ? "th"
      : abs % 10 === 1
      ? "st"
      : abs % 10 === 2
      ? "nd"
      : abs % 10 === 3
      ? "rd"
      : "th";
  return `${n}${suffix}`;
}

function generateDek(m: MetricRow, govType: string | null): string {
  if (!m.rank || !m.peer) return "";
  const direction = m.higherIsBetter
    ? m.value > m.peer.peerMedian
      ? "above"
      : "below"
    : m.value < m.peer.peerMedian
    ? "above"
    : "below";
  const govLabel = classifyGovernment(govType).label.toLowerCase();
  return `Ranks ${ordinal(m.rank)} of ${m.totalRanked} countries on ${m.name}, ${direction} the ${govLabel} median.`;
}

function toPercent(v: number, rangeMin: number, rangeMax: number): number {
  if (rangeMax === rangeMin) return 50;
  return Math.max(0, Math.min(100, ((v - rangeMin) / (rangeMax - rangeMin)) * 100));
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 0",
        borderBottom: "1px solid var(--color-stat-border)",
      }}
    >
      {/* label + badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            height: 14,
            width: "30%",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-card-border)",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            height: 12,
            width: "12%",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-card-border)",
            opacity: 0.5,
          }}
        />
      </div>
      {/* track */}
      <div
        style={{
          height: 20,
          width: "100%",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-card-border)",
          opacity: 0.3,
        }}
      />
      {/* dek */}
      <div
        style={{
          height: 11,
          width: "75%",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-card-border)",
          opacity: 0.35,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single metric row
// ---------------------------------------------------------------------------

interface MetricBarRowProps {
  metric: MetricRow;
  govType: string | null;
  govColor: string;
}

function MetricBarRow({ metric: m, govType, govColor }: MetricBarRowProps) {
  const peer = m.peer;

  // Build positioning values only when we have peer data
  let peerBandLeft = 0;
  let peerBandWidth = 0;
  let countryBarLeft = 0;
  let countryBarRight: number | undefined = undefined;
  let medianLeft = 0;
  let rangeMin = 0;
  let rangeMax = 1;

  if (peer) {
    rangeMin = peer.peerMin * 0.95;
    rangeMax = peer.peerMax * 1.05;

    const minPct = toPercent(peer.peerMin, rangeMin, rangeMax);
    const maxPct = toPercent(peer.peerMax, rangeMin, rangeMax);
    peerBandLeft = minPct;
    peerBandWidth = maxPct - minPct;

    medianLeft = toPercent(peer.peerMedian, rangeMin, rangeMax);
    const valuePct = toPercent(m.value, rangeMin, rangeMax);

    if (m.higherIsBetter) {
      // bar grows from left; width = valuePct
      countryBarLeft = 0;
      // we'll use width instead of right for higherIsBetter
    } else {
      // lower is better: bar grows from right edge
      countryBarRight = 100 - valuePct;
    }
    countryBarLeft = m.higherIsBetter ? 0 : valuePct;
  }

  const dek = generateDek(m, govType);

  // Peer band bg: gov color at 20% opacity via color-mix
  const peerBandBg = `color-mix(in oklab, ${govColor} 20%, transparent)`;
  // Country bar: gov color at 60% opacity
  const countryBarBg = `color-mix(in oklab, ${govColor} 60%, transparent)`;
  // Median tick: gov color at 80% opacity
  const medianColor = `color-mix(in oklab, ${govColor} 80%, transparent)`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "12px 0",
        borderBottom: "1px solid var(--color-stat-border)",
      }}
    >
      {/* Row 1: label + rank badge */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-14)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {m.name}
          {m.unit && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
                fontSize: "var(--text-11)",
                color: "var(--color-text-40)",
                marginLeft: 4,
              }}
            >
              ({m.unit})
            </span>
          )}
        </span>

        {m.rank && m.totalRanked ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--text-11)",
              color: "var(--color-text-50)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {ordinal(m.rank)} of {m.totalRanked}
            {m.isStale && (
              <span style={{ color: "var(--color-text-30)", marginLeft: 4 }}>
                (est.&nbsp;{m.asOfYear})
              </span>
            )}
          </span>
        ) : m.isStale ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--text-11)",
              color: "var(--color-text-30)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            est.&nbsp;{m.asOfYear}
          </span>
        ) : null}
      </div>

      {/* Row 2: bar track */}
      <div
        style={{
          position: "relative",
          height: 20,
          width: "100%",
          background: "var(--color-card-border)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
        role="img"
        aria-label={`${m.name}: value ${m.value}${m.unit ? ` ${m.unit}` : ""}`}
      >
        {peer ? (
          <>
            {/* Peer band — 8px tall, vertically centered */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                left: `${peerBandLeft}%`,
                width: `${peerBandWidth}%`,
                height: 8,
                background: peerBandBg,
                borderRadius: 2,
              }}
            />

            {/* Country value bar — full track height */}
            {m.higherIsBetter ? (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: `${toPercent(m.value, rangeMin, rangeMax)}%`,
                  height: "100%",
                  background: countryBarBg,
                  borderRadius: "var(--radius-sm)",
                }}
              />
            ) : (
              /* lower-is-better: fill from the right */
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: `${100 - toPercent(m.value, rangeMin, rangeMax)}%`,
                  height: "100%",
                  background: countryBarBg,
                  borderRadius: "var(--radius-sm)",
                }}
              />
            )}

            {/* Peer median tick — 2px wide, full height */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: `${medianLeft}%`,
                width: 2,
                height: "100%",
                background: medianColor,
                transform: "translateX(-50%)",
              }}
            />
          </>
        ) : (
          /* No peer data: just render the raw value bar at 50% width */
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "50%",
              height: "100%",
              background: countryBarBg,
              borderRadius: "var(--radius-sm)",
              opacity: 0.5,
            }}
          />
        )}
      </div>

      {/* Row 3: dek sentence */}
      {dek && (
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body-sans)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-60)",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {dek}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CountryOutcomeBars({
  slug,
  countryName,
  year,
}: CountryOutcomeBarsProps) {
  const [data, setData] = useState<OutcomesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    const currentYear = year ?? new Date().getFullYear();
    const url = `/api/countries/${slug}/outcomes?year=${currentYear}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load outcomes (${res.status})`);
        return res.json() as Promise<OutcomesPayload>;
      })
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
  }, [slug, year]);

  const govColor = data
    ? classifyGovernment(data.govType).color
    : "var(--color-accent)";

  const firstMetricId = data?.metrics[0]?.metricId ?? "";

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section
        style={{
          maxHeight: "80vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-16)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            marginBottom: 8,
          }}
        >
          Outcomes
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </section>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <section
        style={{
          maxHeight: "80vh",
          overflowY: "auto",
          padding: "16px 0",
          fontFamily: "var(--font-body-sans)",
          fontSize: "var(--text-13)",
          color: "var(--color-text-40)",
        }}
      >
        Unable to load outcomes data.
      </section>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!data || data.metrics.length === 0) {
    return (
      <section
        style={{
          maxHeight: "80vh",
          overflowY: "auto",
          padding: "16px 0",
          fontFamily: "var(--font-body-sans)",
          fontSize: "var(--text-13)",
          color: "var(--color-text-40)",
        }}
      >
        No outcomes data available for {countryName}.
      </section>
    );
  }

  // ── Happy path ─────────────────────────────────────────────────────────────
  return (
    <section
      style={{
        maxHeight: "80vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Section heading */}
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-16)",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          marginBottom: 4,
        }}
      >
        Outcomes
      </div>

      {/* Gov-type legend line */}
      {data.govType && (
        <p
          style={{
            margin: "0 0 12px 0",
            fontFamily: "var(--font-body-sans)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          Compared to{" "}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
              color: govColor,
            }}
          >
            {classifyGovernment(data.govType).label.toLowerCase()}
          </span>{" "}
          peers &middot; {data.year}
        </p>
      )}

      {/* Metric rows */}
      <div style={{ flex: 1 }}>
        {data.metrics.map((m) => (
          <MetricBarRow
            key={m.metricId}
            metric={m}
            govType={data.govType}
            govColor={govColor}
          />
        ))}
      </div>

      {/* CTA */}
      <div
        style={{
          paddingTop: 16,
          marginTop: 4,
        }}
      >
        <a
          href={`/outcomes${firstMetricId ? `?metric=${firstMetricId}` : ""}`}
          style={{
            fontFamily: "var(--font-body-sans)",
            fontSize: "var(--text-13)",
            color: "var(--color-accent)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Compare across all countries
          <span aria-hidden="true" style={{ fontSize: "var(--text-13)" }}>
            &rarr;
          </span>
        </a>
      </div>
    </section>
  );
}
