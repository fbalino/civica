import { type NextRequest } from "next/server";
import { checkInMemoryRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { getCICountryDetail } from "@/lib/db/queries";
import {
  V2_DIMENSIONS,
  V2_DIMENSION_LABELS,
  isV2Dimension,
  type CIDimensionV2,
} from "@/lib/ci/dimensions-v2";
import { displayDimensionScore } from "@/lib/ci/normalize-v2";
import { getNormalizationTableRows } from "@/lib/ci/normalization-table";
import {
  getCanonicalFactsForJurisdiction,
  FACTBOOK_RECONCILIATION_META,
  sourceName,
} from "@/lib/factbook/reconcile/api";
import { RIGHTS_REGISTRY_URL } from "@/lib/claims/reuse-rights";

/**
 * Phase F.4 — embed widget reconciled fact-keys.
 *
 * The custom widget surfaces capital / population / GDP / area; pull
 * each from the resolver so the widget cites the same canonical
 * value as the public API and the country page. Resolver canonical
 * takes precedence over the `jurisdictions` cache — they may diverge
 * by up to 24h while the nightly cache job catches up.
 *
 * The widget is read-only HTML inside an iframe, so we render
 * static attribution rather than the interactive `<FactValueDot>`
 * panel used on civicaatlas.org surfaces.
 */
const WIDGET_FACT_KEYS = [
  "capital",
  "population_total",
  "gdp_ppp_usd_billions",
  "area_total_km2",
] as const;

/** Machine-readable attribution for the four sources that feed the displayed
 * Civica Index score. Derive it from the same canonical table that generates
 * the public methodology rather than maintaining another source list here. */
const CIVICA_INDEX_SOURCE_ATTRIBUTION = getNormalizationTableRows()
  .map((row) => row.sourceLabel)
  .join("; ");

// Abuse control: each embed render hits the DB + fact resolver, so an
// unthrottled loop is a cheap scraping / cost vector even with the CDN
// s-maxage. Bound it with the same per-IP in-memory limiter the public
// /api/v1 routes use. 120/min/IP sits far above a page that embeds many
// widgets while stopping a tight scrape loop; the CDN cache absorbs the
// rest.
const EMBED_RATE_LIMIT_MAX = 120;
const EMBED_RATE_LIMIT_WINDOW_MS = 60_000;

const DIMENSION_SHORT_LABELS: Record<CIDimensionV2, string> = {
  democratic_quality: "Dem",
  rule_of_law: "Rule",
  freedom_rights: "Free",
  corruption_control: "Corr",
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // `X-Frame-Options: ALLOWALL` was a no-op — ALLOWALL is not a valid
    // value (only DENY / SAMEORIGIN exist) so browsers ignore it. Cross-
    // origin framing is granted by the CSP `frame-ancestors *` below,
    // which IS the standards-compliant control.
    "Content-Security-Policy": "frame-ancestors *",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { allowed, retryAfterSeconds } = checkInMemoryRateLimit({
    scope: "embed",
    key: getRequestIp(request),
    max: EMBED_RATE_LIMIT_MAX,
    windowMs: EMBED_RATE_LIMIT_WINDOW_MS,
  });
  if (!allowed) {
    return new Response("Rate limit exceeded. Try again shortly.", {
      status: 429,
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/plain",
        "Retry-After": String(retryAfterSeconds),
      },
    });
  }

  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  const size = (["sm", "md", "lg", "custom"].includes(searchParams.get("size") ?? "")
    ? searchParams.get("size")
    : "md") as "sm" | "md" | "lg" | "custom";
  const themeParam = (["light", "dark"].includes(searchParams.get("theme") ?? "")
    ? searchParams.get("theme")
    : null) as "light" | "dark" | null;
  const dims = searchParams.get("dims") === "1";

  // Phase G — custom builder. ?include=ci,capital,gov,pop,gdp,area
  // controls which datapoints render inside the size=custom widget.
  // ?w= and ?h= are user-tunable dimensions. Defaults give a tall card
  // sized for a sidebar.
  const includeRaw = searchParams.get("include") ?? "";
  const allowedInclude = new Set(["ci", "capital", "gov", "pop", "gdp", "area"]);
  const include = new Set(
    includeRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => allowedInclude.has(s)),
  );
  const customW = clampInt(searchParams.get("w"), 280, 600, 360);
  const customH = clampInt(searchParams.get("h"), 120, 800, 320);

  let detail: Awaited<ReturnType<typeof getCICountryDetail>> = null;
  let canonicalFacts: Awaited<
    ReturnType<typeof getCanonicalFactsForJurisdiction>
  > = {};

  try {
    detail = await getCICountryDetail(slug);
    if (detail) {
      const tasks: Promise<unknown>[] = [
        getCanonicalFactsForJurisdiction(detail.jurisdiction.id, [
          ...WIDGET_FACT_KEYS,
        ]).then((r) => {
          canonicalFacts = r;
        }),
      ];
      await Promise.all(tasks);
    }
  } catch {
    return new Response("Service unavailable", {
      status: 503,
      headers: corsHeaders(),
    });
  }

  if (!detail) {
    return new Response("Not found", {
      status: 404,
      headers: { ...corsHeaders(), "Content-Type": "text/plain" },
    });
  }

  const { jurisdiction, composite } = detail;

  // Phase F.4 — prefer resolver canonical over the `jurisdictions`
  // cache for every reconciled field this widget renders.
  const capitalRow = canonicalFacts["capital"]?.canonical;
  const populationRow = canonicalFacts["population_total"]?.canonical;
  const gdpRow = canonicalFacts["gdp_ppp_usd_billions"]?.canonical;
  const areaRow = canonicalFacts["area_total_km2"]?.canonical;

  const reconciledCapital = capitalRow?.factValue ?? jurisdiction.capital ?? null;
  const reconciledPopulation =
    populationRow?.factValueNumeric != null
      ? Math.round(populationRow.factValueNumeric)
      : jurisdiction.population ?? null;
  const reconciledGdpBillions =
    gdpRow?.factValueNumeric ?? jurisdiction.gdpBillions ?? null;
  const reconciledAreaSqKm =
    areaRow?.factValueNumeric != null
      ? Math.round(areaRow.factValueNumeric)
      : jurisdiction.areaSqKm ?? null;

  // Build a static citation line for the widget footer (read-only,
  // no interactive panel inside the iframe). Dedupes the canonical
  // sources backing the visible fields and keeps the order stable.
  const attributionSourceIds: string[] = [];
  for (const row of [capitalRow, populationRow, gdpRow, areaRow]) {
    if (row?.sourceId && !attributionSourceIds.includes(row.sourceId)) {
      attributionSourceIds.push(row.sourceId);
    }
  }
  const attributionLabel =
    attributionSourceIds.length > 0
      ? attributionSourceIds.map((id) => sourceName(id)).join(" · ")
      : null;
  const ciScore = composite?.score ?? null;
  const ciInt = ciScore !== null ? Math.round(ciScore) : null;
  const ciDisplay = ciInt !== null ? String(ciInt) : "—";
  const ciMeta = ciScore !== null ? ciScore.toFixed(1) : "—";

  const rank = composite?.rank ?? null;
  const totalRanked = composite?.totalRanked ?? null;

  const dimScores = buildDimScores(detail.dimensions);
  const showDims = size === "lg" && dims && dimScores.length > 0;

  // Real data vintage + as-of — never clock-derived. This widget is a
  // public, screenshot-able, citation-meant card, so a fabricated
  // "today" date would misrepresent the data's freshness (the same
  // fabrication already fixed on the Civica Index hero). The CI
  // composite is a quarterly, frozen vintage: surface its real period
  // label (`quarter`) and its real computed-at timestamp
  // (`calculated_at`). When no composite exists there is no honest date
  // to show, so `updatedDate` falls back to "" and the consuming markup
  // omits the "UPDATED" line entirely rather than inventing one.
  const quarterLabel = formatQuarterLabel(composite?.quarter ?? null);
  const updatedDate = composite?.calculatedAt
    ? new Date(composite.calculatedAt)
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase()
    : "";

  const { width, height } =
    size === "custom"
      ? { width: customW, height: customH }
      : SIZE_MAP[size];

  const html = buildHtml({
    size,
    themeParam,
    dims: showDims,
    jurisdiction: {
      ...jurisdiction,
      // Override cache with resolver canonical for any field the
      // widget renders, falling back to cache when the resolver has
      // no row.
      capital: reconciledCapital,
      population: reconciledPopulation,
      gdpBillions: reconciledGdpBillions,
      areaSqKm: reconciledAreaSqKm,
    },
    ciDisplay,
    ciMeta,
    rank,
    totalRanked,
    quarterLabel,
    updatedDate,
    dimScores,
    width,
    height,
    include,
    attributionLabel,
  });

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SIZE_MAP = {
  sm: { width: 300, height: 80 },
  md: { width: 320, height: 180 },
  lg: { width: 400, height: 260 },
};

