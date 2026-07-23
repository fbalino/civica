export const STAGING_SMOKE_SCHEMA_VERSION =
  "civica-release-candidate-staging-smoke/v1" as const;
export const RECOVERY_REHEARSAL_SCHEMA_VERSION =
  "civica-rollback-forward-fix-rehearsal/v1" as const;

export const STAGING_CHECK_IDS = [
  "zero-write-migration-plan",
  "authoritative-migrations",
  "schema-fingerprint",
  "release-data",
  "deployment-identity",
  "cache-headers",
  "atlas-browser",
  "index-api",
  "pulse-api",
  "protected-error",
  "cron-dry-run",
  "source-freshness-unchanged",
] as const;

export const RECOVERY_CHECK_IDS = [
  "detect-seeded-defect",
  "quiesce-jobs",
  "contain-traffic",
  "select-compatible-recovery",
  "restore-or-forward-fix-app",
  "verify-data-state",
  "verify-cache-state",
  "verify-artifact-state",
  "verify-version-metadata",
  "publish-correction-record",
  "publish-status-and-changelog",
  "resume-after-verification",
] as const;

type CheckStatus = "not_run" | "pass" | "fail";
type RunStatus = "pending_external_authority" | "complete";

interface CheckRecord {
  id: string;
  status: CheckStatus;
  evidence: string | null;
}

export interface StagingSmokeRecord {
  schemaVersion: typeof STAGING_SMOKE_SCHEMA_VERSION;
  taskId: "QA-018";
  status: RunStatus;
  blocker: string | null;
  candidate: {
    commit: string | null;
    dataReleaseIds: string[];
    methodVersions: string[];
    migrationIds: string[];
    assetManifestSha256: string | null;
  };
  isolation: {
    neonBranchId: string | null;
    vercelDeploymentId: string | null;
    productionDatabaseExcluded: boolean | null;
    jobsQuiesced: boolean | null;
  };
  checks: CheckRecord[];
  signoff: {
    owner: string | null;
    checkedAt: string | null;
    remainingManualChecks: string[];
  };
}

export interface RecoveryRehearsalRecord {
  schemaVersion: typeof RECOVERY_REHEARSAL_SCHEMA_VERSION;
  taskId: "QA-019";
  status: RunStatus;
  blocker: string | null;
  deliberatelyBadRelease: boolean;
  candidateCommit: string | null;
  stagingDeploymentId: string | null;
  defectFixture: string | null;
  recoveryMode: "instant_rollback" | "forward_fix" | null;
  recoveredCommit: string | null;
  checks: CheckRecord[];
  correction: {
    incidentId: string | null;
    statusRecordId: string | null;
    changelogPath: string | null;
    correctionRecordId: string | null;
  };
  signoff: {
    owner: string | null;
    checkedAt: string | null;
    remainingManualChecks: string[];
  };
}

function checkSetErrors(
  records: CheckRecord[],
  requiredIds: readonly string[],
  status: RunStatus,
) {
  const errors: string[] = [];
  const ids = records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) errors.push("check IDs must be unique");
  for (const id of requiredIds) {
    if (!ids.includes(id)) errors.push(`missing required check ${id}`);
  }
  for (const id of ids) {
    if (!requiredIds.includes(id)) errors.push(`unknown check ${id}`);
  }
  if (status === "pending_external_authority") {
    for (const check of records) {
      if (check.status !== "not_run" || check.evidence !== null) {
        errors.push(`${check.id} fabricates evidence before the external run`);
      }
    }
  } else {
    for (const check of records) {
      if (check.status !== "pass" || !check.evidence?.trim()) {
        errors.push(`${check.id} is not a passing evidenced check`);
      }
    }
  }
  return errors;
}

const isSha256 = (value: string | null) => /^[a-f0-9]{64}$/.test(value ?? "");
const isCommit = (value: string | null) => /^[a-f0-9]{40}$/.test(value ?? "");
const isTimestamp = (value: string | null) =>
  value !== null && Number.isFinite(Date.parse(value));

