import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  visualBaselineManifestErrors,
  type VisualBaselineManifest,
} from "../src/lib/qa/visual-baseline-manifest";
import {
  manifestFileErrors,
  VISUAL_APPROVED_MANIFEST_PATH,
  VISUAL_CANDIDATE_MANIFEST_PATH,
} from "./visual-baseline-utils";

const reviewer = process.argv.find((arg) => arg.startsWith("--reviewer="))?.slice(11);
const reason = process.argv.find((arg) => arg.startsWith("--reason="))?.slice(9);

if (process.env.VISUAL_BASELINE_APPROVE !== "1") {
  throw new Error("Refusing approval without VISUAL_BASELINE_APPROVE=1.");
}
if (!reviewer?.trim() || !reason?.trim()) {
  throw new Error("Usage: --reviewer=<name> --reason=<review rationale>");
}
if (!existsSync(VISUAL_CANDIDATE_MANIFEST_PATH)) {
  throw new Error(`Missing candidate manifest: ${VISUAL_CANDIDATE_MANIFEST_PATH}`);
}

const candidate = JSON.parse(
  readFileSync(VISUAL_CANDIDATE_MANIFEST_PATH, "utf8"),
) as VisualBaselineManifest;
const candidateErrors = [
  ...visualBaselineManifestErrors(candidate, undefined, { requireApproved: false }),
  ...manifestFileErrors(candidate),
];
if (candidate.status !== "candidate") {
  candidateErrors.push("candidate manifest must have candidate status");
}
if (candidateErrors.length) throw new Error([...new Set(candidateErrors)].join("\n"));

const manifest: VisualBaselineManifest = {
  ...candidate,
  status: "approved",
  approval: {
    reviewer: reviewer.trim(),
    reason: reason.trim(),
    approvedAt: new Date().toISOString(),
  },
};
const errors = visualBaselineManifestErrors(manifest, undefined, { requireApproved: true });
if (errors.length) throw new Error(errors.join("\n"));

mkdirSync(dirname(VISUAL_APPROVED_MANIFEST_PATH), { recursive: true });
writeFileSync(VISUAL_APPROVED_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Approved ${manifest.records.length} visual baselines in ${VISUAL_APPROVED_MANIFEST_PATH}.`);
