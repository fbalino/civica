import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { INDEX_RESEARCH_CHARTER, INDEX_RESEARCH_CHARTER_PATH, researchCharterErrors } from "./research-charter";

test("research charter covers every governing section", () => {
  assert.deepEqual(researchCharterErrors(readFileSync(INDEX_RESEARCH_CHARTER_PATH, "utf8")), []);
});

test("research charter admits no winner and no incumbent advantage", () => {
  assert.equal(INDEX_RESEARCH_CHARTER.noWinnerAllowed, true);
  assert.equal(INDEX_RESEARCH_CHARTER.currentCompositeIncumbencyAdvantage, false);
  assert.ok(INDEX_RESEARCH_CHARTER.mandatoryBaselines.includes("source-native-dashboard-no-score"));
  assert.equal(INDEX_RESEARCH_CHARTER.retirement.consecutiveRequiredGateFailures, 2);
});
