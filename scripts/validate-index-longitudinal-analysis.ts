import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIndexLongitudinalAnalysis } from "./generate-index-longitudinal-analysis";
import { longitudinalPreregistrationErrors } from "../src/lib/ci/longitudinal-preregistration";
async function main() {
  assert.equal(longitudinalPreregistrationErrors().length, 0);
  const stored = JSON.parse(
    readFileSync(
      "data/releases/index-longitudinal-analysis-v1/result.v1.json",
      "utf8",
    ),
  );
  const r = await buildIndexLongitudinalAnalysis();
  assert.deepEqual(r, stored);
  assert.equal(r.responsiveness.directionInterval.iterationsRequested, 2000);
  assert.equal(r.quiet.medianInterval.iterationsRequested, 2000);
  assert.equal(r.leadLag.rows.length, 5);
  assert.ok(Number.isFinite(r.autocorrelation.levelLag1));
  assert.ok(Number.isFinite(r.autocorrelation.changeLag1));
  assert.equal(r.leadLag.passes, true);
  assert.equal(r.revision.vdemPasses, true);
  assert.equal(r.revision.qogPasses, false);
  assert.equal(r.noCausalClaim, true);
  console.log(
    `PASS — ${r.responsiveness.events} BR events reproduce at ${r.resultSha256}; responsiveness/quiet/V-Dem gates pass and the QoG edition-stability gate fails visibly.`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
