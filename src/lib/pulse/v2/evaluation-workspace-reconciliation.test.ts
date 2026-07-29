import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PULSE_EVALUATION_BATCH_A_LEGACY,
  PULSE_EVALUATION_BATCH_A_RECONCILED,
  PULSE_EVALUATION_BATCH_B_FRAME,
  PULSE_EVALUATION_BATCH_B_LEGACY,
  PULSE_EVALUATION_BATCH_B_RECONCILED,
  PULSE_EVALUATION_BATCH_B_WORKSPACE_RECONCILIATION_VERSION,
  pulseEvaluationWorkspaceReconciliationPlan,
} from "./evaluation-workspace-reconciliation";

function deterministicUuid(value: string): string {
  const hex = createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

test("PUL-043 derives an append-only successor identity", () => {
  const plan = pulseEvaluationWorkspaceReconciliationPlan(
    "a".repeat(64),
    "pulse-evaluation-packet-manifest/v1",
    PULSE_EVALUATION_BATCH_A_LEGACY.id,
    deterministicUuid,
  );
  assert.notEqual(plan.legacyStudyId, plan.successorStudyId);
  assert.equal(
    plan.successorDatasetVersion,
    "pulse-evaluation-packet-manifest/v1:retained_event_candidate_census:workspace-reconciliation-v2",
  );
  assert.equal(
    PULSE_EVALUATION_BATCH_A_LEGACY.slug,
    "pulse-evaluation-batch-a-v1",
  );
  assert.equal(
    PULSE_EVALUATION_BATCH_A_RECONCILED.slug,
    "pulse-evaluation-batch-a-v2",
  );
  assert.equal(
    PULSE_EVALUATION_BATCH_A_RECONCILED.supersessionReason,
    "frozen_packet_hash_mismatch",
  );
});

test("PUL-043 derives the exact append-only batch B successor identity", () => {
  const plan = pulseEvaluationWorkspaceReconciliationPlan(
    "b683175e07caca1572d86f26b69cdcb17b72023f27b3bee578a960fa46c109bf",
    "pulse-evaluation-packet-manifest/v1",
    PULSE_EVALUATION_BATCH_B_LEGACY.id,
    deterministicUuid,
    PULSE_EVALUATION_BATCH_B_FRAME,
    PULSE_EVALUATION_BATCH_B_RECONCILED.datasetVersionSuffix,
  );
  assert.equal(
    PULSE_EVALUATION_BATCH_B_LEGACY.packetSetSha256,
    "0bb9ae6b7af6b035d3ff1a06ce28f5b52b6b547267f65d3253a97862fb573bc5",
  );
  assert.equal(plan.successorStudyId, "f4e23e4c-da2b-4d74-9919-d98b8984635e");
  assert.equal(
    PULSE_EVALUATION_BATCH_B_RECONCILED.packetSetSha256,
    "1034dec1305a4c3955bd92dd1754f066a70da3f7a160b07b2c48d4e68b2bc96b",
  );
  assert.equal(
    plan.successorDatasetVersion,
    "pulse-evaluation-packet-manifest/v1:system_negative_probability:workspace-reconciliation-v2",
  );
  assert.equal(
    PULSE_EVALUATION_BATCH_B_LEGACY.slug,
    "pulse-evaluation-batch-b-v1",
  );
  assert.equal(
    PULSE_EVALUATION_BATCH_B_RECONCILED.slug,
    "pulse-evaluation-batch-b-v2",
  );
  assert.equal(
    PULSE_EVALUATION_BATCH_B_WORKSPACE_RECONCILIATION_VERSION,
    "pulse-evaluation-workspace-reconciliation/v2",
  );
});

test("PUL-043 reconciliation script cannot rewrite the legacy workspace", () => {
  const source = readFileSync(
    "scripts/reconcile-pulse-evaluation-coding-workspace.ts",
    "utf8",
  );
  assert.match(source, /\.insert\(pulseCodingStudies\)/);
  assert.match(source, /\.insert\(pulseCodingPackets\)/);
  assert.doesNotMatch(source, /\.update\(/);
  assert.doesNotMatch(source, /\.delete\(/);
});
