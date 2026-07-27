import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import stagingRecord from "../../../data/release-candidate-staging-smoke.v1.json";
import recoveryRecord from "../../../data/rollback-forward-fix-rehearsal.v1.json";
import {
  QA_018_DATABASE_HEAD,
  QA_018_DATABASE_TARGET_SCRIPT_PATHS,
  QA_018_REQUIRED_MIGRATIONS,
  QA_018_REHEARSAL_HEAD,
  QA_018_REHEARSAL_LEDGER_ROWS,
  QA_018_REHEARSAL_ORDERED_IDS_SHA256,
  QA_018_REHEARSAL_SCHEMA_SHA256,
  qa018CompletedDatabaseProofErrors,
  recoveryRehearsalErrors,
  stagingDatabaseTargetingErrors,
  stagingSmokeErrors,
  type Qa018CompletedDatabaseProof,
  type RecoveryRehearsalRecord,
  type StagingSmokeRecord,
} from "./external-release-rehearsal";

const clone = <T>(value: T): T => structuredClone(value);

function completedDatabaseProof(): Qa018CompletedDatabaseProof {
  const snapshot = {
    migrationLedger: {
      rows: QA_018_REHEARSAL_LEDGER_ROWS,
      head: QA_018_REHEARSAL_HEAD,
      orderedIdsSha256: QA_018_REHEARSAL_ORDERED_IDS_SHA256,
      hashesMatchRepository: true,
    },
    publicSchema: { sha256: QA_018_REHEARSAL_SCHEMA_SHA256 },
  };
  return {
    isolation: {
      productionDatabaseBranchId: "br-production",
      productionDatabaseHostnameSha256: "d".repeat(64),
      productionMigrationHeadBefore: QA_018_DATABASE_HEAD,
      productionMigrationHeadAfter: QA_018_DATABASE_HEAD,
    },
    database: {
      before: clone(snapshot),
      after: clone(snapshot),
    },
  };
}

const canonicalProductionBoundary = {
  forbiddenProductionBranchId: "br-production",
  forbiddenProductionHostnameSha256: "d".repeat(64),
};

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
    deploymentId: null,
    deploymentUrl: null,
    deploymentHost: null,
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
    envPullAttemptEvidence: null,
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
    deploymentId: "dpl_Test123",
    deploymentUrl: "https://civica-test.vercel.app",
    deploymentHost: "civica-test.vercel.app",
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
    envPullAttemptEvidence: {
      attempts: [
        {
          expectedState: "INITIALIZING",
          observedState: "READY",
          outcome: "state_window_rejected",
        },
        {
          expectedState: "INITIALIZING",
          observedState: "BUILDING",
          outcome: "state_window_rejected",
        },
      ],
      failureCode: "deployment_state_window_unavailable",
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

function technicallyCompleteRecoveryRecord(): RecoveryRehearsalRecord {
  const candidate = clone(recoveryRecord) as RecoveryRehearsalRecord;
  candidate.status = "run_complete_pending_owner_signoff";
  candidate.blocker = "owner_status_record_and_post_run_signoff";
  candidate.deliberatelyBadRelease = true;
  candidate.candidateCommit = "1".repeat(40);
  candidate.stagingDeploymentId = "dpl_Qa019BadRelease";
  candidate.defectFixture = "fixture-route/cache-header-mismatch";
  candidate.recoveryMode = "forward_fix";
  candidate.recoveredCommit = "2".repeat(40);
  candidate.recoveredDeploymentId = "dpl_Qa019RecoveredRelease";
  candidate.checks = candidate.checks.map((check) => ({
    ...check,
    status: "pass",
    evidence: `bounded QA-019 evidence for ${check.id}`,
  }));
  candidate.correction = {
    incidentId: "qa019-staging-cache-header",
    statusRecordId: null,
    changelogPath: "plan/evidence/QA-019/correction-changelog.md",
    correctionRecordId: "qa019-correction-staging-cache-header",
  };
  candidate.signoff.owner = null;
  candidate.signoff.checkedAt = null;
  candidate.signoff.remainingManualChecks = [
    "Review and create the external status record without notifying subscribers.",
    "Fernando reviews the retained recovery evidence and records approval or rejection.",
  ];
  return candidate;
}

function completeRecoveryRecord(): RecoveryRehearsalRecord {
  const candidate = technicallyCompleteRecoveryRecord();
  candidate.status = "complete";
  candidate.blocker = null;
  candidate.correction.statusRecordId = "status-record-qa019";
  candidate.signoff.owner = "Fernando Baliño";
  candidate.signoff.checkedAt = "2026-07-27T12:00:00-03:00";
  candidate.signoff.remainingManualChecks = [];
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
  const deploymentId = technicallyCompleteStagingRecord();
  deploymentId.isolation.runtimeAttestation.deploymentId =
    "dpl_Different123";
  assert.match(
    stagingSmokeErrors(deploymentId).join("\n"),
    /not bound to a Preview deployment/,
  );

  const deploymentHost = technicallyCompleteStagingRecord();
  deploymentHost.isolation.runtimeAttestation.deploymentHost =
    "different-preview.vercel.app";
  assert.match(
    stagingSmokeErrors(deploymentHost).join("\n"),
    /not bound to a Preview deployment/,
  );

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
  missingStateWindow.isolation.runtimeAttestation.envPullAttemptEvidence = null;
  assert.match(
    stagingSmokeErrors(missingStateWindow).join("\n"),
    /state-window failure/,
  );

  const wrongCandidate = technicallyCompleteStagingRecord();
  wrongCandidate.isolation.runtimeAttestation.candidateCommit = "f".repeat(40);
  assert.match(
    stagingSmokeErrors(wrongCandidate).join("\n"),
    /candidate commit does not match/,
  );

  const wrongChildEndpoint = technicallyCompleteStagingRecord();
  wrongChildEndpoint.isolation.runtimeAttestation.neonEndpointId =
    "not-a-neon-endpoint";
  assert.match(
    stagingSmokeErrors(wrongChildEndpoint).join("\n"),
    /child database identity is invalid/,
  );
});

