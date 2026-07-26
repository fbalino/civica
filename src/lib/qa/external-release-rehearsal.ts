export const STAGING_SMOKE_SCHEMA_VERSION =
  "civica-release-candidate-staging-smoke/v1" as const;
export const RECOVERY_REHEARSAL_SCHEMA_VERSION =
  "civica-rollback-forward-fix-rehearsal/v1" as const;

/**
 * QA-018 starts from the configured database ledger recorded at 0032. Because
 * db:migrate applies the authoritative ledger in order, the staging rehearsal
 * must include every later migration currently checked into the repository.
 *
 * The owning task is part of the protocol rather than an inferred annotation:
 * it identifies which task-specific live validation must be retained after the
 * shared migration pass.
 */
export const QA_018_DATABASE_HEAD = "0032_sparkling_genesis" as const;
export const QA_018_REQUIRED_MIGRATIONS = [
  { id: "0033_flat_hardball", ownerTaskId: "PLT-009" },
  { id: "0034_superb_the_fallen", ownerTaskId: "PLT-010" },
  { id: "0035_equal_marvex", ownerTaskId: "PLT-010" },
  { id: "0036_moaning_toad_men", ownerTaskId: "PLT-014" },
  { id: "0037_minor_sharon_carter", ownerTaskId: "PLT-016" },
  { id: "0038_heavy_slyde", ownerTaskId: "PLT-017" },
  { id: "0039_living_clea", ownerTaskId: "PLT-018" },
  { id: "0040_closed_young_avengers", ownerTaskId: "ATL-026" },
  { id: "0042_grey_sally_floyd", ownerTaskId: "ATL-027" },
  { id: "0043_pulse_decay_lifecycle", ownerTaskId: "PUL-027" },
  { id: "0044_pulse_drift_monitoring", ownerTaskId: "PUL-024" },
  {
    id: "0045_pulse_evaluation_workspace_reconciliation",
    ownerTaskId: "PUL-043",
  },
  { id: "0046_little_mulholland_black", ownerTaskId: "ATL-020" },
  { id: "0047_atlas_data_error_reports", ownerTaskId: "ATL-024" },
  { id: "0048_entity_name_forms", ownerTaskId: "EXP-029" },
  { id: "0049_curvy_shen", ownerTaskId: "ATL-027" },
  { id: "0050_index_release_header_contract", ownerTaskId: "PLT-014" },
] as const;

export const QA_018_DATABASE_TARGET_SCRIPT_PATHS = [
  "scripts/inspect-neon-target.ts",
  "scripts/plan-migration.ts",
  "scripts/db-migrate.ts",
  "scripts/validate-authoritative-migrations.ts",
  "scripts/validate-research-evidence-retention.ts",
  "scripts/validate-atlas-export.ts",
  "scripts/validate-ci-series-provenance.ts",
  "scripts/validate-pulse-runtime-method.ts",
  "scripts/validate-pulse-delta-lifecycle.ts",
  "scripts/validate-pulse-drift.ts",
  "scripts/sync-pulse-v2-score.ts",
  "scripts/audit-pulse-prospective-start.ts",
  "scripts/validate-pulse-evaluation-packets.ts",
  "scripts/reconcile-pulse-evaluation-coding-workspace.ts",
  "scripts/seed-pulse-evaluation-coding-studies.ts",
  "scripts/run-observed-production-pipeline.ts",
  "scripts/ingest-conditions-all.ts",
  "scripts/validate-conditions-release.ts",
] as const;

/**
 * An explicitly injected staging target must win over a developer's local
 * `.env.local`. Otherwise a nominal staging command can silently inspect or
 * mutate the configured production database.
 */
export function stagingDatabaseTargetingErrors(
  sources: Readonly<Record<string, string>>,
): string[] {
  const errors: string[] = [];
  for (const path of QA_018_DATABASE_TARGET_SCRIPT_PATHS) {
    const source = sources[path];
    if (!source) {
      errors.push(`staging database command source is unavailable: ${path}`);
    } else if (/override\s*:\s*true/.test(source)) {
      errors.push(
        `${path} overrides an explicitly injected staging environment`,
      );
    }
  }
  return errors;
}

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
type StagingRunStatus =
  | "pending_external_authority"
  | "run_complete_pending_owner_signoff"
  | "complete";
type RecoveryRunStatus = "pending_external_authority" | "complete";
type StagingRuntimeProofMode =
  | "deployment_env_pull"
  | "exact_preview_runtime";

interface CheckRecord {
  id: string;
  status: CheckStatus;
  evidence: string | null;
}

