import Link from "next/link";
import { getAllJurisdictions, getCIRankings } from "@/lib/db/queries";
import {
  readCachedFieldFromRow,
  getCanonicalFactsForJurisdictions,
} from "@/lib/factbook/reconcile/api";
import { GlobalSearch } from "@/components/GlobalSearch";
import { CountryFlag } from "@/components/CountryFlag";
import { CountryCard, type CountryCardStat } from "@/components/home/CountryCard";
import { Chip } from "@/components/editorial/Pill";
import { ciTier } from "@/lib/ci/tiers";
import { civicaIndex } from "@/lib/content/site-state";
import {
  Reveal,
  Stagger,
  StaggerItem,
  HeroReveal,
  HeroRevealItem,
} from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";

/* A single Civica Index ranking row as returned by getCIRankings. */
interface RankRow {
  rank: number;
  score: number;
  band?: string | null;
  name: string;
  slug: string;
  iso2: string | null;
  iso3: string | null;
  governmentType: string | null;
  population: number | string | null;
  flagUrl: string | null;
  totalRanked?: number;
  jurisdictionId: string;
  governmentClassification: { regimeTypeLabel: string | null } | null;
}

/** Human-readable population (e.g. "123.3M", "1.41B"). Null-safe. */
function formatPopulation(pop: number | string | null): string | null {
  const n = typeof pop === "string" ? Number(pop) : pop;
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

/** Government-type label: prefer the human regime label, else raw type. */
function govLabel(row: RankRow): string | null {
  return row.governmentClassification?.regimeTypeLabel ?? row.governmentType ?? null;
}

/** Build the (real-data-only) stat columns for a featured CountryCard. */
function buildCardStats(row: RankRow): CountryCardStat[] {
  const stats: CountryCardStat[] = [];
  const gov = govLabel(row);
  if (gov) stats.push({ label: "Government type", value: gov });
  const pop = formatPopulation(row.population);
  if (pop) stats.push({ label: "Population", value: pop });
  if (Number.isFinite(row.score)) {
    stats.push({ label: "Civica Index", value: String(Math.round(row.score)) });
  }
  return stats;
}

export async function HomeGrid() {
  // Country list for the hero search (graceful empty on DB error).
  let countries: { slug: string; name: string; iso2: string | null; capital: string | null }[] =
    [];
  try {
    const all = await getAllJurisdictions();
    countries = all.map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2,
      capital: readCachedFieldFromRow(c, "capital"),
    }));
  } catch {}

  // Live Civica Index rankings — drives the featured cards + the Index table.
  let rows: RankRow[] = [];
  let totalRanked = 0;
  try {
    const result = await getCIRankings(undefined, {});
    rows = (
      Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
    ) as RankRow[];
    totalRanked = rows[0]?.totalRanked ?? rows.length;
  } catch {}

  // Featured cards: find Japan + Estonia in the rankings (by slug/iso3).
  const findRow = (slug: string, iso3: string) =>
    rows.find((r) => r.slug === slug || r.iso3?.toLowerCase() === iso3) ?? null;
  const japan = findRow("japan", "jpn");
  const estonia = findRow("estonia", "est");

  // Resolve income-group chips for the featured cards (canonical fact layer).
  const featuredIds = [japan, estonia]
    .filter((r): r is RankRow => r != null)
    .map((r) => r.jurisdictionId);
  const incomeByJur: Record<string, string | null> = {};
  if (featuredIds.length > 0) {
    try {
      const resolved = await getCanonicalFactsForJurisdictions(featuredIds, [
        "world_bank_income_group",
      ]);
      for (const id of featuredIds) {
        incomeByJur[id] =
          resolved[id]?.["world_bank_income_group"]?.canonical?.factValue ?? null;
      }
    } catch {}
  }

  const top = rows.slice(0, 8);
  const countriesCount = totalRanked || countries.length || 195;

  return (
    <div className="home">
      {/* Hero */}
      <section className="home-hero" aria-labelledby="home-title">
        <ParallaxImage
          className="home-hero-art-img"
          src="/engravings/hero.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="home-hero-inner">
          <HeroReveal className="home-hero-main">
            <HeroRevealItem as="h1" id="home-title" className="home-hero-title">
              Civica Atlas
            </HeroRevealItem>
            <HeroRevealItem as="p" className="home-hero-dek">
              An open reference atlas of the world&rsquo;s countries, governments, and
              governance outcomes.
            </HeroRevealItem>
            <HeroRevealItem className="home-hero-search">
              <GlobalSearch countries={countries} />
            </HeroRevealItem>
            <HeroRevealItem className="home-stats" role="group" aria-label="Coverage">
              <div className="home-stat">
                <span className="home-stat-value">{countriesCount}</span>
                <span className="home-stat-label">Countries</span>
              </div>
              <div className="home-stat">
                <span className="home-stat-value">{civicaIndex.dimensionCount}</span>
                <span className="home-stat-label">Index dimensions</span>
              </div>
              <div className="home-stat home-stat--mark">
                <span className="home-stat-mark" aria-hidden="true">
                  &#9670;
                </span>
                <span className="home-stat-label">Open data &amp; provenance</span>
              </div>
              <div className="home-stat home-stat--mark">
                <span className="home-stat-mark" aria-hidden="true">
                  &#9670;
                </span>
                <span className="home-stat-label">Independent &amp; nonpartisan</span>
              </div>
            </HeroRevealItem>
          </HeroReveal>
        </div>
      </section>

      {/* 01 — Factbook */}
      <Reveal as="section" className="home-feature">
        <div className="home-feature-num">01</div>
        <div className="home-feature-main">
          <div className="home-eyebrow">Factbook</div>
          <h2 className="home-feature-title">
            Explore country profiles and key facts at a glance.
          </h2>
          <p className="home-feature-desc">
            Every country&rsquo;s government, leaders, legislature, economy, and society
            &mdash; documented with provenance you can trace to its source.
          </p>
          <Link href="/factbook" className="btn btn--text">
            <span>Explore Factbook</span>
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
        <div className="home-feature-visual-slot">
          {japan ? (
            <CountryCard
              name={japan.name}
              iso2={japan.iso2}
              incomeGroup={incomeByJur[japan.jurisdictionId] ?? null}
              stats={buildCardStats(japan)}
              iso3="jpn"
              href={`/factbook/${japan.slug}`}
            />
          ) : (
            <div className="home-feature-visual">
              <div className="home-engraving">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/engravings/spot-column.webp" alt="" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      </Reveal>

      {/* 02 — Atlas */}
      <Reveal as="section" className="home-feature">
        <div className="home-feature-num">02</div>
        <div className="home-feature-main">
          <div className="home-eyebrow">Atlas</div>
          <h2 className="home-feature-title">See the world. Understand its contexts.</h2>
          <p className="home-feature-desc">
            A connected atlas of legislatures, chambers, political systems, and the
            institutions that hold power around the world.
          </p>
          <Link href="/atlas" className="btn btn--text">
            <span>Explore Atlas</span>
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
        <div className="home-feature-visual-slot">
          {estonia ? (
            <CountryCard
              name={estonia.name}
              iso2={estonia.iso2}
              incomeGroup={incomeByJur[estonia.jurisdictionId] ?? null}
              stats={buildCardStats(estonia)}
              iso3="est"
              href={`/factbook/${estonia.slug}`}
            />
          ) : (
            <div className="home-feature-visual">
              <div className="home-engraving">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/engravings/spot-globe.webp" alt="" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      </Reveal>

      {/* 03 — Civica Index */}
      <Reveal as="section" className="home-feature">
        <div className="home-feature-num">03</div>
        <div className="home-feature-main">
          <div className="home-eyebrow">Civica Index</div>
          <h2 className="home-feature-title">Rank nations. Reveal futures.</h2>
          <p className="home-feature-desc">
            A composite governance score for every country across{" "}
            {civicaIndex.dimensionCount} dimensions, with the Civica Pulse layering
            event sensitivity on top.
          </p>
          <Link href="/civica-index" className="btn btn--text">
            <span>Explore the Index</span>
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
        <div className="home-feature-visual-slot">
          {top.length > 0 ? (
            <div className="home-index">
              <div className="home-index-head">
                <h3 className="home-index-title">
                  Civica Index <span>(Overall)</span>
                </h3>
                <Chip variant="sand">Beta</Chip>
                <Link href="/civica-index" className="btn btn--text home-index-link">
                  <span>View full Index</span>
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
                <p className="home-index-sub">
                  Composite ranking of governance outcomes and institutional strength.
                </p>
              </div>
              <div className="home-index-table-wrap">
                <table className="home-index-table">
                  <thead>
                    <tr>
                      <th className="home-index-col-rank" scope="col">
                        Rank
                      </th>
                      <th scope="col">Country</th>
                      <th className="home-index-col-score" scope="col">
                        Civica Index
                      </th>
                      <th className="home-index-col-tier" scope="col">
                        Tier
                      </th>
                    </tr>
                  </thead>
                  <Stagger as="tbody" amount={0.1}>
                    {top.map((r) => {
                      const tier = ciTier(r.score);
                      return (
                        <StaggerItem as="tr" key={r.slug}>
                          <td className="home-index-col-rank">
                            <span className="home-index-rank">{r.rank}</span>
                          </td>
                          <td>
                            <Link
                              href={`/civica-index/${r.slug}`}
                              className="home-index-country"
                            >
                              <span className="home-index-flag" aria-hidden="true">
                                <CountryFlag iso2={r.iso2} size={20} />
                              </span>
                              <span>{r.name}</span>
                            </Link>
                          </td>
                          <td className="home-index-col-score">
                            <span className="home-index-score">{Math.round(r.score)}</span>
                          </td>
                          <td className="home-index-col-tier">
                            <span className="home-index-tier">
                              <span
                                className="home-index-tier-swatch"
                                style={{ background: tier.cssVar }}
                                aria-hidden="true"
                              />
                              {tier.label}
                            </span>
                          </td>
                        </StaggerItem>
                      );
                    })}
                  </Stagger>
                </table>
              </div>
            </div>
          ) : (
            <div className="home-feature-visual">
              <div className="home-engraving">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/engravings/spot-globe.webp" alt="" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      </Reveal>

      <div className="home-closing">Open &middot; Transparent &middot; Nonpartisan</div>
      <div className="home-sources">
        <span className="home-sources-label">Data from</span>
        <span className="home-sources-list">
          <span>World Bank</span>
          <span className="home-sources-sep" aria-hidden="true">
            &middot;
          </span>
          <span>IMF</span>
          <span className="home-sources-sep" aria-hidden="true">
            &middot;
          </span>
          <span>UN</span>
          <span className="home-sources-sep" aria-hidden="true">
            &middot;
          </span>
          <span>V-Dem</span>
          <span className="home-sources-sep" aria-hidden="true">
            &middot;
          </span>
          <span>Freedom House</span>
        </span>
      </div>
    </div>
  );
}
