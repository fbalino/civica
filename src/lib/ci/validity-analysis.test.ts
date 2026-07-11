import assert from "node:assert/strict";
import test from "node:test";
import { clusterBootstrap, spearman } from "./validity-analysis";
test("Spearman handles ties and direction", () => {
  assert.ok(
    Math.abs(
      spearman([
        { x: 1, y: 3 },
        { x: 2, y: 2 },
        { x: 3, y: 1 },
      ]) + 1,
    ) < 1e-12,
  );
  assert.ok(
    spearman([
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]) > 0.99,
  );
});
test("cluster bootstrap is deterministic", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    iso3: `C${i}`,
    year: 2020,
    x: i,
    y: i + (i % 2),
  }));
  assert.deepEqual(
    clusterBootstrap(rows, spearman, "x", 50),
    clusterBootstrap(rows, spearman, "x", 50),
  );
});
