import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildRawRetentionManifest,
  canonicalRawRetentionJson,
  rawRetentionErrors,
  type RawRetentionManifest,
} from "../src/lib/data/raw-snapshot-manifest";

const artifactPath = resolve(
  process.cwd(),
  "data/releases/ci-beta-2024-Q4/raw-input-retention-manifest.v1.json",
);
const expected = buildRawRetentionManifest();
const errors = rawRetentionErrors(expected);
let checked: RawRetentionManifest | null = null;
try {
  checked = JSON.parse(readFileSync(artifactPath, "utf8")) as RawRetentionManifest;
} catch (error) {
  errors.push(`cannot read checked retention manifest: ${error instanceof Error ? error.message : String(error)}`);
}
if (checked && canonicalRawRetentionJson(checked) !== canonicalRawRetentionJson(expected)) {
  errors.push("checked retention manifest differs from current capture, coverage, or rights contracts; regenerate and review it");
}

console.log("=== DAT-011 raw-input retention validation ===\n");
console.log(`Named frozen releases: 1`);
console.log(`Raw capture records: ${expected.captures.length}`);
console.log(`Released value groups: ${expected.releasedValueGroups.length}`);
console.log("Unreleased products: Atlas G2, Pulse v2");

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log("\nPASS — every released value group resolves to an immutable byte hash and rights-safe reconstruction record.");
