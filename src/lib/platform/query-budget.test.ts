import assert from "node:assert/strict";
import test from "node:test";

import {
  QUERY_BUDGETS,
  queryBudgetContractErrors,
} from "./query-budget";

test("the query-budget contract covers every critical high-cardinality domain", () => {
  assert.deepEqual(queryBudgetContractErrors(), []);
  assert.deepEqual(
    [...new Set(QUERY_BUDGETS.map((budget) => budget.domain))].sort(),
    ["constitution", "country", "index", "indicator", "pulse"],
  );
});

test("missing indexes, bounds, and domains fail closed", () => {
  const missingIndex = QUERY_BUDGETS.map((budget) =>
    budget.id === "index-release-rankings"
      ? { ...budget, requiredIndexes: [] }
      : budget,
  );
  assert.match(
    queryBudgetContractErrors(missingIndex).join("\n"),
    /index-release-rankings: at least one required index/,
  );

  const unbounded = QUERY_BUDGETS.map((budget) =>
    budget.id === "pulse-publication-panel"
      ? { ...budget, maxReturnedRows: 0 }
      : budget,
  );
  assert.match(
    queryBudgetContractErrors(unbounded).join("\n"),
    /pulse-publication-panel: maximum returned rows/,
  );

  const withoutConstitution = QUERY_BUDGETS.filter(
    (budget) => budget.domain !== "constitution",
  );
  assert.match(
    queryBudgetContractErrors(withoutConstitution).join("\n"),
    /missing constitution budget/,
  );
});
