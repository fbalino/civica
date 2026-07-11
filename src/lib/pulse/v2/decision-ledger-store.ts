import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import { pulseEventDecisions } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import {
  createPulseDecision,
  type PulseDecisionInput,
  type PulseDecisionKind,
  type PulseDecisionRecord,
} from "./decision-ledger";

type Db = NeonHttpDatabase<typeof schema>;

export async function persistPulseDecisions(
  db: Db,
  inputs: readonly PulseDecisionInput[],
): Promise<PulseDecisionRecord[]> {
  if (inputs.length === 0) return [];
  const records = inputs.map((input) => createPulseDecision(input));
  await db
    .insert(pulseEventDecisions)
    .values(
      records.map((record) => ({
        schemaVersion: record.schemaVersion,
        decisionKey: record.decisionKey,
        clusterId: record.clusterId,
        eventId: record.eventId,
        kind: record.kind,
        verdict: record.verdict,
        payload: record.payload,
        actor: record.actor,
        stageRunId: record.stageRunId,
        methodVersion: record.methodVersion,
        rationale: record.rationale,
        evidenceRefs: record.evidenceRefs,
        supersedesDecisionKey: record.supersedesDecisionKey,
        decidedAt: new Date(record.decidedAt),
      })),
    )
    .onConflictDoNothing({ target: pulseEventDecisions.decisionKey });
  return records;
}

/** Latest recorded decision key per requested axis. A later review may
 * supersede one axis without implying that any other decision changed. */
export async function latestPulseDecisionKeys(
  db: Db,
  eventId: string,
  kinds: readonly PulseDecisionKind[],
): Promise<Partial<Record<PulseDecisionKind, string>>> {
  if (kinds.length === 0) return {};
  const rows = await db
    .select({
      kind: pulseEventDecisions.kind,
      decisionKey: pulseEventDecisions.decisionKey,
    })
    .from(pulseEventDecisions)
    .where(
      and(
        eq(pulseEventDecisions.eventId, eventId),
        inArray(pulseEventDecisions.kind, [...kinds]),
        sql`${pulseEventDecisions.actor}->>'type' <> 'verifier'`,
      ),
    )
    .orderBy(
      desc(pulseEventDecisions.decidedAt),
      desc(pulseEventDecisions.createdAt),
    );

  const latest: Partial<Record<PulseDecisionKind, string>> = {};
  for (const row of rows) latest[row.kind] ??= row.decisionKey;
  return latest;
}
