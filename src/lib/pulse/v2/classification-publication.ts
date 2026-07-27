import type { BatchItem } from "drizzle-orm/batch";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import {
  pulseClassificationAttempts,
  pulseClusterClassificationStates,
  pulseEventDecisions,
  pulseEventsV2,
  pulseSources,
  rawEvents,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { PulseDecisionInput } from "./decision-ledger";
import { preparePulseDecisionInsert } from "./decision-ledger-store";
import { PULSE_CLASSIFICATION_ATTEMPT_VERSION } from "./classification-state";
import {
  classificationAttemptKey,
  type ClaimedClassificationAttempt,
} from "./classification-state-store";

type Db = NeonHttpDatabase<typeof schema>;

export interface ClassificationSourceAttribution {
  sourceId: string;
  sourceType: string;
  sourceName: string;
  sourceUrl: string | null;
  rawEventId: string;
}

export interface ClassificationDispositionPlan {
  clusterId: string;
  rawEventIds: string[];
  disposition: "event" | "non_governance";
  reason: string;
  decision: unknown;
  classificationRunId: string;
  completedAt: string;
}

export interface ClassificationSettlementPlan {
  claim: ClaimedClassificationAttempt;
  outcome: "classified" | "none";
  modelCallCount: number;
}

export interface ClassifiedClusterPublicationPlan {
  event: typeof pulseEventsV2.$inferInsert & { id: string };
  decisions: PulseDecisionInput[];
  attributions: ClassificationSourceAttribution[];
  disposition: ClassificationDispositionPlan & { disposition: "event" };
  settlement?: ClassificationSettlementPlan & { outcome: "classified" };
}

export interface NonGovernanceClusterPublicationPlan {
  clusterId: string;
  decisions: PulseDecisionInput[];
  disposition: ClassificationDispositionPlan & {
    disposition: "non_governance";
  };
  settlement?: ClassificationSettlementPlan & { outcome: "none" };
}

function nonBlank(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name} is required`);
}

function assertUnique(values: readonly string[], name: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${name} must be unique inside one classification publish`);
  }
}

function validateDisposition(plan: ClassificationDispositionPlan): void {
  nonBlank(plan.clusterId, "disposition.clusterId");
  nonBlank(plan.classificationRunId, "disposition.classificationRunId");
  nonBlank(plan.reason, "disposition.reason");
  if (!Number.isFinite(Date.parse(plan.completedAt))) {
    throw new Error("disposition.completedAt is invalid");
  }
  if (plan.rawEventIds.length === 0) {
    throw new Error("classification publish requires at least one raw event");
  }
  plan.rawEventIds.forEach((id, index) =>
    nonBlank(id, `disposition.rawEventIds[${index}]`),
  );
  assertUnique(plan.rawEventIds, "raw event ids");
}

function validateSettlement(
  clusterId: string,
  settlement: ClassificationSettlementPlan | undefined,
): void {
  if (!settlement) return;
  if (settlement.claim.clusterId !== clusterId) {
    throw new Error(
      "classification settlement claim belongs to another cluster",
    );
  }
  if (
    !Number.isSafeInteger(settlement.modelCallCount) ||
    settlement.modelCallCount < 0
  ) {
    throw new Error("classification settlement modelCallCount is invalid");
  }
}

function validateDecisions(
  clusterId: string,
  eventId: string | null,
  decisions: readonly PulseDecisionInput[],
): void {
  if (decisions.length === 0) {
    throw new Error("classification publish requires decision evidence");
  }
  for (const decision of decisions) {
    if (decision.clusterId !== clusterId || decision.eventId !== eventId) {
      throw new Error(
        "classification decision targets another cluster or event",
      );
    }
  }
}

function countGuard(expected: number, expression: () => SQL): SQL {
  return expected === 0 ? sql`true` : expression();
}

function decisionGuard(
  records: ReturnType<typeof preparePulseDecisionInsert>["records"],
  clusterId: string,
  eventId: string | null,
): SQL {
  const decisionKeys = records.map(({ decisionKey }) => decisionKey);
  return countGuard(
    decisionKeys.length,
    () => sql`(
    select count(*)::integer
    from ${pulseEventDecisions}
    where ${inArray(pulseEventDecisions.decisionKey, decisionKeys)}
      and ${pulseEventDecisions.clusterId} = ${clusterId}::uuid
      and ${
        eventId === null
          ? sql`${pulseEventDecisions.eventId} is null`
          : sql`${pulseEventDecisions.eventId} = ${eventId}::uuid`
      }
  ) = ${decisionKeys.length}`,
  );
}

