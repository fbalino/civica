import type { SeverityTier } from "./types";

export const PULSE_REVIEW_SLA_VERSION = "pulse-review-sla/v1" as const;

export const PULSE_REVIEW_PRIORITIES = [
  "critical",
  "urgent",
  "standard",
] as const;
export type PulseReviewPriority = (typeof PULSE_REVIEW_PRIORITIES)[number];

export const PULSE_REVIEW_OBLIGATION_STATES = [
  "open",
  "claimed",
  "dispositioned",
  "legacy_quarantined",
] as const;
export type PulseReviewObligationState =
  (typeof PULSE_REVIEW_OBLIGATION_STATES)[number];

export const PULSE_REVIEW_COMPLIANCE_STATES = [
  "within_sla",
  "escalation_due",
  "breached_unexcepted",
  "breached_excepted",
  "dispositioned_on_time",
  "dispositioned_late",
  "legacy_quarantined",
] as const;
export type PulseReviewComplianceState =
  (typeof PULSE_REVIEW_COMPLIANCE_STATES)[number];

export const PULSE_REVIEW_HEALTH_STATES = [
  "complete",
  "current_reviews_pending",
  "incomplete_review_sla",
  "not_assessable",
] as const;
export type PulseReviewHealthState =
  (typeof PULSE_REVIEW_HEALTH_STATES)[number];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface PulseReviewSlaTarget {
  escalationAfterMs: number;
  dueAfterMs: number;
}

export const PULSE_REVIEW_SLA_TARGETS = {
  critical: { escalationAfterMs: 0, dueAfterMs: DAY_MS },
  urgent: { escalationAfterMs: DAY_MS, dueAfterMs: 3 * DAY_MS },
  standard: { escalationAfterMs: 5 * DAY_MS, dueAfterMs: 7 * DAY_MS },
} as const satisfies Record<PulseReviewPriority, PulseReviewSlaTarget>;

export const PULSE_REVIEW_PRIORITY_BY_SEVERITY = {
  low_pos: "standard",
  moderate_pos: "standard",
  high_pos: "urgent",
  low_neg: "standard",
  moderate_neg: "standard",
  severe_neg: "urgent",
  catastrophic_neg: "critical",
} as const satisfies Record<SeverityTier, PulseReviewPriority>;

export function reviewPriorityForSeverity(
  severityTier: SeverityTier | null | undefined,
): PulseReviewPriority {
  return severityTier
    ? PULSE_REVIEW_PRIORITY_BY_SEVERITY[severityTier]
    : "standard";
}

/** Queue reasons without a classified severity remain reviewable at standard priority. */
export function reviewPriorityForQueueItem(input: {
  severityTier?: SeverityTier | null;
  reason?: string | null;
}): PulseReviewPriority {
  return reviewPriorityForSeverity(input.severityTier);
}

function utcInstant(value: string, name: string): number {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error(`${name} must include a UTC offset`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${name} must be valid`);
  return timestamp;
}

function utcIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export interface PulseReviewDeadlines {
  priority: PulseReviewPriority;
  queuedAt: string;
  escalationAt: string;
  dueAt: string;
}

export function pulseReviewDeadlines(input: {
  priority: PulseReviewPriority;
  queuedAt: string;
}): PulseReviewDeadlines {
  const queuedAt = utcInstant(input.queuedAt, "queuedAt");
  const target = PULSE_REVIEW_SLA_TARGETS[input.priority];
  return {
    priority: input.priority,
    queuedAt: utcIso(queuedAt),
    escalationAt: utcIso(queuedAt + target.escalationAfterMs),
    dueAt: utcIso(queuedAt + target.dueAfterMs),
  };
}

export interface PulseReviewObligation {
  state: PulseReviewObligationState;
  priority: PulseReviewPriority;
  queuedAt: string;
  dispositionedAt?: string | null;
  exceptionRecorded?: boolean;
}

export interface PulseReviewCompliance {
  state: PulseReviewComplianceState;
  escalationAt: string | null;
  dueAt: string | null;
  exceptionRecorded: boolean;
  dailyCompletenessEligible: boolean;
}

/**
 * Derives SLA compliance using half-open time windows. The due instant is the
 * first breached instant; a disposition at that exact instant is late.
 */
export function derivePulseReviewCompliance(input: {
  obligation: PulseReviewObligation;
  now: string;
}): PulseReviewCompliance {
  const exceptionRecorded = input.obligation.exceptionRecorded === true;
  if (input.obligation.state === "legacy_quarantined") {
    return {
      state: "legacy_quarantined",
      escalationAt: null,
      dueAt: null,
      exceptionRecorded,
      dailyCompletenessEligible: false,
    };
  }

  const deadlines = pulseReviewDeadlines(input.obligation);
  const dueAt = utcInstant(deadlines.dueAt, "dueAt");

  if (input.obligation.state === "dispositioned") {
    if (!input.obligation.dispositionedAt) {
      throw new Error("dispositioned obligations require dispositionedAt");
    }
    const dispositionedAt = utcInstant(
      input.obligation.dispositionedAt,
      "dispositionedAt",
    );
    const onTime = dispositionedAt < dueAt;
    return {
      state: onTime ? "dispositioned_on_time" : "dispositioned_late",
      escalationAt: deadlines.escalationAt,
      dueAt: deadlines.dueAt,
      exceptionRecorded,
      dailyCompletenessEligible: onTime,
    };
  }

  if (input.obligation.dispositionedAt) {
    throw new Error("only dispositioned obligations may have dispositionedAt");
  }
  const now = utcInstant(input.now, "now");
  if (now >= dueAt) {
    return {
      state: exceptionRecorded ? "breached_excepted" : "breached_unexcepted",
      escalationAt: deadlines.escalationAt,
      dueAt: deadlines.dueAt,
      exceptionRecorded,
      dailyCompletenessEligible: false,
    };
  }
  const escalationAt = utcInstant(deadlines.escalationAt, "escalationAt");
  return {
    state: now >= escalationAt ? "escalation_due" : "within_sla",
    escalationAt: deadlines.escalationAt,
    dueAt: deadlines.dueAt,
    exceptionRecorded,
    dailyCompletenessEligible: true,
  };
}

export interface PulseReviewHealth {
  state: PulseReviewHealthState;
  dailyCompletenessEligible: boolean;
}

/** Aggregates a fully enumerated daily review population. */
export function aggregatePulseReviewHealth(input: {
  complianceStates: readonly PulseReviewComplianceState[];
  populationKnown: boolean;
}): PulseReviewHealth {
  if (
    !input.populationKnown ||
    input.complianceStates.includes("legacy_quarantined")
  ) {
    return { state: "not_assessable", dailyCompletenessEligible: false };
  }
  if (
    input.complianceStates.some((state) =>
      [
        "breached_unexcepted",
        "breached_excepted",
        "dispositioned_late",
      ].includes(state),
    )
  ) {
    return { state: "incomplete_review_sla", dailyCompletenessEligible: false };
  }
  if (
    input.complianceStates.some(
      (state) => state === "within_sla" || state === "escalation_due",
    )
  ) {
    return {
      state: "current_reviews_pending",
      dailyCompletenessEligible: true,
    };
  }
  return { state: "complete", dailyCompletenessEligible: true };
}
