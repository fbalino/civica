import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import {
  CONDITIONS_PRODUCTION_COMMAND,
  MANUAL_PRODUCTION_ADAPTERS,
} from "../production-adapter-registry";

const root = process.cwd();

test("every manual production script exposes an explicit dry-run path", () => {
  const missing: string[] = [];
  for (const adapter of MANUAL_PRODUCTION_ADAPTERS) {
    for (const path of adapter.implementationPaths.filter((value) =>
      value.startsWith("scripts/"),
    )) {
      const source = readFileSync(resolve(root, path), "utf8");
      if (
        !source.includes("--dry-run") &&
        !source.includes("if (!apply) process.exit(0)")
      )
        missing.push(`${adapter.id}: ${path}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("Conditions observability binds only the unified canonical orchestrator", () => {
  const adapter = MANUAL_PRODUCTION_ADAPTERS.find(
    (candidate) => candidate.id === "conditions.current-beta",
  );
  assert.ok(adapter);
  assert.equal(adapter.entrypoint, "scripts/ingest-conditions-all.ts");
  assert.deepEqual(adapter.implementationPaths, [
    "scripts/ingest-conditions-all.ts",
    "src/lib/conditions/production-workflow.ts",
    "src/lib/conditions/ingest.ts",
  ]);
  const packageJson = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  assert.equal(
    packageJson.scripts[adapter.canonicalNpmScript],
    CONDITIONS_PRODUCTION_COMMAND,
  );
  for (const legacy of [
    "scripts/ingest-conditions-hdi.ts",
    "scripts/ingest-conditions-gpi.ts",
    "scripts/ingest-conditions-economic.ts",
  ]) {
    assert.ok(!adapter.implementationPaths.includes(legacy));
    assert.ok(!CONDITIONS_PRODUCTION_COMMAND.includes(legacy));
  }
});

test("direct-write manual scripts retain retry-safe identity guards", () => {
  const contracts: Record<string, RegExp[]> = {
    "scripts/seed-from-factbook.ts": [/writeAtlasCountry/, /DRY_RUN/],
    "scripts/sync-elections-ipu.ts": [
      /writeElection/,
      /upsertEstimatedElectionWithHistory/,
      /deleteEstimatedElectionWithHistory/,
      /resolveAtlasReleaseId/,
      /DRY_RUN/,
    ],
    "scripts/sync-elections-turnout-idea.ts": [
      /updateElectionTurnoutWithHistory/,
      /resolveAtlasReleaseId/,
      /DRY_RUN/,
    ],
    "scripts/sync-elections-wikidata.ts": [
      /writeElection/,
      /resolveAtlasReleaseId/,
      /DRY_RUN/,
    ],
    "scripts/sync-wikidata-parties.ts": [
      /writeLegislatureComposition/,
      /dryRun: DRY_RUN/,
      /DRY_RUN/,
    ],
    "scripts/ingest-vparty-positions.ts": [/writePartyPositions/, /DRY_RUN/],
    "scripts/ingest-indicator-history.ts": [/writeIndicatorHistory/, /dryRun/],
    "scripts/sync-organization-memberships.ts": [
      /neonSql\.transaction/,
      /markSourcesSyncedTransactionQuery/,
      /atlas_entity_change_history/,
      /resolveAtlasReleaseId/,
      /DRY_RUN/,
    ],
  };
  for (const [path, patterns] of Object.entries(contracts)) {
    const source = readFileSync(resolve(root, path), "utf8");
    for (const pattern of patterns)
      assert.match(source, pattern, `${path} lost ${pattern}`);
  }
});

test("shared manual writers have executable repeatability fixtures", () => {
  const fixtures = [
    "src/lib/constitute/__tests__/writer-repeatability.test.ts",
    "src/lib/legislatures/__tests__/composition-writer.test.ts",
    "src/lib/government-taxonomy/__tests__/writer-repeatability.test.ts",
    "src/lib/metrics/__tests__/ingest-repeatability.test.ts",
    "src/lib/ci/__tests__/ingest-repeatability.test.ts",
    "src/lib/conditions/__tests__/ingest-repeatability.test.ts",
    "src/lib/elections/__tests__/writer-repeatability.test.ts",
    "src/lib/research/__tests__/manual-writers-repeatability.test.ts",
    "src/lib/factbook/__tests__/atlas-seed-writer.test.ts",
  ];
  for (const [index, path] of fixtures.entries()) {
    const source = readFileSync(resolve(root, path), "utf8");
    assert.match(source, /converge|reruns converge|applications converge/);
    if (index > 0) assert.match(source, /dry-run|dry run/);
  }
});
