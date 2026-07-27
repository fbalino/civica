"use client";

import { useEffect, useMemo, useReducer } from "react";
import { classifyGovernment } from "@/lib/data/government-category";
import { Tooltip } from "@/components/editorial/Tooltip";
import styles from "./CountryOutcomeBars.module.css";
import {
  outcomesReducer,
  type MetricRow,
  type OutcomesAction,
  type OutcomesPayload,
  type OutcomesState,
  type PeerStats,
} from "./outcomesReducer";

// Re-exported so `outcomesReducer` (+ its state/action types) is still
// available from this module for any existing caller. The actual
// implementation lives in `./outcomesReducer` — see that file's header
// comment for why (CSS Module imports here block Node's native test
// runner from importing this file directly).
export { outcomesReducer };
export type { OutcomesState, OutcomesAction };

export interface CountryOutcomeBarsProps {
  slug: string;
  countryName: string;
  year?: number;
  /**
   * When false, hides any "trend"-style chrome (e.g. stale-year badge,
   * future trend column). The factbook shim sets this to false to match
   * the cleaner reader layout. Defaults to true to preserve the
   * `/countries/[slug]` Outcomes tab visual.
   */
  showTrend?: boolean;
}

// ─── Neutral peer position ──────────────────────────────────────────────────

interface PeerPosition {
  label: string;
}

/**
 * Describe a country's relative location for a given metric.
 *
 * Preferred path: rank-based percentile (rank / totalRanked). Rank is
 * stored 1-best in `country_metrics` regardless of higherIsBetter — the
 * scoring upstream already inverts for "lower is better" metrics.
 *
 * Fallback: value vs (peerMin / peerMedian / peerMax) when rank is
 * unavailable. We classify above-median vs below-median, then split each
 * half at the midpoint to peerMin/peerMax to approximate quartiles.
 *
 * Direction is honoured throughout: for `higherIsBetter: false` metrics
 * (e.g. child mortality), a value below the peer median earns the
 * upper peer position.
 */
function classifyPeerPosition(m: MetricRow): PeerPosition | null {
  if (!m.peer) return null;

  // Rank-based path (preferred — covers most CI / outcome metrics).
  if (m.rank && m.totalRanked && m.totalRanked > 0) {
    const pct = m.rank / m.totalRanked; // 0..1, lower is better
    if (pct <= 0.25)
      return { label: "Top quartile" };
    if (pct <= 0.5)
      return { label: "Above peer median" };
    if (pct <= 0.75)
      return { label: "Below peer median" };
    return { label: "Bottom quartile" };
  }

  // Value-based fallback (when rank is null, e.g. only a peer-group of <5).
  const { peerMin, peerMedian, peerMax } = m.peer;
  const v = m.value;

  // Better-than-median midpoint — halfway between median and the "good" extreme.
  const goodExtreme = m.higherIsBetter ? peerMax : peerMin;
  const badExtreme = m.higherIsBetter ? peerMin : peerMax;
  const goodHalf = (peerMedian + goodExtreme) / 2;
  const badHalf = (peerMedian + badExtreme) / 2;

  const isBetter = m.higherIsBetter ? v >= peerMedian : v <= peerMedian;

  if (isBetter) {
    const beyondGoodHalf = m.higherIsBetter ? v >= goodHalf : v <= goodHalf;
    return beyondGoodHalf
      ? { label: "Top quartile" }
      : { label: "Above peer median" };
  }

  const beyondBadHalf = m.higherIsBetter ? v <= badHalf : v >= badHalf;
  return beyondBadHalf
    ? { label: "Bottom quartile" }
    : { label: "Below peer median" };
}

// ─── Category grouping ──────────────────────────────────────────────────────

/**
 * Friendly labels for `metric_definitions.category` slugs. Anything not in
 * this map falls back to title-cased category text. Keep this small —
 * the list is curated by the schema, not user-generated.
 */
const CATEGORY_LABEL: Record<string, string> = {
  health: "Health",
  wealth: "Wealth & Economy",
  economy: "Wealth & Economy",
  peace: "Peace & Stability",
  stability: "Peace & Stability",
  governance: "Governance",
  freedom: "Rights & Freedoms",
  rights: "Rights & Freedoms",
  education: "Education",
  environment: "Environment",
  inequality: "Equality",
  development: "Human Development",
};

