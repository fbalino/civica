import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { getCIMethodology, getCIMethodologyHistory } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Civica Index Methodology — How Governance Is Scored",
  description:
    "The Civica Index methodology: four governance dimensions, fixed-bound normalization, Monte Carlo uncertainty intervals, A–F rank bands, and a separate Civica Conditions companion layer. Beta — methodology in active development.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/methodology" },
};

const SECTIONS = [
  { id: "scale", num: 1, label: "Scale" },
  { id: "dimensions", num: 2, label: "Dimensions" },
  { id: "normalization", num: 3, label: "Normalization" },
  { id: "weights", num: 4, label: "Weights" },
  { id: "uncertainty", num: 5, label: "Uncertainty" },
  { id: "bands", num: 6, label: "Rank bands" },
  { id: "missing", num: 7, label: "Missing data" },
  { id: "conditions", num: 8, label: "Conditions" },
  { id: "gov-type", num: 9, label: "Government type" },
  { id: "pulse", num: 10, label: "Civica Pulse" },
  { id: "vintages", num: 11, label: "Vintages" },
  { id: "limitations", num: 12, label: "Limitations" },
  { id: "citation", num: 13, label: "Citation" },
  { id: "versioning", num: 14, label: "Versioning" },
];

interface DimensionRow {
  label: string;
  weight: number;
  tierVar: string;
  primary: string;
  secondary: string;
}

/**
 * Governance core — 4 dimensions. Weights are provisional until the
 * empirical factor analysis described in the weights section confirms
 * the structure. A 5th dimension (Administrative Capacity) is added if
 * and only if PCA shows it's distinct from Rule of Law.
 */
const DIMENSIONS: DimensionRow[] = [
  {
    label: "Democratic quality",
    weight: 30,
    tierVar: "var(--tier-exceptional)",
    primary: "V-Dem Liberal Democracy Index",
    secondary: "V-Dem Electoral Democracy Index",
  },
  {
    label: "Rule of law",
    weight: 25,
    tierVar: "var(--tier-strong)",
    primary: "V-Dem Rule of Law",
    secondary: "World Bank WGI Rule of Law",
  },
  {
    label: "Freedoms & rights",
    weight: 25,
    tierVar: "oklch(70% 0.13 35)",
    primary: "Freedom House (PR + CL combined)",
    secondary: "RSF Press Freedom Index",
  },
  {
    label: "Corruption control",
    weight: 20,
    tierVar: "var(--tier-weak)",
    primary: "Transparency International CPI",
    secondary: "World Bank WGI Control of Corruption",
  },
];

/** Fixed normalization bounds — see normalization section. */
const NORMALIZATION: Array<{
  source: string;
  native: string;
  formula: string;
}> = [
  {
    source: "V-Dem (libdem, polyarchy, rule)",
    native: "0.0 – 1.0",
    formula: "score × 100",
  },
  {
    source: "World Bank WGI",
    native: "−2.5 to +2.5",
    formula: "((score + 2.5) / 5.0) × 100",
  },
  {
    source: "Transparency International CPI",
    native: "0 – 100",
    formula: "score (already on target scale)",
  },
  {
    source: "Freedom House (PR + CL)",
    native: "2 – 14 (sum, inverted)",
    formula: "((14 − score) / 12) × 100",
  },
  {
    source: "RSF Press Freedom",
    native: "0 – 100 (varies by year)",
    formula: "see annual RSF methodology",
  },
];

