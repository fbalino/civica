/**
 * Pure publication-gate helpers for the Pulse ensemble path.
 *
 * Keeping the boolean policy here makes every verifier objection explicit
 * and lets the safety boundary be tested without provider or database I/O.
 */

import { HUMAN_REVIEW_TIERS } from "./taxonomy";
import type { VerifyResultLite } from "./classifier-prompt";
import type { ClassifierAgreement, SeverityTier } from "./types";

export const PULSE_PUBLICATION_GATE_VERSION =
  "pulse-publication-gate/stored-ensemble-review-v3" as const;

export interface EnsembleGateConsensus {
  agreement: ClassifierAgreement;
  selfConfidence: number;
  degraded: boolean;
  severityTier: SeverityTier;
}

/** Preserve audit detail while making an invalid category publicly unresolved. */
export function normalizeInvalidConsensusForReview<
  T extends { category: string; runnerUp: string },
>(consensus: T): T {
  return {
    ...consensus,
    category: "none",
    runnerUp: consensus.category,
  };
}

/** A failed pass and every explicit negative verifier signal are objections. */
export function verifierObjects(verify: VerifyResultLite | null): boolean {
  return (
    verify == null ||
    verify.confidence === "low" ||
    verify.verdict === "revised" ||
    verify.verdict === "rejected" ||
    !verify.categoryOk ||
    !verify.severityOk ||
    !verify.subjectOk ||
    !verify.isEvent
  );
}

/** Single-engine mode has no ensemble consensus to outweigh an objection. */
export function singleEngineRequiresReview(
  _severityTier: SeverityTier,
  _verify: VerifyResultLite | null,
): boolean {
  return true;
}

/** Apply the documented ensemble review gate to a classified candidate. */
export function ensembleRequiresReview(
  consensus: EnsembleGateConsensus,
  verify: VerifyResultLite | null,
  opts: { forceReview: boolean; verifySkipped: boolean },
): boolean {
  const weakConsensus =
    consensus.agreement !== "all" &&
    (consensus.selfConfidence < 0.7 || consensus.degraded);
  const verifierObjection =
    !opts.verifySkipped && verifierObjects(verify);

  return (
    opts.forceReview ||
    HUMAN_REVIEW_TIERS.has(consensus.severityTier) ||
    (verifierObjection && weakConsensus)
  );
}
