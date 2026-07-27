import { writeFileSync } from "node:fs";

import { renderVerificationMatrix } from "../src/lib/qa/verification-matrix";
import { verificationMatrixInputs } from "./verification-matrix-source";

const target = "data/verification-matrix.v1.json";
writeFileSync(target, renderVerificationMatrix(verificationMatrixInputs()));
console.log(`Wrote ${target}`);
