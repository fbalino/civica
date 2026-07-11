import assert from "node:assert/strict";
import { incrementalPreregistrationErrors } from "../src/lib/ci/incremental-information-preregistration";
assert.equal(incrementalPreregistrationErrors().length, 0);
console.log(
  "PASS — K1 nested held-out comparators and the adverse R2 >= 0.90 originality rule are frozen.",
);
