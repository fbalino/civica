/**
 * Deep-equality proof for CLM-016's "Done when" clause: a simulated
 * correction produces the exact changelog, supersession marker, and
 * release-note objects specified in the OP48 contract §7.5. Pure,
 * in-memory — no DB, no network, no clock.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  simulateCorrection,
  FIXTURE_CORRECTION,
  EXPECTED_CORRECTION,
  FIXTURE_RETRACTION,
  EXPECTED_RETRACTION,
  FIXTURE_CLARIFICATION,
  EXPECTED_CLARIFICATION,
} from "../correction-simulator";

test("correction fixture matches the frozen §7.5 changelog/supersession/release-note", () => {
  assert.deepStrictEqual(simulateCorrection(FIXTURE_CORRECTION), EXPECTED_CORRECTION);
});

test("retraction: no successor, retractedAt present, release note has no supersedes", () => {
  const result = simulateCorrection(FIXTURE_RETRACTION);
  assert.deepStrictEqual(result, EXPECTED_RETRACTION);
  assert.equal(result.supersession?.kind, "retraction");
  assert.equal(result.supersession?.toVersion, result.supersession?.fromVersion);
  assert.ok(result.supersession?.retractedAt);
  assert.equal(result.releaseNote?.supersedes, null);
  assert.match(result.releaseNote?.headline ?? "", /RETRACTED/);
});

test("clarification: no supersession marker, no version bump", () => {
  const result = simulateCorrection(FIXTURE_CLARIFICATION);
  assert.deepStrictEqual(result, EXPECTED_CLARIFICATION);
  assert.equal(result.supersession, null);
  assert.equal(result.releaseNote, null);
  assert.equal(result.changelog?.type, "clarification");
  assert.equal(result.changelog?.severity, "editorial");
  assert.equal(result.changelog?.version, FIXTURE_CLARIFICATION.fromVersion);
});

test("no-change: changelog only, null severity, no version bump", () => {
  const result = simulateCorrection({
    artifactId: "civica-index",
    fromVersion: "v2.1",
    toVersion: "v2.1",
    disposition: "no-change",
    severity: null,
    summary: "Reviewed; the published Rule of Law input is correct as submitted.",
    correctionLogId: "33333333-3333-3333-3333-333333333333",
    effectiveDate: "2026-07-10",
  });
  assert.equal(result.changelog?.type, "no-change");
  assert.equal(result.changelog?.severity, null);
  assert.equal(result.changelog?.version, "v2.1");
  assert.equal(result.supersession, null);
  assert.equal(result.releaseNote, null);
});

test("rejected: no changelog, no supersession, no release note", () => {
  const result = simulateCorrection({
    artifactId: "civica-index",
    fromVersion: "v2.1",
    toVersion: "v2.1",
    disposition: "rejected",
    severity: null,
    summary: "Out of scope: not a Civica Index input.",
    correctionLogId: "44444444-4444-4444-4444-444444444444",
    effectiveDate: "2026-07-10",
  });
  assert.deepStrictEqual(result, {
    changelog: null,
    supersession: null,
    releaseNote: null,
  });
});
