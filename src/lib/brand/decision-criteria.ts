import { createHash } from "node:crypto";

export const BRAND_NAME_DECISION_VERSION =
  "brand-name-decision-criteria/v1" as const;

export const BRAND_NAME_DECISION_CRITERION_IDS = [
  "trademark_and_confusion_risk",
  "domain_and_social_availability",
  "pronunciation_and_searchability",
  "semantic_and_mission_fit",
  "geographic_and_cultural_neutrality",
  "distinctiveness_and_memorability",
  "migration_cost_and_continuity",
  "evidence_quality_and_uncertainty",
  "owner_preference",
] as const;

export type BrandNameDecisionCriterionId =
  (typeof BRAND_NAME_DECISION_CRITERION_IDS)[number];

export interface BrandNameDecisionCriterion {
  id: BrandNameDecisionCriterionId;
  label: string;
  weight: number;
  veto: boolean;
  question: string;
  acceptedEvidence: readonly string[];
  scoringGuidance: string;
  failureEffect: string;
}

export interface BrandNameDecisionContract {
  schemaVersion: typeof BRAND_NAME_DECISION_VERSION;
  adoptedOn: string;
  status: "adopted_pre_clearance_policy";
  purpose: string;
  scopeBoundary: string;
  conclusions: {
    currentNameAssessed: false;
    recommendation: null;
    legalConclusion: null;
  };
  scoreScale: {
    minimum: 0;
    maximum: 4;
    anchors: readonly string[];
    unknownRule: string;
  };
  evidenceRules: {
    officialAndPrimaryFirst: boolean;
    retrievalDatesRequired: boolean;
    jurisdictionsRequired: boolean;
    sourceLinksRequired: boolean;
    uncertaintyAndLimitationsRequired: boolean;
    professionalLegalReviewRequired: boolean;
    unknownNeverPasses: boolean;
  };
  decisionRules: {
    minimumEligibleScore: number;
    materialAdvantagePoints: number;
    minimumNonPreferenceAdvantages: number;
    personalDislikeAloneNeverDecides: boolean;
    ownerPreferenceCanClearVeto: boolean;
    ownerPreferenceCanReplaceEvidence: boolean;
    legalClearanceRequiredBeforeAdoption: boolean;
    currentNameVetoRequiresReplacementClearance: boolean;
    keepRule: string;
    renameRule: string;
    insufficientEvidenceRule: string;
  };
  requiredDecisionRecordFields: readonly string[];
  criteria: readonly BrandNameDecisionCriterion[];
}