test("deployment environment-pull proof requires one successful INITIALIZING pull", () => {
  const candidate = technicallyCompleteStagingRecord();
  candidate.isolation.runtimeAttestation.proofMode =
    "deployment_env_pull";
  assert.match(
    stagingSmokeErrors(candidate).join("\n"),
    /one successful INITIALIZING pull/,
  );

  candidate.isolation.runtimeAttestation.envPullAttemptEvidence = {
    attempts: [
      {
        expectedState: "INITIALIZING",
        observedState: "INITIALIZING",
        outcome: "pulled",
      },
    ],
    failureCode: null,
  };
  assert.deepEqual(stagingSmokeErrors(candidate), []);
});

test("exact Preview fallback accepts one truthful state-window rejection", () => {
  const candidate = technicallyCompleteStagingRecord();
  candidate.isolation.runtimeAttestation.envPullAttemptEvidence!.attempts = [
    {
      expectedState: "INITIALIZING",
      observedState: "READY",
      outcome: "state_window_rejected",
    },
  ];
  assert.deepEqual(stagingSmokeErrors(candidate), []);

  candidate.isolation.runtimeAttestation.envPullAttemptEvidence!.attempts =
    [];
  assert.match(
    stagingSmokeErrors(candidate).join("\n"),
    /state-window failure/,
  );
});

test("runtime proof rejects unsanitized or cross-mode environment-pull attempts", () => {
  const extraErrorBody = technicallyCompleteStagingRecord();
  const attempt = extraErrorBody.isolation.runtimeAttestation
    .envPullAttemptEvidence!.attempts[0] as {
    expectedState: "INITIALIZING";
    observedState: "READY";
    outcome: "state_window_rejected";
    errorBody?: string;
  };
  attempt.errorBody = "provider response body must not be retained";
  assert.match(
    stagingSmokeErrors(extraErrorBody).join("\n"),
    /lacks sanitized deployment environment-pull attempt evidence/,
  );

  const malformedAttempts = technicallyCompleteStagingRecord();
  (
    malformedAttempts.isolation.runtimeAttestation
      .envPullAttemptEvidence as unknown as { attempts: string }
  ).attempts = "READY_expected_INITIALIZING";
  assert.match(
    stagingSmokeErrors(malformedAttempts).join("\n"),
    /lacks sanitized deployment environment-pull attempt evidence/,
  );

  const initializingFallback = technicallyCompleteStagingRecord();
  initializingFallback.isolation.runtimeAttestation
    .envPullAttemptEvidence!.attempts = [
    {
      expectedState: "INITIALIZING",
      observedState: "INITIALIZING",
      outcome: "state_window_rejected",
    },
  ];
  assert.match(
    stagingSmokeErrors(initializingFallback).join("\n"),
    /state-window failure/,
  );

  const pulledFallback = technicallyCompleteStagingRecord();
  pulledFallback.isolation.runtimeAttestation
    .envPullAttemptEvidence!.attempts[0]!.outcome = "pulled";
  assert.match(
    stagingSmokeErrors(pulledFallback).join("\n"),
    /state-window failure/,
  );
});

