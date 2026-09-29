/**
 * DAT-037 apply authorization: the explicit public-correction choice and the
 * owner-approval evidence check used by `scripts/repair-cabinet-terms.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  PUBLIC_CORRECTION_WAIVER,
  PUBLIC_CORRECTION_WAIVER_DECISION,
  checkApprovalEvidence,
  parsePublicCorrectionChoice,
  type PublicCorrectionChoice,
} from "../cabinet-repair-authorization";
import { CABINET_REPAIR_METHOD } from "../cabinet-term-repair";

const PLAN_SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);
const WAIVER: PublicCorrectionChoice = {
  kind: "waived_prelaunch",
  flag: PUBLIC_CORRECTION_WAIVER,
  decision: PUBLIC_CORRECTION_WAIVER_DECISION,
};
const RECORD: PublicCorrectionChoice = {
  kind: "correction_record",
  correctionLogId: "4ffdc3a2-012a-4256-ba0c-c4395aab7a4b",
};

test("the prelaunch waiver is accepted only by its exact value", () => {
  assert.deepEqual(parsePublicCorrectionChoice({ publicCorrection: "waived-prelaunch" }), {
    ok: true,
    value: WAIVER,
  });
  for (const value of ["", "waived", "WAIVED-PRELAUNCH", "waived-prelaunch ", "none", "true"]) {
    const result = parsePublicCorrectionChoice({ publicCorrection: value });
    assert.equal(result.ok, false, value);
  }
});

test("a correction record id is still accepted and must be a UUID", () => {
  assert.deepEqual(
    parsePublicCorrectionChoice({ correctionLogId: "4FFDC3A2-012A-4256-BA0C-C4395AAB7A4B" }),
    { ok: true, value: RECORD },
  );
  assert.equal(parsePublicCorrectionChoice({ correctionLogId: "not-a-uuid" }).ok, false);
  assert.equal(parsePublicCorrectionChoice({ correctionLogId: "" }).ok, false);
});

test("apply refuses no choice and refuses both choices", () => {
  const none = parsePublicCorrectionChoice({});
  assert.equal(none.ok, false);
  if (!none.ok) assert.match(none.reason, /--public-correction=waived-prelaunch/);
  const both = parsePublicCorrectionChoice({
    publicCorrection: "waived-prelaunch",
    correctionLogId: RECORD.correctionLogId,
  });
  assert.equal(both.ok, false);
});

test("approval evidence must be non-empty, name the method, and contain the plan SHA-256", () => {
  const good = `Approved ${CABINET_REPAIR_METHOD} under ${PUBLIC_CORRECTION_WAIVER_DECISION}.\nPlan SHA-256: ${PLAN_SHA}\n`;
  const expected = { planSha256: PLAN_SHA, methodologyVersion: CABINET_REPAIR_METHOD, choice: WAIVER };
  assert.deepEqual(checkApprovalEvidence(good, expected), { ok: true, value: { planSha256: PLAN_SHA } });

  assert.equal(checkApprovalEvidence("   \n", expected).ok, false);
  assert.equal(checkApprovalEvidence(good.replace(CABINET_REPAIR_METHOD, "cabinet-term-integrity-repair/v1"), expected).ok, false);
  assert.equal(checkApprovalEvidence(good.replace(PLAN_SHA, OTHER_SHA), expected).ok, false);
  // A digest embedded in a longer hex run is not the plan SHA-256.
  assert.equal(checkApprovalEvidence(good.replace(PLAN_SHA, `${PLAN_SHA}0`), expected).ok, false);
  assert.equal(checkApprovalEvidence(good, { ...expected, planSha256: "A".repeat(64) }).ok, false);
});

test("the waiver needs an approval file that records APR-D173; a correction record does not", () => {
  const withoutDecision = `Approved ${CABINET_REPAIR_METHOD}.\nPlan SHA-256: ${PLAN_SHA}\n`;
  const base = { planSha256: PLAN_SHA, methodologyVersion: CABINET_REPAIR_METHOD };
  assert.equal(checkApprovalEvidence(withoutDecision, { ...base, choice: WAIVER }).ok, false);
  assert.equal(checkApprovalEvidence(withoutDecision, { ...base, choice: RECORD }).ok, true);
});

test("the checked-in owner approval passes once the operator appends the plan SHA-256", () => {
  const path = resolve(process.cwd(), "plan/evidence/DAT-037/OWNER-APPROVAL-2026-09-29.md");
  const text = readFileSync(path, "utf8");
  const expected = { planSha256: PLAN_SHA, methodologyVersion: CABINET_REPAIR_METHOD, choice: WAIVER };
  assert.equal(checkApprovalEvidence(text, expected).ok, false, "no plan SHA-256 is pre-approved");
  const appended = `${text}\nProduction plan SHA-256: ${PLAN_SHA}\n`;
  assert.deepEqual(checkApprovalEvidence(appended, expected), {
    ok: true,
    value: { planSha256: PLAN_SHA },
  });
});
