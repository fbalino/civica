import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { K4_PAIRING_CONTRACT } from "../src/lib/ci/tournament-candidate-k4";
import { buildK4PairingPrototype } from "./generate-k4-pairing-prototype";

async function main() {
  const stored = JSON.parse(readFileSync("data/releases/k4-constitution-practice-pairings-2024-v1/manifest.v1.json", "utf8"));
  const { outputs, manifest } = await buildK4PairingPrototype();
  assert.deepEqual(manifest, stored);
  assert.equal(outputs.length, 194 * 3);
  assert.equal(manifest.confirmatoryLabelsInspected, false);
  assert.match(manifest.validationStatus, /^pending_/);
  for (const output of outputs) {
    const unsafe = output as unknown as Record<string, unknown>;
    for (const field of ["score", "rank", "grade", "gap", "tier", "hypocrisy"]) assert.equal(unsafe[field], undefined);
    if (output.practiceEvidence.value !== null) {
      assert.notEqual(output.practiceEvidence.uncertaintyLower, null);
      assert.notEqual(output.practiceEvidence.uncertaintyUpper, null);
    }
  }
  assert.equal(K4_PAIRING_CONTRACT.validation.independentCoders, 2);
  console.log(`PASS — K4 reproduces ${outputs.length} nonaggregated candidate rows at ${manifest.outputSha256}; human gates remain pending.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