function settlementOperations(
  db: Db,
  clusterId: string,
  eventId: string | null,
  settlement: ClassificationSettlementPlan | undefined,
  completedAt: Date,
): { operations: BatchItem<"pg">[]; guard: SQL } {
  if (!settlement) return { operations: [], guard: sql`true` };
  const { claim, outcome, modelCallCount } = settlement;
  const attemptKey = classificationAttemptKey(claim, outcome);
  const status = outcome;
  const operations: BatchItem<"pg">[] = [
    db
      .update(pulseClusterClassificationStates)
      .set({
        status,
        nextRetryAt: null,
        terminalAt: completedAt,
        leaseExpiresAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        eventId,
        updatedAt: completedAt,
      })
      .where(
        and(
          eq(pulseClusterClassificationStates.clusterId, claim.clusterId),
          eq(pulseClusterClassificationStates.configHash, claim.configHash),
          eq(pulseClusterClassificationStates.attemptCount, claim.ordinal),
          eq(pulseClusterClassificationStates.lastRunId, claim.runId),
          eq(pulseClusterClassificationStates.status, "retryable_failure"),
        ),
      ),
    db
      .insert(pulseClassificationAttempts)
      .values({
        schemaVersion: PULSE_CLASSIFICATION_ATTEMPT_VERSION,
        attemptKey,
        clusterId: claim.clusterId,
        incidentId: claim.incidentId,
        configHash: claim.configHash,
        ordinal: claim.ordinal,
        runId: claim.runId,
        outcome: status,
        modelCallCount,
        startedAt: claim.startedAt,
        completedAt,
        nextRetryAt: null,
        errorCode: null,
        errorMessage: null,
        metadata: {},
        createdAt: completedAt,
      })
      .onConflictDoNothing({ target: pulseClassificationAttempts.attemptKey }),
  ];
  const eventGuard =
    eventId === null
      ? sql`${pulseClusterClassificationStates.eventId} is null`
      : sql`${pulseClusterClassificationStates.eventId} = ${eventId}::uuid`;
  const guard = sql`exists (
    select 1
    from ${pulseClusterClassificationStates}
    where ${pulseClusterClassificationStates.clusterId} = ${clusterId}::uuid
      and ${pulseClusterClassificationStates.configHash} = ${claim.configHash}
      and ${pulseClusterClassificationStates.attemptCount} = ${claim.ordinal}
      and ${pulseClusterClassificationStates.lastRunId} = ${claim.runId}::uuid
      and ${pulseClusterClassificationStates.status} = ${status}
      and ${pulseClusterClassificationStates.nextRetryAt} is null
      and ${pulseClusterClassificationStates.terminalAt} is not null
      and ${pulseClusterClassificationStates.leaseExpiresAt} is null
      and ${pulseClusterClassificationStates.lastErrorCode} is null
      and ${pulseClusterClassificationStates.lastErrorMessage} is null
      and ${eventGuard}
  ) and exists (
    select 1
    from ${pulseClassificationAttempts}
    where ${pulseClassificationAttempts.attemptKey} = ${attemptKey}
      and ${pulseClassificationAttempts.clusterId} = ${clusterId}::uuid
      and ${pulseClassificationAttempts.configHash} = ${claim.configHash}
      and ${pulseClassificationAttempts.ordinal} = ${claim.ordinal}
      and ${pulseClassificationAttempts.runId} = ${claim.runId}::uuid
      and ${pulseClassificationAttempts.outcome} = ${status}
      and ${pulseClassificationAttempts.modelCallCount} = ${modelCallCount}
      and ${pulseClassificationAttempts.completedAt} is not null
  )`;
  return { operations, guard };
}

