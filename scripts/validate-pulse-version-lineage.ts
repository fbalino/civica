import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { config as dotenvConfig } from "dotenv";
import { neon } from "@neondatabase/serverless";

import {
  PULSE_PIPELINE_STAGES,
  buildPulseStageVersionEnvelope,
  pulseStageVersionErrors,
  pulseStageVersionKey,
} from "../src/lib/pulse/v2/pipeline-version";
import { CURRENT_PULSE_RUNTIME_METHOD } from "../src/lib/pulse/v2/runtime-contract";

const ROOT = process.cwd();
const live = process.argv.includes("--live");

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function requireFragments(relativePath: string, fragments: readonly string[]) {
  const source = read(relativePath);
  for (const fragment of fragments) {
    assert.ok(
      source.includes(fragment),
      `${relativePath} is missing PUL-004 fragment: ${fragment}`,
    );
  }
}

async function main() {
for (const stage of PULSE_PIPELINE_STAGES) {
  const envelope = buildPulseStageVersionEnvelope(stage);
  assert.deepEqual(pulseStageVersionErrors(envelope), [], stage);
  assert.match(pulseStageVersionKey(envelope), /^pulse-stage\/sha256:[a-f0-9]{64}$/);
}
assert.equal(CURRENT_PULSE_RUNTIME_METHOD.mixed_legacy_unversioned, false);
assert.equal(
  CURRENT_PULSE_RUNTIME_METHOD.numericDeltas.inputMethodCoverage,
  "row_level_versioned_with_explicit_legacy",
);

requireFragments("src/lib/db/schema.ts", [
  '"pulse_pipeline_runs"',
  'ingestRunId: uuid("ingest_run_id")',
  'clusterRunId: uuid("cluster_run_id")',
  'classificationRunId: uuid("classification_run_id")',
  'publicationRunId: uuid("publication_run_id")',
  'corroborationRunId: uuid("corroboration_run_id")',
  'computationRunId: uuid("computation_run_id")',
  'runId: uuid("run_id")',
]);
requireFragments("drizzle/authoritative/0013_real_bromley.sql", [
  "Retained ' || stage || ' history predates PUL-004",
  "pul_004_pipeline_run_immutable",
  "pul_004_raw_lineage_write_once",
  "pul_004_event_classification_lineage_immutable",
  'ALTER COLUMN "ingest_run_id" SET NOT NULL',
  'ALTER COLUMN "classification_run_id" SET NOT NULL',
  'ALTER COLUMN "computation_run_id" SET NOT NULL',
]);
const migration = read("drizzle/authoritative/0013_real_bromley.sql");
assert.doesNotMatch(
  migration,
  /UPDATE[\s\S]{0,300}(?:pulse-v2\.1-beta|v2\.0|deepseek-v4-flash|claude-haiku)/i,
  "legacy backfill must not infer current Pulse versions",
);

requireFragments("src/lib/pulse/v2/upsert.ts", ["ingestRunId", "ingestRunId,"]);
requireFragments("src/lib/pulse/v2/cluster.ts", ["clusterRunId: run.id", "upstreamRunIds"]);
requireFragments("src/lib/pulse/v2/classify.ts", [
  "classificationRunId",
  "publicationRunId: result.autoPublished ? classificationRunId : null",
]);
requireFragments("src/lib/pulse/v2/corroborate.ts", ["corroborationRunId: run.id"]);
requireFragments("src/app/api/admin/pulse-review/[id]/route.ts", [
  'createPulsePipelineRunRef("review"',
  "publicationRunId: published ? reviewRun.id : null",
  "runId: reviewRun.id",
]);
requireFragments("src/lib/pulse/v2/score.ts", [
  "computationRunId: run.id",
  "publicationRunId",
  "corroborationRunId",
]);
requireFragments("src/lib/db/queries-pulse-v2.ts", [
  "summarizePulseVersionSet",
  "versionIdentity",
]);
requireFragments("src/lib/api/contract/schemas.ts", [
  'z.literal("pulse-stage-version-envelope/v1")',
  '"mixed_version"',
  "comparableAsSingleSeries",
]);
requireFragments("content/methodology-pulse.md", [
  "## Version identity {#version-identity}",
  "Each attempted pipeline stage has an immutable run record",
  "fixed legacy stage records",
  "`comparableAsSingleSeries: false`",
]);
requireFragments("plan/research/pulse-version-lineage-v1.md", [
  "**Resolution:** `pulse-stage-version-envelope/v1`",
  "## Row bindings",
  "## Legacy boundary",
  "## Query rule",
  "## Change policy",
]);

if (live) {
  dotenvConfig({ path: path.join(ROOT, ".env.local") });
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL!);
  const [coverage] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM pulse_pipeline_runs) AS runs,
      (SELECT COUNT(*)::int FROM raw_events WHERE ingest_run_id IS NULL) AS raw_missing_ingest,
      (SELECT COUNT(*)::int FROM raw_events WHERE cluster_id IS NOT NULL AND cluster_run_id IS NULL) AS raw_missing_cluster,
      (SELECT COUNT(*)::int FROM raw_events WHERE classified_at IS NOT NULL AND classification_run_id IS NULL) AS raw_missing_classification,
      (SELECT COUNT(*)::int FROM pulse_events_v2 WHERE classification_run_id IS NULL) AS events_missing_classification,
      (SELECT COUNT(*)::int FROM pulse_events_v2 WHERE published AND publication_run_id IS NULL) AS events_missing_publication,
      (SELECT COUNT(*)::int FROM pulse_events_v2 WHERE corroboration_run_id IS NULL) AS events_missing_corroboration,
      (SELECT COUNT(*)::int FROM pulse_review_audit_log WHERE run_id IS NULL) AS reviews_missing_run,
      (SELECT COUNT(*)::int FROM pulse_dimensional_deltas WHERE computation_run_id IS NULL) AS deltas_missing_run
  `;
  assert.ok(Number(coverage.runs) >= 6, "legacy stage runs are missing");
  for (const [key, value] of Object.entries(coverage)) {
    if (key === "runs") continue;
    assert.equal(Number(value), 0, `${key} is not closed`);
  }
  const invalid = await sql`
    SELECT COUNT(*)::int AS count
    FROM pulse_pipeline_runs
    WHERE versions->>'schemaVersion' <> 'pulse-stage-version-envelope/v1'
       OR versions->>'stage' <> stage
       OR version_key !~ '^pulse-stage/sha256:[a-f0-9]{64}$'
  `;
  assert.equal(Number(invalid[0]?.count), 0, "live run envelopes are invalid");
  console.log(
    `Live lineage check passed (${coverage.runs} stage runs; zero missing required row links).`,
  );
}

console.log(
  `PASS — ${PULSE_PIPELINE_STAGES.length} Pulse stages carry immutable content-addressed run identity; legacy rows remain explicit, every row/output has its applicable run link, and mixed-version API sets fail closed${live ? " against the live database" : ""}.`,
);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
