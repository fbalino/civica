import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildRawRetentionManifest,
  canonicalRawRetentionJson,
  rawRetentionErrors,
} from "../src/lib/data/raw-snapshot-manifest";

const output = resolve(
  process.cwd(),
  "data/releases/ci-beta-2024-Q4/raw-input-retention-manifest.v1.json",
);
const manifest = buildRawRetentionManifest();
const errors = rawRetentionErrors(manifest);
if (errors.length) throw new Error(errors.join("\n"));
writeFileSync(output, canonicalRawRetentionJson(manifest));
console.log(`Wrote ${output}`);
console.log(`Captures: ${manifest.captures.length}; released value groups: ${manifest.releasedValueGroups.length}`);
console.log(`Manifest SHA-256: ${manifest.manifestSha256}`);
