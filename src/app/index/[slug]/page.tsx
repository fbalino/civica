import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCICountryDetail,
  getCICountryHistory,
  getPulseChangelog,
  getPulseHistory,
} from "@/lib/db/queries";
import { CountryFlag } from "@/components/CountryFlag";
import {
  CIPulseScoreDisplay,
  ciTierInfo,
  type CIScoreData,
  type PulseScoreData,
} from "@/components/ci/CIPulseScoreDisplay";

// ─── Dimension metadata ───────────────────────────────────────────────────────

const DIMENSION_META: Record<
  string,
  { label: string; source: string; weight: number }
> = {
  democratic_quality: { label: "Democratic quality",          source: "V-Dem · Liberal Democracy Index",    weight: 0.30 },
  rule_of_law:        { label: "Rule of law & institutions",  source: "World Bank WGI · V-Dem RoL",        weight: 0.20 },
  human_development:  { label: "Human development",           source: "UNDP HDI · WB indicators",          weight: 0.15 },
  freedom_rights:     { label: "Freedom & rights",            source: "Freedom House · RSF Press",         weight: 0.15 },
  corruption_control: { label: "Corruption control",          source: "Transparency Int'l CPI · WGI",      weight: 0.10 },
  stability_security: { label: "Stability & security",        source: "Global Peace Index · FSI",          weight: 0.10 },
};

const DIMENSION_ORDER = Object.keys(DIMENSION_META);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B population`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M population`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K population`;
  return `${n.toLocaleString()} population`;
}

function formatQuarterShort(q: string): string {
  const m = q.match(/^(\d{4})-Q(\d)$/);
  if (!m) return q;
  return `Q${m[2]} '${m[1].slice(2)}`;
}

