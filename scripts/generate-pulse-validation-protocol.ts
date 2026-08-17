import { writeFileSync } from "node:fs";

import {
  pulseValidationProtocolHash,
  renderPulseValidationProtocol,
} from "../src/lib/pulse/v2/validation-protocol";

// v2 supersedes v1 pre-start; the v1 artifact is preserved and never rewritten.
const path = "data/research/pulse-validation-protocol-v2.json";
writeFileSync(path, renderPulseValidationProtocol());
console.log(`Wrote ${path}; ${pulseValidationProtocolHash()}.`);
