import assert from "node:assert/strict";
import { longitudinalPreregistrationErrors } from "../src/lib/ci/longitudinal-preregistration";
assert.equal(longitudinalPreregistrationErrors().length, 0);
console.log(
  "PASS — BR event, lead/lag, quiet-noise, and real-edition revision gates are frozen.",
);