async function executeAtomicPublish(
  db: Db,
  operations: BatchItem<"pg">[],
  guard: SQL,
): Promise<void> {
  operations.push(
    db
      .select({
        atomicClassificationPublishGuard: sql<number>`1 / (case when ${guard} then 1 else 0 end)`,
      })
      .from(sql`(select 1) as atomic_classification_guard_source`),
  );
  const [first, ...rest] = operations;
  await db.batch([first, ...rest] as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
}

/**
 * Publish the event projection, decision ledger, source trail, retained raw
 * disposition, and optional terminal claim in one database transaction.
 */
export async function publishClassifiedCluster(
  db: Db,
  plan: ClassifiedClusterPublicationPlan,
): Promise<string> {
  validateDisposition(plan.disposition);
  const eventId = plan.event.id;
  const clusterId = plan.disposition.clusterId;
  if (plan.event.clusterId !== clusterId) {
    throw new Error("classification event belongs to another cluster");
  }
  validateDecisions(clusterId, eventId, plan.decisions);
  validateSettlement(clusterId, plan.settlement);
  if (plan.settlement && plan.settlement.outcome !== "classified") {
    throw new Error("event publication requires a classified settlement");
  }
  if (plan.attributions.length !== plan.disposition.rawEventIds.length) {
    throw new Error("classification source attribution is incomplete");
  }
  const attributionRawIds = plan.attributions.map(
    ({ rawEventId }) => rawEventId,
  );
  assertUnique(attributionRawIds, "source attribution raw event ids");
  if (
    [...attributionRawIds].sort().join("\n") !==
    [...plan.disposition.rawEventIds].sort().join("\n")
  ) {
    throw new Error("classification sources do not match retained raw events");
  }

  const completedAt = new Date(plan.disposition.completedAt);
  const eventValues = {
    ...plan.event,
    projectionStatus: plan.event.projectionStatus ?? ("current" as const),
  };
  const mutableEventValues = {
    incidentId: eventValues.incidentId,
    projectionStatus: eventValues.projectionStatus,
    jurisdictionId: eventValues.jurisdictionId,
    eventDate: eventValues.eventDate,
    category: eventValues.category,
    dimension: eventValues.dimension,
    severityTier: eventValues.severityTier,
    severityValue: eventValues.severityValue,
    corroborationConfidence: eventValues.corroborationConfidence,
    classifierRuns: eventValues.classifierRuns,
    classifierAgreement: eventValues.classifierAgreement,
    derivationVersionKey: eventValues.derivationVersionKey,
    derivationVersions: eventValues.derivationVersions,
    classificationRunId: eventValues.classificationRunId,
    publicationRunId: eventValues.publicationRunId,
    corroborationRunId: eventValues.corroborationRunId,
    humanReviewed: eventValues.humanReviewed,
    reviewerId: eventValues.reviewerId,
    reviewNotes: eventValues.reviewNotes,
    reviewStatus: eventValues.reviewStatus,
    published: eventValues.published,
    headline: eventValues.headline,
    description: eventValues.description,
    aiSummary: eventValues.aiSummary,
    pressFreedomScoreAtClassification:
      eventValues.pressFreedomScoreAtClassification,
    updatedAt: completedAt,
  };
  const { records, query: decisionInsert } = preparePulseDecisionInsert(
    db,
    plan.decisions,
  );
  if (!decisionInsert) throw new Error("classification decisions are missing");
  assertUnique(
    records.map(({ decisionKey }) => decisionKey),
    "classification decision keys",
  );

  const operations: BatchItem<"pg">[] = [
    db
      .insert(pulseEventsV2)
      .values(eventValues)
      .onConflictDoUpdate({
        target: pulseEventsV2.clusterId,
        set: mutableEventValues,
        setWhere: sql`exists (
          select 1 from ${rawEvents}
          where ${rawEvents.clusterId} = ${clusterId}::uuid
            and ${inArray(rawEvents.id, plan.disposition.rawEventIds)}
            and ${rawEvents.classificationDisposition} = 'pending'
        )`,
      }),
    decisionInsert,
    db
      .insert(pulseSources)
      .values(
        plan.attributions.map((attribution) => ({
          eventId,
          ...attribution,
        })),
      )
      .onConflictDoNothing(),
    db
      .update(rawEvents)
      .set({
        classificationDisposition: "event",
        classificationReason: plan.disposition.reason,
        classificationDecision: plan.disposition.decision,
        classifiedAt: completedAt,
        classificationRunId: plan.disposition.classificationRunId,
      })
      .where(
        and(
          eq(rawEvents.clusterId, clusterId),
          inArray(rawEvents.id, plan.disposition.rawEventIds),
          eq(rawEvents.classificationDisposition, "pending"),
        ),
      ),
  ];
  const settlement = settlementOperations(
    db,
    clusterId,
    eventId,
    plan.settlement,
    completedAt,
  );
  operations.push(...settlement.operations);

  const eventGuard = sql`exists (
    select 1 from ${pulseEventsV2}
    where ${pulseEventsV2.id} = ${eventId}::uuid
      and ${pulseEventsV2.clusterId} = ${clusterId}::uuid
      and ${pulseEventsV2.incidentId} = ${eventValues.incidentId}::uuid
      and ${pulseEventsV2.classificationRunId} = ${plan.disposition.classificationRunId}::uuid
      and ${pulseEventsV2.projectionStatus} = 'current'
  )`;
  const sourceGuard = sql`(
    select count(*)::integer
    from ${pulseSources}
    where ${pulseSources.eventId} = ${eventId}::uuid
      and ${inArray(pulseSources.rawEventId, attributionRawIds)}
  ) = ${attributionRawIds.length}`;
  const rawGuard = sql`(
    select count(*)::integer
    from ${rawEvents}
    where ${rawEvents.clusterId} = ${clusterId}::uuid
      and ${inArray(rawEvents.id, plan.disposition.rawEventIds)}
      and ${rawEvents.classificationDisposition} = 'event'
      and ${rawEvents.classificationRunId} = ${plan.disposition.classificationRunId}::uuid
      and ${rawEvents.classificationDecision} = ${JSON.stringify(plan.disposition.decision)}::jsonb
      and ${rawEvents.classifiedAt} is not null
  ) = ${plan.disposition.rawEventIds.length}`;
  await executeAtomicPublish(
    db,
    operations,
    sql`${eventGuard}
      and ${decisionGuard(records, clusterId, eventId)}
      and ${sourceGuard}
      and ${rawGuard}
      and ${settlement.guard}`,
  );
  return eventId;
}

/** Publish non-governance evidence before retiring the raw cluster. */
export async function publishNonGovernanceCluster(
  db: Db,
  plan: NonGovernanceClusterPublicationPlan,
): Promise<void> {
  validateDisposition(plan.disposition);
  if (plan.clusterId !== plan.disposition.clusterId) {
    throw new Error("non-governance publication targets another cluster");
  }
  validateDecisions(plan.clusterId, null, plan.decisions);
  validateSettlement(plan.clusterId, plan.settlement);
  if (plan.settlement && plan.settlement.outcome !== "none") {
    throw new Error("non-governance publication requires a none settlement");
  }
  const completedAt = new Date(plan.disposition.completedAt);
  const { records, query: decisionInsert } = preparePulseDecisionInsert(
    db,
    plan.decisions,
  );
  if (!decisionInsert) throw new Error("non-governance decision is missing");
  assertUnique(
    records.map(({ decisionKey }) => decisionKey),
    "classification decision keys",
  );
  const operations: BatchItem<"pg">[] = [
    decisionInsert,
    db
      .update(rawEvents)
      .set({
        classificationDisposition: "non_governance",
        classificationReason: plan.disposition.reason,
        classificationDecision: plan.disposition.decision,
        classifiedAt: completedAt,
        classificationRunId: plan.disposition.classificationRunId,
      })
      .where(
        and(
          eq(rawEvents.clusterId, plan.clusterId),
          inArray(rawEvents.id, plan.disposition.rawEventIds),
          eq(rawEvents.classificationDisposition, "pending"),
        ),
      ),
  ];
  const settlement = settlementOperations(
    db,
    plan.clusterId,
    null,
    plan.settlement,
    completedAt,
  );
  operations.push(...settlement.operations);
  const rawGuard = sql`(
    select count(*)::integer
    from ${rawEvents}
    where ${rawEvents.clusterId} = ${plan.clusterId}::uuid
      and ${inArray(rawEvents.id, plan.disposition.rawEventIds)}
      and ${rawEvents.classificationDisposition} = 'non_governance'
      and ${rawEvents.classificationRunId} = ${plan.disposition.classificationRunId}::uuid
      and ${rawEvents.classificationDecision} = ${JSON.stringify(plan.disposition.decision)}::jsonb
      and ${rawEvents.classifiedAt} is not null
  ) = ${plan.disposition.rawEventIds.length}`;
  await executeAtomicPublish(
    db,
    operations,
    sql`${decisionGuard(records, plan.clusterId, null)}
      and ${rawGuard}
      and ${settlement.guard}`,
  );
}
