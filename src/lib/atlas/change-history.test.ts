import assert from "node:assert/strict";
import test from "node:test";
import { isAtlasChangeKind, projectPublicHistoryDiff } from "./change-history";

test("history projection reports only allowlisted fact fields", () => {
  assert.deepEqual(
    projectPublicHistoryDiff(
      "fact",
      { fact_value: "10", source_id: "cia_factbook", internal_notes: "never public" },
      { fact_value: "12", source_id: "world_bank", internal_notes: "still private" },
    ),
    [
      { field: "fact_value", before: "10", after: "12" },
      { field: "source_id", before: "cia_factbook", after: "world_bank" },
    ],
  );
});

test("history projection keeps an explicit null for a removed public value", () => {
  assert.deepEqual(
    projectPublicHistoryDiff("indicator", { value: 4.2 }, {}),
    [{ field: "value", before: 4.2, after: null }],
  );
  assert.equal(isAtlasChangeKind("correction"), true);
  assert.equal(isAtlasChangeKind("guess"), false);
});
