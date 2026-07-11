import { GOVERNANCE_EVIDENCE_INDICATORS } from "./governance-evidence";
import { INDEX_DISPOSITION } from "./index-disposition";

export const GOVERNANCE_EVIDENCE_REVIEW_PACKET = Object.freeze({
  schemaVersion: "governance-evidence-review-packet/v1",
  releaseId: "governance-evidence-review-packet-2026-07-v1",
  status: "ready_for_external_review_not_endorsed",
  selectedProduct: INDEX_DISPOSITION.selectedDisposition,
  productRoute: INDEX_DISPOSITION.publicProduct.route,
  construct: {
    question: "What do the selected established governance sources report for this country in the frozen reference year?",
    unit: "one country × publisher indicator × reference year observation",
    role: "comparative reference display",
    nonclaims: [
      "No original Civica governance measurement",
      "No composite, grade, rank, country-quality verdict, or causal estimate",
      "Agreement between rows is not independent corroboration",
      "Absence of an observation is not evidence of weak governance",
    ],
  },
  frozenInputs: {
    releaseId: "ci-k1-uncertainty-inputs-2024-v2",
    referenceYear: 2024,
    grid: { jurisdictions: 194, indicators: 5, cells: 970 },
    valuesLocation: "private_neon_ci_research_panel_rows",
    redistribution: "rights-filtered; blocked values remain at publisher URLs",
  },
  implementation: {
    code: [
      "src/lib/ci/governance-evidence.ts",
      "src/lib/db/queries-governance-evidence.ts",
      "src/components/governance-evidence/GovernanceEvidenceTable.tsx",
      "src/app/governance-evidence/page.tsx",
      "src/app/api/governance-evidence/[slug]/route.ts",
      "scripts/validate-governance-evidence-dashboard.ts",
    ],
    environmentSource: "data/releases/index-tournament-results-package-v1/manifest.v1.json",
    packageLock: "package-lock.json",
  },
  transformations: {
    empiricalValues: "none; publisher values remain on native scales",
    displayOnly: "decimal formatting follows native scale span",
    aggregation: "none",
    missingness: "no imputation; missing remains explicit",
    export: "values survive only where the rights manifest permits public export",
  },
  uncertainty: {
    rule: "show publisher-supplied intervals exactly; otherwise state the published absence",
    covariance: "not estimated and not required because no composite is calculated",
    calibratedCivicaInterval: false,
  },
  validation: {
    exactSourceFileCells: { passed: 970, expected: 970 },
    rightsSafeExportFixture: "passed",
    noCompositeContract: "passed",
    qualifiedReaderProtocol: "pending_human_responses",
    independentReview: "pending",
  },
  sensitivity: {
    modelParameters: "not applicable: the selected product has no model, weights, or thresholds",
    materialChoices: [
      "publisher and indicator inclusion",
      "source edition and reference year",
      "ordering and explanatory copy",
      "rights-driven visibility in downloads",
    ],
    relatedCompositeAnalysis: "data/releases/index-sensitivity-analysis-v1/result.v1.json",
  },
  subgroupResults: {
    scorePerformance: "not applicable: the selected product emits no score or prediction",
    coverageOwner: "data/releases/index-subgroup-fairness-v1/result.v1.json",
    limitation: "coverage differences remain visible; no subgroup accuracy claim is possible without an external truth criterion",
  },
  knownLimitations: [
    "The selected five rows are overlapping governance assessments, not independent evidence streams.",
    "Indicator inclusion is an editorial choice and does not exhaust the governance literature.",
    "Publisher vintages and country coverage differ.",
    "Freedom House publishes no per-country probability distribution for the displayed combined rating.",
    "Mixed publisher rights prevent one public bulk bundle of all values.",
    "No qualified-reader result or independent expert endorsement exists yet.",
    "Native scales reduce transformation risk but still require readers to understand different constructs and directions.",
  ],
  citation: {
    title: "Civica Atlas Governance Evidence Dashboard external-review packet",
    version: "governance-evidence-review-packet-2026-07-v1",
    url: "https://civicaatlas.org/governance-evidence",
    accessVsReuse: "Citation does not grant permission to redistribute upstream data.",
  },
  reproduction: {
    command: "npm run reproduce:governance-evidence-review-packet",
    validationCommand: "npm run validate:governance-evidence-review-packet",
    expected: "The generated manifest, inventory, codebook, questions, citation, and checksums match byte-for-byte; dashboard fixtures pass 970/970 cells.",
  },
  tournamentReview: {
    package: "data/releases/index-tournament-results-package-v1/manifest.v1.json",
    preregistration: "plan/research/index-tournament-preregistration-v3.md",
    decisionTable: "data/releases/index-tournament-confirmatory-decision-v1/decision.v1.json",
    disposition: "data/releases/index-disposition-2026-07-v1/resolution.v1.json",
    misuseAudit: "data/releases/index-misuse-audit-v1/result.v1.json",
    failedAndPendingLedger: "data/releases/index-tournament-results-package-v1/error-ledger.v1.json",
    interpretation: "No candidate won. K1 failed originality, K2 failed stability, and fourteen human or expert thresholds remain insufficient.",
  },
  reviewQuestions: [
    "Is the stated source-native construct narrow enough to match what the dashboard actually displays?",
    "Are any selected indicators inappropriate, redundant, or missing for the stated comparative-reference role?",
    "Does the native-scale presentation prevent false comparability, or does it need stronger visual or prose separation?",
    "Are publisher uncertainty and explicit uncertainty absence represented accurately and proportionately?",
    "Are source overlap and dependence disclosed clearly enough to prevent a corroboration claim?",
    "Does the missingness presentation avoid treating scarce evidence as poor governance?",
    "Are the rights-filtered download and publisher-link approach adequate for scholarly verification?",
    "Does the no-winner evidence justify the adopted source-native disposition?",
    "Are K1's reconsideration criteria sufficient to prevent silent revival of the rejected league-table semantics?",
    "Which remaining evidence gap is most important before public academic outreach?",
  ],
  reviewerTerms: {
    conflictDisclosureRequired: true,
    favorableConclusionRequired: false,
    publicEndorsementImplied: false,
    requestedOutput: "bounded written review answering the exact questions, with severity and evidence references for each concern",
  },
  codebook: GOVERNANCE_EVIDENCE_INDICATORS.map((row) => ({
    identity: row.identity,
    sourceId: row.sourceId,
    indicatorId: row.indicatorId,
    label: row.label,
    construct: row.construct,
    direction: row.direction,
    sourceUrl: row.sourceUrl,
  })),
} as const);

