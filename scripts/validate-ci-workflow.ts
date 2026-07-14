import { readFileSync } from "node:fs";

import {
  CANONICAL_CI_WORKFLOW,
  ciScriptGraphErrors,
  ciTransitiveGateErrors,
  ciWorkflowCommandListing,
  ciWorkflowErrors,
} from "../src/lib/platform/ci-workflow-contract";
import { CLAIMS_DOCS_GATE_MANIFEST } from "../src/lib/ci/claims-docs-gate";

const source = readFileSync(CANONICAL_CI_WORKFLOW, "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};
const errors = [
  ...ciWorkflowErrors(source),
  ...ciScriptGraphErrors(packageJson.scripts ?? {}),
  ...ciTransitiveGateErrors(CLAIMS_DOCS_GATE_MANIFEST.checks),
];

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  console.error(`FAIL — ${errors.length} canonical CI contract problem(s).`);
  process.exit(1);
}

console.log(
  "PASS — canonical CI is exact, fork-safe, credential-free, and fail-closed.",
);

if (process.argv.includes("--list")) {
  console.log("Required verify commands, in execution order:");
  for (const [index, command] of ciWorkflowCommandListing(source).entries()) {
    console.log(`${index + 1}. ${command}`);
  }
}
