import type { Metadata } from "next";
import Link from "next/link";
import { getCIRankings, getDistinctGovernmentTypes } from "@/lib/db/queries";
import { CountryFlag } from "@/components/CountryFlag";
import { ciTier, CI_TIER_LEGEND } from "@/lib/ci/tiers";

export const metadata: Metadata = {
  title: "Civica Index — Global Governance Rankings",
  description:
    "Composite governance score for every sovereign state and territory. Quarterly structural score (CI) blended with a daily event-sensitive score (CP). Six dimensions, nine datasets, transparent weights.",
  alternates: { canonical: "https://civicaatlas.org/civica-index" },
  openGraph: {
    title: "Civica Index — Global Governance Rankings | Civica Atlas",
    description:
      "The governance health of every country, updated in real time. Composite scores across 190+ sovereign states.",
    url: "https://civicaatlas.org/civica-index",
  },
};

const CONTINENTS = [
  "Africa",
  "Americas",
  "Asia",
  "Europe",
  "Oceania",
];

function govBadgeClass(gov: string | null): string {
  if (!gov) return "gov-oth";
  const g = gov.toLowerCase();
  if (g.includes("parliament")) return "gov-parl";
  if (g.includes("presidential") && !g.includes("semi")) return "gov-pres";
  if (g.includes("semi")) return "gov-semi";
  if (g.includes("monarchy")) return "gov-mon";
  return "gov-oth";
}

function shortGovLabel(gov: string | null): string {
  if (!gov) return "—";
  const g = gov.toLowerCase();
  if (g.includes("parliament")) return "Parliamentary";
  if (g.includes("semi-presidential") || g.includes("semi presidential"))
    return "Semi-presidential";
  if (g.includes("presidential")) return "Presidential";
  if (g.includes("constitutional monarchy")) return "Constitutional monarchy";
  if (g.includes("monarchy")) return "Monarchy";
  if (g.includes("one-party") || g.includes("single-party")) return "One-party";
  if (g.includes("military")) return "Military";
  if (g.includes("theocra")) return "Theocratic";
  return gov;
}

