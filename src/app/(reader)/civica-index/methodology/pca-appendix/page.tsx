import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { EigenvalueChart } from "@/components/methodology/EigenvalueChart";
import { civicaIndex } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "PCA appendix — Civica Index methodology",
  description: `Empirical justification for the Civica Index Beta dimension weights. PCA on the ${civicaIndex.dimensionCount} governance dimensions confirms a single dominant latent factor; weights are derived from the squared loadings on the first principal component.`,
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
  /** What the spec proposed before the PCA. Historical record — the
   *  initial pre-PCA weights documented in the resolution archive.
   *  Frozen analysis output. */
  weightProvisional: number;
}

/** Adopted-weight lookup, derived from `state.civicaIndex.dimensions`
 *  so the appendix and the running scorer stay in sync. */
const ADOPTED_WEIGHT_BY_ID: Record<string, number> = Object.fromEntries(
  civicaIndex.dimensions.map((d) => [d.id, d.weight]),
);

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

const SECTIONS = [
  { id: "summary", label: "Headline finding" },
  { id: "data", label: "Data" },
  { id: "correlations", label: "Correlations" },
  { id: "eigenvalues", label: "Eigenvalues" },
  { id: "loadings", label: "Loadings" },
  { id: "five-dim", label: "Fifth dimension" },
  { id: "limitations", label: "Limitations" },
  { id: "reproduction", label: "Reproduction" },
  { id: "cite", label: "Cite this page" },
];

