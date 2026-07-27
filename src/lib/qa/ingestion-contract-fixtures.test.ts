import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  EXTERNAL_PIPELINE_FIXTURE_WITNESSES,
  INGESTION_CONTRACT_FIXTURE_VERSION,
  INGESTION_CONTRACT_SCENARIOS,
  buildIngestionContractFixtures,
  ingestionContractFixtureErrors,
} from "./ingestion-contract-fixtures";
import { SOURCE_INPUT_SPECS, productionPipelineContracts } from "../data/source-input-manifest";

test("every released external source has deterministic complete fixture outcomes", () => {
  const fixtures = buildIngestionContractFixtures();
  assert.deepEqual(ingestionContractFixtureErrors(fixtures), []);
  assert.equal(INGESTION_CONTRACT_FIXTURE_VERSION, "civica-ingestion-contract-fixtures/v1");
  assert.equal(new Set(fixtures.map((fixture) => fixture.sourceId)).size, SOURCE_INPUT_SPECS.length);
  assert.ok(fixtures.some((fixture) =>
    fixture.outcomes.some((outcome) =>
      outcome.scenario === "rights_blocked_publication" && outcome.publicDistribution === "blocked",
    ),
  ));
  for (const fixture of fixtures) {
    assert.deepEqual(
      fixture.outcomes.map((outcome) => outcome.scenario),
      [...INGESTION_CONTRACT_SCENARIOS],
      fixture.fixtureId,
    );
  }
});

test("every external pipeline is bound to an existing adapter fixture suite", () => {
  const external = productionPipelineContracts().filter(
    (pipeline) => pipeline.inputKind === "external",
  );
  assert.deepEqual(
    Object.keys(EXTERNAL_PIPELINE_FIXTURE_WITNESSES).sort(),
    external.map((pipeline) => pipeline.pipelineId).sort(),
  );
  for (const [pipelineId, paths] of Object.entries(EXTERNAL_PIPELINE_FIXTURE_WITNESSES)) {
    assert.ok(paths.length > 0, `${pipelineId} is missing witnesses`);
    for (const relativePath of paths) {
      assert.ok(existsSync(path.join(process.cwd(), relativePath)), relativePath);
      assert.match(readFileSync(path.join(process.cwd(), relativePath), "utf8"), /test\(/, relativePath);
    }
  }
});

test("a missing scenario, source, or rights disposition fails the contract", () => {
  const [first, ...rest] = buildIngestionContractFixtures();
  assert.ok(first);
  assert.match(
    ingestionContractFixtureErrors([
      { ...first, outcomes: first.outcomes.filter((outcome) => outcome.scenario !== "duplicate") },
      ...rest,
    ]).join("\n"),
    /missing duplicate outcome/,
  );
  assert.match(
    ingestionContractFixtureErrors(rest).join("\n"),
    new RegExp(`missing fixture ${first.fixtureId.replace(/[.]/g, "\\.")}`),
  );
  assert.match(
    ingestionContractFixtureErrors([
      {
        ...first,
        outcomes: first.outcomes.map((outcome) =>
          outcome.scenario === "rights_blocked_publication"
            ? { ...outcome, publicDistribution: outcome.publicDistribution === "blocked" ? "allowed" : "blocked" }
            : outcome,
        ),
      },
      ...rest,
    ]).join("\n"),
    /has drifted from source rights/,
  );
});
