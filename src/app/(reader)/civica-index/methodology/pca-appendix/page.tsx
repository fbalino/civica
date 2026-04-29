import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";

export const metadata: Metadata = {
  title: "PCA appendix — Civica Index methodology",
  description:
    "Empirical justification for the Civica Index Beta dimension weights. PCA on the four governance dimensions confirms a single dominant latent factor; weights are derived from the squared loadings on the first principal component.",
  alternates: {
    canonical: "https://civicaatlas.org/civica-index/methodology/pca-appendix",
  },
};

interface LoadingRow {
  dimension: string;
  label: string;
  pc1: number;
  pc2: number;
  pc3: number;
  pc4: number;
  /** Squared PC1 loading, normalized to sum to 1.00. */
  weightSuggested: number;
  /** What the spec proposed before the PCA. */
  weightProvisional: number;
  /** What we adopted (rounded suggested to 2dp). */
  weightAdopted: number;
}

const LOADINGS: LoadingRow[] = [
  {
    dimension: "democratic_quality",
    label: "Democratic quality",
    pc1: 0.516,
    pc2: 0.261,
    pc3: -0.529,
    pc4: 0.621,
    weightSuggested: 0.266,
    weightProvisional: 0.30,
    weightAdopted: 0.27,
  },
  {
    dimension: "rule_of_law",
    label: "Rule of law",
    pc1: 0.507,
    pc2: -0.407,
    pc3: 0.684,
    pc4: 0.333,
    weightSuggested: 0.257,
    weightProvisional: 0.25,
    weightAdopted: 0.26,
  },
  {
    dimension: "freedom_rights",
    label: "Freedoms & rights",
    pc1: 0.479,
    pc2: 0.698,
    pc3: 0.280,
    pc4: -0.452,
    weightSuggested: 0.229,
    weightProvisional: 0.25,
    weightAdopted: 0.23,
  },
  {
    dimension: "corruption_control",
    label: "Corruption control",
    pc1: 0.498,
    pc2: -0.528,
    pc3: -0.417,
    pc4: -0.547,
    weightSuggested: 0.248,
    weightProvisional: 0.20,
    weightAdopted: 0.24,
  },
];

interface EigenRow {
  pc: string;
  eigenvalue: number;
  varExplained: number;
  cumulative: number;
}

const EIGENVALUES: EigenRow[] = [
  { pc: "PC1", eigenvalue: 3.707, varExplained: 0.907, cumulative: 0.907 },
  { pc: "PC2", eigenvalue: 0.343, varExplained: 0.084, cumulative: 0.991 },
  { pc: "PC3", eigenvalue: 0.027, varExplained: 0.007, cumulative: 0.997 },
  { pc: "PC4", eigenvalue: 0.011, varExplained: 0.003, cumulative: 1.000 },
];

interface CorrRow {
  dim: string;
  democratic_quality: number;
  rule_of_law: number;
  freedom_rights: number;
  corruption_control: number;
}

const CORRELATIONS: CorrRow[] = [
  {
    dim: "Democratic quality",
    democratic_quality: 1.0,
    rule_of_law: 0.90,
    freedom_rights: 0.95,
    corruption_control: 0.89,
  },
  {
    dim: "Rule of law",
    democratic_quality: 0.90,
    rule_of_law: 1.0,
    freedom_rights: 0.81,
    corruption_control: 0.98,
  },
  {
    dim: "Freedoms & rights",
    democratic_quality: 0.95,
    rule_of_law: 0.81,
    freedom_rights: 1.0,
    corruption_control: 0.74,
  },
  {
    dim: "Corruption control",
    democratic_quality: 0.89,
    rule_of_law: 0.98,
    freedom_rights: 0.74,
    corruption_control: 1.0,
  },
];

