import assert from "node:assert/strict";
import test from "node:test";

import {
  QA_011_OPERATOR_JOURNEYS,
  qa011OperatorJourneyErrors,
} from "./operator-journeys";

test("QA-011 registers every isolated operator journey once", () => {
  assert.deepEqual(qa011OperatorJourneyErrors(), []);
  assert.equal(QA_011_OPERATOR_JOURNEYS.length, 5);
});

test("QA-011 rejects missing journey coverage and duplicate fixtures", () => {
  assert.match(
    qa011OperatorJourneyErrors(QA_011_OPERATOR_JOURNEYS.slice(1)).join(" "),
    /missing required operator journey: admin-session-and-safe-mutation/,
  );
  const duplicate = [
    ...QA_011_OPERATOR_JOURNEYS,
    {
      id: "duplicate",
      outcome: "duplicate fixture control",
      tests: ["src/lib/admin/password.test.ts"],
    },
  ] as const;
  assert.match(qa011OperatorJourneyErrors(duplicate).join(" "), /duplicate test file/);
});
