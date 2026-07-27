import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  INGESTION_CONTRACT_FIXTURE_VERSION,
  buildIngestionContractFixtures,
} from "../src/lib/qa/ingestion-contract-fixtures";

export const INGESTION_CONTRACT_FIXTURE_PATH =
  "data/ingestion-contract-fixtures.v1.json";

export function ingestionContractFixtureArtifact() {
  const fixtures = buildIngestionContractFixtures();
  return {
    schemaVersion: INGESTION_CONTRACT_FIXTURE_VERSION,
    generatedFrom: "production-adapter-registry/source-input-manifest/rights-manifest",
    fixtureCount: fixtures.length,
    sourceCount: new Set(fixtures.map((fixture) => fixture.sourceId)).size,
    externalPipelineCount: new Set(fixtures.map((fixture) => fixture.pipelineId)).size,
    fixtures,
  };
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function artifactSha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function readCheckedIngestionContractFixtureArtifact() {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), INGESTION_CONTRACT_FIXTURE_PATH), "utf8"),
  );
}
