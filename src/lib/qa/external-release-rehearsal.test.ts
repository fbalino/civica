import assert from "node:assert/strict";
import test from "node:test";

import stagingRecord from "../../../data/release-candidate-staging-smoke.v1.json";
import recoveryRecord from "../../../data/rollback-forward-fix-rehearsal.v1.json";
import {
  QA_018_DATABASE_HEAD,
  QA_018_REQUIRED_MIGRATIONS,
  recoveryRehearsalErrors,
  stagingSmokeErrors,
  type RecoveryRehearsalRecord,
  type StagingSmokeRecord,
} from "./external-release-rehearsal";

const clone = <T>(value: T): T => structuredClone(value);

function technicallyCompleteStagingRecord(): StagingSmokeRecord {
  const candidate = clone(stagingRecord) as StagingSmokeRecord;
  candidate.status = "run_complete_pending_owner_signoff";
  candidate.blocker = "owner_post_run_signoff";
  candidate.candidate.commit = "a".repeat(40);
  candidate.candidate.dataReleaseIds = ["atlas-test-release"];
  candidate.candidate.methodVersions = ["test-method"];
  candidate.candidate.assetManifestSha256 = "b".repeat(64);
  candidate.isolation.neonBranchId = "br-test";
  candidate.isolation.vercelDeploymentId = "dpl-test";
  candidate.isolation.productionDatabaseExcluded = true;
  candidate.isolation.jobsQuiesced = true;
  candidate.checks = candidate.checks.map((check) => ({
    ...check,
    status: "pass",
    evidence: `bounded evidence for ${check.id}`,
  }));
  candidate.signoff.remainingManualChecks = [
    "Fernando reviews the retained staging evidence and records approval or rejection.",
  ];
  return candidate;
}

test("pending external release records are complete protocols without fabricated outcomes", () => {
  assert.deepEqual(
    stagingSmokeErrors(stagingRecord as StagingSmokeRecord),
    [],
  );
  assert.deepEqual(
    recoveryRehearsalErrors(recoveryRecord as RecoveryRehearsalRecord),
    [],
  );
});

test("staging cannot complete without every evidenced check and exact identities", () => {
  const candidate = clone(stagingRecord) as StagingSmokeRecord;
  candidate.status = "complete";
  candidate.blocker = null;
  assert.ok(stagingSmokeErrors(candidate).length > 0);
});

test("staging can retain a complete technical run without fabricating owner sign-off", () => {
  assert.deepEqual(
    stagingSmokeErrors(technicallyCompleteStagingRecord()),
    [],
  );
});

test("technically complete staging requires a real owner-review blocker and no sign-off", () => {
  const signed = technicallyCompleteStagingRecord();
  signed.signoff.owner = "Fernando Baliño";
  signed.signoff.checkedAt = "2026-07-25T23:59:00-03:00";
  assert.match(
    stagingSmokeErrors(signed).join("\n"),
    /must not fabricate owner sign-off/,
  );

  const noReview = technicallyCompleteStagingRecord();
  noReview.signoff.remainingManualChecks = [];
  assert.match(
    stagingSmokeErrors(noReview).join("\n"),
    /must identify the remaining owner review/,
  );
});

test("staging binds every post-0032 authoritative migration to its owning task", () => {
  assert.equal(QA_018_DATABASE_HEAD, "0032_sparkling_genesis");
  assert.deepEqual(
    stagingRecord.candidate.migrationIds,
    QA_018_REQUIRED_MIGRATIONS.map(({ id }) => id),
  );
  assert.ok(
    !stagingRecord.candidate.migrationIds.some((id) => id.startsWith("0041_")),
  );
  assert.deepEqual(
    stagingRecord.candidate.migrationIds.slice(-6),
    [
      "0043_pulse_decay_lifecycle",
      "0044_pulse_drift_monitoring",
      "0045_pulse_evaluation_workspace_reconciliation",
      "0046_little_mulholland_black",
      "0047_atlas_data_error_reports",
      "0048_entity_name_forms",
    ],
  );
});

test("staging rejects an omitted migration or misstated owning task", () => {
  const omitted = clone(stagingRecord) as StagingSmokeRecord;
  omitted.candidate.migrationIds = omitted.candidate.migrationIds.filter(
    (id) => id !== "0048_entity_name_forms",
  );
  assert.match(
    stagingSmokeErrors(omitted).join("\n"),
    /must exactly follow the authoritative ledger/,
  );

  const misowned = clone(stagingRecord) as StagingSmokeRecord;
  misowned.candidate.migrationOwners["0046_little_mulholland_black"] = "QA-018";
  assert.match(
    stagingSmokeErrors(misowned).join("\n"),
    /migration owners must exactly match/,
  );
});

test("recovery cannot complete without a bad release and correction publication", () => {
  const candidate = clone(recoveryRecord) as RecoveryRehearsalRecord;
  candidate.status = "complete";
  candidate.blocker = null;
  assert.ok(recoveryRehearsalErrors(candidate).length > 0);
});

test("pending records reject fabricated provider evidence", () => {
  const staging = clone(stagingRecord) as StagingSmokeRecord;
  staging.isolation.vercelDeploymentId = "invented";
  assert.match(stagingSmokeErrors(staging).join("\n"), /invented run evidence/);

  const recovery = clone(recoveryRecord) as RecoveryRehearsalRecord;
  recovery.deliberatelyBadRelease = true;
  assert.match(
    recoveryRehearsalErrors(recovery).join("\n"),
    /invented run evidence/,
  );
});
