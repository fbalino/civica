import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { EigenvalueChart } from "@/components/methodology/EigenvalueChart";
import { Reveal } from "@/components/motion/Reveal";
import { civicaIndex } from "@/lib/content/site-state";
import pcaAnalysis from "@/lib/ci/pca-analysis.generated.json";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Historical PCA Weight Record — Civica Index",
  description: `The limited ${civicaIndex.pca.panelSize}-country 2023 cross-section that informed the archived Civica Index Beta weights, with later temporal evidence and the unrun fifth-dimension test stated explicitly.`,
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

/** Display-label lookup, same source as `ADOPTED_WEIGHT_BY_ID`. */
const LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  civicaIndex.dimensions.map((d) => [d.id, d.label]),
);

/** Find a row in a generated-snapshot array by its `dimension` key, or
 *  throw — the snapshot and `civicaIndex.dimensions` are both derived
 *  from the same four-dimension governance core, so a miss here means
 *  the generated snapshot is stale (see `npm run generate:pca-analysis
 *  -- --check`), not a normal runtime condition to fall back from. */
function findByDimension<T extends { dimension: string }>(
  rows: readonly T[],
  dimension: string,
): T {
  const row = rows.find((r) => r.dimension === dimension);
  if (!row) {
    throw new Error(
      `pca-appendix: no row for dimension "${dimension}" in generated PCA snapshot`,
    );
  }
  return row;
}

const LOADINGS: LoadingRow[] = pcaAnalysis.dimensions.map((dimension) => {
  const pca = findByDimension(pcaAnalysis.loadingsPca, dimension);
  return {
    dimension,
    label: LABEL_BY_ID[dimension] ?? dimension,
    pc1: pca.pc1,
    pc2: pca.pc2,
    pc3: pca.pc3,
    pc4: pca.pc4,
    weightSuggested:
      pcaAnalysis.pcaSuggestedWeights[
        dimension as keyof typeof pcaAnalysis.pcaSuggestedWeights
      ],
    weightProvisional:
      pcaAnalysis.provisionalWeights[
        dimension as keyof typeof pcaAnalysis.provisionalWeights
      ],
  };
});

interface EigenRow {
  pc: string;
  eigenvalue: number;
  varExplained: number;
  cumulative: number;
}

const EIGENVALUES: EigenRow[] = pcaAnalysis.eigenvalues.map((e) => ({
  pc: e.component,
  eigenvalue: e.eigenvalue,
  varExplained: e.varianceExplained,
  cumulative: e.cumulative,
}));

interface CorrRow {
  dim: string;
  democratic_quality: number;
  rule_of_law: number;
  freedom_rights: number;
  corruption_control: number;
}

