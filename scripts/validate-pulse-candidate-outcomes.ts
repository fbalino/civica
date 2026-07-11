import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { config as dotenvConfig } from "dotenv";
import { PULSE_CANDIDATE_OUTCOMES, PULSE_CANDIDATE_OUTCOME_VERSION } from "../src/lib/pulse/v2/candidate-outcome";

const ROOT = process.cwd();
const live = process.argv.includes("--live");
const decisionKey = "pulse-decision/sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

function requireFragments(relativePath: string, fragments: readonly string[]) {
  const source = readFileSync(path.join(ROOT, relativePath), "utf8");
  for (const fragment of fragments) assert.ok(source.includes(fragment), `${relativePath} is missing ${fragment}`);
}

async function main() {
  assert.equal(PULSE_CANDIDATE_OUTCOME_VERSION, "pulse-candidate-outcome/v1");
  assert.deepEqual(PULSE_CANDIDATE_OUTCOMES, ["duplicate", "non_event", "insufficient_evidence", "invalid", "refuted", "rejected"]);
  requireFragments("src/lib/pulse/v2/upsert.ts", ["persistPulseCandidateOutcomes", 'reasonCode: "source_external_id_duplicate"', 'reasonCode: "source_url_duplicate"', "canonicalCandidateId", "occurredAt"]);
  requireFragments("drizzle/authoritative/0019_careless_avengers.sql", ["pulse_candidate_outcomes_contract_check", "materialize_pulse_candidate_outcome", "pulse_exclusion_evaluation_candidates", "stable_sample_key", "pulse_candidate_outcomes_append_only"]);
  requireFragments("src/lib/research/evidence-retention.ts", ["getPulseExclusionEvaluationCandidates", "false_positive_candidate", "false_negative_candidate"]);
  requireFragments("plan/research/pulse-candidate-outcome-ledger-v1.md", ["pulse-candidate-outcome/v1", "Historical limit", "stable_sample_key"]);

  if (live) {
    dotenvConfig({ path: path.join(ROOT, ".env.local"), override: true });
    assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for --live");
    const sql = neon(process.env.DATABASE_URL!);
    const [base] = await sql`SELECT id::text AS event_id, cluster_id::text, classification_run_id::text FROM pulse_events_v2 LIMIT 1`;
    assert.ok(base, "fixture requires one Pulse event");
    let triggerPassed = false;
    try {
      await sql.transaction([
        sql`INSERT INTO pulse_event_decisions (schema_version, decision_key, cluster_id, event_id, kind, verdict, payload, actor, stage_run_id, method_version, rationale, evidence_refs, decided_at) VALUES ('pulse-decision-ledger/v1', ${decisionKey}, ${String(base.cluster_id)}::uuid, ${String(base.event_id)}::uuid, 'category_labels', 'refuted', ${JSON.stringify({ categoryIds: ["fixture"], dimensionIds: ["democratic_quality"] })}::jsonb, ${JSON.stringify({ type: "verifier", provider: "fixture", model: "fixture", reviewerId: null })}::jsonb, ${String(base.classification_run_id)}::uuid, 'pulse-v2.8-beta', 'Fixture refutation.', ARRAY['event:fixture'], now())`,
        sql.query(`DO $$ BEGIN IF (SELECT count(*) FROM pulse_candidate_outcomes WHERE decision_key = '${decisionKey}' AND outcome = 'refuted') <> 1 OR (SELECT count(*) FROM pulse_exclusion_evaluation_candidates WHERE decision_key = '${decisionKey}' AND evaluation_stratum = 'false_positive_candidate') <> 1 THEN RAISE EXCEPTION 'PUL013_FIXTURE_BAD'; END IF; RAISE EXCEPTION 'PUL013_FIXTURE_PASS'; END $$`, []),
      ]);
    } catch (error) {
      triggerPassed = String(error).includes("PUL013_FIXTURE_PASS");
    }
    assert.ok(triggerPassed, "candidate-outcome materialization fixture failed");

    let mutationGuardPassed = false;
    try {
      await sql.transaction([sql.query("UPDATE pulse_candidate_outcomes SET reason = reason WHERE outcome_key = (SELECT outcome_key FROM pulse_candidate_outcomes LIMIT 1)", [])]);
    } catch (error) {
      mutationGuardPassed = String(error).includes("append-only");
    }
    assert.ok(mutationGuardPassed, "append-only guard fixture failed");

    const [audit] = await sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE outcome IN ('rejected','refuted'))::int AS false_positive_candidates, count(*) FILTER (WHERE outcome IN ('duplicate','non_event','insufficient_evidence','invalid'))::int AS false_negative_candidates, count(*) FILTER (WHERE reason_code = '' OR reason = '' OR method_version = '' OR occurred_at IS NULL OR cardinality(evidence_refs) = 0)::int AS invalid, count(*) FILTER (WHERE decision_key = ${decisionKey})::int AS retained_fixture FROM pulse_candidate_outcomes`;
    assert.equal(Number(audit.invalid), 0, "live ledger has incomplete exclusions");
    assert.equal(Number(audit.retained_fixture), 0, "rolled-back fixture was retained");
    console.log(`Live outcomes: ${audit.total}; false-positive candidates: ${audit.false_positive_candidates}; false-negative candidates: ${audit.false_negative_candidates}; retained fixture rows: 0.`);
  }
  console.log(`PASS — ${PULSE_CANDIDATE_OUTCOME_VERSION} retains six exclusion outcomes with reason, actor, method, run, time, evidence, and direct stable sampling strata${live ? " against the live database" : ""}.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
