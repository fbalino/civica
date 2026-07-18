import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  expectedVisualBaselines,
  type VisualBaselineManifest,
  type VisualBaselineRecord,
} from "../src/lib/qa/visual-baseline-manifest";

export const VISUAL_SNAPSHOT_DIR =
  "e2e/qa-013-visual-regression.spec.ts-snapshots";
export const VISUAL_CANDIDATE_MANIFEST_PATH =
  "e2e/visual-baselines/candidate-manifest.json";
export const VISUAL_APPROVED_MANIFEST_PATH =
  "e2e/visual-baselines/manifest.json";
const VISUAL_BROWSER_PROJECT = "chromium";
const VISUAL_INPUT_CONTRACT_PATH = "src/lib/qa/visual-regression-contract.ts";

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function visualInputContractSha256(): string {
  return sha256File(VISUAL_INPUT_CONTRACT_PATH);
}

export function captureVisualBaselineRecords(
  platform: string = process.platform,
): VisualBaselineRecord[] {
  if (!existsSync(VISUAL_SNAPSHOT_DIR)) {
    throw new Error(`No screenshot directory exists at ${VISUAL_SNAPSHOT_DIR}.`);
  }
  const expected = expectedVisualBaselines().map((record) => ({
    ...record,
    browserProject: VISUAL_BROWSER_PROJECT,
    path: `${record.caseId}-${VISUAL_BROWSER_PROJECT}-${platform}.png`,
  }));
  const actual = readdirSync(VISUAL_SNAPSHOT_DIR)
    .filter((entry) => entry.endsWith(".png"))
    .sort();
  const expectedPaths = expected.map((record) => record.path).sort();
  const missing = expectedPaths.filter((path) => !actual.includes(path));
  const unexpected = actual.filter((path) => !expectedPaths.includes(path));
  if (missing.length || unexpected.length) {
    throw new Error(
      [
        `Expected ${expectedPaths.length} visual baseline images; found ${actual.length}.`,
        missing.length ? `Missing: ${missing.join(", ")}` : "",
        unexpected.length ? `Unexpected: ${unexpected.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return expected.map((record) => ({
    ...record,
    sha256: sha256File(join(VISUAL_SNAPSHOT_DIR, record.path)),
  }));
}

export function manifestFileErrors(manifest: VisualBaselineManifest): string[] {
  const errors: string[] = [];
  for (const record of manifest.records) {
    const path = join(VISUAL_SNAPSHOT_DIR, record.path);
    if (!existsSync(path)) {
      errors.push(`${record.caseId}: baseline image is missing`);
      continue;
    }
    if (sha256File(path) !== record.sha256) {
      errors.push(`${record.caseId}: baseline image hash differs from manifest`);
    }
  }
  return errors;
}
