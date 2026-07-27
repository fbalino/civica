import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GOVERNANCE_EVIDENCE_REVIEW_PACKET,
  REVIEW_PACKET_REQUIRED_SECTIONS,
  governanceEvidenceReviewPacketErrors,
} from "./governance-evidence-review-packet";

test("selected-product review packet closes every required section", () => {
  assert.deepEqual(governanceEvidenceReviewPacketErrors(), []);
  assert.equal(REVIEW_PACKET_REQUIRED_SECTIONS.length, 14);
  assert.equal(GOVERNANCE_EVIDENCE_REVIEW_PACKET.seriesProvenance.seriesType, "harmonized_backcast");
  assert.equal(GOVERNANCE_EVIDENCE_REVIEW_PACKET.selectedProduct, "source_native_dashboard_only");
  assert.equal(GOVERNANCE_EVIDENCE_REVIEW_PACKET.codebook.length, 5);
  assert.equal(GOVERNANCE_EVIDENCE_REVIEW_PACKET.reviewerTerms.favorableConclusionRequired, false);
});

test("review packet refuses aggregation, incomplete fidelity, and implied endorsement", () => {
  const aggregated = structuredClone(GOVERNANCE_EVIDENCE_REVIEW_PACKET) as {
    transformations: { aggregation: string };
  };
  aggregated.transformations.aggregation = "weighted mean";
  assert.ok(governanceEvidenceReviewPacketErrors(aggregated as unknown as typeof GOVERNANCE_EVIDENCE_REVIEW_PACKET).includes("selected product gained an aggregation"));

  const incomplete = structuredClone(GOVERNANCE_EVIDENCE_REVIEW_PACKET) as {
    validation: { exactSourceFileCells: { passed: number } };
  };
  incomplete.validation.exactSourceFileCells.passed = 969;
  assert.ok(governanceEvidenceReviewPacketErrors(incomplete as unknown as typeof GOVERNANCE_EVIDENCE_REVIEW_PACKET).includes("source-file fidelity is incomplete"));

  const endorsed = structuredClone(GOVERNANCE_EVIDENCE_REVIEW_PACKET) as {
    reviewerTerms: { publicEndorsementImplied: boolean };
  };
  endorsed.reviewerTerms.publicEndorsementImplied = true;
  assert.ok(governanceEvidenceReviewPacketErrors(endorsed as unknown as typeof GOVERNANCE_EVIDENCE_REVIEW_PACKET).includes("reviewer independence terms are invalid"));
});

test("review packet makes no Civica score, grade, rank, or independent-validation claim", () => {
  const text = JSON.stringify(GOVERNANCE_EVIDENCE_REVIEW_PACKET).toLowerCase();
  assert.ok(text.includes("no composite, grade, rank"));
  assert.ok(!text.includes('"winnerselected":true'));
  assert.ok(!text.includes("independently validated"));
});
