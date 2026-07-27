import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import {
  QA_018_DATABASE_HEAD,
  QA_018_DATABASE_TARGET_SCRIPT_PATHS,
  QA_018_REQUIRED_MIGRATIONS,
  qa018CompletedDatabaseProofErrors,
  recoveryRehearsalErrors,
  stagingDatabaseTargetingErrors,
  stagingSmokeErrors,
  type RecoveryRehearsalRecord,
  type StagingSmokeRecord,
} from "../src/lib/qa/external-release-rehearsal";
import { AUTHORITATIVE_MIGRATIONS } from "../src/lib/db/authoritative-migration-manifest";

const readJson = <T>(path: string) =>
  JSON.parse(readFileSync(path, "utf8")) as T;

const staging = readJson<StagingSmokeRecord>(
  "data/release-candidate-staging-smoke.v1.json",
);
const recovery = readJson<RecoveryRehearsalRecord>(
  "data/rollback-forward-fix-rehearsal.v1.json",
);
const cliIsolationPath =
  "plan/evidence/QA-018/vercel-cli-isolation-probe.v1.json";
interface CliIsolationProbe {
  schemaVersion: string;
  candidateCommit: string;
  vercel: {
    cliVersion: string;
    manualDeploymentProvisioningAvailable: boolean;
    integrationUpdateSupportsDeploymentConfiguration: boolean;
    automaticPreviewBranchingObserved: boolean;
    deployments: Array<{ id: string; status: string; purpose: string }>;
  };
  accessBoundary: {
    acceptedEvidenceSource: string;
    neonBrowserSignInAttempted: boolean;
    neonBrowserAccessObtained: boolean;
    browserEvidenceUsed: boolean;
    futureRequiredPath: string;
  };
  configuredDatabase: {
    projectId: string;
    branchId: string;
    endpointId: string;
    hostSha256: string;
    migrationHeadBefore: string;
    migrationHeadAfter: string;
  };
  probe: {
    deploymentId: string;
    target: string;
    result: string;
    reason: string;
    databaseQueriesWereReadOnly: boolean;
    databaseWritesPerformed: number;
    migrationsApplied: string[];
    conditionsRuns: number;
  };
  blocker: {
    id: string;
    authorityRequired: boolean;
    productionPromotionAuthorized: boolean;
  };
}

interface PreviewDatabaseSnapshot {
  sourceFreshness: { rows: number; sha256: string };
  activeCronLeases: number;
  migrationLedger: {
    rows: number;
    head: string;
    orderedIdsSha256: string;
    hashesMatchRepository: boolean;
  };
  publicSchema: { sha256: string };
  conditions: {
    release: {
      id: string;
      methodology_version: string;
      manifest_sha256: string;
    };
    counts: {
      calculations: number;
      components: number;
      scores: number;
    };
  };
  indexPointer: { release_id: string };
  pulsePointer: { computation_run_id: string };
}

interface PreviewSmokeEvidence {
  schemaVersion: string;
  taskId: string;
  candidate: {
    commit: string;
    deploymentId: string;
    deploymentUrl: string;
    staticAssetManifest: {
      files: number;
      bytes: number;
      sha256: string;
    };
  };
  isolation: {
    neonProjectId: string;
    neonBranchId: string;
    neonEndpointId: string;
    databaseHostnameSha256: string;
    productionDatabaseBranchId: string;
    productionDatabaseHostnameSha256: string;
    productionMigrationHeadBefore: string;
    productionMigrationHeadAfter: string;
    productionDatabaseExcluded: boolean;
    deploymentScopedEnvPull: {
      status: "pulled" | "tooling_state_window_unavailable";
      attempts: Array<
        | "INITIALIZING_pulled"
        | "BUILDING_expected_INITIALIZING"
        | "READY_expected_INITIALIZING"
      >;
      alternativeProof: "" | "exact_preview_runtime_identity";
    };
  };
  database: {
    before: PreviewDatabaseSnapshot;
    after: PreviewDatabaseSnapshot;
    sourceFreshnessUnchanged: boolean;
    jobsQuiesced: boolean;
  };
  api: {
    conditions: {
      status: number;
      bodySha256: string;
      release: {
        releaseId: string;
        methodologyVersion: string;
        manifestSha256: string;
      };
      calculations: number;
      components: number;
      alignmentStates: string[];
      aggregateOrRankPublished: boolean;
    };
    index: {
      status: number;
      releaseId: string;
      methodologyVersion: string;
    };
    pulse: {
      status: number;
      runtimeMethod: string;
      runId: string;
    };
    cache: {
      mutable: { status: number; cacheControl: string };
      checked: { status: number; cacheControl: string; xVercelCache: string };
      frozen: { status: number; cacheControl: string; xVercelCache: string };
    };
    protectedUnauthorized: { status: number; error: string };
    cronDryRun: {
      first: { status: number; dryRun: boolean };
      duplicate: { status: number; outcome: string };
    };
  };
  status: string;
  failures: string[];
}

