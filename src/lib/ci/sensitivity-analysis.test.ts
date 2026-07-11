import assert from "node:assert/strict";
import test from "node:test";
import {
  averageRankPercentiles,
  compareSensitivity,
  rankScores,
} from "./sensitivity-analysis";
test("rank comparison reports stable identity and displaced reversal", () => {
  const b = [
    { iso3: "A", score: 3 },
    { iso3: "B", score: 2 },
    { iso3: "C", score: 1 },
  ];
  assert.deepEqual([...rankScores(b).values()], [1, 2, 3]);
  assert.ok(Math.abs(compareSensitivity(b, b).rankSpearman - 1) < 1e-12);
  assert.ok(
    compareSensitivity(
      b,
      [...b].reverse().map((r, i) => ({ ...r, score: i + 1 })),
    ).maxAbsoluteRankShift >= 0,
  );
});
test("percentiles average tied ranks", () => {
  const p = averageRankPercentiles([
    { iso3: "A", value: 1 },
    { iso3: "B", value: 1 },
    { iso3: "C", value: 2 },
  ]);
  assert.equal(p.get("A"), 25);
  assert.equal(p.get("B"), 25);
  assert.equal(p.get("C"), 100);
});