function severityClass(sev: number): string {
  if (sev >= 3)  return "sev-pos";
  if (sev >= 1)  return "sev-mod";
  if (sev >= -3) return "sev-sig";
  if (sev >= -6) return "sev-sev";
  return "sev-cat";
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

// ─── Chart component (server SVG) ────────────────────────────────────────────

type HistoryPoint = { quarter: string; score: number; rank: number | null };
type PulsePoint   = { scoreDate: string; pulseScore: number };

function CIHistoryChart({
  ciHistory,
  pulseHistory,
}: {
  ciHistory: HistoryPoint[];
  pulseHistory: PulsePoint[];
}) {
  if (ciHistory.length < 2) return null;

  const W = 600;
  const H = 280;

  // tier bands (y maps 0=top=100pts to H=bottom=0pts)
  const yForScore = (s: number) => H - (s / 100) * H;

  // CI: quarterly step-line
  // Build step path: flat line between adjacent quarters
  const ciXStep = W / (ciHistory.length - 1);
  const ciPts = ciHistory.map((h, i) => ({
    x: i * ciXStep,
    y: yForScore(h.score),
    q: h.quarter,
  }));

  // Step-line: go right then jump
  let ciPath = `M${ciPts[0].x.toFixed(1)},${ciPts[0].y.toFixed(1)}`;
  for (let i = 1; i < ciPts.length; i++) {
    ciPath += ` L${ciPts[i].x.toFixed(1)},${ciPts[i - 1].y.toFixed(1)}`;
    ciPath += ` L${ciPts[i].x.toFixed(1)},${ciPts[i].y.toFixed(1)}`;
  }

  // Pulse: map dates to same x range as CI
  let pulsePath = "";
  if (pulseHistory.length >= 2) {
    const ciStart = new Date(ciHistory[0].quarter.replace(/-Q(\d)$/, (_, q) => `-${String((+q - 1) * 3 + 1).padStart(2, "0")}-01`));
    const ciEnd   = new Date();
    const ciMs    = ciEnd.getTime() - ciStart.getTime() || 1;

    const pulsePts = pulseHistory.map((p) => {
      const d = new Date(p.scoreDate);
      const x = ((d.getTime() - ciStart.getTime()) / ciMs) * W;
      return { x, y: yForScore(p.pulseScore) };
    });
    pulsePath = pulsePts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }

  // Grid lines at 25/50/75/100
  const gridTicks = [25, 50, 75, 100];

  // X-axis quarter labels
  const xLabelIndices = new Set<number>([0, ciHistory.length - 1]);
  if (ciHistory.length > 4) {
    xLabelIndices.add(Math.round(ciHistory.length / 3));
    xLabelIndices.add(Math.round((2 * ciHistory.length) / 3));
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block" }}
        aria-label="CI and Pulse score history"
      >
        {/* Tier bands */}
        <rect x="0" y={yForScore(100)} width={W} height={yForScore(90) - yForScore(100)} fill="var(--tier-exceptional)" opacity="0.06" />
        <rect x="0" y={yForScore(90)}  width={W} height={yForScore(75) - yForScore(90)}  fill="var(--tier-strong)"      opacity="0.05" />
        <rect x="0" y={yForScore(75)}  width={W} height={yForScore(50) - yForScore(75)}  fill="var(--tier-mixed)"       opacity="0.06" />
        <rect x="0" y={yForScore(50)}  width={W} height={yForScore(25) - yForScore(50)}  fill="var(--tier-weak)"        opacity="0.05" />
        <rect x="0" y={yForScore(25)}  width={W} height={H - yForScore(25)}              fill="var(--tier-failed)"      opacity="0.04" />

        {/* Grid lines */}
        {gridTicks.map((t) => (
          <g key={t}>
            <line
              x1={0} y1={yForScore(t)} x2={W} y2={yForScore(t)}
              stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
            />
            <text
              x={-6} y={yForScore(t)}
              textAnchor="end" dominantBaseline="middle"
              fontSize="9" fontFamily="var(--font-mono)"
              fill="currentColor" fillOpacity="0.30"
            >
              {t}
            </text>
          </g>
        ))}

        {/* Pulse line (behind CI) */}
        {pulsePath && (
          <path
            d={pulsePath}
            fill="none"
            stroke="var(--color-text-60, #c4bdae)"
            strokeWidth="1.5"
            opacity="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* CI step-line */}
        <path
          d={ciPath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* CI data points */}
        {ciPts.map((p) => (
          <circle key={p.q} cx={p.x} cy={p.y} r="3.5" fill="var(--color-accent)" />
        ))}

        {/* Now marker */}
        <line
          x1={W - 2} y1={0} x2={W - 2} y2={H}
          stroke="currentColor" strokeOpacity="0.25" strokeWidth="1"
          strokeDasharray="2 3"
        />

        {/* X-axis labels */}
        {ciHistory.map((h, i) =>
          xLabelIndices.has(i) ? (
            <text
              key={`xl-${h.quarter}`}
              x={i * ciXStep}
              y={H + 16}
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--font-mono)"
              fill="currentColor"
              fillOpacity="0.30"
            >
              {formatQuarterShort(h.quarter)}
            </text>
          ) : null
        )}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 12,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 11,
          color: "var(--color-text-40)",
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 3,
              background: "var(--color-accent)",
              marginRight: 6,
              verticalAlign: "middle",
            }}
          />
          Civica Index (CI)
        </span>
        {pulsePath && (
          <span>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 3,
                background: "var(--color-text-60, #c4bdae)",
                marginRight: 6,
                verticalAlign: "middle",
                opacity: 0.7,
              }}
            />
            Civica Pulse (CP)
          </span>
        )}
        <span>
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 8,
              background: "var(--tier-mixed)",
              marginRight: 6,
              verticalAlign: "middle",
              opacity: 0.4,
            }}
          />
          Tier bands
        </span>
      </div>
    </div>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

type PulseEvent = {
  id: string;
  eventDate: string;
  category: string;
  severity: number;
  confidence: number;
  headline: string;
  justification: string;
  sourceUrl: string | null;
  sourceName: string | null;
  isActive: boolean;
};

