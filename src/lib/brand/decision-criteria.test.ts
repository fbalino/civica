import assert from "node:assert/strict";
import test from "node:test";

import {
  BRAND_NAME_DECISION_CONTRACT,
  type BrandNameAssessment,
  type BrandNameDecisionContract,
  brandNameDecisionContractErrors,
  decideBrandName,
} from "./decision-criteria";

function cloneContract(): BrandNameDecisionContract {
  return JSON.parse(
    JSON.stringify(BRAND_NAME_DECISION_CONTRACT),
  ) as BrandNameDecisionContract;
}

function assessment(
  candidateId: string,
  overrides: Partial<BrandNameAssessment> = {},
): BrandNameAssessment {
  return {
    candidateId,
    evidenceComplete: true,
    professionalLegalState: "cleared",
    legalRiskVeto: false,
    scores: {
      trademark_and_confusion_risk: 3,
      domain_and_social_availability: 3,
      pronunciation_and_searchability: 3,
      semantic_and_mission_fit: 3,
      geographic_and_cultural_neutrality: 3,
      distinctiveness_and_memorability: 3,
      migration_cost_and_continuity: 3,
      evidence_quality_and_uncertainty: 4,
      owner_preference: 2,
    },
    ...overrides,
  };
}

test("BRD-004 contract covers the complete objective criterion inventory", () => {
  assert.deepEqual(brandNameDecisionContractErrors(), []);
  assert.equal(
    BRAND_NAME_DECISION_CONTRACT.criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0,
    ),
    100,
  );
  assert.deepEqual(BRAND_NAME_DECISION_CONTRACT.conclusions, {
    currentNameAssessed: false,
    recommendation: null,
    legalConclusion: null,
  });
});

test("seeded missing criterion and evidence-rule drift fail closed", () => {
  const missingCriterion = cloneContract();
  missingCriterion.criteria = missingCriterion.criteria.slice(0, -1);
  assert.ok(
    brandNameDecisionContractErrors(missingCriterion).includes(
      "criterion inventory or order drifted",
    ),
  );

  const missingEvidenceRule = cloneContract();
  missingEvidenceRule.evidenceRules.retrievalDatesRequired = false;
  assert.ok(
    brandNameDecisionContractErrors(missingEvidenceRule).includes(
      "evidence rules are incomplete",
    ),
  );
});

test("seeded owner-preference dominance and personal-dislike drift fail", () => {
  const broken = cloneContract();
  const preference = broken.criteria.find(
    ({ id }) => id === "owner_preference",
  )!;
  preference.weight = 30;
  preference.veto = true;
  preference.failureEffect = "The owner dislikes it, so rename.";
  broken.decisionRules.personalDislikeAloneNeverDecides = false;
  broken.decisionRules.ownerPreferenceCanClearVeto = true;

  const errors = brandNameDecisionContractErrors(broken);
  assert.ok(errors.includes("criterion weights must total 100"));
  assert.ok(
    errors.includes(
      "owner preference must be non-veto and capped at five percent",
    ),
  );
  assert.ok(errors.includes("personal dislike safeguard is missing"));
  assert.ok(errors.includes("owner preference decision safeguards drifted"));
});

test("seeded removal of registry and professional-review evidence fails", () => {
  const broken = cloneContract();
  const legal = broken.criteria.find(
    ({ id }) => id === "trademark_and_confusion_risk",
  )!;
  legal.veto = false;
  legal.acceptedEvidence = ["A general web search.", "Owner intuition."];

  const errors = brandNameDecisionContractErrors(broken);
  assert.ok(errors.includes("trademark/confusion risk must be a veto"));
  assert.ok(
    errors.includes(
      "trademark/confusion risk must require official registry evidence",
    ),
  );
  assert.ok(
    errors.includes(
      "trademark/confusion risk must require professional legal review",
    ),
  );
});

test("personal preference alone cannot trigger a rename", () => {
  const current = assessment("current", {
    scores: {
      ...assessment("current").scores,
      owner_preference: 0,
    },
  });
  const preferredReplacement = assessment("replacement-a", {
    scores: {
      ...assessment("replacement-a").scores,
      owner_preference: 4,
    },
  });

  assert.deepEqual(decideBrandName(current, [preferredReplacement]), {
    outcome: "keep",
    selectedCandidateId: "current",
    reason:
      "The current name is eligible and no replacement meets the material evidence-based rename rule.",
  });
});

test("an evidence-based replacement can win across multiple criteria", () => {
  const current = assessment("current", {
    scores: {
      ...assessment("current").scores,
      trademark_and_confusion_risk: 2,
      domain_and_social_availability: 2,
      pronunciation_and_searchability: 2,
      semantic_and_mission_fit: 2,
      geographic_and_cultural_neutrality: 2,
      distinctiveness_and_memorability: 2,
      migration_cost_and_continuity: 2,
    },
  });
  const replacement = assessment("replacement-b", {
    scores: {
      ...assessment("replacement-b").scores,
      trademark_and_confusion_risk: 4,
      domain_and_social_availability: 4,
      pronunciation_and_searchability: 4,
      semantic_and_mission_fit: 4,
      geographic_and_cultural_neutrality: 3,
      distinctiveness_and_memorability: 4,
      migration_cost_and_continuity: 3,
    },
  });

  const result = decideBrandName(current, [replacement]);
  assert.equal(result.outcome, "rename");
  assert.equal(result.selectedCandidateId, "replacement-b");
});

test("missing evidence or legal review always records no decision", () => {
  const current = assessment("current", {
    professionalLegalState: "pending",
  });
  assert.equal(decideBrandName(current, []).outcome, "insufficient_evidence");

  const incompleteReplacement = assessment("replacement-c", {
    evidenceComplete: false,
  });
  assert.equal(
    decideBrandName(assessment("current"), [incompleteReplacement]).outcome,
    "insufficient_evidence",
  );
});

test("a current-name veto cannot select an uncleared or ineligible replacement", () => {
  const current = assessment("current", { legalRiskVeto: true });
  const uncleared = assessment("replacement-d", {
    professionalLegalState: "not_cleared",
  });
  assert.equal(
    decideBrandName(current, [uncleared]).outcome,
    "insufficient_evidence",
  );
});
