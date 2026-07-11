import assert from "node:assert/strict";
import test from "node:test";
import { geographicTournamentBucket, INDEX_TOURNAMENT_PREREGISTRATION, tournamentPreregistrationErrors } from "./tournament-preregistration";

test("tournament preregistration is complete and locked", () => {
  assert.deepEqual(tournamentPreregistrationErrors(), []);
  assert.equal(INDEX_TOURNAMENT_PREREGISTRATION.decisionRule.noCandidateWins, true);
});

test("geographic split is deterministic, case-insensitive, and outcome-free", () => {
  assert.equal(geographicTournamentBucket("URY"), geographicTournamentBucket("ury"));
  for (const iso3 of ["URY", "JPN", "FRA", "USA", "ZAF"]) assert.ok(geographicTournamentBucket(iso3) >= 0 && geographicTournamentBucket(iso3) <= 9);
});

test("a protocol cannot pass with a candidate missing thresholds", () => {
  const metricsAndThresholds = { ...INDEX_TOURNAMENT_PREREGISTRATION.metricsAndThresholds } as Record<string, readonly string[]>;
  delete metricsAndThresholds.K5;
  assert.ok(tournamentPreregistrationErrors({ ...INDEX_TOURNAMENT_PREREGISTRATION, metricsAndThresholds } as typeof INDEX_TOURNAMENT_PREREGISTRATION).includes("K5 has no frozen thresholds"));
});
