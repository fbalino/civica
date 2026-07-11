import { createHash } from "node:crypto";

export const TOURNAMENT_RESULTS_PACKAGE_ID = "civica-index-tournament-results-v1";

export type TournamentArtifact = {
  id: string;
  path: string;
  role: "protocol" | "panel" | "candidate" | "baseline" | "result" | "table" | "figure";
  analysisClass: "confirmatory" | "not_an_analysis";
};

export const TOURNAMENT_PACKAGE_ARTIFACTS: readonly TournamentArtifact[] = Object.freeze([
  { id: "panel-manifest", path: "data/releases/ci-research-panel-2000-2024-v3/manifest.v3.json", role: "panel", analysisClass: "not_an_analysis" },
  { id: "preregistered-protocol", path: "plan/research/index-tournament-preregistration-v3.md", role: "protocol", analysisClass: "not_an_analysis" },
  { id: "panel-coverage", path: "data/releases/ci-research-panel-2000-2024-v3/coverage.v3.json", role: "panel", analysisClass: "not_an_analysis" },
  { id: "baselines", path: "data/releases/ci-index-baselines-v3/manifest.v3.json", role: "baseline", analysisClass: "not_an_analysis" },
  { id: "k0", path: "plan/evidence/IDX-031/README.md", role: "candidate", analysisClass: "not_an_analysis" },
  { id: "k1", path: "data/releases/k1-current-composite-tournament-v1/manifest.v1.json", role: "candidate", analysisClass: "not_an_analysis" },
  { id: "k2", path: "data/releases/k2-concordance-prototype-v1/manifest.v1.json", role: "candidate", analysisClass: "not_an_analysis" },
  { id: "k3", path: "data/releases/k3-power-transfer-ledger-prototype-v1/manifest.v1.json", role: "candidate", analysisClass: "not_an_analysis" },
  { id: "k4", path: "data/releases/k4-constitution-practice-pairings-2024-v1/manifest.v1.json", role: "candidate", analysisClass: "not_an_analysis" },
  { id: "k5", path: "data/releases/k5-institutional-relation-candidates-v1/manifest.v1.json", role: "candidate", analysisClass: "not_an_analysis" },
  { id: "evaluation-suite", path: "data/releases/index-tournament-evaluation-suite-v1/manifest.v1.json", role: "result", analysisClass: "confirmatory" },
  { id: "dimensionality", path: "data/releases/index-dimensionality-analysis-v1/result.v1.json", role: "result", analysisClass: "confirmatory" },
  { id: "dimensionality-table", path: "data/releases/index-dimensionality-analysis-v1/table.v1.csv", role: "table", analysisClass: "confirmatory" },
  { id: "dimensionality-figure", path: "data/releases/index-dimensionality-analysis-v1/pc1-level-comparison.v1.svg", role: "figure", analysisClass: "confirmatory" },
  { id: "validity", path: "data/releases/index-validity-analysis-v1/result.v1.json", role: "result", analysisClass: "confirmatory" },
  { id: "longitudinal", path: "data/releases/index-longitudinal-analysis-v1/result.v1.json", role: "result", analysisClass: "confirmatory" },
  { id: "out-of-sample", path: "data/releases/index-oos-validation-v1/result.v1.json", role: "result", analysisClass: "confirmatory" },
  { id: "uncertainty-inputs", path: "data/releases/ci-k1-uncertainty-inputs-2024-v2/manifest.v1.json", role: "result", analysisClass: "confirmatory" },
  { id: "sensitivity", path: "data/releases/index-sensitivity-analysis-v1/result.v1.json", role: "result", analysisClass: "confirmatory" },
  { id: "source-dependence", path: "data/releases/index-source-dependence-v1/result.v1.json", role: "result", analysisClass: "confirmatory" },
  { id: "subgroup-fairness", path: "data/releases/index-subgroup-fairness-v1/result.v1.json", role: "result", analysisClass: "confirmatory" },
  { id: "misuse-audit", path: "data/releases/index-misuse-audit-v1/result.v1.json", role: "result", analysisClass: "confirmatory" },
]);

