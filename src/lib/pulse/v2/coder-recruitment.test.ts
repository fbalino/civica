import assert from "node:assert/strict";
import test from "node:test";
import {
  PULSE_CODER_WORKLOAD_SCENARIOS,
  calculatePulseCoderWorkload,
  pulseCoderFrameCounts,
  pulseCoderRecruitmentErrors,
} from "./coder-recruitment";

test("recruitment workload derives from every frozen evaluation frame", () => {
  assert.deepEqual(pulseCoderFrameCounts(), {
    frames: [
      {
        id: "retained_event_candidate_census",
        initialUnits: 384,
        validTarget: 384,
      },
      {
        id: "system_negative_probability",
        initialUnits: 536,
        validTarget: 482,
      },
      {
        id: "country_day_retrieval_probability",
        initialUnits: 536,
        validTarget: 482,
      },
    ],
    initialUnits: 1456,
    validTarget: 1348,
    initialDoubleCodingAssignments: 2912,
  });
});

test("cost scenarios retain visible time, disagreement, staffing, and rate assumptions", () => {
  const workloads = PULSE_CODER_WORKLOAD_SCENARIOS.map(
    calculatePulseCoderWorkload,
  );
  assert.deepEqual(
    workloads.map((row) => ({
      id: row.id,
      coderHours: row.coderHours,
      adjudicationHours: row.adjudicationHours,
      totalHours: row.totalHoursBeforeBudgetContingency,
      totalBudgetUsd: row.totalBudgetUsd,
    })),
    [
      {
        id: "low",
        coderHours: 424,
        adjudicationHours: 36.4,
        totalHours: 554.8,
        totalBudgetUsd: 16751,
      },
      {
        id: "base",
        coderHours: 653.9,
        adjudicationHours: 91,
        totalHours: 934.6,
        totalBudgetUsd: 45615,
      },
      {
        id: "high",
        coderHours: 945.1,
        adjudicationHours: 169.9,
        totalHours: 1448.7,
        totalBudgetUsd: 104801,
      },
    ],
  );
  assert.deepEqual(pulseCoderRecruitmentErrors(), []);
});