export const BRAND_NAME_DECISION_CONTRACT = Object.freeze({
  schemaVersion: BRAND_NAME_DECISION_VERSION,
  adoptedOn: "2026-07-13",
  status: "adopted_pre_clearance_policy",
  purpose:
    "Compare keeping the current project name with any professionally screened replacement using the same evidence, scoring scale, vetoes, and decision record.",
  scopeBoundary:
    "This policy defines how a future decision is made. It does not search registries, assess Civica Atlas or another name, clear a mark, reserve a domain or handle, or recommend keeping or renaming.",
  conclusions: {
    currentNameAssessed: false,
    recommendation: null,
    legalConclusion: null,
  },
  scoreScale: {
    minimum: 0,
    maximum: 4,
    anchors: [
      "0 — disqualifying or materially adverse evidence",
      "1 — substantial weakness that is not adequately mitigated",
      "2 — mixed or incomplete fit with a credible mitigation path",
      "3 — good fit supported by current evidence",
      "4 — unusually strong fit supported by current evidence",
    ],
    unknownRule:
      "Unknown, stale, unverified, or jurisdiction-incomplete evidence is recorded as unknown and cannot be converted to a passing score.",
  },
  evidenceRules: {
    officialAndPrimaryFirst: true,
    retrievalDatesRequired: true,
    jurisdictionsRequired: true,
    sourceLinksRequired: true,
    uncertaintyAndLimitationsRequired: true,
    professionalLegalReviewRequired: true,
    unknownNeverPasses: true,
  },
  decisionRules: {
    minimumEligibleScore: 65,
    materialAdvantagePoints: 8,
    minimumNonPreferenceAdvantages: 3,
    personalDislikeAloneNeverDecides: true,
    ownerPreferenceCanClearVeto: false,
    ownerPreferenceCanReplaceEvidence: false,
    legalClearanceRequiredBeforeAdoption: true,
    currentNameVetoRequiresReplacementClearance: true,
    keepRule:
      "Keep only when the current name has complete required evidence, professional legal clearance, no veto, a weighted score of at least 65, and no eligible replacement has a material evidence-based advantage.",
    renameRule:
      "Rename only when a professionally cleared replacement scores at least 65 and either the current name has a documented veto or the replacement leads by at least 8 weighted points across at least three non-preference criteria.",
    insufficientEvidenceRule:
      "Record no decision when required evidence, jurisdiction coverage, professional legal review, replacement clearance, or the material-advantage test is incomplete.",
  },
  requiredDecisionRecordFields: [
    "candidate identifier and exact spelling",
    "current-name or replacement-candidate role",
    "criterion scores with written rationale",
    "source URLs and retrieval dates",
    "searched jurisdictions, classes, registries, domains, and social platforms",
    "known uncertainty, missing evidence, and limitations",
    "professional legal-review scope, date, and disposition",
    "vetoes, mitigations, and unresolved risks",
    "weighted total and non-preference advantage count",
    "owner preference recorded separately from evidence",
    "decision, approver, date, and reasons",
  ],
  criteria: [
    {
      id: "trademark_and_confusion_risk",
      label: "Trademark and confusion risk",
      weight: 22,
      veto: true,
      question:
        "Do dated official-registry evidence and professional legal review support use in the intended jurisdictions, classes, services, and audiences without unacceptable confusion risk?",
      acceptedEvidence: [
        "Dated results from relevant official trademark and company registries, with exact queries, jurisdictions, classes, and limitations.",
        "Professional legal review covering similarity, overlap, actual-confusion indicators, intended use, migration exposure, and the scope of counsel's conclusion.",
      ],
      scoringGuidance:
        "Score from unacceptable unmitigated risk (0) to well-supported low residual risk within the reviewed scope (4); unresolved scope stays unknown.",
      failureEffect:
        "An unmitigated professional finding of unacceptable legal or confusion risk vetoes keeping or adopting that name.",
    },
    {
      id: "domain_and_social_availability",
      label: "Domain, handle, and search availability",
      weight: 13,
      veto: false,
      question:
        "Are suitable domains, public handles, package/repository names, and search-result identities available or safely usable without impersonation or reader confusion?",
      acceptedEvidence: [
        "Dated registrar or registry lookups for the target domain set, including ownership, renewal, transfer, and redirect constraints where relevant.",
        "Dated checks of required social, repository, package, status-page, email, and search-result identities, recording unavailable or ambiguous variants.",
      ],
      scoringGuidance:
        "Score from no coherent discoverable identity (0) to a consistent, controllable, low-confusion identity across required channels (4).",
      failureEffect:
        "Unavailability is a documented cost or weakness, not automatic legal clearance and not an automatic rename by itself.",
    },
    {
      id: "pronunciation_and_searchability",
      label: "Pronunciation and searchability",
      weight: 10,
      veto: false,
      question:
        "Can intended readers pronounce, spell, hear, type, and retrieve the name reliably without repeated correction or collision with unrelated terms?",
      acceptedEvidence: [
        "Structured comprehension checks with representative readers using spoken, written, and search tasks under a recorded protocol.",
        "Dated search tests covering common spellings, transcription errors, abbreviations, and likely query contexts without treating result rank as permanent.",
      ],
      scoringGuidance:
        "Score from routinely misheard, misspelled, or unretrievable (0) to consistently pronounced, recalled, typed, and found (4).",
      failureEffect:
        "Anecdote or owner familiarity cannot substitute for reader evidence.",
    },
    {
      id: "semantic_and_mission_fit",
      label: "Semantic and mission fit",
      weight: 17,
      veto: false,
      question:
        "Does the name accurately support the provenance-first comparative-governance atlas mission without implying validation, official status, political alignment, or product scope that Civica does not have?",
      acceptedEvidence: [
        "A documented comparison with the approved product position, claim tiers, target audiences, and atlas-first product hierarchy.",
        "Structured reader interpretation tests that record what the name suggests before respondents receive explanatory copy.",
      ],
      scoringGuidance:
        "Score from materially misleading or mission-conflicting meaning (0) to accurate, bounded, durable mission fit (4).",
      failureEffect:
        "Marketing language cannot repair a name whose ordinary interpretation materially contradicts the product or its evidence posture.",
    },
    {
      id: "geographic_and_cultural_neutrality",
      label: "Geographic, linguistic, and cultural neutrality",
      weight: 12,
      veto: false,
      question:
        "Across priority languages and regions, does the name avoid unintended political, geographic, institutional, derogatory, or culturally exclusionary meanings?",
      acceptedEvidence: [
        "Dated language and meaning checks by qualified speakers or reliable primary linguistic references for the declared priority markets.",
        "Documented regional review covering governmental or institutional associations, political connotations, transliteration, and known false friends.",
      ],
      scoringGuidance:
        "Score from serious unmitigated cross-market harm (0) to geographically neutral and culturally legible across the reviewed scope (4).",
      failureEffect:
        "Untested regions remain a limitation; silence is not evidence of neutrality.",
    },
    {
      id: "distinctiveness_and_memorability",
      label: "Distinctiveness and memorability",
      weight: 13,
      veto: false,
      question:
        "Is the name meaningfully distinguishable from adjacent organizations and products, and can intended readers recognize and recall it without confusing source authority or endorsement?",
      acceptedEvidence: [
        "A neutral dated landscape of active adjacent names, sectors, audiences, visual/verbal similarity, and documented confusion indicators.",
        "Structured recognition and delayed-recall checks that compare serious candidates under the same protocol rather than asking which one people like.",
      ],
      scoringGuidance:
        "Score from generic or readily confused (0) to distinct, accurately recalled, and appropriately attributable (4).",
      failureEffect:
        "Novel spelling alone is not distinctiveness when pronunciation, search, or attribution remains confusing.",
    },
    {
      id: "migration_cost_and_continuity",
      label: "Migration cost and continuity",
      weight: 8,
      veto: false,
      question:
        "What would keeping or changing the name cost across code, data, domains, email, redirects, APIs, embeds, citations, DOI metadata, assets, legal pages, search, social identity, and reader trust?",
      acceptedEvidence: [
        "A reversible inventory with owners, sequence, compatibility window, redirects, citation/DOI treatment, rollback, and zero-change path.",
        "Estimated direct cost, labor, downtime, broken-link and citation risk, reader-confusion risk, and residual legacy-name obligations with stated assumptions.",
      ],
      scoringGuidance:
        "Score each option from disproportionate or unsafe transition burden (0) to low, reversible, well-controlled continuity cost (4).",
      failureEffect:
        "Sunk cost alone cannot override a legal veto, while a rename benefit must be material enough to justify its measured transition burden.",
    },
    {
      id: "evidence_quality_and_uncertainty",
      label: "Evidence quality and uncertainty",
      weight: 0,
      veto: true,
      question:
        "Is every scored criterion supported by current, attributable, scope-matched evidence with retrieval dates, uncertainty, limitations, and professional review where required?",
      acceptedEvidence: [
        "A complete per-criterion source ledger naming URLs or records, retrieval dates, jurisdictions, methods, responsible reviewer, confidence, and limitations.",
        "Explicit unknown and not-applicable states with reasons; no missing result is replaced by a guess, output hash, old screenshot, or owner assertion.",
      ],
      scoringGuidance:
        "This is a zero-weight eligibility gate: complete evidence passes; incomplete, stale, or scope-mismatched evidence records no decision.",
      failureEffect:
        "Failure vetoes a final keep/rename decision until the evidence gap is closed or the decision scope is narrowed explicitly.",
    },
    {
      id: "owner_preference",
      label: "Owner preference",
      weight: 5,
      veto: false,
      question:
        "After reviewing the same evidence, which eligible option does the owner prefer, and what durable mission or stewardship reason supports that preference?",
      acceptedEvidence: [
        "A dated owner statement separating mission/stewardship reasons from personal taste and acknowledging the evidence, costs, risks, and unknowns.",
        "A signed decision record showing that preference was considered only after legal, evidence, and eligibility gates were applied.",
      ],
      scoringGuidance:
        "Score the stated preference from strong opposition (0) to strong preference (4), capped at five percent of the weighted total.",
      failureEffect:
        "Personal dislike, aesthetic taste, or resemblance to a disliked project cannot alone veto a name, clear a risk, replace evidence, or trigger a rename.",
    },
  ],
} as const satisfies BrandNameDecisionContract);

