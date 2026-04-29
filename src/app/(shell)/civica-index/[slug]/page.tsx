import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCIRankings,
  getCICountryDetail,
  getCICountryHistory,
  getPulseChangelog,
  getRelatedCountries,
} from "@/lib/db/queries";
import {
  CIPulseScoreDisplay,
  type CIScoreData,
  type PulseScoreData,
} from "@/components/ci/CIPulseScoreDisplay";
import { PulseDimensionalDeltas } from "@/components/pulse/PulseDimensionalDeltas";
import { getPulseV2ForCountry } from "@/lib/db/queries-pulse-v2";
import { CountryFlag } from "@/components/CountryFlag";
import { GovernmentTaxonomyBlock } from "@/components/GovernmentTaxonomyBlock";
import { ciTier as ciTierCanonical } from "@/lib/ci/tiers";

/**
 * Phase 5.4 cut-over — display the four governance dimensions of the
 * Beta methodology. Human Development and Stability & Security have
 * moved to the Civica Conditions companion layer (rendered separately).
 *
 * Weights here MUST mirror src/lib/ci/dimensions-v2.ts; expressed as
 * integer percentages for display.
 */
const DIMENSION_LABELS: Record<string, string> = {
  democratic_quality: "Democratic Quality",
  rule_of_law: "Rule of Law",
  freedom_rights: "Freedoms & Rights",
  corruption_control: "Corruption Control",
};

const DIMENSION_ORDER = [
  "democratic_quality",
  "rule_of_law",
  "freedom_rights",
  "corruption_control",
];

const DIMENSION_WEIGHTS: Record<string, number> = {
  democratic_quality: 27,
  rule_of_law: 26,
  freedom_rights: 23,
  corruption_control: 24,
};

const DIMENSION_SOURCE_LABELS: Record<string, string> = {
  vdem: "V-Dem · Liberal Democracy Index",
  worldbank_wgi: "World Bank WGI",
  undp_hdi: "UNDP HDI",
  freedom_house: "Freedom House",
  transparency_intl: "Transparency International",
  global_peace_index: "Global Peace Index",
};

