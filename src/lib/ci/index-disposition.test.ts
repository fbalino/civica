import assert from "node:assert/strict";
import test from "node:test";
import { INDEX_DISPOSITION, INDEX_DISPOSITION_SHA256, indexDispositionErrors } from "./index-disposition";

test("disposition selects K0 without deleting the unresolved K1 research question", () => {
  assert.deepEqual(indexDispositionErrors(), []);
  assert.match(INDEX_DISPOSITION_SHA256, /^[a-f0-9]{64}$/);
  assert.equal(INDEX_DISPOSITION.selectedDisposition, "source_native_dashboard_only");
  assert.match(INDEX_DISPOSITION.k1Composite.standing, /retained_versioned_research/);
  assert.match(INDEX_DISPOSITION.rejectedAlternatives.permanentResearchRetirement, /not_selected/);
});

test("disposition retains failed tests, minority arguments, limitations, and reconsideration rules", () => {
  assert.ok(INDEX_DISPOSITION.failedTests.length >= 3);
  assert.ok(INDEX_DISPOSITION.minorityArguments.length >= 3);
  assert.ok(INDEX_DISPOSITION.limitations.length >= 4);
  assert.ok(INDEX_DISPOSITION.reconsiderationCriteria.every((criterion) => criterion.length > 20));
});
