import Link from "next/link";
import {
  getCIRankings,
  getCICountryDetail,
  getCICountryHistory,
  getRelatedCountries,
} from "@/lib/db/queries";
import {
  CIScoreDisplay,
  type CIScoreData,
} from "@/components/ci/CIPulseScoreDisplay";
import { PulseDimensionalDeltas } from "@/components/pulse/PulseDimensionalDeltas";
import {
  getPulseV2ForCountry,
  getPulseV2Changelog,
} from "@/lib/db/queries-pulse-v2";
import { categoryLabel } from "@/lib/pulse/v2/labels";
import { SCORE_WINDOW_DAYS } from "@/lib/pulse/v2/taxonomy";
import { GovernmentTaxonomyBlock } from "@/components/GovernmentTaxonomyBlock";
import { CountryTrendSection } from "@/components/ci/CountryTrendSection";
import { PeerLensPanel } from "@/components/peer-grouping/PeerLensPanel";
import { getMaterialPeerSet, getGovernancePeerSet } from "@/lib/peer-grouping";
import { dimensionColorVar } from "@/lib/ci/dimension-colors";
import { displayDimensionScore } from "@/lib/ci/normalize-v2";
import { V2_WEIGHTS } from "@/lib/ci/dimensions-v2";
import { civicaIndex } from "@/lib/content/site-state";
import { FactValueDot } from "@/components/factbook/FactValueDot";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import { assessCiCompleteness } from "@/lib/ci/missingness-policy";

/**
 * Reusable Civica Index country body. Extracted from
 * `src/app/(reader)/civica-index/[slug]/page.tsx` so the unified
 * `/country/[slug]/civica-data` tab can render the full CI experience —
 * score + Pulse deltas, dimension breakdown, quarterly history, peer-lens
 * panels, rank panels, and compare links — without duplicating the
 * fetch/render logic.
 *
 * The component does its own data fetches (every one soft-failing) and
 * returns `null` when no CI detail exists for the slug, so the host page
 * can gate the surrounding section on `await getCICountryDetail(slug)` and
 * never render a phantom anchor.
 *
 * It deliberately renders only the CI BODY (score, dimensions, history,
 * peers, pulse changelog) — not the standalone page's breadcrumb,
 * masthead hero header, or footer nav, which belong to the host surface.
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

/** Canonical V2 weights (fractional, sum to 1.00) expressed as integer
 *  percentages for display. Single source of truth: dimensions-v2.ts. */
const DIMENSION_WEIGHT_PCT: Record<string, number> = Object.fromEntries(
  Object.entries(V2_WEIGHTS).map(([dim, w]) => [dim, Math.round(w * 100)])
);

const DIMENSION_SOURCE_LABELS: Record<string, string> = {
  vdem: "V-Dem · Liberal Democracy Index",
  worldbank_wgi: "World Bank WGI",
  undp_hdi: "UNDP HDI",
  freedom_house: "Freedom House",
  transparency_intl: "Transparency International",
  global_peace_index: "Global Peace Index",
};

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

function findRankInList<T extends { slug?: string | null }>(
  rows: T[],
  slug: string
): { rank: number; total: number } | null {
  const index = rows.findIndex((row) => row.slug === slug);
  if (index === -1) return null;
  return {
    rank: index + 1,
    total: rows.length,
  };
}

