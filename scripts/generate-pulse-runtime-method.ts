/**
 * Generate the checked Pulse runtime-method snapshot.
 *
 * Usage:
 *   npx tsx scripts/generate-pulse-runtime-method.ts
 *   npx tsx scripts/generate-pulse-runtime-method.ts --check
 *
 * The output is deterministic: object keys are recursively sorted, arrays
 * retain their contract-defined semantic order, and no wall-clock timestamp
 * is included. `contractHash` is SHA-256 over the canonical contract body
 * before that hash field is attached.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  createPulseRuntimeMethodSnapshot,
  renderPulseRuntimeMethodSnapshot,
} from "../src/lib/pulse/v2/runtime-contract";

const OUTPUT_PATH = fileURLToPath(
  new URL("../src/lib/pulse/v2/runtime-method.generated.json", import.meta.url),
);

function parseArgs(argv: readonly string[]): { check: boolean } {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      [
        "Generate Civica Pulse's deterministic runtime-method snapshot.",
        "",
        "Usage:",
        "  npx tsx scripts/generate-pulse-runtime-method.ts",
        "  npx tsx scripts/generate-pulse-runtime-method.ts --check",
      ].join("\n"),
    );
    process.exit(0);
  }
  const unknown = args.filter((arg) => arg !== "--check");
  if (unknown.length > 0) {
    throw new Error(`Unknown argument${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`);
  }
  return { check: args.includes("--check") };
}

function main(): void {
  const { check } = parseArgs(process.argv);
  const snapshot = createPulseRuntimeMethodSnapshot();
  const rendered = renderPulseRuntimeMethodSnapshot(snapshot);

  if (check) {
    let existing = "";
    try {
      existing = readFileSync(OUTPUT_PATH, "utf8");
    } catch {
      console.error(`Pulse runtime-method snapshot is missing: ${OUTPUT_PATH}`);
      process.exitCode = 1;
      return;
    }
    if (existing !== rendered) {
      console.error(
        "Pulse runtime-method snapshot is stale. Run: npx tsx scripts/generate-pulse-runtime-method.ts",
      );
      process.exitCode = 1;
      return;
    }
    console.log(`Pulse runtime-method snapshot is current (${snapshot.contractHash}).`);
    return;
  }

  writeFileSync(OUTPUT_PATH, rendered, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`contractHash ${snapshot.contractHash}`);
}

main();
