import { existsSync, readFileSync } from "node:fs";

import {
  QA_018_DATABASE_HEAD,
  QA_018_REQUIRED_MIGRATIONS,
  recoveryRehearsalErrors,
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
const cliIsolationRaw = readFileSync(cliIsolationPath, "utf8");
const cliIsolation = JSON.parse(cliIsolationRaw) as CliIsolationProbe;
const errors = [
  ...stagingSmokeErrors(staging).map((error) => `QA-018: ${error}`),
  ...recoveryRehearsalErrors(recovery).map((error) => `QA-019: ${error}`),
];
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
