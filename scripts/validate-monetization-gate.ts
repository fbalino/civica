/**
 * BRD-009 — release gate. Fails closed when a commercial/fee-bearing
 * deployment is configured while non-commercial-only sources are active.
 */
import {
  monetizationGateErrors,
  nonCommercialSources,
  isCommercialPosture,
} from "../src/lib/rights/monetization-gate";

const errors = monetizationGateErrors();
const nc = nonCommercialSources().map((r) => r.sourceId);

console.log(
  `Non-commercial-only sources (${nc.length}): ${nc.join(", ") || "none"}`,
);
console.log(
  `Deployment posture: ${isCommercialPosture(process.env) ? "commercial/fee-bearing" : "non-commercial/no-fee"}`,
);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  console.error("\nFAIL — non-commercial-source monetization gate.");
  process.exit(1);
}

console.log("PASS — monetization gate: no commercial use of restricted sources.");
