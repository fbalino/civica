import { createHash } from "node:crypto";

export const INDEX_DISPOSITION = Object.freeze({
  schemaVersion: "civica-index-disposition/v1",
  releaseId: "civica-index-disposition-2026-07-v1",
  selectedDisposition: "source_native_dashboard_only",
  status: "adopted_pending_full_surface_migration",
  publicProduct: {
    name: "Governance Evidence Dashboard",
    route: "/governance-evidence",
    claim: "Source-native comparison of established governance assessments with no Civica country-quality composite, grade, or rank.",
  },
  k1Composite: {
    standing: "retained_versioned_research_not_publicly_recommended",
    originalMeasurementClaim: "rejected",
    boundedDerivativeUtility: "unresolved_pending_qualified_reader_experiment",
    currentLeagueTablePresentation: "failed_misuse_resistance",
    preservation: "Keep code, frozen inputs, results, failures, and historical API evidence for research and reconsideration; do not delete or silently revive it as the selected product.",
  },
  evidence: [
    "civica-index-tournament-results-v1",
    "civica-index-tournament-confirmatory-decision-v1",
    "index-misuse-audit-v1",
    "IDX-022 qualified-reader protocol and pending status",
  ],
  failedTests: [
    "K1 fails original-information novelty because its public inputs reproduce its final-holdout output above the frozen failure boundary.",
    "K2 fails drop-one-rater stability under the frozen threshold.",
    "The current K1 league-table presentation fails misuse resistance.",
  ],
  unresolvedTests: [
    "K0 direction comprehension with qualified readers",
    "K1 bounded derivative task utility with qualified readers",
    "K2 external contested and consensus labels",
    "K3 historical, reliability, citation, and freshness review",
    "K4 blinded coding and constitutional-scholar review",
    "K5 relation coding, citation audit, and external expert review",
  ],
  minorityArguments: [
    "A transparent derivative summary may still save qualified readers time even when it adds no original information.",
    "A familiar scalar can lower initial reader burden and preserve continuity for research comparisons.",
    "Removing a composite before the reader experiment could discard a bounded use that has not yet been tested.",
  ],
  limitations: [
    "The qualified-reader experiment has no human responses.",
    "External coding and expert gates for K2 through K5 remain incomplete.",
    "The current evidence cannot establish subgroup accuracy in small final-holdout cells.",
    "Mixed publisher rights prevent a public bulk bundle of all source observations.",
  ],
  reconsiderationCriteria: [
    "K1 meets the frozen reader accuracy or time threshold with no comprehension, source-tracing, uncertainty, or nonclaim loss.",
    "A redesigned K1 presentation removes default league-table incentives and passes the misuse gate.",
    "Reliability, coverage, rights, and exact-reproduction gates remain passing under a new versioned release.",
    "The public claim remains explicitly derivative and secondary; reconsideration cannot restore an original-measurement claim on the current evidence.",
  ],
  rejectedAlternatives: {
    secondaryValidatedIndex: "rejected_current_evidence",
    originalCivicaMeasurement: "rejected_current_evidence",
    permanentResearchRetirement: "not_selected_while_bounded_derivative_utility_is_unresolved",
    nonordinalCandidateAsPublicProduct: "not_selected_pending_external_validation",
  },
  publicSummary: "Civica's selected public comparison product is the source-native Governance Evidence Dashboard. The composite is preserved as versioned research, but it is not an original Civica measurement or a recommended country ranking. A narrower derivative use may be reconsidered only after the qualified-reader and misuse gates pass.",
} as const);

export const INDEX_DISPOSITION_SHA256 = createHash("sha256").update(JSON.stringify(INDEX_DISPOSITION)).digest("hex");

export function indexDispositionErrors(disposition = INDEX_DISPOSITION): string[] {
  const errors: string[] = [];
  if (disposition.selectedDisposition !== "source_native_dashboard_only") errors.push("selected disposition drifted");
  if (!disposition.publicProduct.route.startsWith("/")) errors.push("public product route is invalid");
  if (disposition.k1Composite.originalMeasurementClaim !== "rejected") errors.push("K1 originality failure was softened");
  if (!disposition.k1Composite.standing.includes("not_publicly_recommended")) errors.push("K1 public standing is ambiguous");
  if (disposition.reconsiderationCriteria.length < 4) errors.push("reconsideration gate is incomplete");
  if (disposition.rejectedAlternatives.permanentResearchRetirement.startsWith("rejected")) errors.push("research was permanently retired before utility evidence");
  if (!disposition.publicSummary.includes("source-native")) errors.push("public summary omits selected product");
  return errors;
}
