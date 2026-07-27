import { readFileSync } from "node:fs";

import {
  buildVerificationMatrix,
  renderVerificationMatrix,
  verificationMatrixErrors,
} from "../src/lib/qa/verification-matrix";
import { verificationMatrixInputs } from "./verification-matrix-source";

const inputs = verificationMatrixInputs();
const matrix = buildVerificationMatrix(inputs);
const errors = verificationMatrixErrors(matrix, inputs);
const rendered = renderVerificationMatrix(inputs);
const artifact = readFileSync("data/verification-matrix.v1.json", "utf8");
if (artifact !== rendered) errors.push("checked matrix artifact is stale; run npm run generate:verification-matrix");
const researchSummary = readFileSync("plan/research/qa-verification-matrix-v1.md", "utf8");
if (!researchSummary.includes(matrix.semanticHash)) {
  errors.push("research summary lacks the checked semantic hash");
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `PASS — ${matrix.schemaVersion}: ${matrix.entries.length} critical surfaces are registered with five coverage layers and linked gaps.`,
);