type DimensionRow = {
  dimension: string;
  normalizedScore: number | null;
  rawValue: number | null;
  sourceId: string;
};

function buildDimScores(dimensions: DimensionRow[]) {
  const byDimension = new Map<CIDimensionV2, number>();

  for (const row of dimensions) {
    if (!isV2Dimension(row.dimension)) continue;
    // Recompute on the v2 fixed-bound scale so the embed card matches
    // the country page + public API. Fall back to the stored legacy
    // normalized_score only when raw value / source is unavailable.
    const score =
      displayDimensionScore(row.rawValue, row.sourceId) ?? row.normalizedScore;
    if (score === null) continue;
    if (!byDimension.has(row.dimension)) {
      byDimension.set(row.dimension, score);
    }
  }

  return V2_DIMENSIONS.flatMap((dimension) => {
    const score = byDimension.get(dimension);
    if (score === undefined) return [];
    return {
      label: DIMENSION_SHORT_LABELS[dimension],
      title: V2_DIMENSION_LABELS[dimension],
      score: Math.min(100, Math.max(0, Math.round(score))),
    };
  });
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clampInt(
  raw: string | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Format the real CI composite quarter (`YYYY-QN`, e.g. "2026-Q3")
 * into the compact dotlabel form ("Q3 · 2026"). Returns "" when no
 * quarter is available, and echoes any unrecognized value verbatim —
 * the widget never fabricates a period from the wall clock.
 */
function formatQuarterLabel(quarter: string | null): string {
  if (!quarter) return "";
  const match = /^(\d{4})-Q([1-4])$/.exec(quarter);
  if (!match) return quarter;
  return `Q${match[2]} · ${match[1]}`;
}

// ─── HTML builder ────────────────────────────────────────────────────────────

interface BuildHtmlArgs {
  size: "sm" | "md" | "lg" | "custom";
  themeParam: "light" | "dark" | null;
  dims: boolean;
  jurisdiction: {
    name: string;
    slug: string;
    governmentType: string | null;
    capital?: string | null;
    population?: number | null;
    gdpBillions?: number | null;
    areaSqKm?: number | null;
  };
  ciDisplay: string;
  ciMeta: string;
  rank: number | null;
  totalRanked: number | null;
  quarterLabel: string;
  updatedDate: string;
  dimScores: { label: string; title?: string; score: number | null }[];
  width: number;
  height: number;
  include: Set<string>;
  /**
   * Phase F.4 — static attribution string for the widget footer
   * (e.g. `"CIA World Factbook · Wikidata"`). Built from the
   * canonical source IDs backing the visible reconciled fields.
   * `null` when the resolver returned no canonical rows.
   */
  attributionLabel: string | null;
}

function buildHtml(args: BuildHtmlArgs): string {
  const {
    size, themeParam, dims, jurisdiction,
    ciDisplay, ciMeta,
    rank, totalRanked, quarterLabel, updatedDate,
    dimScores, width, height, include, attributionLabel,
  } = args;

  const themeAttr = themeParam ? ` data-theme="${themeParam}"` : "";
  const govType = jurisdiction.governmentType
    ? jurisdiction.governmentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  const rankStr =
    rank && totalRanked
      ? `Rank ${rank} of ${totalRanked}`
      : "";
  const scorePct = ciDisplay !== "—" ? Math.round(Number(ciDisplay)) : 0;

  // Phase F.4 — read-only attribution line that lists the canonical
  // sources backing the visible reconciled facts (population, GDP,
  // area, capital). Only renders when the resolver returned at least
  // one canonical row; the small widget skips it for space reasons.
  // PUBLIC_CLAIM: embed.reconciled-attribution
  const attributionHtml = attributionLabel
    ? `<div class="attribution mono">Source: ${esc(attributionLabel)} · Civica Atlas reconciled ${esc(FACTBOOK_RECONCILIATION_META.version)}</div>`
    : "";

  const dimBarsHtml = dimScores
    .map((d) => {
      const pct = d.score ?? 0;
      const fillH = Math.round((pct / 100) * 28);
      const titleAttr = d.title ? ` title="${esc(d.title)}"` : "";
      return `<div class="dim-col"><div class="dim-bar-wrap"><div class="dim-fill" style="height:${fillH}px"></div></div><span class="dim-lbl"${titleAttr}>${esc(d.label)}</span></div>`;
    })
    .join("");

  // PROVENANCE_COVERAGE: embeds.small-index
  const smBody = `<a class="civica-widget small" href="https://civicaatlas.org/country/${esc(jurisdiction.slug)}/civica-data" target="_blank" rel="noopener">
  <div class="mark serif">C</div>
  <div class="body">
    <div class="country">${esc(jurisdiction.name)}</div>
    <div class="meta mono">CI ${esc(ciMeta)} &middot; ${esc(quarterLabel)} &middot; BETA</div>
  </div>
  <div class="score serif">${esc(ciDisplay)}</div>
</a>`;

  // PUBLIC_CLAIM: embed.index-score
  // PUBLIC_CLAIM: embeds.reuse-rights
  // PROVENANCE_COVERAGE: embeds.medium-index
  const mdBody = `<a class="civica-widget medium" href="https://civicaatlas.org/country/${esc(jurisdiction.slug)}/civica-data" target="_blank" rel="noopener">
  <div class="top">
    <div class="brand">Civica Index <span class="dotlabel mono"><span class="dot frozen"></span> ${esc(quarterLabel)}</span></div>
    <div class="gov mono">${esc(govType)}</div>
  </div>
  <div class="country-row">
    <div class="name serif">${esc(jurisdiction.name)}</div>
    <div class="num serif">${esc(ciDisplay)}</div>
  </div>
  <div class="score-context">
    <span>Research beta</span><span class="mono">NO COUNTRY GRADE</span>
  </div>
  <div class="score-position"><span style="width:${scorePct}%"></span></div>
  ${attributionHtml}
  <div class="foot mono">
    <span>Reuse: civicaatlas.org/licensing</span>
    ${updatedDate ? `<span>UPDATED &middot; ${esc(updatedDate)}</span>` : ""}
  </div>
</a>`;

  // PROVENANCE_COVERAGE: embeds.large-index
  const lgBody = `<a class="civica-widget large" href="https://civicaatlas.org/country/${esc(jurisdiction.slug)}/civica-data" target="_blank" rel="noopener">
  <div class="top">
    <div class="brand">Civica Index <span class="dotlabel mono"><span class="dot frozen"></span> ${esc(quarterLabel)}</span></div>
    <div class="gov mono">${esc(govType)}</div>
  </div>
  <div class="headline">
    <div>
      <h4 class="name">${esc(jurisdiction.name)}</h4>
      ${rankStr ? `<div class="sub mono">${esc(rankStr)}</div>` : ""}
    </div>
    <div class="num serif">${esc(ciDisplay)}<small class="mono">/ 100</small></div>
  </div>
  <div class="score-context">
    <span>Research beta &middot; no country grade</span><span class="mono">QUARTERLY CI</span>
  </div>
  <div class="score-position"><span style="width:${scorePct}%"></span></div>
  ${dims ? `<div class="dims">${dimBarsHtml}</div>` : ""}
  ${attributionHtml}
  <div class="foot mono">
    <span>Reuse: civicaatlas.org/licensing</span>
    ${updatedDate ? `<span>UPDATED &middot; ${esc(updatedDate)}</span>` : ""}
  </div>
</a>`;

  // Phase G — custom widget. Stacks rows for whichever datapoints the
  // builder selected. CI shows as a score chip when a real value exists;
  // everything else shows
  // as a label/value row. If `include` is empty, fall back to a sensible
  // default (CI + capital + government type).
  const includeSet =
    include.size > 0 ? include : new Set(["ci", "capital", "gov"]);
  const factRow = (label: string, value: string | null | undefined) =>
    value
      ? `<div class="cf-row"><span class="cf-k mono">${esc(label)}</span><span class="cf-v">${esc(value)}</span></div>`
      : "";
  const popValue =
    typeof jurisdiction.population === "number"
      ? formatPopulation(jurisdiction.population)
      : null;
  const gdpValue =
    typeof jurisdiction.gdpBillions === "number"
      ? `$${jurisdiction.gdpBillions.toFixed(1)}B`
      : null;
  const areaValue =
    typeof jurisdiction.areaSqKm === "number"
      ? `${formatNumber(jurisdiction.areaSqKm)} km²`
      : null;
  const customRowsHtml = [
    includeSet.has("ci")
      ? `<div class="cf-score-row"><span class="cf-score-label mono">CI</span><span class="cf-score-val serif">${esc(ciDisplay)}</span><span class="cf-score-meta mono">RESEARCH BETA</span></div>`
      : "",
    includeSet.has("capital") ? factRow("Capital", jurisdiction.capital) : "",
    includeSet.has("gov") ? factRow("Government", govType || null) : "",
    includeSet.has("pop") ? factRow("Population", popValue) : "",
    includeSet.has("gdp") ? factRow("GDP", gdpValue) : "",
    includeSet.has("area") ? factRow("Area", areaValue) : "",
  ]
    .filter(Boolean)
    .join("");

  // PROVENANCE_COVERAGE: embeds.custom-facts
  const customBody = `<a class="civica-widget custom" href="https://civicaatlas.org/country/${esc(jurisdiction.slug)}" target="_blank" rel="noopener">
  <div class="cf-top">
    <div class="cf-brand">Civica Index <span class="dotlabel mono"><span class="dot frozen"></span> ${esc(quarterLabel)}</span></div>
  </div>
  <div class="cf-name serif">${esc(jurisdiction.name)}</div>
  <div class="cf-rows">${customRowsHtml}</div>
  ${attributionHtml}
  <div class="cf-foot mono">
    <span>Reuse: civicaatlas.org/licensing</span>
    ${updatedDate ? `<span>UPDATED &middot; ${esc(updatedDate)}</span>` : ""}
  </div>
</a>`;

  const body =
    size === "sm"
      ? smBody
      : size === "md"
        ? mdBody
        : size === "lg"
          ? lgBody
          : customBody;

  return `<!DOCTYPE html>
<html lang="en"${themeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width},initial-scale=1">
<meta name="civica:sources" content="${esc(CIVICA_INDEX_SOURCE_ATTRIBUTION)}">
<meta name="civica:rights" content="${RIGHTS_REGISTRY_URL}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:${width}px;height:${height}px;overflow:hidden;-webkit-font-smoothing:antialiased}

/* Light tokens (default) */
:root{
  --paper:#FAF7F2;--paper-2:#F3EFE6;--paper-3:#EDE9E2;
  --ink:#0B1B2D;--ink-2:#2A3648;--ink-3:#6A7688;
  --rule:#E4E1DC;--rule-soft:#EDE9E2;
  --live:#2E7D55;--frozen:#C08F3E;--indicator:var(--ink-2);
  --shadow-hard:0 1px 2px rgba(15,23,42,.06);--shadow-hard-lg:0 4px 12px rgba(15,23,42,.10);
}
/* System dark override */
@media(prefers-color-scheme:dark){
  :root{
    --paper:#16140f;--paper-2:#221e16;--paper-3:#2b2619;
    --ink:#ebe6d6;--ink-2:#c4bdae;--ink-3:#8a8370;
    --rule:#3d382d;--rule-soft:#2b2619;
    --live:#5BA77E;--frozen:#D6AE63;--indicator:var(--ink-2);
    --shadow-hard:0 1px 2px rgba(0,0,0,.4);--shadow-hard-lg:0 6px 16px rgba(0,0,0,.5);
  }
}
/* Explicit param overrides */
[data-theme="light"]{
  --paper:#FAF7F2;--paper-2:#F3EFE6;--paper-3:#EDE9E2;
  --ink:#0B1B2D;--ink-2:#2A3648;--ink-3:#6A7688;
  --rule:#E4E1DC;--rule-soft:#EDE9E2;
  --live:#2E7D55;--frozen:#C08F3E;--indicator:var(--ink-2);
  --shadow-hard:0 1px 2px rgba(15,23,42,.06);--shadow-hard-lg:0 4px 12px rgba(15,23,42,.10);
}
[data-theme="dark"]{
  --paper:#16140f;--paper-2:#221e16;--paper-3:#2b2619;
  --ink:#ebe6d6;--ink-2:#c4bdae;--ink-3:#8a8370;
  --rule:#3d382d;--rule-soft:#2b2619;
  --live:#5BA77E;--frozen:#D6AE63;--indicator:var(--ink-2);
  --shadow-hard:0 1px 2px rgba(0,0,0,.4);--shadow-hard-lg:0 6px 16px rgba(0,0,0,.5);
}

body{background:var(--paper);color:var(--ink);font-family:'Inter',system-ui,sans-serif}

.serif{font-family:'Source Serif 4',Georgia,serif;font-optical-sizing:auto}
.mono{font-family:ui-monospace,'SF Mono',Menlo,monospace}

/* Provenance dots */
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.dot.live{background:var(--live);box-shadow:0 0 0 3px color-mix(in oklch,var(--live) 20%,transparent);animation:pulse 2s ease-in-out infinite}
.dot.frozen{background:var(--frozen)}
@keyframes pulse{0%,100%{box-shadow:0 0 0 3px color-mix(in oklch,var(--live) 22%,transparent)}50%{box-shadow:0 0 0 6px color-mix(in oklch,var(--live) 10%,transparent)}}
@media(prefers-reduced-motion:reduce){.dot.live{animation:none}}

/* Base widget */
.civica-widget{
  font-family:'Inter',system-ui,sans-serif;
  background:var(--paper);color:var(--ink);
  border:1px solid var(--rule);
  box-shadow:var(--shadow-hard);
  border-radius:12px;
  display:block;
  text-decoration:none;
  transition:transform 120ms ease,box-shadow 120ms ease;
}
.civica-widget:hover{transform:translateY(-1px);box-shadow:var(--shadow-hard-lg)}
.civica-widget:focus-visible{outline:2px solid var(--indicator);outline-offset:2px}

/* Phase F.4 — read-only source attribution line. Sized to match the
   existing widget meta typography so it doesn't visually compete
   with the foot URL row. */
.civica-widget .attribution{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:9px;color:var(--ink-3);letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ── Small 300×80 ── */
.civica-widget.small{
  width:300px;padding:12px 14px;
  display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;
}
.civica-widget.small .mark{
  width:32px;height:32px;
  display:grid;place-items:center;
  background:var(--ink);color:var(--paper);
  font-family:'Source Serif 4',serif;font-weight:600;font-size:16px;
  flex-shrink:0;
}
.civica-widget.small .body{display:flex;flex-direction:column;gap:2px;min-width:0}
.civica-widget.small .country{font-size:13px;font-weight:600;letter-spacing:-0.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.civica-widget.small .meta{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--ink-3);letter-spacing:0.03em}
.civica-widget.small .score{
  font-family:'Source Serif 4',serif;font-weight:500;font-size:32px;line-height:1;letter-spacing:-0.02em;
  padding-left:12px;border-left:1px solid var(--rule);
}

/* ── Medium 320×180 ── */
.civica-widget.medium{
  width:320px;height:180px;padding:12px 16px 10px;
  display:flex;flex-direction:column;gap:5px;
}
.civica-widget.medium .top{display:flex;justify-content:space-between;align-items:center}
.civica-widget.medium .brand{font-family:'Source Serif 4',serif;font-weight:600;font-size:13px;letter-spacing:-0.005em}
.civica-widget.medium .dotlabel{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-weight:400;font-size:10px;color:var(--ink-3);margin-left:6px;text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.medium .gov{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.medium .country-row{display:flex;justify-content:space-between;align-items:baseline}
.civica-widget.medium .name{font-family:'Source Serif 4',serif;font-weight:500;font-size:20px;letter-spacing:-0.015em}
.civica-widget.medium .num{font-family:'Source Serif 4',serif;font-weight:500;font-size:38px;line-height:0.95;letter-spacing:-0.025em}
.civica-widget.medium .score-context{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--ink-2)}
.civica-widget.medium .score-position{position:relative;height:4px;background:var(--rule-soft)}
.civica-widget.medium .score-position>span{position:absolute;inset:0 auto 0 0;background:var(--indicator)}
.civica-widget.medium .attribution{font-size:8px}
.civica-widget.medium .foot{display:flex;justify-content:space-between;align-items:center;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:9px;color:var(--ink-3);padding-top:4px;border-top:1px dashed var(--rule)}

/* ── Large 400×260 ── */
.civica-widget.large{
  width:400px;padding:20px 22px 18px;
  display:flex;flex-direction:column;gap:14px;
}
.civica-widget.large .top{display:flex;justify-content:space-between;align-items:center}
.civica-widget.large .brand{font-family:'Source Serif 4',serif;font-weight:600;font-size:14px}
.civica-widget.large .dotlabel{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-weight:400;font-size:10px;color:var(--ink-3);margin-left:6px;text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.large .gov{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.large .headline{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:end}
.civica-widget.large .name{font-family:'Source Serif 4',serif;font-weight:500;font-size:26px;letter-spacing:-0.018em;margin:0 0 2px}
.civica-widget.large .sub{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.large .num{font-family:'Source Serif 4',serif;font-weight:500;font-size:58px;line-height:0.9;letter-spacing:-0.03em}
.civica-widget.large .num small{font-size:15px;color:var(--ink-3);font-family:ui-monospace,'SF Mono',Menlo,monospace;font-weight:400;letter-spacing:0;display:block;margin-top:4px}
.civica-widget.large .score-context{display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--ink-2)}
.civica-widget.large .score-position{position:relative;height:4px;background:var(--rule-soft)}
.civica-widget.large .score-position>span{position:absolute;inset:0 auto 0 0;background:var(--indicator)}
.civica-widget.large .dims{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding-top:2px}
.civica-widget.large .dim-col{display:flex;flex-direction:column;gap:4px}
.civica-widget.large .dim-bar-wrap{height:32px;background:var(--rule-soft);position:relative;display:flex;align-items:flex-end}
.civica-widget.large .dim-fill{width:100%;background:var(--indicator)}
.civica-widget.large .dim-lbl{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:9px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.06em;text-align:center}
.civica-widget.large .foot{display:flex;justify-content:space-between;align-items:center;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--ink-3);padding-top:8px;border-top:1px dashed var(--rule)}

/* ── Custom (builder mode) ── */
.civica-widget.custom{
  width:${width}px;padding:18px 20px 14px;
  display:flex;flex-direction:column;gap:10px;
  height:${height}px;
}
.civica-widget.custom .cf-top{display:flex;justify-content:space-between;align-items:center}
.civica-widget.custom .cf-brand{font-family:'Source Serif 4',serif;font-weight:600;font-size:13px;letter-spacing:-0.005em}
.civica-widget.custom .dotlabel{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-weight:400;font-size:10px;color:var(--ink-3);margin-left:6px;text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.custom .cf-name{font-family:'Source Serif 4',serif;font-weight:500;font-size:22px;letter-spacing:-0.015em;line-height:1.05}
.civica-widget.custom .cf-rows{display:flex;flex-direction:column;gap:6px;flex:1;min-height:0;overflow:hidden}
.civica-widget.custom .cf-score-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--rule-soft)}
.civica-widget.custom .cf-score-label{font-size:10px;color:var(--ink-3);letter-spacing:0.12em;text-transform:uppercase}
.civica-widget.custom .cf-score-val{font-size:22px;font-weight:500;letter-spacing:-0.015em;line-height:1}
.civica-widget.custom .cf-score-meta{font-size:10px;color:var(--ink-3);letter-spacing:0.1em;text-transform:uppercase}
.civica-widget.custom .cf-row{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:baseline;padding:3px 0}
.civica-widget.custom .cf-k{font-size:10px;color:var(--ink-3);letter-spacing:0.1em;text-transform:uppercase}
.civica-widget.custom .cf-v{font-size:13px;color:var(--ink);text-align:right}
.civica-widget.custom .cf-foot{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--ink-3);padding-top:6px;border-top:1px dashed var(--rule)}
</style>
</head>
<body>
${body}
</body>
</html>`;
}
