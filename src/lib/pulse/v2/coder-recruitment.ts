import { PULSE_EVALUATION_SAMPLING_PROTOCOL } from "./evaluation-sampling";

export const PULSE_CODER_RECRUITMENT_VERSION =
  "pulse-independent-coder-recruitment/v1" as const;

export const PULSE_CODER_STAFFING = Object.freeze({
  coders: 4,
  adjudicators: 2,
  administrator: 1,
  samePacketRoleOverlapAllowed: false,
  ownerMayCodeOrAdjudicate: false,
  productionContributorMayCodeOrAdjudicate: false,
});

export const PULSE_CODER_WORKLOAD_SCENARIOS = Object.freeze([
  {
    id: "low",
    minutesPerPacket: {
      retained_event_candidate_census: 8,
      system_negative_probability: 6,
      country_day_retrieval_probability: 12,
    },
    disagreementRate: 0.15,
    adjudicationMinutes: 10,
    coderTrainingHoursEach: 4,
    adjudicatorTrainingHoursEach: 3,
    managementFraction: 0.15,
    hourlyRatesUsd: { coder: 25, adjudicator: 40, administrator: 35 },
    budgetContingency: 0.1,
  },
  {
    id: "base",
    minutesPerPacket: {
      retained_event_candidate_census: 12,
      system_negative_probability: 10,
      country_day_retrieval_probability: 18,
    },
    disagreementRate: 0.25,
    adjudicationMinutes: 15,
    coderTrainingHoursEach: 6,
    adjudicatorTrainingHoursEach: 5,
    managementFraction: 0.2,
    hourlyRatesUsd: { coder: 40, adjudicator: 65, administrator: 50 },
    budgetContingency: 0.1,
  },
  {
    id: "high",
    minutesPerPacket: {
      retained_event_candidate_census: 18,
      system_negative_probability: 15,
      country_day_retrieval_probability: 25,
    },
    disagreementRate: 0.35,
    adjudicationMinutes: 20,
    coderTrainingHoursEach: 8,
    adjudicatorTrainingHoursEach: 6,
    managementFraction: 0.25,
    hourlyRatesUsd: { coder: 60, adjudicator: 90, administrator: 70 },
    budgetContingency: 0.1,
  },
] as const);

type WorkloadScenario = (typeof PULSE_CODER_WORKLOAD_SCENARIOS)[number];

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}

export function pulseCoderFrameCounts() {
  const frames = PULSE_EVALUATION_SAMPLING_PROTOCOL.frames.map((frame) => ({
    id: frame.id,
    initialUnits: frame.initialDraw,
    validTarget: frame.validTarget,
  }));
  return {
    frames,
    initialUnits: frames.reduce((sum, frame) => sum + frame.initialUnits, 0),
    validTarget: frames.reduce((sum, frame) => sum + frame.validTarget, 0),
    initialDoubleCodingAssignments:
      2 * frames.reduce((sum, frame) => sum + frame.initialUnits, 0),
  };
}