export default function PcaAppendixPage() {
  return (
    <EditorialPage className="pca-layout">
      <article className="pca-article">
        <nav className="breadcrumb">
          <Link href="/civica-index">← Civica Index</Link>
          <span>/</span>
          <Link href="/civica-index/methodology">Methodology</Link>
          <span>/</span>
          PCA appendix
        </nav>

        <h1 className="page-title">PCA appendix.</h1>
        <div className="page-meta">
          <span>Empirical weight derivation</span>
          <span className="dim">·</span>
          <span>Run: April 2026</span>
          <span className="dim">·</span>
          <span>n = 46 countries</span>
        </div>

        <p className="abstract">
          The dimension weights used in the Civica Index are derived from
          the data, not asserted. This page documents the principal
          component analysis that produced them, with full disclosure
          of methodology, sample size, and limitations.
        </p>

        {/* ────────────────────────────────────────────────────── */}
        <section id="summary">
          <h2>
            <span className="num">Section 1</span>Headline finding
          </h2>
          <p>
            The four governance dimensions of the Civica Index are{" "}
            <strong>highly correlated</strong> (range 0.74 to 0.98).
            Principal component analysis confirms a single dominant
            latent factor: <strong>PC1 explains 90.7% of the variance</strong>{" "}
            in the panel, and all four dimensions load on it with
            similar magnitude (0.479 to 0.516). Components 2 through 4
            each have eigenvalues well below the Kaiser threshold of
            1.0, meaning the data does not support breaking the
            governance core into multiple distinct factors.
          </p>
          <p>
            The four-dimension breakout is therefore best understood
            as a <strong>transparency device</strong> — it lets readers
            see how each facet contributes — rather than as a claim
            that the four are statistically independent. The composite
            score is, in effect, a single &ldquo;governance
            quality&rdquo; index disaggregated into four interpretable
            sub-scores.
          </p>
          <p>
            Weights are taken proportional to the squared PC1 loadings
            (a standard practice in composite-index construction):
          </p>

          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Provisional</th>
                <th>PCA-suggested</th>
                <th>Adopted</th>
              </tr>
            </thead>
            <tbody>
              {LOADINGS.map((r) => (
                <tr key={r.dimension}>
                  <td>{r.label}</td>
                  <td className="num-cell">
                    {r.weightProvisional.toFixed(2)}
                  </td>
                  <td className="num-cell">
                    {r.weightSuggested.toFixed(3)}
                  </td>
                  <td className="num-cell weight-adopted">
                    {r.weightAdopted.toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr className="row-total">
                <td>Sum</td>
                <td className="num-cell">1.00</td>
                <td className="num-cell">1.000</td>
                <td className="num-cell weight-adopted">1.00</td>
              </tr>
            </tbody>
          </table>

          <p>
            The biggest revision is corruption control (0.20 → 0.24,
            +20% relative). Democratic quality drops slightly
            (0.30 → 0.27). The other two are essentially unchanged.
            Because the indicators are so correlated, the impact on
            country rankings is small: the largest delta from the
            weight revision alone is under one point.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="data">
          <h2>
            <span className="num">Section 2</span>The panel
          </h2>
          <p>
            <strong>n = 46 countries</strong> with all four governance
            dimensions present. Data vintage: 2023 (the most recent
            year fully ingested into Civica). Source:{" "}
            <code>ci_dimension_scores</code> table, normalized via the
            Beta fixed-bound transforms documented in the{" "}
            <Link href="/civica-index/methodology#normalization">
              main methodology
            </Link>
            .
          </p>
          <p>
            The countries are not a random sample — they are the
            ingested set, weighted toward larger democracies and
            authoritarian states with active governance research
            coverage. Coverage is sparser in small island states and
            in microstates. This is a known limitation of the panel and
            does not change the conclusion that the four indicators
            are highly correlated, but it does mean the absolute
            magnitude of the loadings might shift slightly with a
            broader sample.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="correlations">
          <h2>
            <span className="num">Section 3</span>Correlation matrix
          </h2>
          <p>
            Pearson correlations between the four normalized dimensions:
          </p>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Demo. quality</th>
                <th>Rule of law</th>
                <th>Freedoms &amp; rights</th>
                <th>Corruption ctrl</th>
              </tr>
            </thead>
            <tbody>
              {CORRELATIONS.map((r) => (
                <tr key={r.dim}>
                  <td>
                    <strong>{r.dim}</strong>
                  </td>
                  <td className="num-cell">
                    {r.democratic_quality.toFixed(2)}
                  </td>
                  <td className="num-cell">{r.rule_of_law.toFixed(2)}</td>
                  <td className="num-cell">{r.freedom_rights.toFixed(2)}</td>
                  <td className="num-cell">
                    {r.corruption_control.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Every off-diagonal correlation is above 0.74 — strong by
            any reasonable threshold. Rule of law and corruption
            control are nearly indistinguishable empirically (r =
            0.98), which suggests the weight on those two could be
            partially redundant. The 5th-dimension test in §6 partially
            addresses this question; a fuller answer requires the
            ingestion of separate WGI Government Effectiveness data.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="eigenvalues">
          <h2>
            <span className="num">Section 4</span>Eigenvalues &amp; variance
          </h2>
          <p>
            PCA on the standardized panel (mean 0, variance 1 per
            dimension) yields these eigenvalues:
          </p>
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Eigenvalue</th>
                <th>Var. explained</th>
                <th>Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {EIGENVALUES.map((r) => (
                <tr key={r.pc}>
                  <td>
                    <strong>{r.pc}</strong>
                  </td>
                  <td className="num-cell">{r.eigenvalue.toFixed(3)}</td>
                  <td className="num-cell">
                    {(r.varExplained * 100).toFixed(1)}%
                  </td>
                  <td className="num-cell">
                    {(r.cumulative * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            The Kaiser criterion (retain components with eigenvalue
            &gt; 1) selects only PC1. The scree plot makes the same
            point visually:
          </p>
          <figure className="scree-figure">
            <img
              src="/methodology/phase-5-3-scree-plot.png"
              alt="Scree plot showing PC1 eigenvalue at 3.71, all subsequent components below 1.0"
            />
            <figcaption>
              Eigenvalue scree. The dashed line is the Kaiser threshold
              (eigenvalue = 1.0); only PC1 sits above it.
            </figcaption>
          </figure>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="loadings">
          <h2>
            <span className="num">Section 5</span>PC loadings
          </h2>
          <p>
            How much each dimension contributes to each principal
            component:
          </p>
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>PC1</th>
                <th>PC2</th>
                <th>PC3</th>
                <th>PC4</th>
              </tr>
            </thead>
            <tbody>
              {LOADINGS.map((r) => (
                <tr key={r.dimension}>
                  <td>{r.label}</td>
                  <td className="num-cell loading-pc1">
                    {r.pc1.toFixed(3)}
                  </td>
                  <td className="num-cell">{r.pc2.toFixed(3)}</td>
                  <td className="num-cell">{r.pc3.toFixed(3)}</td>
                  <td className="num-cell">{r.pc4.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            On PC1 — the only component the data supports — the four
            loadings are tightly clustered (0.479 to 0.516, range 0.04).
            All four dimensions contribute roughly equally to the
            single &ldquo;governance quality&rdquo; latent factor. PC2
            through PC4 represent residual variance below the noise
            floor.
          </p>
          <p>
            Squaring the PC1 loadings and normalizing them to sum to
            1.00 gives the suggested weights in §1. Rounding to two
            decimal places (and adjusting one weight by 0.01 to make
            the rounded values sum exactly to 1.00) gives the adopted
            weights.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="five-dim">
          <h2>
            <span className="num">Section 6</span>The 5th-dimension test
          </h2>
          <p>
            The methodology spec considers adding a fifth dimension —
            <em>Administrative Capacity</em>, drawn from World Bank WGI
            Government Effectiveness and Regulatory Quality — if and
            only if it emerges as empirically distinct from Rule of
            Law in factor analysis.
          </p>
          <p>
            <strong>This phase does not test that question.</strong> The
            WGI Government Effectiveness indicator is not yet ingested
            into Civica. The high correlation between Rule of Law and
            Corruption Control (r = 0.98) hints that adding a related
            governance-quality indicator might simply load on the same
            factor as Rule of Law — but that&rsquo;s a hypothesis, not
            a finding. The test is deferred to a follow-up phase
            (after the indicator is ingested), at which point this
            appendix will be re-run and, if warranted, the methodology
            updated.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="limitations">
          <h2>
            <span className="num">Section 7</span>Limitations
          </h2>
          <p>
            <strong>Sample size.</strong> The methodology spec
            envisions a panel of 2000–2024 country-years (thousands of
            observations). The current panel is 46 countries from a
            single year — statistically usable but underpowered. Final
            weights will be re-validated when the historical panel is
            ingested. The structural decision (4-dim core, near-equal
            weights) is unlikely to change because the underlying
            correlation structure of these indicators is well-documented
            in the governance-measurement literature, but the precise
            magnitudes might shift.
          </p>
          <p>
            <strong>Single-year panel.</strong> A cross-sectional PCA
            captures shared variance at one moment in time. It does
            not test whether the same factor structure holds over
            decades. The historical panel will address this.
          </p>
          <p>
            <strong>Source coverage.</strong> The 46 countries with all
            four dimensions are skewed toward larger states and active
            governance-research targets. Microstates and small island
            states are under-represented. The PCA findings should be
            understood as describing &ldquo;the kinds of countries we
            currently have data for.&rdquo;
          </p>
          <p>
            <strong>No source-substitution sensitivity test.</strong>{" "}
            The spec calls for swapping each primary source with its
            secondary (e.g., V-Dem Liberal Democracy → V-Dem Polyarchy)
            and confirming rank stability. This requires the secondary
            sources to be ingested in parallel. Deferred to the same
            follow-up.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        <section id="reproduction">
          <h2>
            <span className="num">Section 8</span>Reproducing this analysis
          </h2>
          <p>
            The full Python pipeline that produced these numbers is
            checked into the repository at{" "}
            <code>analysis/phase-5-3/run_pca.py</code>. It pulls
            directly from the production database, applies the same
            fixed-bound normalization documented in the main
            methodology, runs PCA via scikit-learn, and writes:
          </p>
          <ul className="bullets">
            <li>
              <code>eigenvalues.csv</code> — the table in §4
            </li>
            <li>
              <code>loadings_pca.csv</code> — the table in §5
            </li>
            <li>
              <code>correlations.csv</code> — the matrix in §3
            </li>
            <li>
              <code>scree_plot.png</code> — the figure in §4
            </li>
            <li>
              <code>results.json</code> — machine-readable summary
              including the suggested weights
            </li>
          </ul>
          <p>
            To re-run the analysis on updated data:{" "}
            <code>cd analysis/phase-5-3 && uv run python run_pca.py</code>.
            The Python environment is managed by{" "}
            <a href="https://docs.astral.sh/uv/">uv</a> and the lockfile
            is committed for reproducibility.
          </p>
        </section>
      </article>

      <style>{`
        .pca-layout {
          max-width: 800px;
          margin: 0 auto;
          padding: 60px var(--spacing-page-x, 40px) 80px;
          color: var(--color-text-primary);
        }
        .pca-article .breadcrumb {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          letter-spacing: 0.03em;
          color: var(--color-text-30);
          margin-bottom: 16px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .pca-article .breadcrumb a {
          color: var(--color-text-30);
          text-decoration: none;
        }
        .pca-article .page-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 56px;
          font-weight: 400;
          letter-spacing: -0.04em;
          line-height: 1.02;
          margin-bottom: 12px;
        }
        .pca-article .page-meta {
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
        .pca-article .page-meta .dim { color: var(--color-text-20); }
        .pca-article .abstract {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 22px;
          line-height: 1.5;
          color: var(--color-text-60);
          letter-spacing: -0.01em;
          border-left: 3px solid var(--color-accent);
          padding: 4px 0 4px 24px;
          margin: 0 0 56px;
        }
        .pca-article h2 {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 32px;
          font-weight: 400;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin: 56px 0 16px;
          scroll-margin-top: 80px;
        }
        .pca-article h2 .num {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          letter-spacing: 0.12em;
          color: var(--color-text-30);
          display: block;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .pca-article p {
          color: var(--color-text-60);
          margin-bottom: 16px;
          font-size: 16px;
          line-height: 1.7;
        }
        .pca-article p strong { color: var(--color-text-primary); font-weight: 500; }
        .pca-article p em { color: var(--color-text-primary); }
        .pca-article a { color: var(--color-accent); }
        .pca-article ul.bullets {
          color: var(--color-text-60);
          padding-left: 20px;
          margin-bottom: 24px;
        }
        .pca-article ul.bullets li {
          margin-bottom: 6px;
          line-height: 1.6;
        }
        .pca-article code {
          font-family: var(--font-mono);
          font-size: 0.9em;
          background: var(--color-grid-cell);
          padding: 2px 6px;
          border-radius: 3px;
        }
        .pca-article table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0 28px;
          font-size: 14px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
        }
        .pca-article thead th {
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
        .pca-article tbody td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--color-divider);
          color: var(--color-text-60);
          vertical-align: top;
          line-height: 1.5;
        }
        .pca-article tbody tr:hover { background: var(--color-grid-cell); }
        .pca-article .num-cell {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 16px;
          font-weight: 500;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
          text-align: right;
        }
        .pca-article .weight-adopted {
          color: var(--color-accent);
        }
        .pca-article .loading-pc1 {
          color: var(--color-accent);
        }
        .pca-article .row-total td {
          border-top: 2px solid var(--color-card-border);
          background: var(--color-grid-cell);
          font-weight: 500;
        }
        .scree-figure {
          margin: 24px 0;
          padding: 16px;
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
        }
        .scree-figure img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 2px;
        }
        .scree-figure figcaption {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          color: var(--color-text-40);
          margin-top: 12px;
          line-height: 1.5;
        }
        @media (max-width: 700px) {
          .pca-article .page-title { font-size: 40px; }
          .pca-article h2 { font-size: 24px; }
        }
      `}</style>
    </EditorialPage>
  );
}