export function stagingSmokeErrors(record: StagingSmokeRecord) {
  const errors = checkSetErrors(
    record.checks,
    STAGING_CHECK_IDS,
    record.status,
  );
  if (record.schemaVersion !== STAGING_SMOKE_SCHEMA_VERSION) {
    errors.push(`unexpected staging schema ${record.schemaVersion}`);
  }
  if (record.taskId !== "QA-018") errors.push("staging record must own QA-018");
  if (record.status === "pending_external_authority") {
    if (record.blocker !== "owner_platform_staging_authority") {
      errors.push("pending staging record must name its authority blocker");
    }
    if (
      record.candidate.commit !== null ||
      record.candidate.dataReleaseIds.length > 0 ||
      record.candidate.methodVersions.length > 0 ||
      record.candidate.assetManifestSha256 !== null ||
      record.isolation.neonBranchId !== null ||
      record.isolation.vercelDeploymentId !== null ||
      record.isolation.productionDatabaseExcluded !== null ||
      record.isolation.jobsQuiesced !== null ||
      record.signoff.owner !== null ||
      record.signoff.checkedAt !== null
    ) {
      errors.push("pending staging record must not contain invented run evidence");
    }
  } else {
    if (record.blocker !== null) errors.push("complete staging record retains blocker");
    if (!isCommit(record.candidate.commit)) errors.push("candidate commit is invalid");
    if (!isSha256(record.candidate.assetManifestSha256)) {
      errors.push("asset manifest SHA-256 is invalid");
    }
    if (
      record.candidate.dataReleaseIds.length === 0 ||
      record.candidate.methodVersions.length === 0 ||
      record.candidate.migrationIds.length === 0
    ) {
      errors.push("complete staging record lacks version identities");
    }
    if (
      !record.isolation.neonBranchId ||
      !record.isolation.vercelDeploymentId ||
      record.isolation.productionDatabaseExcluded !== true ||
      record.isolation.jobsQuiesced !== true
    ) {
      errors.push("complete staging record lacks isolation and quiescence proof");
    }
    if (!record.signoff.owner || !isTimestamp(record.signoff.checkedAt)) {
      errors.push("complete staging record lacks dated owner sign-off");
    }
  }
  return errors;
}

export function recoveryRehearsalErrors(record: RecoveryRehearsalRecord) {
  const errors = checkSetErrors(
    record.checks,
    RECOVERY_CHECK_IDS,
    record.status,
  );
  if (record.schemaVersion !== RECOVERY_REHEARSAL_SCHEMA_VERSION) {
    errors.push(`unexpected recovery schema ${record.schemaVersion}`);
  }
  if (record.taskId !== "QA-019") errors.push("recovery record must own QA-019");
  if (record.status === "pending_external_authority") {
    if (record.blocker !== "owner_platform_staging_authority") {
      errors.push("pending recovery record must name its authority blocker");
    }
    if (
      record.deliberatelyBadRelease ||
      record.candidateCommit !== null ||
      record.stagingDeploymentId !== null ||
      record.defectFixture !== null ||
      record.recoveryMode !== null ||
      record.recoveredCommit !== null ||
      Object.values(record.correction).some((value) => value !== null) ||
      record.signoff.owner !== null ||
      record.signoff.checkedAt !== null
    ) {
      errors.push("pending recovery record must not contain invented run evidence");
    }
  } else {
    if (record.blocker !== null) errors.push("complete recovery record retains blocker");
    if (!record.deliberatelyBadRelease) {
      errors.push("complete recovery record lacks deliberate bad release");
    }
    if (
      !isCommit(record.candidateCommit) ||
      !record.stagingDeploymentId ||
      !record.defectFixture ||
      !record.recoveryMode ||
      !isCommit(record.recoveredCommit)
    ) {
      errors.push("complete recovery record lacks release/recovery identities");
    }
    if (Object.values(record.correction).some((value) => !value?.trim())) {
      errors.push("complete recovery record lacks correction/status/changelog evidence");
    }
    if (!record.signoff.owner || !isTimestamp(record.signoff.checkedAt)) {
      errors.push("complete recovery record lacks dated owner sign-off");
    }
  }
  return errors;
}
