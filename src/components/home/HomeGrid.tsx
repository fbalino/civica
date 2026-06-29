import Link from "next/link";
import { getAllJurisdictions, getCIRankings } from "@/lib/db/queries";
import { readCachedFieldFromRow } from "@/lib/factbook/reconcile/api";
import { GlobalSearch } from "@/components/GlobalSearch";
import { civicaIndex } from "@/lib/content/site-state";

type RankPreview = { rank: number; name: string; slug: string; score: number };

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

  // Live top-5 Civica Index for the leaderboard preview.
  let top: RankPreview[] = [];
  let totalRanked = 0;
  try {
    const result = await getCIRankings(undefined, {});
    const rows = (
      Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
    ) as Array<{ rank: number; name: string; slug: string; score: number; totalRanked?: number }>;
    totalRanked = rows[0]?.totalRanked ?? rows.length;
    top = rows.slice(0, 5).map((r) => ({
      rank: r.rank,
      name: r.name,
      slug: r.slug,
      score: r.score,
    }));
  } catch {}

  const countriesCount = totalRanked || countries.length || 195;

  return (
    <div className="home">
      {/* Hero */}
      <section className="home-hero" aria-labelledby="home-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="home-hero-art-img" src="/engravings/hero.webp" alt="" aria-hidden="true" />
        <div className="home-hero-inner">
        <div className="home-hero-main">
          <h1 id="home-title" className="home-hero-title">
            Civica Atlas
          </h1>
          <p className="home-hero-dek">
            An open reference atlas of the world&rsquo;s countries, governments, and
            governance outcomes.
          </p>
          <div className="home-hero-search">
            <GlobalSearch countries={countries} />
          </div>
          <div className="home-stats" role="group" aria-label="Coverage">
            <div className="home-stat">
              <span className="home-stat-value">{countriesCount}</span>
              <span className="home-stat-label">Countries</span>
            </div>
            <div className="home-stat">
              <span className="home-stat-value">{civicaIndex.dimensionCount}</span>
              <span className="home-stat-label">Index dimensions</span>
            </div>
            <div className="home-stat">
              <span className="home-stat-mark" aria-hidden="true">
                &#9670;
              </span>
              <span className="home-stat-label">Open data &amp; provenance</span>
            </div>
            <div className="home-stat">
              <span className="home-stat-mark" aria-hidden="true">
                &#9670;
              </span>
              <span className="home-stat-label">Independent &amp; nonpartisan</span>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* 01 — Factbook */}
      <section className="home-feature">
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
        <div className="home-feature-visual">
          <div className="home-engraving">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/engravings/spot-column.webp" alt="" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* 02 — Atlas */}
      <section className="home-feature">
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
        <div className="home-feature-visual">
          <div className="home-engraving">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/engravings/spot-globe.webp" alt="" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* 03 — Civica Index */}
      <section className="home-feature">
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
        <div className="home-feature-visual">
          {top.length > 0 ? (
            <div className="home-rank">
              {top.map((r) => (
                <Link
                  key={r.slug}
                  href={`/civica-index/${r.slug}`}
                  className="home-rank-row"
                >
                  <span className="home-rank-num">
                    {String(r.rank).padStart(2, "0")}
                  </span>
                  <span className="home-rank-name">{r.name}</span>
                  <span className="home-rank-score">{Math.round(r.score)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-engraving">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/engravings/spot-globe.webp" alt="" aria-hidden="true" />
            </div>
          )}
        </div>
      </section>

      <div className="home-closing">Open &middot; Transparent &middot; Nonpartisan</div>
    </div>
  );
}
