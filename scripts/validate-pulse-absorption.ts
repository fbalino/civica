import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { CI_RELEASE_CONTRACTS } from "../src/lib/ci/release-selection";
import { comparableFixedScaleReleaseReasons } from "../src/lib/pulse/v2/absorption";

config({ path: ".env.local", override: true });

function fail(message: string): never {
  throw new Error(`PUL-037 absorption validation failed: ${message}`);
}

const decouple = readFileSync("src/lib/pulse/v2/decouple.ts", "utf8");
const corroborate = readFileSync("src/lib/pulse/v2/corroborate.ts", "utf8");
const score = readFileSync("src/lib/pulse/v2/score.ts", "utf8");
const schema = readFileSync("src/lib/db/schema.ts", "utf8");
const migration = readFileSync(
  "drizzle/authoritative/0028_complex_carlie_cooper.sql",
  "utf8",
);
const retention = readFileSync(
  "src/lib/research/evidence-retention.ts",
  "utf8",
);
const runtime = JSON.parse(
  readFileSync("src/lib/pulse/v2/runtime-method.generated.json", "utf8"),
) as {
  numericDeltas?: Record<string, unknown>;
};

for (const marker of [
  "pulseEventAbsorptions",
  "assessEventAbsorption",
  "priorComparableRelease",
  "explicitLinksExamined",
  "onConflictDoNothing",
]) {
  if (!decouple.includes(marker)) fail(`decouple path is missing ${marker}`);
}
if (
  decouple.includes("corroborationConfidence:") ||
  decouple.includes(".update(pulseEventsV2)")
) {
  fail("decouple path can still mutate event corroboration confidence");
}
if (corroborate.includes("pulseEventAbsorptions")) {
  fail("corroboration path can write or replace absorption evidence");
}
for (const marker of [
  'e.absorptionOutcome === "absorbed" ? 0 : e.corroborationConfidence',
  "LEFT JOIN LATERAL",
  "pulse_event_absorptions",
  "a.as_of <= ${throughDate}",
  "a.decided_at <= ${selectionCutoff}",
]) {
  if (!score.includes(marker)) fail(`score path is missing ${marker}`);
}
for (const marker of [
  'export const pulseEventAbsorptions = pgTable(',
  "'pulse-event-absorption/v1'",
  "supersedesAbsorptionKey",
]) {
  if (!schema.includes(marker)) fail(`schema is missing ${marker}`);
}
if (
  !migration.includes("pulse_event_absorptions_append_only") ||
  !migration.includes("BEFORE UPDATE OR DELETE")
) {
  fail("migration does not enforce an append-only absorption ledger");
}
if (!retention.includes('"pulse_event_absorptions"'))
  fail("retention inventory omits the absorption ledger");

const numeric = runtime.numericDeltas ?? {};
if (
  numeric.absorptionEvidence !==
    "append_only_explicit_event_link_fixed_scale" ||
  numeric.currentAbsorptionStanding !==
    "none_no_sequential_comparable_release" ||
  numeric.absorbedIntoIndexPolicy !==
    "separate_versioned_decision_never_mutates_corroboration"
) {
  fail("runtime snapshot does not disclose the absorption contract");
}

const current = CI_RELEASE_CONTRACTS.at(-1)!;
const hasCurrentComparable = CI_RELEASE_CONTRACTS.some(
  (candidate) =>
    candidate.releaseId !== current.releaseId &&
    comparableFixedScaleReleaseReasons(
      candidate,
      current,
      "rule_of_law",
    ).length === 0,
);
if (hasCurrentComparable)
  fail("runtime claims no comparable release but the closed registry has one");

async function validateLive(): Promise<void> {
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const [relation] = await sql`
    SELECT to_regclass('public.pulse_event_absorptions')::text AS name
  `;
  if (!relation?.name) fail("live absorption ledger is missing");
  const [counts] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE outcome = 'absorbed')::int AS absorbed,
      COUNT(*) FILTER (
        WHERE outcome = 'absorbed'
          AND (link_standing <> 'confirmed'
            OR link_actor_type = 'model_candidate'
            OR cardinality(reasons) <> 0)
      )::int AS unsupported
    FROM pulse_event_absorptions
  `;
  if (Number(counts?.unsupported ?? 0) !== 0)
    fail(`live unsupported absorbed rows=${counts?.unsupported}`);
  if (!hasCurrentComparable && Number(counts?.absorbed ?? 0) !== 0)
    fail("live absorbed rows exist without a sequential comparable release");
  const [trigger] = await sql`
    SELECT COUNT(*)::int AS n
    FROM pg_trigger
    WHERE tgrelid = 'public.pulse_event_absorptions'::regclass
      AND tgname = 'pulse_event_absorptions_append_only'
      AND NOT tgisinternal
  `;
  if (Number(trigger?.n ?? 0) !== 1)
    fail("live append-only trigger is missing");
  console.log(
    `Live absorption: ${Number(counts?.total ?? 0)} decisions; ${Number(counts?.absorbed ?? 0)} absorbed; zero unsupported rows.`,
  );
}

async function main(): Promise<void> {
  if (process.argv.includes("--live")) await validateLive();
  console.log(
    "PASS — pulse-event-absorption/v1 is append-only, event-linked, fixed-scale gated, corroboration-independent, and currently inactive without a sequential comparable Index release.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
