import { createHash } from "node:crypto";

import type { PulseDecisionActor } from "./decision-ledger";

export const PULSE_CANDIDATE_OUTCOME_VERSION =
  "pulse-candidate-outcome/v1" as const;

export const PULSE_CANDIDATE_OUTCOMES = [
  "duplicate",
  "non_event",
  "insufficient_evidence",
  "invalid",
  "refuted",
  "rejected",
] as const;
export type PulseCandidateOutcome = (typeof PULSE_CANDIDATE_OUTCOMES)[number];

export const PULSE_CANDIDATE_KINDS = [
  "raw_item",
  "cluster",
  "event",
  "decision",
] as const;
export type PulseCandidateKind = (typeof PULSE_CANDIDATE_KINDS)[number];

export interface PulseCandidateOutcomeInput {
  candidateKind: PulseCandidateKind;
  candidateId: string;
  outcome: PulseCandidateOutcome;
  reasonCode: string;
  reason: string;
  actor: PulseDecisionActor;
  methodVersion: string;
  stageRunId: string;
  decisionKey?: string | null;
  canonicalCandidateId?: string | null;
  evidenceRefs: string[];
  metadata?: Record<string, unknown>;
  occurredAt: string;
  nonce?: string;
}

export interface PulseCandidateOutcomeRecord extends PulseCandidateOutcomeInput {
  schemaVersion: typeof PULSE_CANDIDATE_OUTCOME_VERSION;
  outcomeKey: string;
  decisionKey: string | null;
  canonicalCandidateId: string | null;
  metadata: Record<string, unknown>;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function createPulseCandidateOutcome(
  input: PulseCandidateOutcomeInput,
): PulseCandidateOutcomeRecord {
  for (const [name, value] of [
    ["candidateId", input.candidateId],
    ["reasonCode", input.reasonCode],
    ["reason", input.reason],
    ["methodVersion", input.methodVersion],
    ["stageRunId", input.stageRunId],
    ["occurredAt", input.occurredAt],
  ] as const) {
    if (!value.trim()) throw new Error(`${name} is required`);
  }
  if (input.evidenceRefs.length === 0) {
    throw new Error("candidate outcome requires at least one evidence reference");
  }
  const normalized = {
    ...input,
    decisionKey: input.decisionKey ?? null,
    canonicalCandidateId: input.canonicalCandidateId ?? null,
    evidenceRefs: [...new Set(input.evidenceRefs.map((value) => value.trim()).filter(Boolean))].sort(),
    metadata: canonical(input.metadata ?? {}) as Record<string, unknown>,
  };
  const digest = createHash("sha256")
    .update(JSON.stringify(canonical(normalized)))
    .digest("hex");
  return {
    ...normalized,
    schemaVersion: PULSE_CANDIDATE_OUTCOME_VERSION,
    outcomeKey: `pulse-candidate-outcome/sha256:${digest}`,
  };
}
