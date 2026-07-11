import type { PulseFeedCoverage } from "./source-coverage";

export const PULSE_OBSERVABILITY_VERSION =
  "pulse-observability/country-period-v1" as const;

export const PULSE_OBSERVATION_STATES = [
  "sufficient_observation",
  "low_coverage",
  "source_outage",
  "restricted_information_environment",
] as const;

export type PulseObservationState = (typeof PULSE_OBSERVATION_STATES)[number];

export const PULSE_EVENT_OBSERVATION_STATES = [
  "qualifying_event_observed",
  "no_qualifying_event_observed",
  "not_assessable",
] as const;

export type PulseEventObservationState =
  (typeof PULSE_EVENT_OBSERVATION_STATES)[number];

export const PULSE_OBSERVABILITY_THRESHOLDS = Object.freeze({
  minimumObservedFeedFamilies: 2,
  minimumRetainedDocuments: 5,
});

export interface PulseInformationEnvironmentContext {
  state: "restricted";
  sourceId: string;
  sourceUrl: string;
  upstreamVersion: string;
  observationYear: number;
  retrievedAt: string;
}

export interface PulseCountryPeriodSourceCount {
  sourceId: string;
  retainedDocuments: number;
}

export interface PulseCountryPeriodObservability {
  schemaVersion: typeof PULSE_OBSERVABILITY_VERSION;
  period: {
    start: string;
    end: string;
    basis: "retrieval_time";
  };
  observationState: PulseObservationState;
  eventObservation: PulseEventObservationState;
  stateReason: string;
  evidence: {
    operatingFeeds: number;
    degradedFeeds: number;
    observedFeedFamilies: string[];
    retainedDocuments: number;
    qualifyingEvents: number;
    informationEnvironment: PulseInformationEnvironmentContext | null;
  };
  thresholds: typeof PULSE_OBSERVABILITY_THRESHOLDS;
  numericEffect: "event_evidence_only" | "withheld";
  countryQualityInference: "prohibited";
  limitations: string[];
}

export interface PulseCountryPeriodObservabilityInput {
  periodStart: string;
  periodEnd: string;
  feeds: readonly PulseFeedCoverage[];
  sourceCounts: readonly PulseCountryPeriodSourceCount[];
  qualifyingEvents: number;
  informationEnvironment?: PulseInformationEnvironmentContext | null;
}

function assertDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be an ISO calendar date`);
  }
}

function validateInput(input: PulseCountryPeriodObservabilityInput): void {
  assertDate(input.periodStart, "periodStart");
  assertDate(input.periodEnd, "periodEnd");
  if (input.periodStart > input.periodEnd) {
    throw new Error("observability period start is after its end");
  }
  if (!Number.isInteger(input.qualifyingEvents) || input.qualifyingEvents < 0) {
    throw new Error("qualifyingEvents must be a non-negative integer");
  }
  const sourceIds = new Set<string>();
  for (const row of input.sourceCounts) {
    if (!row.sourceId.trim()) throw new Error("source count has a blank id");
    if (!Number.isInteger(row.retainedDocuments) || row.retainedDocuments < 0) {
      throw new Error(`invalid retained-document count for ${row.sourceId}`);
    }
    if (sourceIds.has(row.sourceId)) {
      throw new Error(`duplicate source count: ${row.sourceId}`);
    }
    sourceIds.add(row.sourceId);
  }
}

export function buildPulseCountryPeriodObservability(
  input: PulseCountryPeriodObservabilityInput,
): PulseCountryPeriodObservability {
  validateInput(input);
  const operating = input.feeds.filter(({ state }) => state === "operating");
  const degraded = input.feeds.filter(({ state }) => state === "degraded");
  const countBySource = new Map(
    input.sourceCounts.map(({ sourceId, retainedDocuments }) => [
      sourceId,
      retainedDocuments,
    ]),
  );
  const observedFeedFamilies = operating
    .filter((feed) =>
      feed.sourceIds.some((sourceId) => (countBySource.get(sourceId) ?? 0) > 0),
    )
    .map(({ feedId }) => feedId)
    .sort();
  const operatingSourceIds = new Set(
    operating.flatMap(({ sourceIds }) => sourceIds),
  );
  const retainedDocuments = input.sourceCounts.reduce(
    (sum, row) =>
      sum + (operatingSourceIds.has(row.sourceId) ? row.retainedDocuments : 0),
    0,
  );
  const informationEnvironment = input.informationEnvironment ?? null;

  let observationState: PulseObservationState;
  let stateReason: string;
  if (
    operating.length === 0 &&
    degraded.some(({ retrieval }) => retrieval.latestOutcome === "failed")
  ) {
    observationState = "source_outage";
    stateReason =
      "No feed is currently operating and at least one observed connector failed its latest retrieval.";
  } else if (informationEnvironment?.state === "restricted") {
    observationState = "restricted_information_environment";
    stateReason =
      "A sourced, versioned context record identifies a restricted information environment; missing reports cannot establish event absence.";
  } else if (
    observedFeedFamilies.length <
      PULSE_OBSERVABILITY_THRESHOLDS.minimumObservedFeedFamilies ||
    retainedDocuments < PULSE_OBSERVABILITY_THRESHOLDS.minimumRetainedDocuments
  ) {
    observationState = "low_coverage";
    stateReason =
      "Retained country-period evidence does not meet the operational feed-family and document thresholds for a no-event statement.";
  } else {
    observationState = "sufficient_observation";
    stateReason =
      "Retained country-period evidence meets the declared operational threshold for distinguishing no qualifying event observed from low coverage.";
  }

  const eventObservation: PulseEventObservationState =
    input.qualifyingEvents > 0
      ? "qualifying_event_observed"
      : observationState === "sufficient_observation"
        ? "no_qualifying_event_observed"
        : "not_assessable";

  return {
    schemaVersion: PULSE_OBSERVABILITY_VERSION,
    period: {
      start: input.periodStart,
      end: input.periodEnd,
      basis: "retrieval_time",
    },
    observationState,
    eventObservation,
    stateReason,
    evidence: {
      operatingFeeds: operating.length,
      degradedFeeds: degraded.length,
      observedFeedFamilies,
      retainedDocuments,
      qualifyingEvents: input.qualifyingEvents,
      informationEnvironment,
    },
    thresholds: PULSE_OBSERVABILITY_THRESHOLDS,
    numericEffect:
      input.qualifyingEvents > 0 ? "event_evidence_only" : "withheld",
    countryQualityInference: "prohibited",
    limitations: [
      "The threshold is an operational disclosure rule, not a validated estimate of retrieval recall.",
      "No qualifying event observed is not evidence of stability, good governance, or country quality.",
      "Restricted-information status requires a sourced context record; an approximate or default score cannot create it.",
    ],
  };
}
