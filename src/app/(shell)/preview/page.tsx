import type { Metadata } from "next";
import Link from "next/link";
import { getCIRankings } from "@/lib/db/queries";
import { ciTier } from "@/lib/ci/tiers";

export const metadata: Metadata = {
  title: "Civica — Atlas of Governance",
  description:
    "Interactive reference for how every country is governed. 250+ nations, six dimensions, live Pulse signals. Civica replaces the CIA World Factbook with a modern, citable atlas.",
  alternates: { canonical: "https://civicaatlas.org" },
  openGraph: {
    title: "Civica — Atlas of Governance",
    description:
      "Interactive reference for how every country is governed. 250+ nations, six dimensions, live Pulse signals.",
    url: "https://civicaatlas.org",
    type: "website",
  },
};

interface LandingRankingRow {
  jurisdictionId: string;
  slug: string;
  name: string;
  rank: number;
  score: number | null;
}

export default async function LandingPage() {
  // Best-effort data; if queries fail (e.g. local dev without DB) we still
  // render the page with empty lists rather than a crash.
  let topScores: LandingRankingRow[] = [];
  try {
    const rows = (await getCIRankings()) as unknown as LandingRankingRow[];
    topScores = (Array.isArray(rows) ? rows : []).slice(0, 10);
  } catch {
    /* ignore */
  }

  return (
    <div className="landing-wrap">
      <section className="landing-hero">
        <div className="landing-hero-eyebrow">
          <span className="dot live" aria-hidden="true" />
          Civica · Atlas of Governance
        </div>
        <h1 className="landing-hero-title">
          How every country is governed,
          <br />
          in one atlas.
        </h1>
        <p className="landing-hero-lede">
          250+ sovereign states, six governance dimensions, live Pulse signals.
          A modern, citable reference for the people, offices, and institutions
          that shape each country&rsquo;s political life.
        </p>
        <div className="landing-hero-cta">
          <Link href="/atlas" className="landing-cta landing-cta-primary">
            Enter the Atlas →
          </Link>
          <Link href="/countries" className="landing-cta">
            Browse Countries
          </Link>
        </div>
      </section>

      <section className="landing-columns">
        <div>
          <div className="landing-col-eyebrow">Civica Index · Top 10</div>
          {topScores.length === 0 ? (
            <p className="landing-empty">Rankings data loading…</p>
          ) : (
            <ol className="landing-ranking">
              {topScores.map((r) => {
                const score = r.score ?? 0;
                const tier = ciTier(Number(score));
                return (
                  <li key={r.jurisdictionId}>
                    <Link
                      href={`/civica-index/${r.slug}`}
                      className="landing-ranking-row"
                    >
                      <span className="landing-ranking-rank">
                        {String(r.rank).padStart(2, "0")}
                      </span>
                      <span className="landing-ranking-name">{r.name}</span>
                      <span
                        className="landing-ranking-score"
                        style={{ color: `var(--tier-${tier.key})` }}
                      >
                        {Number(score).toFixed(1)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          <Link href="/civica-index" className="landing-col-more">
            Full Civica Index →
          </Link>
        </div>

        <div>
          <div className="landing-col-eyebrow">How to use Civica</div>
          <ul className="landing-howto">
            <li>
              <strong>Atlas</strong> — click any country on the world map to
              see its government, leaders, and parliament at a glance.
            </li>
            <li>
              <strong>Civica Index</strong> — a quarterly governance score for
              every country. Six dimensions, transparent weights, citable.
            </li>
            <li>
              <strong>Civica Pulse</strong> — daily event-sensitive score that
              shifts the Index when major political events happen.
            </li>
            <li>
              <strong>Compare</strong> — put any two or three countries
              side-by-side: factbook, chambers, elections, orgs.
            </li>
          </ul>
          <Link href="/civica-index/methodology" className="landing-col-more">
            Methodology →
          </Link>
        </div>
      </section>

      <style>{`
        .landing-wrap {
          max-width: 1080px;
          margin: 0 auto;
          padding: 56px 40px 80px;
          color: var(--atlas-ink);
        }
        .landing-hero { padding-bottom: 48px; border-bottom: 1px solid var(--atlas-rule); }
        .landing-hero-eyebrow {
          display: flex; align-items: center; gap: 10px;
          font-family: ui-monospace, monospace;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--atlas-muted);
          margin-bottom: 20px;
        }
        .landing-hero-eyebrow .dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--atlas-accent);
        }
        .landing-hero-title {
          font-family: var(--font-heading, serif);
          font-size: 64px;
          line-height: 1.02;
          letter-spacing: -0.035em;
          font-weight: 400;
          margin: 0 0 24px;
        }
        .landing-hero-lede {
          font-size: 18px;
          line-height: 1.55;
          color: var(--atlas-muted);
          max-width: 640px;
          margin: 0 0 32px;
        }
        .landing-hero-cta { display: flex; gap: 16px; flex-wrap: wrap; }
        .landing-cta {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 12px 20px;
          border: 1px solid var(--atlas-rule);
          font-family: ui-monospace, monospace;
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--atlas-ink);
          text-decoration: none;
          transition: background-color 0.15s, color 0.15s;
        }
        .landing-cta:hover { background: var(--atlas-ink); color: var(--atlas-paper); }
        .landing-cta-primary { background: var(--atlas-ink); color: var(--atlas-paper); border-color: var(--atlas-ink); }
        .landing-cta-primary:hover { background: var(--atlas-accent); border-color: var(--atlas-accent); }

        .landing-columns {
          padding-top: 48px;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 48px;
        }
        .landing-col-eyebrow {
          font-family: ui-monospace, monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--atlas-muted);
          margin-bottom: 16px;
        }

        .landing-ranking { list-style: none; padding: 0; margin: 0 0 16px; }
        .landing-ranking-row {
          display: grid;
          grid-template-columns: 36px 1fr auto;
          gap: 12px;
          padding: 10px 12px;
          align-items: baseline;
          text-decoration: none;
          color: var(--atlas-ink);
          border-bottom: 1px solid var(--atlas-rule);
        }
        .landing-ranking-row:hover { background: var(--atlas-paper-2, rgba(0,0,0,0.03)); }
        .landing-ranking-rank {
          font-family: ui-monospace, monospace;
          font-size: 11px;
          color: var(--atlas-muted);
          letter-spacing: 0.04em;
        }
        .landing-ranking-name {
          font-family: var(--font-heading, serif);
          font-size: 18px;
        }
        .landing-ranking-score {
          font-family: var(--font-heading, serif);
          font-size: 18px;
          font-weight: 500;
        }

        .landing-howto {
          list-style: none; padding: 0; margin: 0 0 16px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .landing-howto li {
          font-size: 15px;
          line-height: 1.55;
          color: var(--atlas-muted);
        }
        .landing-howto li strong {
          color: var(--atlas-ink);
          font-family: var(--font-heading, serif);
          font-size: 16px;
          margin-right: 8px;
        }

        .landing-col-more {
          display: inline-block;
          font-family: ui-monospace, monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--atlas-accent);
          text-decoration: none;
        }
        .landing-col-more:hover { text-decoration: underline; }

        .landing-empty {
          font-family: ui-monospace, monospace;
          font-size: 12px;
          color: var(--atlas-muted);
        }

        @media (max-width: 768px) {
          .landing-wrap { padding: 32px 20px 60px; }
          .landing-hero-title { font-size: 40px; }
          .landing-hero-lede { font-size: 16px; }
          .landing-columns { grid-template-columns: 1fr; gap: 32px; }
        }
      `}</style>
    </div>
  );
}
