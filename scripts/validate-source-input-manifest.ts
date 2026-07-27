/** DAT-002 DB/network/clock-free source-input manifest gate. */

import { existsSync, readFileSync } from "node:fs";

import {
  SOURCE_INPUT_SPECS,
  buildVersionedSourceInputManifest,
  frozenIndexInputCaptures,
  missingReleaseCaptures,
  productionPipelineContracts,
  validateSourceInputContract,
} from "../src/lib/data/source-input-manifest";
import { SCHEDULED_PRODUCTION_ADAPTERS } from "../src/lib/data/production-adapter-registry";

const problems: string[] = [];
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  crons?: { path: string }[];
};
const deployedRoutes = (vercel.crons ?? []).map((cron) => cron.path).sort();
const registeredRoutes = SCHEDULED_PRODUCTION_ADAPTERS.map(
  (item) => item.route,
).sort();
if (JSON.stringify(deployedRoutes) !== JSON.stringify(registeredRoutes)) {
  problems.push("scheduled route registry does not exactly match vercel.json");
}

for (const issue of validateSourceInputContract()) {
  problems.push(`${issue.code}: ${issue.detail}`);
}
for (const pipeline of productionPipelineContracts()) {
  for (const path of [pipeline.entrypoint, ...pipeline.implementationPaths]) {
    if (!existsSync(path))
      problems.push(`missing pipeline file: ${pipeline.pipelineId}:${path}`);
  }
}

const expected = buildVersionedSourceInputManifest(
  "ci-beta-2024-Q4",
  ["index.current-beta"],
  frozenIndexInputCaptures(),
);
const checkedPath =
  "data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json";
const checked = JSON.parse(readFileSync(checkedPath, "utf8"));
if (JSON.stringify(checked) !== JSON.stringify(expected)) {
  problems.push(`${checkedPath} has drifted; regenerate it`);
}


const allExternal = productionPipelineContracts()
  .filter((pipeline) => pipeline.inputKind === "external")
  .map((pipeline) => pipeline.pipelineId);
const preG2Missing = missingReleaseCaptures(
  allExternal,
  frozenIndexInputCaptures(),
);
if (preG2Missing.length === 0) {
  problems.push(
    "pre-G2 full release unexpectedly has no missing input captures",
  );
}
try {
  buildVersionedSourceInputManifest(
    "invalid-pre-g2-full-release",
    allExternal,
    frozenIndexInputCaptures(),
  );
  problems.push("full release generation did not fail on missing captures");
} catch (error) {
  if (!String(error).includes("missing-capture:")) {
    problems.push("full release failed for an unexpected reason");
  }
}

console.log("=== DAT-002 source-input manifest validation ===\n");
console.log(`Production pipelines: ${productionPipelineContracts().length}`);
console.log(`External source specifications: ${SOURCE_INPUT_SPECS.length}`);
console.log(`Scheduled routes closed: ${registeredRoutes.length}`);
console.log(`Frozen Index captures: ${expected.inputs.length}`);
console.log(`Pre-G2 captures still required: ${preG2Missing.length}`);

if (problems.length > 0) {
  for (const problem of problems) console.error(`- ${problem}`);
  console.error(
    `\nFAILED — ${problems.length} source-input manifest problem(s).`,
  );
  process.exitCode = 1;
} else {
  console.log(
    "\nPASS — source/pipeline contracts close and incomplete releases fail closed.",
  );
}