export interface StagingSmokeRecord {
  schemaVersion: typeof STAGING_SMOKE_SCHEMA_VERSION;
  taskId: "QA-018";
  status: StagingRunStatus;
  blocker: string | null;
  candidate: {
    commit: string | null;
    dataReleaseIds: string[];
    methodVersions: string[];
    migrationIds: string[];
    migrationOwners: Record<string, string>;
    assetManifestSha256: string | null;
  };
  isolation: {
    neonBranchId: string | null;
    vercelDeploymentId: string | null;
    productionDatabaseExcluded: boolean | null;
    jobsQuiesced: boolean | null;
    runtimeAttestation: {
      proofMode: StagingRuntimeProofMode | null;
      deploymentUrl: string | null;
      target: "preview" | null;
      candidateCommit: string | null;
      neonProjectId: string | null;
      neonBranchId: string | null;
      neonEndpointId: string | null;
      databaseHostnameSha256: string | null;
      forbiddenProductionBranchId: string | null;
      forbiddenProductionHostnameSha256: string | null;
      migrationHead: string | null;
      conditionsReleaseId: string | null;
      conditionsMethodologyVersion: string | null;
      conditionsManifestSha256: string | null;
      evidencePath: string | null;
      envPullUnavailable: {
        expectedState: "INITIALIZING";
        rejectedStates: Array<"BUILDING" | "READY">;
        errorCode: "deployment_state_window_unavailable";
      } | null;
    };
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
  status: RecoveryRunStatus;
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
  runCompleted: boolean,
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
  if (!runCompleted) {
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
const isVercelDeploymentId = (value: string | null) =>
  /^dpl_[A-Za-z0-9]+$/.test(value ?? "");
const isNeonBranchId = (value: string | null) =>
  /^br-[a-z0-9-]+$/.test(value ?? "");
const isNeonEndpointId = (value: string | null) =>
  /^ep-[a-z0-9-]+$/.test(value ?? "");

function isVercelPreviewUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.hostname.endsWith(".vercel.app")
    );
  } catch {
    return false;
  }
}

function runtimeAttestationErrors(
  record: StagingSmokeRecord,
  runCompleted: boolean,
): string[] {
  const errors: string[] = [];
  const attestation = record.isolation.runtimeAttestation;
  if (!attestation) {
    return ["staging runtime attestation is absent"];
  }

  if (!runCompleted) {
    const hasEvidence =
      Object.entries(attestation).some(
        ([key, value]) => key !== "envPullUnavailable" && value !== null,
      ) || attestation.envPullUnavailable !== null;
    if (hasEvidence) {
      errors.push(
        "pending staging record must not contain invented runtime attestation",
      );
    }
    return errors;
  }

  if (
    !["deployment_env_pull", "exact_preview_runtime"].includes(
      attestation.proofMode ?? "",
    )
  ) {
    errors.push("staging runtime proof mode is invalid");
  }
  if (
    !isVercelDeploymentId(record.isolation.vercelDeploymentId) ||
    !isVercelPreviewUrl(attestation.deploymentUrl) ||
    attestation.target !== "preview"
  ) {
    errors.push("staging runtime attestation is not bound to a Preview deployment");
  }
  if (
    !isCommit(attestation.candidateCommit) ||
    attestation.candidateCommit !== record.candidate.commit
  ) {
    errors.push("staging runtime attestation candidate commit does not match");
  }
  if (
    !attestation.neonProjectId?.trim() ||
    !isNeonBranchId(attestation.neonBranchId) ||
    attestation.neonBranchId !== record.isolation.neonBranchId ||
    !isNeonEndpointId(attestation.neonEndpointId)
  ) {
    errors.push("staging runtime attestation child database identity is invalid");
  }
  if (
    !isSha256(attestation.databaseHostnameSha256) ||
    !isNeonBranchId(attestation.forbiddenProductionBranchId) ||
    !isSha256(attestation.forbiddenProductionHostnameSha256) ||
    attestation.neonBranchId === attestation.forbiddenProductionBranchId ||
    attestation.databaseHostnameSha256 ===
      attestation.forbiddenProductionHostnameSha256 ||
    record.isolation.productionDatabaseExcluded !== true
  ) {
    errors.push(
      "staging runtime attestation does not fail closed against production",
    );
  }
  if (
    attestation.migrationHead !==
    QA_018_REQUIRED_MIGRATIONS.at(-1)?.id
  ) {
    errors.push("staging runtime attestation migration head is invalid");
  }
  if (
    !attestation.conditionsReleaseId?.trim() ||
    !record.candidate.dataReleaseIds.includes(
      attestation.conditionsReleaseId,
    ) ||
    !attestation.conditionsMethodologyVersion?.trim() ||
    !record.candidate.methodVersions.includes(
      attestation.conditionsMethodologyVersion,
    ) ||
    !isSha256(attestation.conditionsManifestSha256)
  ) {
    errors.push("staging runtime attestation Conditions pointer is invalid");
  }
  if (
    !attestation.evidencePath ||
    !/^plan\/evidence\/QA-018\/[A-Za-z0-9._/-]+\.json$/.test(
      attestation.evidencePath,
    ) ||
    attestation.evidencePath.includes("..")
  ) {
    errors.push("staging runtime attestation evidence path is invalid");
  }

  if (attestation.proofMode === "deployment_env_pull") {
    if (attestation.envPullUnavailable !== null) {
      errors.push(
        "deployment environment-pull proof cannot claim the state window was unavailable",
      );
    }
  } else if (attestation.proofMode === "exact_preview_runtime") {
    const fallback = attestation.envPullUnavailable;
    const rejectedStates = [...(fallback?.rejectedStates ?? [])].sort();
    if (
      fallback?.expectedState !== "INITIALIZING" ||
      fallback.errorCode !== "deployment_state_window_unavailable" ||
      JSON.stringify(rejectedStates) !== JSON.stringify(["BUILDING", "READY"])
    ) {
      errors.push(
        "exact Preview runtime proof lacks the bounded Vercel state-window failure",
      );
    }
  }

  return errors;
}

