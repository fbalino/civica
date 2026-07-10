import assert from "node:assert/strict";
import test from "node:test";

import {
  isPulseClassificationValid,
  publicationOriginFor,
  validatePulseClassification,
} from "./review-validation";

test("accepts a taxonomy-consistent classification", () => {
  const result = validatePulseClassification({
    category: "fair_election",
    dimension: "democratic_quality",
    severityTier: "moderate_pos",
    severityValue: 3,
  });

  assert.equal(result.valid, true);
});

test("rejects unresolved category=none before publication or scoring", () => {
  const result = validatePulseClassification({
    category: "none",
    dimension: "stability",
    severityTier: "moderate_neg",
    severityValue: -3,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /cannot be published as-is/i);
});

test("rejects a dimension that does not belong to the category", () => {
  assert.equal(
    isPulseClassificationValid({
      category: "fair_election",
      dimension: "stability",
      severityTier: "moderate_pos",
      severityValue: 3,
    }),
    false,
  );
});

test("rejects a severity tier that the category does not allow", () => {
  assert.equal(
    isPulseClassificationValid({
      category: "fair_election",
      dimension: "democratic_quality",
      severityTier: "moderate_neg",
      severityValue: -3,
    }),
    false,
  );
});

test("rejects severity values outside the selected tier", () => {
  assert.equal(
    isPulseClassificationValid({
      category: "fair_election",
      dimension: "democratic_quality",
      severityTier: "moderate_pos",
      severityValue: 6,
    }),
    false,
  );
});

test("rejects non-integer severity values", () => {
  assert.equal(
    isPulseClassificationValid({
      category: "fair_election",
      dimension: "democratic_quality",
      severityTier: "moderate_pos",
      severityValue: 3.5,
    }),
    false,
  );
});

test("publication origin distinguishes every review outcome", () => {
  assert.equal(
    publicationOriginFor({
      published: true,
      humanReviewed: false,
      reviewStatus: "approved",
    }),
    "auto",
  );
  assert.equal(
    publicationOriginFor({
      published: true,
      humanReviewed: true,
      reviewStatus: "approved",
    }),
    "human_approved",
  );
  assert.equal(
    publicationOriginFor({
      published: true,
      humanReviewed: true,
      reviewStatus: "edited",
    }),
    "human_edited",
  );
  assert.equal(
    publicationOriginFor({
      published: false,
      humanReviewed: false,
      reviewStatus: "pending",
    }),
    "queued",
  );
  assert.equal(
    publicationOriginFor({
      published: false,
      humanReviewed: true,
      reviewStatus: "rejected",
    }),
    "human_rejected",
  );
  assert.equal(
    publicationOriginFor({
      published: false,
      humanReviewed: false,
      reviewStatus: "rejected",
    }),
    "legacy_rejected_unverified",
  );
});