interface ConditionsReleaseIdentity {
  releaseId: string;
  methodologyVersion: string;
  manifestSha256: string;
}

interface Atl016ReleaseBrowserEvidence {
  schemaVersion: string;
  taskId: string;
  status: string;
  candidateCommit: string;
  deploymentId: string;
  isolationEvidence: string;
  release: ConditionsReleaseIdentity;
  browserEvidence: {
    path: string;
    sha256: string;
    checks: number;
    screenshots: number;
    screenshotInventorySha256: string;
    consoleErrors: number;
  };
  coverage: {
    comparisonCountryCount: number;
    alignmentStates: string[];
    sourceVisible: boolean;
    nativeUnitVisible: boolean;
    componentYearVisible: boolean;
    missingnessVisible: boolean;
    releaseIdentityVisible: boolean;
    noCompositeDisclosureVisible: boolean;
    crossCountryRankPublished: boolean;
    crossDimensionAggregatePublished: boolean;
    horizontalOverflow: boolean;
  };
  apiReconciliation: string;
}

interface Atl029ReleaseReconciliation {
  schemaVersion: string;
  taskId: string;
  status: string;
  candidateCommit: string;
  deploymentId: string;
  isolationEvidence: string;
  release: ConditionsReleaseIdentity;
  storedRelease: {
    counts: {
      calculations: number;
      components: number;
      scores: number;
    };
  };
  publicApi: {
    status: number;
    bodySha256: string;
    counts: {
      calculations: number;
      components: number;
      scores: number;
    };
    scopeReconciliation: {
      excludedNonSovereignCalculations: number;
      excludedNonSovereignComponents: number;
    };
    alignmentStates: string[];
    aggregateOrRankPublished: boolean;
  };
  readerSurfaces: {
    browserEvidence: string;
    allThreeAlignmentStatesVisible: boolean;
    horizontalOverflow: boolean;
    consoleErrors: number;
  };
  outcome: Record<string, boolean>;
}

interface Atl030ReleaseReproduction {
  schemaVersion: string;
  taskId: string;
  status: string;
  candidateCommit: string;
  release: ConditionsReleaseIdentity;
  capturedWorldBankInput: {
    fileByteLength: number;
    fileSha256: string;
    capturePayloadSha256: string;
    responses: number;
    http200Responses: number;
    requestCountryCodes: number;
    indicators: string[];
  };
  expectationsArtifacts: {
    preWriteArtifactSha256: string;
    postMigrationValidationArtifactSha256: string;
    expectedCalculationCounts: Record<string, number>;
  };
  liveValidation: {
    status: string;
    manifestReplaySha256: string;
    counts: {
      calculations: number;
      components: number;
      scores: number;
      retainedTablesWithTriggers: number;
      mutationHistoryRows: number;
    };
    replay: {
      calculationKeysReplayed: number;
      calculationKeysMatched: number;
      manifestMatched: boolean;
      retainedTablesCovered: boolean;
      mutationHistoryEmpty: boolean;
    };
    errors: string[];
  };
  exactInputReplay: {
    exitCode: number;
    insertedScores: number;
    insertedComponents: number;
    releaseStateUnchanged: boolean;
    sourceFreshnessUnchanged: boolean;
  };
  alteredInputRefusal: {
    alteredCaptureFileSha256: string;
    alteredCapturePayloadSha256: string;
    alteredManifestSha256: string;
    alteredExpectationsArtifactSha256: string;
    exitCode: number;
    releaseStateUnchanged: boolean;
    sourceFreshnessUnchanged: boolean;
  };
  beforeAfterSnapshot: {
    identical: boolean;
    selectedReleaseCalculations: number;
    selectedReleaseComponents: number;
    selectedReleaseScores: number;
  };
  publicReadReconciliation: string;
  previewSmokeEvidence: string;
  rawCaptureCommitted: boolean;
  productionDatabaseMutated: boolean;
}

interface ConditionsBrowserEvidence {
  deploymentId: string;
  status: string;
  checks: Array<{
    status: string;
    screenshot?: string;
    screenshots?: string[];
  }>;
  consoleErrors: unknown[];
}

const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const isSha256 = (value: string | null | undefined) =>
  /^[a-f0-9]{64}$/.test(value ?? "");
