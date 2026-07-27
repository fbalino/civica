import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import stagingRecord from "../../../data/release-candidate-staging-smoke.v1.json";
import recoveryRecord from "../../../data/rollback-forward-fix-rehearsal.v1.json";
import {
  QA_018_DATABASE_HEAD,
  QA_018_DATABASE_TARGET_SCRIPT_PATHS,
  QA_018_REQUIRED_MIGRATIONS,
  recoveryRehearsalErrors,
  stagingDatabaseTargetingErrors,
  stagingSmokeErrors,
  type RecoveryRehearsalRecord,
  type StagingSmokeRecord,
} from "./external-release-rehearsal";

const clone = <T>(value: T): T => structuredClone(value);

function pendingStagingRecord(): StagingSmokeRecord {
  const candidate = clone(stagingRecord) as StagingSmokeRecord;
  candidate.status = "pending_external_authority";
  candidate.blocker = "owner_platform_staging_authority";
  candidate.candidate.commit = null;
  candidate.candidate.dataReleaseIds = [];
  candidate.candidate.methodVersions = [];
  candidate.candidate.assetManifestSha256 = null;
  candidate.isolation.neonBranchId = null;
  candidate.isolation.vercelDeploymentId = null;
  candidate.isolation.productionDatabaseExcluded = null;
  candidate.isolation.jobsQuiesced = null;
  candidate.isolation.runtimeAttestation = {
    proofMode: null,
    deploymentUrl: null,
    target: null,
    candidateCommit: null,
    neonProjectId: null,
    neonBranchId: null,
    neonEndpointId: null,
    databaseHostnameSha256: null,
    forbiddenProductionBranchId: null,
    forbiddenProductionHostnameSha256: null,
    migrationHead: null,
    conditionsReleaseId: null,
    conditionsMethodologyVersion: null,
    conditionsManifestSha256: null,
    evidencePath: null,
    envPullUnavailable: null,
  };
  candidate.checks = candidate.checks.map((check) => ({
    ...check,
    status: "not_run",
    evidence: null,
  }));
  candidate.signoff.owner = null;
  candidate.signoff.checkedAt = null;
  return candidate;
}