const CORRELATIONS: CorrRow[] = pcaAnalysis.dimensions.map((dimension) => {
  const row = findByDimension(pcaAnalysis.correlations, dimension);
  return {
    dim: LABEL_BY_ID[dimension] ?? dimension,
    democratic_quality: row.values.democratic_quality,
    rule_of_law: row.values.rule_of_law,
    freedom_rights: row.values.freedom_rights,
    corruption_control: row.values.corruption_control,
  };
});

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

        <h1 className="editorial-page-title">Historical PCA weight record.</h1>
        <div className="editorial-page-meta">
          <span>Empirical weight derivation</span>
          <span>·</span>
          <span>Run: {pca.lastRunDate}</span>
          <span>·</span>
          <span>n = {pca.panelSize} countries</span>
        </div>

        <p className="meth-abstract">
          This page preserves the limited 2023 cross-section that informed
          the archived Beta weights. It documents the arithmetic and its
          boundaries; it does not validate a general governance factor or
          establish a longitudinal weighting model.
        </p>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 1 — Headline finding (TSX: prose + adopted-weights
            table reading from civicaIndex.dimensions) */}
        <Reveal as="section" id="summary" className="editorial-section">
          <h2>
            <span className="meth-num">Section 1</span>Headline finding
          </h2>
          <p>
            Within this {pca.panelSize}-country 2023 cross-section, the{" "}
            {civicaIndex.dimensionCount} inputs are highly correlated
            (range {corrLow} to {corrHigh}). The first principal component
            is dominant in this sample:{" "}
            <strong>
              PC1 explains {pc1VariancePct}% of the variance
            </strong>{" "}
            in the panel, and all {civicaIndex.dimensionCount}{" "}
            inputs load on it with similar magnitude ({loadLow} to{" "}
            {loadHigh}). Components 2 through{" "}
            {civicaIndex.dimensionCount} fall below the Kaiser threshold
            in this run. That result cannot establish the factor structure
            for countries outside the sample, other years, annual change,
            or an untested fifth indicator.
          </p>
          <p>
            The {civicaIndex.dimensionCount}-dimension breakout is an
            editorial transparency device. It shows which publisher input
            contributes to the archived formula. The PCA does not make the
            dimensions independent, and it does not turn their shared
            variation into an original Civica measurement.
          </p>
          <p>
            The historical recipe set weights proportional to the squared
            PC1 loadings, then rounded the result:
          </p>

          <div className="editorial-table-scroll">
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
          </div>

          <p>
            In that historical recipe, the biggest revision is corruption control (0.20 →{" "}
            {(ADOPTED_WEIGHT_BY_ID.corruption_control ?? 0).toFixed(2)},
            +20% relative). Democratic quality drops slightly (0.30 →{" "}
            {(ADOPTED_WEIGHT_BY_ID.democratic_quality ?? 0).toFixed(2)}
            ). The other two are essentially unchanged. Because the
            indicators are highly correlated in the derivation sample, the
            weight-only score change in that run is under one point. This is
            not a stability result for later releases or other specifications.
          </p>
        </Reveal>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 2 — The panel (markdown body) */}
        <Reveal as="section" className="editorial-section">
          <MarkdownContent
            file="content/methodology-pca-appendix.md"
            stats={null}
            state={state as unknown as Record<string, unknown>}
            ctx={ctx}
            slice={{ from: "data", to: "five-dim" }}
          />
        </Reveal>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 3 — Correlation matrix (TSX: 4×4 table) */}
        <Reveal as="section" id="correlations" className="editorial-section">
          <h2>
            <span className="meth-num">Section 3</span>Correlation matrix
          </h2>
          <p>
            Pearson correlations between the{" "}
            {civicaIndex.dimensionCount} normalized dimensions:
          </p>
          <div className="editorial-table-scroll">
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
          </div>
          <p>
            Every off-diagonal correlation in this cross-section is above{" "}
            {corrLow}. Rule of law and corruption control correlate at{" "}
            {corrHigh} in these observations. This is evidence of overlap in
            the derivation sample, not proof that the constructs are identical.
            Section 6 records that the proposed fifth-dimension test was not run.
          </p>
        </Reveal>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 4 — Eigenvalues + scree (TSX: table + inline-SVG chart) */}
        <Reveal as="section" id="eigenvalues" className="editorial-section">
          <h2>
            <span className="meth-num">Section 4</span>Eigenvalues &amp; variance
          </h2>
          <p>
            PCA on the standardized panel (mean 0, variance 1 per
            dimension) yields these eigenvalues:
          </p>
          <div className="editorial-table-scroll">
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
          </div>
          <p>
            Applied to this cross-section, the Kaiser criterion (retain
            components with eigenvalue &gt; 1) selects only PC1. The scree
            plot describes the same sample result:
          </p>

          <EigenvalueChart
            data={EIGENVALUES.map((r) => ({
              pc: r.pc,
              eigenvalue: r.eigenvalue,
              cumulative: r.cumulative,
            }))}
          />
        </Reveal>

        {/* ────────────────────────────────────────────────────── */}
        {/* Section 5 — PC loadings (TSX: 4×4 table) */}
        <Reveal as="section" id="loadings" className="editorial-section">
          <h2>
            <span className="meth-num">Section 5</span>PC loadings
          </h2>
          <p>
            How much each dimension contributes to each principal
            component:
          </p>
          <div className="editorial-table-scroll">
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
          </div>
          <p>
            On PC1, as selected by the Kaiser rule for this sample, the{" "}
            {civicaIndex.dimensionCount} loadings are tightly clustered
            ({loadLow} to {loadHigh}, range {loadRange}). All{" "}
            {civicaIndex.dimensionCount} inputs contribute roughly equally
            to the first component. PC2 through PC
            {civicaIndex.dimensionCount} describe the remaining variance;
            this run does not justify calling them noise.
          </p>
          <p>
            Squaring the PC1 loadings and normalizing them to sum to
            1.00 gives the historical suggested weights in §1. Rounding
            to two decimal places, including a 0.01 adjustment so the
            displayed values sum to 1.00, produced the archived Beta weights.
          </p>
        </Reveal>

        {/* ────────────────────────────────────────────────────── */}
        {/* Sections 6, 7, 8 — markdown body */}
        <Reveal as="section" className="editorial-section">
          <MarkdownContent
            file="content/methodology-pca-appendix.md"
            stats={null}
            state={state as unknown as Record<string, unknown>}
            ctx={ctx}
            slice={{ from: "five-dim" }}
          />
        </Reveal>

        {/* Cite */}
        <Reveal as="section" id="cite" className="editorial-section">
          <h2>Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — PCA appendix"
            pageTitle="PCA appendix"
            url="https://civicaatlas.org/civica-index/methodology/pca-appendix"
            dataVintage={civicaIndex.lastRevisionIso}
          />
        </Reveal>

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
