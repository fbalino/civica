/**
 * Cross-model ensemble consensus for the Pulse classify pass.
 *
 * Owner decision (2026-07-05,
 * `plan/pulse-ensemble-classifier-implementation-2026-07-05.md`): the paid
 * classify pass runs ONE classify call per independent vendor engine
 * (DeepSeek, GLM, Anthropic Haiku by default), so classification errors are
 * uncorrelated — unlike the retired same-model 3-temperature scheme, which
 * only measured one model's decoding randomness. Confidence is now measured
 * by AGREEMENT across those heterogeneous models.
 *
 * This module is pure: it takes the parsed classify outputs of the engines
 * that returned successfully and computes the consensus. It performs no I/O,
 * so the eval script and production share identical consensus semantics and
 * it is trivially testable.
 *
 * Consensus rules:
 *   - Category  — strict majority (> half of successful voters). 3/3 → "all";
 *     a majority short of unanimous → "two_of_three"; no majority → "none"
 *     (routes to human review, published=false).
 *   - Severity tier — majority among the runs that voted the winning
 *     category; ties broken toward the MORE SEVERE tier (conservative).
 *   - severityValue — median of the winning-category runs (clamped to the
 *     winning tier's range by the caller).
 *   - runner_up + self-confidence — from the winning-category run with the
 *     highest self-confidence.
 *
 * Degraded mode: when one engine errors, `Promise.allSettled` in the caller
 * still yields the survivors and passes them here. With 2 survivors that agree,
 * the label caps at "two_of_three" (a run that lost a voter never claims the
 * unanimous "all"); a split is "none". With <2 survivors there is no quorum —
 * the caller routes to review. `voterCount`/`agreeingCount`/`degraded` are
 * returned so the caller can record the degradation.
 */

import { SEVERITY_TIER_RANGES } from "./taxonomy";
import type { ClassifierAgreement, SeverityTier } from "./types";
import type { ClassifyResultLite } from "./classifier-prompt";
import type { ResolvedProviderConfig } from "./provider";

/** One engine's successful classify output, tagged with which engine ran it. */
export interface EnsembleRun {
  config: ResolvedProviderConfig;
  result: ClassifyResultLite;
}

export interface EnsembleConsensus {
  /** Winning category, or "none" when no strict majority was reached. */
  category: string;
  runnerUp: string;
  severityTier: SeverityTier;
  /** Median severity of the winning-category runs (unclamped — caller clamps
   *  to the tier range). */
  severityValue: number;
  /** Highest self-confidence among the winning-category runs. */
  selfConfidence: number;
  /** Persisted agreement label: "all" (unanimous), "two_of_three" (majority
   *  short of unanimous), or "none" (no majority / no quorum). */
  agreement: ClassifierAgreement;
  /** Engines that returned a usable classification (the quorum denominator). */
  voterCount: number;
  /** Engines that agreed on the winning category. */
  agreeingCount: number;
  /** True when fewer engines returned than were configured (an engine erred
   *  or produced an unparseable answer). */
  degraded: boolean;
}

/**
 * "More severe" ordinal for tie-breaking. Higher = more severe / more
 * consequential. Negative tiers outrank positive ones of equal step so a
 * pos/neg tie resolves conservatively to the negative (worse) reading.
 */
const TIER_SEVERITY_ORDINAL: Record<SeverityTier, number> = {
  low_pos: 1,
  moderate_pos: 2,
  high_pos: 3,
  low_neg: 4,
  moderate_neg: 5,
  severe_neg: 6,
  catastrophic_neg: 7,
};

/**
 * Map a vote outcome to the persisted agreement label. "all" (unanimous)
 * requires BOTH a unanimous vote AND a full, non-degraded voter panel — a run
 * that lost a voter to an error never claims unanimity (it caps at
 * "two_of_three"), keeping the published-confidence signal honest.
 */
