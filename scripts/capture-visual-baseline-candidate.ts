import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
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
if (existsSync(VISUAL_CANDIDATE_MANIFEST_PATH)) {
  unlinkSync(VISUAL_CANDIDATE_MANIFEST_PATH);
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

let records: VisualBaselineManifest["records"];
try {
  records = captureVisualBaselineRecords();
} catch (error) {
  if (error instanceof Error && error.message.startsWith("Expected ")) {
    const phase = process.env.E2E_PERFORMANCE_FIXTURE_DB === "1"
      ? "fixture-backed"
      : "credential-free";
    console.log(
      `Captured the ${phase} phase. Run the complementary phase before a candidate manifest can be written.`,
    );
    process.exit(0);
  }
  throw error;
}

const createdAt = new Date().toISOString();
const manifest: VisualBaselineManifest = {
  schemaVersion: VISUAL_BASELINE_MANIFEST_SCHEMA,
  status: "candidate",
  generatedAt: createdAt,
  platform: process.platform,
  inputContractSha256: visualInputContractSha256(),
  records,
  candidate: { author: author.trim(), reason: reason.trim(), createdAt },
};
const errors = visualBaselineManifestErrors(manifest, undefined, { requireApproved: false });
if (errors.length) throw new Error(errors.join("\n"));

mkdirSync(dirname(VISUAL_CANDIDATE_MANIFEST_PATH), { recursive: true });
writeFileSync(VISUAL_CANDIDATE_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Captured ${manifest.records.length} candidate visual baselines in ${VISUAL_CANDIDATE_MANIFEST_PATH}.`);
