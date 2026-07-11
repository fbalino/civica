import assert from "node:assert/strict";
import test from "node:test";
import { dashboardBaseline, equalWeightBaseline, firstFactorBaseline, fitFirstFactorBaseline, runAllTournamentBaselines, singleIndicatorBaseline, type BaselinePanelObservation } from "./tournament-baselines";

const sources = [
  ["vdem", "v2x_libdem", 0, 1], ["worldbank_wgi", "rl.est", -2.5, 2.5],
  ["freedom_house", "fh_total_score", 0, 100], ["transparency_intl", "score", 0, 100],
] as const;
const rows: BaselinePanelObservation[] = [];
for (const [countryIndex, iso3] of ["URY", "JPN", "FRA", "USA", "ZAF"].entries()) {
  for (const year of [2012, 2013, 2014, 2015, 2016, 2019, 2023]) {
    for (const [sourceId, indicatorId, nativeMin, nativeMax] of sources) {
      const fraction = 0.15 + countryIndex * 0.12 + (year - 2012) * 0.005;
      rows.push({ jurisdictionId: iso3, iso3, periodYear: year, sourceId, indicatorId, value: nativeMin + fraction * (nativeMax - nativeMin), nativeMin, nativeMax, isInverted: false });
    }
  }
}

test("all four baselines share deterministic unit and split contracts", () => {
  const result = runAllTournamentBaselines(rows);
  assert.equal(result.outputs.B0.length, 35);
  assert.equal(result.outputs.B1.length, 35);
  assert.equal(result.outputs.B2.length, 35);
  assert.equal(result.outputs.B3.length, 35);
  assert.ok(result.outputs.B0.every((row) => row.value === null));
  assert.ok(result.outputs.B1.every((row) => row.scale === "vdem_native_0_1"));
});

test("equal weight uses declared native bounds and requires complete coverage", () => {
  assert.ok(equalWeightBaseline(rows).every((row) => row.value !== null && row.value >= 0 && row.value <= 100));
  const missing = rows.filter((row) => !(row.iso3 === "URY" && row.periodYear === 2012 && row.sourceId === "freedom_house"));
  assert.equal(equalWeightBaseline(missing).length, 34);
  assert.equal(dashboardBaseline(missing).length, 35);
  assert.equal(singleIndicatorBaseline(missing).length, 35);
});

test("first factor fits development only and is order invariant", () => {
  const model = fitFirstFactorBaseline(rows);
  const reversed = fitFirstFactorBaseline([...rows].reverse());
  assert.equal(model.fitRows, reversed.fitRows);
  model.loadings.forEach((loading, i) => assert.ok(Math.abs(loading - reversed.loadings[i]) < 1e-12));
  assert.ok(model.loadings.every((loading) => loading > 0));
  assert.deepEqual(firstFactorBaseline(rows, model), firstFactorBaseline([...rows].reverse(), model));
});
