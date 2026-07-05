import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCIRankings } from "@/lib/db/queries";
import {
  getWorldBankRegionDistribution,
  getWorldBankIncomeGroupDistribution,
  getVDemRowDistribution,
  getCgvRegimeDistribution,
} from "@/lib/db/queries-peer-grouping";
import {
  WORLD_BANK_REGION_META,
  WORLD_BANK_INCOME_GROUP_META,
  VDEM_ROW_META,
  CGV_REGIME_TYPE_META,
  type WorldBankRegionKey,
  type WorldBankIncomeGroupKey,
  type VDemRowKey,
  type CGVRegimeTypeKey,
} from "@/lib/peer-grouping/lens-metadata";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { CivicaIndexFilterBar } from "@/components/civica-index/CivicaIndexFilterBar";
import { CountryFlag } from "@/components/CountryFlag";
import { ciTier, CI_TIER_LEGEND } from "@/lib/ci/tiers";
import { readCachedFieldFromRow } from "@/lib/factbook/reconcile/api";
import { civicaIndex } from "@/lib/content/site-state";
import { withOg } from "@/lib/og";
import { JsonLd } from "@/lib/seo/json-ld";
import { buildDataset } from "@/lib/seo/jsonld";
import { HeroReveal, HeroRevealItem } from "@/components/motion/Reveal";
import { BetaChip } from "@/components/editorial/BetaChip";
import { ParallaxImage } from "@/components/motion/ParallaxImage";

export const revalidate = 3600;

const CONTINENTS = [
  "Africa",
  "North America",
  "South America",
  "Asia",
  "Europe",
  "Oceania",
];

interface RawDistRow {
  key: string;
  totalCount: number;
  scoredCount: number;
}

/** Decorate raw lens-distribution rows with human labels + lens order. */
function decorateOptions<K extends string>(
  raw: RawDistRow[],
  meta: Record<K, { label: string; order: number }>,
): Array<{ key: string; label: string; totalCount: number; scoredCount: number }> {
  return [...raw]
    .sort((a, b) => {
      const orderA = meta[a.key as K]?.order ?? 999;
      const orderB = meta[b.key as K]?.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return b.totalCount - a.totalCount;
    })
    .map((r) => ({
      key: r.key,
      label: meta[r.key as K]?.label ?? r.key,
      totalCount: r.totalCount,
      scoredCount: r.scoredCount,
    }));
}