export interface BrandNameAssessment {
  candidateId: string;
  evidenceComplete: boolean;
  professionalLegalState: "cleared" | "not_cleared" | "pending";
  legalRiskVeto: boolean;
  scores: Partial<Record<BrandNameDecisionCriterionId, number | null>>;
}

export type BrandNameDecisionResult =
  | {
      outcome: "keep" | "rename";
      selectedCandidateId: string;
      reason: string;
    }
  | {
      outcome: "insufficient_evidence";
      selectedCandidateId: null;
      reason: string;
    };

function assessmentScore(assessment: BrandNameAssessment): number | null {
  let total = 0;
  for (const criterion of BRAND_NAME_DECISION_CONTRACT.criteria) {
    if (criterion.weight === 0) continue;
    const score = assessment.scores[criterion.id];
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < BRAND_NAME_DECISION_CONTRACT.scoreScale.minimum ||
      score > BRAND_NAME_DECISION_CONTRACT.scoreScale.maximum
    ) {
      return null;
    }
    total +=
      (score / BRAND_NAME_DECISION_CONTRACT.scoreScale.maximum) *
      criterion.weight;
  }
  return Number(total.toFixed(4));
}

function nonPreferenceAdvantageCount(
  current: BrandNameAssessment,
  candidate: BrandNameAssessment,
): number | null {
  let count = 0;
  for (const criterion of BRAND_NAME_DECISION_CONTRACT.criteria) {
    if (
      criterion.id === "owner_preference" ||
      criterion.id === "evidence_quality_and_uncertainty"
    ) {
      continue;
    }
    const currentScore = current.scores[criterion.id];
    const candidateScore = candidate.scores[criterion.id];
    if (typeof currentScore !== "number" || typeof candidateScore !== "number") {
      return null;
    }
    if (candidateScore > currentScore) count += 1;
  }
  return count;
}

