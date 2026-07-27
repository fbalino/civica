import { existsSync, readFileSync } from "node:fs";

import {
  visualBaselineManifestErrors,
  type VisualBaselineManifest,
} from "../src/lib/qa/visual-baseline-manifest";
import {
  manifestFileErrors,
  VISUAL_APPROVED_MANIFEST_PATH,
} from "./visual-baseline-utils";

if (!existsSync(VISUAL_APPROVED_MANIFEST_PATH)) {
  throw new Error(`Missing approved visual baseline manifest: ${VISUAL_APPROVED_MANIFEST_PATH}`);
}
const manifest = JSON.parse(
  readFileSync(VISUAL_APPROVED_MANIFEST_PATH, "utf8"),
) as VisualBaselineManifest;
const errors = [
  ...visualBaselineManifestErrors(manifest, undefined, { requireApproved: true }),
  ...manifestFileErrors(manifest),
];
if (errors.length) throw new Error([...new Set(errors)].join("\n"));
console.log(`PASS — ${manifest.records.length} approved visual baselines are intact.`);
