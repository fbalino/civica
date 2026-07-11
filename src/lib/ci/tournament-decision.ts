import { createHash } from "node:crypto";

export type ThresholdStatus = "pass" | "fail" | "insufficient_evidence";
export type ThresholdRow = {
  id: string;
  candidate: "K0" | "K1" | "K2" | "K3" | "K4" | "K5";
  gate: "G1" | "G2" | "G3" | "G4" | "G5" | "G6";
  threshold: string;
  observed: string | number | boolean | null;
  status: ThresholdStatus;
  evidence: string;
};

export type TournamentDecisionEvidence = {
  k1ReproductionR2: number;
  k2MidpointR2: number;
  k2DropOneRate: number;
  k3EveryRowCited: boolean;
  k3HistoricalStates: number;
  k4ZeroAggregation: boolean;
  k5ZeroWeightedTotal: boolean;
};

const row = (value: ThresholdRow) => value;

export function buildConfirmatoryDecision(evidence: TournamentDecisionEvidence) {
  const thresholds: ThresholdRow[] = [
    row({ id: "K0-fidelity", candidate: "K0", gate: "G1", threshold: "source-file fidelity = 100%", observed: "970/970 exact release cells", status: "pass", evidence: "IDX-031" }),
    row({ id: "K0-provenance", candidate: "K0", gate: "G6", threshold: "provenance fields = 100%", observed: "owner, definition, direction, vintage, source URL, uncertainty, missingness, and rights on every row", status: "pass", evidence: "IDX-031" }),
    row({ id: "K0-direction-comprehension", candidate: "K0", gate: "G5", threshold: "direction comprehension >= 8/10", observed: null, status: "insufficient_evidence", evidence: "IDX-022 pending qualified humans" }),
    row({ id: "K0-rights", candidate: "K0", gate: "G6", threshold: "rights gate passes", observed: "point display with fail-closed bulk export", status: "pass", evidence: "IDX-031" }),

    row({ id: "K1-reproduction", candidate: "K1", gate: "G6", threshold: "exact reproduction = 100%", observed: "190/190 current composites plus frozen panel output hash", status: "pass", evidence: "IDX-002 and IDX-012" }),
    row({ id: "K1-originality", candidate: "K1", gate: "G1", threshold: "original-measurement gate fails when public-input final-holdout R2 >= 0.90", observed: evidence.k1ReproductionR2, status: evidence.k1ReproductionR2 >= 0.9 ? "fail" : "pass", evidence: "index-oos-validation-v1" }),
    row({ id: "K1-utility", candidate: "K1", gate: "G5", threshold: "reader accuracy gain >= 10 percentage points or correct-task median time reduction >= 20%, with no comprehension loss", observed: null, status: "insufficient_evidence", evidence: "IDX-022 pending qualified humans" }),
    row({ id: "K1-subgroup-gap", candidate: "K1", gate: "G4", threshold: "no subgroup error gap > 15 percentage points", observed: null, status: "insufficient_evidence", evidence: "IDX-021: subgroup truth unavailable and final cells suppressed" }),

    row({ id: "K2-midpoint", candidate: "K2", gate: "G1", threshold: "midpoint artifact R2 < 0.70", observed: evidence.k2MidpointR2, status: evidence.k2MidpointR2 < 0.7 ? "pass" : "fail", evidence: "k2-concordance-prototype-v1" }),
    row({ id: "K2-drop-one", candidate: "K2", gate: "G2", threshold: "drop-one-source classification changes <= 15%", observed: evidence.k2DropOneRate, status: evidence.k2DropOneRate <= 0.15 ? "pass" : "fail", evidence: "index-oos-validation-v1" }),
    row({ id: "K2-expert-auc", candidate: "K2", gate: "G3", threshold: "expert contested/consensus AUC >= 0.80 and >= 0.05 above both baselines", observed: null, status: "insufficient_evidence", evidence: "external known-case labels pending" }),
    row({ id: "K2-source-count", candidate: "K2", gate: "G4", threshold: "minimum three eligible sources", observed: 3, status: "pass", evidence: "k2-concordance-prototype-v1" }),

    row({ id: "K3-citations", candidate: "K3", gate: "G6", threshold: "citation verifiability >= 98% of 100 stratified rows", observed: evidence.k3EveryRowCited ? "citations present; manual stratified verification unrun" : "citations missing", status: "insufficient_evidence", evidence: "k3-power-transfer-ledger-prototype-v1" }),
    row({ id: "K3-alpha", candidate: "K3", gate: "G2", threshold: "Krippendorff alpha >= 0.80", observed: null, status: "insufficient_evidence", evidence: "double coding pending" }),
    row({ id: "K3-history", candidate: "K3", gate: "G3", threshold: "historical overlap agreement >= 95%", observed: evidence.k3HistoricalStates, status: "insufficient_evidence", evidence: "no historical transfer states computed" }),
    row({ id: "K3-freshness", candidate: "K3", gate: "G4", threshold: "transfer freshness within 14 days >= 90% over two quarters", observed: null, status: "insufficient_evidence", evidence: "prospective observation pending" }),

    row({ id: "K4-alpha", candidate: "K4", gate: "G2", threshold: "mapping Krippendorff alpha >= 0.70", observed: null, status: "insufficient_evidence", evidence: "two blinded coders pending" }),
    row({ id: "K4-scholar", candidate: "K4", gate: "G3", threshold: "external scholar fair-pairing verdict >= 80% of 20 blinded pairings", observed: null, status: "insufficient_evidence", evidence: "constitutional-scholar review pending" }),
    row({ id: "K4-no-aggregation", candidate: "K4", gate: "G1", threshold: "zero output aggregation", observed: evidence.k4ZeroAggregation, status: evidence.k4ZeroAggregation ? "pass" : "fail", evidence: "k4-constitution-practice-pairings-2024-v1" }),
    row({ id: "K4-reader-nonclaim", candidate: "K4", gate: "G5", threshold: "reader correct nonclaim >= 8/10", observed: null, status: "insufficient_evidence", evidence: "qualified-reader review pending" }),

    row({ id: "K5-alpha", candidate: "K5", gate: "G2", threshold: "relation-coding Krippendorff alpha >= 0.80", observed: null, status: "insufficient_evidence", evidence: "double-blind coding pending" }),
    row({ id: "K5-expert", candidate: "K5", gate: "G3", threshold: "external expert fair-relation verdict >= 80% of 30 blinded relations", observed: null, status: "insufficient_evidence", evidence: "external expert review pending" }),
    row({ id: "K5-citations", candidate: "K5", gate: "G6", threshold: "citation verifiability >= 98% of 100 stratified relations", observed: null, status: "insufficient_evidence", evidence: "citation audit pending" }),
    row({ id: "K5-no-total", candidate: "K5", gate: "G1", threshold: "zero weighted total or country-quality output", observed: evidence.k5ZeroWeightedTotal, status: evidence.k5ZeroWeightedTotal ? "pass" : "fail", evidence: "k5-institutional-relation-candidates-v1" }),
  ];
  const candidates = (["K0", "K1", "K2", "K3", "K4", "K5"] as const).map((candidate) => {
    const rows = thresholds.filter((threshold) => threshold.candidate === candidate);
    return { candidate, passed: rows.filter((threshold) => threshold.status === "pass").length, failed: rows.filter((threshold) => threshold.status === "fail").length, insufficient: rows.filter((threshold) => threshold.status === "insufficient_evidence").length, qualifiesNow: rows.every((threshold) => threshold.status === "pass") };
  });
  const payload = {
    schemaVersion: "civica-index-tournament-decision/v1",
    releaseId: "civica-index-tournament-confirmatory-decision-v1",
    analysisClass: "confirmatory",
    thresholds,
    candidates,
    robustness: { noncompensatingGatesApplied: true, adverseResultsRetained: true, holmAdjustment: "not_triggered_no_confirmatory_p_value_family_used_for_threshold_decisions", sensitivityPenalty: "K1 cannot use near-equal weight stability to offset source/normalization/aggregation sensitivity", missingSubgroupPenalty: "insufficient_evidence_not_pass" },
    simplicity: { applied: true, qualifyingTieFound: false, result: "not_triggered; no candidate currently qualifies; K0 remains the frozen default for any later unresolved tie" },
    outcome: { winner: null, status: "no_winner_current_evidence", k0: "reference floor available but human comprehension threshold pending", k1: "original-measurement claim rejected; bounded derivative utility unresolved; current league-table presentation failed misuse audit", k2: "current candidate fails stability", k3: "insufficient external and longitudinal evidence", k4: "insufficient blinded coding and scholar review", k5: "insufficient coding, expert, and citation review" },
    thresholdChangePolicy: "Any changed threshold or added result creates a separately labelled exploratory scenario and cannot replace this confirmatory decision.",
    winnerSelected: false,
  };
  return { ...payload, resultSha256: createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
}

export function buildExploratoryScenario(evidence: TournamentDecisionEvidence, overrides: Record<string, string | number>) {
  const base = buildConfirmatoryDecision(evidence);
  const scenarioId = createHash("sha256").update(JSON.stringify(overrides, Object.keys(overrides).sort())).digest("hex").slice(0, 12);
  return { schemaVersion: "civica-index-tournament-exploratory-scenario/v1", releaseId: `civica-index-tournament-exploratory-${scenarioId}`, analysisClass: "exploratory", confirmatoryReleaseId: base.releaseId, overrides, canSelectWinner: false };
}

export function tournamentDecisionErrors(result: ReturnType<typeof buildConfirmatoryDecision>) {
  const errors: string[] = [];
  if (result.thresholds.length !== 24) errors.push("not every frozen threshold is represented");
  if (new Set(result.thresholds.map((row) => row.id)).size !== result.thresholds.length) errors.push("threshold ids are not unique");
  if (result.candidates.length !== 6) errors.push("candidate decision set is incomplete");
  if (result.candidates.some((row) => row.qualifiesNow) || result.winnerSelected || result.outcome.winner !== null) errors.push("a winner was selected despite failed or insufficient gates");
  if (!result.robustness.noncompensatingGatesApplied || !result.simplicity.applied) errors.push("frozen penalties were not applied");
  if (!result.thresholdChangePolicy.includes("exploratory")) errors.push("threshold changes can rewrite confirmatory results");
  return errors;
}
