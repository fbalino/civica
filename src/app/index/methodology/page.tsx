import type { Metadata } from "next";
import Link from "next/link";
import { getCIMethodology, getCIMethodologyHistory } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Civica Index Methodology — How We Score Governance",
  description:
    "The Civica Index methodology: six weighted dimensions of governance quality, composite CI scoring, Civica Pulse event decay, data sources, and limitations.",
  alternates: { canonical: "https://civicaatlas.org/index/methodology" },
};

const SECTIONS = [
  { id: "purpose", num: 1, label: "Purpose" },
  { id: "scale", num: 2, label: "Scale" },
  { id: "ci", num: 3, label: "Civica Index (CI)" },
  { id: "cp", num: 4, label: "Civica Pulse (CP)" },
  { id: "gov-modifier", num: 5, label: "Government modifier" },
  { id: "limitations", num: 6, label: "Limitations" },
  { id: "citation", num: 7, label: "Publication & citation" },
  { id: "site", num: 8, label: "Site integration" },
  { id: "versioning", num: 9, label: "Versioning" },
];

interface DimensionRow {
  label: string;
  weight: number;
  tierVar: string;
  primary: string;
  secondary: string;
}

const DIMENSIONS: DimensionRow[] = [
  {
    label: "Democratic quality",
    weight: 30,
    tierVar: "var(--tier-exceptional)",
    primary: "V-Dem Liberal Democracy",
    secondary: "V-Dem Polyarchy",
  },
  {
    label: "Rule of law & institutions",
    weight: 20,
    tierVar: "var(--tier-strong)",
    primary: "World Bank WGI",
    secondary: "V-Dem Rule of Law",
  },
  {
    label: "Human development",
    weight: 15,
    tierVar: "var(--tier-mixed)",
    primary: "UNDP HDI",
    secondary: "WB income/edu/health",
  },
  {
    label: "Freedom & rights",
    weight: 15,
    tierVar: "oklch(70% 0.13 35)",
    primary: "Freedom in the World",
    secondary: "RSF Press Freedom",
  },
  {
    label: "Corruption control",
    weight: 10,
    tierVar: "var(--tier-weak)",
    primary: "Transparency Int'l CPI",
    secondary: "WGI Control of Corruption",
  },
  {
    label: "Stability & security",
    weight: 10,
    tierVar: "var(--tier-failed)",
    primary: "Global Peace Index",
    secondary: "Fragile States Index",
  },
];

interface SeverityRow {
  score: string;
  color: string;
  meaning: string;
  example: string;
}

const SEVERITY_ROWS: SeverityRow[] = [
  {
    score: "−10",
    color: "var(--tier-failed)",
    meaning: "Catastrophic governance failure",
    example: "Full-scale war, genocide, state collapse",
  },
  {
    score: "−7 to −9",
    color: "var(--tier-weak)",
    meaning: "Severe",
    example: "Military coup, mass civilian casualties, total media blackout",
  },
  {
    score: "−4 to −6",
    color: "var(--tier-mixed)",
    meaning: "Significant",
    example: "Major protest crackdown, opposition leader imprisoned",
  },
  {
    score: "−1 to −3",
    color: "var(--color-text-40)",
    meaning: "Moderate",
    example: "Journalist arrested, minor corruption scandal",
  },
  {
    score: "0",
    color: "var(--color-text-40)",
    meaning: "Neutral",
    example: "Routine diplomatic event, sports, weather",
  },
  {
    score: "+1 to +3",
    color: "var(--tier-strong)",
    meaning: "Moderate positive",
    example: "Minor reform, transparency improvement",
  },
  {
    score: "+4 to +6",
    color: "var(--tier-exceptional)",
    meaning: "Significant positive",
    example: "Anti-corruption conviction, rights expansion",
  },
  {
    score: "+7 to +10",
    color: "var(--tier-exceptional)",
    meaning: "Transformative positive",
    example: "Peaceful democratic transition, comprehensive peace agreement",
  },
];

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

