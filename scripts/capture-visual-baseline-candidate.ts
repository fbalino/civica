import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  VISUAL_BASELINE_MANIFEST_SCHEMA,
  visualBaselineManifestErrors,
  type VisualBaselineManifest,
} from "../src/lib/qa/visual-baseline-manifest";
import {
  captureVisualBaselineRecords,
  visualInputContractSha256,
  VISUAL_CANDIDATE_MANIFEST_PATH,
} from "./visual-baseline-utils";

const author = process.argv.find((arg) => arg.startsWith("--author="))?.slice(9);
const reason = process.argv.find((arg) => arg.startsWith("--reason="))?.slice(9);

if (!author?.trim() || !reason?.trim()) {
  throw new Error("Usage: --author=<name> --reason=<candidate rationale>");
}

const result = spawnSync(
  "npx",
  [
    "playwright",
    "test",
    "e2e/qa-013-visual-regression.spec.ts",
    "--update-snapshots",
    "--workers=1",
    "--retries=0",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, VISUAL_BASELINE_UPDATE: "1" },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const createdAt = new Date().toISOString();
const manifest: VisualBaselineManifest = {
  schemaVersion: VISUAL_BASELINE_MANIFEST_SCHEMA,
  status: "candidate",
  generatedAt: createdAt,
  platform: process.platform,
  inputContractSha256: visualInputContractSha256(),
  records: captureVisualBaselineRecords(),
  candidate: { author: author.trim(), reason: reason.trim(), createdAt },
};
const errors = visualBaselineManifestErrors(manifest, undefined, { requireApproved: false });
if (errors.length) throw new Error(errors.join("\n"));

mkdirSync(dirname(VISUAL_CANDIDATE_MANIFEST_PATH), { recursive: true });
writeFileSync(VISUAL_CANDIDATE_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Captured ${manifest.records.length} candidate visual baselines in ${VISUAL_CANDIDATE_MANIFEST_PATH}.`);
