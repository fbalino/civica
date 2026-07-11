import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIndexValidityAnalysis } from "./generate-index-validity-analysis";
import {
  INDEX_VALIDITY_PREREGISTRATION,
  validityPreregistrationErrors,
} from "../src/lib/ci/validity-preregistration";
async function main() {
  assert.equal(validityPreregistrationErrors().length, 0);
  const stored = JSON.parse(
    readFileSync(
      "data/releases/index-validity-analysis-v1/result.v1.json",
      "utf8",
    ),
  );
  const result = await buildIndexValidityAnalysis();
  assert.deepEqual(result, stored);
  assert.deepEqual(
    result.hypotheses.map((h) => h.id),
    ["H1", "H2", "H3", "H4"],
  );
  for (const h of result.hypotheses) {
    assert.equal(h.interval.iterationsRequested, 2000);
    assert.ok(h.interval.iterationsValid >= 1900);
    assert.ok(
      h.interval.lower95 <= h.estimate && h.estimate <= h.interval.upper95,
    );
  }
  assert.equal(result.noCandidatePassesFromInputSimilarity, true);
  assert.ok(
    result.mechanicalAssociations.every(
      (row) =>
        row.interpretation === "mechanical_input_association_not_validity",
    ),
  );
  assert.equal(result.candidateValidity.K3, "insufficient_external_labels");
  assert.equal(
    result.candidateValidity.K4,
    "insufficient_blinded_scholar_labels",
  );
  assert.equal(
    result.candidateValidity.K5,
    "insufficient_double_coded_expert_labels",
  );
  assert.equal(
    INDEX_VALIDITY_PREREGISTRATION.status,
    "locked_before_validity_correlations",
  );
  console.log(
    `PASS — H1-H4 reproduce at ${result.resultSha256}; input similarity cannot pass validity and K3-K5 remain insufficient.`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
