import type { Metadata } from "next";
import Link from "next/link";
import { getCIRankings } from "@/lib/db/queries";
import { CountryFlag } from "@/components/CountryFlag";
import { ciTier, CI_TIER_LEGEND } from "@/lib/ci/tiers";

export const metadata: Metadata = {
  title: "Civica Index — Global Governance Rankings",
  description:
    "Composite governance score for every sovereign state and territory. Four governance dimensions, empirically-derived weights, fixed-bound normalization, 90% confidence intervals. Beta methodology — see /civica-index/methodology.",
  alternates: { canonical: "https://civicaatlas.org/civica-index" },
  openGraph: {
    title: "Civica Index — Global Governance Rankings | Civica Atlas",
    description:
      "The governance health of every country, updated in real time. Composite scores across 190+ sovereign states.",
    url: "https://civicaatlas.org/civica-index",
  },
};

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
  scoreLower: number | null;
  scoreUpper: number | null;
  band: string | null;
  completenessFlag: string | null;
  vintageLabel: string | null;
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

export default async function CivicaIndexShellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const continent =
    typeof sp?.continent === "string" ? sp.continent : undefined;
  const structuralFamily =
    typeof sp?.family === "string" ? sp.family : undefined;

  let rawRows: CIRankingRow[] = [];
  try {
    const result = await getCIRankings(undefined, {
      continent,
      structuralFamily,
    });
    rawRows = Array.isArray(result)
      ? (result as unknown as CIRankingRow[])
      : ((result as { rows?: CIRankingRow[] }).rows ?? []);
  } catch {
    // DB not yet seeded
  }

  const totalCountries = rawRows[0]?.totalRanked ?? rawRows.length;
  const avgCI =
    rawRows.length > 0
      ? rawRows.reduce((s, r) => s + (r.score ?? 0), 0) / rawRows.length
      : 0;

  return (
    <div className="civica-index-page">
      <div className="ci-container">
        <section className="ci-hero">
          <div className="ci-hero-eyebrow">
            <span className="dot live" aria-hidden="true" />
            Civica Index · Beta · Updated daily
            <span
              className="ci-beta-pill"
              aria-label="Beta — methodology under active revision"
              title="Methodology under active revision. See methodology page for details."
            >
              Beta
            </span>
          </div>
          <h1 className="ci-hero-title">
            The governance health of every country, updated in real time.
          </h1>
          <p className="ci-hero-rework-note">
            Methodology under active revision —{" "}
            <Link href="/civica-index/methodology">see methodology</Link> for the
            current state of the rebuild.
          </p>
          <p className="ci-hero-lede">
            The Civica Index is a composite governance score for every
            sovereign state and territory. Four governance dimensions,
            empirically-derived weights, fixed-bound normalization, and
            published 90% confidence intervals. The Civica Pulse layers
            real-time event sensitivity on top.
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
                {continent || structuralFamily
                  ? "Filtered average CI"
                  : "Global average CI"}
              </div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">4</div>
              <div className="ci-stat-label">Dimensions</div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">A–F</div>
              <div className="ci-stat-label">Rank bands</div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">{formatToday()}</div>
              <div className="ci-stat-label">Last recalculation</div>
            </div>
          </div>
        </section>

        <section>
          <div className="ci-section-eyebrow">The scale — 0 to 100</div>
          <div
            className="ci-tier-legend"
            role="list"
            aria-label="Score interpretation tiers"
          >
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

        {rawRows.length > 0 ? (
          <>
            <div className="ci-section-eyebrow" style={{ marginTop: 8 }}>
              {rawRows.length}{" "}
              {rawRows.length === 1 ? "country" : "countries"}
              {continent || structuralFamily
                ? " · filtered"
                : " · ranked by CI"}
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
                        <span
                          className={`ci-lb-score-value ${tier.className}`}
                        >
                          {Math.round(r.score)}
                        </span>
                        {r.scoreLower != null && r.scoreUpper != null ? (
                          <span
                            className="ci-lb-score-interval"
                            title="90% confidence interval"
                          >
                            ({r.scoreLower}–{r.scoreUpper})
                          </span>
                        ) : null}
                      </div>

                      <div className={`ci-lb-tier ${tier.className}`} role="cell">
                        {r.band ? `${r.band} · ${tier.label}` : tier.label}
                      </div>

                      <div className="ci-lb-dims" role="cell">
                        {r.completenessFlag === "partial" ? (
                          <span
                            title={`${r.dimensionsAvailable}/4 dimensions available`}
                          >
                            {r.dimensionsAvailable}/4
                            <span className="ci-dim-warn" aria-hidden="true" />
                          </span>
                        ) : (
                          <span>
                            4/4
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
              <Link href="/compare">Compare countries</Link>
              <Link href="/civica-index/government-types">
                By government type
              </Link>
              <Link href="/civica-index/pulse-changelog">Pulse changelog</Link>
            </footer>
          </>
        ) : (
          <section className="ci-empty">
            <p className="ci-empty-title">
              No Civica Index data available for this filter.
            </p>
            <p className="ci-empty-sub">
              Try a different region or government family in the left rail,
              or <Link href="/civica-index">see all scored countries</Link>.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
