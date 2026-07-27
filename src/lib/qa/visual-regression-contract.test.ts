import assert from "node:assert/strict";
import test from "node:test";

import {
  VISUAL_REGRESSION_SCENARIOS,
  VISUAL_REGRESSION_THEMES,
  VISUAL_REGRESSION_VIEWPORTS,
  visualRegressionCaseId,
  visualRegressionContractErrors,
} from "./visual-regression-contract";

test("the visual-regression matrix covers canonical surfaces in both themes and viewports", () => {
  assert.deepEqual(visualRegressionContractErrors(), []);
  assert.equal(VISUAL_REGRESSION_THEMES.length, 2);
  assert.ok(VISUAL_REGRESSION_VIEWPORTS.some((viewport) => viewport.name === "desktop"));
  assert.ok(
    VISUAL_REGRESSION_VIEWPORTS.some(
      (viewport) => viewport.name === "small-mobile",
    ),
  );
  assert.equal(
    new Set(
      VISUAL_REGRESSION_SCENARIOS.flatMap((scenario) =>
        VISUAL_REGRESSION_THEMES.flatMap((theme) =>
          VISUAL_REGRESSION_VIEWPORTS.map((viewport) =>
            visualRegressionCaseId(scenario, theme, viewport),
          ),
        ),
      ),
    ).size,
    VISUAL_REGRESSION_SCENARIOS.length *
      VISUAL_REGRESSION_THEMES.length *
      VISUAL_REGRESSION_VIEWPORTS.length,
  );
});

test("the coverage contract rejects a removed canonical surface", () => {
  const withoutAtlas = VISUAL_REGRESSION_SCENARIOS.filter(
    (scenario) => scenario.id !== "atlas",
  );
  assert.ok(
    visualRegressionContractErrors(withoutAtlas).includes(
      "missing required surface: atlas",
    ),
  );
});
