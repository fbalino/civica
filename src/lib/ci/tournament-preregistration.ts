import { createHash } from "node:crypto";
import { INDEX_CANDIDATE_SPECIFICATIONS, INDEX_CANDIDATE_SPEC_VERSION } from "./candidate-specifications";
import { INDEX_RESEARCH_CHARTER_VERSION } from "./research-charter";

export const INDEX_TOURNAMENT_PROTOCOL_VERSION = "civica-index-tournament-preregistration/v2";
export const INDEX_TOURNAMENT_REGISTERED_AT = "2026-07-11T09:31:50Z";

export const INDEX_TOURNAMENT_PREREGISTRATION = {
  protocolVersion: INDEX_TOURNAMENT_PROTOCOL_VERSION,
  registeredAt: INDEX_TOURNAMENT_REGISTERED_AT,
  status: "locked_before_winner_selecting_analysis",
  frozenCode: {
    registrationBaseCommit: "60012a66d1d5713c02c3e7355b4320113e221416",
    panelCommit: "dcce033e56db7927d55743e05625aa539ded1544",
    charterCommit: "28edebdfea368c9f5938b8483b4fd1645a448ce9",
    candidateSetCommit: "60012a66d1d5713c02c3e7355b4320113e221416",
    charterVersion: INDEX_RESEARCH_CHARTER_VERSION,
    candidateSetVersion: INDEX_CANDIDATE_SPEC_VERSION,
  },
  frozenPanel: {
    releaseId: "ci-research-panel-2000-2024-v2",
    supersedesReleaseId: "ci-research-panel-2000-2024-v1",
    rowSha256: "0d232534be46fd3c4c18d7c9d278b41e258ec72c2f42b1d7fdc2796286aa7a37",
    coverageSha256: "2e89d1bdcd1fed59031a64576917c506c31562e5c36a5591301f056841e99f40",
    temporalBreaksSha256: "227b9c7ef58b6fba615378ceb7a755ee7a3b2892e27563dd366d78a85b59b237",
    expectedCells: 24250,
    rights: "private_internal_research_only_pending_source_terms",
  },
  candidates: INDEX_CANDIDATE_SPECIFICATIONS.map(({ id, kind }) => ({ id, kind })),
  splits: {
    temporal: {
      development: [2000, 2016],
      validation: [2017, 2020],
      finalHoldout: [2021, 2024],
      rule: "No final-holdout metric may be inspected before every candidate and parameter is frozen from development and validation data.",
    },
    geographic: {
      method: "sha256-v1",
      salt: "civica-index-geographic-holdout-v1",
      assignment: "first_uint32_be(sha256(salt + ':' + upper_iso3)) % 10",
      developmentBuckets: [0, 1, 2, 3, 4, 5, 6],
      validationBuckets: [7, 8],
      finalHoldoutBuckets: [9],
      rule: "Geographic folds are assigned without outcomes; candidate fitting and threshold selection exclude final-holdout jurisdictions.",
    },
    nonPanelCandidates: "Fact, pairing, and structure candidates use the same geographic hash. Event time is split at 2020-12-31 and 2022-12-31 into development, validation, and final holdout; evidence published after the event remains permitted only for citation verification, never feature construction.",
  },
  baselines: [
    { id: "B0", name: "source-native-dashboard-no-score", appliesTo: "all" },
    { id: "B1", name: "best-single-established-indicator", appliesTo: "continuous governance-judgment tasks" },
    { id: "B2", name: "equal-weight-common-scale-average", appliesTo: "K1 and coherent continuous summaries" },
    { id: "B3", name: "first-common-factor", appliesTo: "K1 and coherent latent-summary tests" },
    { id: "B4", name: "midpoint-distance-and-source-count", appliesTo: "K2" },
    { id: "B5", name: "latest-eligible-public-structured-dataset", appliesTo: "K3, K4, and K5" },
  ],
  gates: [
    { id: "G1", name: "incremental-information-or-reference-fidelity", required: true },
    { id: "G2", name: "reliability-and-stability", required: true },
    { id: "G3", name: "external-or-known-case-validity", required: true },
    { id: "G4", name: "coverage-and-missingness", required: true },
    { id: "G5", name: "interpretability-and-misuse-resistance", required: true },
    { id: "G6", name: "reproducibility-rights-and-sustainability", required: true },
  ],
  metricsAndThresholds: {
    K0: ["source-file fidelity = 100%", "provenance fields = 100%", "direction comprehension >= 8/10", "rights gate passes"],
    K1: ["exact reproduction = 100%", "original-measurement information gate fails if public inputs reproduce output with final-holdout R2 >= 0.90", "bounded derivative utility requires preregistered task improvement >= 10 percentage points or median time reduction >= 20% with no comprehension loss", "no subgroup error gap > 15 percentage points"],
    K2: ["midpoint artifact R2 < 0.70", "drop-one-source classification changes <= 15%", "expert contested/consensus AUC >= 0.80 and >= 0.05 above both baselines", "minimum three eligible sources"],
    K3: ["citation verifiability >= 98% of 100 stratified rows", "Krippendorff alpha >= 0.80", "historical overlap agreement >= 95%", "transfer freshness within 14 days >= 90% over two quarters"],
    K4: ["mapping Krippendorff alpha >= 0.70", "external scholar fair-pairing verdict >= 80% of 20 blinded pairings", "zero output aggregation", "reader correct nonclaim >= 8/10"],
    K5: ["relation-coding Krippendorff alpha >= 0.80", "external expert fair-relation verdict >= 80% of 30 blinded relations", "citation verifiability >= 98% of 100 stratified relations", "zero weighted total or country-quality output"],
  },
  subgroupPlan: ["World Bank region", "World Bank income group", "regime taxonomy", "media-environment tercile", "small-state status", "disputed-or-limited-recognition status where in candidate scope", "data-availability tercile", "source-count tercile"],
  sensitivityPlan: ["source inclusion and leave-one-source-family-out", "source vintage", "normalization and direction", "weights or model parameters", "aggregation rule", "missingness threshold with no outcome-driven imputation", "uncertainty and covariance assumptions", "outlier influence", "temporal window", "geographic fold", "coding-rule edge cases"],
  missingness: {
    default: "No imputation, carry-forward, nearest-year, or freshest-value substitution.",
    candidateSpecific: "Use each frozen candidate specification's publication threshold; report missingness and performance by every declared subgroup.",
    evidenceScarcity: "A candidate fails if lower source availability mechanically becomes a worse country-quality output or an unqualified zero state.",
  },
  exclusions: ["Panel analyses include only rows in the frozen sovereign-state scope.", "Exclude outside-comparable-series and outside-captured-release cells as typed missing, never as zero.", "Exclude a source from a public artifact if its rights gate fails, without substituting a more favorable source.", "Exclude a candidate-unit only under a rule written here or in its frozen specification; log every exclusion and count by subgroup."],
  multiplicity: {
    confirmatory: "Every required gate must pass; a small p-value on one metric cannot compensate for a failed gate.",
    hypothesisFamilies: "Within each candidate and gate, adjust confirmatory p-values with Holm at familywise alpha 0.05 and report unadjusted values and effect sizes.",
    exploratory: "Label separately and control Benjamini-Hochberg FDR at q=0.05; exploratory results cannot select a winner.",
  },
  decisionRule: {
    originalMeasurement: "All applicable G1-G6 gates pass on both temporal and geographic final holdouts and no disqualifying rights or misuse finding remains.",
    referenceProduct: "K0 passes fidelity, provenance, comprehension, rights, and sustainability; novelty and external-validity gates are not applicable because it makes no original measurement claim.",
    boundedDerivativeBeta: "K1 may remain a clearly derivative research beta only if it passes utility, reliability, coverage, misuse, rights, and reproduction gates even when it cannot claim original information.",
    experimentalResearch: "G2, G4, G5, and G6 pass while independent G3 evidence is pending; never presented as a winner or validated product.",
    retire: "A required gate fails under its frozen rule, or a serious rights, verifiability, or harm finding triggers suspension under the charter.",
    noCandidateWins: true,
    simplicityTieBreak: "If candidates meet the same claimed use within the smallest meaningful-effect threshold, prefer the candidate with fewer transformations and lower reader burden; K0 wins an unresolved tie.",
  },
  amendmentPolicy: "Any change after registration creates a new protocol version and decision record before affected analysis. The original remains immutable. Results under an amended protocol are labeled exploratory unless a new untouched holdout exists.",
  amendment: {
    supersedesProtocol: "civica-index-tournament-preregistration/v1",
    reason: "Correct the frozen Freedom House input from fh_total_score to the canonical K1 pr_cl_total series before any winner-selecting analysis.",
    outcomeDataInspected: false,
    unchanged: "Candidates, splits, baselines, gates, thresholds, subgroup and sensitivity plans, missingness, exclusions, multiplicity, and decision rules are unchanged.",
  },
} as const;