function prettyCategory(raw: string): string {
  if (!raw) return "Other";
  const key = raw.toLowerCase().trim();
  if (CATEGORY_LABEL[key]) return CATEGORY_LABEL[key];
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function formatNumber(v: number): string {
  if (v >= 10_000)
    return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1_000)
    return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 100)
    return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (v >= 10)
    return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return v.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function generateDek(
  m: MetricRow,
  govType: string | null
): React.ReactNode | null {
  if (!m.peer) return null;
  const govLabel = classifyGovernment(govType).label.toLowerCase();
  const medianFmt = formatNumber(m.peer.peerMedian);
  const valueFmt = formatNumber(m.value);

  const aboveBelow = m.higherIsBetter
    ? m.value >= m.peer.peerMedian
      ? "above"
      : "below"
    : m.value <= m.peer.peerMedian
    ? "above"
    : "below";

  if (m.rank && m.totalRanked) {
    return (
      <>
        <b>{valueFmt}</b> on {m.name} — {aboveBelow} the {govLabel} peer median
        of {medianFmt}, ranking {ordinal(m.rank)} of {m.totalRanked} peers.
      </>
    );
  }

  return (
    <>
      <b>{valueFmt}</b> on {m.name} is {aboveBelow} the {govLabel} peer median
      of {medianFmt}.
    </>
  );
}

// ─── Rail position calculation ───────────────────────────────────────────────

interface RailPos {
  peerLoPct: number;
  peerHiPct: number;
  medianPct: number;
  valuePct: number;
  isOutsideLow: boolean;
  isOutsideHigh: boolean;
}

function computePositions(value: number, peer: PeerStats): RailPos {
  const { peerMin, peerMedian, peerMax } = peer;
  const span = Math.max(peerMax - peerMin, 1e-9);
  const pad = 0.12 * span;
  const railLo = peerMin - pad;
  const railHi = peerMax + pad;
  const toPct = (v: number) => ((v - railLo) / (railHi - railLo)) * 100;

  const peerLoPct = toPct(peerMin);
  const peerHiPct = toPct(peerMax);
  const medianPct = toPct(peerMedian);
  const valuePct = toPct(value);

  return {
    peerLoPct,
    peerHiPct,
    medianPct,
    valuePct,
    isOutsideLow: valuePct < 2,
    isOutsideHigh: valuePct > 98,
  };
}

// ─── SVG arrows ──────────────────────────────────────────────────────────────

function ArrowUp() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M1 7 L5 3 L9 7"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M1 3 L5 7 L9 3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  const pulse: React.CSSProperties = {
    borderRadius: 2,
    background: "var(--color-stat-border)",
    opacity: 0.45,
  };
  return (
    <div className={styles.cob__row}>
      <div className={styles.cob__meta}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ ...pulse, height: 18, width: "42%" }} />
          <div style={{ ...pulse, height: 10, width: "18%", opacity: 0.25 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ ...pulse, height: 22, width: 52 }} />
          <div style={{ ...pulse, height: 18, width: 76, opacity: 0.25 }} />
        </div>
      </div>
      <div
        style={{
          ...pulse,
          height: 44,
          width: "100%",
          marginTop: 8,
          opacity: 0.2,
        }}
      />
      <div
        style={{
          ...pulse,
          height: 17,
          width: "68%",
          marginTop: 32,
          opacity: 0.2,
        }}
      />
    </div>
  );
}

// ─── Single metric row ───────────────────────────────────────────────────────

interface MetricBarRowProps {
  metric: MetricRow;
  govType: string | null;
  showTrend: boolean;
}

