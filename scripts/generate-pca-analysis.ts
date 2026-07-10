/**
 * generate-pca-analysis — regenerate `src/lib/ci/pca-analysis.generated.json`
 * from the frozen Phase 5.3 PCA run output committed under
 * `analysis/phase-5-3/` (results.json + the four CSV exports).
 *
 *   Run with:  npm run generate:pca-analysis
 *              npm run generate:pca-analysis -- --check
 *   Adopted via: CLM-009 (documentation-source registry) §B
 *
 * Deterministic and DB-free: parses the checked-in analysis-run files
 * only, no network/DB/clock. The PCA appendix page
 * (`src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx`)
 * imports the generated snapshot instead of hand-copied numeric
 * arrays, so the rendered figures can never drift from the frozen
 * analysis-run bundle. `--check` byte-compares and exits 1 on drift
 * without writing — the same contract as
 * `scripts/generate-pulse-runtime-method.ts` and
 * `scripts/generate-ci-normalization-table.ts`.
 *
 * To regenerate the SOURCE analysis (not this snapshot): re-run
 * `analysis/phase-5-3/run_pca.py` per its own docstring, which
 * requires production DB access and is out of scope for this script.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const ANALYSIS_DIR = path.resolve(process.cwd(), "analysis/phase-5-3");
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "src/lib/ci/pca-analysis.generated.json",
);

/** Minimal CSV parser sufficient for these plain, unquoted, comma-
 *  separated analysis exports (no embedded commas/quotes). Returns
 *  the header row and the data rows, both split into cells. */
function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const [headerLine, ...rest] = lines;
  const header = headerLine.split(",");
  const rows = rest.map((line) => line.split(","));
  return { header, rows };
}

interface EigenRow {
  component: string;
  eigenvalue: number;
  varianceExplained: number;
  cumulative: number;
}

function parseEigenvalues(text: string): EigenRow[] {
  const { header, rows } = parseCsv(text);
  const idx = {
    component: header.indexOf("component"),
    eigenvalue: header.indexOf("eigenvalue"),
    varianceExplained: header.indexOf("variance_explained"),
    cumulative: header.indexOf("cumulative_variance"),
  };
  return rows.map((r) => ({
    component: r[idx.component],
    eigenvalue: Number(r[idx.eigenvalue]),
    varianceExplained: Number(r[idx.varianceExplained]),
    cumulative: Number(r[idx.cumulative]),
  }));
}

interface LoadingsPcaRow {
  dimension: string;
  pc1: number;
  pc2: number;
  pc3: number;
  pc4: number;
}

function parseLoadingsPca(text: string): LoadingsPcaRow[] {
  const { rows } = parseCsv(text);
  // Header is ",PC1,PC2,PC3,PC4" — first column (dimension name) is
  // unlabeled in the source export, so this reads by fixed position
  // rather than by header lookup.
  return rows.map((r) => ({
    dimension: r[0],
    pc1: Number(r[1]),
    pc2: Number(r[2]),
    pc3: Number(r[3]),
    pc4: Number(r[4]),
  }));
}

interface LoadingsFactorRow {
  dimension: string;
  f1: number;
}

function parseLoadingsFactor(text: string): LoadingsFactorRow[] {
  const { rows } = parseCsv(text);
  return rows.map((r) => ({
    dimension: r[0],
    f1: Number(r[1]),
  }));
}

interface CorrelationRow {
  dimension: string;
  values: Record<string, number>;
}

function parseCorrelations(text: string): CorrelationRow[] {
  const { header, rows } = parseCsv(text);
  const dimensionCols = header.slice(1);
  return rows.map((r) => {
    const values: Record<string, number> = {};
    dimensionCols.forEach((col, i) => {
      values[col] = Number(r[i + 1]);
    });
    return { dimension: r[0], values };
  });
}

interface ResultsJson {
  panel_n: number;
  panel_year: string;
  dimensions_tested: string[];
  eigenvalues: number[];
  variance_explained_pc1: number;
  kaiser_components: number;
  provisional_weights: Record<string, number>;
  pca_suggested_weights: Record<string, number>;
  decision: string;
  fifth_dimension_test: string;
  sample_size_caveat: string;
}

async function readAnalysisFile(name: string): Promise<string> {
  return fs.readFile(path.join(ANALYSIS_DIR, name), "utf8");
}

async function buildSnapshot(): Promise<Record<string, unknown>> {
  const [resultsRaw, eigenRaw, loadPcaRaw, loadFactorRaw, corrRaw] =
    await Promise.all([
      readAnalysisFile("results.json"),
      readAnalysisFile("eigenvalues.csv"),
      readAnalysisFile("loadings_pca.csv"),
      readAnalysisFile("loadings_factor.csv"),
      readAnalysisFile("correlations.csv"),
    ]);

  const results = JSON.parse(resultsRaw) as ResultsJson;

  return {
    source: "analysis/phase-5-3 (results.json + eigenvalues.csv + loadings_pca.csv + loadings_factor.csv + correlations.csv)",
    panelSize: results.panel_n,
    panelYear: results.panel_year,
    dimensions: results.dimensions_tested,
    kaiserComponents: results.kaiser_components,
    variancePc1: results.variance_explained_pc1,
    eigenvalues: parseEigenvalues(eigenRaw),
    loadingsPca: parseLoadingsPca(loadPcaRaw),
    loadingsFactor: parseLoadingsFactor(loadFactorRaw),
    correlations: parseCorrelations(corrRaw),
    provisionalWeights: results.provisional_weights,
    pcaSuggestedWeights: results.pca_suggested_weights,
    decision: results.decision,
    fifthDimensionTest: results.fifth_dimension_test,
    sampleSizeCaveat: results.sample_size_caveat,
  };
}

interface CliArgs {
  check: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { check: false };
  for (const arg of argv) {
    if (arg === "--check") args.check = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "generate-pca-analysis — regenerate the PCA analysis snapshot JSON",
          "",
          "Usage:",
          "  npm run generate:pca-analysis",
          "  npm run generate:pca-analysis -- --check",
          "",
          "Flags:",
          "  --check   verify the checked-in snapshot matches; exit 1 on drift without writing",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = await buildSnapshot();
  const next = `${JSON.stringify(snapshot, null, 2)}\n`;

  let current: string | null = null;
  try {
    current = await fs.readFile(OUTPUT_PATH, "utf8");
  } catch {
    current = null;
  }

  if (args.check) {
    if (current !== next) {
      console.error(
        `generate-pca-analysis --check: drift detected between ${OUTPUT_PATH} and analysis/phase-5-3.\n` +
          "Run `npm run generate:pca-analysis` to regenerate.",
      );
      process.exit(1);
    }
    console.log("generate-pca-analysis --check: OK, no drift.");
    return;
  }

  if (current === next) {
    console.log(
      "generate-pca-analysis: already up to date, no changes written.",
    );
    return;
  }

  await fs.writeFile(OUTPUT_PATH, next, "utf8");
  console.log(`generate-pca-analysis: wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
