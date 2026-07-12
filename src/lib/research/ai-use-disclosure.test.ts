import assert from "node:assert/strict";
import test from "node:test";
import { AI_USE_DISCLOSURE, aiUseDisclosureErrors } from "./ai-use-disclosure";

test("AI-use disclosure closes all material roles and limitations", () => {
  assert.deepEqual(aiUseDisclosureErrors(), []);
  assert.equal(AI_USE_DISCLOSURE.uses.length, 8);
  for (const use of AI_USE_DISCLOSURE.uses) assert.ok(use.controls && use.limitation);
});

test("agent labels and audits cannot become human review", () => {
  const serialized = JSON.stringify(AI_USE_DISCLOSURE);
  assert.match(serialized, /permanently ineligible for gold labels/);
  assert.match(serialized, /never described as peer review/);
  assert.match(serialized, /not authors, independent peer reviewers/);
});