export const metadata: Metadata = {
  title: "Civica Index — Governance Scores for 190+ Countries",
  description:
    `An original governance score for 190+ sovereign states across ${civicaIndex.dimensionCount} dimensions, with empirically-derived weights, fixed-bound normalization, and 90% confidence intervals.${civicaIndex.status === "beta" ? " Beta methodology." : ""}`,
  alternates: { canonical: "https://civicaatlas.org/civica-index" },
  openGraph: withOg({
    title: "Civica Index — Governance Scores for 190+ Countries · Civica Atlas",
    description:
      "The governance health of every country. Quarterly structural scores across 190+ sovereign states, with published confidence intervals.",
    url: "https://civicaatlas.org/civica-index",
  }),
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
  if (g.includes("communist")) return "Communist state";
  if (g.includes("dictatorship")) return "Dictatorship";
  if (g.includes("authoritarian")) return "Authoritarian";
  if (g.includes("transition")) return "In transition";
  if (g.includes("federal") && g.includes("republic")) return "Federal republic";
  if (g.includes("confederation")) return "Confederation";
  if (g.includes("republic")) return "Republic";
  // Humanize any remaining raw/slug value (e.g. "federal_republic_formally_a_
  // confederation") so a snake_case label never leaks into the UI.
  const cleaned = gov.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function formatPop(n: number | null): string {
  if (!n) return "";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
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

export default async function CivicaIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // Phase 3b — `?family=` is retired. The 2026-05-02 peer-grouping
  // resolution replaces `structural_family` with domain-specific peer
  // lenses; an inbound link with `?family=*` no longer maps to a
  // single new lens, so we drop the filter and serve the bare page.
  // Documented in ~/civica/plan/structural-family-removal-implementation-plan.md §F.3.
  if (typeof sp?.family === "string") {
    redirect("/civica-index");
  }

  const continent =
    typeof sp?.continent === "string" ? sp.continent : undefined;
  const vdemRow = typeof sp?.vdem === "string" ? sp.vdem : undefined;
  const worldBankRegion =
    typeof sp?.region === "string" ? sp.region : undefined;
  const worldBankIncomeGroup =
    typeof sp?.income === "string" ? sp.income : undefined;
  const cgvRegime = typeof sp?.cgv === "string" ? sp.cgv : undefined;

  const hasFilter = Boolean(
    continent || vdemRow || worldBankRegion || worldBankIncomeGroup || cgvRegime,
  );

  let rawRows: CIRankingRow[] = [];
  try {
    const result = await getCIRankings(undefined, {
      continent,
      vdemRow,
      worldBankRegion,
      worldBankIncomeGroup,
      cgvRegime,
    });
    rawRows = Array.isArray(result)
      ? (result as unknown as CIRankingRow[])
      : ((result as { rows?: CIRankingRow[] }).rows ?? []);
  } catch {
    // DB not yet seeded
  }

  // Peer-lens distributions (formerly fetched by the @left shell slot)
  // feed the top filter bar's V-Dem / WB region / income / CGV selects.
  let vdemRaw: RawDistRow[] = [];
  let regionRaw: RawDistRow[] = [];
  let incomeRaw: RawDistRow[] = [];
  let cgvRaw: RawDistRow[] = [];
  try {
    [vdemRaw, regionRaw, incomeRaw, cgvRaw] = await Promise.all([
      getVDemRowDistribution(),
      getWorldBankRegionDistribution(),
      getWorldBankIncomeGroupDistribution(),
      getCgvRegimeDistribution(),
    ]);
  } catch {
    // DB not seeded
  }

  const vdemOptions = decorateOptions<VDemRowKey>(vdemRaw, VDEM_ROW_META);
  const worldBankRegionOptions = decorateOptions<WorldBankRegionKey>(
    regionRaw,
    WORLD_BANK_REGION_META,
  );
  const worldBankIncomeOptions = decorateOptions<WorldBankIncomeGroupKey>(
    incomeRaw,
    WORLD_BANK_INCOME_GROUP_META,
  );
  const cgvOptions = decorateOptions<CGVRegimeTypeKey>(
    cgvRaw,
    CGV_REGIME_TYPE_META,
  );

  // Atlas country list powers the "Jump to a country" search → scorecard.
  let searchCountries: Array<{
    slug: string;
    name: string;
    iso2: string | null;
    iso3: string | null;
    capital: string | null;
  }> = [];
  try {
    const { countries } = await loadAtlasData();
    searchCountries = countries.map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2 ?? null,
      iso3: c.iso3 ?? null,
      capital: c.capital ?? null,
    }));
  } catch {
    // DB not seeded
  }

  const totalCountries = rawRows[0]?.totalRanked ?? rawRows.length;
  const avgCI =
    rawRows.length > 0
      ? rawRows.reduce((s, r) => s + (r.score ?? 0), 0) / rawRows.length
      : 0;
  const realVintage = rawRows.find((row) => row.vintageLabel)?.vintageLabel;
  const currentVintage = realVintage ?? "Quarterly structural score";

  // Dataset structured data for the Civica Index leaderboard. Creator/publisher
  // are the Civica Atlas Organization; license points at the reuse terms on
  // /licensing (Civica's posture is "cite Civica Atlas + upstream sources", not
  // a bare SPDX license); the distribution is the documented public JSON API.
  // temporalCoverage is only emitted when a real vintage label is present.
  const datasetJsonLd = buildDataset({
    name: "Civica Index",
    description:
      `An original composite governance score for 190+ sovereign states across ${civicaIndex.dimensionCount} dimensions, with empirically-derived weights, fixed-bound normalization, and 90% confidence intervals.`,
    url: "https://civicaatlas.org/civica-index",
    license: "https://civicaatlas.org/licensing",
    temporalCoverage: realVintage ?? undefined,
    distributionUrl: "https://civicaatlas.org/api/v1/index/rankings",
    keywords: [
      "governance",
      "democracy",
      "rule of law",
      "governance index",
      "country rankings",
    ],
  });

  return (
    <div className="civica-index-page">
      <JsonLd data={datasetJsonLd} />
      {/* ── Full-bleed engraving hero (matches the homepage / /country hero) ── */}
      <section
        className="factbook-landing-hero ci-landing-hero"
        aria-labelledby="ci-hero-title"
      >
        <ParallaxImage
          className="factbook-hero-art"
          src="/engravings/hero.webp"
          darkSrc="/engravings/hero-dark.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="factbook-hero-scrim" aria-hidden="true" />
        <HeroReveal className="factbook-hero-inner">
          <HeroRevealItem className="factbook-hero-eyebrow">
            Civica Index
          </HeroRevealItem>
          <HeroRevealItem
            as="h1"
            id="ci-hero-title"
            className="factbook-hero-title"
          >
            The governance health of every country.
          </HeroRevealItem>
          <HeroRevealItem as="p" className="factbook-hero-dek">
            A composite governance score for every sovereign state and
            territory. {civicaIndex.dimensionCount} governance dimensions,
            empirically-derived weights, fixed-bound normalization, and
            published 90% confidence intervals. The Civica Pulse layers event
            sensitivity on top.
          </HeroRevealItem>
          <HeroRevealItem className="ci-hero-status">
            <BetaChip aria-label="Beta — methodology under active revision" />
            <span className="ci-hero-rework-note">
              Methodology under active revision —{" "}
              <Link href="/civica-index/methodology">see methodology</Link> for
              the current state of the rebuild.
            </span>
          </HeroRevealItem>
        </HeroReveal>
      </section>

      <div className="ci-container">
        <section className="ci-hero ci-hero--stats">
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
                {hasFilter ? "Filtered average CI" : "Global average CI"}
              </div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">{civicaIndex.dimensionCount}</div>
              <div className="ci-stat-label">Dimensions</div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">A–F</div>
              <div className="ci-stat-label">Rank bands</div>
            </div>
            <div className="ci-stat">
              <div className="ci-stat-value">{currentVintage}</div>
              <div className="ci-stat-label">Current vintage</div>
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

        <section aria-label="Filter and search">
          <div className="ci-section-eyebrow">Filter the index</div>
          <CivicaIndexFilterBar
            continents={CONTINENTS}
            vdemOptions={vdemOptions}
            worldBankRegionOptions={worldBankRegionOptions}
            worldBankIncomeOptions={worldBankIncomeOptions}
            cgvOptions={cgvOptions}
            activeContinent={continent}
            activeVdem={vdemRow}
            activeWorldBankRegion={worldBankRegion}
            activeWorldBankIncome={worldBankIncomeGroup}
            activeCgv={cgvRegime}
            searchCountries={searchCountries}
            hasFilter={hasFilter}
          />
        </section>

        {rawRows.length > 0 ? (
          <>
            <div className="ci-section-eyebrow" style={{ marginTop: 8 }}>
              {rawRows.length}{" "}
              {rawRows.length === 1 ? "country" : "countries"}
              {hasFilter ? " · filtered" : " · ranked by CI"}
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
                  const cachedPopulation = readCachedFieldFromRow(
                    r,
                    "population_total",
                  );
                  return (
                    <Link
                      key={r.jurisdictionId}
                      href={`/country/${r.slug}/civica-data`}
                      className="ci-lb-row"
                      role="row"
                      style={
                        {
                          "--ci-lb-bar": `${Math.max(0, Math.min(100, r.score ?? 0))}%`,
                          "--ci-lb-bar-color": tier.cssVar,
                        } as React.CSSProperties
                      }
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
                          {cachedPopulation
                            ? ` · ${formatPop(cachedPopulation)}`
                            : ""}
                        </div>
                      </div>

                      <div className="ci-lb-score" role="cell">
                        <span className="dot frozen" aria-hidden="true" />
                        <span
                          className={`ci-lb-score-value ${tier.className}`}
                        >
                          {Math.round(r.score)}
                        </span>
                        {r.scoreLower != null && r.scoreUpper != null ? (
                          <span className="ci-lb-score-interval">
                            ({r.scoreLower}–{r.scoreUpper})
                          </span>
                        ) : null}
                      </div>

                      <div className={`ci-lb-tier ${tier.className}`} role="cell">
                        {r.band ? `${r.band} · ${tier.label}` : tier.label}
                      </div>

                      <div className="ci-lb-dims" role="cell">
                        {r.completenessFlag === "partial" ? (
                          <span>
                            {r.dimensionsAvailable}/{civicaIndex.dimensionCount}
                            <span className="ci-dim-warn" aria-hidden="true" />
                          </span>
                        ) : (
                          <span>
                            {civicaIndex.dimensionCount}/{civicaIndex.dimensionCount}
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
              Try a different region or peer lens above, or{" "}
              <Link href="/civica-index">see all scored countries</Link>.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