export const REVIEW_PACKET_REQUIRED_SECTIONS = [
  "construct", "frozenInputs", "implementation", "transformations",
  "uncertainty", "validation", "sensitivity", "subgroupResults",
  "knownLimitations", "citation", "reproduction", "tournamentReview",
  "reviewQuestions",
] as const;

export function governanceEvidenceReviewPacketErrors(
  packet = GOVERNANCE_EVIDENCE_REVIEW_PACKET,
): string[] {
  const errors: string[] = [];
  if (packet.selectedProduct !== "source_native_dashboard_only") errors.push("selected product drifted");
  if (packet.frozenInputs.grid.cells !== 970) errors.push("frozen cell universe drifted");
  if (packet.validation.exactSourceFileCells.passed !== packet.validation.exactSourceFileCells.expected) errors.push("source-file fidelity is incomplete");
  if (packet.transformations.aggregation !== "none") errors.push("selected product gained an aggregation");
  if (packet.uncertainty.calibratedCivicaInterval !== false) errors.push("unsupported Civica interval claim");
  if (packet.codebook.length !== 5) errors.push("codebook must contain five source-native indicators");
  if (packet.reviewQuestions.length < 8) errors.push("review questionnaire is not bounded and complete");
  if (!packet.reproduction.command || !packet.reproduction.validationCommand) errors.push("reproduction commands are incomplete");
  if (!packet.tournamentReview.interpretation.includes("No candidate won")) errors.push("tournament no-winner result is missing");
  if (packet.reviewerTerms.favorableConclusionRequired || packet.reviewerTerms.publicEndorsementImplied) errors.push("reviewer independence terms are invalid");
  const serialized = JSON.stringify(packet);
  for (const forbidden of ["countryGrade", "winnerSelected\":true", "independently validated"]) {
    if (serialized.includes(forbidden)) errors.push(`forbidden packet claim: ${forbidden}`);
  }
  return errors;
}
