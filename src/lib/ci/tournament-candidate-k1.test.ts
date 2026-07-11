import assert from "node:assert/strict";
import test from "node:test";
import { runK1TournamentCandidate, selectK1DimensionRows, type K1PanelInput } from "./tournament-candidate-k1";

function input(iso3: string, year: number, sourceId: string, indicatorId: string, dimension: string, value: number | null): K1PanelInput {
  return { jurisdictionId: iso3, iso3, periodYear: year, sourceId, indicatorId, dimension, value };
}
function full(iso3: string, year: number, vdem: number | null, va = 0): K1PanelInput[] {
  return [input(iso3, year, "vdem", "v2x_libdem", "democratic_quality", vdem), input(iso3, year, "worldbank_wgi", "va.est", "democratic_quality", va), input(iso3, year, "worldbank_wgi", "rl.est", "rule_of_law", 0), input(iso3, year, "freedom_house", "pr_cl_total", "freedom_rights", 8), input(iso3, year, "transparency_intl", "score", "corruption_control", 50)];
}

test("K1 uses V-Dem first and WGI VA only as fallback", () => {
  assert.equal(selectK1DimensionRows(full("URY", 2024, 0.8, -2)).inputIdentities[0], "vdem:v2x_libdem");
  assert.equal(selectK1DimensionRows(full("URY", 2024, null, 1)).inputIdentities[0], "worldbank_wgi:va.est");
});

test("K1 maps declared internal aliases to publisher indicator identities", () => {
  const aliased = full("URY", 2024, 0.8).map((row) => row.indicatorId === "pr_cl_total" ? { ...row, indicatorId: "fh_pr_cl_sum" } : row.indicatorId === "score" ? { ...row, indicatorId: "CPI_SCORE" } : row);
  assert.equal(runK1TournamentCandidate(aliased).length, 1);
});

test("K1 applies current missingness and publishes no invented interval", () => {
  const fullOutput = runK1TournamentCandidate(full("URY", 2024, 0.8))[0];
  assert.equal(fullOutput.completeness, "full");
  assert.equal(fullOutput.scoreLower, null);
  assert.equal(fullOutput.rankUncertainty, "not_estimable_without_valid_score_uncertainty");
  const partial = full("JPN", 2024, 0.8).filter((row) => row.indicatorId !== "score");
  assert.equal(runK1TournamentCandidate(partial)[0].completeness, "partial");
  const insufficient = partial.filter((row) => row.indicatorId !== "rl.est");
  assert.equal(runK1TournamentCandidate(insufficient).length, 0);
});

test("K1 competition ranks ties without ordinal tiebreaks", () => {
  const outputs = runK1TournamentCandidate([...full("URY", 2024, 0.8), ...full("JPN", 2024, 0.8), ...full("FRA", 2024, 0.2)]);
  assert.deepEqual(outputs.map((row) => [row.iso3, row.rank, row.tieCount]), [["JPN", 1, 2], ["URY", 1, 2], ["FRA", 3, 1]]);
});
