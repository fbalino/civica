import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  NON_RESEARCH_VISUAL_SURFACES,
  RESEARCH_VISUALIZATION_CONTRACT,
  visualizationContractErrors,
} from "./visualization-contract";

const projectRoot = process.cwd();

test("research visualization inventory is complete and internally coherent", () => {
  assert.deepEqual(visualizationContractErrors(), []);
  assert.equal(RESEARCH_VISUALIZATION_CONTRACT.length, 10);

  for (const entry of RESEARCH_VISUALIZATION_CONTRACT) {
    for (const component of entry.components) {
      assert.equal(
        existsSync(resolve(projectRoot, component)),
        true,
        `${entry.id} references a missing component witness: ${component}`,
      );
    }
  }
});

test("every visual source component is deliberately classified", () => {
  const included = RESEARCH_VISUALIZATION_CONTRACT.flatMap(
    (entry) => entry.components,
  );
  const excluded = NON_RESEARCH_VISUAL_SURFACES.flatMap(
    (entry) => entry.components,
  );
  const all = [...included, ...excluded];

  assert.equal(new Set(all).size, all.length, "visual components overlap");
  for (const component of all) {
    assert.equal(
      existsSync(resolve(projectRoot, component)),
      true,
      `classification references a missing component: ${component}`,
    );
  }
});

test("in-scope component witnesses retain the primitives their contracts rely on", () => {
  const expectedSourceFragments: Record<string, readonly string[]> = {
    "atlas-source-native-map": [
      "aria-labelledby",
      "ResearchVisualizationDisclosure",
    ],
    "organization-membership-map": [
      "organization-membership-map-title",
      "ResearchVisualizationDisclosure",
    ],
    "index-methodology-weights": [
      "meth-weights-bar",
      "ResearchVisualizationDisclosure",
    ],
    "indicator-history": [
      "IndicatorTrendChart",
      "ResearchVisualizationDisclosure",
    ],
    "legislature-composition": [
      "FactbookLegislatureChart",
      "ResearchVisualizationDisclosure",
    ],
    "party-ideology": [
      "IdeologyCompass",
      "ResearchVisualizationDisclosure",
    ],
    "leader-tenure": ["LeaderTenureTimeline", "ResearchVisualizationDisclosure"],
    "index-history": [
      "HistoryChart",
      "ScorePosition",
      "ResearchVisualizationDisclosure",
    ],
    "pca-eigenvalue": ["EigenvalueChart", "ResearchVisualizationDisclosure"],
    "pulse-backtest-trajectories": [
      "TrajectorySparkline",
      "ResearchVisualizationDisclosure",
    ],
  };

  for (const entry of RESEARCH_VISUALIZATION_CONTRACT) {
    const body = entry.components
      .map((component) => readFileSync(resolve(projectRoot, component), "utf8"))
      .join("\n");
    for (const fragment of expectedSourceFragments[entry.id] ?? []) {
      assert.match(body, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});
