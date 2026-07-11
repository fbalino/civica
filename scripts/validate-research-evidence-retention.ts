import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import {
  DESTRUCTIVE_WRITE_PATHS,
  RETAINED_EVIDENCE_RELATIONS,
  RESEARCH_EVIDENCE_RETENTION_VERSION,
} from "../src/lib/research/evidence-retention";

config({ path: ".env.local", override: true });
const root = process.cwd();
const migration = readFileSync(
  resolve(root, "drizzle/migrations/0024_research_evidence_retention.sql"),
  "utf8",
) + readFileSync(resolve(root, "drizzle/authoritative/0003_mixed_mockingbird.sql"), "utf8");
const exclusionMigration = readFileSync(
  resolve(root, "drizzle/authoritative/0019_careless_avengers.sql"),
  "utf8",
);
const schema = readFileSync(resolve(root, "src/lib/db/schema.ts"), "utf8");
const classify = readFileSync(
  resolve(root, "src/lib/pulse/v2/classify.ts"),
  "utf8",
);
const apply = readFileSync(
  resolve(root, "scripts/pulse-apply-classifications.ts"),
  "utf8",
);

function fail(message: string): never {
  throw new Error(`DAT-016 retention validation failed: ${message}`);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(relative);
      return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) &&
        !entry.name.endsWith(".test.ts")
        ? [relative]
        : [];
    },
  );
}

for (const relation of RETAINED_EVIDENCE_RELATIONS) {
  if (!migration.includes(`'${relation}'`) && !migration.includes(`ON ${relation}`) && !exclusionMigration.includes(`ON ${relation}`)) {
    fail(`protected relation ${relation} is missing from the trigger registry`);
  }
}
for (const required of [
  "pulse_candidate_outcomes",
  "pulse_exclusion_evaluation_candidates",
  "pulse-candidate-outcome/v1",
  "false_negative_candidate",
  "false_positive_candidate",
  "materialize_pulse_candidate_outcome",
  "pulse_candidate_outcomes_append_only",
]) {
  if (!exclusionMigration.includes(required)) fail(`exclusion migration is missing ${required}`);
}