function isEvidenceReady(assessment: BrandNameAssessment): boolean {
  return (
    assessment.evidenceComplete &&
    assessment.professionalLegalState === "cleared" &&
    assessmentScore(assessment) !== null
  );
}

/**
 * Applies the adopted rule to abstract, evidence-complete assessments.
 * It deliberately contains no real candidate names or findings.
 */
export function decideBrandName(
  current: BrandNameAssessment,
  replacements: readonly BrandNameAssessment[],
): BrandNameDecisionResult {
  if (!isEvidenceReady(current) || replacements.some((row) => !isEvidenceReady(row))) {
    return {
      outcome: "insufficient_evidence",
      selectedCandidateId: null,
      reason: BRAND_NAME_DECISION_CONTRACT.decisionRules.insufficientEvidenceRule,
    };
  }

  const currentScore = assessmentScore(current)!;
  const eligibleReplacements = replacements
    .filter((row) => !row.legalRiskVeto)
    .map((row) => ({
      row,
      score: assessmentScore(row)!,
      advantages: nonPreferenceAdvantageCount(current, row)!,
    }))
    .filter(
      ({ score }) =>
        score >= BRAND_NAME_DECISION_CONTRACT.decisionRules.minimumEligibleScore,
    )
    .sort(
      (a, b) =>
        b.score - a.score || a.row.candidateId.localeCompare(b.row.candidateId),
    );

  const strongest = eligibleReplacements[0];
  if (current.legalRiskVeto) {
    if (!strongest) {
      return {
        outcome: "insufficient_evidence",
        selectedCandidateId: null,
        reason:
          "The current option is vetoed, but no professionally cleared replacement meets the eligibility threshold.",
      };
    }
    return {
      outcome: "rename",
      selectedCandidateId: strongest.row.candidateId,
      reason: "A documented current-name veto and an eligible cleared replacement require renaming.",
    };
  }

  if (
    strongest &&
    strongest.score - currentScore >=
      BRAND_NAME_DECISION_CONTRACT.decisionRules.materialAdvantagePoints &&
    strongest.advantages >=
      BRAND_NAME_DECISION_CONTRACT.decisionRules
        .minimumNonPreferenceAdvantages
  ) {
    return {
      outcome: "rename",
      selectedCandidateId: strongest.row.candidateId,
      reason:
        "The cleared replacement meets the material weighted advantage and non-preference evidence tests.",
    };
  }

  if (
    currentScore >=
    BRAND_NAME_DECISION_CONTRACT.decisionRules.minimumEligibleScore
  ) {
    return {
      outcome: "keep",
      selectedCandidateId: current.candidateId,
      reason:
        "The current name is eligible and no replacement meets the material evidence-based rename rule.",
    };
  }

  return {
    outcome: "insufficient_evidence",
    selectedCandidateId: null,
    reason:
      "The current option does not meet the eligibility score and no replacement meets the rename rule.",
  };
}

