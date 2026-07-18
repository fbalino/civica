import { readFileSync } from "node:fs";

import {
  MANUAL_PRODUCTION_ADAPTERS,
  SCHEDULED_PRODUCTION_ADAPTERS,
} from "../src/lib/data/production-adapter-registry";
import { SOURCE_INPUT_SPECS } from "../src/lib/data/source-input-manifest";

const errors: string[] = [];
const read = (path: string) => readFileSync(path, "utf8");
const packageJson = JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
};

for (const pipeline of [
  ...SCHEDULED_PRODUCTION_ADAPTERS,
  ...MANUAL_PRODUCTION_ADAPTERS,
]) {
  for (const sourceId of pipeline.sources) {
    if (!SOURCE_INPUT_SPECS.some((spec) => spec.sourceId === sourceId)) {
      errors.push(`${pipeline.id}: missing source-input specification ${sourceId}`);
    }
  }
}

for (const pipeline of MANUAL_PRODUCTION_ADAPTERS) {
  const command = packageJson.scripts[pipeline.canonicalNpmScript];
  if (!command) {
    errors.push(`${pipeline.id}: missing canonical npm script ${pipeline.canonicalNpmScript}`);
    continue;
  }
  if (!command.includes(`--pipeline=${pipeline.id}`)) {
    errors.push(`${pipeline.id}: canonical script is not observed`);
  }
  if (!command.includes(pipeline.entrypoint)) {
    errors.push(`${pipeline.id}: canonical script does not invoke ${pipeline.entrypoint}`);
  }
}

for (const [path, fragments] of Object.entries({
  "src/lib/api/cron-job.ts": ["startPipelineRun", "finishPipelineRun"],
  "src/lib/db/schema.ts": ["productionPipelineRuns", "production_pipeline_run_status_shape"],
  "src/app/api/cron/operations/pipeline-alerts/route.ts": [
    "pipelineAlerts",
    "loadPipelineAlertRows",
    "withCronJob(\"operations.pipeline-alerts\"",
  ],
  "data/PIPELINE-OBSERVABILITY.md": [
    "civica-pipeline-observability/v1",
    "Vercel Cron",
    "missed",
  ],
  "data/OPERATIONAL-RUNBOOKS.md": [
    "civica-pipeline-observability/v1",
    "npm run report:pipeline-observability",
  ],
  "package.json": [
    '"validate:route-performance-telemetry": "node --import tsx --test src/lib/platform/route-performance-telemetry.test.ts && tsx scripts/validate-route-performance-telemetry.ts && npm run validate:pipeline-observability && npm run validate:error-monitoring && npm run validate:health-status && npm run validate:ask-civica && npm run validate:model-operations"',
  ],
})) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) errors.push(`${path}: missing ${fragment}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `PASS pipeline observability: ${SCHEDULED_PRODUCTION_ADAPTERS.length} scheduled and ${MANUAL_PRODUCTION_ADAPTERS.length} manual production pipelines are closed.`,
);
