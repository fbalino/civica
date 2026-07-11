import assert from "node:assert/strict";
import test from "node:test";
import { k2DevelopmentDiagnostics, runK2Concordance, type K2PanelInput } from "./tournament-candidate-k2";

const rows: K2PanelInput[] = [];
for (const [i, iso3] of ["URY", "JPN", "FRA", "USA", "ZAF", "IND"].entries()) for (const [sourceId, indicatorId, min, max, inverted, bump] of [["vdem", "v2x_libdem", 0, 1, false, 0], ["worldbank_wgi", "va.est", -2.5, 2.5, false, 0.03], ["freedom_house", "pr_cl_total", 2, 14, true, -0.02]] as const) { const normalized = 0.1 + i * 0.14 + bump; rows.push({ jurisdictionId: iso3, iso3, periodYear: 2015, sourceId, indicatorId, value: inverted ? max - normalized * (max - min) : min + normalized * (max - min), nativeMin: min, nativeMax: max, isInverted: inverted }); }

test("K2 computes named-rater percentiles only on exact common coverage", () => {
  const outputs = runK2Concordance(rows); assert.equal(outputs.length, 6); assert.ok(outputs.every((row) => row.placements.length === 3 && row.commonCoverageN === 6));
  const missing = rows.filter((row) => !(row.iso3 === "URY" && row.indicatorId === "va.est")); assert.equal(runK2Concordance(missing).length, 5);
});
test("K2 diagnostics are development-only and deterministic", () => {
  const outputs = runK2Concordance(rows); const a = k2DevelopmentDiagnostics(outputs); const b = k2DevelopmentDiagnostics([...outputs].reverse());
  assert.equal(a.developmentRows, outputs.filter((row) => row.split === "development").length); assert.equal(a.midpointArtifactR2, b.midpointArtifactR2); assert.ok(a.dropOneSourceAnyTercileChangeRate >= 0 && a.dropOneSourceAnyTercileChangeRate <= 1);
});
