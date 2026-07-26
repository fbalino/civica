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
const errors = [
  ...stagingSmokeErrors(staging).map((error) => `QA-018: ${error}`),
  ...recoveryRehearsalErrors(recovery).map((error) => `QA-019: ${error}`),
];
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