test("completed QA-018 database proof binds the fresh 0051 ledger and unchanged production", () => {
  assert.deepEqual(
    qa018CompletedDatabaseProofErrors(
      completedDatabaseProof(),
      canonicalProductionBoundary,
    ),
    [],
  );
});

test("completed QA-018 database proof rejects a 50-row historical ledger", () => {
  const proof = completedDatabaseProof();
  proof.database.before.migrationLedger.rows = 50;
  proof.database.after.migrationLedger.rows = 50;
  assert.match(
    qa018CompletedDatabaseProofErrors(
      proof,
      canonicalProductionBoundary,
    ).join("\n"),
    /must contain 51 rows/,
  );
});

test("completed QA-018 database proof rejects an incorrect ordered-ID hash", () => {
  const proof = completedDatabaseProof();
  proof.database.after.migrationLedger.orderedIdsSha256 = "f".repeat(64);
  assert.match(
    qa018CompletedDatabaseProofErrors(
      proof,
      canonicalProductionBoundary,
    ).join("\n"),
    /ordered-ID SHA-256 is invalid/,
  );
});

test("completed QA-018 database proof rejects an incorrect schema fingerprint", () => {
  const proof = completedDatabaseProof();
  proof.database.before.publicSchema.sha256 = "f".repeat(64);
  assert.match(
    qa018CompletedDatabaseProofErrors(
      proof,
      canonicalProductionBoundary,
    ).join("\n"),
    /public schema fingerprint is invalid/,
  );
});

test("completed QA-018 database proof rejects production identity mismatch", () => {
  const proof = completedDatabaseProof();
  proof.isolation.productionDatabaseBranchId = "br-not-production";
  assert.match(
    qa018CompletedDatabaseProofErrors(
      proof,
      canonicalProductionBoundary,
    ).join("\n"),
    /does not match the canonical forbidden-production boundary/,
  );
});

