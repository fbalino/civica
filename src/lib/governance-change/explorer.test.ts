import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGovernanceChangeResult,
  type GovernanceChangeObservation,
} from "./explorer";

function observations(
  values: Array<[string, number, number]>,
): GovernanceChangeObservation[] {
  return values.flatMap(([id, start, end]) => [
    {
      jurisdictionId: id,
      jurisdictionName: id,
      jurisdictionSlug: id,
      year: 2010,
      value: start,
    },
    {
      jurisdictionId: id,
      jurisdictionName: id,
      jurisdictionSlug: id,
      year: 2020,
      value: end,
    },
  ]);
}

test("ranks exact-window native changes when coverage is sufficient", () => {
  const result = buildGovernanceChangeResult({
    observations: observations([
      ["a", 0.4, 0.8],
      ["b", 0.6, 0.5],
    ]),
    startYear: 2010,
    endYear: 2020,
    isInverted: false,
    minComparable: 2,
    minCoverage: 1,
  });
  assert.equal(result.status, "ranked");
  assert.deepEqual(
    result.rows.map((row) => row.jurisdictionId),
    ["a", "b"],
  );
});

test("inverted publisher scales reverse only the ranking direction", () => {
  const [row] = buildGovernanceChangeResult({
    observations: observations([["a", 5, 3]]),
    startYear: 2010,
    endYear: 2020,
    isInverted: true,
    minComparable: 1,
    minCoverage: 1,
  }).rows;
  assert.equal(row.rawDelta, -2);
  assert.equal(row.publisherAlignedDelta, 2);
});

test("missing endpoints exclude a country instead of becoming zero", () => {
  const rows = observations([["a", 1, 2]]);
  rows.push({
    jurisdictionId: "b",
    jurisdictionName: "b",
    jurisdictionSlug: "b",
    year: 2020,
    value: 4,
  });
  const result = buildGovernanceChangeResult({
    observations: rows,
    startYear: 2010,
    endYear: 2020,
    isInverted: false,
    minComparable: 1,
    minCoverage: 0,
  });
  assert.equal(result.comparableJurisdictions, 1);
  assert.deepEqual(result.rows.map((row) => row.jurisdictionId), ["a"]);
});

test("thin exact-window coverage produces an unranked alphabetical table", () => {
  const result = buildGovernanceChangeResult({
    observations: observations([
      ["z", 1, 4],
      ["a", 1, 2],
    ]),
    startYear: 2010,
    endYear: 2020,
    isInverted: false,
    minComparable: 3,
    minCoverage: 1,
  });
  assert.equal(result.status, "no_ranking");
  assert.match(result.reason ?? "", /below the 3-country minimum/);
  assert.deepEqual(
    result.rows.map((row) => row.jurisdictionId),
    ["a", "z"],
  );
});

test("endpoint sensitivity exposes a direction reversal", () => {
  const values = observations([["a", 1, 2]]);
  values.push(
    {
      jurisdictionId: "a",
      jurisdictionName: "a",
      jurisdictionSlug: "a",
      year: 2011,
      value: 3,
    },
    {
      jurisdictionId: "a",
      jurisdictionName: "a",
      jurisdictionSlug: "a",
      year: 2019,
      value: 1,
    },
  );
  const [row] = buildGovernanceChangeResult({
    observations: values,
    startYear: 2010,
    endYear: 2020,
    isInverted: false,
    minComparable: 1,
    minCoverage: 1,
  }).rows;
  assert.equal(row.directionStable, false);
  assert.ok(row.sensitivityMin < 0);
  assert.ok(row.sensitivityMax > 0);
});
