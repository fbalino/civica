import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCiCompleteness,
  CURRENT_CI_MISSINGNESS_POLICY,
  parsePublishedCiCompleteness,
} from "./missingness-policy";
import { CURRENT_CI_METHODOLOGY_VERSION } from "./current-release";
import {
  calculateCompositeScores,
  LEGACY_CI_METHODOLOGY_VERSION,
} from "./calculate";

test("missingness policy is bound to the current methodology", () => {
  assert.equal(
    CURRENT_CI_MISSINGNESS_POLICY.methodologyVersion,
    CURRENT_CI_METHODOLOGY_VERSION,
  );
  assert.equal(CURRENT_CI_MISSINGNESS_POLICY.minimumDimensionsForPublication, 3);
  assert.deepEqual(CURRENT_CI_MISSINGNESS_POLICY.mandatoryDimensions, [
    "democratic_quality",
    "rule_of_law",
  ]);
});

test("four dimensions publish full and three including both mandatory publish partial", () => {
  assert.equal(
    assessCiCompleteness(
      new Set([
        "democratic_quality",
        "rule_of_law",
        "freedom_rights",
        "corruption_control",
      ]),
    ).completeness,
    "full",
  );
  const partial = assessCiCompleteness(
    new Set(["democratic_quality", "rule_of_law", "freedom_rights"]),
  );
  assert.equal(partial.completeness, "partial");
  assert.deepEqual(partial.missingOptional, ["corruption_control"]);
});

test("missing a mandatory dimension or both optional dimensions withholds the composite", () => {
  assert.equal(
    assessCiCompleteness(
      new Set(["democratic_quality", "freedom_rights", "corruption_control"]),
    ).completeness,
    "insufficient",
  );
  assert.equal(
    assessCiCompleteness(new Set(["democratic_quality", "rule_of_law"]))
      .completeness,
    "insufficient",
  );
});

test("legacy six-dimension calculator cannot write a current methodology", async () => {
  assert.equal(LEGACY_CI_METHODOLOGY_VERSION, "v1.0");
  await assert.rejects(
    calculateCompositeScores({} as never, "2024-Q4", CURRENT_CI_METHODOLOGY_VERSION),
    /sealed to v1\.0/,
  );
});

test("published completeness fields fail closed when their labels disagree", () => {
  assert.deepEqual(
    parsePublishedCiCompleteness({
      completenessFlag: "partial",
      dimensionsAvailable: 3,
      missingDimensions: ["corruption_control"],
    }),
    {
      completenessFlag: "partial",
      dimensionsAvailable: 3,
      missingDimensions: ["corruption_control"],
    },
  );
  assert.throws(
    () =>
      parsePublishedCiCompleteness({
        completenessFlag: "full",
        dimensionsAvailable: 3,
        missingDimensions: ["corruption_control"],
      }),
    /contradicts/,
  );
});
