import Link from "next/link";
import { getCIRankings } from "@/lib/db/queries";
import { ciTier } from "@/lib/ci/tiers";
import { civicaIndex } from "@/lib/content/site-state";

interface RankingRow {
  jurisdictionId: string;
  slug: string;
  name: string;
  rank: number;
  score: number | null;
}

/**
 * Phase F variant 2 — "Wiki" homepage.
 * A six-section card grid that doubles as a content directory: top CI,
 * top CP, recent laws, recent elections, a featured country, active
 * Pulse events. Real data where it's wired (CI rankings via
 * getCIRankings); demo data where the source isn't yet plumbed.
 *
 * Demo cells are tagged data-demo="true" so we can find and replace
 * them when the underlying queries land.
 */
export async function HomeWiki() {
  let topCI: RankingRow[] = [];
  try {
    const rows = (await getCIRankings()) as unknown as RankingRow[];
    topCI = (Array.isArray(rows) ? rows : []).slice(0, 5);
  } catch {
    /* dev DB without CI tables — fall through to empty */
  }

  return (
    <div className="home-wiki">
      <header className="home-wiki-hero">
        <div className="home-wiki-eyebrow">
          <span className="dot live" aria-hidden="true" />
          Civica · Atlas of Governance
        </div>
        <h1 className="home-wiki-title">
          How every country is governed, in one atlas.
        </h1>
        <p className="home-wiki-lede">
          250+ sovereign states, {civicaIndex.dimensionCount} governance
          dimensions, live Pulse signals. Browse a country, compare two
          side-by-side, or skim the latest events shaping the world.
        </p>
        <div className="home-wiki-cta">
          <Link href="/atlas" className="home-wiki-btn home-wiki-btn--primary">
            Open the atlas →
          </Link>
          <Link href="/compare" className="home-wiki-btn">
            Compare countries
          </Link>
          <Link href="/civica-index" className="home-wiki-btn">
            Read the index
          </Link>
        </div>
      </header>

      <div className="home-wiki-grid">
        {/* Card 1 — CI top 5 (real data). */}
        <section className="home-wiki-card">
          <div className="home-wiki-card-head">
            <h2 className="home-wiki-card-title">Top 5 — Civica Index</h2>
            <Link className="home-wiki-card-more" href="/civica-index">
              View all →
            </Link>
          </div>
          {topCI.length > 0 ? (
            <ol className="home-wiki-rank-list">
              {topCI.map((r) => {
                const tier = r.score != null ? ciTier(r.score) : null;
                return (
                  <li key={r.jurisdictionId}>
                    <Link href={`/atlas/${r.slug}/structure`} className="home-wiki-rank-row">
                      <span className="home-wiki-rank-num">{r.rank}</span>
                      <span className="home-wiki-rank-name">{r.name}</span>
                      <span
                        className="home-wiki-rank-score"
                        style={tier ? { color: tier.cssVar } : undefined}
                      >
                        {r.score?.toFixed(1) ?? "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="home-wiki-card-empty">CI data not loaded.</p>
          )}
        </section>

        {/* Card 2 — CP top 5 (demo until we wire the Pulse rankings query). */}
        <section className="home-wiki-card" data-demo="true">
          <div className="home-wiki-card-head">
            <h2 className="home-wiki-card-title">Top 5 — Civica Pulse</h2>
            <Link className="home-wiki-card-more" href="/civica-index">
              View all →
            </Link>
          </div>
          <ol className="home-wiki-rank-list">
            {[
              { name: "Norway", score: 92.3, slug: "norway" },
              { name: "Iceland", score: 91.0, slug: "iceland" },
              { name: "Switzerland", score: 89.8, slug: "switzerland" },
              { name: "Denmark", score: 88.4, slug: "denmark" },
              { name: "Finland", score: 87.6, slug: "finland" },
            ].map((r, i) => (
              <li key={r.slug}>
                <Link
                  href={`/atlas/${r.slug}/scores`}
                  className="home-wiki-rank-row"
                >
                  <span className="home-wiki-rank-num">{i + 1}</span>
                  <span className="home-wiki-rank-name">{r.name}</span>
                  <span className="home-wiki-rank-score" style={{ color: "var(--color-success)" }}>
                    {r.score.toFixed(1)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* Card 3 — Recent laws (demo). */}
        <section className="home-wiki-card" data-demo="true">
          <div className="home-wiki-card-head">
            <h2 className="home-wiki-card-title">Recent laws</h2>
            <span className="home-wiki-card-more" aria-disabled="true">
              Demo
            </span>
          </div>
          <ul className="home-wiki-feed">
            {[
              {
                country: "France",
                title: "Pension reform amendment passes Senate",
                when: "2 days ago",
              },
              {
                country: "Brazil",
                title: "New environmental enforcement bill signed",
                when: "4 days ago",
              },
              {
                country: "Japan",
                title: "Defense budget supplementary act enacted",
                when: "5 days ago",
              },
              {
                country: "Canada",
                title: "Federal child-care expansion bill in committee",
                when: "1 week ago",
              },
            ].map((b) => (
              <li key={b.title} className="home-wiki-feed-row">
                <div className="home-wiki-feed-meta">
                  {b.country} · {b.when}
                </div>
                <div className="home-wiki-feed-title">{b.title}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* Card 4 — Recent elections (demo). */}
        <section className="home-wiki-card" data-demo="true">
          <div className="home-wiki-card-head">
            <h2 className="home-wiki-card-title">Recent elections</h2>
            <Link className="home-wiki-card-more" href="/elections">
              View all →
            </Link>
          </div>
          <ul className="home-wiki-feed">
            {[
              {
                country: "Mexico",
                title: "Presidential election — Sheinbaum wins",
                when: "Apr 2026",
              },
              {
                country: "Singapore",
                title: "Legislative election — PAP retains majority",
                when: "Mar 2026",
              },
              {
                country: "Romania",
                title: "Presidential runoff — second round",
                when: "Feb 2026",
              },
              {
                country: "Philippines",
                title: "Midterm election — opposition gains",
                when: "Jan 2026",
              },
            ].map((e) => (
              <li key={e.title} className="home-wiki-feed-row">
                <div className="home-wiki-feed-meta">
                  {e.country} · {e.when}
                </div>
                <div className="home-wiki-feed-title">{e.title}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* Card 5 — Featured country (demo). */}
        <section className="home-wiki-card home-wiki-card--featured" data-demo="true">
          <div className="home-wiki-card-head">
            <h2 className="home-wiki-card-title">Featured country</h2>
            <Link className="home-wiki-card-more" href="/atlas/iceland/structure">
              Open →
            </Link>
          </div>
          <div className="home-wiki-feature">
            <div className="home-wiki-feature-name">Iceland</div>
            <p className="home-wiki-feature-blurb">
              A 63-seat Althing, no upper house, and the longest
              continuously running parliament in the world. Civica Index
              91 — Strong democracy, low corruption, high trust.
            </p>
            <Link
              href="/atlas/iceland/structure"
              className="home-wiki-feature-link"
            >
              Walk into the chamber →
            </Link>
          </div>
        </section>

        {/* Card 6 — Active pulse events (demo). */}
        <section className="home-wiki-card" data-demo="true">
          <div className="home-wiki-card-head">
            <h2 className="home-wiki-card-title">Active Pulse events</h2>
            <Link className="home-wiki-card-more" href="/civica-index">
              View all →
            </Link>
          </div>
          <ul className="home-wiki-feed">
            {[
              {
                country: "Argentina",
                title: "IMF agreement renegotiation",
                impact: "−2.4",
              },
              {
                country: "Türkiye",
                title: "Constitutional court ruling pending",
                impact: "−1.8",
              },
              {
                country: "Germany",
                title: "Coalition stability watch",
                impact: "−1.1",
              },
              {
                country: "South Korea",
                title: "Anti-graft probe widens",
                impact: "+0.7",
              },
            ].map((e) => (
              <li key={e.title} className="home-wiki-feed-row">
                <div className="home-wiki-feed-meta">
                  {e.country} · impact {e.impact}
                </div>
                <div className="home-wiki-feed-title">{e.title}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
