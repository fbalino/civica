import {
  EVENT_CATEGORY_INDEX,
  SEVERITY_TIER_RANGES,
} from "./taxonomy";
import type { PulseDimension, SeverityTier } from "./types";

export interface PulseClassificationFields {
  category: string;
  dimension: string;
  severityTier: string;
  severityValue: number;
}

export type PulsePublicationOrigin =
  | "auto"
  | "human_approved"
  | "human_edited"
  | "human_rejected"
  | "legacy_rejected_unverified"
  | "legacy_quarantined"
  | "queued";

export function publicationOriginFor(state: {
  published: boolean;
  humanReviewed: boolean;
  reviewStatus: string;
}): PulsePublicationOrigin {
  if (!state.published) {
    if (state.reviewStatus === "legacy_quarantined") {
      return "legacy_quarantined";
    }
    if (state.reviewStatus !== "rejected") return "queued";
    return state.humanReviewed
      ? "human_rejected"
      : "legacy_rejected_unverified";
  }
  if (!state.humanReviewed) return "auto";
  return state.reviewStatus === "edited" ? "human_edited" : "human_approved";
}

export type PulseClassificationValidation =
  | {
      valid: true;
      classification: {
        category: string;
        dimension: PulseDimension;
        severityTier: SeverityTier;
        severityValue: number;
      };
    }
  | { valid: false; error: string };

/**
 * Validate a classification before a human review can publish it or the
 * scorer can consume it. In particular, `category="none"` is an unresolved
 * classifier outcome, never a substantive Stability event.
 */
export function validatePulseClassification(
  fields: PulseClassificationFields,
): PulseClassificationValidation {
  if (fields.category === "none") {
    return {
      valid: false,
      error:
        "Unresolved classifications cannot be published as-is. Choose a taxonomy category, dimension, severity tier, and severity value before approval.",
    };
  }

  const category = EVENT_CATEGORY_INDEX[fields.category];
  if (!category) {
    return { valid: false, error: "Unknown Pulse taxonomy category." };
  }
  if (fields.dimension !== category.dimension) {
    return {
      valid: false,
      error: `Dimension must be ${category.dimension} for ${category.id}.`,
    };
  }

  const severityTier = fields.severityTier as SeverityTier;
  const range = SEVERITY_TIER_RANGES[severityTier];
  if (!range || !category.allowedTiers.includes(severityTier)) {
    return {
      valid: false,
      error: `Severity tier ${fields.severityTier} is not allowed for ${category.id}.`,
    };
  }
  if (!Number.isInteger(fields.severityValue)) {
    return { valid: false, error: "Severity value must be a whole number." };
  }
  if (
    fields.severityValue < range.min ||
    fields.severityValue > range.max
  ) {
    return {
      valid: false,
      error: `Severity value must be between ${range.min} and ${range.max} for ${severityTier}.`,
    };
  }

  return {
    valid: true,
    classification: {
      category: category.id,
      dimension: category.dimension,
      severityTier,
      severityValue: fields.severityValue,
    },
  };
}

export function isPulseClassificationValid(
  fields: PulseClassificationFields,
): boolean {
  return validatePulseClassification(fields).valid;
}
