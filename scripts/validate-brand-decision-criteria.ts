import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BRAND_NAME_DECISION_CONTRACT,
  brandNameDecisionContractErrors,
  brandNameDecisionContractHash,
  renderBrandNameDecisionCriteriaMarkdown,
} from "../src/lib/brand/decision-criteria";

const POLICY_PATH = "plan/research/brand-keep-rename-decision-criteria-v1.md";

assert.deepEqual(brandNameDecisionContractErrors(), []);
assert.equal(
  readFileSync(POLICY_PATH, "utf8"),
  renderBrandNameDecisionCriteriaMarkdown(),
  `${POLICY_PATH} drifted from the adopted BRD-004 contract`,
);
assert.deepEqual(BRAND_NAME_DECISION_CONTRACT.conclusions, {
  currentNameAssessed: false,
  recommendation: null,
  legalConclusion: null,
});

console.log(
  `PASS — ${BRAND_NAME_DECISION_CONTRACT.schemaVersion}: ${BRAND_NAME_DECISION_CONTRACT.criteria.length} criteria, weights=100, preference<=5, conclusions=none, ${brandNameDecisionContractHash()}.`,
);