function technicallyCompleteStagingRecord(): StagingSmokeRecord {
  const candidate = clone(stagingRecord) as StagingSmokeRecord;
  candidate.status = "run_complete_pending_owner_signoff";
  candidate.blocker = "owner_post_run_signoff";
  candidate.candidate.commit = "a".repeat(40);
  candidate.candidate.dataReleaseIds = ["atlas-test-release"];
  candidate.candidate.methodVersions = ["test-method"];
  candidate.candidate.assetManifestSha256 = "b".repeat(64);
  candidate.isolation.neonBranchId = "br-test";
  candidate.isolation.vercelDeploymentId = "dpl_Test123";
  candidate.isolation.productionDatabaseExcluded = true;
  candidate.isolation.jobsQuiesced = true;
  candidate.isolation.runtimeAttestation = {
    proofMode: "exact_preview_runtime",
    deploymentUrl: "https://civica-test.vercel.app",
    target: "preview",
    candidateCommit: "a".repeat(40),
    neonProjectId: "project-test",
    neonBranchId: "br-test",
    neonEndpointId: "ep-test",
    databaseHostnameSha256: "c".repeat(64),
    forbiddenProductionBranchId: "br-production",
    forbiddenProductionHostnameSha256: "d".repeat(64),
    migrationHead: "0051_eminent_jocasta",
    conditionsReleaseId: "atlas-test-release",
    conditionsMethodologyVersion: "test-method",
    conditionsManifestSha256: "e".repeat(64),
    evidencePath: "plan/evidence/QA-018/test-runtime.json",
    envPullUnavailable: {
      expectedState: "INITIALIZING",
      rejectedStates: ["READY", "BUILDING"],
      errorCode: "deployment_state_window_unavailable",
    },
  };
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

test("checked external release records satisfy their fail-closed contracts", () => {
  assert.deepEqual(
    stagingSmokeErrors(stagingRecord as StagingSmokeRecord),
    [],
  );
  assert.deepEqual(
    recoveryRehearsalErrors(recoveryRecord as RecoveryRehearsalRecord),
    [],
  );
});

test("staging database commands preserve an explicitly injected target", () => {
  const sources = Object.fromEntries(
    QA_018_DATABASE_TARGET_SCRIPT_PATHS.map((path) => [
      path,
      readFileSync(path, "utf8"),
    ]),
  );
  assert.deepEqual(stagingDatabaseTargetingErrors(sources), []);

  const unsafe = structuredClone(sources);
  unsafe[QA_018_DATABASE_TARGET_SCRIPT_PATHS[0]] +=
    '\nconfig({ path: ".env.local", override: true });\n';
  assert.match(
    stagingDatabaseTargetingErrors(unsafe).join("\n"),
    /overrides an explicitly injected staging environment/,
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

test("exact Preview runtime proof fails closed on production and state-window drift", () => {
  const productionTarget = technicallyCompleteStagingRecord();
  productionTarget.isolation.runtimeAttestation.target =
    "production" as "preview";
  assert.match(
    stagingSmokeErrors(productionTarget).join("\n"),
    /not bound to a Preview deployment/,
  );

  const forbiddenBranch = technicallyCompleteStagingRecord();
  forbiddenBranch.isolation.runtimeAttestation.neonBranchId =
    forbiddenBranch.isolation.runtimeAttestation.forbiddenProductionBranchId;
  assert.match(
    stagingSmokeErrors(forbiddenBranch).join("\n"),
    /fail closed against production/,
  );

  const forbiddenHost = technicallyCompleteStagingRecord();
  forbiddenHost.isolation.runtimeAttestation.databaseHostnameSha256 =
    forbiddenHost.isolation.runtimeAttestation
      .forbiddenProductionHostnameSha256;
  assert.match(
    stagingSmokeErrors(forbiddenHost).join("\n"),
    /fail closed against production/,
  );

  const wrongHead = technicallyCompleteStagingRecord();
  wrongHead.isolation.runtimeAttestation.migrationHead =
    "0049_curvy_shen";
  assert.match(
    stagingSmokeErrors(wrongHead).join("\n"),
    /migration head is invalid/,
  );

  const wrongRelease = technicallyCompleteStagingRecord();
  wrongRelease.isolation.runtimeAttestation.conditionsReleaseId =
    "conditions-unbound-v1";
  assert.match(
    stagingSmokeErrors(wrongRelease).join("\n"),
    /Conditions pointer is invalid/,
  );

  const missingStateWindow = technicallyCompleteStagingRecord();
  missingStateWindow.isolation.runtimeAttestation.envPullUnavailable = null;
  assert.match(
    stagingSmokeErrors(missingStateWindow).join("\n"),
    /state-window failure/,
  );
});

test("deployment environment-pull proof cannot also claim fallback", () => {
  const candidate = technicallyCompleteStagingRecord();
  candidate.isolation.runtimeAttestation.proofMode =
    "deployment_env_pull";
  assert.match(
    stagingSmokeErrors(candidate).join("\n"),
    /cannot claim the state window was unavailable/,
  );

  candidate.isolation.runtimeAttestation.envPullUnavailable = null;
  assert.deepEqual(stagingSmokeErrors(candidate), []);
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
    stagingRecord.candidate.migrationIds.slice(-8),
    [
      "0044_pulse_drift_monitoring",
      "0045_pulse_evaluation_workspace_reconciliation",
      "0046_little_mulholland_black",
      "0047_atlas_data_error_reports",
      "0048_entity_name_forms",
      "0049_curvy_shen",
      "0050_index_release_header_contract",
      "0051_eminent_jocasta",
    ],
  );
});

test("staging rejects an omitted migration or misstated owning task", () => {
  const omitted = clone(stagingRecord) as StagingSmokeRecord;
  omitted.candidate.migrationIds = omitted.candidate.migrationIds.filter(
    (id) => id !== "0051_eminent_jocasta",
  );
  assert.match(
    stagingSmokeErrors(omitted).join("\n"),
    /must exactly follow the authoritative ledger/,
  );

  const misowned = clone(stagingRecord) as StagingSmokeRecord;
  misowned.candidate.migrationOwners["0051_eminent_jocasta"] =
    "QA-018";
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
  const staging = pendingStagingRecord();
  staging.isolation.vercelDeploymentId = "invented";
  assert.match(stagingSmokeErrors(staging).join("\n"), /invented run evidence/);

  const runtime = pendingStagingRecord();
  runtime.isolation.runtimeAttestation.proofMode =
    "exact_preview_runtime";
  assert.match(
    stagingSmokeErrors(runtime).join("\n"),
    /invented runtime attestation/,
  );

  const recovery = clone(recoveryRecord) as RecoveryRehearsalRecord;
  recovery.deliberatelyBadRelease = true;
  assert.match(
    recoveryRehearsalErrors(recovery).join("\n"),
    /invented run evidence/,
  );
});