export function brandNameDecisionContractErrors(
  contract: BrandNameDecisionContract = BRAND_NAME_DECISION_CONTRACT,
): string[] {
  const errors: string[] = [];
  const ids = contract.criteria.map(({ id }) => id);
  if (
    JSON.stringify(ids) !==
    JSON.stringify(BRAND_NAME_DECISION_CRITERION_IDS)
  ) {
    errors.push("criterion inventory or order drifted");
  }
  if (new Set(ids).size !== ids.length) errors.push("criterion IDs must be unique");

  const totalWeight = contract.criteria.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );
  if (totalWeight !== 100) errors.push("criterion weights must total 100");

  for (const criterion of contract.criteria) {
    if (!criterion.label.trim() || !criterion.question.trim()) {
      errors.push(`${criterion.id}: label and question are required`);
    }
    if (criterion.acceptedEvidence.length < 2) {
      errors.push(`${criterion.id}: at least two evidence classes are required`);
    }
    if (!criterion.scoringGuidance.trim() || !criterion.failureEffect.trim()) {
      errors.push(`${criterion.id}: scoring and failure rules are required`);
    }
  }

  const legal = contract.criteria.find(
    ({ id }) => id === "trademark_and_confusion_risk",
  );
  const legalEvidence = legal?.acceptedEvidence.join(" ") ?? "";
  if (!legal?.veto) errors.push("trademark/confusion risk must be a veto");
  if (!/official trademark and company registries/i.test(legalEvidence)) {
    errors.push("trademark/confusion risk must require official registry evidence");
  }
  if (!/professional legal review/i.test(legalEvidence)) {
    errors.push("trademark/confusion risk must require professional legal review");
  }

  const evidence = contract.criteria.find(
    ({ id }) => id === "evidence_quality_and_uncertainty",
  );
  if (!evidence?.veto || evidence.weight !== 0) {
    errors.push("evidence quality must be a zero-weight eligibility veto");
  }

  const preference = contract.criteria.find(
    ({ id }) => id === "owner_preference",
  );
  const preferenceWeight = preference?.weight ?? 0;
  if (!preference || preference.weight > 5 || preference.veto) {
    errors.push("owner preference must be non-veto and capped at five percent");
  }
  if (
    !/cannot alone veto a name, clear a risk, replace evidence, or trigger a rename/i.test(
      preference?.failureEffect ?? "",
    )
  ) {
    errors.push("personal dislike safeguard is missing");
  }

  const rules = contract.decisionRules;
  if (
    !rules.personalDislikeAloneNeverDecides ||
    rules.ownerPreferenceCanClearVeto ||
    rules.ownerPreferenceCanReplaceEvidence
  ) {
    errors.push("owner preference decision safeguards drifted");
  }
  if (
    !rules.legalClearanceRequiredBeforeAdoption ||
    !rules.currentNameVetoRequiresReplacementClearance
  ) {
    errors.push("professional clearance rules drifted");
  }
  if (
    rules.minimumEligibleScore < 50 ||
    rules.materialAdvantagePoints <= preferenceWeight ||
    rules.minimumNonPreferenceAdvantages < 2
  ) {
    errors.push("material evidence threshold is too weak");
  }

  if (
    !contract.evidenceRules.officialAndPrimaryFirst ||
    !contract.evidenceRules.retrievalDatesRequired ||
    !contract.evidenceRules.jurisdictionsRequired ||
    !contract.evidenceRules.sourceLinksRequired ||
    !contract.evidenceRules.uncertaintyAndLimitationsRequired ||
    !contract.evidenceRules.professionalLegalReviewRequired ||
    !contract.evidenceRules.unknownNeverPasses
  ) {
    errors.push("evidence rules are incomplete");
  }

  const requiredRecordPhrases = [
    "source URLs and retrieval dates",
    "searched jurisdictions",
    "uncertainty",
    "professional legal-review",
    "owner preference recorded separately",
    "decision, approver, date, and reasons",
  ];
  const record = contract.requiredDecisionRecordFields.join(" ");
  for (const phrase of requiredRecordPhrases) {
    if (!record.includes(phrase)) {
      errors.push(`decision record is missing: ${phrase}`);
    }
  }

  if (
    contract.conclusions.currentNameAssessed !== false ||
    contract.conclusions.recommendation !== null ||
    contract.conclusions.legalConclusion !== null
  ) {
    errors.push("BRD-004 must not contain a naming or legal conclusion");
  }
  return errors;
}

