import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PULSE_EVALUATION_SAMPLING_PROTOCOL, pulseEvaluationSamplingErrors } from "../src/lib/pulse/v2/evaluation-sampling";

const errors = pulseEvaluationSamplingErrors();
if (errors.length) throw new Error(errors.join("; "));
const output = resolve("data/research/pulse-evaluation-sampling-protocol-v1.json");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(PULSE_EVALUATION_SAMPLING_PROTOCOL, null, 2)}\n`);
console.log(`Wrote ${output}`);
