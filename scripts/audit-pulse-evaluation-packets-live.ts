import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  auditPulseEvaluationPacketLiveDifferences,
  pulseEvaluationPacketReleaseErrors,
  type PulseEvaluationPacketFrozenInputs,
  type PulseEvaluationPacketManifest,
  type PulseEvaluationPacketPopulationReference,
} from "../src/lib/pulse/v2/evaluation-packets";
import { loadPulseEvaluationPacketInputsFromDatabase } from "./generate-pulse-evaluation-packets";

const frozenInputs = JSON.parse(
  readFileSync("data/research/pulse-evaluation-packet-frozen-inputs-v1.json", "utf8"),
) as PulseEvaluationPacketFrozenInputs;
const checkedManifest = JSON.parse(
  readFileSync("data/research/pulse-evaluation-packet-manifest-v1.json", "utf8"),
) as PulseEvaluationPacketManifest;
const population = JSON.parse(
  readFileSync("data/research/pulse-evaluation-frame-population-v1.json", "utf8"),
) as PulseEvaluationPacketPopulationReference;

async function main() {
  assert.deepEqual(
    pulseEvaluationPacketReleaseErrors({ frozenInputs, manifest: checkedManifest, population }),
    [],
    "the frozen release must validate before live state is compared",
  );
  const live = await loadPulseEvaluationPacketInputsFromDatabase();
  const report = auditPulseEvaluationPacketLiveDifferences({
    frozenInputs,
    checkedManifest,
    liveEventCandidates: live.eventCandidates,
    liveSystemNegativePopulation: live.systemNegativePopulation,
  });
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), ...report }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
