import { candidateAlternativeCoverageErrors, candidateSpecificationErrors, INDEX_CANDIDATE_SPECIFICATIONS, INDEX_CANDIDATE_SPEC_VERSION } from "../src/lib/ci/candidate-specifications";

const errors = [
  ...candidateSpecificationErrors(INDEX_CANDIDATE_SPECIFICATIONS),
  ...candidateAlternativeCoverageErrors(INDEX_CANDIDATE_SPECIFICATIONS),
];
if (errors.length) {
  console.error(errors.map((error) => `FAIL — ${error}`).join("\n"));
  process.exit(1);
}
console.log(`PASS — ${INDEX_CANDIDATE_SPEC_VERSION} defines ${INDEX_CANDIDATE_SPECIFICATIONS.length} complete, materially distinct candidates including dashboard/no-score.`);
