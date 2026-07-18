import type { PulseEvaluationPacketFrame } from "./evaluation-packets";

export const PULSE_EVALUATION_WORKSPACE_RECONCILIATION_VERSION =
  "pulse-evaluation-workspace-reconciliation/v1" as const;

export const PULSE_EVALUATION_BATCH_A_FRAME =
  "retained_event_candidate_census" as const satisfies PulseEvaluationPacketFrame;

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
): PulseEvaluationWorkspaceReconciliationPlan {
  const studyIdentity = `study|${semanticSha256}|${PULSE_EVALUATION_BATCH_A_FRAME}`;
  return {
    legacyStudyId,
    successorStudyId: deterministicUuid(
      `${studyIdentity}|${legacyStudyId}|${PULSE_EVALUATION_BATCH_A_RECONCILED.datasetVersionSuffix}`,
    ),
    successorDatasetVersion:
      `${schemaVersion}:${PULSE_EVALUATION_BATCH_A_FRAME}:` +
      PULSE_EVALUATION_BATCH_A_RECONCILED.datasetVersionSuffix,
  };
}