/** Rank bands — see rank bands section. */
const BANDS: Array<{
  letter: string;
  range: string;
  label: string;
  color: string;
}> = [
  { letter: "A", range: "85 – 100", label: "Exceptional", color: "var(--tier-exceptional)" },
  { letter: "B", range: "70 – 84", label: "Strong", color: "var(--tier-strong)" },
  { letter: "C", range: "55 – 69", label: "Mixed", color: "var(--tier-mixed)" },
  { letter: "D", range: "40 – 54", label: "Weak", color: "var(--tier-weak)" },
  { letter: "E", range: "25 – 39", label: "Very weak", color: "var(--tier-failed)" },
  { letter: "F", range: "0 – 24", label: "Failed / authoritarian", color: "var(--tier-failed)" },
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

  const lastRevision = methodology?.publishedAt
    ? formatDate(methodology.publishedAt)
    : "Apr 2026";

  return (
    <EditorialPage className="civica-methodology-layout">
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
          <Link href="/civica-index">← Civica Index</Link>
          <span>/</span>
          Methodology
        </nav>
        <h1 className="page-title">The Civica Index methodology.</h1>
        <div className="page-meta">
          <span>Beta — methodology in active development</span>
          <span className="dim">·</span>
          <span>{lastRevision}</span>
          <span className="dim">·</span>
          <span>Cut-over target Sept 30, 2026</span>
        </div>

        <Banner className="meth-rebuild-banner" variant="warn">
          <strong>Beta.</strong> The methodology described on this page
          is in active development. Civica&rsquo;s published scores
          will be republished under these rules at cut-over (target
          Sept 30, 2026). Substantive details — the empirical factor
          analysis, source-substitution sensitivity testing, and the
          PCA appendix — are still being finalized; the dimension
          weights below are provisional.
        </Banner>

        <p className="abstract">
          The Civica Index measures the quality of governing
          institutions in every country on a 0–100 scale, with explicit
          uncertainty, rank bands, and full transparency on sources. It
          is the scoring layer of Civica Atlas — useful for orientation,
          honestly presented, never oversold as definitive.
        </p>

        {/* ────────────────────────────────────────────────────── */}
        <section id="scale">
          <h2>
            <span className="num">Section 1</span>Scale
          </h2>
          <p>
            Every Civica Index score is an integer between 0 and 100.
            Higher means stronger governance institutions. Every
            published score is accompanied by:
          </p>
          <ul className="bullets">
            <li>
              <strong>A 90% confidence interval</strong> — e.g. &ldquo;CI
              72 (90% CI: 68–76)&rdquo;. This is the range within which
              the &ldquo;true&rdquo; score is likely to fall, given the
              uncertainty of the underlying data.
            </li>
            <li>
              <strong>A rank band</strong> — A through F, see §6. The
              band is the primary presentation; the integer is for
              researchers and API consumers who want it.
            </li>
            <li>
              <strong>A vintage / freshness timestamp</strong> per
              underlying source. So you can see, for any score, exactly
              how recent each upstream dataset is.
            </li>
            <li>
              <strong>A completeness flag</strong> — Full, Partial, or
              Insufficient. See §7.
            </li>
          </ul>
          <p>
            Scores are integers, not decimals. The underlying data is
            not precise enough to support fractional digits, and
            pretending otherwise misleads readers.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="dimensions">
          <h2>
            <span className="num">Section 2</span>Dimensions
          </h2>
          <p>
            The CI measures{" "}
            <strong>governing institutions and practices</strong> — and
            only those. Material conditions like human development,
            security, and economic stability live on the separate{" "}
            <a href="#conditions">Civica Conditions</a> layer. The four
            governance dimensions:
          </p>

          <div
            className="weights-bar"
            role="img"
            aria-label="Dimension weight visualization (provisional)"
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
                <th>Secondary / cross-check</th>
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

          <p>
            <strong>The weights above are provisional.</strong> Final
            weights are determined by the empirical factor analysis
            described in §4. A fifth dimension — <em>Administrative
            Capacity</em>, drawn from World Bank WGI Government
            Effectiveness and Regulatory Quality — is added if and only
            if it emerges as empirically distinct from Rule of Law in
            that analysis.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="normalization">
          <h2>
            <span className="num">Section 3</span>Normalization
          </h2>
          <p>
            Every source uses a different native scale. Civica
            normalizes them to 0–100 using{" "}
            <strong>fixed theoretical bounds</strong> rather than
            observed minimums and maximums, so scores remain comparable
            across years and aren&rsquo;t shifted by changes elsewhere
            in the dataset:
          </p>

          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Native scale</th>
                <th>Transform to 0–100</th>
              </tr>
            </thead>
            <tbody>
              {NORMALIZATION.map((n, i) => (
                <tr key={i}>
                  <td>{n.source}</td>
                  <td>{n.native}</td>
                  <td className="weight-cell">{n.formula}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p>
            For sources without natural theoretical bounds, the
            methodology uses an{" "}
            <strong>anchored z-score transform</strong>: compute z-scores
            against the global distribution of a fixed reference period
            (2020–2024), then convert via the cumulative normal
            distribution to 0–100. The reference period, mean, and
            standard deviation are documented and frozen — never
            re-anchored — so historical scores remain comparable.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="weights">
          <h2>
            <span className="num">Section 4</span>Weight determination
          </h2>
          <p>
            Weights are derived from the data itself rather than
            asserted, using two standard statistical techniques:
          </p>
          <ul className="bullets">
            <li>
              <strong>Principal component analysis (PCA)</strong> on the
              full country-year panel of normalized indicators (V-Dem
              components, WGI, CPI, Freedom House, RSF) for 2000–2024.
              PCA tells us how many genuinely distinct dimensions exist
              in the data.
            </li>
            <li>
              <strong>Factor analysis with varimax rotation</strong> to
              map each source onto its primary latent factor. This is
              what tells us whether Administrative Capacity is its own
              dimension or just another face of Rule of Law.
            </li>
            <li>
              <strong>Source-substitution sensitivity testing</strong>:
              swap each primary source for its secondary, recompute, and
              confirm that scores stay stable within their published
              uncertainty intervals.
            </li>
          </ul>
          <p>
            The full PCA results — eigenvalues, scree plot, factor
            loadings, and decision rationale — are published as a
            separate appendix at{" "}
            <Link href="/civica-index/methodology/pca-appendix">
              /civica-index/methodology/pca-appendix
            </Link>
            . Headline finding: the four governance dimensions are
            highly correlated (r = 0.74 to 0.98), one dominant latent
            factor explains 90.7% of the variance, and weights
            proportional to the squared first-component loadings come
            out near-equal — close enough to the provisional values
            that rankings barely move under the revision.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="uncertainty">
          <h2>
            <span className="num">Section 5</span>Uncertainty intervals
          </h2>
          <p>
            Every score publishes a 90% confidence interval. The
            interval is computed via{" "}
            <strong>Monte Carlo simulation</strong>:
          </p>
          <pre className="formula">{`for each country:
  for sim in 1 .. 10,000:
    sample each indicator from its
      published-uncertainty distribution
    recompute the CI

  90% CI  =  [5th percentile, 95th percentile]
                of the 10,000 simulated CIs`}</pre>
          <p>
            Most academic sources (V-Dem in particular) publish
            uncertainty information directly. For sources that do not, a
            conservative ±5% of the normalized range is used as the
            indicator&rsquo;s spread. This is documented in the
            replication package.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="bands">
          <h2>
            <span className="num">Section 6</span>Rank bands
          </h2>
          <p>
            The difference between rank 42 and rank 44 is, in any honest
            reading, nothing — it&rsquo;s well within the uncertainty
            interval of either country. Civica publishes{" "}
            <strong>rank bands</strong> instead of exact ranks as the
            primary presentation:
          </p>

          <div
            className="band-scale-viz"
            role="img"
            aria-label="Six-band interpretation scale (A–F)"
          >
            {BANDS.map((b) => (
              <div
                key={b.letter}
                className="band-cell"
                style={{ background: b.color }}
              >
                <strong>
                  {b.letter} · {b.range}
                </strong>
                <small>{b.label}</small>
              </div>
            ))}
          </div>

          <p>
            Country pages display the band prominently: e.g. &ldquo;CI
            72 — Strong (B).&rdquo; Within a band, countries are sorted
            alphabetically or by region rather than by exact integer
            score. The exact integer remains available via the API for
            researchers who want it.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="missing">
          <h2>
            <span className="num">Section 7</span>Missing data
          </h2>
          <p>
            Different countries have different data coverage. Civica
            enforces three rules to handle missing data without
            distorting the score:
          </p>
          <ul className="bullets">
            <li>
              <strong>Mandatory dimensions.</strong> Democratic Quality
              and Rule of Law are required. If either is missing, no CI
              is published for that country — the page reads
              &ldquo;Insufficient data for governance index&rdquo; with
              an explanation of which dimensions are missing.
            </li>
            <li>
              <strong>Partial CI.</strong> If the mandatory dimensions
              are present but one of the others (Freedoms &amp; Rights
              or Corruption Control) is missing, a partial CI is
              published — flagged visually, with the confidence interval
              widened by 20% to reflect the added uncertainty.
            </li>
            <li>
              <strong>Complete CI.</strong> All four (or five)
              dimensions present. No flag.
            </li>
          </ul>
          <p>
            Re-proportioning weights to fill in missing data is
            explicitly avoided — that approach silently biases the
            scores of fragile states upward, since the dimensions most
            likely to be missing are the ones that would have scored
            lowest.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="conditions">
          <h2>
            <span className="num">Section 8</span>Civica Conditions
          </h2>
          <p>
            Human development, security, and economic stability are{" "}
            <strong>
              not part of the Civica Index headline score
            </strong>
            . They are essential context for understanding a country,
            but they measure something different — material conditions,
            shaped by governance but also by geography, economy, and
            external factors.
          </p>
          <p>
            Civica publishes these as the{" "}
            <strong>Civica Conditions</strong> companion layer at{" "}
            <Link href="/civica-conditions">/civica-conditions</Link>.
            Each Conditions dimension is shown separately on country
            pages — never merged into a single number, and never
            combined with the CI.
          </p>
          <table>
            <thead>
              <tr>
                <th>Conditions dimension</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Human Development</td>
                <td>UNDP Human Development Index</td>
              </tr>
              <tr>
                <td>Peace &amp; Security</td>
                <td>Institute for Economics and Peace, Global Peace Index</td>
              </tr>
              <tr>
                <td>Economic Stability</td>
                <td>
                  World Bank composite (inflation, unemployment, GDP
                  growth)
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            The contrast between CI and Conditions is itself
            informative. A poor, well-governed democracy like Botswana
            shows a strong CI alongside moderate Conditions. A wealthy
            autocracy like the UAE shows the inverse. Reading the two
            together tells a fuller story than either could alone.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="gov-type">
          <h2>
            <span className="num">Section 9</span>Government type
          </h2>
          <p>
            Government type is descriptive metadata, not a scoring
            signal. It does not enter the CI calculation in any form.
            Constitutional monarchies are not awarded points for being
            constitutional monarchies; presidential republics are not
            penalized for being presidential republics. The score
            measures governance quality directly, regardless of the
            constitutional shell that produces it.
          </p>
          <p>
            Empirical observation about how governance scores vary by
            government type is published as a separate analysis at{" "}
            <Link href="/civica-index/government-types">
              /civica-index/government-types
            </Link>{" "}
            — average CI per type, distribution spread, twenty-year
            trajectories. The data is presented as observation, never
            as ranking.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="pulse">
          <h2>
            <span className="num">Section 10</span>Civica Pulse (Beta)
          </h2>
          <p>
            The Civica Pulse is the real-time, event-sensitive layer
            that sits on top of the structural CI. It publishes{" "}
            <strong>dimensional deltas</strong> — separate impact values
            on each CI dimension — driven by classified events from
            specialist feeds (ACLED, CIVICUS, RSF alerts, V-Dem pulse,
            HRW / Amnesty) corroborated by general news. Decay is
            category-specific: a coup persists for a year; a journalist
            arrest decays in two months. Positive events require
            stronger corroboration than negative events to resist
            gaming.
          </p>
          <p>
            The Pulse is currently a clearly labelled <em>Beta</em> —
            experimental, not yet citable as authoritative. Its
            methodology is documented in detail at{" "}
            <Link href="/civica-index/methodology/pulse">
              /civica-index/methodology/pulse
            </Link>
            . That page is the sister document to this one and should
            be read alongside. The full event feed is at{" "}
            <Link href="/civica-index/pulse-changelog">
              /civica-index/pulse-changelog
            </Link>
            .
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="vintages">
          <h2>
            <span className="num">Section 11</span>Update frequency &amp; vintages
          </h2>
          <p>
            The Civica Index updates <strong>quarterly</strong> — March,
            June, September, December — to align with source publication
            cycles and to avoid spurious between-quarter movement.
            Mid-quarter source releases are staged for the next
            quarterly publication. Only the Pulse moves daily.
          </p>
          <p>
            To reconcile citation stability with longitudinal
            comparability, every score is preserved in two parallel
            historical series:
          </p>
          <ul className="bullets">
            <li>
              <strong>As-published vintages.</strong> Every quarterly
              snapshot is preserved permanently. Cited values like
              &ldquo;Civica Index 2026 Q3&rdquo; resolve to that frozen
              value forever, regardless of how the methodology evolves
              afterward.
            </li>
            <li>
              <strong>Harmonized back-cast.</strong> Every country&rsquo;s
              historical CI is recomputed annually under the current
              methodology and published as a separate time series — for
              researchers who want apples-to-apples comparisons across
              years. Always clearly labelled as back-cast.
            </li>
          </ul>
          <p>
            Both series are accessible via the API. See §13 for citation
            format.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="limitations">
          <h2>
            <span className="num">Section 12</span>Limitations
          </h2>
          <p>
            <strong>Source lag.</strong> The CI is only as current as
            its slowest-updating source. Some upstream indices publish
            12–18 months behind real-world developments. Quarterly
            updates partially smooth this, but the Pulse exists
            specifically to fill the gap between structural updates.
          </p>
          <p>
            <strong>Coverage gaps.</strong> Some countries have
            insufficient source coverage to compute even a partial CI.
            Those pages display &ldquo;Insufficient data&rdquo; rather
            than guess. The list is published in the replication
            package.
          </p>
          <p>
            <strong>Construct narrowing.</strong> By design, the CI
            measures governing institutions only. If a reader wants to
            ask &ldquo;is this country a good place to live?&rdquo; — a
            different and broader question — the CI alone does not
            answer that. Read it together with{" "}
            <Link href="/civica-conditions">Civica Conditions</Link>.
          </p>
          <p>
            <strong>Provisional weights.</strong> Until the empirical
            factor analysis described in §4 completes, the dimension
            weights are scaffolding. Country pages and API responses
            indicate this status.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="citation">
          <h2>
            <span className="num">Section 13</span>Citation
          </h2>
          <p>
            For published vintages, cite by year and quarter. While the
            Index is in Beta, include the &ldquo;Beta&rdquo; suffix:
          </p>
          <pre className="formula">{`Civica Index 2026 Q3 (Beta). Civica Atlas. https://civicaatlas.org/civica-index
For a specific country:
  Civica Index for [Country], 2026 Q3 (Beta). Civica Atlas.
    https://civicaatlas.org/civica-index/[country-slug]`}</pre>
          <p>
            Once the Beta exits and the Index stabilizes, the
            &ldquo;Beta&rdquo; suffix drops; the year-quarter remains
            the canonical citation handle.
          </p>

          <h3>13.1 · API access</h3>
          <pre className="formula">{`GET /api/v1/index/{country_slug}
GET /api/v1/index/rankings
GET /api/v1/index/methodology
GET /api/v1/pulse/{country_slug}              (Beta — see Pulse spec)
GET /api/v1/pulse/changelog                   (Beta)`}</pre>
          <p>
            Every CI API response includes a{" "}
            <code>meta.methodology</code> block describing the
            methodology revision date and the Beta status — so machine
            consumers can detect the development phase programmatically.
          </p>

          <h3>13.2 · Disputes &amp; corrections</h3>
          <p>
            Every score is open to dispute. Submit data-error
            corrections, methodology disagreements, or Pulse event
            misclassifications at{" "}
            <Link href="/civica-index/corrections">
              /civica-index/corrections
            </Link>
            . Resolution targets: 7 days initial response, 30 days full
            disposition. Every dispute and outcome is logged publicly.
          </p>

          <h3>13.3 · Replication</h3>
          <p>
            Full codebook, processing logic, source references, and
            downloadable derived outputs at{" "}
            <Link href="/civica-index/replication">
              /civica-index/replication
            </Link>
            .
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="versioning">
          <h2>
            <span className="num">Section 14</span>Versioning
          </h2>
          <div className="version-strip">
            <div className="version-cell">
              <div className="version-label">Status</div>
              <div className="version-value">Beta</div>
            </div>
            <div className="version-cell">
              <div className="version-label">Last revision</div>
              <div className="version-value">{lastRevision}</div>
            </div>
            <div className="version-cell">
              <div className="version-label">Cut-over target</div>
              <div className="version-value">Sept 30, 2026</div>
            </div>
            <div className="version-cell">
              <div className="version-label">Quarterly update</div>
              <div className="version-value">Mar / Jun / Sep / Dec</div>
            </div>
          </div>
          <p>
            The methodology is versioned: every change to weights,
            sources, or formulas creates a new methodology snapshot.
            Vintages — the actual published scores — are frozen against
            the methodology that produced them. Cited values resolve to
            the original score under its original methodology,
            regardless of how the methodology evolves afterward.
          </p>
          {history.length > 0 && (
            <>
              <h3>Revision history</h3>
              <ul className="bullets">
                {history.map((h) => (
                  <li key={h.id}>
                    <strong>
                      {h.publishedAt ? formatDate(h.publishedAt) : "Snapshot"}
                    </strong>
                    {h.notes ? ` — ${h.notes}` : ""}
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
          margin-bottom: 32px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
        .meth-article .page-meta .dim { color: var(--color-text-20); }

        .meth-rebuild-banner {
          font-family: var(--font-sans);
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-text-primary);
          background: color-mix(in oklch, var(--color-warn) 10%, var(--color-page-bg) 90%);
          border: 1px solid var(--color-warn);
          border-left: 4px solid var(--color-warn);
          border-radius: 4px;
          padding: 18px 22px;
          margin: 0 0 32px;
        }
        .meth-rebuild-banner strong {
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .meth-rebuild-banner a {
          color: var(--color-accent);
        }

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
        .meth-article p em { color: var(--color-text-primary); }
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
        .meth-article code {
          font-family: var(--font-mono);
          font-size: 0.9em;
          background: var(--color-grid-cell);
          padding: 2px 6px;
          border-radius: 3px;
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
          color: var(--color-text-primary);
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

        .band-scale-viz {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin: 10px 0 32px;
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid var(--color-card-border);
        }
        .band-cell {
          padding: 12px 18px;
          color: var(--color-text-primary);
          display: flex;
          align-items: baseline;
          gap: 16px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
        }
        .band-cell strong {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 16px;
          font-weight: 500;
          letter-spacing: -0.01em;
          flex: 0 0 140px;
        }
        .band-cell small {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.8;
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
          .weights-bar {
            flex-wrap: wrap;
            height: auto;
          }
          .weight-slice {
            flex: 1 1 50%;
            padding: 10px;
          }
          .band-cell strong {
            flex: 0 0 110px;
          }
        }
      `}</style>
    </EditorialPage>
  );
}
