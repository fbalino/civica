import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVISORY_APPLICATION_POLICY,
  advisoryApplicationRetentionDeadline,
  validateAdvisoryApplication,
  type AdvisoryApplicationInput,
} from "./advisory-application";

const VALID: AdvisoryApplicationInput = {
  name: "Ada Example",
  email: "ada@example.edu",
  institution: "Independent",
  role: "Research-data curator",
  expertiseArea: "Reproducibility and preservation",
  experience: "I maintain versioned research datasets and review preservation workflows.",
  links: "https://example.edu/profile",
  cvUrl: "https://example.edu/cv.pdf",
  consent: true,
};

test("a complete consented application passes the shared contract", () => {
  assert.deepEqual(validateAdvisoryApplication(VALID), {});
});

test("consent, bounded experience, and safe CV schemes fail closed", () => {
  const errors = validateAdvisoryApplication({ ...VALID, consent: false, experience: "short", cvUrl: "javascript:alert(1)" });
  assert.ok(errors.consent);
  assert.ok(errors.experience);
  assert.ok(errors.cvUrl);
});

test("retention is a fixed 18-month application deadline", () => {
  assert.equal(ADVISORY_APPLICATION_POLICY.retentionMonths, 18);
  assert.equal(advisoryApplicationRetentionDeadline(new Date("2026-07-11T00:00:00Z")).toISOString(), "2028-01-11T00:00:00.000Z");
});
