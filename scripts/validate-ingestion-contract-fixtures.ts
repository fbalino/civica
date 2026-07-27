import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  EXTERNAL_PIPELINE_FIXTURE_WITNESSES,
  buildIngestionContractFixtures,
  ingestionContractFixtureErrors,
} from "../src/lib/qa/ingestion-contract-fixtures";
import {
  INGESTION_CONTRACT_FIXTURE_PATH,
  ingestionContractFixtureArtifact,
  readCheckedIngestionContractFixtureArtifact,
  stableJson,
} from "./ingestion-contract-fixture-source";

const problems = [...ingestionContractFixtureErrors()];
const expected = ingestionContractFixtureArtifact();

if (!existsSync(path.join(process.cwd(), INGESTION_CONTRACT_FIXTURE_PATH))) {
  problems.push(`missing checked fixture artifact ${INGESTION_CONTRACT_FIXTURE_PATH}`);
} else {
  const checked = readCheckedIngestionContractFixtureArtifact();
  if (stableJson(checked) !== stableJson(expected)) {
    problems.push(`${INGESTION_CONTRACT_FIXTURE_PATH} has drifted; regenerate it`);
  }
}

for (const [pipelineId, witnesses] of Object.entries(EXTERNAL_PIPELINE_FIXTURE_WITNESSES)) {
  for (const witness of witnesses) {
    const fullPath = path.join(process.cwd(), witness);
    if (!existsSync(fullPath)) {
      problems.push(`${pipelineId} fixture witness is missing: ${witness}`);
    } else if (!readFileSync(fullPath, "utf8").includes("test(")) {
      problems.push(`${pipelineId} fixture witness is not an executable test: ${witness}`);
    }
  }
}

const fixtures = buildIngestionContractFixtures();
const blocked = fixtures.filter((fixture) => fixture.publicExport !== "allowed").length;
console.log("=== QA-006 ingestion/sync contract fixtures ===\n");
console.log(`External pipelines: ${new Set(fixtures.map((fixture) => fixture.pipelineId)).size}`);
console.log(`Released sources: ${new Set(fixtures.map((fixture) => fixture.sourceId)).size}`);
console.log(`Source/pipeline fixtures: ${fixtures.length}`);
console.log(`Rights-blocked publication fixtures: ${blocked}`);

if (problems.length > 0) {
  for (const problem of problems.sort()) console.error(`- ${problem}`);
  console.error(`\nFAILED — ${problems.length} ingestion fixture contract problem(s).`);
  process.exitCode = 1;
} else {
  console.log(
    "\nPASS — every released source has complete deterministic outcomes and a real adapter fixture witness.",
  );
}