export default async function MethodologyPage() {
  let methodology: Awaited<ReturnType<typeof getCIMethodology>> | null = null;
  let history: Awaited<ReturnType<typeof getCIMethodologyHistory>> = [];
  try {
    [methodology, history] = await Promise.all([
      getCIMethodology(),
      getCIMethodologyHistory(),
    ]);
  } catch {
    // DB not seeded
  }

  const version = methodology?.id ?? "1.0";
  const published = methodology?.publishedAt
    ? formatDate(methodology.publishedAt)
    : "Apr 2026";
  const countriesCovered = 197;
  const datasets = 9;

  return (
    <div className="civica-methodology-layout">
      <aside className="meth-toc" aria-label="On this page">
        <div className="meth-toc-label">On this page</div>
        <ol className="meth-toc-list">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>
                {s.num} · {s.label}
              </a>
            </li>
          ))}
        </ol>
      </aside>

      <article className="meth-article">
        <nav className="breadcrumb">
          <Link href="/index">← Civica Index</Link>
          <span>/</span>
          Methodology
        </nav>
        <h1 className="page-title">The Civica Index methodology.</h1>
        <div className="page-meta">
          <span>Version {version}</span>
          <span className="dim">·</span>
          <span>{published}</span>
          <span className="dim">·</span>
          <span>DOI pending</span>
        </div>

        <p className="abstract">
          The Civica Index is a composite governance score assigned to every
          sovereign state — a structural score (CI) updated quarterly, and a
          real-time Pulse (CP) updated daily from classified events.
          Transparent sources. Fixed weights. Reproducible. Citable.
        </p>

        <section id="purpose">
          <h2>
            <span className="num">Section 1</span>Purpose
          </h2>
          <p>
            The Civica Index measures overall quality of governance —
            democratic participation, institutional strength, rule of law,
            human development, freedom, and security — through two
            complementary scores:
          </p>
          <ul className="bullets">
            <li>
              <strong>Civica Index (CI)</strong> — structural, updated
              quarterly; answers &ldquo;how well-governed over time?&rdquo;
            </li>
            <li>
              <strong>Civica Pulse (CP)</strong> — event-sensitive, updated
              daily; answers &ldquo;what&rsquo;s the state <em>right now</em>?&rdquo;
            </li>
          </ul>
          <p>
            The Index is transparent (every component traces to a public
            source), reproducible (methodology fully documented), and citable
            (structured for academic, journalistic, and institutional use).
          </p>
        </section>

        <section id="scale">
          <h2>
            <span className="num">Section 2</span>The 0–100 scale
          </h2>
          <p>
            Both CI and CP are expressed on a 0–100 scale, where higher is
            better. Five interpretive tiers:
          </p>
          <div
            className="tier-scale-viz"
            role="img"
            aria-label="Five-tier interpretation scale"
          >
            <div
              className="tier-scale-cell"
              style={{ background: "var(--tier-failed)" }}
            >
              <strong>0–24</strong>Failed / authoritarian
            </div>
            <div
              className="tier-scale-cell"
              style={{ background: "var(--tier-weak)" }}
            >
              <strong>25–49</strong>Weak
            </div>
            <div
              className="tier-scale-cell"
              style={{ background: "var(--tier-mixed)" }}
            >
              <strong>50–74</strong>Mixed
            </div>
            <div
              className="tier-scale-cell"
              style={{ background: "var(--tier-strong)" }}
            >
              <strong>75–89</strong>Strong
            </div>
            <div
              className="tier-scale-cell"
              style={{ background: "var(--tier-exceptional)" }}
            >
              <strong>90–100</strong>Exceptional
            </div>
          </div>
        </section>

        <section id="ci">
          <h2>
            <span className="num">Section 3</span>Civica Index — structural
          </h2>

          <h3>3.1 · The six dimensions</h3>
          <p>
            The CI is a weighted composite of six dimensions, each sourced from
            established, peer-reviewed or institutionally maintained open
            datasets. Raw values are normalized to 0–100 before weighting:
          </p>

          <div
            className="weights-bar"
            role="img"
            aria-label="Dimension weights visualization"
          >
            {DIMENSIONS.map((d) => (
              <div
                key={d.label}
                className="weight-slice"
                style={{ background: d.tierVar, flex: d.weight }}
              >
                <strong>{d.weight}%</strong>
                <small>{d.label}</small>
              </div>
            ))}
          </div>

          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Weight</th>
                <th>Primary source</th>
                <th>Secondary source</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td className="weight-cell">{d.weight}%</td>
                  <td>{d.primary}</td>
                  <td>{d.secondary}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>3.2 · Normalization</h3>
          <p>
            Each source uses a different native scale. All are normalized to
            0–100 using min-max normalization across the full dataset of
            countries:
          </p>
          <pre className="formula">{`normalized_score = ((raw_value − global_min) / (global_max − global_min)) × 100`}</pre>
          <p>
            For inverted scales (where lower = better, such as GPI and Freedom
            House), the normalization is reversed.
          </p>

          <h3>3.3 · Composite</h3>
          <pre className="formula">{`CI = (0.30 × democratic_quality)
   + (0.20 × rule_of_law)
   + (0.15 × human_development)
   + (0.15 × freedom_rights)
   + (0.10 × corruption_control)
   + (0.10 × stability_security)`}</pre>

          <h3>3.4 · Update frequency</h3>
          <p>
            The CI updates <strong>quarterly</strong>. Between publications, the
            CI carries forward the most recent available value per source. The
            CI never moves between quarterly recalculations — that&rsquo;s what
            the Pulse is for.
          </p>

          <h3>3.5 · Missing data</h3>
          <p>
            If a country has no data for a dimension, that dimension is
            excluded and remaining weights are re-proportioned to sum to 100%.
            The CI is flagged <strong>&ldquo;partial&rdquo;</strong>. If fewer
            than three of the six dimensions have data, no CI is calculated.
          </p>
        </section>

        <section id="cp">
          <h2>
            <span className="num">Section 4</span>Civica Pulse — real-time
          </h2>

          <h3>4.1 · Concept</h3>
          <p>
            The Pulse starts at the country&rsquo;s current CI and is modified
            by a real-time event impact layer:
          </p>
          <pre className="formula">{`CP = CI + EventImpact`}</pre>

          <h3>4.2 · Event ingestion</h3>
          <p>
            An automated pipeline monitors global news sources daily (GDELT,
            Google News, Reuters/AP, country gazettes). It filters for events
            tagged to a specific country that fall within governance-relevant
            categories.
          </p>

          <h3>4.3 · Event classification</h3>
          <p>
            Each qualifying event is classified by an LLM agent into one of
            twelve directional categories — from <em>armed conflict</em>{" "}
            (negative) to <em>democratic election</em> (positive). Every score
            is logged with category, severity, confidence, and a one-sentence
            justification. All are published in the{" "}
            <Link href="/index/changelog">Pulse changelog</Link> for audit.
          </p>

          <h3>4.4 · Severity scale (−10 to +10)</h3>
          <table>
            <thead>
              <tr>
                <th>Score</th>
                <th>Meaning</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              {SEVERITY_ROWS.map((r) => (
                <tr key={r.score}>
                  <td className="weight-cell" style={{ color: r.color }}>
                    {r.score}
                  </td>
                  <td>{r.meaning}</td>
                  <td>{r.example}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>4.5 · Temporal decay</h3>
          <p>
            Events lose influence over time. The decay is exponential with a{" "}
            <strong>30-day half-life</strong>:
          </p>
          <pre className="formula">{`decayed_impact = severity × confidence × e^(−0.693 × days / 30)`}</pre>
          <p>
            An event from today counts 100%. From 30 days ago, 50%. From 60
            days, 25%. From 90 days, 12.5%. From 120+ days, negligible
            (&lt;6%).
          </p>

          <h3>4.6 · Aggregation and clamp</h3>
          <pre className="formula">{`EventImpact = Σ (severity × confidence × e^(−0.693 × days / 30))
CP          = clamp(CI + clamp(EventImpact, −30, +30), 0, 100)`}</pre>
          <p>
            The ±30-point cap on EventImpact prevents a single catastrophic
            event from completely overriding years of structural data.
          </p>

          <h3>4.7 · Update frequency</h3>
          <p>
            The Pulse recomputes <strong>daily</strong>. Every Pulse movement
            comes with a public changelog entry showing every contributing
            event, its category, severity, confidence, and justification.
          </p>
        </section>

        <section id="gov-modifier">
          <h2>
            <span className="num">Section 5</span>Government-type modifier
          </h2>
          <p>
            The CI does <strong>not</strong> apply a fixed bonus or penalty per
            government type. Instead, the site publishes an empirical
            observation layer —{" "}
            <Link href="/index/government-types">
              Governance Outcomes by Government Type
            </Link>{" "}
            — showing average CI, distribution spread, and 20-year trajectories
            for each category. The data speaks for itself.
          </p>
        </section>

        <section id="limitations">
          <h2>
            <span className="num">Section 6</span>Data quality &amp; limitations
          </h2>
          <p>
            <strong>Known limitations.</strong> The CI is only as current as its
            slowest-updating source (some indices publish 12–18 months behind).
            Pulse event scoring relies on LLM judgment, which may exhibit
            biases in event selection or severity. Countries with limited media
            coverage will have fewer detected events, potentially making their
            Pulse artificially stable. The ±30-point cap prevents extreme
            scores but may understate truly catastrophic situations.
          </p>
          <p>
            <strong>Mitigations.</strong> All LLM event scores are logged with
            justifications for audit. A quarterly human review samples 5% of
            scored events. The methodology is versioned; weight/source/formula
            changes publish with a changelog. Countries with fewer than 3
            events in 90 days are flagged <em>low-confidence</em>.
          </p>
        </section>

        <section id="citation">
          <h2>
            <span className="num">Section 7</span>Publication &amp; citation
          </h2>
          <pre className="formula">{`Civica Index ${new Date().getFullYear()}. Civica Atlas. https://civicaatlas.org/index
Civica Pulse for [Country], [Date]. Civica Atlas. https://civicaatlas.org/index/[slug]`}</pre>

          <h3>API access</h3>
          <pre className="formula">{`GET https://civicaatlas.org/api/v1/index/{country_slug}
GET https://civicaatlas.org/api/v1/pulse/{country_slug}
GET https://civicaatlas.org/api/v1/index/rankings
GET https://civicaatlas.org/api/v1/pulse/changelog/{country_slug}`}</pre>
          <p>
            A small embeddable badge showing a country&rsquo;s CI and CP is
            available for news organizations, blogs, and other platforms to
            embed with attribution.
          </p>
        </section>

        <section id="site">
          <h2>
            <span className="num">Section 8</span>Site integration
          </h2>
          <table>
            <thead>
              <tr>
                <th>Page</th>
                <th>What it shows</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>/index</td>
                <td>Global leaderboard · all countries ranked by CI or CP, filterable</td>
              </tr>
              <tr>
                <td>/index/[slug]</td>
                <td>Country detail · dimension breakdown, Pulse changelog, history</td>
              </tr>
              <tr>
                <td>/index/compare</td>
                <td>Overlay two or three countries on a timeline</td>
              </tr>
              <tr>
                <td>/index/methodology</td>
                <td>This document</td>
              </tr>
              <tr>
                <td>/index/government-types</td>
                <td>Governance outcomes by government type</td>
              </tr>
              <tr>
                <td>/index/changelog</td>
                <td>Global feed of all Pulse movements across all countries</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id="versioning">
          <h2>
            <span className="num">Section 9</span>Versioning
          </h2>
          <div className="version-strip">
            <div className="version-cell">
              <div className="version-label">Version</div>
              <div className="version-value">{version}</div>
            </div>
            <div className="version-cell">
              <div className="version-label">Published</div>
              <div className="version-value">{published}</div>
            </div>
            <div className="version-cell">
              <div className="version-label">Countries covered</div>
              <div className="version-value">{countriesCovered}</div>
            </div>
            <div className="version-cell">
              <div className="version-label">Open-source datasets</div>
              <div className="version-value">{datasets}</div>
            </div>
          </div>
          <p>
            Changes to weights, sources, formulas, or the event-scoring
            framework are documented in a public changelog and assigned a new
            version number. Historical CI/CP values are never retroactively
            recalculated; they&rsquo;re preserved as-is with their methodology
            version recorded. This way, cited values remain stable forever.
          </p>
          {history.length > 0 && (
            <>
              <h3>Changelog</h3>
              <ul className="bullets">
                {history.map((h) => (
                  <li key={h.id}>
                    <strong>v{h.id}</strong>
                    {h.publishedAt ? ` — ${formatDate(h.publishedAt)}` : ""}
                    {h.notes ? ` · ${h.notes}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </article>

      <style>{`
        .civica-methodology-layout {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 var(--spacing-page-x, 40px);
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 64px;
          color: var(--color-text-primary);
        }
        .meth-toc {
          position: sticky;
          top: 80px;
          align-self: start;
          padding: 60px 0 40px;
        }
        .meth-toc-label {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 14px;
        }
        .meth-toc-list {
          list-style: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .meth-toc-list a {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          color: var(--color-text-40);
          text-decoration: none;
          letter-spacing: 0.03em;
          padding-left: 10px;
          border-left: 2px solid var(--color-divider);
          line-height: 1.4;
          display: block;
        }
        .meth-toc-list a:hover {
          color: var(--color-text-primary);
          border-left-color: var(--color-text-40);
        }

        .meth-article {
          padding: 60px 0 80px;
          max-width: 760px;
        }
        .meth-article .breadcrumb {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          letter-spacing: 0.03em;
          color: var(--color-text-30);
          margin-bottom: 16px;
          display: flex; gap: 8px; align-items: center;
        }
        .meth-article .breadcrumb a {
          color: var(--color-text-30);
          text-decoration: none;
        }
        .meth-article .page-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 56px;
          font-weight: 400;
          letter-spacing: -0.04em;
          line-height: 1.02;
          margin-bottom: 12px;
        }
        .meth-article .page-meta {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          letter-spacing: 0.03em;
          color: var(--color-text-30);
          margin-bottom: 48px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
        .meth-article .page-meta .dim { color: var(--color-text-20); }

        .meth-article .abstract {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 22px;
          line-height: 1.5;
          color: var(--color-text-60);
          letter-spacing: -0.01em;
          border-left: 3px solid var(--color-accent);
          padding: 4px 0 4px 24px;
          margin: 0 0 56px;
        }

        .meth-article h2 {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 36px;
          font-weight: 400;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin: 56px 0 20px;
          scroll-margin-top: 80px;
        }
        .meth-article h2 .num {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 14px;
          letter-spacing: 0.12em;
          color: var(--color-text-30);
          display: block;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .meth-article h3 {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.01em;
          line-height: 1.25;
          margin: 32px 0 12px;
        }
        .meth-article p {
          color: var(--color-text-60);
          margin-bottom: 16px;
          font-size: 16px;
          line-height: 1.7;
        }
        .meth-article p strong { color: var(--color-text-primary); font-weight: 500; }
        .meth-article a { color: var(--color-accent); }
        .meth-article ul.bullets {
          color: var(--color-text-60);
          padding-left: 20px;
          margin-bottom: 24px;
        }
        .meth-article ul.bullets li {
          margin-bottom: 8px;
          line-height: 1.6;
        }

        .meth-article .formula {
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-left: 3px solid var(--color-accent);
          border-radius: 4px;
          padding: 20px 24px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 13px;
          color: var(--color-text-primary);
          line-height: 1.7;
          margin: 20px 0 24px;
          white-space: pre;
          overflow-x: auto;
        }

        .meth-article table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0 28px;
          font-size: 14px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
        }
        .meth-article thead th {
          text-align: left;
          padding: 12px 14px;
          background: var(--color-grid-cell);
          border-top: 1px solid var(--color-card-border);
          border-bottom: 1px solid var(--color-card-border);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-30);
          font-weight: 500;
        }
        .meth-article tbody td {
          padding: 14px;
          border-bottom: 1px solid var(--color-divider);
          color: var(--color-text-60);
          vertical-align: top;
          line-height: 1.5;
        }
        .meth-article tbody tr:hover { background: var(--color-grid-cell); }
        .meth-article .weight-cell {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 16px;
          font-weight: 500;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
        }

        .weights-bar {
          display: flex;
          margin: 8px 0 36px;
          height: 44px;
          border-radius: 2px;
          overflow: hidden;
          border: 1px solid var(--color-card-border);
        }
        .weight-slice {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 14px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 11px;
          color: #16140f;
          min-width: 80px;
          border-right: 1px solid rgba(0,0,0,0.2);
        }
        .weight-slice:last-child { border-right: none; }
        .weight-slice strong {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          display: block;
        }
        .weight-slice small {
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.8;
        }

        .tier-scale-viz {
          display: flex;
          height: 52px;
          margin: 10px 0 32px;
          border-radius: 2px;
          overflow: hidden;
          border: 1px solid var(--color-card-border);
        }
        .tier-scale-cell {
          flex: 1;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #16140f;
        }
        .tier-scale-cell strong {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 14px;
          font-weight: 500;
        }

        .version-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: var(--color-grid-bg);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          overflow: hidden;
          margin: 24px 0 48px;
        }
        .version-cell { background: var(--color-grid-cell); padding: 18px 20px; }
        .version-label {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 6px;
        }
        .version-value {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 20px;
          letter-spacing: -0.02em;
        }

        @media (max-width: 900px) {
          .civica-methodology-layout {
            grid-template-columns: 1fr;
            gap: 0;
            padding: 0 20px;
          }
          .meth-toc {
            position: static;
            padding: 32px 0 0;
          }
          .meth-toc-list {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 8px;
          }
          .meth-toc-list a {
            padding: 4px 10px;
            border-left: none;
            border: 1px solid var(--color-card-border);
            border-radius: 2px;
          }
          .meth-article .page-title { font-size: 40px; }
          .meth-article h2 { font-size: 28px; }
          .version-strip { grid-template-columns: 1fr 1fr; }
          .weights-bar,
          .tier-scale-viz {
            flex-wrap: wrap;
            height: auto;
          }
          .weight-slice,
          .tier-scale-cell {
            flex: 1 1 50%;
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
}
