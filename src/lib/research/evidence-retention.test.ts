import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DESTRUCTIVE_WRITE_PATHS,
  RETAINED_EVIDENCE_RELATIONS,
} from "./evidence-retention";

const migration = readFileSync(
  "drizzle/migrations/0024_research_evidence_retention.sql",
  "utf8",
);
const classify = readFileSync("src/lib/pulse/v2/classify.ts", "utf8");
const subscriptionApply = readFileSync(
  "scripts/pulse-apply-classifications.ts",
  "utf8",
);

test("every protected relation receives a synchronous retention trigger", () => {
  assert.equal(new Set(RETAINED_EVIDENCE_RELATIONS).size, 29);
  for (const relation of RETAINED_EVIDENCE_RELATIONS) {
    assert.match(migration, new RegExp(`'${relation}'`));
  }
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
  assert.match(migration, /to_jsonb\(OLD\)/);
  assert.match(migration, /to_jsonb\(NEW\)/);
});

test("retained history is append-only and requires actor, reason, and time", () => {
  assert.match(migration, /research_evidence_history is append-only/);
  assert.match(migration, /reason_nonempty/);
  assert.match(migration, /actor_nonempty/);
  assert.match(migration, /"recorded_at" timestamp DEFAULT now\(\) NOT NULL/);
});

test("Pulse source and review evidence cannot cascade away with an event", () => {
  const restricts = migration.match(/ON DELETE RESTRICT/g) ?? [];
  assert.equal(restricts.length, 2);
  assert.doesNotMatch(
    migration,
    /pulse_(sources|review_audit_log)[\s\S]{0,300}ON DELETE CASCADE/,
  );
});

test("classifier negatives remain in the ledger and leave the pending queue", () => {
  assert.match(classify, /classification_disposition = 'pending'/);
  assert.match(classify, /disposition: "non_governance"/);
  assert.doesNotMatch(subscriptionApply, /\.delete\s*\(rawEvents\)/);
  assert.match(subscriptionApply, /retained \$\{skipped \+ invalid\}/);
});

test("Pulse evaluation view exposes false-positive and false-negative candidates", () => {
  assert.match(migration, /CREATE OR REPLACE VIEW pulse_evaluation_evidence/);
  assert.match(migration, /false_negative_candidate/);
  assert.match(migration, /false_positive_candidate/);
  assert.match(migration, /classification_decision/);
  assert.match(migration, /human_reviewed = true OR pe\.review_status = 'rejected'/);
});

test("reconciliation evaluation view retains non-active facts and disputes", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE VIEW reconciliation_evaluation_evidence/,
  );
  assert.match(migration, /WHERE cf\.status <> 'active'/);
  assert.match(migration, /FROM data_disputes dd/);
});

test("every registered destructive evidence path is protected or explicitly ephemeral", () => {
  for (const path of DESTRUCTIVE_WRITE_PATHS) {
    for (const relation of path.relations) {
      if (relation === "rate_limits") {
        assert.match("exemption" in path ? path.exemption : "", /ephemeral/);
      } else {
        assert.ok(
          RETAINED_EVIDENCE_RELATIONS.includes(
            relation as (typeof RETAINED_EVIDENCE_RELATIONS)[number],
          ),
          `${path.path}: ${relation}`,
        );
      }
    }
  }
});
