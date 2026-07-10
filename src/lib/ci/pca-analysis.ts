/**
 * Pure typed wrapper over `src/lib/ci/pca-analysis.generated.json`
 * (CLM-009 bounded-repair F1).
 *
 * Before this repair, `src/lib/content/site-state.ts` hand-copied four
 * numbers derived from the Phase 5.3 PCA run
 * (`panelSize`/`pc1VarianceExplained`/`pc1LoadingRange`/
 * `correlationRange`) as a SECOND, independently-typed literal — a
 * duplicate of the exact numbers the generated snapshot already
 * carries. This module is the single derivation seam: it reads ONLY
 * the generated snapshot (no DB, no network, no clock) and computes
 * the same display-rounded values site-state previously hardcoded, so
 * site-state can import them instead of retyping them.
 *
 * `pcaAnalysis.generated.json` itself is never hand-edited — see
 * `scripts/generate-pca-analysis.ts`.
 */

import pcaAnalysis from "@/lib/ci/pca-analysis.generated.json";

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

export interface PcaAnalysisSummary {
  panelSize: number;
  panelYear: string;
  /** PC1 variance-explained, rounded to 3dp (matches the published
   *  "90.7%" display convention: `(pc1VarianceExplained * 100).toFixed(1)`). */
  pc1VarianceExplained: number;
  /** [min, max] of the four dimensions' PC1 loadings, rounded to 3dp. */
  pc1LoadingRange: readonly [number, number];
  /** [min, max] of the OFF-DIAGONAL correlation matrix entries,
   *  rounded to 2dp (diagonal 1.0 self-correlations excluded — they
   *  aren't a meaningful "range" bound). */
  correlationRange: readonly [number, number];
}

/**
 * Compute the site-state-ready PCA summary from the generated
 * snapshot. Pure — same input (the checked-in JSON) always produces
 * the same output.
 */
export function getPcaAnalysisSummary(): PcaAnalysisSummary {
  const pc1Loadings = pcaAnalysis.loadingsPca.map((row) => row.pc1);

  const offDiagonalCorrelations: number[] = [];
  for (const row of pcaAnalysis.correlations) {
    for (const dimension of pcaAnalysis.dimensions) {
      if (dimension === row.dimension) continue; // skip the diagonal
      offDiagonalCorrelations.push(
        row.values[dimension as keyof typeof row.values],
      );
    }
  }

  return {
    panelSize: pcaAnalysis.panelSize,
    panelYear: pcaAnalysis.panelYear,
    pc1VarianceExplained: round(pcaAnalysis.variancePc1, 3),
    pc1LoadingRange: [
      round(Math.min(...pc1Loadings), 3),
      round(Math.max(...pc1Loadings), 3),
    ],
    correlationRange: [
      round(Math.min(...offDiagonalCorrelations), 2),
      round(Math.max(...offDiagonalCorrelations), 2),
    ],
  };
}
