import assert from "node:assert/strict";
import test from "node:test";

import {
  correctionTriageErrors,
  dataErrorReceiptCode,
  DATA_ERROR_REPORT_CONTRACT,
  REPORTABLE_ATLAS_ENTITY_TYPES,
} from "./data-error-report";

test("receipt codes are stable, opaque, and do not expose the row UUID", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const receipt = dataErrorReceiptCode(id);
  assert.match(receipt, /^CA-[A-F0-9]{12}$/);
  assert.equal(receipt, dataErrorReceiptCode(id));
  assert.ok(!receipt.includes("11111111"));
});

test("the report contract covers every ATL-019 primary entity type", () => {
  assert.equal(DATA_ERROR_REPORT_CONTRACT, "civica-atlas-data-error-report/v1");
  assert.deepEqual(REPORTABLE_ATLAS_ENTITY_TYPES, [
    "fact",
    "institution",
    "office",
    "person",
    "election",
    "constitution-passage",
    "organization",
    "indicator",
  ]);
});

test("corrected resolution requires a public disposition and linked history", () => {
  assert.deepEqual(
    correctionTriageErrors({
      status: "resolved_corrected",
      disposition: "The value was corrected in the next release.",
      linkedChangeCount: 0,
    }),
    [
      "resolved_corrected requires an ATL-020 change-history event linked to this report",
    ],
  );
  assert.deepEqual(
    correctionTriageErrors({
      status: "resolved_corrected",
      disposition: "The value was corrected in the next release.",
      linkedChangeCount: 1,
    }),
    [],
  );
});

test("rejected and no-change reports still require a visible reason", () => {
  assert.equal(
    correctionTriageErrors({
      status: "rejected",
      disposition: null,
      linkedChangeCount: 0,
    }).length,
    1,
  );
  assert.deepEqual(
    correctionTriageErrors({
      status: "in_review",
      disposition: null,
      linkedChangeCount: 0,
    }),
    [],
  );
});