function MetricBarRow({ metric: m, govType, showTrend }: MetricBarRowProps) {
  const noData = m.peer === null;
  const pos = m.peer ? computePositions(m.value, m.peer) : null;
  const peerPosition = classifyPeerPosition(m);
  const dek = noData
    ? "Not reported for this country in any source we have loaded."
    : generateDek(m, govType);

  // Government-type peer accent — drives the row's left border colour
  // when peer comparison is "vs same-government-type peers".
  const govAccent = govType ? classifyGovernment(govType).color : null;

  // Compose the inline CSS variable bag the row uses for positioning and the
  // government-type accent stripe. Score position itself stays neutral.
  const chartStyle: React.CSSProperties = pos
    ? {
        "--peer-lo": `${pos.peerLoPct.toFixed(2)}%`,
        "--peer-hi": `${pos.peerHiPct.toFixed(2)}%`,
        "--peer-median": `${pos.medianPct.toFixed(2)}%`,
        "--pos": pos.isOutsideLow
          ? "2%"
          : pos.isOutsideHigh
          ? "98%"
          : `${pos.valuePct.toFixed(2)}%`,
      } as React.CSSProperties
    : ({
        "--peer-lo": "15%",
        "--peer-hi": "85%",
        "--peer-median": "50%",
        "--pos": "50%",
      } as React.CSSProperties);

  const rowStyle: React.CSSProperties = {
    ...(govAccent
      ? ({ "--gov-accent": govAccent } as React.CSSProperties)
      : {}),
  };

  const markerClass = [
    styles.cob__marker,
    pos?.isOutsideLow ? styles["cob__marker--outside-low"] : "",
    pos?.isOutsideHigh ? styles["cob__marker--outside-high"] : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rowClass = [
    styles.cob__row,
    noData ? styles["cob__row--no-data"] : "",
    govAccent ? styles["cob__row--gov-accent"] : "",
  ]
    .filter(Boolean)
    .join(" ");

  const valueFmt = noData ? "—" : formatNumber(m.value);

  return (
    <article className={rowClass} style={rowStyle} aria-label={m.name}>
      {/* Meta line */}
      <div className={styles.cob__meta}>
        <div>
          <span className={styles.cob__name}>{m.name}</span>
          {m.unit && <span className={styles.cob__unit}>{m.unit}</span>}
          {!noData && (
            <Tooltip
              content={
                m.higherIsBetter
                  ? "Higher value is better"
                  : "Lower value is better"
              }
            >
              <span className={styles.cob__direction}>
                {m.higherIsBetter ? <ArrowUp /> : <ArrowDown />}
                {m.higherIsBetter ? "Higher is better" : "Lower is better"}
              </span>
            </Tooltip>
          )}
        </div>
        <div className={styles.cob__value}>
          <span className={styles.cob__number}>{valueFmt}</span>
          {showTrend && m.isStale && !noData && (
            <Tooltip content={`Most recent datapoint is from ${m.asOfYear}`}>
              <span className={styles.cob__stale}>
                Stale · {m.asOfYear}
              </span>
            </Tooltip>
          )}
          {noData ? (
            <span className={styles.cob__rank}>No data</span>
          ) : peerPosition ? (
            <Tooltip
              content={`${peerPosition.label}${
                m.rank && m.totalRanked
                  ? ` · ranked ${m.rank} of ${m.totalRanked} peers`
                  : ""
              }`}
            >
              <span className={styles.cob__verdict}>
                <span className={styles.cob__verdictLabel}>{peerPosition.label}</span>
                {m.rank && m.totalRanked && (
                  <>
                    <span className={styles.cob__verdictSep}>·</span>
                    <span className={styles.cob__verdictRank}>
                      {m.rank}/{m.totalRanked}
                    </span>
                  </>
                )}
              </span>
            </Tooltip>
          ) : m.peer && m.peer.peerCount < 5 ? (
            <span className={styles.cob__rank}>
              Peer group · <b>{m.peer.peerCount}</b>
            </span>
          ) : null}
        </div>
      </div>

      {/* Chart rail */}
      <div className={styles.cob__chart} style={chartStyle}>
        <div className={styles.cob__rail} />
        <div className={styles.cob__band} aria-hidden="true" />
        {!noData && pos && (
          <>
            <div className={styles.cob__median} aria-hidden="true" />
            <div className={styles["cob__median-label"]}>
              Peer median · {formatNumber(m.peer!.peerMedian)}
            </div>
            <div className={markerClass} aria-hidden="true" />
          </>
        )}
        <div className={styles.cob__axis}>
          <span>
            {noData ? "—" : `Peer low · ${formatNumber(m.peer!.peerMin)}`}
          </span>
          <span>
            {noData ? "—" : `Peer high · ${formatNumber(m.peer!.peerMax)}`}
          </span>
        </div>
      </div>

      {/* Dek */}
      {dek && <p className={styles.cob__dek}>{dek}</p>}
    </article>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CountryOutcomeBars({
  slug,
  countryName,
  year,
  showTrend = true,
}: CountryOutcomeBarsProps) {
  const [{ data, loading, error }, dispatch] = useReducer(outcomesReducer, {
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    dispatch({ type: "start" });

    const currentYear = year ?? new Date().getFullYear();
    fetch(`/api/countries/${slug}/outcomes?year=${currentYear}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load outcomes (${res.status})`);
        return res.json() as Promise<OutcomesPayload>;
      })
      .then((payload) => {
        if (!cancelled) {
          dispatch({ type: "success", payload });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          dispatch({
            type: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug, year]);

  const govLabel = data
    ? classifyGovernment(data.govType).label.toLowerCase()
    : null;
  const firstMetricId = data?.metrics[0]?.metricId ?? "";

  // Group metrics by category. Preserve first-occurrence order so the
  // visual sequence still reflects what the API returned (it's sorted
  // upstream by definition order).
  const grouped = useMemo(() => {
    if (!data) return [] as Array<{ label: string; rows: MetricRow[] }>;
    const order: string[] = [];
    const buckets = new Map<string, MetricRow[]>();
    for (const m of data.metrics) {
      const key = (m.category || "other").toLowerCase();
      if (!buckets.has(key)) {
        buckets.set(key, []);
        order.push(key);
      }
      buckets.get(key)!.push(m);
    }
    return order.map((key) => ({
      label: prettyCategory(key),
      rows: buckets.get(key)!,
    }));
  }, [data]);

  // Show group headers only when we have at least 2 distinct categories —
  // otherwise the header is just visual noise.
  const showGroupHeaders = grouped.length >= 2;

  // Accessible SR table (visually hidden)
  const srTable =
    !loading && !error && data && data.metrics.length > 0 ? (
      <table
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        <caption>
          Outcomes for {data.countryName} vs. {govLabel} peers · {data.year}
        </caption>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Peer min</th>
            <th>Peer median</th>
            <th>Peer max</th>
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          {data.metrics.map((m) => (
            <tr key={m.metricId}>
              <td>{m.name}</td>
              <td>{m.peer ? formatNumber(m.value) : "No data"}</td>
              <td>{m.peer ? formatNumber(m.peer.peerMin) : "—"}</td>
              <td>{m.peer ? formatNumber(m.peer.peerMedian) : "—"}</td>
              <td>{m.peer ? formatNumber(m.peer.peerMax) : "—"}</td>
              <td>
                {m.rank && m.totalRanked
                  ? `${m.rank} of ${m.totalRanked}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : null;

  // Loading
  if (loading) {
    return (
      <section
        className={styles.cob}
        aria-label={`Outcomes for ${countryName}`}
        aria-busy="true"
      >
        <header className={styles.cob__header}>
          <h2 className={styles.cob__title}>Outcomes</h2>
        </header>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </section>
    );
  }

  // Error
  if (error) {
    return (
      <section
        className={styles.cob}
        aria-label={`Outcomes for ${countryName}`}
        style={{ padding: "16px 0" }}
      >
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--color-text-40)",
          }}
        >
          Unable to load outcomes data.
        </p>
      </section>
    );
  }

  // Empty
  if (!data || data.metrics.length === 0) {
    return (
      <section
        className={styles.cob}
        aria-label={`Outcomes for ${countryName}`}
        style={{ padding: "16px 0" }}
      >
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--color-text-40)",
          }}
        >
          No outcomes data available for {countryName}.
        </p>
      </section>
    );
  }

  // Happy path
  return (
    <section
      className={styles.cob}
      aria-label={`Outcomes for ${data.countryName} vs. ${govLabel ?? "peer"} peers`}
      style={{ position: "relative" }}
    >
      {srTable}

      <header className={styles.cob__header}>
        <h2 className={styles.cob__title}>Outcomes</h2>
        {data.govType && (
          <div className={styles.cob__eyebrow}>
            Compared to <b>{govLabel}</b> peers · {data.year}
          </div>
        )}
      </header>

      {showGroupHeaders
        ? grouped.map((group) => (
            <div key={group.label} className={styles.cob__group}>
              <h3 className={styles.cob__groupHeader}>{group.label}</h3>
              {group.rows.map((m) => (
                <MetricBarRow
                  key={m.metricId}
                  metric={m}
                  govType={data.govType}
                  showTrend={showTrend}
                />
              ))}
            </div>
          ))
        : data.metrics.map((m) => (
            <MetricBarRow
              key={m.metricId}
              metric={m}
              govType={data.govType}
              showTrend={showTrend}
            />
          ))}

      <footer className={styles.cob__footer}>
        <a href={`/civica-conditions${firstMetricId ? `?metric=${firstMetricId}` : ""}`}>
          Compare across all countries →
        </a>
      </footer>
    </section>
  );
}
