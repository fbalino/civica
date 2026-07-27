import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { PULSE_DELTA_ALGORITHM_VERSION } from "../src/lib/pulse/v2/versioning";

config({ path: ".env.local", override: true });

function fail(message: string): never {
  throw new Error(`PUL-035 delta-lifecycle validation failed: ${message}`);
}

const score = readFileSync("src/lib/pulse/v2/score.ts", "utf8");
const fixture = readFileSync("src/lib/pulse/v2/score-fixture.test.ts", "utf8");
const queries = readFileSync("src/lib/db/queries-pulse-v2.ts", "utf8");
const retention = readFileSync(
  "src/lib/research/evidence-retention.ts",
  "utf8",
);
const schema = readFileSync("src/lib/db/schema.ts", "utf8");
const runtime = readFileSync("src/lib/pulse/v2/runtime-contract.ts", "utf8");

for (const marker of [
  "SELECT DISTINCT jurisdiction_id FROM pulse_dimensional_deltas",
  "existingJurisdictionIds",
  "countriesSeen.add(jurisdictionId)",
  "event.eventDate >= windowStart",
  "event.eventDate <= todayDate",
  "pulseDeltaVersionEnvelope",
  "computationRunId: run.id",
  "pulseDimensionalDeltaHistory",
  "pulse-dimensional-delta-history/v1",
  "await db.batch",
]) {
  if (!score.includes(marker)) fail(`scorer is missing ${marker}`);
}
if (
  !runtime.includes("append_only_per_score_run_jurisdiction_dimension") ||
  !runtime.includes("history_projection_and_run_completion_one_transaction")
) {
  fail("runtime contract does not disclose append-only history and atomicity");
}
for (const marker of [
  "a 366-day-old event clears prior country state",
  "eventsConsidered, 0",
  "contributingEventIds, []",
  'sourceBasket.state, "not_applicable"',
]) {
  if (!fixture.includes(marker)) fail(`366-day fixture is missing ${marker}`);
}
for (const marker of [
  "nEvents > 0 && deltaRow ?",
  "SCORE_WINDOW_DAYS",
  "eventDate} <= CURRENT_DATE",
]) {
  if (!queries.includes(marker)) fail(`public read contract is missing ${marker}`);
}
if (!retention.includes('"pulse_dimensional_deltas"')) {
  fail("dimensional delta updates are absent from research evidence retention");
}
if (!retention.includes('"pulse_dimensional_delta_history"')) {
  fail("immutable dimensional output history is absent from append-only retention");
}
if (
  !schema.includes("computationRunId: uuid") ||
  !schema.includes("derivationVersionKey: text") ||
  !schema.includes("derivationVersions: jsonb")
) {
  fail("delta rows do not retain computation and derivation identity");
}
for (const marker of [
  '"pulse_dimensional_delta_history"',
  '"pulse-dimensional-delta-history/v1"',
  "scoreAsOf: date",
  "windowStart: date",
  "windowDays: integer",
]) {
  if (!schema.includes(marker)) fail(`history schema is missing ${marker}`);
}

