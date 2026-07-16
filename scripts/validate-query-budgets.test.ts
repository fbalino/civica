import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { QUERY_BUDGETS } from "@/lib/platform/query-budget";

test("each registered query-budget index is declared through the Drizzle schema", () => {
  const schema = readFileSync("src/lib/db/schema.ts", "utf8");
  for (const budget of QUERY_BUDGETS) {
    for (const indexName of budget.requiredIndexes) {
      assert.match(schema, new RegExp(`\\"${indexName}\\"`));
    }
  }
});

test("the live benchmark stays read-only and records execution plans", () => {
  const source = readFileSync("scripts/benchmark-query-budgets.ts", "utf8");
  assert.match(source, /EXPLAIN \(ANALYZE, BUFFERS, FORMAT JSON\)/);
  assert.match(source, /query must be a SELECT/);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/);
});
