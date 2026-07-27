import { writeFileSync } from "node:fs";

import {
  pulseValidationProtocolHash,
  renderPulseValidationProtocol,
} from "../src/lib/pulse/v2/validation-protocol";

const path = "data/research/pulse-validation-protocol-v1.json";
writeFileSync(path, renderPulseValidationProtocol());
console.log(`Wrote ${path}; ${pulseValidationProtocolHash()}.`);
