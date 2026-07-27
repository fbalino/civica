import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  currentIndexSnapshot,
  indexChangeControlErrors,
  stagedIndexSnapshot,
  type IndexChangeRegistry,
} from "../src/lib/ci/index-change-control";

const path = "data/releases/index-change-control-v1/registry.v1.json";
const registry = JSON.parse(readFileSync(path, "utf8")) as IndexChangeRegistry;
const snapshot = process.argv.includes("--staged")
  ? stagedIndexSnapshot()
  : currentIndexSnapshot();
const errors = indexChangeControlErrors(registry, snapshot);
if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

const latest = registry.entries.at(-1)!;
console.log(`PASS — ${registry.schemaVersion}: ${latest.toVersion} binds ${latest.protectedFiles.length} protected files and ${latest.validations.length} required validations.`);

if (process.argv.includes("--run")) {
  for (const command of latest.validations) {
    if (!/^[a-z0-9:-]+$/.test(command) || command.startsWith("validate:index-change-control")) throw new Error(`Unsafe or recursive validation command: ${command}`);
    console.log(`\n=== npm run ${command} ===`);
    execFileSync("npm", ["run", command], { cwd: process.cwd(), stdio: "inherit" });
  }
  console.log(`\nPASS — reran all ${latest.validations.length} declared Index validations.`);
}
