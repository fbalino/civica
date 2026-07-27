/**
 * Closed scoring lifecycle for Pulse event projections.
 *
 * A score is an event ledger projection, not a hidden state estimate. The
 * rules below deliberately prevent an old event from becoming an inferred
 * continuing condition merely because time has passed.
 */

export const PULSE_EVENT_LIFECYCLE_VERSION =
  "pulse-event-lifecycle/v1" as const;

export const PULSE_SCORE_WINDOW_BOUNDARY =
  "inclusive_maximum_configured_half_life_days_future_excluded" as const;

export const PULSE_SCORE_EVENT_LIFECYCLE_POLICY = {
  version: PULSE_EVENT_LIFECYCLE_VERSION,
  supersession:
    "current_projection_only_with_retained_superseded_history",
  persistence:
    "never_inferred_from_an_earlier_event_or_extended_without_new_evidence",
  recurrence:
    "separately_accepted_later_event_with_its_own_date_and_incident",
} as const;

export interface ScoreLifecycleEvent {
  projectionStatus: "current" | "superseded_duplicate" | "quarantined_invalid";
  published: boolean;
  reviewStatus: "pending" | "approved" | "rejected" | "edited";
  category: string;
}

/**
 * Mirrors the SQL loader as a pure fail-closed guard for fixtures, replay, and
 * any future caller that supplies preloaded events.
 */
export function isScoreableEventLifecycle(
  event: ScoreLifecycleEvent,
): boolean {
  return (
    event.projectionStatus === "current" &&
    event.published &&
    (event.reviewStatus === "approved" || event.reviewStatus === "edited") &&
    event.category !== "none"
  );
}
