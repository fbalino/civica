import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PULSE_LEDGER_RESEARCH_CHARTER,
  validatePulseLedgerResearchCharter,
} from "./research-charter";

test("the Pulse ledger charter covers every governing section", () => {
  assert.deepEqual(validatePulseLedgerResearchCharter(PULSE_LEDGER_RESEARCH_CHARTER), []);
  assert.equal(PULSE_LEDGER_RESEARCH_CHARTER.id, "pulse-ledger-charter/v1");
  assert.match(PULSE_LEDGER_RESEARCH_CHARTER.unit.name, /event record/);
  assert.equal(
    PULSE_LEDGER_RESEARCH_CHARTER.sourceUniverse.currentRuntimeReference,
    "/api/v1/pulse/methodology",
  );
});

test("the unit cannot collapse into a country-day score or stability label", () => {
  const excluded = PULSE_LEDGER_RESEARCH_CHARTER.unit.excludedUnits.join(" ");
  const nonClaims = PULSE_LEDGER_RESEARCH_CHARTER.nonClaims.join(" ");
  assert.match(excluded, /country-day stability/);
  assert.match(excluded, /scalar governance score/);
  assert.match(nonClaims, /missing record does not establish stability/i);
  assert.match(nonClaims, /not a country-quality judgment, score, grade, rank/i);
});

test("success cannot compensate for a retirement trigger", () => {
  const success = PULSE_LEDGER_RESEARCH_CHARTER.successCriteria.join(" ");
  const retirement =
    PULSE_LEDGER_RESEARCH_CHARTER.suspensionOrRetirementCriteria.join(" ");
  assert.match(success, /preregistered thresholds/);
  assert.match(success, /adverse findings/);
  assert.match(retirement, /cannot be overridden by model agreement/i);
  assert.match(retirement, /Retire numeric effects/i);
});

test("incomplete charter fixtures fail closed", () => {
  const incomplete = {
    ...PULSE_LEDGER_RESEARCH_CHARTER,
    nonClaims: [],
    successCriteria: [],
    suspensionOrRetirementCriteria: [],
  } as unknown as typeof PULSE_LEDGER_RESEARCH_CHARTER;
  assert.deepEqual(validatePulseLedgerResearchCharter(incomplete), [
    "at least five explicit non-claims are required",
    "success criteria are incomplete",
    "suspension or retirement criteria are incomplete",
  ]);
});