test("completed QA-018 database proof rejects a changed production head", () => {
  const proof = completedDatabaseProof();
  proof.isolation.productionMigrationHeadAfter = QA_018_REHEARSAL_HEAD;
  assert.match(
    qa018CompletedDatabaseProofErrors(
      proof,
      canonicalProductionBoundary,
    ).join("\n"),
    /must remain 0032_sparkling_genesis before and after/,
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

test("recovery cannot complete without a bad release and retained correction", () => {
  const candidate = clone(recoveryRecord) as RecoveryRehearsalRecord;
  candidate.status = "complete";
  candidate.blocker = null;
  assert.ok(recoveryRehearsalErrors(candidate).length > 0);
});

test("recovery can retain a technically complete run pending external status and owner review", () => {
  assert.deepEqual(
    recoveryRehearsalErrors(technicallyCompleteRecoveryRecord()),
    [],
  );
});

test("technically complete recovery requires all passing evidenced checks", () => {
  const failed = technicallyCompleteRecoveryRecord();
  failed.checks[0] = {
    ...failed.checks[0],
    status: "fail",
  };
  assert.match(
    recoveryRehearsalErrors(failed).join("\n"),
    /not a passing evidenced check/,
  );

  const missingEvidence = technicallyCompleteRecoveryRecord();
  missingEvidence.checks[1] = {
    ...missingEvidence.checks[1],
    evidence: null,
  };
  assert.match(
    recoveryRehearsalErrors(missingEvidence).join("\n"),
    /not a passing evidenced check/,
  );
});

test("technically complete recovery requires exact run and local correction identities", () => {
  const mutations: Array<
    [string, (record: RecoveryRehearsalRecord) => void, RegExp]
  > = [
    [
      "deliberate release",
      (record) => {
        record.deliberatelyBadRelease = false;
      },
      /lacks deliberate bad release/,
    ],
    [
      "candidate commit",
      (record) => {
        record.candidateCommit = "not-a-commit";
      },
      /lacks exact release\/recovery identities/,
    ],
    [
      "deployment",
      (record) => {
        record.stagingDeploymentId = "preview-deployment";
      },
      /lacks exact release\/recovery identities/,
    ],
    [
      "fixture",
      (record) => {
        record.defectFixture = " ";
      },
      /lacks exact release\/recovery identities/,
    ],
    [
      "recovery mode",
      (record) => {
        record.recoveryMode = "restore_backup" as "forward_fix";
      },
      /lacks exact release\/recovery identities/,
    ],
    [
      "recovered commit",
      (record) => {
        record.recoveredCommit = "3".repeat(39);
      },
      /lacks exact release\/recovery identities/,
    ],
    [
      "recovered deployment",
      (record) => {
        record.recoveredDeploymentId = "preview-without-deployment-id";
      },
      /lacks exact release\/recovery identities/,
    ],
    [
      "incident",
      (record) => {
        record.correction.incidentId = null;
      },
      /lacks incident\/correction\/changelog evidence/,
    ],
    [
      "changelog",
      (record) => {
        record.correction.changelogPath = null;
      },
      /lacks incident\/correction\/changelog evidence/,
    ],
    [
      "changelog outside QA-019 evidence",
      (record) => {
        record.correction.changelogPath = "/tmp/qa019-changelog.md";
      },
      /lacks incident\/correction\/changelog evidence/,
    ],
    [
      "correction record",
      (record) => {
        record.correction.correctionRecordId = " ";
      },
      /lacks incident\/correction\/changelog evidence/,
    ],
  ];

  for (const [label, mutate, expected] of mutations) {
    const candidate = technicallyCompleteRecoveryRecord();
    mutate(candidate);
    assert.match(
      recoveryRehearsalErrors(candidate).join("\n"),
      expected,
      label,
    );
  }
});

test("technically complete recovery keeps external status and owner sign-off pending", () => {
  const wrongBlocker = technicallyCompleteRecoveryRecord();
  wrongBlocker.blocker = "owner_post_run_signoff";
  assert.match(
    recoveryRehearsalErrors(wrongBlocker).join("\n"),
    /must name the status-record and owner sign-off blocker/,
  );

  const externalStatus = technicallyCompleteRecoveryRecord();
  externalStatus.correction.statusRecordId = "invented-status-record";
  assert.match(
    recoveryRehearsalErrors(externalStatus).join("\n"),
    /must not fabricate an external status record/,
  );

  const signed = technicallyCompleteRecoveryRecord();
  signed.signoff.owner = "Fernando Baliño";
  signed.signoff.checkedAt = "2026-07-27T12:00:00-03:00";
  assert.match(
    recoveryRehearsalErrors(signed).join("\n"),
    /must not fabricate owner sign-off/,
  );

  const noManualReview = technicallyCompleteRecoveryRecord();
  noManualReview.signoff.remainingManualChecks = [];
  assert.match(
    recoveryRehearsalErrors(noManualReview).join("\n"),
    /remaining owner and status-record review/,
  );

  const ownerOnly = technicallyCompleteRecoveryRecord();
  ownerOnly.signoff.remainingManualChecks = [
    "Fernando reviews the retained recovery evidence.",
  ];
  assert.match(
    recoveryRehearsalErrors(ownerOnly).join("\n"),
    /remaining owner and status-record review/,
  );
});

test("complete recovery requires a real status record and dated owner sign-off", () => {
  assert.deepEqual(recoveryRehearsalErrors(completeRecoveryRecord()), []);

  const noStatus = completeRecoveryRecord();
  noStatus.correction.statusRecordId = null;
  assert.match(
    recoveryRehearsalErrors(noStatus).join("\n"),
    /lacks a real external status record/,
  );

  const noOwner = completeRecoveryRecord();
  noOwner.signoff.owner = null;
  assert.match(
    recoveryRehearsalErrors(noOwner).join("\n"),
    /lacks dated owner sign-off/,
  );

  const invalidDate = completeRecoveryRecord();
  invalidDate.signoff.checkedAt = "not-a-date";
  assert.match(
    recoveryRehearsalErrors(invalidDate).join("\n"),
    /lacks dated owner sign-off/,
  );
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
  recovery.status = "pending_external_authority";
  recovery.blocker = "owner_platform_staging_authority";
  recovery.candidateCommit = null;
  recovery.stagingDeploymentId = null;
  recovery.defectFixture = null;
  recovery.recoveryMode = null;
  recovery.recoveredCommit = null;
  recovery.recoveredDeploymentId = null;
  recovery.checks = recovery.checks.map((check) => ({
    ...check,
    status: "not_run",
    evidence: null,
  }));
  recovery.correction = {
    incidentId: null,
    statusRecordId: null,
    changelogPath: null,
    correctionRecordId: null,
  };
  recovery.signoff.owner = null;
  recovery.signoff.checkedAt = null;
  recovery.deliberatelyBadRelease = true;
  assert.match(
    recoveryRehearsalErrors(recovery).join("\n"),
    /invented run evidence/,
  );
});
