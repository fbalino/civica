import type { PulseEvaluationPacketFrame } from "./evaluation-packets";

export const PULSE_EVALUATION_WORKSPACE_RECONCILIATION_VERSION =
  "pulse-evaluation-workspace-reconciliation/v1" as const;
export const PULSE_EVALUATION_BATCH_B_WORKSPACE_RECONCILIATION_VERSION =
  "pulse-evaluation-workspace-reconciliation/v2" as const;

export const PULSE_EVALUATION_BATCH_A_FRAME =
  "retained_event_candidate_census" as const satisfies PulseEvaluationPacketFrame;
export const PULSE_EVALUATION_BATCH_B_FRAME =
  "system_negative_probability" as const satisfies PulseEvaluationPacketFrame;

/** The retained disabled study is historical evidence. Its packet-set hash is
 * intentionally not the rebuilt manifest hash and must never be reseeded. */
export const PULSE_EVALUATION_BATCH_A_LEGACY = {
  slug: "pulse-evaluation-batch-a-v1",
  id: "4cda0b69-259e-4d86-bc2a-0dc07ff65e0b",
  packetSetSha256:
    "0e1089d2de4032f442256cd57f842d54c6f92361e30a4d13ec902f5e38e57e36",
} as const;

export const PULSE_EVALUATION_BATCH_A_RECONCILED = {
  slug: "pulse-evaluation-batch-a-v2",
  datasetVersionSuffix: "workspace-reconciliation-v2",
  title: "Pulse evaluation batch A — reconciled frozen release",
  packetSetSha256:
    "100c44c3397474c3c0ef8a96879b2099aa5823e286f65806c9605e6a97285b46",
  supersessionReason: "frozen_packet_hash_mismatch",
} as const;

/** Batch B was seeded from the same earlier manifest as batch A. Preserve the
 * disabled study exactly and append a checked successor rather than reseeding. */
export const PULSE_EVALUATION_BATCH_B_LEGACY = {
  slug: "pulse-evaluation-batch-b-v1",
  id: "d3bfc4cb-39e1-4701-be25-ca03561aeb0b",
  packetSetSha256:
    "0bb9ae6b7af6b035d3ff1a06ce28f5b52b6b547267f65d3253a97862fb573bc5",
} as const;

export const PULSE_EVALUATION_BATCH_B_RECONCILED = {
  slug: "pulse-evaluation-batch-b-v2",
  datasetVersionSuffix: "workspace-reconciliation-v2",
  title: "Pulse evaluation batch B — reconciled frozen release",
  packetSetSha256:
    "1034dec1305a4c3955bd92dd1754f066a70da3f7a160b07b2c48d4e68b2bc96b",
  supersessionReason: "frozen_packet_hash_mismatch",
} as const;

export interface PulseEvaluationWorkspaceReconciliationPlan {
  legacyStudyId: string;
  successorStudyId: string;
  successorDatasetVersion: string;
}

export function pulseEvaluationWorkspaceReconciliationPlan(
  semanticSha256: string,
  schemaVersion: string,
  legacyStudyId: string,
  deterministicUuid: (value: string) => string,
  frame: PulseEvaluationPacketFrame = PULSE_EVALUATION_BATCH_A_FRAME,
  datasetVersionSuffix: string = PULSE_EVALUATION_BATCH_A_RECONCILED.datasetVersionSuffix,
): PulseEvaluationWorkspaceReconciliationPlan {
  const studyIdentity = `study|${semanticSha256}|${frame}`;
  return {
    legacyStudyId,
    successorStudyId: deterministicUuid(
      `${studyIdentity}|${legacyStudyId}|${datasetVersionSuffix}`,
    ),
    successorDatasetVersion:
      `${schemaVersion}:${frame}:` + datasetVersionSuffix,
  };
}
