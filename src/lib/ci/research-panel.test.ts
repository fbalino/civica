import assert from "node:assert/strict";
import test from "node:test";
import { CI_RESEARCH_PANEL_INDICATORS, CI_RESEARCH_PANEL_TEMPORAL_BREAKS, panelMissingReason, researchPanelHash } from "./research-panel";

test("panel indicator registry is closed and native-scale", () => {
  assert.equal(CI_RESEARCH_PANEL_INDICATORS.length, 5);
  assert.equal(new Set(CI_RESEARCH_PANEL_INDICATORS.map((row) => `${row.sourceId}:${row.indicatorId}`)).size, 5);
  for (const row of CI_RESEARCH_PANEL_INDICATORS) {
    assert.ok(row.nativeMax > row.nativeMin);
    assert.match(row.officialReference, /^https:\/\//);
    assert.notEqual(row.uncertaintyStatus, "");
  }
});

test("structural and coverage missingness are not collapsed", () => {
  const wgi = CI_RESEARCH_PANEL_INDICATORS.find((row) => row.sourceId === "worldbank_wgi")!;
  const cpi = CI_RESEARCH_PANEL_INDICATORS.find((row) => row.sourceId === "transparency_intl")!;
  const hdi = CI_RESEARCH_PANEL_INDICATORS.find((row) => row.sourceId === "undp_hdi")!;
  assert.equal(panelMissingReason(wgi, 2001), "source_not_published_for_period");
  assert.equal(panelMissingReason(cpi, 2011), "outside_comparable_series");
  assert.equal(panelMissingReason(hdi, 2024), "outside_captured_release");
  assert.equal(panelMissingReason(wgi, 2020), "source_no_observation_for_jurisdiction_period");
});

test("temporal breaks and semantic hashes are deterministic", () => {
  assert.ok(CI_RESEARCH_PANEL_TEMPORAL_BREAKS.length >= 6);
  assert.equal(researchPanelHash({ b: 2, a: 1 }), researchPanelHash({ a: 1, b: 2 }));
});