export const TOURNAMENT_REPRODUCTION_COMMANDS = Object.freeze([
  { id: "k0", script: "validate:governance-evidence", args: [] },
  { id: "baselines", script: "generate:index-tournament-baselines", args: ["--write"] },
  { id: "k1", script: "generate:k1-tournament-candidate", args: ["--write"] },
  { id: "k2", script: "generate:k2-concordance-prototype", args: ["--write"] },
  { id: "k3", script: "generate:k3-ledger-prototype", args: ["--write"] },
  { id: "k4", script: "generate:k4-pairing-prototype", args: [] },
  { id: "k5", script: "generate:k5-relation-candidates", args: [] },
  { id: "evaluation-suite", script: "generate:index-tournament-evaluation-suite", args: [] },
  { id: "dimensionality", script: "generate:index-dimensionality", args: [] },
  { id: "validity", script: "generate:index-validity", args: [] },
  { id: "longitudinal", script: "generate:index-longitudinal", args: [] },
  { id: "out-of-sample", script: "generate:index-oos-validation", args: [] },
  { id: "uncertainty", script: "generate:k1-uncertainty-inputs", args: [] },
  { id: "sensitivity", script: "generate:index-sensitivity", args: [] },
  { id: "source-dependence", script: "generate:index-source-dependence", args: [] },
  { id: "subgroup-fairness", script: "generate:index-subgroup-fairness", args: [] },
  { id: "misuse-audit", script: "generate:index-misuse-audit", args: [] },
]);

export const TOURNAMENT_ERROR_LEDGER = Object.freeze([
  { id: "K1-G1-originality", candidate: "K1", state: "failed", evidence: "index-oos-validation-v1", detail: "Public inputs reproduce K1 above the preregistered originality-failure boundary." },
  { id: "K1-G5-reader-utility", candidate: "K1", state: "pending_humans", evidence: "index-reader-task-protocol-v1", detail: "Qualified-reader crossover is preregistered and K0 is available, but final instrumentation and human responses remain pending." },
  { id: "K1-G5-misuse", candidate: "K1", state: "failed_current_presentation", evidence: "index-misuse-audit-v1", detail: "The current default league-table presentation fails misuse resistance." },
  { id: "K2-stability", candidate: "K2", state: "failed", evidence: "index-oos-validation-v1", detail: "Drop-one-rater classification instability exceeds the frozen boundary." },
  { id: "K2-expert-labels", candidate: "K2", state: "pending_humans", evidence: "k2-concordance-prototype-v1", detail: "Contested and consensus known-case labels remain externally unreviewed." },
  { id: "K3-historical-validation", candidate: "K3", state: "insufficient_evidence", evidence: "k3-power-transfer-ledger-prototype-v1", detail: "Historical transfers and term-limit states are not yet computable from the current input history." },
  { id: "K4-coding", candidate: "K4", state: "pending_humans", evidence: "k4-constitution-practice-pairings-2024-v1", detail: "Two blinded coders and constitutional-scholar fairness review remain pending." },
  { id: "K5-coding", candidate: "K5", state: "pending_humans", evidence: "k5-institutional-relation-candidates-v1", detail: "Double-blind relation coding and external expert review remain pending; zero graph edges are published." },
  { id: "subgroup-performance", candidate: "all", state: "insufficient_evidence", evidence: "index-subgroup-fairness-v1", detail: "Small final-holdout subgroup cells are suppressed and cannot establish subgroup accuracy." },
]);

export function packageSha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildArtifactInventoryCsv(rows: readonly { id: string; path: string; role: string; analysisClass: string; sha256: string; bytes: number }[]) {
  const header = ["artifact_id", "role", "analysis_class", "bytes", "sha256", "path"];
  return `${[header, ...rows.map((row) => [row.id, row.role, row.analysisClass, String(row.bytes), row.sha256, row.path])].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")}\n`;
}

export function tournamentResultsPackageErrors(manifest: any): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== "civica-index-tournament-results-package/v1") errors.push("schema version drifted");
  if (manifest.releaseId !== TOURNAMENT_RESULTS_PACKAGE_ID) errors.push("release id drifted");
  if (manifest.artifacts?.length !== TOURNAMENT_PACKAGE_ARTIFACTS.length) errors.push("artifact inventory is incomplete");
  if (manifest.reproduction?.commands?.length !== TOURNAMENT_REPRODUCTION_COMMANDS.length) errors.push("reproduction workflow is incomplete");
  if (manifest.analysisSeparation?.exploratoryArtifacts?.length !== 0) errors.push("unregistered exploratory artifacts entered the package");
  if (!String(manifest.analysisSeparation?.policy).includes("separately labelled")) errors.push("confirmatory/exploratory separation is absent");
  if (manifest.errorLedger?.entries !== TOURNAMENT_ERROR_LEDGER.length) errors.push("error ledger is incomplete");
  if (manifest.winnerSelected !== false) errors.push("package selected a winner before IDX-025");
  return errors;
}