export default function PcaAppendixPage() {
  const { pca } = civicaIndex;
  const pc1VariancePct = (pca.pc1VarianceExplained * 100).toFixed(1);
  const [loadLow, loadHigh] = pca.pc1LoadingRange;
  const loadRange = (loadHigh - loadLow).toFixed(2);
  const [corrLow, corrHigh] = pca.correlationRange;

  // Pre-computed helpers for the markdown body. Per Phase 5 §3.2.
  // Keys must match the validator's per-file allowlist in
  // scripts/validate-content-templates.ts.
  const ctx = {
    pc1VariancePct,
    loadLow,
    loadHigh,
    loadRange,
    corrLow,
    corrHigh,
  };

  const state = { civicaIndex };

  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
        <SmartBreadcrumbs />

        <h1 className="editorial-page-title">PCA appendix.</h1>
        <div className="editorial-page-meta">
          <span>Empirical weight derivation</span>
          <span>·</span>
          <span>Run: {pca.lastRunDate}</span>
          <span>·</span>
          <span>n = {pca.panelSize} countries</span>
        </div>

        <p className="meth-abstract">
          The dimension weights used in the Civica Index are derived from
          the data, not asserted. This page documents the principal
          component analysis that produced them, with full disclosure
          of methodology, sample size, and limitations.
        </p>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 1 — Headline finding (TSX: prose + adopted-weights
            table reading from civicaIndex.dimensions) */}
        <section id="summary" className="editorial-section">
          <h2>
            <span className="meth-num">Section 1</span>Headline finding
          </h2>
          <p>
            The {civicaIndex.dimensionCount} governance dimensions of
            the Civica Index are <strong>highly correlated</strong>{" "}
            (range {corrLow} to {corrHigh}). Principal component
            analysis confirms a single dominant latent factor:{" "}
            <strong>
              PC1 explains {pc1VariancePct}% of the variance
            </strong>{" "}
            in the panel, and all {civicaIndex.dimensionCount}{" "}
            dimensions load on it with similar magnitude ({loadLow} to{" "}
            {loadHigh}). Components 2 through{" "}
            {civicaIndex.dimensionCount} each have eigenvalues well
            below the Kaiser threshold of 1.0, meaning the data does
            not support breaking the governance core into multiple
            distinct factors.
          </p>
          <p>
            The {civicaIndex.dimensionCount}-dimension breakout is
            therefore best understood as a{" "}
            <strong>transparency device</strong> — it lets readers see
            how each facet contributes — rather than as a claim that
            the {civicaIndex.dimensionCount} are statistically
            independent. The composite score is, in effect, a single
            &ldquo;governance quality&rdquo; index disaggregated into{" "}
            {civicaIndex.dimensionCount} interpretable sub-scores.
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
              {LOADINGS.map((r) => {
                const adopted = ADOPTED_WEIGHT_BY_ID[r.dimension] ?? 0;
                return (
                  <tr key={r.dimension}>
                    <td>{r.label}</td>
                    <td className="editorial-td-num">
                      {r.weightProvisional.toFixed(2)}
                    </td>
                    <td className="editorial-td-num">
                      {r.weightSuggested.toFixed(3)}
                    </td>
                    <td className="editorial-td-num">{adopted.toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <strong>Sum</strong>
                </td>
                <td className="editorial-td-num">1.00</td>
                <td className="editorial-td-num">1.000</td>
                <td className="editorial-td-num">1.00</td>
              </tr>
            </tbody>
          </table>

          <p>
            The biggest revision is corruption control (0.20 →{" "}
            {(ADOPTED_WEIGHT_BY_ID.corruption_control ?? 0).toFixed(2)},
            +20% relative). Democratic quality drops slightly (0.30 →{" "}
            {(ADOPTED_WEIGHT_BY_ID.democratic_quality ?? 0).toFixed(2)}
            ). The other two are essentially unchanged. Because the
            indicators are so correlated, the impact on country
            rankings is small: the largest delta from the weight
            revision alone is under one point.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 2 — The panel (markdown body) */}
        <section className="editorial-section">
          <MarkdownContent
            file="content/methodology-pca-appendix.md"
            stats={null}
            state={state as unknown as Record<string, unknown>}
            ctx={ctx}
            slice={{ from: "data", to: "five-dim" }}
          />
        </section>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 3 — Correlation matrix (TSX: 4×4 table) */}
        <section id="correlations" className="editorial-section">
          <h2>
            <span className="meth-num">Section 3</span>Correlation matrix
          </h2>
          <p>
            Pearson correlations between the{" "}
            {civicaIndex.dimensionCount} normalized dimensions:
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
                  <td className="editorial-td-num">
                    {r.democratic_quality.toFixed(2)}
                  </td>
                  <td className="editorial-td-num">{r.rule_of_law.toFixed(2)}</td>
                  <td className="editorial-td-num">{r.freedom_rights.toFixed(2)}</td>
                  <td className="editorial-td-num">
                    {r.corruption_control.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Every off-diagonal correlation is above {corrLow} — strong
            by any reasonable threshold. Rule of law and corruption
            control are nearly indistinguishable empirically (r ={" "}
            {corrHigh}), which suggests the weight on those two could
            be partially redundant. The 5th-dimension test in §6
            partially addresses this question; a fuller answer requires
            the ingestion of separate WGI Government Effectiveness
            data.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 4 — Eigenvalues + scree (TSX: table + inline-SVG chart) */}
        <section id="eigenvalues" className="editorial-section">
          <h2>
            <span className="meth-num">Section 4</span>Eigenvalues &amp; variance
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
                  <td className="editorial-td-num">{r.eigenvalue.toFixed(3)}</td>
                  <td className="editorial-td-num">
                    {(r.varExplained * 100).toFixed(1)}%
                  </td>
                  <td className="editorial-td-num">
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

          <EigenvalueChart
            data={EIGENVALUES.map((r) => ({
              pc: r.pc,
              eigenvalue: r.eigenvalue,
              cumulative: r.cumulative,
            }))}
          />
        </section>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 5 — PC loadings (TSX: 4×4 table) */}
        <section id="loadings" className="editorial-section">
          <h2>
            <span className="meth-num">Section 5</span>PC loadings
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
                  <td className="editorial-td-num">{r.pc1.toFixed(3)}</td>
                  <td className="editorial-td-num">{r.pc2.toFixed(3)}</td>
                  <td className="editorial-td-num">{r.pc3.toFixed(3)}</td>
                  <td className="editorial-td-num">{r.pc4.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            On PC1 — the only component the data supports — the{" "}
            {civicaIndex.dimensionCount} loadings are tightly clustered
            ({loadLow} to {loadHigh}, range {loadRange}). All{" "}
            {civicaIndex.dimensionCount} dimensions contribute roughly
            equally to the single &ldquo;governance quality&rdquo;
            latent factor. PC2 through PC{civicaIndex.dimensionCount}{" "}
            represent residual variance below the noise floor.
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
        {/* Sections 6, 7, 8 — markdown body */}
        <section className="editorial-section">
          <MarkdownContent
            file="content/methodology-pca-appendix.md"
            stats={null}
            state={state as unknown as Record<string, unknown>}
            ctx={ctx}
            slice={{ from: "five-dim" }}
          />
        </section>

        {/* Cite */}
        <section id="cite" className="editorial-section">
          <h2>Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — PCA appendix"
            pageTitle="PCA appendix"
            url="https://civicaatlas.org/civica-index/methodology/pca-appendix"
          />
        </section>

        <nav
          className="editorial-footer-nav"
          aria-label="Methodology navigation"
        >
          <Link href="/civica-index/methodology">
            ← Civica Index methodology
          </Link>
          <Link href="/civica-index/methodology/peer-grouping">
            Peer-grouping methodology →
          </Link>
        </nav>
      </EditorialPage>
    </MethodologyLayout>
  );
}
