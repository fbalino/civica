import assert from "node:assert/strict";
import { INDEX_VALIDITY_PREREGISTRATION, validityPreregistrationErrors } from "../src/lib/ci/validity-preregistration";
assert.equal(validityPreregistrationErrors().length,0);assert.equal(INDEX_VALIDITY_PREREGISTRATION.inputs.panelReleaseId,"ci-research-panel-2000-2024-v3");console.log("PASS — five validity hypotheses are locked and mechanical input correlations cannot count as validity.");