export function geographicTournamentBucket(iso3: string): number {
  const digest = createHash("sha256").update(`${INDEX_TOURNAMENT_PREREGISTRATION.splits.geographic.salt}:${iso3.toUpperCase()}`).digest();
  return digest.readUInt32BE(0) % 10;
}

export function tournamentPreregistrationErrors(protocol = INDEX_TOURNAMENT_PREREGISTRATION): string[] {
  const errors: string[] = [];
  if (protocol.status !== "locked_before_winner_selecting_analysis") errors.push("protocol is not locked");
  if (protocol.candidates.length !== INDEX_CANDIDATE_SPECIFICATIONS.length) errors.push("candidate set is incomplete");
  if (protocol.baselines.length < 4) errors.push("baseline set is incomplete");
  if (protocol.gates.length !== 6 || protocol.gates.some((gate) => !gate.required)) errors.push("six required gates are not frozen");
  if (!protocol.decisionRule.noCandidateWins) errors.push("no-winner outcome is disabled");
  if (!protocol.multiplicity.confirmatory.includes("Every required gate must pass")) errors.push("gate compensation is permitted");
  if (!protocol.missingness.default.includes("No imputation")) errors.push("missingness policy permits substitution");
  for (const candidate of protocol.candidates) if (!(candidate.id in protocol.metricsAndThresholds)) errors.push(`${candidate.id} has no frozen thresholds`);
  for (const hash of [protocol.frozenPanel.rowSha256, protocol.frozenPanel.coverageSha256, protocol.frozenPanel.temporalBreaksSha256]) if (!/^[a-f0-9]{64}$/.test(hash)) errors.push(`invalid frozen hash: ${hash}`);
  return errors;
}
