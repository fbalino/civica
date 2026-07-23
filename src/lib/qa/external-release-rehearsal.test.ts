import assert from "node:assert/strict";
import test from "node:test";

import stagingRecord from "../../../data/release-candidate-staging-smoke.v1.json";
import recoveryRecord from "../../../data/rollback-forward-fix-rehearsal.v1.json";
import {
  recoveryRehearsalErrors,
  stagingSmokeErrors,
  type RecoveryRehearsalRecord,
  type StagingSmokeRecord,
} from "./external-release-rehearsal";

const clone = <T>(value: T): T => structuredClone(value);

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
