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
import { PeerLensPanel } from "@/components/peer-grouping/PeerLensPanel";
import {
  getMaterialPeerSet,
  getGovernancePeerSet,
} from "@/lib/peer-grouping";
import { ciTier as ciTierCanonical } from "@/lib/ci/tiers";
import { civicaIndex } from "@/lib/content/site-state";
import { FactValueDot } from "@/components/factbook/FactValueDot";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";

export const revalidate = 3600;

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
    color: "var(--color-text-primary)",
    bg: info.cssVar,
  };
}

function dimensionColor(score: number): string {
  return ciTierCanonical(score).cssVar;
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
          <stop offset="0%" stopColor="var(--chart-line-default)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--chart-line-default)" stopOpacity="0" />
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

  // Phase 3a — peer-grouping panels (material + governance) replace
  // the retired structural-family rank panel. Each helper hits Phase
  // F's `getCanonicalFactsForJurisdictions` once and degrades to an
  // "unavailable" state if the classification fact-keys haven't synced
  // for this jurisdiction. See ~/civica/plan/structural-family-removal-implementation-plan.md.
  const [materialPeerSet, governancePeerSet] = detail
    ? await Promise.all([
        getMaterialPeerSet(detail.jurisdiction.id).catch(() => null),
        getGovernancePeerSet(detail.jurisdiction.id).catch(() => null),
      ])
    : [null, null];

  if (!detail) notFound();

  // Pulse v2 dimensional deltas. Independent of legacy `pulse` —
  // when 5.10 cuts over fully, the legacy `pulse` field disappears.
  const pulseV2 = await getPulseV2ForCountry(slug).catch(() => null);

  // Phase F.4 — resolver-direct fetch for the in-scope facts surfaced
  // on this page (capital + population in the hero meta strip and the
  // right-panel meta grid). Same migration pattern as the factbook
  // header strip and atlas masthead — when the resolver returns a
  // canonical row, we render `<FactValueDot>` inline next to the value
  // so the alternate-values panel is one click away. When no canonical
  // row exists yet, the page degrades gracefully to the legacy
  // `jurisdictions` cache values without a dot.
  const reconciledFacts = await getCanonicalFactsForJurisdiction(
    detail.jurisdiction.id,
    ["population_total", "capital"],
  ).catch(() => ({}) as Record<string, never>);
  const populationFact = reconciledFacts["population_total"] ?? null;
  const capitalFact = reconciledFacts["capital"] ?? null;

  const { jurisdiction, composite, dimensions, pulse } = detail;
  const taxonomy = jurisdiction.governmentClassification ?? null;
  const score = composite ? Math.round(composite.score) : null;
  // Resolver canonical takes precedence over the legacy cache, mirroring
  // the public API route's contract (see /api/v1/countries/[code]).
  const resolvedCapital = capitalFact?.canonical?.factValue ?? jurisdiction.capital ?? null;
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
  // Hero meta strip. We mark each item with an optional fact-key so
  // the renderer can drop a `<FactValueDot>` inline beside it for
  // resolver-backed values (capital, population).
  type HeroMetaItem = {
    text: string;
    factKey?: "capital" | "population_total";
  };
  const heroMeta: HeroMetaItem[] = [
    taxonomy?.structuralSubtypeLabel ?? taxonomy?.rawLabel ?? jurisdiction.governmentType ?? null,
    resolvedCapital,
    formatPopulationCompact(resolvedPopulation),
    jurisdiction.continent ?? null,
  ]
    .map((text, index): HeroMetaItem | null =>
      text
        ? {
            text,
            factKey:
              index === 1
                ? "capital"
                : index === 2
                  ? "population_total"
                  : undefined,
          }
        : null,
    )
    .filter((item): item is HeroMetaItem => item !== null);
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
  // Compute rank within each peer cohort. The `globalRankings` list
  // is keyed by slug; each peer-set helper returns `peerJurisdictionSlugs`
  // so we can intersect without re-resolving IDs here.
  const rankInCohort = (
    cohortSlugs: string[] | undefined,
  ): { rank: number; total: number } | null => {
    if (!cohortSlugs || cohortSlugs.length === 0) return null;
    const cohortSet = new Set(cohortSlugs);
    const cohortRanked = (
      globalRankings as Array<{ slug?: string | null }>
    ).filter((row) => row.slug && cohortSet.has(row.slug));
    return cohortRanked.length > 0
      ? findRankInList(cohortRanked, slug)
      : null;
  };
  const materialRank = rankInCohort(materialPeerSet?.peerJurisdictionSlugs);
  const governanceRank = rankInCohort(
    governancePeerSet?.peerJurisdictionSlugs,
  );
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
              {heroMeta.map((item, index) => {
                const fact =
                  item.factKey === "capital"
                    ? capitalFact
                    : item.factKey === "population_total"
                      ? populationFact
                      : null;
                return (
                  <span
                    key={`${item.text}-${index}`}
                    style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}
                  >
                    {index > 0 ? <span className="ci-country-meta-dot">·</span> : null}
                    <span>{item.text}</span>
                    {fact?.canonical && item.factKey ? (
                      <FactValueDot
                        factKey={item.factKey}
                        factLabel={item.factKey === "capital" ? "Capital" : "Population"}
                        resolverOutput={fact}
                        canonicalSourceId={fact.canonical.sourceId ?? null}
                        ariaLabel={`${item.factKey === "capital" ? "Capital" : "Population"} ${item.text}, see sources`}
                      />
                    ) : null}
                  </span>
                );
              })}
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
              <span>
                Civica Index breakdown · {civicaIndex.dimensionCount} governance dimensions
              </span>
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

            {materialPeerSet || governancePeerSet ? (
              <div className="ci-country-peer-lenses">
                {materialPeerSet ? (
                  <PeerLensPanel
                    lens="world_bank_region"
                    peerSet={materialPeerSet}
                    rank={
                      materialRank
                        ? { position: materialRank.rank, total: materialRank.total }
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
                        ? { position: governanceRank.rank, total: governanceRank.total }
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
                <strong style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
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
                <strong style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                  <span>{formatPopulationLong(resolvedPopulation)}</span>
                  {populationFact?.canonical ? (
                    <FactValueDot
                      factKey="population_total"
                      factLabel="Population"
                      resolverOutput={populationFact}
                      canonicalSourceId={populationFact.canonical.sourceId ?? null}
                      ariaLabel={`Population ${formatPopulationLong(resolvedPopulation)}, see sources`}
                    />
                  ) : null}
                </strong>
              </div>
              <div className="ci-country-meta-row">
                <span>Current quarter</span>
                <strong>{composite?.quarter ? formatQuarterLong(composite.quarter) : "—"}</strong>
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

        <section id="cite" className="ci-country-cite-section">
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
    </div>
  );
}
