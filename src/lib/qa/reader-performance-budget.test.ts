import assert from "node:assert/strict";
import { test } from "node:test";

import {
  READER_PERFORMANCE_FIXTURES,
  readerPerformanceBudgetContractErrors,
  readerPerformanceBudgetErrors,
  type ReaderPerformanceMetrics,
} from "./reader-performance-budget";
import { QUERY_BUDGETS } from "../platform/query-budget";

const passingMetrics: ReaderPerformanceMetrics = {
  htmlBytes: 1,
  rscBytes: 1,
  javascriptBytes: 1,
  cssBytes: 1,
  imageBytes: 1,
  fontBytes: 1,
  requestCount: 1,
  serverResponseMs: 1,
  lcpMs: 1,
  cls: 0,
  inpMs: 1,
  longestLongTaskMs: 1,
  longTaskCount: 0,
  mapInitializationMs: null,
};

test("the reader-performance contract covers the representative heavy surfaces", () => {
  assert.deepEqual(readerPerformanceBudgetContractErrors(), []);
  assert.deepEqual(
    READER_PERFORMANCE_FIXTURES.map((fixture) => fixture.id),
    ["home", "atlas", "constitution", "record-article"],
  );
  const knownQueryBudgetIds = new Set(QUERY_BUDGETS.map((budget) => budget.id));
  for (const fixture of READER_PERFORMANCE_FIXTURES) {
    for (const queryBudgetId of fixture.queryBudgetIds)
      assert.ok(
        knownQueryBudgetIds.has(queryBudgetId),
        `${fixture.id} links a known query budget`,
      );
  }
});

test("an in-budget non-map fixture passes", () => {
  const home = READER_PERFORMANCE_FIXTURES.find(
    (fixture) => fixture.id === "home",
  );
  assert.ok(home);
  assert.deepEqual(readerPerformanceBudgetErrors(home, passingMetrics), []);
});

test("a seeded payload regression fails the matching fixture", () => {
  const home = READER_PERFORMANCE_FIXTURES.find(
    (fixture) => fixture.id === "home",
  );
  assert.ok(home);
  const errors = readerPerformanceBudgetErrors(home, {
    ...passingMetrics,
    imageBytes: home.budget.imageBytes + 1,
  });
  assert.deepEqual(errors, [
    `home: image bytes ${home.budget.imageBytes + 1} exceeds ${home.budget.imageBytes}`,
  ]);
});

test("an Atlas run fails closed when map initialization is missing", () => {
  const atlas = READER_PERFORMANCE_FIXTURES.find(
    (fixture) => fixture.id === "atlas",
  );
  assert.ok(atlas);
  assert.deepEqual(readerPerformanceBudgetErrors(atlas, passingMetrics), [
    "atlas: map initialization was not measured",
  ]);
});
