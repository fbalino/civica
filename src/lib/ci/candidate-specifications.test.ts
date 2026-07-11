import assert from "node:assert/strict";
import test from "node:test";
import { candidateAlternativeCoverageErrors, candidateSpecificationErrors, INDEX_CANDIDATE_SPECIFICATIONS } from "./candidate-specifications";

test("candidate set is complete and materially distinct", () => {
  assert.deepEqual(candidateSpecificationErrors(INDEX_CANDIDATE_SPECIFICATIONS), []);
  assert.equal(INDEX_CANDIDATE_SPECIFICATIONS.length, 6);
});

test("candidate set contains the no-score floor and non-quality alternatives", () => {
  assert.ok(INDEX_CANDIDATE_SPECIFICATIONS.some((candidate) => candidate.kind === "no-score-reference"));
  assert.ok(INDEX_CANDIDATE_SPECIFICATIONS.some((candidate) => candidate.kind === "fact-ledger"));
  assert.ok(INDEX_CANDIDATE_SPECIFICATIONS.some((candidate) => candidate.kind === "institutional-structure"));
  assert.ok(INDEX_CANDIDATE_SPECIFICATIONS.every((candidate) => candidate.hiddenCountryQualityGrade === false));
  assert.deepEqual(candidateAlternativeCoverageErrors(INDEX_CANDIDATE_SPECIFICATIONS), []);
});

test("an incomplete cosmetic candidate set fails closed", () => {
  const duplicate = { ...INDEX_CANDIDATE_SPECIFICATIONS[1], id: "bad-copy" };
  const errors = candidateSpecificationErrors([INDEX_CANDIDATE_SPECIFICATIONS[1], duplicate]);
  assert.ok(errors.includes("fewer than four candidates"));
  assert.ok(errors.includes("dashboard/no-score candidate missing"));
  assert.ok(errors.includes("candidate kinds are not materially distinct"));
  assert.ok(errors.includes("candidate constructs are duplicated"));
});

test("alternative coverage fails without provenance-native and structural candidates", () => {
  const dashboardAndComposite = INDEX_CANDIDATE_SPECIFICATIONS.filter((candidate) => candidate.id === "K0" || candidate.id === "K1");
  assert.deepEqual(candidateAlternativeCoverageErrors(dashboardAndComposite), [
    "no provenance-native disagreement or fact alternative",
    "no institutional-structure alternative",
  ]);
});
