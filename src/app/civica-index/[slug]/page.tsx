import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCICountryDetail,
  getCICountryHistory,
  getPulseChangelog,
} from "@/lib/db/queries";
import {
  CIPulseScoreDisplay,
  type CIScoreData,
  type PulseScoreData,
} from "@/components/ci/CIPulseScoreDisplay";
import { CountryFlag } from "@/components/CountryFlag";
import { SourceDot } from "@/components/SourceDot";
import { ciTier as ciTierCanonical } from "@/lib/ci/tiers";

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

function ciTier(score: number): { label: string; color: string; bg: string } {
  const info = ciTierCanonical(score);
  return {
    label: info.label,
    color: score >= 50 && score < 75 ? "#1a1208" : "#fff",
    bg: info.cssVar,
  };
}

function dimensionColor(score: number): string {
  return ciTierCanonical(score).cssVar;
}

function pulseImpactColor(impact: number): string {
  if (impact > 2) return "var(--color-danger, oklch(52% 0.20 25))";
  if (impact > 0) return "oklch(60% 0.17 45)";
  if (impact < -2) return "oklch(52% 0.18 145)";
  if (impact < 0) return "oklch(65% 0.17 85)";
  return "var(--color-text-30)";
}

function formatQuarter(q: string): string {
  // "2024-Q3" → "Q3 '24"
  const m = q.match(/^(\d{4})-Q(\d)$/);
  if (!m) return q;
  return `Q${m[2]} '${m[1].slice(2)}`;
}

function HistoryChart({
  history,
}: {
  history: { quarter: string; score: number; rank: number | null }[];
}) {
  if (history.length < 2) return null;

  const W = 680;
  const H = 160;
  const PAD = { top: 16, right: 24, bottom: 32, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const scores = history.map((h) => h.score);
  const minScore = Math.max(0, Math.floor(Math.min(...scores) / 10) * 10 - 10);
  const maxScore = Math.min(100, Math.ceil(Math.max(...scores) / 10) * 10 + 10);
  const scoreRange = maxScore - minScore || 1;

  const xStep = chartW / (history.length - 1);

  function xAt(i: number) {
    return PAD.left + i * xStep;
  }
  function yAt(score: number) {
    return PAD.top + chartH - ((score - minScore) / scoreRange) * chartH;
  }

  const pathD = history
    .map((h, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(h.score).toFixed(1)}`)
    .join(" ");

  const areaD =
    pathD +
    ` L${xAt(history.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)}` +
    ` L${xAt(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks = [minScore, minScore + Math.round(scoreRange / 2), maxScore];

  // X-axis labels: show first, last, and up to 2 middle labels
  const xLabelIndices = new Set<number>([0, history.length - 1]);
  if (history.length > 4) {
    xLabelIndices.add(Math.round(history.length / 3));
    xLabelIndices.add(Math.round((2 * history.length) / 3));
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-label="Historical CI score chart"
    >
      <defs>
        <linearGradient id="ci-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(55% 0.18 245)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="oklch(55% 0.18 245)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            y1={yAt(tick)}
            x2={PAD.left + chartW}
            y2={yAt(tick)}
            stroke="currentColor"
            strokeOpacity="0.07"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 6}
            y={yAt(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="10"
            fontFamily="var(--font-mono)"
            fill="currentColor"
            fillOpacity="0.35"
          >
            {tick}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaD} fill="url(#ci-area-grad)" />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="oklch(55% 0.18 245)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {history.map((h, i) => (
        <circle
          key={h.quarter}
          cx={xAt(i)}
          cy={yAt(h.score)}
          r="3"
          fill="oklch(55% 0.18 245)"
        />
      ))}

      {/* X-axis labels */}
      {history.map((h, i) =>
        xLabelIndices.has(i) ? (
          <text
            key={`xl-${h.quarter}`}
            x={xAt(i)}
            y={PAD.top + chartH + 16}
            textAnchor="middle"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fill="currentColor"
            fillOpacity="0.35"
          >
            {formatQuarter(h.quarter)}
          </text>
        ) : null
      )}
    </svg>
  );
}

function DimensionBars({
  dimensions,
}: {
  dimensions: { dimension: string; normalizedScore: number; sourceId: string }[];
}) {
  const sorted = DIMENSION_ORDER.map((dim) =>
    dimensions.find((d) => d.dimension === dim)
  ).filter(Boolean) as typeof dimensions;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map((d) => {
        const score = Math.round(d.normalizedScore);
        const color = dimensionColor(score);
        return (
          <div key={d.dimension}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-50)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {DIMENSION_LABELS[d.dimension] ?? d.dimension}
                <SourceDot
                  source={d.sourceId}
                  retrievedAt={new Date().toISOString().slice(0, 10)}
                />
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-primary)",
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                {score}
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--color-card-border)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${score}%`,
                  height: "100%",
                  background: color,
                  borderRadius: 3,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type PulseEvent = {
  id: string;
  eventDate: string;
  category: string;
  severity: number;
  headline: string;
  sourceUrl: string | null;
  sourceName: string | null;
  isActive: boolean;
};

function PulseEventRow({ event, index, total }: { event: PulseEvent; index: number; total: number }) {
  const severitySign = event.severity >= 0 ? "+" : "";
  const isLast = index === total - 1;
  const inner = (
    <div
      style={{
        padding: "12px 0",
        borderBottom: isLast ? "none" : "1px solid var(--color-stat-border, var(--color-card-border))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-10)",
            color: pulseImpactColor(event.severity),
            flexShrink: 0,
            minWidth: 32,
            paddingTop: 2,
          }}
        >
          {severitySign}{event.severity.toFixed(1)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-body-sans, var(--font-body))",
              fontSize: "var(--text-13)",
              color: "var(--color-text-primary)",
              lineHeight: "var(--leading-snug)",
              display: "block",
            }}
          >
            {event.headline}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-10)",
              color: "var(--color-text-30)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 3,
            }}
          >
            <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {event.category}
            </span>
            <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
            <span>{new Date(event.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            {event.sourceName && (
              <>
                <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                <span>{event.sourceName}</span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );

  if (event.sourceUrl) {
    return (
      <a
        key={event.id}
        href={event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        {inner}
      </a>
    );
  }
  return <div key={event.id}>{inner}</div>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let detail: Awaited<ReturnType<typeof getCICountryDetail>> = null;
  try {
    detail = await getCICountryDetail(slug);
  } catch {}
  if (!detail) return { title: "Country Not Found — Civica Index" };

  const name = detail.jurisdiction.name;
  const score = detail.composite ? Math.round(detail.composite.score) : null;
  const tier = score !== null ? ciTier(score).label : null;
  const title = `${name} — Civica Index Score${score !== null ? ` (${score})` : ""}`;
  const description = `${name}'s Civica Index governance score${score !== null ? ` is ${score}/100 (${tier} tier)` : ""}. View dimension breakdown, history, and Civica Pulse score.`;
  const url = `https://civicaatlas.org/civica-index/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Civica`, description, url },
  };
}