function agreementLabel(
  agreeingCount: number,
  voterCount: number,
  degraded: boolean
): ClassifierAgreement {
  return agreeingCount === voterCount && !degraded ? "all" : "two_of_three";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute the ensemble consensus over the engines that returned a usable
 * (non-"none") classification. Runs that returned category "none" are counted
 * as voters (a valid vote for "not a governance event") but "none" can itself
 * win the majority, in which case the caller drops the cluster.
 *
 * `configuredCount` is the number of engines the caller attempted, used only
 * to flag degradation when fewer returned.
 */
export function computeConsensus(
  runs: EnsembleRun[],
  configuredCount: number
): EnsembleConsensus {
  const voterCount = runs.length;
  const degraded = voterCount < configuredCount;

  // No quorum: need at least 2 engines to form a cross-model majority.
  if (voterCount < 2) {
    const only = runs[0]?.result;
    return {
      category: only?.category ?? "none",
      runnerUp: only?.runnerUp ?? "none",
      severityTier: only?.severityTier ?? "low_neg",
      severityValue: only?.severityValue ?? 0,
      selfConfidence: only?.selfConfidence ?? 0,
      agreement: "none",
      voterCount,
      agreeingCount: voterCount,
      degraded,
    };
  }

  // --- Category vote (strict majority of voters, "none" included) ---
  const catVotes = new Map<string, number>();
  for (const r of runs) {
    catVotes.set(r.result.category, (catVotes.get(r.result.category) ?? 0) + 1);
  }
  let winningCategory = "none";
  let winningCount = 0;
  for (const [cat, count] of catVotes) {
    if (count > winningCount) {
      winningCount = count;
      winningCategory = cat;
    }
  }
  const hasMajority = winningCount > voterCount / 2;

  if (!hasMajority) {
    // Deadlock — no category cleared > half the voters. Route to review.
    // Surface the plurality run's fields for the audit record.
    const plurality =
      runs.find((r) => r.result.category === winningCategory)?.result ??
      runs[0].result;
    return {
      category: "none",
      runnerUp: plurality.runnerUp,
      severityTier: plurality.severityTier,
      severityValue: plurality.severityValue,
      selfConfidence: plurality.selfConfidence,
      agreement: "none",
      voterCount,
      agreeingCount: winningCount,
      degraded,
    };
  }

  // If the majority verdict is "not a governance event", that IS the
  // consensus — the caller drops the cluster.
  if (winningCategory === "none") {
    return {
      category: "none",
      runnerUp: "none",
      severityTier: "low_neg",
      severityValue: 0,
      selfConfidence: 0,
      agreement: agreementLabel(winningCount, voterCount, degraded),
      voterCount,
      agreeingCount: winningCount,
      degraded,
    };
  }

  const agreeing = runs.filter((r) => r.result.category === winningCategory);

  // --- Severity tier vote among winning-category runs (tie → more severe) ---
  const tierVotes = new Map<SeverityTier, number>();
  for (const r of agreeing) {
    tierVotes.set(
      r.result.severityTier,
      (tierVotes.get(r.result.severityTier) ?? 0) + 1
    );
  }
  let winningTier: SeverityTier = agreeing[0].result.severityTier;
  let winningTierCount = -1;
  for (const [tier, count] of tierVotes) {
    if (
      count > winningTierCount ||
      (count === winningTierCount &&
        TIER_SEVERITY_ORDINAL[tier] > TIER_SEVERITY_ORDINAL[winningTier])
    ) {
      winningTierCount = count;
      winningTier = tier;
    }
  }

  // --- severityValue: median of the agreeing runs (unclamped) ---
  const severityValue = median(agreeing.map((r) => r.result.severityValue));

  // --- runner_up + self-confidence: from the most-confident agreeing run ---
  const mostConfident = agreeing.reduce((best, r) =>
    r.result.selfConfidence > best.result.selfConfidence ? r : best
  );

  return {
    category: winningCategory,
    runnerUp: mostConfident.result.runnerUp,
    severityTier: winningTier,
    severityValue,
    selfConfidence: mostConfident.result.selfConfidence,
    agreement: agreementLabel(winningCount, voterCount, degraded),
    voterCount,
    agreeingCount: winningCount,
    degraded,
  };
}

/** Clamp a severity value into a tier's numeric range (rounding to int). */
export function clampSeverityToTier(
  value: number,
  tier: SeverityTier
): number {
  const range = SEVERITY_TIER_RANGES[tier];
  return Math.max(range.min, Math.min(range.max, Math.round(value)));
}
