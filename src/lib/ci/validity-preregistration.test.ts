import assert from "node:assert/strict";
import test from "node:test";
import { INDEX_VALIDITY_PREREGISTRATION, validityPreregistrationErrors } from "./validity-preregistration";
test("validity protocol separates external, undesired, and mechanical associations",()=>{assert.equal(validityPreregistrationErrors().length,0);const changed=structuredClone(INDEX_VALIDITY_PREREGISTRATION) as { hypotheses: { type: string }[] };changed.hypotheses=changed.hypotheses.filter((row)=>row.type!=="undesired_association");assert.ok(validityPreregistrationErrors(changed as unknown as typeof INDEX_VALIDITY_PREREGISTRATION).includes("hypothesis set incomplete"));});
