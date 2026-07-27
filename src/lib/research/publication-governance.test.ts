import assert from "node:assert/strict";
import test from "node:test";
import {
  GOVERNANCE_DOMAINS,
  PUBLICATION_GOVERNANCE_CHARTER,
  publicationGovernanceErrors,
} from "./publication-governance";

test("governance charter closes every required decision domain", () => {
  assert.deepEqual(publicationGovernanceErrors(), []);
  assert.deepEqual(
    PUBLICATION_GOVERNANCE_CHARTER.decisions.map(({ domain }) => domain),
    [...GOVERNANCE_DOMAINS],
  );
});

test("every decision names Fernando and records evidence and a stop condition", () => {
  for (const row of PUBLICATION_GOVERNANCE_CHARTER.decisions) {
    assert.equal(row.accountable, "Fernando Baliño");
    assert.ok(row.requiredEvidence.length > 40);
    assert.ok(row.stopCondition.length > 40);
  }
});

test("agents cannot approve, publish, spend, or restore", () => {
  const rules = PUBLICATION_GOVERNANCE_CHARTER.authorityRules.join(" ");
  for (const boundary of ["no authorship", "approval", "spending", "publication", "emergency-restoration"])
    assert.match(rules, new RegExp(boundary));
});
