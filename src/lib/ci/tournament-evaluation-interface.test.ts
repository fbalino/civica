import assert from "node:assert/strict";
import test from "node:test";
import { buildTournamentEvaluationSuite, tournamentEvaluationErrors } from "./tournament-evaluation-interface";

test("shared suite rejects split drift and includes K0 through K5", () => {
  const h = "a".repeat(64); const baselines = { methodVersion: "b", panelReleaseId: "p", inputCells: 10, observedInputRows: 8, valuesLocation: "x", baselines: { B0: { rows: 2, coverage: { development: 1, validation: 1, final_holdout: 0 }, outputSha256: h } } };
  const k1 = { methodVersion: "k1", protocolVersion: "p", panelReleaseId: "p", outputs: { scored: 2, full: 2, partial: 0, bySplit: { development: 1, validation: 1, final_holdout: 0 }, outputSha256: h }, observedInputs: 2, uncertainty: { status: "none" }, valuesLocation: "x" };
  const k2 = { methodVersion: "k2", panelReleaseId: "p", outputs: { total: 2, development: 1, validation: 1, finalHoldout: 0, outputSha256: h }, inputCells: 2, withinSourceUncertainty: "none", valuesLocation: "x" };
  const k3 = { methodVersion: "k3", asOf: "d", prototypeRows: 2, sovereignJurisdictionsWithoutPrototypeRow: 192, bySplit: { development: 1, validation: 1, final_holdout: 0 }, observedExecutiveIdentity: 1, contestedExecutiveIdentity: 1, transferStatesComputed: 0, termLimitStatesComputed: 0, outputSha256: h, valuesLocation: "x" };
  const k4 = { methodVersion: "k4", inputReleaseId: "p4", outputRows: 582, bySplit: { development: 387, validation: 120, final_holdout: 75 }, candidateTaggedRows: 1, noTaggedExcerptRows: 581, observedPracticeRows: 1, outputSha256: h, valuesLocation: "x" };
  const k5 = { methodVersion: "k5", releaseId: "r", candidateRows: 2, jurisdictions: 1, bySplit: [{ split: "development", candidates: 1 }, { split: "validation", candidates: 1 }, { split: "final_holdout", candidates: 0 }], graphEdgesPublished: 0, validationStatus: "pending", outputSha256: h };
  const suite = buildTournamentEvaluationSuite({ baselines, k1, k2, k3, k4, k5 }); assert.deepEqual(suite.artifacts.map((row) => row.artifactId), ["K0", "K1", "K2", "K3", "K4", "K5"]); assert.equal(tournamentEvaluationErrors(suite).length, 0);
  suite.artifacts[0].splitCoverage.development = 0; assert.ok(tournamentEvaluationErrors(suite).includes("K0 split coverage does not equal emitted units"));
});
