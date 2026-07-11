import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSubgroups, terciles } from "./subgroup-fairness";

test("terciles retain every row and subgroup summaries suppress small performance cells", () => {
  const bands = terciles(Array.from({ length: 9 }, (_, i) => ({ iso3: String(i), value: i })));
  assert.deepEqual([...new Set(bands.values())].sort(), ["high", "low", "middle"]);
  const result = summarizeSubgroups([{ iso3: "A", score: 40, sourceCount: 3, uncertaintyCount: 2, scarcityDelta: -1, groups: { region: "x" } }], "region");
  assert.equal(result[0].performanceStatus, "suppressed_below_n30");
  assert.equal(result[0].publicationRate, 1);
});