for (const path of DESTRUCTIVE_WRITE_PATHS) {
  const source = readFileSync(resolve(root, path.path), "utf8");
  if (!/\.delete\s*\(|DELETE\s+FROM/i.test(source)) {
    fail(`registered destructive path no longer contains a database deletion: ${path.path}`);
  }
  for (const relation of path.relations) {
    if (
      relation !== "rate_limits" &&
      !RETAINED_EVIDENCE_RELATIONS.includes(
        relation as (typeof RETAINED_EVIDENCE_RELATIONS)[number],
      )
    ) {
      fail(`${path.path} deletes unprotected evidence relation ${relation}`);
    }
  }
}

const registeredPaths = new Set<string>(
  DESTRUCTIVE_WRITE_PATHS.map((row) => row.path),
);
const discoveredPaths = [...sourceFiles("scripts"), ...sourceFiles("src/lib")]
  .filter((path) => /\.delete\s*\(|DELETE\s+FROM/i.test(readFileSync(resolve(root, path), "utf8")))
  .sort();
for (const path of discoveredPaths) {
  if (!registeredPaths.has(path)) fail(`unregistered destructive path: ${path}`);
}
for (const path of registeredPaths) {
  if (!discoveredPaths.includes(path)) fail(`stale destructive-path registration: ${path}`);
}

for (const required of [
  "civica_capture_research_evidence_history",
  "civica_reject_research_evidence_history_mutation",
  "pulse_evaluation_evidence",
  "reconciliation_evaluation_evidence",
  "false_negative_candidate",
  "false_positive_candidate",
  "ON DELETE RESTRICT",
]) {
  if (!migration.includes(required)) fail(`migration is missing ${required}`);
}

if (!schema.includes('export const researchEvidenceHistory = pgTable(')) {
  fail("Drizzle schema is missing the append-only history table");
}
for (const field of [
  "classificationDisposition",
  "classificationReason",
  "classificationDecision",
  "classifiedAt",
]) {
  if (!schema.includes(field)) fail(`raw-event retention field missing: ${field}`);
}
if (!classify.includes("r.classification_disposition = 'pending'")) {
  fail("the classifier queue does not exclude retained terminal decisions");
}
if (/\.delete\s*\(rawEvents\)/.test(apply)) {
  fail("subscription classifier still deletes rejected raw evidence");
}
if (!apply.includes("retained ${skipped + invalid}")) {
  fail("subscription classifier does not disclose retained negative evidence");
}
for (const policyPath of ["data/RESEARCH-EVIDENCE-RETENTION.md", "AGENTS.md"]) {
  const policy = readFileSync(resolve(root, policyPath), "utf8");
  if (!policy.includes(RESEARCH_EVIDENCE_RETENTION_VERSION)) {
    fail(`${policyPath} does not name the current retention contract`);
  }
}

async function main() {
  if (process.argv.includes("--live")) {
    if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
    const sql = neon(process.env.DATABASE_URL);
    const [objects, triggers, appendOnly, foreignKeys, invalidRaw, invalidHistory, historyRows, pulseRows, reconciliationRows] =
      await Promise.all([
      sql`SELECT
        to_regclass('research_evidence_history') IS NOT NULL AS history,
        to_regclass('pulse_evaluation_evidence') IS NOT NULL AS pulse_view,
        to_regclass('reconciliation_evaluation_evidence') IS NOT NULL AS reconciliation_view`,
      sql`SELECT count(*)::int AS n FROM pg_trigger
          WHERE tgname = 'dat_016_retain_mutation' AND NOT tgisinternal`,
      sql`SELECT count(*)::int AS n FROM pg_trigger
          WHERE tgname = 'research_evidence_history_append_only' AND NOT tgisinternal`,
      sql`SELECT count(*)::int AS n FROM pg_constraint
          WHERE conname IN (
            'pulse_sources_event_id_pulse_events_v2_id_fk',
            'pulse_review_audit_log_event_id_pulse_events_v2_id_fk'
          ) AND confdeltype = 'r'`,
      sql`SELECT count(*)::int AS n FROM raw_events
          WHERE classification_disposition NOT IN ('pending','event','non_governance','invalid')
             OR (classification_disposition = 'pending' AND classified_at IS NOT NULL)
             OR (classification_disposition <> 'pending' AND
                 (classified_at IS NULL OR classification_reason IS NULL OR classification_decision IS NULL))`,
      sql`SELECT count(*)::int AS n FROM research_evidence_history
          WHERE operation NOT IN ('update','delete')
             OR length(btrim(reason)) = 0
             OR length(btrim(actor_id)) = 0`,
      sql`SELECT count(*)::int AS n FROM research_evidence_history`,
      sql`SELECT count(*)::int AS n FROM pulse_evaluation_evidence`,
      sql`SELECT count(*)::int AS n FROM reconciliation_evaluation_evidence`,
      ]);
    const object = objects[0] as Record<string, boolean>;
    if (!object.history || !object.pulse_view || !object.reconciliation_view) {
      fail(`live objects are incomplete: ${JSON.stringify(object)}`);
    }
    if (Number(triggers[0]?.n) !== RETAINED_EVIDENCE_RELATIONS.length) {
      fail(
        `live trigger count ${triggers[0]?.n} does not match ${RETAINED_EVIDENCE_RELATIONS.length}`,
      );
    }
    if (Number(appendOnly[0]?.n) !== 1) {
      fail("live append-only guard trigger is missing");
    }
    if (Number(foreignKeys[0]?.n) !== 2) {
      fail("live Pulse evidence foreign keys are not both restrictive");
    }
    if (Number(invalidRaw[0]?.n) !== 0) {
      fail(`live raw-events ledger has ${invalidRaw[0]?.n} invalid rows`);
    }
    if (Number(invalidHistory[0]?.n) !== 0) {
      fail(`live retained-history ledger has ${invalidHistory[0]?.n} invalid rows`);
    }
    console.log(
      `Live: ${triggers[0]?.n} triggers; ${historyRows[0]?.n} history rows; ` +
        `${pulseRows[0]?.n} Pulse evaluation rows; ${reconciliationRows[0]?.n} reconciliation rows.`,
    );
  }

  console.log(`=== DAT-016 ${RESEARCH_EVIDENCE_RETENTION_VERSION} ===\n`);
  console.log(
    `PASS — ${RETAINED_EVIDENCE_RELATIONS.length} protected relations, append-only history, ` +
      "retained Pulse negatives, and reconciliation evaluation views are closed.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
