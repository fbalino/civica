import assert from "node:assert/strict";
import test from "node:test";
import {
  absoluteMajorityThreshold,
  holdsAbsoluteMajority,
} from "@/lib/legislatures/majority";

test("absolute majority is floor(statutory seats / 2) + 1", () => {
  const cases: Array<[number, number]> = [
    [1, 1],
    [2, 2],
    [3, 2],
    [11, 6],
    [31, 16],
    [99, 50],
    [100, 51],
    [150, 76],
    [155, 78],
    [435, 218],
    [577, 289],
  ];
  for (const [total, expected] of cases) {
    assert.equal(absoluteMajorityThreshold(total), expected, `total ${total}`);
  }
});

test("absolute majority is null for totals that are not positive safe integers", () => {
  for (const total of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 30.5]) {
    assert.equal(absoluteMajorityThreshold(total), null, `total ${total}`);
  }
});

test("holdsAbsoluteMajority compares seats with the shared threshold", () => {
  assert.equal(holdsAbsoluteMajority(16, 31), true);
  assert.equal(holdsAbsoluteMajority(15, 31), false);
  assert.equal(holdsAbsoluteMajority(50, 99), true);
  assert.equal(holdsAbsoluteMajority(50, 100), false);
  assert.equal(holdsAbsoluteMajority(51, 100), true);
  assert.equal(holdsAbsoluteMajority(16, 0), null);
  assert.equal(holdsAbsoluteMajority(16, 30.5), null);
  assert.equal(holdsAbsoluteMajority(16, Number.NaN), null);
});