const hostname = (value: string) => {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

function sameRelease(
  left: ConditionsReleaseIdentity,
  right: ConditionsReleaseIdentity,
) {
  return (
    left.releaseId === right.releaseId &&
    left.methodologyVersion === right.methodologyVersion &&
    left.manifestSha256 === right.manifestSha256
  );
}
const cliIsolationRaw = readFileSync(cliIsolationPath, "utf8");
const cliIsolation = JSON.parse(cliIsolationRaw) as CliIsolationProbe;
const errors = [
  ...stagingSmokeErrors(staging).map((error) => `QA-018: ${error}`),
  ...recoveryRehearsalErrors(recovery).map((error) => `QA-019: ${error}`),
  ...stagingDatabaseTargetingErrors(
    Object.fromEntries(
      QA_018_DATABASE_TARGET_SCRIPT_PATHS.map((path) => [
        path,
        readFileSync(path, "utf8"),
      ]),
    ),
  ).map((error) => `QA-018: ${error}`),
];

if (staging.status !== "pending_external_authority") {
  const attestation = staging.isolation.runtimeAttestation;
  const evidencePath = attestation?.evidencePath;
  if (
    !evidencePath ||
    !evidencePath.startsWith("plan/evidence/QA-018/") ||
    evidencePath.includes("..") ||
    !existsSync(evidencePath)
  ) {
    errors.push("QA-018: successful runtime-attestation evidence is absent");
  } else {
    const runtimeRaw = readFileSync(evidencePath, "utf8");
    let runtime: PreviewSmokeEvidence | null = null;
    try {
      runtime = JSON.parse(runtimeRaw) as PreviewSmokeEvidence;
    } catch {
      errors.push("QA-018: successful runtime-attestation evidence is invalid JSON");
    }
    if (runtime) {
      const before = runtime.database.before;
      const after = runtime.database.after;
      errors.push(
        ...qa018CompletedDatabaseProofErrors(
          runtime,
          {
            forbiddenProductionBranchId:
              attestation.forbiddenProductionBranchId,
            forbiddenProductionHostnameSha256:
              attestation.forbiddenProductionHostnameSha256,
          },
        ).map((error) => `QA-018: ${error}`),
      );
      if (
        runtime.schemaVersion !==
          "civica-qa018-preview-smoke-evidence/v1" ||
        runtime.taskId !== "QA-018" ||
        runtime.status !== "pass" ||
        runtime.failures.length !== 0
      ) {
        errors.push("QA-018: Preview smoke result is not a passing QA-018 run");
      }
      if (
        runtime.candidate.commit !== staging.candidate.commit ||
        runtime.candidate.deploymentId !==
          staging.isolation.vercelDeploymentId ||
        runtime.candidate.deploymentId !== attestation.deploymentId ||
        runtime.candidate.deploymentUrl !== attestation.deploymentUrl ||
        hostname(runtime.candidate.deploymentUrl) !==
          attestation.deploymentHost ||
        runtime.candidate.staticAssetManifest.sha256 !==
          staging.candidate.assetManifestSha256 ||
        runtime.candidate.staticAssetManifest.files <= 0 ||
        runtime.candidate.staticAssetManifest.bytes <= 0
      ) {
        errors.push(
          "QA-018: Preview smoke evidence does not match the candidate deployment",
        );
      }
      if (
        runtime.isolation.neonProjectId !== attestation.neonProjectId ||
        runtime.isolation.neonBranchId !== attestation.neonBranchId ||
        runtime.isolation.neonEndpointId !== attestation.neonEndpointId ||
        runtime.isolation.databaseHostnameSha256 !==
          attestation.databaseHostnameSha256 ||
        runtime.isolation.productionDatabaseHostnameSha256 !==
          attestation.forbiddenProductionHostnameSha256 ||
        runtime.isolation.productionDatabaseExcluded !== true
      ) {
        errors.push(
          "QA-018: Preview smoke evidence does not preserve child/production isolation",
        );
      }
      const expectedEnvPullAttempts =
        attestation.envPullAttemptEvidence?.attempts.map((attempt) =>
          attempt.outcome === "pulled"
            ? "INITIALIZING_pulled"
            : `${attempt.observedState}_expected_INITIALIZING`,
        ) ?? [];
      const envPullMatchesAttestation =
        JSON.stringify(
          [...runtime.isolation.deploymentScopedEnvPull.attempts].sort(),
        ) === JSON.stringify([...expectedEnvPullAttempts].sort());
      if (
        attestation.proofMode === "deployment_env_pull" &&
        (runtime.isolation.deploymentScopedEnvPull.status !== "pulled" ||
          !envPullMatchesAttestation ||
          runtime.isolation.deploymentScopedEnvPull.alternativeProof !== "")
      ) {
        errors.push(
          "QA-018: preferred deployment env-pull proof does not retain the successful INITIALIZING pull",
        );
      }
      if (
        attestation.proofMode === "exact_preview_runtime" &&
        (runtime.isolation.deploymentScopedEnvPull.status !==
          "tooling_state_window_unavailable" ||
          !envPullMatchesAttestation ||
          runtime.isolation.deploymentScopedEnvPull.alternativeProof !==
            "exact_preview_runtime_identity")
      ) {
        errors.push(
          "QA-018: exact Preview proof does not retain the bounded env-pull failure",
        );
      }
      if (
        before.migrationLedger.head !== attestation.migrationHead ||
        after.migrationLedger.head !== attestation.migrationHead ||
        before.migrationLedger.hashesMatchRepository !== true ||
        after.migrationLedger.hashesMatchRepository !== true ||
        before.publicSchema.sha256 !== after.publicSchema.sha256
      ) {
        errors.push(
          "QA-018: Preview smoke evidence does not bind the authoritative head and schema",
        );
      }
      if (
        before.conditions.release.id !== attestation.conditionsReleaseId ||
        after.conditions.release.id !== attestation.conditionsReleaseId ||
        before.conditions.release.methodology_version !==
          attestation.conditionsMethodologyVersion ||
        after.conditions.release.methodology_version !==
          attestation.conditionsMethodologyVersion ||
        before.conditions.release.manifest_sha256 !==
          attestation.conditionsManifestSha256 ||
        after.conditions.release.manifest_sha256 !==
          attestation.conditionsManifestSha256 ||
        JSON.stringify(before.conditions.counts) !==
          JSON.stringify(after.conditions.counts) ||
        before.conditions.counts.calculations <= 0 ||
        before.conditions.counts.components <= 0
      ) {
        errors.push(
          "QA-018: Preview smoke evidence does not bind the child-only Conditions release",
        );
      }
      if (
        runtime.api.conditions.status !== 200 ||
        runtime.api.conditions.release.releaseId !==
          attestation.conditionsReleaseId ||
        runtime.api.conditions.release.methodologyVersion !==
          attestation.conditionsMethodologyVersion ||
        runtime.api.conditions.release.manifestSha256 !==
          attestation.conditionsManifestSha256 ||
        runtime.api.conditions.calculations <= 0 ||
        runtime.api.conditions.components <= 0 ||
        JSON.stringify([...runtime.api.conditions.alignmentStates].sort()) !==
          JSON.stringify(
            ["aligned", "missing_component", "mixed_year_refused"],
          ) ||
        runtime.api.conditions.aggregateOrRankPublished !== false
      ) {
        errors.push(
          "QA-018: Preview Conditions API did not reconcile to the attested release",
        );
      }
      if (
        runtime.api.index.status !== 200 ||
        !staging.candidate.dataReleaseIds.includes(
          runtime.api.index.releaseId,
        ) ||
        !staging.candidate.methodVersions.includes(
          runtime.api.index.methodologyVersion,
        ) ||
        runtime.api.pulse.status !== 200 ||
        !staging.candidate.dataReleaseIds.includes(runtime.api.pulse.runId) ||
        !staging.candidate.methodVersions.includes(
          runtime.api.pulse.runtimeMethod,
        ) ||
        before.indexPointer.release_id !== runtime.api.index.releaseId ||
        after.indexPointer.release_id !== runtime.api.index.releaseId ||
        before.pulsePointer.computation_run_id !== runtime.api.pulse.runId ||
        after.pulsePointer.computation_run_id !== runtime.api.pulse.runId
      ) {
        errors.push(
          "QA-018: Preview Index/Pulse APIs do not match the candidate pointers",
        );
      }
      if (
        runtime.api.cache.mutable.status !== 200 ||
        runtime.api.cache.mutable.cacheControl !== "no-store" ||
        runtime.api.cache.checked.status !== 200 ||
        !runtime.api.cache.checked.cacheControl.includes("must-revalidate") ||
        runtime.api.cache.checked.xVercelCache !== "HIT" ||
        runtime.api.cache.frozen.status !== 200 ||
        !runtime.api.cache.frozen.cacheControl.includes("immutable") ||
        runtime.api.cache.frozen.xVercelCache !== "HIT" ||
        runtime.api.protectedUnauthorized.status !== 401 ||
        runtime.api.protectedUnauthorized.error !== "Unauthorized" ||
        runtime.api.cronDryRun.first.status !== 200 ||
        runtime.api.cronDryRun.first.dryRun !== true ||
        runtime.api.cronDryRun.duplicate.status !== 200 ||
        runtime.api.cronDryRun.duplicate.outcome !== "duplicate_suppressed"
      ) {
        errors.push(
          "QA-018: Preview cache/protected/cron smoke evidence is incomplete",
        );
      }
      if (
        runtime.database.sourceFreshnessUnchanged !== true ||
        runtime.database.jobsQuiesced !== true ||
        before.activeCronLeases !== 0 ||
        after.activeCronLeases !== 0 ||
        before.sourceFreshness.rows !== after.sourceFreshness.rows ||
        before.sourceFreshness.sha256 !== after.sourceFreshness.sha256
      ) {
        errors.push(
          "QA-018: Preview dry run advanced freshness or did not preserve quiescence",
        );
      }
      if (
        /postgres(?:ql)?:\/\/|-----BEGIN [A-Z ]+PRIVATE KEY-----|x-vercel-protection-bypass\s*[:=]/i.test(
          runtimeRaw,
        )
      ) {
        errors.push("QA-018: Preview smoke evidence contains a credential");
      }
    }
  }
}

if (staging.status !== "pending_external_authority") {
  const taskEvidencePaths = {
    atl016: "plan/evidence/ATL-016/release-browser-reconciliation.v1.json",
    atl029: "plan/evidence/ATL-029/release-reconciliation.v1.json",
    atl030: "plan/evidence/ATL-030/release-reproduction.v1.json",
  } as const;
  for (const [taskId, path] of Object.entries(taskEvidencePaths)) {
    if (!existsSync(path)) {
      errors.push(`QA-018: ${taskId.toUpperCase()} staging evidence is absent`);
    }
  }

  const runtimePath = staging.isolation.runtimeAttestation.evidencePath;
  if (
    runtimePath &&
    existsSync(runtimePath) &&
    Object.values(taskEvidencePaths).every((path) => existsSync(path))
  ) {
    const runtime = JSON.parse(
      readFileSync(runtimePath, "utf8"),
    ) as PreviewSmokeEvidence;
    const atl016Raw = readFileSync(taskEvidencePaths.atl016, "utf8");
    const atl029Raw = readFileSync(taskEvidencePaths.atl029, "utf8");
    const atl030Raw = readFileSync(taskEvidencePaths.atl030, "utf8");
    const atl016 = JSON.parse(atl016Raw) as Atl016ReleaseBrowserEvidence;
    const atl029 = JSON.parse(atl029Raw) as Atl029ReleaseReconciliation;
    const atl030 = JSON.parse(atl030Raw) as Atl030ReleaseReproduction;
    const attestedRelease: ConditionsReleaseIdentity = {
      releaseId:
        staging.isolation.runtimeAttestation.conditionsReleaseId ?? "",
      methodologyVersion:
        staging.isolation.runtimeAttestation.conditionsMethodologyVersion ??
        "",
      manifestSha256:
        staging.isolation.runtimeAttestation.conditionsManifestSha256 ?? "",
    };

    if (
      atl016.schemaVersion !==
        "civica-atl-016-release-browser-reconciliation/v1" ||
      atl016.taskId !== "ATL-016" ||
      atl016.status !== "pass" ||
      atl016.candidateCommit !== staging.candidate.commit ||
      atl016.deploymentId !== staging.isolation.vercelDeploymentId ||
      atl016.isolationEvidence !== runtimePath ||
      !sameRelease(atl016.release, attestedRelease)
    ) {
      errors.push("QA-018: ATL-016 release/browser evidence identity drifted");
    }
    if (
      !existsSync(atl016.browserEvidence.path) ||
      sha256(readFileSync(atl016.browserEvidence.path)) !==
        atl016.browserEvidence.sha256
    ) {
      errors.push("QA-018: ATL-016 browser-evidence hash drifted");
    } else {
      const browser = JSON.parse(
        readFileSync(atl016.browserEvidence.path, "utf8"),
      ) as ConditionsBrowserEvidence;
      const screenshots = [
        ...new Set(
          browser.checks.flatMap((check) => [
            ...(check.screenshot ? [check.screenshot] : []),
            ...(check.screenshots ?? []),
          ]),
        ),
      ].sort();
      const screenshotInventory = screenshots
        .map((path) =>
          existsSync(path) ? `${sha256(readFileSync(path))}  ${path}\n` : "",
        )
        .join("");
      if (
        browser.deploymentId !== atl016.deploymentId ||
        browser.status !== "pass" ||
        browser.checks.length !== atl016.browserEvidence.checks ||
        browser.checks.some(({ status }) => status !== "pass") ||
        browser.consoleErrors.length !== atl016.browserEvidence.consoleErrors ||
        screenshots.length !== atl016.browserEvidence.screenshots ||
        screenshots.some((path) => !existsSync(path)) ||
        sha256(screenshotInventory) !==
          atl016.browserEvidence.screenshotInventorySha256
      ) {
        errors.push(
          "QA-018: ATL-016 responsive browser packet is incomplete or drifted",
        );
      }
    }
    if (
      atl016.coverage.comparisonCountryCount < 3 ||
      JSON.stringify([...atl016.coverage.alignmentStates].sort()) !==
        JSON.stringify(["aligned", "missing_component", "mixed_year_refused"]) ||
      !atl016.coverage.sourceVisible ||
      !atl016.coverage.nativeUnitVisible ||
      !atl016.coverage.componentYearVisible ||
      !atl016.coverage.missingnessVisible ||
      !atl016.coverage.releaseIdentityVisible ||
      !atl016.coverage.noCompositeDisclosureVisible ||
      atl016.coverage.crossCountryRankPublished ||
      atl016.coverage.crossDimensionAggregatePublished ||
      atl016.coverage.horizontalOverflow ||
      atl016.apiReconciliation !== taskEvidencePaths.atl029
    ) {
      errors.push("QA-018: ATL-016 surface coverage contract is incomplete");
    }

    if (
      atl029.schemaVersion !==
        "civica-atl-029-release-reconciliation/v1" ||
      atl029.taskId !== "ATL-029" ||
      atl029.status !== "pass" ||
      atl029.candidateCommit !== staging.candidate.commit ||
      atl029.deploymentId !== staging.isolation.vercelDeploymentId ||
      atl029.isolationEvidence !== runtimePath ||
      !sameRelease(atl029.release, attestedRelease)
    ) {
      errors.push("QA-018: ATL-029 release reconciliation identity drifted");
    }
    if (
      atl029.storedRelease.counts.calculations !==
        runtime.database.before.conditions.counts.calculations ||
      atl029.storedRelease.counts.components !==
        runtime.database.before.conditions.counts.components ||
      atl029.storedRelease.counts.scores !==
        runtime.database.before.conditions.counts.scores ||
      atl029.publicApi.status !== runtime.api.conditions.status ||
      atl029.publicApi.bodySha256 !== runtime.api.conditions.bodySha256 ||
      atl029.publicApi.counts.calculations !==
        runtime.api.conditions.calculations ||
      atl029.publicApi.counts.components !== runtime.api.conditions.components ||
      atl029.publicApi.counts.scores !==
        runtime.database.before.conditions.counts.scores ||
      atl029.publicApi.scopeReconciliation.excludedNonSovereignCalculations !==
        atl029.storedRelease.counts.calculations -
          atl029.publicApi.counts.calculations ||
      atl029.publicApi.scopeReconciliation.excludedNonSovereignComponents !==
        atl029.storedRelease.counts.components -
          atl029.publicApi.counts.components ||
      JSON.stringify([...atl029.publicApi.alignmentStates].sort()) !==
        JSON.stringify([...runtime.api.conditions.alignmentStates].sort()) ||
      atl029.publicApi.aggregateOrRankPublished ||
      atl029.readerSurfaces.browserEvidence !==
        atl016.browserEvidence.path ||
      !atl029.readerSurfaces.allThreeAlignmentStatesVisible ||
      atl029.readerSurfaces.horizontalOverflow ||
      atl029.readerSurfaces.consoleErrors !== 0 ||
      atl029.outcome.storedRowsMatchLiveValidator !== true ||
      atl029.outcome.publicCountsAreRowDerived !== true ||
      atl029.outcome.publicRowsMatchSovereignFilter !== true ||
      atl029.outcome.apiAndReaderSurfacesMatchSelectedRelease !== true ||
      atl029.outcome.universalCountryCountClaimPublished !== false ||
      atl029.outcome.economicCompositeOrRankPublished !== false
    ) {
      errors.push("QA-018: ATL-029 DB/API/reader reconciliation drifted");
    }

    if (
      atl030.schemaVersion !==
        "civica-atl-030-release-reproduction/v1" ||
      atl030.taskId !== "ATL-030" ||
      atl030.status !== "pass" ||
      atl030.candidateCommit !== staging.candidate.commit ||
      !sameRelease(atl030.release, attestedRelease)
    ) {
      errors.push("QA-018: ATL-030 release reproduction identity drifted");
    }
    if (
      !isSha256(atl030.capturedWorldBankInput.fileSha256) ||
      !isSha256(atl030.capturedWorldBankInput.capturePayloadSha256) ||
      atl030.capturedWorldBankInput.fileByteLength <= 0 ||
      atl030.capturedWorldBankInput.responses !== 717 ||
      atl030.capturedWorldBankInput.http200Responses !== 717 ||
      atl030.capturedWorldBankInput.requestCountryCodes !== 239 ||
      atl030.capturedWorldBankInput.indicators.length !== 3 ||
      !isSha256(atl030.expectationsArtifacts.preWriteArtifactSha256) ||
      !isSha256(
        atl030.expectationsArtifacts.postMigrationValidationArtifactSha256,
      ) ||
      Object.values(
        atl030.expectationsArtifacts.expectedCalculationCounts,
      ).reduce((sum, count) => sum + count, 0) !==
        runtime.database.before.conditions.counts.calculations
    ) {
      errors.push("QA-018: ATL-030 retained-input identity is incomplete");
    }
    if (
      atl030.liveValidation.status !== "pass" ||
      atl030.liveValidation.manifestReplaySha256 !==
        attestedRelease.manifestSha256 ||
      atl030.liveValidation.counts.calculations !==
        runtime.database.before.conditions.counts.calculations ||
      atl030.liveValidation.counts.components !==
        runtime.database.before.conditions.counts.components ||
      atl030.liveValidation.counts.scores !==
        runtime.database.before.conditions.counts.scores ||
      atl030.liveValidation.counts.retainedTablesWithTriggers !== 6 ||
      atl030.liveValidation.counts.mutationHistoryRows !== 0 ||
      atl030.liveValidation.replay.calculationKeysReplayed !==
        atl030.liveValidation.replay.calculationKeysMatched ||
      !atl030.liveValidation.replay.manifestMatched ||
      !atl030.liveValidation.replay.retainedTablesCovered ||
      !atl030.liveValidation.replay.mutationHistoryEmpty ||
      atl030.liveValidation.errors.length !== 0
    ) {
      errors.push("QA-018: ATL-030 live release validation drifted");
    }
    if (
      atl030.exactInputReplay.exitCode !== 0 ||
      atl030.exactInputReplay.insertedScores !== 0 ||
      atl030.exactInputReplay.insertedComponents !== 0 ||
      !atl030.exactInputReplay.releaseStateUnchanged ||
      !atl030.exactInputReplay.sourceFreshnessUnchanged ||
      !isSha256(atl030.alteredInputRefusal.alteredCaptureFileSha256) ||
      !isSha256(atl030.alteredInputRefusal.alteredCapturePayloadSha256) ||
      !isSha256(atl030.alteredInputRefusal.alteredManifestSha256) ||
      !isSha256(
        atl030.alteredInputRefusal.alteredExpectationsArtifactSha256,
      ) ||
      atl030.alteredInputRefusal.exitCode === 0 ||
      !atl030.alteredInputRefusal.releaseStateUnchanged ||
      !atl030.alteredInputRefusal.sourceFreshnessUnchanged ||
      !atl030.beforeAfterSnapshot.identical ||
      atl030.beforeAfterSnapshot.selectedReleaseCalculations !==
        runtime.database.before.conditions.counts.calculations ||
      atl030.beforeAfterSnapshot.selectedReleaseComponents !==
        runtime.database.before.conditions.counts.components ||
      atl030.beforeAfterSnapshot.selectedReleaseScores !==
        runtime.database.before.conditions.counts.scores ||
      atl030.publicReadReconciliation !== taskEvidencePaths.atl029 ||
      atl030.previewSmokeEvidence !== runtimePath ||
      atl030.rawCaptureCommitted ||
      atl030.productionDatabaseMutated
    ) {
      errors.push("QA-018: ATL-030 replay/refusal boundary drifted");
    }

    if (
      [atl016Raw, atl029Raw, atl030Raw].some((raw) =>
        /postgres(?:ql)?:\/\/|-----BEGIN [A-Z ]+PRIVATE KEY-----|x-vercel-protection-bypass\s*[:=]/i.test(
          raw,
        ),
      )
    ) {
      errors.push("QA-018: Conditions staging evidence contains a credential");
    }
  }
}
if (
  cliIsolation.schemaVersion !==
  "civica-qa018-vercel-cli-isolation-probe/v1"
) {
  errors.push("QA-018: unexpected Vercel CLI isolation-probe schema");
}
if (!/^[a-f0-9]{40}$/.test(cliIsolation.candidateCommit)) {
  errors.push("QA-018: isolation probe candidate commit is invalid");
}
if (
  cliIsolation.vercel.cliVersion !== "53.2.0" ||
  cliIsolation.vercel.manualDeploymentProvisioningAvailable !== false ||
  cliIsolation.vercel.integrationUpdateSupportsDeploymentConfiguration !==
    false ||
  cliIsolation.vercel.automaticPreviewBranchingObserved !== false
) {
  errors.push(
    "QA-018: recorded isolation probe must preserve the observed Vercel blockers",
  );
}
if (
  cliIsolation.accessBoundary.acceptedEvidenceSource !== "vercel_cli_only" ||
  cliIsolation.accessBoundary.neonBrowserSignInAttempted !== true ||
  cliIsolation.accessBoundary.neonBrowserAccessObtained !== false ||
  cliIsolation.accessBoundary.browserEvidenceUsed !== false ||
  cliIsolation.accessBoundary.futureRequiredPath !== "vercel_cli_only"
) {
  errors.push(
    "QA-018: access boundary must preserve the abandoned browser detour and CLI-only continuation",
  );
}
if (
  cliIsolation.vercel.deployments.length === 0 ||
  new Set(cliIsolation.vercel.deployments.map(({ id }) => id)).size !==
    cliIsolation.vercel.deployments.length ||
  cliIsolation.vercel.deployments.some(
    ({ id, status, purpose }) =>
      !/^dpl_[A-Za-z0-9]+$/.test(id) ||
      !["canceled", "error"].includes(status) ||
      !purpose.trim(),
  )
) {
  errors.push("QA-018: isolation-probe deployment evidence is invalid");
}
if (
  cliIsolation.configuredDatabase.migrationHeadBefore !==
    QA_018_DATABASE_HEAD ||
  cliIsolation.configuredDatabase.migrationHeadAfter !== QA_018_DATABASE_HEAD ||
  !/^br-[a-z0-9-]+$/.test(cliIsolation.configuredDatabase.branchId) ||
  !/^ep-[a-z0-9-]+$/.test(cliIsolation.configuredDatabase.endpointId) ||
  !/^[a-f0-9]{64}$/.test(cliIsolation.configuredDatabase.hostSha256)
) {
  errors.push(
    "QA-018: isolation probe does not bind the unchanged configured database head and target hashes",
  );
}
if (
  cliIsolation.probe.target !== "preview" ||
  cliIsolation.probe.result !== "blocked" ||
  cliIsolation.probe.reason !==
    "preview_resolved_to_forbidden_production_branch" ||
  cliIsolation.probe.databaseQueriesWereReadOnly !== true ||
  cliIsolation.probe.databaseWritesPerformed !== 0 ||
  cliIsolation.probe.migrationsApplied.length !== 0 ||
  cliIsolation.probe.conditionsRuns !== 0 ||
  !cliIsolation.vercel.deployments.some(
    ({ id, purpose }) =>
      id === cliIsolation.probe.deploymentId &&
      purpose === "read_only_database_isolation_probe",
  )
) {
  errors.push(
    "QA-018: isolation probe must remain a blocked, read-only Preview result",
  );
}
if (
  cliIsolation.blocker.id !== "vercel_neon_preview_branching_disabled" ||
  cliIsolation.blocker.authorityRequired !== true ||
  cliIsolation.blocker.productionPromotionAuthorized !== false
) {
  errors.push("QA-018: isolation probe does not preserve its authority boundary");
}
if (/postgres(?:ql)?:\/\/|-----BEGIN [A-Z ]+PRIVATE KEY-----/.test(cliIsolationRaw)) {
  errors.push("QA-018: isolation-probe evidence contains a credential");
}
const databaseHeadIndex = AUTHORITATIVE_MIGRATIONS.findIndex(
  ({ id }) => id === QA_018_DATABASE_HEAD,
);
const authoritativeTail =
  databaseHeadIndex < 0
    ? []
    : AUTHORITATIVE_MIGRATIONS.slice(databaseHeadIndex + 1).map(({ id }) => id);
const requiredMigrationIds = QA_018_REQUIRED_MIGRATIONS.map(({ id }) => id);
if (databaseHeadIndex < 0) {
  errors.push(
    `QA-018: configured database head ${QA_018_DATABASE_HEAD} is absent`,
  );
} else if (
  JSON.stringify(authoritativeTail) !== JSON.stringify(requiredMigrationIds)
) {
  errors.push(
    "QA-018: required migration plan is not the complete authoritative ledger tail",
  );
}

for (const path of [
  "data/DEPLOYMENT-REHEARSAL.md",
  "data/RELEASE-CANDIDATE-STAGING-SMOKE.md",
  "data/ROLLBACK-FORWARD-FIX-REHEARSAL.md",
  "plan/evidence/QA-018/README.md",
  cliIsolationPath,
  "plan/evidence/QA-019/README.md",
  "data/research/release-correction-authority-v1.json",
]) {
  if (!existsSync(path)) errors.push(`missing protocol/evidence path ${path}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `PASS — QA-018 ${staging.status}; QA-019 ${recovery.status}. Protocols are fail-closed; recorded evidence never implies owner sign-off.`,
);
