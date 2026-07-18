import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PULSE_EVALUATION_BATCH_A_LEGACY,
  PULSE_EVALUATION_BATCH_A_RECONCILED,
  pulseEvaluationWorkspaceReconciliationPlan,
} from "./evaluation-workspace-reconciliation";

function deterministicUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
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
  assert.equal(PULSE_EVALUATION_BATCH_A_LEGACY.slug, "pulse-evaluation-batch-a-v1");
  assert.equal(PULSE_EVALUATION_BATCH_A_RECONCILED.slug, "pulse-evaluation-batch-a-v2");
  assert.equal(
    PULSE_EVALUATION_BATCH_A_RECONCILED.supersessionReason,
    "frozen_packet_hash_mismatch",
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
