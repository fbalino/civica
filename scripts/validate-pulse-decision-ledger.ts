import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { config as dotenvConfig } from "dotenv";

import {
  PULSE_DECISION_KINDS,
  PULSE_DECISION_LEDGER_VERSION,
} from "../src/lib/pulse/v2/decision-ledger";
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
      `${relativePath} is missing ${fragment}`,
    );
  }
}

async function main() {
  assert.equal(PULSE_DECISION_LEDGER_VERSION, "pulse-decision-ledger/v1");
  assert.deepEqual(PULSE_DECISION_KINDS, [
    "event_existence",
    "subject_attribution",
    "category_labels",
    "severity",
    "calibration",
    "corroboration",
    "publication",
  ]);
  assert.deepEqual(
    CURRENT_PULSE_RUNTIME_METHOD.decisionLedger.decisionKinds,
    PULSE_DECISION_KINDS,
  );
  assert.equal(
    CURRENT_PULSE_RUNTIME_METHOD.decisionLedger.genericConfidenceField,
    "prohibited",
  );

  requireFragments("src/lib/db/schema.ts", [
    '"pulse_event_decisions"',
    'supersedesDecisionKey: text("supersedes_decision_key")',
    "NOT (${table.payload} ? 'confidence')",
  ]);
  requireFragments("src/lib/pulse/v2/classify.ts", [
    "classificationDecisionInputs",
    "reviewsFromVerifier",
    "persistNonEventDecision",
    "persistClassificationFailureDecision",
  ]);
  requireFragments("scripts/pulse-apply-classifications.ts", [
    "persistNonEventDecision",
    "persistClassificationFailureDecision",
  ]);
  requireFragments("src/lib/pulse/v2/corroborate.ts", [
    'kind: "corroboration"',
    'calibrationStanding: "heuristic_not_probability"',
  ]);
  requireFragments("src/app/api/admin/pulse-review/[id]/route.ts", [
    "latestPulseDecisionKeys",
    "reviewDecisions",
    "supersedesDecisionKey",
  ]);
  requireFragments("drizzle/authoritative/0016_loving_maggott.sql", [
    "legacy_projection_v1",
    "legacy_non_event_v1",
    "pulse_event_decisions_append_only",
    "record a superseding decision instead",
  ]);
  requireFragments(
    "drizzle/authoritative/0017_validate_decision_supersession.sql",
    [
      "pulse_event_decisions_validate_supersession",
      "same axis, cluster, and event",
    ],
  );
  requireFragments("content/methodology-pulse.md", [
    "## Independent decision ledger {#independent-decisions}",
    "event existence, subject attribution, category labels, severity, confidence/calibration, corroboration, and publication",
    "not a calibrated probability",
  ]);
  requireFragments("plan/research/pulse-decision-ledger-v1.md", [
    "**Resolution:** `pulse-decision-ledger/v1`",
    "## Decision axes",
    "## Supersession",
    "## Legacy boundary",
  ]);

  if (live) {
    dotenvConfig({ path: path.join(ROOT, ".env.local"), override: true });
    assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for --live");
    const sql = neon(process.env.DATABASE_URL!);
    const [coverage] = await sql`
      WITH required(kind) AS (
        VALUES ('event_existence'),('subject_attribution'),('category_labels'),
               ('severity'),('calibration'),('corroboration'),('publication')
      )
      SELECT
        (SELECT count(*)::int FROM pulse_event_decisions) AS decisions,
        (SELECT count(*)::int
         FROM pulse_events_v2 e CROSS JOIN required r
         WHERE NOT EXISTS (
           SELECT 1 FROM pulse_event_decisions d
           WHERE d.event_id = e.id AND d.kind = r.kind
         )) AS missing_event_axes,
        (SELECT count(*)::int
         FROM (SELECT DISTINCT cluster_id FROM raw_events
               WHERE classification_disposition = 'non_governance') n
         WHERE NOT EXISTS (
           SELECT 1 FROM pulse_event_decisions d
           WHERE d.cluster_id = n.cluster_id
             AND d.kind = 'event_existence'
             AND d.verdict = 'refuted'
         )) AS missing_non_event_decisions,
        (SELECT count(*)::int FROM pulse_event_decisions d
         JOIN pulse_events_v2 e ON e.id = d.event_id
         WHERE d.cluster_id <> e.cluster_id) AS event_cluster_mismatches,
        (SELECT count(*)::int FROM pulse_event_decisions
         WHERE payload ? 'confidence'
            OR (kind = 'corroboration' AND payload->>'calibrationStanding' <> 'heuristic_not_probability')) AS opaque_confidence_rows,
        (SELECT count(*)::int FROM pulse_event_decisions child
         JOIN pulse_event_decisions parent
           ON parent.decision_key = child.supersedes_decision_key
         WHERE child.kind <> parent.kind
            OR child.cluster_id <> parent.cluster_id
            OR child.event_id IS DISTINCT FROM parent.event_id) AS cross_axis_supersessions
    `;
    for (const key of [
      "missing_event_axes",
      "missing_non_event_decisions",
      "event_cluster_mismatches",
      "opaque_confidence_rows",
      "cross_axis_supersessions",
    ] as const) {
      assert.equal(Number(coverage[key]), 0, `${key} is not closed`);
    }
    assert.ok(Number(coverage.decisions) > 0, "live decision ledger is empty");
    console.log(
      `Live decision ledger: ${coverage.decisions} rows; all required axes closed.`,
    );
  }

  console.log(
    `PASS — ${PULSE_DECISION_LEDGER_VERSION} stores seven independent, append-only decision axes; verifier refutations remain axis-specific, confidence is not bundled, and corroboration is explicitly heuristic${live ? " against the live database" : ""}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
