import assert from "node:assert/strict";
import test from "node:test";
import { buildConfirmatoryDecision, buildExploratoryScenario, tournamentDecisionErrors } from "./tournament-decision";

const evidence = { k1ReproductionR2: 0.999847164869575, k2MidpointR2: 0.09837770653340672, k2DropOneRate: 0.6316793893129771, k3EveryRowCited: true, k3HistoricalStates: 0, k4ZeroAggregation: true, k5ZeroWeightedTotal: true };

test("frozen thresholds produce no winner without compensating for failures", () => {
  const result = buildConfirmatoryDecision(evidence);
  assert.deepEqual(tournamentDecisionErrors(result), []);
  assert.equal(result.thresholds.find((row) => row.id === "K1-originality")?.status, "fail");
  assert.equal(result.thresholds.find((row) => row.id === "K2-drop-one")?.status, "fail");
  assert.equal(result.candidates.every((row) => !row.qualifiesNow), true);
});

test("threshold changes are forced into a non-winner exploratory scenario", () => {
  const scenario = buildExploratoryScenario(evidence, { "K2-drop-one": 0.7 });
  assert.equal(scenario.analysisClass, "exploratory");
  assert.equal(scenario.canSelectWinner, false);
  assert.match(scenario.releaseId, /exploratory/);
});