function pulseImpactColor(impact: number): string {
  if (impact > 2) return "var(--color-danger)";
  if (impact > 0) return "var(--pulse-impact-mid-pos)";
  if (impact < -2) return "var(--pulse-impact-strong-neg)";
  if (impact < 0) return "var(--pulse-impact-mid-neg)";
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
    .map(
      (h, i) =>
        `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(h.score).toFixed(1)}`
    )
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
          <stop
            offset="0%"
            stopColor="var(--chart-line-default)"
            stopOpacity="0.18"
          />
          <stop
            offset="100%"
            stopColor="var(--chart-line-default)"
            stopOpacity="0"
          />
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
        stroke="var(--chart-line-default)"
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
          fill="var(--chart-line-default)"
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
  dimensions: {
    dimension: string;
    normalizedScore: number;
    rawValue: number | null;
    sourceId: string;
  }[];
}) {
  const sorted = DIMENSION_ORDER.map((dim) =>
    dimensions.find((d) => d.dimension === dim)
  ).filter(Boolean) as typeof dimensions;

  return (
    <div className="ci-country-dimensions">
      {sorted.map((d) => {
        // Normalize on the SAME v2 fixed-bound scale as the headline
        // composite (calculate-v2.ts + published methodology §3). The
        // stored normalizedScore is the legacy v1 observed-min-max value
        // and does NOT reconcile with the headline, so we recompute from
        // rawValue. Fall back to the stored value only when raw value /
        // source is unavailable (then it didn't reach the headline either).
        const score =
          displayDimensionScore(d.rawValue, d.sourceId) ??
          Number(d.normalizedScore);
        // Fixed per-dimension series color: color identifies the source
        // dimension and never grades the country's numeric value.
        const color = dimensionColorVar(d.dimension);
        const weight = DIMENSION_WEIGHT_PCT[d.dimension] ?? 0;
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
            <div className="ci-country-dim-score" style={{ color }}>
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
  /** Below the corroboration-confidence floor (~0.4) → render de-emphasized
   *  so a single low-confidence classification never headlines the changelog. */
  lowConfidence?: boolean;
};

/** Confidence floor below which a Pulse event is shown but visually
 *  de-emphasized (Goal 2: don't let a low-confidence driver headline). */
const PULSE_LOW_CONFIDENCE = 0.4;

function eventSeverityClass(severity: number): string {
  if (severity >= 4) return "sev-pos";
  if (severity <= -7) return "sev-sev";
  if (severity <= -4) return "sev-sig";
  return "sev-mod";
}

function PulseEventCard({ event }: { event: PulseEvent }) {
  const severityLabel = `${event.severity >= 0 ? "+" : ""}${Math.round(
    event.severity
  )}`;
  const cardClass = `ci-country-event-card${event.sourceUrl ? " is-link" : ""}${
    event.lowConfidence ? " is-low-confidence" : ""
  }`;
  const inner = (
    <>
      <div
        className={`ci-country-event-severity ${eventSeverityClass(
          event.severity
        )}`}
      >
        {severityLabel}
      </div>
      <div className="ci-country-event-body">
        <div className="ci-country-event-category">
          {categoryLabel(event.category)} ·{" "}
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
          <div
            className={`ci-country-event-confidence${
              event.lowConfidence ? " is-low" : ""
            }`}
          >
            Corroboration weight {event.confidence.toFixed(2)} · heuristic,
            not a probability
          </div>
        ) : null}
        <div
          className={event.severity >= 0 ? "impact-pos" : "impact-neg"}
          style={{ color: pulseImpactColor(event.severity) }}
        >
          {event.isActive
            ? "Published in current evidence window"
            : "Outside current evidence window"}
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

export interface CivicaIndexPanelProps {
  slug: string;
  /** Optional quarter override (mirrors the standalone page's ?quarter=). */
  quarter?: string;
}

/**
 * Server component. Fetches + renders the full Civica Index country body.
 * Returns `null` when no CI detail exists for the slug.
 */
export async function CivicaIndexPanel({ slug, quarter }: CivicaIndexPanelProps) {
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
    if (detail) {
      // Pulse changelog reads the v2 CLASSIFIED, PUBLISHED source — never the
      // legacy `pulse_events` table (which was 100% unclassified, severity 0,
      // and cross-country contaminated). If v2 returns nothing for this
      // country we render a clean empty state below; we do NOT fall back.
      const changelog = await getPulseV2Changelog({
        country: slug,
        deltaEligibleOnly: true,
        withinDays: SCORE_WINDOW_DAYS,
        limit: 20,
      }).catch(() => ({ rows: [] as Awaited<
        ReturnType<typeof getPulseV2Changelog>
      >["rows"] }));
      pulseEvents = changelog.rows.map((r): PulseEvent => {
        const lead = r.sourceDetail[0] ?? null;
        const confidence =
          r.corroborationConfidence != null
            ? Number(r.corroborationConfidence)
            : null;
        return {
          id: r.id,
          eventDate: r.eventDate,
          category: r.category,
          severity: Number(r.severityValue),
          confidence,
          headline: r.headline,
          justification: r.aiSummary ?? r.description ?? null,
          sourceUrl: lead?.sourceUrl ?? null,
          sourceName: lead?.sourceName ?? null,
          isActive: true,
          lowConfidence: confidence != null && confidence < PULSE_LOW_CONFIDENCE,
        };
      });
      // Lead with the most impactful, well-corroborated events: rank by
      // confidence-gated absolute severity so a single low-confidence driver
      // never headlines, then by recency.
      pulseEvents.sort((a, b) => {
        const wa = Math.abs(a.severity) * (a.lowConfidence ? 0.25 : 1);
        const wb = Math.abs(b.severity) * (b.lowConfidence ? 0.25 : 1);
        if (wb !== wa) return wb - wa;
        return b.eventDate.localeCompare(a.eventDate);
      });

      [globalRankings, regionalRankings, compareSuggestions] = await Promise.all(
        [
          getCIRankings(),
          detail.jurisdiction.continent
            ? getCIRankings(undefined, {
                continent: detail.jurisdiction.continent,
              })
            : Promise.resolve([]),
          getRelatedCountries(
            detail.jurisdiction.id,
            detail.jurisdiction.continent,
            3
          ),
        ]
      );
    }
  } catch {}

  const [materialPeerSet, governancePeerSet] = detail
    ? await Promise.all([
        getMaterialPeerSet(detail.jurisdiction.id).catch(() => null),
        getGovernancePeerSet(detail.jurisdiction.id).catch(() => null),
      ])
    : [null, null];

  // Gate cleanly: no CI detail → the host page hides the whole section.
  if (!detail) return null;

  const pulseV2 = await getPulseV2ForCountry(slug).catch(() => null);

  const reconciledFacts = await getCanonicalFactsForJurisdiction(
    detail.jurisdiction.id,
    ["population_total", "capital"]
  ).catch(() => ({}) as Record<string, never>);
  const populationFact = reconciledFacts["population_total"] ?? null;
  const capitalFact = reconciledFacts["capital"] ?? null;

  const { jurisdiction, composite, dimensions } = detail;
  const taxonomy = jurisdiction.governmentClassification ?? null;
  // Count the governance dimensions actually rendered in the breakdown —
  // partial countries (Nauru, Tonga) carry only 3 of the 4 headline
  // dimensions, so the copy must not hardcode `civicaIndex.dimensionCount`.
  // Mirrors the DIMENSION_ORDER filter in <DimensionScoreTable>.
  const renderedDimensionCount = DIMENSION_ORDER.filter((dim) =>
    dimensions.some((d) => d.dimension === dim)
  ).length;
  const completenessAssessment = assessCiCompleteness(
    new Set(dimensions.map((dimension) => dimension.dimension)),
  );
  const unavailableDimensionLabels = completenessAssessment.missing.map(
    (dimension) => DIMENSION_LABELS[dimension] ?? dimension.replaceAll("_", " "),
  );
  const score = composite ? Math.round(composite.score) : null;
  const resolvedCapital =
    capitalFact?.canonical?.factValue ?? jurisdiction.capital ?? null;
  const resolvedPopulation =
    populationFact?.canonical?.factValueNumeric != null
      ? Math.round(populationFact.canonical.factValueNumeric)
      : jurisdiction.population;

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
        completenessFlag:
          (composite.completenessFlag as
            | "full"
            | "partial"
            | "insufficient"
            | null) ?? null,
        rank: composite.rank ?? null,
        tieCount: composite.tieCount ?? null,
        totalRanked: composite.totalRanked ?? null,
        quarter: composite.quarter,
        isPartial: Boolean(composite.isPartial),
        missingDimensions: composite.missingDimensions ?? [],
      }
    : null;
  const previousHistoryPoint =
    typedHistory.length >= 2 ? typedHistory[typedHistory.length - 2] : null;
  const latestHistoryPoint =
    typedHistory.length >= 1 ? typedHistory[typedHistory.length - 1] : null;
  const ciChangeText =
    previousHistoryPoint && latestHistoryPoint
      ? `${
          latestHistoryPoint.score - previousHistoryPoint.score >= 0 ? "+" : ""
        }${(latestHistoryPoint.score - previousHistoryPoint.score).toFixed(
          1
        )} vs ${formatQuarter(previousHistoryPoint.quarter)}`
      : null;

  const rankLabel =
    composite?.rank && composite?.totalRanked
      ? `Rank ${composite.rank} / ${composite.totalRanked}`
      : "Rank pending";
  // Cite as-of date = the real CI quarterly vintage (composite.calculatedAt),
  // omitted rather than fabricated as "today" when no composite exists.
  const citationDate = composite?.calculatedAt
    ? new Date(composite.calculatedAt).toISOString().slice(0, 10)
    : "";
  const citationText = citationDate
    ? `Civica Index for ${jurisdiction.name}, ${citationDate}. Civica Atlas. https://civicaatlas.org/country/${slug}/civica-data`
    : `Civica Index for ${jurisdiction.name}. Civica Atlas. https://civicaatlas.org/country/${slug}/civica-data`;
  const regionalRank =
    jurisdiction.continent && regionalRankings.length > 0
      ? findRankInList(regionalRankings as Array<{ slug?: string | null }>, slug)
      : null;
  const rankInCohort = (
    cohortSlugs: string[] | undefined
  ): { rank: number; total: number } | null => {
    if (!cohortSlugs || cohortSlugs.length === 0) return null;
    const cohortSet = new Set(cohortSlugs);
    const cohortRanked = (
      globalRankings as Array<{ slug?: string | null }>
    ).filter((row) => row.slug && cohortSet.has(row.slug));
    return cohortRanked.length > 0 ? findRankInList(cohortRanked, slug) : null;
  };
  const materialRank = rankInCohort(materialPeerSet?.peerJurisdictionSlugs);
  const governanceRank = rankInCohort(governancePeerSet?.peerJurisdictionSlugs);
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
          value: `${(composite.tieCount ?? 1) > 1 ? "Tied " : ""}#${composite.rank} of ${composite.totalRanked}`,
        }
      : null,
    regionalRank && jurisdiction.continent
      ? {
          label: jurisdiction.continent,
          value: `#${regionalRank.rank} of ${regionalRank.total}`,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="ci-country-detail-page ci-country-detail-page--embedded">
      <div className="ci-country-detail-container">
        <div className="ci-country-rank-strip">{rankLabel}</div>

        {ciScoreData || pulseV2 ? (
          <div id="ci-score" className="ci-country-score-shell">
            <CIScoreDisplay
              ciScore={ciScoreData}
              ciChangeText={ciChangeText}
              dimensionCount={renderedDimensionCount}
            />
            {pulseV2 ? <PulseDimensionalDeltas data={pulseV2} /> : null}
          </div>
        ) : (
          <div className="cv-card" style={{ marginBottom: "var(--space-6)" }}>
            <p className="ci-country-empty-copy">
              Insufficient data for the governance index. Missing: {unavailableDimensionLabels.join(", ")}.
            </p>
          </div>
        )}

        {dimensions.length > 0 ? (
          <section id="ci-dimensions">
            <div className="ci-country-section-eyebrow">
              <span>
                Civica Index breakdown · {renderedDimensionCount} governance
                dimensions
              </span>
              <small>weights empirically derived · source-specific inputs</small>
            </div>
            <h3 className="ci-country-section-title">
              How the {ciScoreData ? Math.round(ciScoreData.score) : "score"} is
              calculated.
            </h3>
            <DimensionScoreTable dimensions={dimensions} />
          </section>
        ) : null}

        <section id="ci-history" className="ci-country-two-col">
          <div className="ci-country-panel">
            <div className="ci-country-section-eyebrow">
              History · quarterly CI trend
            </div>
            <h3 className="ci-country-panel-title">
              How the index has moved over time.
            </h3>
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
                    {typedHistory.length} quarters ·{" "}
                    {formatQuarter(typedHistory[0].quarter)} –{" "}
                    {formatQuarter(
                      typedHistory[typedHistory.length - 1].quarter
                    )}
                  </span>
                </div>
              </>
            ) : (
              <p className="ci-country-panel-copy">
                Historical CI data is not available yet for this country.
              </p>
            )}
          </div>

          <div id="ci-rank" className="ci-country-panel">
            <div className="ci-country-section-eyebrow">Regional rank</div>
            <h3 className="ci-country-panel-title">
              Where {jurisdiction.name} sits against peers.
            </h3>
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

            {materialPeerSet || governancePeerSet ? (
              <div className="ci-country-peer-lenses">
                {materialPeerSet ? (
                  <PeerLensPanel
                    lens="world_bank_region"
                    peerSet={materialPeerSet}
                    rank={
                      materialRank
                        ? {
                            position: materialRank.rank,
                            total: materialRank.total,
                          }
                        : null
                    }
                  />
                ) : null}
                {governancePeerSet ? (
                  <PeerLensPanel
                    lens="vdem_row"
                    peerSet={governancePeerSet}
                    rank={
                      governanceRank
                        ? {
                            position: governanceRank.rank,
                            total: governanceRank.total,
                          }
                        : null
                    }
                  />
                ) : null}
              </div>
            ) : null}

            {compareCards.length > 0 ? (
              <div className="ci-country-compare-block">
                <div className="ci-country-compare-label">Compare with</div>
                <div className="ci-country-compare-links">
                  {compareCards.map((country) => (
                    <Link
                      key={country.slug}
                      href={`/compare?c=${encodeURIComponent(
                        slug
                      )}&c=${encodeURIComponent(country.slug)}`}
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
                <strong
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 6,
                  }}
                >
                  <span>{resolvedCapital ?? "—"}</span>
                  {capitalFact?.canonical ? (
                    <FactValueDot
                      factKey="capital"
                      factLabel="Capital"
                      resolverOutput={capitalFact}
                      canonicalSourceId={capitalFact.canonical.sourceId ?? null}
                      ariaLabel={`Capital ${resolvedCapital ?? ""}, see sources`}
                    />
                  ) : null}
                </strong>
              </div>
              <div className="ci-country-meta-row">
                <span>Population</span>
                <strong
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 6,
                  }}
                >
                  <span>{formatPopulationLong(resolvedPopulation)}</span>
                  {populationFact?.canonical ? (
                    <FactValueDot
                      factKey="population_total"
                      factLabel="Population"
                      resolverOutput={populationFact}
                      canonicalSourceId={
                        populationFact.canonical.sourceId ?? null
                      }
                      ariaLabel={`Population ${formatPopulationLong(
                        resolvedPopulation
                      )}, see sources`}
                    />
                  ) : null}
                </strong>
              </div>
              <div className="ci-country-meta-row">
                <span>Current quarter</span>
                <strong>
                  {composite?.quarter
                    ? formatQuarterLong(composite.quarter)
                    : "—"}
                </strong>
              </div>
              {civicaIndex.status === "beta" ? (
                <div className="ci-country-meta-row">
                  <span>Methodology</span>
                  <strong>Beta</strong>
                </div>
              ) : null}
            </div>

            <div className="ci-country-taxonomy-wrap">
              <GovernmentTaxonomyBlock classification={taxonomy} showNote />
            </div>
          </div>
        </section>

        {/* Long-run source-indicator history — its own numbered-section-
            consistent block. The quarterly CI line above stays; this joins it
            with the decades-long underlying indicators. Soft-fails to null
            when the country has no `indicator_history` rows. */}
        <CountryTrendSection slug={slug} />

        <section id="ci-pulse">
          <div className="ci-country-section-eyebrow">
            <span>Pulse changelog · classified events</span>
            <small>
              {pulseEvents.length > 0
                ? `${pulseEvents.length} published event${
                    pulseEvents.length === 1 ? "" : "s"
                  } · trailing ${SCORE_WINDOW_DAYS} days`
                : `trailing ${SCORE_WINDOW_DAYS} days`}
            </small>
          </div>
          <h3 className="ci-country-section-title">
            Recent classified governance events.
          </h3>
          {pulseEvents.length > 0 ? (
            <div className="ci-country-event-list">
              {pulseEvents.map((event) => (
                <PulseEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="cv-card">
              <p className="ci-country-empty-copy">
                No published Pulse events were detected for {jurisdiction.name}{" "}
                in the current evidence window. This is not evidence that
                governance was stable. Entries queued for human review do not
                appear here. See the{" "}
                <Link href="/civica-index/pulse-changelog">
                  global Pulse changelog
                </Link>{" "}
                for current activity.
              </p>
            </div>
          )}
        </section>

        {score === null &&
        dimensions.length === 0 &&
        pulseEvents.length === 0 ? (
          <div className="cv-card">
            <p className="ci-country-empty-copy">
              Civica Index data for {jurisdiction.name} has not yet been scored.
            </p>
          </div>
        ) : null}

        <div className="ci-country-panel ci-country-citation">{citationText}</div>

        <div className="ci-country-footer-links">
          <Link href="/civica-index">← All countries</Link>
          <Link href="/civica-index/methodology">Methodology →</Link>
          <Link href={`/civica-index/widget?c=${slug}`}>Embed widget →</Link>
        </div>
      </div>
    </div>
  );
}
