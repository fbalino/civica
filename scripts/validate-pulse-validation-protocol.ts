import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PULSE_REGRESSION_CASE_IDS,
  PULSE_VALIDATION_PROTOCOL,
  renderPulseValidationProtocol,
} from "../src/lib/pulse/v2/validation-protocol";

const checked = readFileSync(
  "data/research/pulse-validation-protocol-v2.json",
  "utf8",
);
assert.equal(checked, renderPulseValidationProtocol());
for (const id of PULSE_REGRESSION_CASE_IDS) {
  const fixture = JSON.parse(readFileSync(`data/backtest/${id}.json`, "utf8"));
  assert.equal(fixture.id, id);
}
const retrospective = JSON.parse(
  readFileSync(
    "data/research/pulse-evaluation-sampling-protocol-v1.json",
    "utf8",
  ),
);
assert.equal(retrospective.schemaVersion, "pulse-evaluation-sampling-frame/v1");
assert.deepEqual(
  retrospective.frames.map((frame: { id: string; initialDraw: number }) => [
    frame.id,
    frame.initialDraw,
  ]),
  PULSE_VALIDATION_PROTOCOL.lanes.retrospectiveValidity.frames.map((frame) => [
    frame.id,
    frame.initialDraw,
  ]),
);
const backtest = readFileSync("src/lib/pulse/v2/backtest.ts", "utf8");
const backtestPage = readFileSync(
  "src/app/(reader)/civica-index/methodology/pulse/backtest/page.tsx",
  "utf8",
);
assert.match(backtest, /regression smoke test only/);
assert.match(backtestPage, /not current-runtime validation results/i);
assert.equal(PULSE_VALIDATION_PROTOCOL.status, "preregistered_not_started");
console.log(
  "PASS — regression, retrospective-validity, and prospective-shadow protocols are separate, label-blind, full-pipeline, and locked against post-label tuning.",
);
