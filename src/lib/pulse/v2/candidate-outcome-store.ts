import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import { pulseCandidateOutcomes } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import {
  createPulseCandidateOutcome,
  type PulseCandidateOutcomeInput,
  type PulseCandidateOutcomeRecord,
} from "./candidate-outcome";

type Db = NeonHttpDatabase<typeof schema>;

export async function persistPulseCandidateOutcomes(
  db: Db,
  inputs: readonly PulseCandidateOutcomeInput[],
): Promise<PulseCandidateOutcomeRecord[]> {
  if (inputs.length === 0) return [];
  const records = inputs.map(createPulseCandidateOutcome);
  await db
    .insert(pulseCandidateOutcomes)
    .values(
      records.map((record) => ({
        schemaVersion: record.schemaVersion,
        outcomeKey: record.outcomeKey,
        candidateKind: record.candidateKind,
        candidateId: record.candidateId,
        outcome: record.outcome,
        reasonCode: record.reasonCode,
        reason: record.reason,
        actor: record.actor,
        methodVersion: record.methodVersion,
        stageRunId: record.stageRunId,
        decisionKey: record.decisionKey,
        canonicalCandidateId: record.canonicalCandidateId,
        evidenceRefs: record.evidenceRefs,
        metadata: record.metadata,
        occurredAt: new Date(record.occurredAt),
      })),
    )
    .onConflictDoNothing({ target: pulseCandidateOutcomes.outcomeKey });
  return records;
}