function formatPopulationCompact(value: number | null | undefined): string | null {
  if (!value || value <= 0) return null;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B population`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M population`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K population`;
  return `${value} population`;
}

function formatPopulationLong(value: number | null | undefined): string {
  if (!value || value <= 0) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatQuarterLong(q: string): string {
  const m = q.match(/^(\d{4})-Q(\d)$/);
  if (!m) return q;
  return `${m[1]} Q${m[2]}`;
}

function formatSourceLabel(sourceId: string | null | undefined): string {
  if (!sourceId) return "Source pending";
  return DIMENSION_SOURCE_LABELS[sourceId] ?? sourceId.replaceAll("_", " ");
}

function findRankInList<
  T extends { slug?: string | null },
>(rows: T[], slug: string): { rank: number; total: number } | null {
  const index = rows.findIndex((row) => row.slug === slug);
  if (index === -1) return null;
  return {
    rank: index + 1,
    total: rows.length,
  };
}

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

function DimensionScoreTable({
  dimensions,
}: {
  dimensions: { dimension: string; normalizedScore: number; sourceId: string }[];
}) {
  const sorted = DIMENSION_ORDER.map((dim) =>
    dimensions.find((d) => d.dimension === dim)
  ).filter(Boolean) as typeof dimensions;

  return (
    <div className="ci-country-dimensions">
      {sorted.map((d) => {
        const score = Number(d.normalizedScore);
        const color = dimensionColor(score);
        const weight = DIMENSION_WEIGHTS[d.dimension] ?? 0;
        const contribution = (score * weight) / 100;
        return (
          <div key={d.dimension} className="ci-country-dim-row">
            <div className="ci-country-dim-label">
              <div className="ci-country-dim-name">
                {DIMENSION_LABELS[d.dimension] ?? d.dimension}
              </div>
              <div className="ci-country-dim-source">
                {formatSourceLabel(d.sourceId)}
              </div>
            </div>
            <div className="ci-country-dim-weight">{weight}%</div>
            <div className="ci-country-dim-bar">
              <div
                className="ci-country-dim-bar-fill"
                style={{
                  width: `${Math.max(0, Math.min(score, 100))}%`,
                  background: color,
                }}
              />
            </div>
            <div
              className="ci-country-dim-score"
              style={{ color }}
            >
              {Math.round(score)}
            </div>
            <div className="ci-country-dim-contribution">
              contributes <strong>{Math.round(contribution)}</strong> pts
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
  confidence: number | null;
  headline: string;
  justification?: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  isActive: boolean;
};

function eventSeverityClass(severity: number): string {
  if (severity >= 4) return "sev-pos";
  if (severity <= -7) return "sev-sev";
  if (severity <= -4) return "sev-sig";
  return "sev-mod";
}

function PulseEventCard({ event }: { event: PulseEvent }) {
  const severityLabel = `${event.severity >= 0 ? "+" : ""}${Math.round(event.severity)}`;
  const cardClass = `ci-country-event-card ${event.sourceUrl ? "is-link" : ""}`;
  const inner = (
    <>
      <div className={`ci-country-event-severity ${eventSeverityClass(event.severity)}`}>
        {severityLabel}
      </div>
      <div className="ci-country-event-body">
        <div className="ci-country-event-category">
          {event.category.replaceAll("_", " ")} ·{" "}
          {new Date(event.eventDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <h3 className="ci-country-event-headline">{event.headline}</h3>
        {event.justification ? (
          <p className="ci-country-event-justification">{event.justification}</p>
        ) : null}
      </div>
      <div className="ci-country-event-meta">
        {event.sourceName ? <div>{event.sourceName}</div> : null}
        {event.confidence !== null ? (
          <div className="ci-country-event-confidence">
            Confidence {Math.round(event.confidence * 100)}%
          </div>
        ) : null}
        <div
          className={event.severity >= 0 ? "impact-pos" : "impact-neg"}
          style={{ color: pulseImpactColor(event.severity) }}
        >
          {event.isActive ? "Active event" : "Archived event"}
        </div>
      </div>
    </>
  );

  if (event.sourceUrl) {
    return (
      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClass}
      >
        {inner}
      </a>
    );
  }

  return <article className={cardClass}>{inner}</article>;
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
  let globalRankings: Awaited<ReturnType<typeof getCIRankings>> = [];
  let regionalRankings: Awaited<ReturnType<typeof getCIRankings>> = [];
  let compareSuggestions: Awaited<ReturnType<typeof getRelatedCountries>> = [];

  try {
    [detail, history] = await Promise.all([
      getCICountryDetail(slug, quarter),
      getCICountryHistory(slug),
    ]);
    // pulseV2 fetched here so it lands inside the same try-block as
    // detail; failures still let the page render via the fallback.
    if (detail) {
      const changelog = await getPulseChangelog(slug, 20);
      const rows = Array.isArray(changelog)
        ? changelog
        : (changelog as { rows: unknown[] }).rows ?? [];
      pulseEvents = rows as PulseEvent[];

      [globalRankings, regionalRankings, compareSuggestions] = await Promise.all([
        getCIRankings(),
        detail.jurisdiction.continent
          ? getCIRankings(undefined, { continent: detail.jurisdiction.continent })
          : Promise.resolve([]),
        getRelatedCountries(
          detail.jurisdiction.id,
          detail.jurisdiction.continent,
          3,
        ),
      ]);
    }
  } catch {}

  if (!detail) notFound();

  // Pulse v2 dimensional deltas. Independent of legacy `pulse` —
  // when 5.10 cuts over fully, the legacy `pulse` field disappears.
  const pulseV2 = await getPulseV2ForCountry(slug).catch(() => null);

  const { jurisdiction, composite, dimensions, pulse } = detail;
  const taxonomy = jurisdiction.governmentClassification ?? null;
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
        scoreLower:
          composite.scoreLower != null ? Number(composite.scoreLower) : null,
        scoreUpper:
          composite.scoreUpper != null ? Number(composite.scoreUpper) : null,
        band: (composite.band as string | null) ?? null,
        completenessFlag:
          (composite.completenessFlag as
            | "full"
            | "partial"
            | "insufficient"
            | null) ?? null,
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
  const heroMeta = [
    taxonomy?.structuralSubtypeLabel ?? taxonomy?.rawLabel ?? jurisdiction.governmentType ?? null,
    jurisdiction.capital ?? null,
    formatPopulationCompact(jurisdiction.population),
    jurisdiction.continent ?? null,
  ].filter(Boolean) as string[];
  const rankLabel =
    composite?.rank && composite?.totalRanked
      ? `Rank ${composite.rank} / ${composite.totalRanked}`
      : "Rank pending";
  const citationDate = pulse?.scoreDate
    ? new Date(String(pulse.scoreDate)).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const citationText = `Civica Index for ${jurisdiction.name}, ${citationDate}. Civica Atlas. https://civicaatlas.org/civica-index/${slug}`;
  const regionalRank =
    jurisdiction.continent && regionalRankings.length > 0
      ? findRankInList(
          regionalRankings as Array<{ slug?: string | null }>,
          slug,
        )
      : null;
  const familyRows = taxonomy?.structuralFamily
    ? (
        globalRankings as Array<{
          slug?: string | null;
          governmentClassification?: {
            structuralFamily?: string | null;
          } | null;
        }>
      ).filter(
        (row) =>
          row.governmentClassification?.structuralFamily ===
          taxonomy.structuralFamily,
      )
    : [];
  const familyRank =
    taxonomy?.structuralFamily && familyRows.length > 0
      ? findRankInList(familyRows, slug)
      : null;
  const rankedPeerSuggestions = (() => {
    const rankedRows = regionalRankings as Array<{
      slug?: string | null;
      name?: string | null;
    }>;
    if (rankedRows.length === 0) return [];
    const currentIndex = rankedRows.findIndex((row) => row.slug === slug);
    if (currentIndex === -1) {
      return rankedRows
        .filter((row) => row.slug && row.name && row.slug !== slug)
        .slice(0, 3)
        .map((row) => ({ slug: row.slug as string, name: row.name as string }));
    }

    const offsets = [-2, -1, 1, 2, -3, 3];
    const picks: Array<{ slug: string; name: string }> = [];
    for (const offset of offsets) {
      const row = rankedRows[currentIndex + offset];
      if (!row?.slug || !row?.name || row.slug === slug) continue;
      if (picks.some((pick) => pick.slug === row.slug)) continue;
      picks.push({ slug: row.slug, name: row.name });
      if (picks.length === 3) break;
    }
    return picks;
  })();
  const compareCards =
    rankedPeerSuggestions.length > 0
      ? rankedPeerSuggestions
      : compareSuggestions
          .filter((country) => country.slug && country.slug !== slug)
          .map((country) => ({ slug: country.slug, name: country.name }));
  const rankPanels = [
    composite?.rank && composite?.totalRanked
      ? {
          label: "Global",
          value: `#${composite.rank} of ${composite.totalRanked}`,
        }
      : null,
    regionalRank && jurisdiction.continent
      ? {
          label: jurisdiction.continent,
          value: `#${regionalRank.rank} of ${regionalRank.total}`,
        }
      : null,
    familyRank && taxonomy?.structuralFamilyLabel
      ? {
          label: taxonomy.structuralFamilyLabel,
          value: `#${familyRank.rank} of ${familyRank.total}`,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="ci-country-detail-page">
      <div className="ci-country-detail-container">
        <nav className="breadcrumb" aria-label="breadcrumb">
          <Link href="/civica-index">← Index</Link>
          {jurisdiction.continent ? (
            <>
              <span className="ci-country-meta-dot">/</span>
              <Link href={`/civica-index?continent=${encodeURIComponent(jurisdiction.continent)}`}>
                {jurisdiction.continent}
              </Link>
            </>
          ) : null}
          <span className="ci-country-meta-dot">/</span>
          <span>{jurisdiction.name}</span>
        </nav>

        <section id="overview" className="ci-country-hero">
          <div className="ci-country-header">
            <div className="ci-country-title-wrap">
              <CountryFlag iso2={jurisdiction.iso2} size={56} />
              <div>
                <h1 className="ci-country-name">{jurisdiction.name}</h1>
              </div>
            </div>
            <div className="ci-country-rank">{rankLabel}</div>
          </div>

          {heroMeta.length > 0 ? (
            <div className="ci-country-meta">
              {heroMeta.map((item, index) => (
                <span key={`${item}-${index}`}>
                  {index > 0 ? <span className="ci-country-meta-dot">·</span> : null}
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {(ciScoreData || pulseV2) ? (
            <div className="ci-country-score-shell">
              <CIPulseScoreDisplay
                ciScore={ciScoreData}
                ciChangeText={ciChangeText}
              />
              {pulseV2 ? <PulseDimensionalDeltas data={pulseV2} /> : null}
            </div>
          ) : (
            <div className="cv-card" style={{ marginBottom: 24 }}>
              <p className="ci-country-empty-copy">
                No CI score available for this country yet.
              </p>
            </div>
          )}
        </section>

        <nav className="ci-country-subnav" aria-label="Country detail sections">
          <a href="#overview">Overview</a>
          <a href="#dimensions">Dimensions</a>
          <a href="#history">History</a>
          {pulseEvents.length > 0 ? <a href="#pulse">Pulse changelog</a> : null}
          <Link href="/civica-index/methodology">Methodology</Link>
          <Link href={`/civica-index/widget?c=${slug}`}>Embed</Link>
          <a href="#cite">Cite</a>
        </nav>

        {dimensions.length > 0 ? (
          <section id="dimensions">
            <div className="ci-country-section-eyebrow">
              <span>Civica Index breakdown · 4 governance dimensions</span>
              <small>weights empirically derived · source-specific inputs</small>
            </div>
            <h2 className="ci-country-section-title">
              How the {ciScoreData ? Math.round(ciScoreData.score) : "score"} is calculated.
            </h2>
            <DimensionScoreTable dimensions={dimensions} />
          </section>
        ) : null}

        <section id="history" className="ci-country-two-col">
          <div className="ci-country-panel">
            <div className="ci-country-section-eyebrow">History · quarterly CI trend</div>
            <h2 className="ci-country-panel-title">How the index has moved over time.</h2>
            {typedHistory.length >= 2 ? (
              <>
                <div className="ci-country-chart-wrap">
                  <HistoryChart history={typedHistory} />
                </div>
                <div className="ci-country-chart-legend">
                  <span>
                    <span className="ci-country-legend-swatch ci-line" />
                    Civica Index (CI)
                  </span>
                  <span>
                    {typedHistory.length} quarters · {formatQuarter(typedHistory[0].quarter)} –{" "}
                    {formatQuarter(typedHistory[typedHistory.length - 1].quarter)}
                  </span>
                </div>
              </>
            ) : (
              <p className="ci-country-panel-copy">
                Historical CI data is not available yet for this country.
              </p>
            )}
          </div>

          <div className="ci-country-panel">
            <div className="ci-country-section-eyebrow">Regional rank</div>
            <h2 className="ci-country-panel-title">Where {jurisdiction.name} sits against peers.</h2>
            {rankPanels.length > 0 ? (
              <div className="ci-country-rank-list">
                {rankPanels.map((row) => (
                  <div key={row.label} className="ci-country-rank-row">
                    <span className="ci-country-rank-label">{row.label}</span>
                    <span className="ci-country-rank-value">{row.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ci-country-panel-copy">
                Rank context is not available yet for this country.
              </p>
            )}

            {compareCards.length > 0 ? (
              <div className="ci-country-compare-block">
                <div className="ci-country-compare-label">Compare with</div>
                <div className="ci-country-compare-links">
                  {compareCards.map((country) => (
                    <Link
                      key={country.slug}
                      href={`/civica-index/compare?c=${encodeURIComponent(slug)}&c=${encodeURIComponent(country.slug)}`}
                      className="ci-country-compare-link"
                    >
                      + {country.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="ci-country-meta-grid">
              <div className="ci-country-meta-row">
                <span>Capital</span>
                <strong>{jurisdiction.capital ?? "—"}</strong>
              </div>
              <div className="ci-country-meta-row">
                <span>Population</span>
                <strong>{formatPopulationLong(jurisdiction.population)}</strong>
              </div>
              <div className="ci-country-meta-row">
                <span>Current quarter</span>
                <strong>{composite?.quarter ? formatQuarterLong(composite.quarter) : "—"}</strong>
              </div>
              <div className="ci-country-meta-row">
                <span>Methodology</span>
                <strong>Beta</strong>
              </div>
            </div>

            <div className="ci-country-taxonomy-wrap">
              <GovernmentTaxonomyBlock classification={taxonomy} showNote />
            </div>
          </div>
        </section>

        {pulseEvents.length > 0 ? (
          <section id="pulse">
            <div className="ci-country-section-eyebrow">
              <span>Pulse changelog · latest scored events</span>
              <small>{pulseEvents.length} event{pulseEvents.length === 1 ? "" : "s"} surfaced</small>
            </div>
            <h2 className="ci-country-section-title">
              What&apos;s moved the score lately.
            </h2>
            <div className="ci-country-event-list">
              {pulseEvents.map((event) => (
                <PulseEventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        ) : null}

        {score === null && dimensions.length === 0 && !pulse && pulseEvents.length === 0 ? (
          <div className="cv-card">
            <p className="ci-country-empty-copy">
              Civica Index data for {jurisdiction.name} has not yet been scored.
              Run the CI pipeline to populate it.
            </p>
          </div>
        ) : null}

        <section id="cite" style={{ marginTop: 64 }}>
          <div className="ci-country-section-eyebrow">Cite this page</div>
          <div className="ci-country-panel ci-country-citation">
            {citationText}
          </div>
        </section>

        <div className="ci-country-footer-links">
          <Link href="/civica-index">← All countries</Link>
          <Link href="/civica-index/methodology">Methodology →</Link>
          <Link href={`/countries/${slug}`}>{jurisdiction.name} profile →</Link>
        </div>
      </div>
      <style>{DETAIL_CSS}</style>
    </div>
  );
}

const DETAIL_CSS = `
  .ci-country-detail-page {
    background: var(--color-bg);
  }
  .ci-country-detail-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 40px 72px;
  }
  .ci-country-meta-dot {
    color: var(--color-text-20);
    margin: 0 8px;
  }
  .ci-country-hero {
    padding: 8px 0 40px;
  }
  .ci-country-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .ci-country-title-wrap {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }
  .ci-country-name {
    font-family: var(--font-heading);
    font-size: 56px;
    font-weight: 400;
    letter-spacing: -0.04em;
    line-height: 1;
    margin: 0;
    color: var(--color-text-primary);
  }
  .ci-country-rank {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 13px;
    letter-spacing: 0.08em;
    color: var(--color-text-40);
    padding: 6px 12px;
    border: 1px solid var(--color-card-border);
    border-radius: 2px;
  }
  .ci-country-meta {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 12px;
    color: var(--color-text-40);
    display: flex;
    gap: 0;
    flex-wrap: wrap;
    margin-bottom: 24px;
  }
  .ci-country-score-shell {
    margin-bottom: 48px;
  }
  .ci-country-subnav {
    display: flex;
    gap: 0;
    margin-bottom: 40px;
    border-bottom: 1px solid var(--color-divider);
    flex-wrap: wrap;
  }
  .ci-country-subnav a {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 12px;
    letter-spacing: 0.03em;
    padding: 12px 18px 14px;
    background: transparent;
    color: var(--color-text-30);
    border-bottom: 1px solid transparent;
    text-decoration: none;
    margin-bottom: -1px;
  }
  .ci-country-subnav a:hover {
    color: var(--color-text-primary);
    border-bottom-color: var(--color-accent);
  }
  .ci-country-section-eyebrow {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-30);
    margin-bottom: 14px;
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }
  .ci-country-section-eyebrow small {
    color: var(--color-text-20);
    font-size: 10px;
    letter-spacing: 0.08em;
  }
  .ci-country-section-title {
    font-family: var(--font-heading);
    font-size: 32px;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin: 0 0 28px;
  }
  .ci-country-dimensions {
    border: 1px solid var(--color-card-border);
    border-radius: 4px;
    overflow: hidden;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1px;
    background: var(--color-grid-bg);
    margin-bottom: 48px;
  }
  .ci-country-dim-row {
    background: var(--color-grid-cell);
    padding: 20px 28px;
    display: grid;
    grid-template-columns: 260px 80px minmax(0, 1fr) 80px 180px;
    gap: 24px;
    align-items: center;
  }
  .ci-country-dim-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ci-country-dim-name {
    font-family: var(--font-heading);
    font-size: 18px;
    color: var(--color-text-primary);
    line-height: 1.2;
  }
  .ci-country-dim-source {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 11px;
    color: var(--color-text-30);
  }
  .ci-country-dim-weight,
  .ci-country-dim-contribution {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 12px;
    color: var(--color-text-40);
    text-align: right;
  }
  .ci-country-dim-bar {
    height: 6px;
    background: var(--color-divider);
    border-radius: 1px;
    overflow: hidden;
    position: relative;
  }
  .ci-country-dim-bar-fill {
    height: 100%;
    border-radius: 1px;
  }
  .ci-country-dim-score {
    font-family: var(--font-heading);
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.01em;
    text-align: right;
  }
  .ci-country-dim-contribution strong {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-mono);
  }
  .ci-country-two-col {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 32px;
    margin-bottom: 48px;
  }
  .ci-country-panel {
    border: 1px solid var(--color-card-border);
    border-radius: 4px;
    background: var(--color-grid-cell);
    padding: 28px 32px;
  }
  .ci-country-panel-title {
    font-family: var(--font-heading);
    font-size: 24px;
    font-weight: 400;
    line-height: 1.15;
    margin: 0 0 20px;
    color: var(--color-text-primary);
  }
  .ci-country-panel-copy {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-60);
    margin: 0;
  }
  .ci-country-chart-wrap {
    position: relative;
    margin-bottom: 12px;
  }
  .ci-country-chart-legend {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 11px;
    color: var(--color-text-40);
  }
  .ci-country-legend-swatch {
    display: inline-block;
    width: 14px;
    height: 3px;
    margin-right: 6px;
    vertical-align: middle;
  }
  .ci-country-legend-swatch.ci-line {
    background: oklch(55% 0.18 245);
  }
  .ci-country-rank-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: 24px;
  }
  .ci-country-rank-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-divider);
  }
  .ci-country-rank-row:last-child {
    border-bottom: none;
  }
  .ci-country-rank-label {
    color: var(--color-text-60);
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 13px;
  }
  .ci-country-rank-value {
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 13px;
    text-align: right;
  }
  .ci-country-compare-block {
    margin: 24px 0;
  }
  .ci-country-compare-label,
  .ci-country-meta-row span {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-30);
  }
  .ci-country-compare-label {
    margin-bottom: 8px;
  }
  .ci-country-compare-links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .ci-country-compare-link {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 11px;
    color: var(--color-text-40);
    text-decoration: none;
    border: 1px solid var(--color-card-border);
    border-radius: 4px;
    padding: 8px 12px;
  }
  .ci-country-meta-grid {
    border-top: 1px solid var(--color-divider);
    padding-top: 18px;
    display: grid;
    gap: 10px;
  }
  .ci-country-meta-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: baseline;
  }
  .ci-country-meta-row strong {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 13px;
    color: var(--color-text-primary);
    text-align: right;
  }
  .ci-country-taxonomy-wrap {
    margin-top: 24px;
  }
  .ci-country-event-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--color-grid-bg);
    border: 1px solid var(--color-card-border);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 48px;
  }
  .ci-country-event-card {
    background: var(--color-grid-cell);
    padding: 20px 24px;
    display: grid;
    grid-template-columns: 64px 1fr auto;
    gap: 18px;
    align-items: start;
    text-decoration: none;
    color: inherit;
  }
  .ci-country-event-card.is-link:hover {
    background: var(--color-grid-cell-hover);
  }
  .ci-country-event-severity {
    font-family: var(--font-heading);
    font-size: 24px;
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1;
    text-align: center;
    padding: 8px 0;
    border-radius: 2px;
    min-width: 56px;
  }
  .ci-country-event-severity.sev-pos {
    background: rgba(92,170,110,0.14);
    color: var(--tier-exceptional);
  }
  .ci-country-event-severity.sev-sev {
    background: rgba(230,140,65,0.14);
    color: var(--tier-weak);
  }
  .ci-country-event-severity.sev-sig {
    background: rgba(230,180,70,0.14);
    color: var(--tier-mixed);
  }
  .ci-country-event-severity.sev-mod {
    background: rgba(196,189,174,0.08);
    color: var(--color-text-50);
  }
  .ci-country-event-body {
    min-width: 0;
  }
  .ci-country-event-category {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-30);
    margin-bottom: 4px;
  }
  .ci-country-event-headline {
    font-family: var(--font-heading);
    font-size: 17px;
    color: var(--color-text-primary);
    line-height: 1.3;
    margin: 0 0 6px;
  }
  .ci-country-event-justification {
    font-size: 13px;
    color: var(--color-text-60);
    line-height: 1.55;
    margin: 0;
  }
  .ci-country-event-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 11px;
    color: var(--color-text-30);
    white-space: nowrap;
  }
  .ci-country-event-confidence {
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--color-text-20);
  }
  .ci-country-citation {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: 13px;
    color: var(--color-text-60);
    line-height: 1.7;
  }
  .ci-country-footer-links {
    margin-top: 40px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    border-top: 1px solid var(--color-card-border);
    padding-top: 24px;
    font-family: var(--font-mono);
    font-weight: var(--font-weight-mono);
    font-size: var(--text-12);
  }
  .ci-country-footer-links a {
    color: var(--color-text-40);
    text-decoration: none;
  }
  .ci-country-empty-copy {
    font-family: var(--font-body-sans, var(--font-body));
    font-size: var(--text-14);
    color: var(--color-text-50);
    margin: 0;
    line-height: var(--leading-relaxed);
  }
  @media (max-width: 900px) {
    .ci-country-detail-container {
      padding: 0 20px 64px;
    }
    .ci-country-name {
      font-size: 40px;
    }
    .ci-country-dim-row {
      grid-template-columns: 1fr;
      gap: 10px;
      padding: 16px 20px;
    }
    .ci-country-dim-weight,
    .ci-country-dim-score,
    .ci-country-dim-contribution {
      text-align: left;
    }
    .ci-country-two-col {
      grid-template-columns: 1fr;
    }
    .ci-country-rank-row,
    .ci-country-meta-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .ci-country-rank-value,
    .ci-country-meta-row strong {
      text-align: left;
    }
    .ci-country-event-card {
      grid-template-columns: 48px 1fr;
    }
    .ci-country-event-meta {
      grid-column: 1 / -1;
      align-items: flex-start;
      flex-direction: row;
      gap: 14px;
      white-space: normal;
    }
  }
  @media (max-width: 640px) {
    .ci-country-header {
      align-items: flex-start;
      gap: 12px;
    }
    .ci-country-title-wrap {
      gap: 12px;
    }
    .ci-country-name {
      font-size: 34px;
    }
  }
`;