async function validateLive(): Promise<void> {
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const [state, trigger, history] = await Promise.all([
    sql`
      WITH eligible AS (
        SELECT jurisdiction_id, dimension, count(*)::int AS event_count
        FROM pulse_events_v2
        WHERE published = true
          AND projection_status = 'current'
          AND publication_run_id IS NOT NULL
          AND corroboration_run_id IS NOT NULL
          AND review_status IN ('approved', 'edited')
          AND category <> 'none'
          AND event_date >= CURRENT_DATE - (365 * interval '1 day')
          AND event_date <= CURRENT_DATE
        GROUP BY jurisdiction_id, dimension
      ), incomplete AS (
        SELECT jurisdiction_id
        FROM pulse_dimensional_deltas
        GROUP BY jurisdiction_id
        HAVING count(*) <> 5
          OR count(DISTINCT dimension) <> 5
      )
      SELECT
        count(*)::int AS rows,
        count(DISTINCT pdd.jurisdiction_id)::int AS jurisdictions,
        count(*) FILTER (WHERE abs(pdd.delta_value) > 1e-9)::int AS nonzero,
        count(*) FILTER (
          WHERE abs(pdd.delta_value) > 1e-9
            AND NOT EXISTS (
              SELECT 1 FROM eligible e
              WHERE e.jurisdiction_id = pdd.jurisdiction_id
                AND e.dimension = pdd.dimension
            )
        )::int AS stale_nonzero,
        count(*) FILTER (
          WHERE pdd.delta_value = 0
            AND cardinality(pdd.contributing_event_ids) > 0
        )::int AS invalid_zero,
        count(*) FILTER (
          WHERE pdd.derivation_versions->'algorithm'->>'id'
            <> ${PULSE_DELTA_ALGORITHM_VERSION}
        )::int AS wrong_algorithm,
        count(*) FILTER (
          WHERE r.id IS NULL OR r.stage <> 'score' OR r.status <> 'completed'
        )::int AS invalid_run,
        count(*) FILTER (
          WHERE h.id IS NULL
            OR h.delta_value IS DISTINCT FROM pdd.delta_value
            OR h.contributing_event_ids IS DISTINCT FROM pdd.contributing_event_ids
            OR h.derivation_version_key IS DISTINCT FROM pdd.derivation_version_key
            OR h.derivation_versions IS DISTINCT FROM pdd.derivation_versions
            OR h.score_as_of IS DISTINCT FROM pdd.score_as_of
            OR h.window_start IS DISTINCT FROM pdd.window_start
            OR h.window_days IS DISTINCT FROM pdd.window_days
        )::int AS current_history_mismatch,
        (SELECT count(*)::int FROM incomplete) AS incomplete_jurisdictions,
        (
          SELECT count(*)::int FROM eligible e
          WHERE NOT EXISTS (
            SELECT 1 FROM pulse_dimensional_deltas d
            WHERE d.jurisdiction_id = e.jurisdiction_id
              AND d.dimension = e.dimension
          )
        ) AS missing_eligible_pairs
      FROM pulse_dimensional_deltas pdd
      LEFT JOIN pulse_pipeline_runs r ON r.id = pdd.computation_run_id
      LEFT JOIN pulse_dimensional_delta_history h
        ON h.computation_run_id = pdd.computation_run_id
       AND h.jurisdiction_id = pdd.jurisdiction_id
       AND h.dimension = pdd.dimension
    `,
    sql`
      SELECT count(*)::int AS n
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND (
          (c.relname = 'pulse_dimensional_deltas'
            AND t.tgname = 'dat_016_retain_mutation')
          OR
          (c.relname = 'pulse_dimensional_delta_history'
            AND t.tgname = 'pulse_dimensional_delta_history_append_only')
        )
        AND NOT t.tgisinternal
    `,
    sql`
      SELECT
        count(*)::int AS n,
        count(DISTINCT computation_run_id)::int AS runs,
        count(*) FILTER (
          WHERE schema_version <> 'pulse-dimensional-delta-history/v1'
            OR window_days <> 365
            OR score_as_of - window_start <> 365
        )::int AS invalid_window,
        (
          SELECT count(*)::int
          FROM (
            SELECT h.computation_run_id
            FROM pulse_dimensional_delta_history h
            JOIN pulse_pipeline_runs r ON r.id = h.computation_run_id
            GROUP BY h.computation_run_id, r.counts
            HAVING count(*) <> (r.counts->>'dimensionRowsWritten')::int
          ) mismatched
        ) AS run_count_mismatches
      FROM pulse_dimensional_delta_history
    `,
  ]);
  const row = state[0];
  for (const [name, value] of Object.entries({
    stale_nonzero: row?.stale_nonzero,
    invalid_zero: row?.invalid_zero,
    wrong_algorithm: row?.wrong_algorithm,
    invalid_run: row?.invalid_run,
    current_history_mismatch: row?.current_history_mismatch,
    incomplete_jurisdictions: row?.incomplete_jurisdictions,
    missing_eligible_pairs: row?.missing_eligible_pairs,
  })) {
    if (Number(value) !== 0) fail(`live ${name}=${value}`);
  }
  if (Number(trigger[0]?.n) !== 2) fail("live projection/history triggers are absent");
  if (Number(history[0]?.n) <= 0)
    fail("live append-only delta history is unexpectedly empty");
  if (Number(history[0]?.invalid_window) !== 0)
    fail(`live history invalid_window=${history[0]?.invalid_window}`);
  if (Number(history[0]?.run_count_mismatches) !== 0)
    fail(
      `live history run_count_mismatches=${history[0]?.run_count_mismatches}`,
    );

  const sample = await sql`
    SELECT id FROM pulse_dimensional_delta_history ORDER BY created_at LIMIT 1
  `;
  if (sample[0]?.id) {
    let mutationRejected = false;
    try {
      await sql`
        UPDATE pulse_dimensional_delta_history
        SET delta_value = delta_value
        WHERE id = ${sample[0].id}
      `;
    } catch {
      mutationRejected = true;
    }
    if (!mutationRejected) fail("append-only history accepted an UPDATE");
  }
  console.log(
    `Live deltas: ${row?.rows} rows across ${row?.jurisdictions} jurisdictions; ` +
      `${row?.nonzero} nonzero; ${history[0]?.n} immutable outputs across ${history[0]?.runs} run(s).`,
  );
}

async function main(): Promise<void> {
  if (process.argv.includes("--live")) await validateLive();
  console.log(
    "PASS — pulse-delta-lifecycle/v1 closes the 365-day boundary, stale-state clearing, version identity, retained history, and public no-signal contract.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
