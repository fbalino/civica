import { existsSync, readFileSync } from "node:fs";

import {
  recoveryRehearsalErrors,
  stagingSmokeErrors,
  type RecoveryRehearsalRecord,
  type StagingSmokeRecord,
} from "../src/lib/qa/external-release-rehearsal";
import { STAGED_MIGRATION_IDS } from "../src/lib/platform/deployment-rehearsal";

const readJson = <T>(path: string) =>
  JSON.parse(readFileSync(path, "utf8")) as T;

const staging = readJson<StagingSmokeRecord>(
  "data/release-candidate-staging-smoke.v1.json",
);
const recovery = readJson<RecoveryRehearsalRecord>(
  "data/rollback-forward-fix-rehearsal.v1.json",
);
const errors = [
  ...stagingSmokeErrors(staging).map((error) => `QA-018: ${error}`),
  ...recoveryRehearsalErrors(recovery).map((error) => `QA-019: ${error}`),
];
if (
  JSON.stringify(staging.candidate.migrationIds) !==
  JSON.stringify(STAGED_MIGRATION_IDS)
) {
  errors.push("QA-018: planned migrations drift from the deployment rehearsal");
}

for (const path of [
  "data/DEPLOYMENT-REHEARSAL.md",
  "data/RELEASE-CANDIDATE-STAGING-SMOKE.md",
  "data/ROLLBACK-FORWARD-FIX-REHEARSAL.md",
  "plan/evidence/QA-018/README.md",
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
  `PASS — QA-018 ${staging.status}; QA-019 ${recovery.status}. Protocols are fail-closed and no external run is claimed.`,
);
