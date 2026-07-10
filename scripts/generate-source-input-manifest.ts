/** Generate a release source-input manifest from checked-in captures. */

import { writeFileSync } from "node:fs";

import {
  buildVersionedSourceInputManifest,
  frozenIndexInputCaptures,
} from "../src/lib/data/source-input-manifest";

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...parts] = argument.replace(/^--/, "").split("=");
    return [key, parts.join("=") || "true"];
  }),
);

const releaseId = args.get("release-id");
const pipelineIds = (args.get("pipelines") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const output = args.get("out");

if (!releaseId || pipelineIds.length === 0) {
  throw new Error(
    "Usage: npm run generate:source-input-manifest -- --release-id=<id> --pipelines=<id,id> [--out=<path>]",
  );
}

const manifest = buildVersionedSourceInputManifest(
  releaseId,
  pipelineIds,
  frozenIndexInputCaptures(),
);
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (output && output !== "true") {
  writeFileSync(output, serialized);
  console.log(`Wrote ${manifest.inputs.length} source input(s) to ${output}.`);
} else {
  process.stdout.write(serialized);
}