function stagingMigrationPlanErrors(record: StagingSmokeRecord) {
  const errors: string[] = [];
  const expectedIds = QA_018_REQUIRED_MIGRATIONS.map(({ id }) => id);
  if (
    JSON.stringify(record.candidate.migrationIds) !==
    JSON.stringify(expectedIds)
  ) {
    errors.push(
      `candidate migrations must exactly follow the authoritative ledger after ${QA_018_DATABASE_HEAD}`,
    );
  }

  const expectedOwners = Object.fromEntries(
    QA_018_REQUIRED_MIGRATIONS.map(({ id, ownerTaskId }) => [id, ownerTaskId]),
  );
  const actualOwners = record.candidate.migrationOwners ?? {};
  const actualOwnerIds = Object.keys(actualOwners);
  if (
    JSON.stringify(actualOwnerIds) !== JSON.stringify(expectedIds) ||
    QA_018_REQUIRED_MIGRATIONS.some(
      ({ id, ownerTaskId }) => actualOwners[id] !== ownerTaskId,
    )
  ) {
    errors.push(
      `candidate migration owners must exactly match ${JSON.stringify(expectedOwners)}`,
    );
  }
  return errors;
}

export function stagingSmokeErrors(record: StagingSmokeRecord) {
  const errors = [
    ...checkSetErrors(
      record.checks,
      STAGING_CHECK_IDS,
      record.status !== "pending_external_authority",
    ),
    ...stagingMigrationPlanErrors(record),
    ...runtimeAttestationErrors(
      record,
      record.status !== "pending_external_authority",
    ),
  ];
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
      !isVercelDeploymentId(record.isolation.vercelDeploymentId) ||
      record.isolation.productionDatabaseExcluded !== true ||
      record.isolation.jobsQuiesced !== true
    ) {
      errors.push("complete staging record lacks isolation and quiescence proof");
    }
    if (record.status === "run_complete_pending_owner_signoff") {
      if (record.blocker !== "owner_post_run_signoff") {
        errors.push(
          "technically complete staging record must name the owner sign-off blocker",
        );
      }
      if (
        record.signoff.owner !== null ||
        record.signoff.checkedAt !== null
      ) {
        errors.push(
          "technically complete staging record must not fabricate owner sign-off",
        );
      }
      if (
        record.signoff.remainingManualChecks.length === 0 ||
        record.signoff.remainingManualChecks.some((item) => !item.trim())
      ) {
        errors.push(
          "technically complete staging record must identify the remaining owner review",
        );
      }
    } else {
      if (record.blocker !== null) {
        errors.push("complete staging record retains blocker");
      }
      if (!record.signoff.owner || !isTimestamp(record.signoff.checkedAt)) {
        errors.push("complete staging record lacks dated owner sign-off");
      }
    }
  }
  return errors;
}

export function recoveryRehearsalErrors(record: RecoveryRehearsalRecord) {
  const errors = checkSetErrors(
    record.checks,
    RECOVERY_CHECK_IDS,
    record.status !== "pending_external_authority",
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