export default async function CICountryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const quarter = typeof sp?.quarter === "string" ? sp.quarter : undefined;

  let detail: Awaited<ReturnType<typeof getCICountryDetail>> = null;
  let history: Awaited<ReturnType<typeof getCICountryHistory>> = [];
  let pulseEvents: PulseEvent[] = [];

  try {
    [detail, history] = await Promise.all([
      getCICountryDetail(slug, quarter),
      getCICountryHistory(slug),
    ]);
    if (detail) {
      const changelog = await getPulseChangelog(slug, 20);
      const rows = Array.isArray(changelog)
        ? changelog
        : (changelog as { rows: unknown[] }).rows ?? [];
      pulseEvents = rows as PulseEvent[];
    }
  } catch {}

  if (!detail) notFound();

  const { jurisdiction, composite, dimensions, pulse } = detail;
  const score = composite ? Math.round(composite.score) : null;

  const historyArr = Array.isArray(history)
    ? history
    : (history as { rows: unknown[] }).rows ?? [];
  const typedHistory = historyArr as {
    quarter: string;
    score: number;
    rank: number | null;
    totalRanked: number | null;
  }[];
  const ciScoreData: CIScoreData | null = composite
    ? {
        score: Number(composite.score ?? 0),
        rank: composite.rank ?? null,
        totalRanked: composite.totalRanked ?? null,
        quarter: composite.quarter,
        isPartial: Boolean(composite.isPartial),
      }
    : null;
  const pulseScoreData: PulseScoreData | null = pulse
    ? {
        pulseScore: Number(pulse.pulseScore ?? 0),
        eventImpact: Number(pulse.eventImpact ?? 0),
        activeEvents: Number(pulse.activeEvents ?? 0),
        scoreDate: pulse.scoreDate ? String(pulse.scoreDate) : "",
        isLowConfidence: Boolean(pulse.isLowConfidence),
      }
    : null;
  const previousHistoryPoint =
    typedHistory.length >= 2 ? typedHistory[typedHistory.length - 2] : null;
  const latestHistoryPoint =
    typedHistory.length >= 1 ? typedHistory[typedHistory.length - 1] : null;
  const ciChangeText =
    previousHistoryPoint && latestHistoryPoint
      ? `${latestHistoryPoint.score - previousHistoryPoint.score >= 0 ? "+" : ""}${(
          latestHistoryPoint.score - previousHistoryPoint.score
        ).toFixed(1)} vs ${formatQuarter(previousHistoryPoint.quarter)}`
      : null;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--spacing-content-top, 40px) var(--spacing-page-x, 24px)",
      }}
    >
      {/* Breadcrumb */}
      <Link href="/civica-index" className="breadcrumb">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 12L6 8l4-4" />
        </svg>
        Civica Index
      </Link>

      {/* Country header */}
      <div className="country-header" style={{ marginBottom: 32 }}>
        <CountryFlag iso2={jurisdiction.iso2} size={48} />
        <div>
          <h1 className="country-title">{jurisdiction.name}</h1>
          {jurisdiction.governmentType && (
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-11)",
                color: "var(--color-text-30)",
                margin: "4px 0 0",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {jurisdiction.governmentType}
            </p>
          )}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Link
            href={`/countries/${slug}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-40)",
              textDecoration: "none",
              padding: "6px 10px",
              border: "1px solid var(--color-card-border)",
              borderRadius: "var(--radius-sm)",
              whiteSpace: "nowrap",
            }}
          >
            Country profile →
          </Link>
        </div>
      </div>

      {(ciScoreData || pulseScoreData) ? (
        <CIPulseScoreDisplay
          ciScore={ciScoreData}
          pulseScore={pulseScoreData}
          ciChangeText={ciChangeText}
        />
      ) : (
        <div className="cv-card" style={{ marginBottom: 24 }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-14)",
              color: "var(--color-text-40)",
              margin: 0,
            }}
          >
            No CI score available for this country yet.
          </p>
        </div>
      )}

      {/* Dimension scores */}
      {dimensions.length > 0 && (
        <div className="cv-card" style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-30)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 16px",
            }}
          >
            Dimension Scores
          </h2>
          <DimensionBars dimensions={dimensions} />
        </div>
      )}

      {/* Historical CI chart */}
      {typedHistory.length >= 2 && (
        <div className="cv-card" style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-30)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 12px",
            }}
          >
            CI Score History
          </h2>
          <HistoryChart history={typedHistory} />
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-10)",
              color: "var(--color-text-25)",
              marginTop: 8,
              marginBottom: 0,
            }}
          >
            {typedHistory.length} quarter{typedHistory.length !== 1 ? "s" : ""} of data ·{" "}
            {formatQuarter(typedHistory[0].quarter)} – {formatQuarter(typedHistory[typedHistory.length - 1].quarter)}
          </p>
        </div>
      )}

      {/* Pulse event timeline */}
      {pulseEvents.length > 0 && (
        <div className="cv-card" style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-30)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 4px",
            }}
          >
            Pulse Events
          </h2>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-10)",
              color: "var(--color-text-25)",
              margin: "0 0 12px",
            }}
          >
            Events that influence the Civica Pulse score
          </p>
          {pulseEvents.map((event, i) => (
            <PulseEventRow key={event.id} event={event} index={i} total={pulseEvents.length} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {score === null && dimensions.length === 0 && !pulse && pulseEvents.length === 0 && (
        <div className="cv-card">
          <p
            style={{
              fontFamily: "var(--font-body-sans, var(--font-body))",
              fontSize: "var(--text-14)",
              color: "var(--color-text-50)",
              margin: 0,
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            Civica Index data for {jurisdiction.name} has not yet been scored. Run the CI pipeline to populate.
          </p>
        </div>
      )}

      {/* Footer links */}
      <div
        style={{
          marginTop: 40,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          borderTop: "1px solid var(--color-card-border)",
          paddingTop: 24,
        }}
      >
        <Link
          href="/civica-index"
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-40)",
            textDecoration: "none",
          }}
        >
          ← All countries
        </Link>
        <Link
          href="/civica-index/methodology"
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
        <Link
          href={`/countries/${slug}`}
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-40)",
            textDecoration: "none",
          }}
        >
          {jurisdiction.name} profile →
        </Link>
      </div>
    </div>
  );
}
