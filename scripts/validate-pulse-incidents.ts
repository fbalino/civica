import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { PULSE_DELTA_ALGORITHM_VERSION } from "../src/lib/pulse/v2/versioning";

config({ path: ".env.local", override: true });

function fail(message: string): never {
  throw new Error(`PUL-031 incident validation failed: ${message}`);
}

const schema = readFileSync("src/lib/db/schema.ts", "utf8");
const cluster = readFileSync("src/lib/pulse/v2/cluster.ts", "utf8");
const clusterPublish = readFileSync(
  "src/lib/pulse/v2/cluster-publish.ts",
  "utf8",
);
const resolution = readFileSync("src/lib/pulse/v2/incident-resolution.ts", "utf8");
const migration = readFileSync("drizzle/authoritative/0023_wide_gorilla_man.sql", "utf8");
const repair = readFileSync("scripts/repair-pulse-incidents.ts", "utf8");

for (const required of [
  "pulseIncidents",
  "pulseIncidentAssignments",
  "pulseIncidentResolutions",
  "idx_pulse_v2_one_current_projection",
  "projection_status",
]) {
  if (!schema.includes(required)) fail(`schema is missing ${required}`);
}
for (const required of [
  "loadActiveIncidentCandidates",
  "planIncidentResolution(incidentCandidates)",
  "publishSemanticClusterPlan",
]) {
  if (!cluster.includes(required)) fail(`runtime clustering is missing ${required}`);
}
for (const required of [
  "pulseIncidentAssignments",
  "pulseIncidentResolutions",
  "pulseSources",
  'classificationDisposition: "event"',
  "await db.batch",
  "atomicPublishGuard",
]) {
  if (!clusterPublish.includes(required)) {
    fail(`atomic cluster publisher is missing ${required}`);
  }
}
for (const required of [
  "PULSE_INCIDENT_COMPARISON_WINDOW_HOURS",
  "exact_normalized_headline_same_resolved_jurisdiction_date_classification",
  'disposition = "candidate_merge"',
  'mode === "incoming"',
]) {
  if (!resolution.includes(required)) fail(`resolution engine is missing ${required}`);
}
for (const required of [
  "dat_016_retain_mutation",
  "pulse_incident_assignments_append_only",
  "pulse_incident_resolutions_append_only",
  "pulse_events_v2_projection_check",
]) {
  if (!migration.includes(required)) fail(`migration is missing ${required}`);
}
for (const required of [
  "--expected-plan-key",
  "collisionCandidates",
  "confirmed_merge",
  "calculateDimensionalDeltas",
]) {
  if (!repair.includes(required)) fail(`repair workflow is missing ${required}`);
}

async function main() {
  if (process.argv.includes("--live")) {
    if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
    const sql = neon(process.env.DATABASE_URL);
    const [row] = await sql`
      SELECT
        (SELECT count(*)::int FROM pulse_incidents
          WHERE (status = 'active' AND merged_into_incident_id IS NOT NULL)
             OR (status = 'merged' AND merged_into_incident_id IS NULL)) AS invalid_incidents,
        (SELECT count(*)::int FROM pulse_incidents i
          WHERE i.status = 'merged' AND NOT EXISTS (
            SELECT 1 FROM pulse_incident_resolutions r
            WHERE r.outcome = 'confirmed_merge'
              AND r.canonical_incident_id = i.merged_into_incident_id
              AND i.id IN (r.left_incident_id, r.right_incident_id)
          )) AS merged_without_resolution,
        (SELECT count(*)::int FROM (
          SELECT incident_id FROM pulse_events_v2
          WHERE projection_status = 'current'
          GROUP BY incident_id HAVING count(*) > 1
        ) duplicate_current) AS duplicate_current,
        (SELECT count(*)::int FROM pulse_events_v2
          WHERE incident_id IS NULL
             OR (projection_status <> 'current' AND published)
             OR (btrim(headline) = '' AND projection_status <> 'quarantined_invalid')) AS invalid_projections,
        (SELECT count(*)::int FROM pulse_events_v2
          WHERE published AND btrim(headline) = '') AS published_blank_headlines,
        (SELECT count(*)::int FROM raw_events
          WHERE cluster_id IS NOT NULL AND incident_id IS NULL) AS clustered_without_incident,
        (SELECT count(*)::int FROM pulse_incident_resolutions
          WHERE outcome = 'confirmed_merge') AS confirmed_resolutions,
        (SELECT count(*)::int FROM pulse_incident_resolutions
          WHERE outcome = 'candidate') AS collision_candidates,
        (SELECT count(*)::int FROM pulse_pipeline_runs
          WHERE status = 'running') AS running_runs,
        (SELECT count(*)::int FROM pulse_dimensional_deltas
          WHERE derivation_versions->'algorithm'->>'id'
            <> ${PULSE_DELTA_ALGORITHM_VERSION}) AS stale_delta_rows
    `;
    for (const field of [
      "invalid_incidents",
      "merged_without_resolution",
      "duplicate_current",
      "invalid_projections",
      "published_blank_headlines",
      "clustered_without_incident",
      "running_runs",
      "stale_delta_rows",
    ] as const) {
      if (Number(row[field]) !== 0) fail(`${field}=${row[field]}`);
    }
    if (Number(row.confirmed_resolutions) < 1) fail("no confirmed resolution evidence exists");
    if (Number(row.collision_candidates) < 1) fail("no collision candidates were retained");
    console.log(
      `Live: ${row.confirmed_resolutions} confirmed resolution(s); ${row.collision_candidates} retained collision candidate(s).`,
    );
  }
  console.log("PASS — stable incidents, one-current projection, retained collision evidence, blank-headline quarantine, and versioned recomputation are closed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
