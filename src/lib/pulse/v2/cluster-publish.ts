import type { BatchItem } from "drizzle-orm/batch";
import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import {
  pulseEventsV2,
  pulseIncidentAssignments,
  pulseIncidentResolutions,
  pulseIncidents,
  pulsePipelineRuns,
  pulseSources,
  rawEvents,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { normalizeEventIdentity } from "./event-identity";
import {
  PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION,
  validateAttachIncidentEvidencePlan,
  validateIncidentAssignmentPlan,
  validateIncidentResolutionRecordPlan,
  validateNewIncidentPlan,
  type AttachIncidentEvidencePlan,
  type IncidentAssignmentPlan,
  type IncidentResolutionRecordPlan,
  type NewIncidentPlan,
} from "./incident-store";

type Db = NeonHttpDatabase<typeof schema>;

export interface SemanticClusterIncidentPlan extends NewIncidentPlan {
  id: string;
}

export interface SemanticClusterAssignmentPlan {
  assignment: IncidentAssignmentPlan;
  embedding: number[];
}

export interface SemanticClusterCompletionPlan {
  runId: string;
  counts: Record<string, number>;
  completedAt: string;
}

export interface SemanticClusterPublishPlan {
  runId: string;
  incidents: SemanticClusterIncidentPlan[];
  assignments: SemanticClusterAssignmentPlan[];
  evidence: AttachIncidentEvidencePlan[];
  resolutions: IncidentResolutionRecordPlan[];
  /** Fixture publishers may omit completion when their run row is not durable. */
  completion: SemanticClusterCompletionPlan | null;
}

export type SemanticClusterPublisher = (
  db: Db,
  plan: SemanticClusterPublishPlan,
) => Promise<void>;

function nonBlank(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name} is required`);
}

function assertUnique(values: readonly string[], name: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(
      `${name} must be unique inside one semantic cluster publish`,
    );
  }
}

function validatePublishPlan(plan: SemanticClusterPublishPlan): void {
  nonBlank(plan.runId, "runId");
  assertUnique(
    plan.incidents.map(({ id }) => id),
    "incident ids",
  );
  assertUnique(
    plan.assignments.map(({ assignment }) => assignment.rawEventId),
    "assignment raw event ids",
  );
  assertUnique(
    plan.assignments.map(({ assignment }) => assignment.assignmentKey),
    "assignment keys",
  );
  assertUnique(
    plan.evidence.map(({ rawEventId }) => rawEventId),
    "evidence raw event ids",
  );
  assertUnique(
    plan.resolutions.map(({ resolutionKey }) => resolutionKey),
    "resolution keys",
  );

  const assignmentRawIds = new Set(
    plan.assignments.map(({ assignment }) => assignment.rawEventId),
  );
  for (const incident of plan.incidents) {
    nonBlank(incident.id, "incident.id");
    validateNewIncidentPlan(incident);
    if (incident.createdRunId !== plan.runId) {
      throw new Error("new incident must belong to the semantic cluster run");
    }
  }
  for (const projection of plan.assignments) {
    validateIncidentAssignmentPlan(projection.assignment);
    if (projection.assignment.stageRunId !== plan.runId) {
      throw new Error("assignment must belong to the semantic cluster run");
    }
    if (
      projection.embedding.length === 0 ||
      projection.embedding.some((component) => !Number.isFinite(component))
    ) {
      throw new Error(
        "semantic cluster assignment requires a finite embedding",
      );
    }
  }
  for (const evidence of plan.evidence) {
    validateAttachIncidentEvidencePlan(evidence);
    if (evidence.stageRunId !== plan.runId) {
      throw new Error(
        "attached evidence must belong to the semantic cluster run",
      );
    }
    if (!assignmentRawIds.has(evidence.rawEventId)) {
      throw new Error(
        "attached evidence requires an assignment in the same publish",
      );
    }
  }
  for (const resolution of plan.resolutions) {
    validateIncidentResolutionRecordPlan(resolution);
    if (resolution.stageRunId !== plan.runId) {
      throw new Error("resolution must belong to the semantic cluster run");
    }
  }
  if (plan.completion) {
    nonBlank(plan.completion.runId, "completion.runId");
    if (plan.completion.runId !== plan.runId) {
      throw new Error("completion must belong to the semantic cluster run");
    }
    if (!Number.isFinite(Date.parse(plan.completion.completedAt))) {
      throw new Error("completion.completedAt is invalid");
    }
    if (plan.completion.counts.clustered !== plan.assignments.length) {
      throw new Error("completion clustered count does not match assignments");
    }
    if (plan.completion.counts.clustersCreated !== plan.incidents.length) {
      throw new Error(
        "completion clustersCreated count does not match incidents",
      );
    }
  }
}

function countGuard(expected: number, expression: () => SQL): SQL {
  return expected === 0 ? sql`true` : expression();
}

/**
 * Publish the complete semantic clustering plan in one Neon HTTP transaction.
 * Drizzle's Neon `batch` maps to `neon.transaction`, so any late constraint or
 * guard failure rolls incidents, assignments, raw projections, evidence,
 * collision records, and successful run completion back together.
 */
export const publishSemanticClusterPlan: SemanticClusterPublisher = async (
  db,
  plan,
) => {
  validatePublishPlan(plan);
  const operations: BatchItem<"pg">[] = [];

  if (plan.incidents.length > 0) {
    operations.push(
      db.insert(pulseIncidents).values(
        plan.incidents.map((incident) => {
          const identity = normalizeEventIdentity(
            incident.representativeTitle,
            incident.body,
          );
          return {
            id: incident.id,
            status: "active" as const,
            mergedIntoIncidentId: null,
            representativeTitle: incident.representativeTitle.trim(),
            eventDateStart: incident.eventDateStart,
            eventDateEnd: incident.eventDateEnd,
            identityVersion: identity.version,
            identityKey: `pulse-incident-identity/sha256:${identity.key}`,
            identityTokens: identity.tokens,
            identityAnchors: identity.anchors,
            representativeEmbedding: incident.embedding ?? null,
            createdRunId: incident.createdRunId,
          };
        }),
      ),
    );
  }

  if (plan.assignments.length > 0) {
    operations.push(
      db.insert(pulseIncidentAssignments).values(
        plan.assignments.map(({ assignment }) => ({
          ...assignment,
          assignedAt: new Date(assignment.assignedAt),
        })),
      ),
    );
  }

  for (const { assignment, embedding } of plan.assignments) {
    operations.push(
      db
        .update(rawEvents)
        .set({
          embedding,
          incidentId: assignment.incidentId,
          clusterId: assignment.rawClusterId,
          clusteredAt: new Date(assignment.assignedAt),
          clusterRunId: assignment.stageRunId,
        })
        .where(
          and(
            eq(rawEvents.id, assignment.rawEventId),
            isNull(rawEvents.incidentId),
            isNull(rawEvents.clusterId),
          ),
        ),
    );
  }

  for (const evidence of plan.evidence) {
    operations.push(
      db.insert(pulseSources).values({
        eventId: evidence.eventId,
        sourceId: evidence.sourceId,
        sourceType: evidence.sourceType,
        sourceName: evidence.sourceName,
        sourceUrl: evidence.sourceUrl,
        rawEventId: evidence.rawEventId,
      }),
    );
    const matchingCurrentEvent = sql`(
      select ${pulseEventsV2.classificationRunId}
      from ${pulseEventsV2}
      where ${pulseEventsV2.id} = ${evidence.eventId}
        and ${pulseEventsV2.projectionStatus} = 'current'
        and ${pulseEventsV2.incidentId} = ${rawEvents.incidentId}
      limit 1
    )`;
    operations.push(
      db
        .update(rawEvents)
        .set({
          classificationDisposition: "event",
          classificationReason: evidence.rationale,
          classificationDecision: {
            schemaVersion: PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION,
            eventId: evidence.eventId,
            rawEventId: evidence.rawEventId,
            attachedWithoutReclassification: true,
          },
          classificationRunId: matchingCurrentEvent,
          classifiedAt: new Date(evidence.attachedAt),
        })
        .where(
          and(
            eq(rawEvents.id, evidence.rawEventId),
            sql`${matchingCurrentEvent} is not null`,
          ),
        ),
    );
  }

  if (plan.resolutions.length > 0) {
    operations.push(
      db.insert(pulseIncidentResolutions).values(
        plan.resolutions.map((resolution) => ({
          ...resolution,
          leftIncidentId: [
            resolution.leftIncidentId,
            resolution.rightIncidentId,
          ].sort()[0],
          rightIncidentId: [
            resolution.leftIncidentId,
            resolution.rightIncidentId,
          ].sort()[1],
          evidenceRefs: [...new Set(resolution.evidenceRefs)].sort(),
          decidedAt: new Date(resolution.decidedAt),
        })),
      ),
    );
  }

  if (plan.completion) {
    operations.push(
      db
        .update(pulsePipelineRuns)
        .set({
          status: "completed",
          counts: plan.completion.counts,
          failures: [],
          completedAt: new Date(plan.completion.completedAt),
        })
        .where(
          and(
            eq(pulsePipelineRuns.id, plan.completion.runId),
            eq(pulsePipelineRuns.status, "running"),
          ),
        ),
    );
  }

  const incidentIds = plan.incidents.map(({ id }) => id);
  const rawEventIds = plan.assignments.map(
    ({ assignment }) => assignment.rawEventId,
  );
  const evidenceRawEventIds = plan.evidence.map(({ rawEventId }) => rawEventId);
  const resolutionKeys = plan.resolutions.map(
    ({ resolutionKey }) => resolutionKey,
  );
  const incidentGuard = countGuard(
    plan.incidents.length,
    () => sql`(
    select count(*)::integer
    from ${pulseIncidents}
    where ${inArray(pulseIncidents.id, incidentIds)}
      and ${pulseIncidents.createdRunId} = ${plan.runId}
  ) = ${plan.incidents.length}`,
  );
  const assignmentGuard = countGuard(
    plan.assignments.length,
    () => sql`(
    select count(*)::integer
    from ${pulseIncidentAssignments}
    where ${inArray(pulseIncidentAssignments.rawEventId, rawEventIds)}
      and ${pulseIncidentAssignments.stageRunId} = ${plan.runId}
  ) = ${plan.assignments.length}`,
  );
  const rawProjectionGuard = countGuard(
    plan.assignments.length,
    () => sql`(
    select count(*)::integer
    from ${rawEvents}
    inner join ${pulseIncidentAssignments}
      on ${pulseIncidentAssignments.rawEventId} = ${rawEvents.id}
    where ${inArray(pulseIncidentAssignments.rawEventId, rawEventIds)}
      and ${pulseIncidentAssignments.stageRunId} = ${plan.runId}
      and ${rawEvents.incidentId} = ${pulseIncidentAssignments.incidentId}
      and ${rawEvents.clusterId} = ${pulseIncidentAssignments.rawClusterId}
      and ${rawEvents.clusterRunId} = ${pulseIncidentAssignments.stageRunId}
      and ${rawEvents.embedding} is not null
  ) = ${plan.assignments.length}`,
  );
  const evidenceGuard = countGuard(
    plan.evidence.length,
    () => sql`(
    select count(*)::integer
    from ${pulseSources}
    inner join ${rawEvents} on ${rawEvents.id} = ${pulseSources.rawEventId}
    inner join ${pulseEventsV2} on ${pulseEventsV2.id} = ${pulseSources.eventId}
    where ${inArray(pulseSources.rawEventId, evidenceRawEventIds)}
      and ${pulseEventsV2.projectionStatus} = 'current'
      and ${pulseEventsV2.incidentId} = ${rawEvents.incidentId}
      and ${rawEvents.classificationDisposition} = 'event'
      and ${rawEvents.classificationRunId} = ${pulseEventsV2.classificationRunId}
      and ${rawEvents.classifiedAt} is not null
      and ${rawEvents.classificationDecision}->>'eventId' = ${pulseSources.eventId}::text
  ) = ${plan.evidence.length}`,
  );
  const resolutionGuard = countGuard(
    plan.resolutions.length,
    () => sql`(
    select count(*)::integer
    from ${pulseIncidentResolutions}
    where ${inArray(pulseIncidentResolutions.resolutionKey, resolutionKeys)}
      and ${pulseIncidentResolutions.stageRunId} = ${plan.runId}
  ) = ${plan.resolutions.length}`,
  );
  const completionGuard = plan.completion
    ? sql`exists (
        select 1
        from ${pulsePipelineRuns}
        where ${pulsePipelineRuns.id} = ${plan.completion.runId}
          and ${pulsePipelineRuns.status} = 'completed'
          and ${pulsePipelineRuns.counts} = ${JSON.stringify(plan.completion.counts)}::jsonb
          and ${pulsePipelineRuns.failures} = '[]'::jsonb
          and ${pulsePipelineRuns.completedAt} is not null
      )`
    : sql`true`;

  // A false invariant deliberately divides by zero inside the same database
  // transaction. The failed guard therefore cannot leave a partial publish.
  operations.push(
    db
      .select({
        atomicPublishGuard: sql<number>`1 / (case when
          ${incidentGuard}
          and ${assignmentGuard}
          and ${rawProjectionGuard}
          and ${evidenceGuard}
          and ${resolutionGuard}
          and ${completionGuard}
          then 1 else 0 end)`,
      })
      .from(sql`(select 1) as atomic_guard_source`),
  );

  const [first, ...rest] = operations;
  await db.batch([first, ...rest] as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
};
