import { writeFileSync } from "node:fs";
import path from "node:path";

import {
  INGESTION_CONTRACT_FIXTURE_PATH,
  ingestionContractFixtureArtifact,
  stableJson,
} from "./ingestion-contract-fixture-source";

writeFileSync(
  path.join(process.cwd(), INGESTION_CONTRACT_FIXTURE_PATH),
  stableJson(ingestionContractFixtureArtifact()),
);
console.log(`Wrote ${INGESTION_CONTRACT_FIXTURE_PATH}`);
