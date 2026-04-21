import { type NextRequest } from "next/server";
import { getCICountryDetail, getCountryFacts } from "@/lib/db/queries";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Frame-Options": "ALLOWALL",
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
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  const size = (["sm", "md", "lg"].includes(searchParams.get("size") ?? "")
    ? searchParams.get("size")
    : "md") as "sm" | "md" | "lg";
  const themeParam = (["light", "dark"].includes(searchParams.get("theme") ?? "")
    ? searchParams.get("theme")
    : null) as "light" | "dark" | null;
  const dims = searchParams.get("dims") === "1";

  let detail: Awaited<ReturnType<typeof getCICountryDetail>> = null;
  let facts: Awaited<ReturnType<typeof getCountryFacts>> = [];

  try {
    detail = await getCICountryDetail(slug);
    if (detail && size === "lg" && dims) {
      facts = await getCountryFacts(detail.jurisdiction.id);
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
  const ciScore = composite?.score ?? null;
  const ciInt = ciScore !== null ? Math.round(ciScore) : null;
  const ciDisplay = ciInt !== null ? String(ciInt) : "—";
  const ciMeta = ciScore !== null ? ciScore.toFixed(1) : "—";
  const cpScore = ciScore !== null ? ciScore.toFixed(1) : "—";

  const tier =
    ciInt !== null ? getTier(ciInt) : { label: "N/A", cssVar: "--t-mixed" };
  const rank = composite?.rank ?? null;
  const totalRanked = composite?.totalRanked ?? null;

  const dimScores = buildDimScores(facts, ciScore);

  const now = new Date();
  const qNum = Math.ceil((now.getMonth() + 1) / 3);
  const quarterLabel = `Q${qNum} · ${now.getFullYear()}`;
  const updatedDate = now
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();

  const { width, height } = SIZE_MAP[size];

  const html = buildHtml({
    size,
    themeParam,
    dims,
    jurisdiction,
    ciDisplay,
    ciMeta,
    cpScore,
    tier,
    rank,
    totalRanked,
    quarterLabel,
    updatedDate,
    dimScores,
    width,
    height,
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

function getTier(score: number): { label: string; cssVar: string } {
  if (score >= 90) return { label: "Exceptional", cssVar: "--t-excep" };
  if (score >= 75) return { label: "Strong", cssVar: "--t-strong" };
  if (score >= 50) return { label: "Mixed", cssVar: "--t-mixed" };
  if (score >= 25) return { label: "Weak", cssVar: "--t-weak" };
  return { label: "Failed", cssVar: "--t-failed" };
}

type FactRow = { factKey: string; factValueNumeric: number | null };

function buildDimScores(facts: FactRow[], ciScore: number | null) {
  const m: Record<string, number | null> = {};
  for (const f of facts) {
    m[f.factKey] = f.factValueNumeric;
  }

  const dem = ciScore;

  const leRaw = m["life_expectancy"];
  const live =
    leRaw != null ? Math.min(100, Math.max(0, ((leRaw - 40) / 50) * 100)) : null;

  const gdpRaw = m["gdp_per_capita_ppp"];
  const rule =
    gdpRaw != null
      ? Math.min(100, Math.max(0, (Math.log(Math.max(1, gdpRaw)) / Math.log(120000)) * 100))
      : null;

  const growthRaw = m["gdp_growth_rate"];
  const econ =
    growthRaw != null
      ? Math.min(100, Math.max(0, 50 + (growthRaw - 3) * 5))
      : null;

  const ecol = m["electricity_access"] ?? null;

  const milRaw = m["military_expenditure_pct_gdp"];
  const stab =
    milRaw != null ? Math.min(100, Math.max(0, 100 - milRaw * 5)) : null;

  return [
    { label: "Dem", title: "Democratic", score: dem !== null ? Math.round(dem) : null },
    { label: "Livh", title: "Livelihoods", score: live !== null ? Math.round(live) : null },
    { label: "Rule", title: "Rule of law", score: rule !== null ? Math.round(rule) : null },
    { label: "Econ", title: "Economic", score: econ !== null ? Math.round(econ) : null },
    { label: "Ecol", title: "Ecological", score: ecol !== null ? Math.round(ecol) : null },
    { label: "Stab", title: "Stability", score: stab !== null ? Math.round(stab) : null },
  ];
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── HTML builder ────────────────────────────────────────────────────────────

interface BuildHtmlArgs {
  size: "sm" | "md" | "lg";
  themeParam: "light" | "dark" | null;
  dims: boolean;
  jurisdiction: { name: string; slug: string; governmentType: string | null };
  ciDisplay: string;
  ciMeta: string;
  cpScore: string;
  tier: { label: string; cssVar: string };
  rank: number | null;
  totalRanked: number | null;
  quarterLabel: string;
  updatedDate: string;
  dimScores: { label: string; title?: string; score: number | null }[];
  width: number;
  height: number;
}

function buildHtml(args: BuildHtmlArgs): string {
  const {
    size, themeParam, dims, jurisdiction,
    ciDisplay, ciMeta, cpScore,
    tier, rank, totalRanked, quarterLabel, updatedDate,
    dimScores, width, height,
  } = args;

  const themeAttr = themeParam ? ` data-theme="${themeParam}"` : "";
  const govType = jurisdiction.governmentType
    ? jurisdiction.governmentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  const rankStr =
    rank && totalRanked
      ? `Rank ${rank} of ${totalRanked}`
      : "";
  const tierPct = ciDisplay !== "—" ? Math.round(Number(ciDisplay)) : 0;

  const dimBarsHtml = dimScores
    .map((d) => {
      const pct = d.score ?? 0;
      const fillH = Math.round((pct / 100) * 28);
      const titleAttr = d.title ? ` title="${esc(d.title)}"` : "";
      return `<div class="dim-col"><div class="dim-bar-wrap"><div class="dim-fill" style="height:${fillH}px"></div></div><span class="dim-lbl"${titleAttr}>${esc(d.label)}</span></div>`;
    })
    .join("");

  const smBody = `<a class="civica-widget small" href="https://civicaatlas.org/civica-index/${esc(jurisdiction.slug)}" target="_blank" rel="noopener" style="--tier:var(${tier.cssVar})">
  <div class="mark serif">C</div>
  <div class="body">
    <div class="country">${esc(jurisdiction.name)}</div>
    <div class="meta mono">CI ${esc(ciMeta)} &middot; CP ${esc(cpScore)} &middot; ${esc(tier.label.toUpperCase())}</div>
  </div>
  <div class="score serif">${esc(ciDisplay)}</div>
</a>`;

  const mdBody = `<a class="civica-widget medium" href="https://civicaatlas.org/civica-index/${esc(jurisdiction.slug)}" target="_blank" rel="noopener" style="--tier:var(${tier.cssVar})">
  <div class="top">
    <div class="brand">Civica Index <span class="dotlabel mono"><span class="dot frozen"></span> ${esc(quarterLabel)}</span></div>
    <div class="gov mono">${esc(govType)}</div>
  </div>
  <div class="country-row">
    <div class="name serif">${esc(jurisdiction.name)}</div>
    <div class="num serif">${esc(ciDisplay)}</div>
  </div>
  <div class="tier-row">
    <span>${esc(tier.label)}</span><span class="mono">CP ${esc(cpScore)} &middot; LIVE</span>
  </div>
  <div class="tier-bar"><span style="width:${tierPct}%"></span></div>
  <div class="foot mono">
    <span>civica.io/countries/${esc(jurisdiction.slug)}</span>
    <span>LIVE</span>
  </div>
</a>`;

  const lgBody = `<a class="civica-widget large" href="https://civicaatlas.org/civica-index/${esc(jurisdiction.slug)}" target="_blank" rel="noopener" style="--tier:var(${tier.cssVar})">
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
  <div class="tier-label">
    <span>${esc(tier.label)}</span><span class="mono">CP ${esc(cpScore)} &middot; LIVE</span>
  </div>
  <div class="tier-bar"><span style="width:${tierPct}%"></span></div>
  ${dims ? `<div class="dims">${dimBarsHtml}</div>` : ""}
  <div class="foot mono">
    <span>civica.io/countries/${esc(jurisdiction.slug)}</span>
    <span>UPDATED &middot; ${esc(updatedDate)}</span>
  </div>
</a>`;

  const body = size === "sm" ? smBody : size === "md" ? mdBody : lgBody;

  return `<!DOCTYPE html>
<html lang="en"${themeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width},initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:${width}px;height:${height}px;overflow:hidden;-webkit-font-smoothing:antialiased}

/* Light tokens (default) */
:root{
  --paper:#f4f1ea;--paper-2:#ebe6d6;--paper-3:#ddd6c2;
  --ink:#16140f;--ink-2:#3a362c;--ink-3:#6a6354;
  --rule:#cdc6b2;--rule-soft:#ddd6c2;
  --live:oklch(62% 0.14 155);--frozen:oklch(72% 0.14 70);
  --t-failed:oklch(45% 0.16 25);--t-weak:oklch(65% 0.15 45);
  --t-mixed:oklch(75% 0.12 85);--t-strong:oklch(62% 0.12 155);--t-excep:oklch(52% 0.14 195);
  --shadow-hard:3px 3px 0 var(--ink);--shadow-hard-lg:6px 6px 0 var(--ink);
}
/* System dark override */
@media(prefers-color-scheme:dark){
  :root{
    --paper:#16140f;--paper-2:#1f1c15;--paper-3:#2a261d;
    --ink:#f4f1ea;--ink-2:#d9d2c0;--ink-3:#9d9684;
    --rule:#3a362c;--rule-soft:#2a261d;
    --live:oklch(72% 0.15 155);--frozen:oklch(78% 0.15 70);
    --t-failed:oklch(58% 0.17 25);--t-weak:oklch(72% 0.15 45);
    --t-mixed:oklch(82% 0.12 85);--t-strong:oklch(70% 0.13 155);--t-excep:oklch(62% 0.14 195);
    --shadow-hard:3px 3px 0 #000;--shadow-hard-lg:6px 6px 0 #000;
  }
}
/* Explicit param overrides */
[data-theme="light"]{
  --paper:#f4f1ea;--paper-2:#ebe6d6;--paper-3:#ddd6c2;
  --ink:#16140f;--ink-2:#3a362c;--ink-3:#6a6354;
  --rule:#cdc6b2;--rule-soft:#ddd6c2;
  --live:oklch(62% 0.14 155);--frozen:oklch(72% 0.14 70);
  --t-failed:oklch(45% 0.16 25);--t-weak:oklch(65% 0.15 45);
  --t-mixed:oklch(75% 0.12 85);--t-strong:oklch(62% 0.12 155);--t-excep:oklch(52% 0.14 195);
  --shadow-hard:3px 3px 0 var(--ink);--shadow-hard-lg:6px 6px 0 var(--ink);
}
[data-theme="dark"]{
  --paper:#16140f;--paper-2:#1f1c15;--paper-3:#2a261d;
  --ink:#f4f1ea;--ink-2:#d9d2c0;--ink-3:#9d9684;
  --rule:#3a362c;--rule-soft:#2a261d;
  --live:oklch(72% 0.15 155);--frozen:oklch(78% 0.15 70);
  --t-failed:oklch(58% 0.17 25);--t-weak:oklch(72% 0.15 45);
  --t-mixed:oklch(82% 0.12 85);--t-strong:oklch(70% 0.13 155);--t-excep:oklch(62% 0.14 195);
  --shadow-hard:3px 3px 0 #000;--shadow-hard-lg:6px 6px 0 #000;
}

body{background:var(--paper);color:var(--ink);font-family:'Inter',system-ui,sans-serif}

.serif{font-family:'Fraunces',Georgia,serif;font-optical-sizing:auto}
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
  border:1px solid var(--ink);
  box-shadow:var(--shadow-hard);
  border-radius:0;
  display:block;
  text-decoration:none;
  transition:transform 120ms ease,box-shadow 120ms ease;
}
.civica-widget:hover{transform:translate(-1px,-1px);box-shadow:var(--shadow-hard-lg)}
.civica-widget:focus-visible{outline:2px solid var(--t-mixed);outline-offset:2px}

/* ── Small 300×80 ── */
.civica-widget.small{
  width:300px;padding:12px 14px;
  display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;
}
.civica-widget.small .mark{
  width:32px;height:32px;
  display:grid;place-items:center;
  background:var(--ink);color:var(--paper);
  font-family:'Fraunces',serif;font-weight:600;font-size:16px;
  flex-shrink:0;
}
.civica-widget.small .body{display:flex;flex-direction:column;gap:2px;min-width:0}
.civica-widget.small .country{font-size:13px;font-weight:600;letter-spacing:-0.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.civica-widget.small .meta{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--ink-3);letter-spacing:0.03em}
.civica-widget.small .score{
  font-family:'Fraunces',serif;font-weight:500;font-size:32px;line-height:1;letter-spacing:-0.02em;
  padding-left:12px;border-left:1px solid var(--rule);
}

/* ── Medium 320×180 ── */
.civica-widget.medium{
  width:320px;padding:18px 20px 16px;
  display:flex;flex-direction:column;gap:10px;
}
.civica-widget.medium .top{display:flex;justify-content:space-between;align-items:center}
.civica-widget.medium .brand{font-family:'Fraunces',serif;font-weight:600;font-size:13px;letter-spacing:-0.005em}
.civica-widget.medium .dotlabel{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-weight:400;font-size:10px;color:var(--ink-3);margin-left:6px;text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.medium .gov{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.medium .country-row{display:flex;justify-content:space-between;align-items:baseline}
.civica-widget.medium .name{font-family:'Fraunces',serif;font-weight:500;font-size:22px;letter-spacing:-0.015em}
.civica-widget.medium .num{font-family:'Fraunces',serif;font-weight:500;font-size:46px;line-height:0.95;letter-spacing:-0.025em}
.civica-widget.medium .tier-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--ink-2)}
.civica-widget.medium .tier-bar{position:relative;height:4px;background:var(--rule-soft)}
.civica-widget.medium .tier-bar>span{position:absolute;inset:0 auto 0 0;background:var(--tier,var(--t-mixed))}
.civica-widget.medium .foot{display:flex;justify-content:space-between;align-items:center;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--ink-3);padding-top:8px;border-top:1px dashed var(--rule)}

/* ── Large 400×260 ── */
.civica-widget.large{
  width:400px;padding:20px 22px 18px;
  display:flex;flex-direction:column;gap:14px;
}
.civica-widget.large .top{display:flex;justify-content:space-between;align-items:center}
.civica-widget.large .brand{font-family:'Fraunces',serif;font-weight:600;font-size:14px}
.civica-widget.large .dotlabel{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-weight:400;font-size:10px;color:var(--ink-3);margin-left:6px;text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.large .gov{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.large .headline{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:end}
.civica-widget.large .name{font-family:'Fraunces',serif;font-weight:500;font-size:26px;letter-spacing:-0.018em;margin:0 0 2px}
.civica-widget.large .sub{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.1em}
.civica-widget.large .num{font-family:'Fraunces',serif;font-weight:500;font-size:58px;line-height:0.9;letter-spacing:-0.03em}
.civica-widget.large .num small{font-size:15px;color:var(--ink-3);font-family:ui-monospace,'SF Mono',Menlo,monospace;font-weight:400;letter-spacing:0;display:block;margin-top:4px}
.civica-widget.large .tier-label{display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--ink-2)}
.civica-widget.large .tier-bar{position:relative;height:4px;background:var(--rule-soft)}
.civica-widget.large .tier-bar>span{position:absolute;inset:0 auto 0 0;background:var(--tier,var(--t-mixed))}
.civica-widget.large .dims{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding-top:2px}
.civica-widget.large .dim-col{display:flex;flex-direction:column;gap:4px}
.civica-widget.large .dim-bar-wrap{height:32px;background:var(--rule-soft);position:relative;display:flex;align-items:flex-end}
.civica-widget.large .dim-fill{width:100%;background:var(--tier,var(--ink-2))}
.civica-widget.large .dim-lbl{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:9px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.06em;text-align:center}
.civica-widget.large .foot{display:flex;justify-content:space-between;align-items:center;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--ink-3);padding-top:8px;border-top:1px dashed var(--rule)}
</style>
</head>
<body>
${body}
</body>
</html>`;
}
