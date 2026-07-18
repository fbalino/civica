import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APPEND_ONLY_EVIDENCE_RELATIONS,
  DESTRUCTIVE_WRITE_PATHS,
  RETAINED_EVIDENCE_RELATIONS,
} from "./evidence-retention";

const migration =
  readFileSync(
    "drizzle/migrations/0024_research_evidence_retention.sql",
    "utf8",
  ) + readFileSync("drizzle/authoritative/0003_mixed_mockingbird.sql", "utf8");
const exclusionMigration = readFileSync(
  "drizzle/authoritative/0020_attach_candidate_retention_trigger.sql",
  "utf8",
);
const decisionMigration = readFileSync(
  "drizzle/authoritative/0016_loving_maggott.sql",
  "utf8",
);
const incidentMigration = readFileSync(
  "drizzle/authoritative/0023_wide_gorilla_man.sql",
  "utf8",
);
const classificationMigration = readFileSync(
  "drizzle/authoritative/0024_dark_maginty.sql",
  "utf8",
);
const reviewSlaMigration = readFileSync(
  "drizzle/authoritative/0025_careful_the_professor.sql",
  "utf8",
);
const deltaHistoryMigration = readFileSync(
  "drizzle/authoritative/0027_smart_tempest.sql",
  "utf8",
);
const absorptionMigration = readFileSync(
  "drizzle/authoritative/0028_complex_carlie_cooper.sql",
  "utf8",
);
const informationEnvironmentMigration = readFileSync(
  "drizzle/authoritative/0029_whole_dazzler.sql",
  "utf8",
);
const constitutionPassageMigration = readFileSync(
  "drizzle/authoritative/0030_cute_namora.sql",
  "utf8",
);
const partyIdentityMigration = readFileSync(
  "drizzle/authoritative/0031_hot_saracen.sql",
  "utf8",
);
const conditionsComponentsMigration = readFileSync(
  "drizzle/authoritative/0040_closed_young_avengers.sql",
  "utf8",
);
const conditionsReleaseMigration = readFileSync(
  "drizzle/authoritative/0042_grey_sally_floyd.sql",
  "utf8",
);
const pulseDriftMigration = readFileSync(
  "drizzle/authoritative/0044_pulse_drift_monitoring.sql",
  "utf8",
);
const classify = readFileSync("src/lib/pulse/v2/classify.ts", "utf8");
const subscriptionApply = readFileSync(
  "scripts/pulse-apply-classifications.ts",
  "utf8",
);

test("every protected relation receives a synchronous retention trigger", () => {
  assert.equal(
    new Set(RETAINED_EVIDENCE_RELATIONS).size,
    RETAINED_EVIDENCE_RELATIONS.length,
  );
  for (const relation of RETAINED_EVIDENCE_RELATIONS) {
    assert.ok(
      migration.includes(`'${relation}'`) ||
        migration.includes(`ON ${relation}`) ||
        exclusionMigration.includes(`ON ${relation}`) ||
        incidentMigration.includes(`ON ${relation}`) ||
        classificationMigration.includes(`ON ${relation}`) ||
        reviewSlaMigration.includes(`ON ${relation}`) ||
        absorptionMigration.includes(`ON ${relation}`) ||
        informationEnvironmentMigration.includes(`ON ${relation}`) ||
        conditionsComponentsMigration.includes(`ON "${relation}"`) ||
        conditionsReleaseMigration.includes(`ON "${relation}"`) ||
        // Drizzle emits the quoted identifier form in 0030.
        constitutionPassageMigration.includes(`ON "${relation}"`) ||
        partyIdentityMigration.includes(`ON ${relation}`),
    );
  }
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
  assert.match(migration, /to_jsonb\(OLD\)/);
  assert.match(migration, /to_jsonb\(NEW\)/);
});

test("Pulse evidence ledgers are append-only", () => {
  for (const relation of APPEND_ONLY_EVIDENCE_RELATIONS) {
    assert.ok(
      [
        decisionMigration,
        exclusionMigration,
        incidentMigration,
        classificationMigration,
        reviewSlaMigration,
        deltaHistoryMigration,
        absorptionMigration,
        informationEnvironmentMigration,
        partyIdentityMigration,
        pulseDriftMigration,
      ].some((source) =>
        new RegExp(
          `CREATE\\s+TRIGGER\\s+[a-z0-9_]+_append_only[\\s\\S]{0,160}BEFORE\\s+UPDATE\\s+OR\\s+DELETE\\s+ON\\s+"?${relation}"?[\\s\\S]{0,160}EXECUTE\\s+FUNCTION`,
          "i",
        ).test(source),
      ),
      relation,
    );
  }
  assert.match(incidentMigration, /pulse_incident_assignments_append_only/);
  assert.match(incidentMigration, /pulse_incident_resolutions_append_only/);
  assert.match(
    classificationMigration,
    /pulse_classification_attempts_append_only/,
  );
  assert.match(reviewSlaMigration, /pulse_review_sla_events_append_only/);
  assert.match(absorptionMigration, /pulse_event_absorptions_append_only/);
  assert.match(
    informationEnvironmentMigration,
    /pulse_event_information_environment_pins_append_only/,
  );
  assert.match(
    deltaHistoryMigration,
    /pulse_dimensional_delta_history_append_only/,
  );
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
  assert.match(
    migration,
    /human_reviewed = true OR pe\.review_status = 'rejected'/,
  );
});

test("reconciliation evaluation view retains non-active facts and disputes", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE VIEW reconciliation_evaluation_evidence/,
  );
  assert.match(migration, /WHERE cf\.status <> 'active'/);
  assert.match(migration, /FROM data_disputes dd/);
});

test("every registered destructive evidence path is protected or explicitly short-lived", () => {
  for (const path of DESTRUCTIVE_WRITE_PATHS) {
    for (const relation of path.relations) {
      if (
        RETAINED_EVIDENCE_RELATIONS.includes(
          relation as (typeof RETAINED_EVIDENCE_RELATIONS)[number],
        )
      ) {
        continue;
      } else {
        assert.match(
          "exemption" in path ? path.exemption : "",
          /short-lived|ephemeral/i,
          `${path.path}: ${relation}`,
        );
      }
    }
  }
});