function formatPop(n: number | null): string {
  if (!n) return "";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface CIRankingRow {
  score: number;
  rank: number;
  totalRanked: number;
  isPartial: boolean;
  dimensionsAvailable: number;
  missingDimensions: string[] | null;
  methodologyVersion: string;
  jurisdictionId: string;
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  continent: string | null;
  governmentType: string | null;
  population: number | null;
  flagUrl: string | null;
}

export default async function CivicaIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const continent =
    typeof sp?.continent === "string" ? sp.continent : undefined;
  const governmentType =
    typeof sp?.governmentType === "string" ? sp.governmentType : undefined;

  let rawRows: CIRankingRow[] = [];
  let govTypes: string[] = [];
  try {
    const [result, gt] = await Promise.all([
      getCIRankings(undefined, { continent, governmentType }),
      getDistinctGovernmentTypes(),
    ]);
    rawRows = Array.isArray(result)
      ? (result as unknown as CIRankingRow[])
      : ((result as { rows?: CIRankingRow[] }).rows ?? []);
    govTypes = gt;
  } catch {
    // DB not yet seeded
  }

  const totalCountries = rawRows[0]?.totalRanked ?? rawRows.length;
  const avgCI =
    rawRows.length > 0
      ? rawRows.reduce((s, r) => s + (r.score ?? 0), 0) / rawRows.length
      : 0;

  const continentHref = (c: string | null) => {
    const qs = new URLSearchParams();
    if (c) qs.set("continent", c);
    if (governmentType) qs.set("governmentType", governmentType);
    const q = qs.toString();
    return q ? `/civica-index?${q}` : "/civica-index";
  };
  const govHref = (g: string | null) => {
    const qs = new URLSearchParams();
    if (continent) qs.set("continent", continent);
    if (g) qs.set("governmentType", g);
    const q = qs.toString();
    return q ? `/civica-index?${q}` : "/civica-index";
  };

  return (
    <main className="civica-index-page">
      <div className="ci-container">
        {/* Hero */}
        <section className="ci-hero">
          <div className="ci-hero-eyebrow">
            <span className="dot live" aria-hidden="true" />
            Civica Index · Version 1.0 · Updated daily
          </div>
          <h1 className="ci-hero-title">
            The governance health of every country, updated in real time.
          </h1>
          <p className="ci-hero-lede">
            The Civica Index is a composite governance score for every
            sovereign state and territory, blending a quarterly structural
            score (CI) with a daily event-sensitive score (CP). Six dimensions.
            Nine datasets. Transparent weights. Citable.
          </p>

          <div className="ci-stats-strip" role="group" aria-label="Index coverage">
            <div className="ci-stat">
              <div className="ci-stat-value">{totalCountries || "—"}</div>
              <div className="ci-stat-label">Countries scored</div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">
                {avgCI > 0 ? avgCI.toFixed(1) : "—"}
              </div>
              <div className="ci-stat-label">
                {continent || governmentType ? "Filtered average CI" : "Global average CI"}
              </div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">6</div>
              <div className="ci-stat-label">Dimensions</div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">9</div>
              <div className="ci-stat-label">Datasets</div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">{formatToday()}</div>
              <div className="ci-stat-label">Last recalculation</div>
            </div>
          </div>
        </section>

        {/* Tier legend */}
        <section>
          <div className="ci-section-eyebrow">The scale — 0 to 100</div>
          <div className="ci-tier-legend" role="list" aria-label="Score interpretation tiers">
            {CI_TIER_LEGEND.map((t) => (
              <div key={t.key} className="ci-tier-cell" role="listitem">
                <div className="ci-tier-cell-range">
                  <span className={`ci-tier-dot ${t.bgClassName}`} />
                  {t.range}
                </div>
                <div className="ci-tier-cell-label">{t.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Controls */}
        <section className="ci-controls" aria-label="Filters">
          <div className="ci-control-group" role="group" aria-label="Filter by region">
            <Link
              href={govHref(null)}
              className={`ci-chip ${!continent ? "ci-chip--active" : ""}`}
              scroll={false}
            >
              All regions
            </Link>
            {CONTINENTS.map((c) => {
              const dbValue = c === "Americas" ? null : c;
              const hrefTarget =
                c === "Americas"
                  ? "/civica-index?continent=North%20America"
                  : continentHref(c);
              const active =
                c === "Americas"
                  ? continent === "North America" || continent === "South America"
                  : continent === c;
              void dbValue;
              return (
                <Link
                  key={c}
                  href={hrefTarget}
                  className={`ci-chip ${active ? "ci-chip--active" : ""}`}
                  scroll={false}
                >
                  {c}
                </Link>
              );
            })}
          </div>

          {govTypes.length > 0 && (
            <div className="ci-control-group" role="group" aria-label="Filter by government type">
              <Link
                href={continent ? `/civica-index?continent=${encodeURIComponent(continent)}` : "/civica-index"}
                className={`ci-chip ${!governmentType ? "ci-chip--active" : ""}`}
                scroll={false}
              >
                All government types
              </Link>
              {govTypes.slice(0, 5).map((g) => (
                <Link
                  key={g}
                  href={govHref(g)}
                  className={`ci-chip ${governmentType === g ? "ci-chip--active" : ""}`}
                  scroll={false}
                >
                  {shortGovLabel(g)}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Leaderboard */}
        {rawRows.length > 0 ? (
          <>
            <div className="ci-section-eyebrow" style={{ marginTop: 8 }}>
              {rawRows.length} {rawRows.length === 1 ? "country" : "countries"}
              {continent || governmentType ? " · filtered" : " · ranked by CI"}
            </div>

            <section aria-label="Civica Index leaderboard">
              <div className="ci-leaderboard">
                <div className="ci-lb-header" role="row">
                  <div role="columnheader">Rank</div>
                  <div role="columnheader">Country</div>
                  <div role="columnheader">CI</div>
                  <div role="columnheader">Tier</div>
                  <div role="columnheader">Dimensions</div>
                </div>

                {rawRows.map((r) => {
                  const tier = ciTier(r.score ?? 0);
                  const isTop3 = r.rank <= 3;
                  const govClass = govBadgeClass(r.governmentType);
                  return (
                    <Link
                      key={r.jurisdictionId}
                      href={`/civica-index/${r.slug}`}
                      className="ci-lb-row"
                      role="row"
                    >
                      <div
                        className={`ci-lb-rank${isTop3 ? " ci-lb-rank--top3" : ""}`}
                        role="cell"
                      >
                        {String(r.rank).padStart(2, "0")}
                      </div>

                      <div className="ci-lb-country" role="cell">
                        <div className="ci-lb-country-head">
                          <CountryFlag iso2={r.iso2} size={22} />
                          <span className="ci-lb-country-name">{r.name}</span>
                        </div>
                        <div className="ci-lb-country-meta">
                          <span className={`gov-badge ${govClass}`}>
                            {shortGovLabel(r.governmentType)}
                          </span>
                          {r.continent ?? ""}
                          {r.population ? ` · ${formatPop(r.population)}` : ""}
                        </div>
                      </div>

                      <div className="ci-lb-score" role="cell">
                        <span
                          className="dot frozen"
                          title="Quarterly structural score"
                          aria-hidden="true"
                        />
                        <span className={`ci-lb-score-value ${tier.className}`}>
                          {r.score.toFixed(1)}
                        </span>
                      </div>

                      <div className={`ci-lb-tier ${tier.className}`} role="cell">
                        {tier.label}
                      </div>

                      <div className="ci-lb-dims" role="cell">
                        {r.isPartial ? (
                          <span title={`${r.dimensionsAvailable}/6 dimensions available`}>
                            {r.dimensionsAvailable}/6
                            <span className="ci-dim-warn" aria-hidden="true" />
                          </span>
                        ) : (
                          <span>
                            6/6
                            <span className="ci-dim-ok" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <footer className="ci-footer">
              <Link href="/civica-index/methodology">Methodology</Link>
              <Link href="/civica-index/compare">Compare countries</Link>
              <Link href="/civica-index/government-types">By government type</Link>
              <Link href="/civica-index/changelog">Pulse changelog</Link>
            </footer>
          </>
        ) : (
          <section className="ci-empty">
            <p className="ci-empty-title">No Civica Index data available yet.</p>
            <p className="ci-empty-sub">
              Run <code>npm run ingest:ci</code> and{" "}
              <code>npm run calculate:ci</code> to populate scores.
            </p>
          </section>
        )}
      </div>

      <style>{`
        .civica-index-page {
          background: var(--color-bg);
          min-height: 100vh;
        }
        .ci-container {
          max-width: var(--max-w-content, 1200px);
          margin: 0 auto;
          padding: 0 var(--spacing-page-x);
        }
        .ci-hero { padding: 80px 0 32px; }
        .ci-hero-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 16px;
          display: flex; align-items: center; gap: 10px;
        }
        .ci-hero-title {
          font-family: var(--font-heading);
          font-size: var(--text-64);
          font-weight: 400;
          letter-spacing: var(--tracking-tighter);
          line-height: 1.02;
          color: var(--color-text-primary);
          margin: 0 0 20px;
          max-width: 900px;
        }
        .ci-hero-lede {
          font-size: var(--text-18);
          color: var(--color-text-60);
          max-width: 720px;
          line-height: 1.55;
          margin: 0 0 32px;
        }

        .ci-stats-strip {
          display: flex; gap: 40px; padding: 24px 0;
          border-top: 1px solid var(--color-divider);
          border-bottom: 1px solid var(--color-divider);
          flex-wrap: wrap;
        }
        .ci-stat { display: flex; flex-direction: column; gap: 4px; }
        .ci-stat-value {
          font-family: var(--font-heading);
          font-size: var(--text-28);
          font-weight: 400;
          letter-spacing: var(--tracking-snug);
          line-height: 1;
          color: var(--color-text-primary);
        }
        .ci-stat-label {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-25);
        }

        .ci-section-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
          margin: 40px 0 14px;
        }

        .ci-tier-legend {
          display: flex; gap: 0; margin: 0 0 32px;
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .ci-tier-cell {
          flex: 1; padding: 14px 18px;
          background: var(--color-card-bg);
          border-right: 1px solid var(--color-card-border);
        }
        .ci-tier-cell:last-child { border-right: none; }
        .ci-tier-cell-range {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-wider);
          color: var(--color-text-60);
          display: flex; align-items: center; gap: 6px;
          margin-bottom: 4px;
        }
        .ci-tier-cell-label {
          font-family: var(--font-heading);
          font-size: var(--text-14);
          color: var(--color-text-primary);
        }
        .ci-tier-dot {
          width: 8px; height: 8px; border-radius: 50%;
          display: inline-block;
        }

        .ci-controls {
          padding: 16px 0 24px;
          display: flex; justify-content: space-between; gap: 16px;
          align-items: flex-start; flex-wrap: wrap;
        }
        .ci-control-group { display: flex; gap: 8px; flex-wrap: wrap; }
        .ci-chip {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-12);
          padding: 7px 14px;
          background: var(--color-card-bg);
          color: var(--color-text-40);
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          text-decoration: none;
          transition: background-color .15s, color .15s, border-color .15s;
          white-space: nowrap;
        }
        .ci-chip:hover {
          background: var(--color-card-hover-bg);
          color: var(--color-text-primary);
          border-color: var(--color-card-hover-border);
        }
        .ci-chip--active {
          background: var(--color-accent);
          color: var(--color-bg);
          border-color: var(--color-accent);
        }
        .ci-chip--active:hover {
          background: var(--color-accent);
          color: var(--color-bg);
          border-color: var(--color-accent);
        }

        .ci-leaderboard {
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--color-grid-bg);
          display: grid; gap: 1px;
          margin-bottom: 48px;
        }
        .ci-lb-header {
          background: var(--color-grid-cell);
          padding: 14px 24px;
          display: grid;
          grid-template-columns: 56px minmax(0, 2.2fr) 140px 160px 120px;
          gap: 16px; align-items: center;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-10);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
        }
        .ci-lb-row {
          background: var(--color-grid-cell);
          padding: 18px 24px;
          display: grid;
          grid-template-columns: 56px minmax(0, 2.2fr) 140px 160px 120px;
          gap: 16px; align-items: center;
          text-decoration: none;
          color: inherit;
          transition: background-color .15s;
          cursor: pointer;
        }
        .ci-lb-row:hover { background: var(--color-grid-cell-hover); }
        .ci-lb-rank {
          font-family: var(--font-heading);
          font-weight: 400;
          font-size: var(--text-22);
          color: var(--color-text-60);
          line-height: 1;
        }
        .ci-lb-rank--top3 { color: var(--color-accent); }
        .ci-lb-country {
          display: flex; flex-direction: column; gap: 4px; min-width: 0;
        }
        .ci-lb-country-head {
          display: flex; align-items: center; gap: 10px;
        }
        .ci-lb-country-name {
          font-family: var(--font-heading);
          font-size: var(--text-20);
          color: var(--color-text-primary);
          line-height: 1.2;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ci-lb-country-meta {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          color: var(--color-text-25);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          display: flex; align-items: center; gap: 6px;
        }
        .gov-badge {
          display: inline-block;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-10);
          padding: 2px 6px;
          border-radius: 2px;
        }
        .gov-parl { background: rgba(78, 139, 212, 0.15); color: #4E8BD4; }
        .gov-pres { background: rgba(212, 118, 78, 0.15); color: #D4764E; }
        .gov-semi { background: rgba(155, 109, 198, 0.15); color: #9B6DC6; }
        .gov-mon  { background: rgba(196, 164, 78, 0.15); color: #C4A44E; }
        .gov-oth  { background: rgba(136, 153, 170, 0.15); color: #8899AA; }

        .ci-lb-score {
          display: flex; align-items: baseline; gap: 8px;
        }
        .ci-lb-score-value {
          font-family: var(--font-heading);
          font-size: var(--text-26);
          font-weight: 500;
          line-height: 1;
          letter-spacing: -0.01em;
        }
        .ci-lb-tier {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-wider);
          text-transform: uppercase;
        }
        .ci-lb-dims {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-12);
          color: var(--color-text-30);
          text-align: right;
          display: flex; align-items: center; justify-content: flex-end; gap: 6px;
        }
        .ci-dim-ok, .ci-dim-warn {
          display: inline-block;
          width: 6px; height: 6px; border-radius: 50%;
          margin-left: 4px;
        }
        .ci-dim-ok { background: var(--color-success); }
        .ci-dim-warn { background: var(--color-warn); }

        .ci-footer {
          display: flex; gap: 24px; flex-wrap: wrap;
          padding: 32px 0 80px;
          border-top: 1px solid var(--color-divider);
          margin-top: 16px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-wider);
        }
        .ci-footer a {
          color: var(--color-accent);
          text-decoration: none;
        }
        .ci-footer a:hover { text-decoration: underline; }

        .ci-empty {
          padding: 80px 0;
          text-align: center;
        }
        .ci-empty-title {
          font-family: var(--font-heading);
          font-size: var(--text-18);
          color: var(--color-text-40);
          margin-bottom: 8px;
        }
        .ci-empty-sub {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-12);
          color: var(--color-text-25);
        }
        .ci-empty code {
          background: var(--color-card-bg);
          padding: 1px 6px;
          border-radius: 2px;
        }

        /* Responsive */
        @media (max-width: 900px) {
          .ci-lb-header, .ci-lb-row {
            grid-template-columns: 40px minmax(0, 2fr) 110px 120px;
          }
          .ci-lb-header > *:nth-child(4),
          .ci-lb-row > *:nth-child(4) { display: none; }
          .ci-hero { padding: 48px 0 24px; }
          .ci-hero-title { font-size: var(--text-44); }
          .ci-stats-strip { gap: 24px; }
          .ci-stat-value { font-size: var(--text-22); }
          .ci-tier-legend { flex-direction: column; }
          .ci-tier-cell {
            border-right: none;
            border-bottom: 1px solid var(--color-card-border);
          }
          .ci-tier-cell:last-child { border-bottom: none; }
        }
        @media (max-width: 640px) {
          .ci-lb-header, .ci-lb-row {
            grid-template-columns: 32px 1fr 90px;
            padding: 14px 16px;
          }
          .ci-lb-header > *:nth-child(5),
          .ci-lb-row > *:nth-child(5) { display: none; }
          .ci-lb-country-name { font-size: var(--text-16); }
          .ci-lb-score-value { font-size: var(--text-20); }
          .ci-controls { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}