function EventCard({ event }: { event: PulseEvent }) {
  const sevClass = severityClass(event.severity);
  const sign = event.severity > 0 ? "+" : "";
  const sevBg: Record<string, string> = {
    "sev-pos": "rgba(92,170,110,0.14)",
    "sev-mod": "rgba(196,189,174,0.08)",
    "sev-sig": "rgba(230,180,70,0.14)",
    "sev-sev": "rgba(230,140,65,0.14)",
    "sev-cat": "rgba(198,90,55,0.14)",
  };
  const sevColor: Record<string, string> = {
    "sev-pos": "var(--tier-exceptional)",
    "sev-mod": "var(--color-text-50)",
    "sev-sig": "var(--tier-mixed)",
    "sev-sev": "var(--tier-weak)",
    "sev-cat": "var(--tier-failed)",
  };

  const inner = (
    <div
      style={{
        background: "var(--color-card-bg)",
        padding: "20px 24px",
        display: "grid",
        gridTemplateColumns: "64px 1fr auto",
        gap: 18,
        alignItems: "start",
        transition: "background-color 0.15s",
      }}
    >
      {/* Severity chip */}
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          textAlign: "center",
          padding: "8px 0",
          borderRadius: "var(--radius-sm, 2px)",
          minWidth: 56,
          background: sevBg[sevClass] ?? "rgba(196,189,174,0.08)",
          color: sevColor[sevClass] ?? "var(--color-text-50)",
        }}
      >
        {sign}{Math.abs(event.severity)}
      </div>

      {/* Body */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-text-30)",
            marginBottom: 4,
          }}
        >
          {event.category} · {new Date(event.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 17,
            color: "var(--color-text-primary)",
            lineHeight: 1.3,
            fontWeight: 400,
            marginBottom: 6,
          }}
        >
          {event.headline}
        </h3>
        {event.justification && (
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-60, #c4bdae)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {event.justification}
          </p>
        )}
      </div>

      {/* Meta */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: "flex-end",
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 11,
          color: "var(--color-text-30)",
          whiteSpace: "nowrap",
        }}
      >
        {event.sourceName && <div>{event.sourceName}</div>}
        <div
          style={{
            fontSize: 10,
            color: "var(--color-text-20)",
            letterSpacing: "0.08em",
          }}
        >
          CONFIDENCE {event.confidence.toFixed(2)}
        </div>
        <div>{relativeDate(event.eventDate)}</div>
      </div>
    </div>
  );

  if (event.sourceUrl) {
    return (
      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

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
  const tier  = score !== null ? ciTierInfo(score) : null;
  const title = `${name} — Civica Index${score !== null ? ` ${score}` : ""}`;
  const description = `${name}'s governance score in the Civica Index${score !== null ? ` is ${score}/100 (${tier!.label})` : ""}. View dimension breakdown, Civica Pulse, and historical trends.`;
  const url = `https://civicaatlas.org/index/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Civica`, description, url },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  let detail:       Awaited<ReturnType<typeof getCICountryDetail>>    = null;
  let ciHistory:    Awaited<ReturnType<typeof getCICountryHistory>>   = [];
  let pulseEventsRaw: unknown[] = [];
  let pulseHistoryRaw: unknown[] = [];

  try {
    [detail, ciHistory] = await Promise.all([
      getCICountryDetail(slug, quarter),
      getCICountryHistory(slug),
    ]);
    if (detail) {
      const [eventsResult, histResult] = await Promise.all([
        getPulseChangelog(slug, 20),
        getPulseHistory(slug, 180),
      ]);
      pulseEventsRaw  = Array.isArray(eventsResult)  ? eventsResult  : ((eventsResult  as { rows: unknown[] }).rows ?? []);
      pulseHistoryRaw = Array.isArray(histResult)    ? histResult    : ((histResult    as { rows: unknown[] }).rows ?? []);
    }
  } catch {}

  if (!detail) notFound();

  const { jurisdiction, composite, dimensions, pulse } = detail;

  const historyArr = (Array.isArray(ciHistory) ? ciHistory : ((ciHistory as { rows: unknown[] }).rows ?? [])) as HistoryPoint[];
  const pulseEvents = pulseEventsRaw as PulseEvent[];
  const pulseHistoryArr = pulseHistoryRaw as PulsePoint[];

  // Score data for display component
  const ciScoreData: CIScoreData | null = composite
    ? {
        score: composite.score,
        rank: composite.rank ?? null,
        totalRanked: composite.totalRanked ?? null,
        quarter: composite.quarter,
        isPartial: composite.isPartial,
      }
    : null;

  const pulseScoreData: PulseScoreData | null = pulse
    ? {
        pulseScore: pulse.pulseScore,
        eventImpact: pulse.eventImpact,
        activeEvents: pulse.activeEvents,
        scoreDate: typeof pulse.scoreDate === "string" ? pulse.scoreDate : new Date().toISOString().slice(0, 10),
        isLowConfidence: pulse.isLowConfidence,
      }
    : null;

  // Dimension rows (sorted by DIMENSION_ORDER)
  const dimMap = new Map(dimensions.map((d) => [d.dimension, d]));
  const dimRows = DIMENSION_ORDER.map((key) => {
    const meta = DIMENSION_META[key];
    const data = dimMap.get(key);
    return { key, meta, data };
  });

  const ciScore = composite ? Math.round(composite.score * 10) / 10 : null;

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 40px 80px",
      }}
    >
      {/* ── Breadcrumb ── */}
      <nav
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 12,
          letterSpacing: "0.03em",
          color: "var(--color-text-30)",
          padding: "32px 0 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
        aria-label="breadcrumb"
      >
        <Link href="/index" style={{ color: "var(--color-text-30)", textDecoration: "none" }}>
          ← Index
        </Link>
        {jurisdiction.continent && (
          <>
            <span style={{ color: "var(--color-text-20)" }}>/</span>
            <span>{jurisdiction.continent}</span>
          </>
        )}
        <span style={{ color: "var(--color-text-20)" }}>/</span>
        <span style={{ color: "var(--color-text-primary)" }}>{jurisdiction.name}</span>
      </nav>

      {/* ── Country hero ── */}
      <section style={{ padding: "8px 0 40px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <CountryFlag iso2={jurisdiction.iso2} size={40} />
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 56,
                fontWeight: 400,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "var(--color-text-primary)",
              }}
            >
              {jurisdiction.name}
            </h1>
          </div>
          {composite?.rank && composite.totalRanked && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 13,
                letterSpacing: "0.08em",
                color: "var(--color-text-40)",
                padding: "6px 12px",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm, 2px)",
              }}
            >
              Rank {composite.rank} / {composite.totalRanked}
            </div>
          )}
        </div>

        {/* Meta line */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 12,
            color: "var(--color-text-40)",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          {jurisdiction.governmentType && <span>{jurisdiction.governmentType}</span>}
          {jurisdiction.capital && (
            <>
              <span style={{ color: "var(--color-text-20)" }}>·</span>
              <span>{jurisdiction.capital}</span>
            </>
          )}
          {jurisdiction.population && (
            <>
              <span style={{ color: "var(--color-text-20)" }}>·</span>
              <span>{formatPop(jurisdiction.population)}</span>
            </>
          )}
          {jurisdiction.continent && (
            <>
              <span style={{ color: "var(--color-text-20)" }}>·</span>
              <span>{jurisdiction.continent}</span>
            </>
          )}
        </div>

        {/* Score display */}
        <CIPulseScoreDisplay ciScore={ciScoreData} pulseScore={pulseScoreData} />
      </section>

      {/* ── Subnav ── */}
      <nav
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 40,
          borderBottom: "1px solid var(--color-card-border)",
        }}
        role="tablist"
        aria-label="Country detail sections"
      >
        {[
          { label: "Overview",         href: "#overview" },
          { label: "Dimensions",       href: "#dimensions" },
          { label: "Pulse changelog",  href: "#changelog" },
          { label: "History",          href: "#history" },
          { label: "Methodology",      href: "/index/methodology" },
          { label: "Cite & embed",     href: "#cite" },
        ].map((tab) => (
          <a
            key={tab.label}
            href={tab.href}
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 12,
              letterSpacing: "0.03em",
              padding: "12px 18px 14px",
              color: "var(--color-text-30)",
              textDecoration: "none",
              borderBottom: "1px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      {/* ── Dimensions ── */}
      <section id="dimensions" style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--color-text-30)",
            marginBottom: 14,
          }}
        >
          <span>Civica Index breakdown · 6 dimensions</span>
          <small style={{ color: "var(--color-text-20)", fontSize: 10, letterSpacing: "0.08em" }}>
            weights fixed · sources live
          </small>
        </div>

        {ciScore !== null && (
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 400,
              fontSize: 32,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              marginBottom: 28,
            }}
          >
            How the {ciScore} is calculated.
          </h2>
        )}

        <div
          style={{
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-sm, 2px)",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 1,
            background: "var(--color-card-border)",
          }}
        >
          {dimRows.map(({ key, meta, data }) => {
            const score = data ? Math.round(data.normalizedScore) : null;
            const tier = score !== null ? ciTierInfo(score) : null;
            const contribution = score !== null ? (meta.weight * score / 100).toFixed(1) : null;

            return (
              <div
                key={key}
                style={{
                  background: "var(--color-card-bg)",
                  padding: "20px 28px",
                  display: "grid",
                  gridTemplateColumns: "260px 80px minmax(0, 1fr) 80px 180px",
                  gap: 24,
                  alignItems: "center",
                }}
              >
                {/* Name + source */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: 18,
                      color: "var(--color-text-primary)",
                      lineHeight: 1.2,
                    }}
                  >
                    {meta.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      fontSize: 11,
                      color: "var(--color-text-30)",
                    }}
                  >
                    {meta.source}
                  </div>
                </div>

                {/* Weight */}
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    fontSize: 14,
                    color: "var(--color-text-50)",
                    textAlign: "right",
                  }}
                >
                  {(meta.weight * 100).toFixed(0)}%
                </div>

                {/* Bar */}
                <div
                  style={{
                    height: 6,
                    background: "var(--color-card-border)",
                    borderRadius: 1,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {score !== null && tier && (
                    <div
                      style={{
                        width: `${score}%`,
                        height: "100%",
                        borderRadius: 1,
                        background: `var(${tier.cssVar})`,
                        transition: "width 0.3s",
                      }}
                    />
                  )}
                </div>

                {/* Score */}
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: 22,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    textAlign: "right",
                    color: tier ? `var(${tier.cssVar})` : "var(--color-text-30)",
                  }}
                >
                  {score ?? "—"}
                </div>

                {/* Contribution */}
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    fontSize: 12,
                    color: "var(--color-text-40)",
                    textAlign: "right",
                  }}
                >
                  {contribution !== null ? (
                    <>
                      contributes{" "}
                      <strong style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
                        {contribution}
                      </strong>{" "}
                      pts
                    </>
                  ) : (
                    "no data"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Two-col: history chart + regional rank ── */}
      <section
        id="history"
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 32,
          marginBottom: 48,
        }}
      >
        {/* History chart */}
        <div
          style={{
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-sm, 2px)",
            background: "var(--color-card-bg)",
            padding: "28px 32px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--color-text-30)",
              marginBottom: 20,
            }}
          >
            History · CI vs. Pulse overlay
          </div>

          {historyArr.length >= 2 ? (
            <CIHistoryChart ciHistory={historyArr} pulseHistory={pulseHistoryArr} />
          ) : (
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 13,
                color: "var(--color-text-30)",
              }}
            >
              Not enough historical data yet.
            </p>
          )}
        </div>

        {/* Regional rank */}
        <div
          style={{
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-sm, 2px)",
            background: "var(--color-card-bg)",
            padding: "28px 32px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--color-text-30)",
              marginBottom: 4,
            }}
          >
            Regional rank
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 4 }}>
            {[
              { label: "Global", value: composite?.rank && composite.totalRanked ? `#${composite.rank} of ${composite.totalRanked}` : "—" },
              { label: jurisdiction.continent ?? "Region", value: "—" },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "6px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--color-card-border)" : "none",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--color-text-60, #c4bdae)" }}>{row.label}</span>
                <span style={{ color: "var(--color-text-primary)" }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--color-text-30)",
                marginBottom: 8,
              }}
            >
              Compare with
            </div>
            <Link
              href="/compare"
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 11,
                color: "var(--color-text-40)",
                textDecoration: "none",
                padding: "6px 10px",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm, 2px)",
                display: "inline-block",
              }}
            >
              Open comparison tool →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pulse changelog ── */}
      {pulseEvents.length > 0 && (
        <section id="changelog" style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--color-text-30)",
              marginBottom: 14,
            }}
          >
            <span>Pulse changelog · trailing 30 days</span>
            {pulse?.activeEvents && (
              <small style={{ color: "var(--color-text-20)", fontSize: 10, letterSpacing: "0.08em" }}>
                {pulse.activeEvents} events scored · all justifications logged
              </small>
            )}
          </div>

          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 400,
              fontSize: 32,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              marginBottom: 28,
            }}
          >
            What&#39;s moved the score lately.
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              background: "var(--color-card-border)",
              border: "1px solid var(--color-card-border)",
              borderRadius: "var(--radius-sm, 2px)",
              overflow: "hidden",
            }}
          >
            {pulseEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* ── Cite ── */}
      <section id="cite" style={{ marginTop: 64 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--color-text-30)",
            marginBottom: 12,
          }}
        >
          Cite this page
        </div>
        <div
          style={{
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-sm, 2px)",
            background: "var(--color-card-bg)",
            padding: "20px 28px",
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 13,
            color: "var(--color-text-60, #c4bdae)",
            lineHeight: 1.7,
          }}
        >
          Civica Index for {jurisdiction.name}, {new Date().getFullYear()}. Civica Atlas.
          <br />
          https://civicaatlas.org/index/{slug}
        </div>
      </section>
    </div>
  );
}