export function calculatePulseCoderWorkload(scenario: WorkloadScenario) {
  const counts = pulseCoderFrameCounts();
  const exactCoderHoursByFrame = Object.fromEntries(
    counts.frames.map((frame) => [
      frame.id,
      (frame.initialUnits * 2 * scenario.minutesPerPacket[frame.id]) / 60,
    ]),
  ) as Record<(typeof counts.frames)[number]["id"], number>;
  const coderHoursByFrame = Object.fromEntries(
    Object.entries(exactCoderHoursByFrame).map(([id, hours]) => [
      id,
      round(hours),
    ]),
  ) as Record<(typeof counts.frames)[number]["id"], number>;
  const coderHours = Object.values(exactCoderHoursByFrame).reduce(
    (sum, hours) => sum + hours,
    0,
  );
  const adjudicationHours =
    (counts.initialUnits * scenario.disagreementRate *
      scenario.adjudicationMinutes) /
    60;
  const coderTrainingHours =
    PULSE_CODER_STAFFING.coders * scenario.coderTrainingHoursEach;
  const adjudicatorTrainingHours =
    PULSE_CODER_STAFFING.adjudicators *
    scenario.adjudicatorTrainingHoursEach;
  const trainingHours = coderTrainingHours + adjudicatorTrainingHours;
  const managementHours =
    (coderHours + adjudicationHours + trainingHours) *
    scenario.managementFraction;
  const directCostUsd =
    coderHours * scenario.hourlyRatesUsd.coder +
    adjudicationHours * scenario.hourlyRatesUsd.adjudicator +
    coderTrainingHours * scenario.hourlyRatesUsd.coder +
    adjudicatorTrainingHours * scenario.hourlyRatesUsd.adjudicator +
    managementHours * scenario.hourlyRatesUsd.administrator;
  return {
    id: scenario.id,
    coderHoursByFrame,
    coderHours: round(coderHours),
    adjudicationHours: round(adjudicationHours),
    trainingHours: round(trainingHours),
    managementHours: round(managementHours),
    totalHoursBeforeBudgetContingency: round(
      coderHours + adjudicationHours + trainingHours + managementHours,
    ),
    totalBudgetUsd: Math.round(
      directCostUsd * (1 + scenario.budgetContingency),
    ),
  };
}

export const PULSE_CODER_RECRUITMENT_SOURCES = Object.freeze([
  {
    id: "bls-political-scientists",
    checkedAt: "2026-07-11",
    url: "https://www.bls.gov/ooh/life-physical-and-social-science/political-scientists.htm",
    use: "Upper professional-market anchor: master's-level entry and May 2024 median pay of $67.01/hour; not a promised contractor rate.",
  },
  {
    id: "prolific-payment-principles",
    checkedAt: "2026-07-11",
    url: "https://researcher-help.prolific.com/en/articles/445230-prolific-s-payment-principles",
    use: "Nonexpert participant floor only: $12/hour recommended and $8/hour minimum. Expert coding must pay materially more.",
  },
  {
    id: "apsa-comparative-politics",
    checkedAt: "2026-07-11",
    url: "https://apsanet.org/membership/organized-sections/section20/",
    use: "Comparative-politics and area-studies sourcing pool.",
  },
  {
    id: "ecpr-groups",
    checkedAt: "2026-07-11",
    url: "https://ecpr.eu/standinggroups/generalinfo.aspx",
    use: "Cross-national specialist and early-career scholarly networks.",
  },
  {
    id: "iapss",
    checkedAt: "2026-07-11",
    url: "https://iapss.org/",
    use: "Global political-science student and early-career sourcing pool.",
  },
  {
    id: "mpsa-association-directory",
    checkedAt: "2026-07-11",
    url: "https://www.mpsanet.org/professional-resources/directory-of-political-science-organizations/directory-of-political-science-associations/",
    use: "Regional and national association discovery for language and geography coverage.",
  },
]);

export function pulseCoderRecruitmentErrors(): string[] {
  const errors: string[] = [];
  const counts = pulseCoderFrameCounts();
  if (counts.initialUnits !== 1456 || counts.validTarget !== 1348)
    errors.push("frozen evaluation counts drifted");
  if (counts.initialDoubleCodingAssignments !== 2912)
    errors.push("double-coding assignment count drifted");
  if (
    PULSE_CODER_STAFFING.samePacketRoleOverlapAllowed ||
    PULSE_CODER_STAFFING.ownerMayCodeOrAdjudicate ||
    PULSE_CODER_STAFFING.productionContributorMayCodeOrAdjudicate
  )
    errors.push("independence boundary weakened");
  const workloads = PULSE_CODER_WORKLOAD_SCENARIOS.map(
    calculatePulseCoderWorkload,
  );
  if (
    JSON.stringify(workloads.map(({ totalBudgetUsd }) => totalBudgetUsd)) !==
    JSON.stringify([16751, 45615, 104801])
  )
    errors.push("budget arithmetic drifted");
  if (
    PULSE_CODER_RECRUITMENT_SOURCES.some(
      ({ checkedAt, url }) =>
        checkedAt !== "2026-07-11" || !url.startsWith("https://"),
    )
  )
    errors.push("recruitment source record is incomplete");
  return errors;
}