export function brandNameDecisionContractHash(
  contract: BrandNameDecisionContract = BRAND_NAME_DECISION_CONTRACT,
): string {
  return createHash("sha256").update(JSON.stringify(contract)).digest("hex");
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderBrandNameDecisionCriteriaMarkdown(
  contract: BrandNameDecisionContract = BRAND_NAME_DECISION_CONTRACT,
): string {
  const lines = [
    "# Brand keep/rename decision criteria",
    "",
    `**Contract:** \`${contract.schemaVersion}\``,
    `**Adopted:** ${contract.adoptedOn}`,
    "**Status:** Criteria adopted; no name has been assessed or cleared",
    "",
    "## Purpose and boundary",
    "",
    contract.purpose,
    "",
    contract.scopeBoundary,
    "",
    "This document records no trademark, company-name, domain, handle, linguistic, or legal conclusion. BRD-001 and BRD-002 supply dated research; BRD-003 supplies professional legal review. A final owner decision can occur only after those records exist.",
    "",
    "## Scoring scale",
    "",
    ...contract.scoreScale.anchors.map((anchor) => `- ${anchor}`),
    "",
    `Unknown rule: ${contract.scoreScale.unknownRule}`,
    "",
    "Weights total 100. Evidence quality is a zero-weight eligibility gate, and owner preference is capped at five percent.",
    "",
    "## Criteria",
    "",
    "| Criterion | Weight | Veto | Question | Required evidence |",
    "|---|---:|:---:|---|---|",
    ...contract.criteria.map(
      (criterion) =>
        `| \`${criterion.id}\` — ${markdownCell(criterion.label)} | ${criterion.weight} | ${criterion.veto ? "Yes" : "No"} | ${markdownCell(criterion.question)} | ${markdownCell(criterion.acceptedEvidence.join(" "))} |`,
    ),
    "",
    "## Scoring and failure rules",
    "",
    ...contract.criteria.flatMap((criterion) => [
      `### ${criterion.label}`,
      "",
      `Scoring: ${criterion.scoringGuidance}`,
      "",
      `Failure effect: ${criterion.failureEffect}`,
      "",
    ]),
    "## Decision rules",
    "",
    `- Minimum eligible weighted score: **${contract.decisionRules.minimumEligibleScore}/100**.`,
    `- A replacement needs a material lead of at least **${contract.decisionRules.materialAdvantagePoints} weighted points** across at least **${contract.decisionRules.minimumNonPreferenceAdvantages} non-preference criteria**, unless professional review vetoes the current name.`,
    `- Keep rule: ${contract.decisionRules.keepRule}`,
    `- Rename rule: ${contract.decisionRules.renameRule}`,
    `- No-decision rule: ${contract.decisionRules.insufficientEvidenceRule}`,
    "- Owner preference cannot clear a veto, replace evidence, or supply one of the required non-preference advantages.",
    "- Personal dislike of another project, aesthetic taste, or an unsupported impression can never decide the outcome alone.",
    "",
    "## Required decision record",
    "",
    ...contract.requiredDecisionRecordFields.map((field) => `- ${field}`),
    "",
    "## Current disposition",
    "",
    "No current or replacement name has been scored. No keep/rename recommendation or legal conclusion is recorded. The valid outcome today is `insufficient_evidence` until the research, professional review, and decision record are complete.",
    "",
    `Contract SHA-256: \`${brandNameDecisionContractHash(contract)}\``,
    "",
  ];
  return lines.join("\n");
}
