import { createHash } from "node:crypto";

import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import {
  pulseIncidentAssignments,
  pulseIncidentResolutions,
  pulseIncidents,
  pulseEventsV2,
  pulseSources,
  rawEvents,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import {
  PULSE_INCIDENT_RESOLUTION_VERSION,
  type IncidentCandidate,
} from "./incident-resolution";
import { normalizeEventIdentity } from "./event-identity";

type Db = NeonHttpDatabase<typeof schema>;

export const PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION =
  "pulse-incident-assignment/v1" as const;
export const PULSE_INCIDENT_ASSIGNMENT_ALGORITHM_VERSION =
  "pulse-incident-assignment/identity-v1" as const;

export type IncidentAssignmentMatchKind =
  "new" | "persisted_match" | "post_classification_merge" | "backfill";
export type IncidentAssignmentFallbackMode =
  "semantic" | "conservative_lexical" | "historical_backfill";

export interface IncidentAssignmentPlan {
  schemaVersion: typeof PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION;
  assignmentKey: string;
  incidentId: string;
  rawEventId: string;
  rawClusterId: string;
  matchKind: IncidentAssignmentMatchKind;
  semanticSimilarity: number | null;
  tokenSimilarity: number;
  anchorOverlap: number;
  exactNormalizedMatch: boolean;
  algorithmVersion: string;
  embeddingModel: string | null;
  fallbackMode: IncidentAssignmentFallbackMode;
  stageRunId: string;
  actor: Record<string, unknown>;
  rationale: string;
  assignedAt: string;
}

export type IncidentResolutionOutcome =
  "candidate" | "confirmed_merge" | "rejected" | "unresolved";

export interface IncidentResolutionRecordPlan {
  schemaVersion: typeof PULSE_INCIDENT_RESOLUTION_VERSION;
  resolutionKey: string;
  leftIncidentId: string;
  rightIncidentId: string;
  outcome: IncidentResolutionOutcome;
  canonicalIncidentId: string | null;
  signals: Record<string, unknown>;
  methodVersion: string;
  stageRunId: string;
  actor: Record<string, unknown>;
  rationale: string;
  evidenceRefs: string[];
  decidedAt: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function buildIncidentAssignmentKey(
  input: Omit<IncidentAssignmentPlan, "schemaVersion" | "assignmentKey">,
): string {
  const {
    schemaVersion: _schemaVersion,
    assignmentKey: _assignmentKey,
    ...payload
  } = input as IncidentAssignmentPlan;
  return `${PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION.replace("/v1", "")}/sha256:${digest(payload)}`;
}

export function buildIncidentResolutionKey(
  input: Omit<IncidentResolutionRecordPlan, "schemaVersion" | "resolutionKey">,
): string {
  const {
    schemaVersion: _schemaVersion,
    resolutionKey: _resolutionKey,
    ...payload
  } = input as IncidentResolutionRecordPlan;
  const [leftIncidentId, rightIncidentId] = [
    payload.leftIncidentId,
    payload.rightIncidentId,
  ].sort();
  return `pulse-incident-resolution/sha256:${digest({
    ...payload,
    leftIncidentId,
    rightIncidentId,
    evidenceRefs: [...new Set(payload.evidenceRefs)].sort(),
  })}`;
}

function nonBlank(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name} is required`);
}

function finiteRange(
  value: number | null,
  name: string,
  minimum: number,
  maximum: number,
): void {
  if (value === null) return;
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
}

function validInstant(value: string, name: string): void {
  if (!Number.isFinite(Date.parse(value)))
    throw new Error(`${name} is invalid`);
}

export function validateIncidentAssignmentPlan(
  plan: IncidentAssignmentPlan,
): void {
  if (plan.schemaVersion !== PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION) {
    throw new Error("unsupported incident assignment schema version");
  }
  for (const [name, value] of [
    ["incidentId", plan.incidentId],
    ["rawEventId", plan.rawEventId],
    ["rawClusterId", plan.rawClusterId],
    ["algorithmVersion", plan.algorithmVersion],
    ["stageRunId", plan.stageRunId],
    ["rationale", plan.rationale],
  ] as const) {
    nonBlank(value, name);
  }
  finiteRange(plan.semanticSimilarity, "semanticSimilarity", -1, 1);
  finiteRange(plan.tokenSimilarity, "tokenSimilarity", 0, 1);
  finiteRange(plan.anchorOverlap, "anchorOverlap", 0, 1);
  validInstant(plan.assignedAt, "assignedAt");
  const expected = buildIncidentAssignmentKey(plan);
  if (plan.assignmentKey !== expected) {
    throw new Error("incident assignment key does not match its payload");
  }
}

export function validateIncidentResolutionRecordPlan(
  plan: IncidentResolutionRecordPlan,
): void {
  if (plan.schemaVersion !== PULSE_INCIDENT_RESOLUTION_VERSION) {
    throw new Error("unsupported incident resolution schema version");
  }
  nonBlank(plan.leftIncidentId, "leftIncidentId");
  nonBlank(plan.rightIncidentId, "rightIncidentId");
  nonBlank(plan.methodVersion, "methodVersion");
  nonBlank(plan.stageRunId, "stageRunId");
  nonBlank(plan.rationale, "rationale");
  if (plan.leftIncidentId === plan.rightIncidentId) {
    throw new Error("incident resolution requires two distinct incidents");
  }
  if (
    plan.evidenceRefs.length === 0 ||
    plan.evidenceRefs.some((ref) => !ref.trim())
  ) {
    throw new Error(
      "incident resolution requires non-blank evidence references",
    );
  }
  if (
    plan.outcome === "confirmed_merge" &&
    ![plan.leftIncidentId, plan.rightIncidentId].includes(
      plan.canonicalIncidentId ?? "",
    )
  ) {
    throw new Error(
      "confirmed merge requires a canonical incident in the pair",
    );
  }
  if (plan.outcome !== "confirmed_merge" && plan.canonicalIncidentId !== null) {
    throw new Error("only a confirmed merge may identify a canonical incident");
  }
  validInstant(plan.decidedAt, "decidedAt");
  const expected = buildIncidentResolutionKey(plan);
  if (plan.resolutionKey !== expected) {
    throw new Error("incident resolution key does not match its payload");
  }
}

export interface PersistedIncidentCandidateRow {
  incidentId: string;
  representativeTitle: string;
  eventDateStart: string | null;
  eventDateEnd: string | null;
  representativeEmbedding: number[] | null;
  incidentCreatedAt: Date | string;
  eventId: string | null;
  clusterId: string | null;
  jurisdictionId: string | null;
  eventDate: string | null;
  headline: string | null;
  description: string | null;
  published: boolean | null;
  humanReviewed: boolean | null;
  reviewStatus: string | null;
  category: string | null;
  dimension: string | null;
  severityTier: string | null;
  eventCreatedAt: Date | string | null;
  rawFallback?: {
    jurisdictionId: string | null;
    eventDate: string | null;
    title: string;
    body: string | null;
    clusterId: string | null;
  } | null;
  sourceCount: number;
}

export interface LoadActiveIncidentCandidatesOptions {
  windowStart: string;
  windowEnd: string;
  comparisonWindowHours?: number;
  /** Database-free seam for regression fixtures. */
  rows?: PersistedIncidentCandidateRow[];
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function projectionToCandidate(
  row: PersistedIncidentCandidateRow,
): IncidentCandidate {
  const eventDate =
    row.eventDate ?? row.rawFallback?.eventDate ?? row.eventDateStart;
  if (!eventDate)
    throw new Error(`incident ${row.incidentId} has no candidate date`);
  const headline =
    row.headline ?? row.rawFallback?.title ?? row.representativeTitle;
  const severity = row.severityTier;
  return {
    incidentId: row.incidentId,
    eventId: row.eventId,
    clusterId: row.clusterId ?? row.rawFallback?.clusterId ?? row.incidentId,
    origin: "persisted",
    jurisdictionId:
      row.jurisdictionId ?? row.rawFallback?.jurisdictionId ?? null,
    eventDate,
    headline,
    body: row.description ?? row.rawFallback?.body ?? null,
    sourceCount: row.sourceCount,
    publicationStatus: row.published ? "published" : "unpublished",
    reviewStatus: row.humanReviewed
      ? row.reviewStatus === "approved" || row.reviewStatus === "edited"
        ? "human_current"
        : "human_stale"
      : row.eventId
        ? "machine"
        : "unreviewed",
    categoryId: row.category,
    dimension: row.dimension,
    direction: severity?.endsWith("_pos")
      ? "positive"
      : severity?.endsWith("_neg")
        ? "negative"
        : null,
    severity,
    createdAt: row.eventCreatedAt
      ? iso(row.eventCreatedAt)
      : iso(row.incidentCreatedAt),
    embedding: row.representativeEmbedding,
  };
}

export async function loadActiveIncidentCandidates(
  db: Db,
  options: LoadActiveIncidentCandidatesOptions,
): Promise<IncidentCandidate[]> {
  validInstant(options.windowStart, "windowStart");
  validInstant(options.windowEnd, "windowEnd");
  if (Date.parse(options.windowStart) > Date.parse(options.windowEnd)) {
    throw new Error("incident candidate windowStart must not follow windowEnd");
  }
  const windowHours = options.comparisonWindowHours ?? 48;
  if (
    !Number.isFinite(windowHours) ||
    windowHours < 0 ||
    windowHours > 24 * 31
  ) {
    throw new Error("comparisonWindowHours must be between 0 and 744");
  }
  const lower = new Date(
    Date.parse(options.windowStart) - windowHours * 3_600_000,
  )
    .toISOString()
    .slice(0, 10);
  const upper = new Date(
    Date.parse(options.windowEnd) + windowHours * 3_600_000,
  )
    .toISOString()
    .slice(0, 10);

  let rows = options.rows;
  if (!rows) {
    const selected = await db
      .select({
        incidentId: pulseIncidents.id,
        representativeTitle: pulseIncidents.representativeTitle,
        eventDateStart: pulseIncidents.eventDateStart,
        eventDateEnd: pulseIncidents.eventDateEnd,
        representativeEmbedding: pulseIncidents.representativeEmbedding,
        incidentCreatedAt: pulseIncidents.createdAt,
        eventId: pulseEventsV2.id,
        clusterId: pulseEventsV2.clusterId,
        jurisdictionId: pulseEventsV2.jurisdictionId,
        eventDate: pulseEventsV2.eventDate,
        headline: pulseEventsV2.headline,
        description: pulseEventsV2.description,
        published: pulseEventsV2.published,
        humanReviewed: pulseEventsV2.humanReviewed,
        reviewStatus: pulseEventsV2.reviewStatus,
        category: pulseEventsV2.category,
        dimension: pulseEventsV2.dimension,
        severityTier: pulseEventsV2.severityTier,
        eventCreatedAt: pulseEventsV2.createdAt,
      })
      .from(pulseIncidents)
      .leftJoin(
        pulseEventsV2,
        and(
          eq(pulseEventsV2.incidentId, pulseIncidents.id),
          eq(pulseEventsV2.projectionStatus, "current"),
        ),
      )
      .where(
        and(
          eq(pulseIncidents.status, "active"),
          gte(
            sql`coalesce(${pulseEventsV2.eventDate}, ${pulseIncidents.eventDateEnd}, ${pulseIncidents.eventDateStart})`,
            lower,
          ),
          lte(
            sql`coalesce(${pulseEventsV2.eventDate}, ${pulseIncidents.eventDateStart}, ${pulseIncidents.eventDateEnd})`,
            upper,
          ),
        ),
      );
    const incidentIds = selected.map((row) => row.incidentId);
    const rawRows = incidentIds.length
      ? await db
          .select({
            incidentId: rawEvents.incidentId,
            jurisdictionId: rawEvents.jurisdictionId,
            eventDate: rawEvents.eventDate,
            title: rawEvents.title,
            body: rawEvents.body,
            clusterId: rawEvents.clusterId,
            createdAt: rawEvents.createdAt,
          })
          .from(rawEvents)
          .where(inArray(rawEvents.incidentId, incidentIds))
      : [];
    const grouped = new Map<string, typeof rawRows>();
    for (const raw of rawRows) {
      if (!raw.incidentId) continue;
      const group = grouped.get(raw.incidentId) ?? [];
      group.push(raw);
      grouped.set(raw.incidentId, group);
    }
    rows = selected.map((row) => {
      const evidence = (grouped.get(row.incidentId) ?? []).sort((left, right) =>
        `${left.eventDate ?? ""}\n${left.title}`.localeCompare(
          `${right.eventDate ?? ""}\n${right.title}`,
        ),
      );
      return {
        ...row,
        rawFallback: evidence[0] ?? null,
        sourceCount: evidence.length,
      };
    });
  }
  return rows
    .map(projectionToCandidate)
    .filter(
      (candidate) =>
        candidate.eventDate >= lower && candidate.eventDate <= upper,
    )
    .sort((left, right) => left.incidentId.localeCompare(right.incidentId));
}

export interface NewIncidentPlan {
  representativeTitle: string;
  body: string | null;
  eventDateStart: string | null;
  eventDateEnd: string | null;
  embedding?: number[] | null;
  createdRunId: string;
}

export function validateNewIncidentPlan(plan: NewIncidentPlan): void {
  nonBlank(plan.representativeTitle, "representativeTitle");
  nonBlank(plan.createdRunId, "createdRunId");
  if (plan.eventDateStart && !/^\d{4}-\d{2}-\d{2}$/.test(plan.eventDateStart)) {
    throw new Error("eventDateStart must be an ISO calendar date");
  }
  if (plan.eventDateEnd && !/^\d{4}-\d{2}-\d{2}$/.test(plan.eventDateEnd)) {
    throw new Error("eventDateEnd must be an ISO calendar date");
  }
  if (
    plan.eventDateStart &&
    plan.eventDateEnd &&
    plan.eventDateStart > plan.eventDateEnd
  ) {
    throw new Error("eventDateStart must not follow eventDateEnd");
  }
  if (plan.embedding?.some((component) => !Number.isFinite(component))) {
    throw new Error("incident embedding contains a non-finite component");
  }
}

export async function insertNewIncident(
  db: Db,
  plan: NewIncidentPlan,
): Promise<string> {
  validateNewIncidentPlan(plan);
  const identity = normalizeEventIdentity(plan.representativeTitle, plan.body);
  const inserted = await db
    .insert(pulseIncidents)
    .values({
      status: "active",
      mergedIntoIncidentId: null,
      representativeTitle: plan.representativeTitle.trim(),
      eventDateStart: plan.eventDateStart,
      eventDateEnd: plan.eventDateEnd,
      identityVersion: identity.version,
      identityKey: `pulse-incident-identity/sha256:${identity.key}`,
      identityTokens: identity.tokens,
      identityAnchors: identity.anchors,
      representativeEmbedding: plan.embedding ?? null,
      createdRunId: plan.createdRunId,
    })
    .returning({ id: pulseIncidents.id });
  if (!inserted[0]?.id) throw new Error("incident insert returned no id");
  return inserted[0].id;
}

export async function assignRawReportToIncident(
  db: Db,
  plan: IncidentAssignmentPlan,
): Promise<void> {
  validateIncidentAssignmentPlan(plan);
  await db
    .insert(pulseIncidentAssignments)
    .values({
      ...plan,
      assignedAt: new Date(plan.assignedAt),
    })
    .onConflictDoNothing({ target: pulseIncidentAssignments.assignmentKey });
  const persisted = await db
    .select({
      assignmentKey: pulseIncidentAssignments.assignmentKey,
      incidentId: pulseIncidentAssignments.incidentId,
    })
    .from(pulseIncidentAssignments)
    .where(eq(pulseIncidentAssignments.rawEventId, plan.rawEventId))
    .limit(1);
  if (
    persisted[0]?.assignmentKey !== plan.assignmentKey ||
    persisted[0]?.incidentId !== plan.incidentId
  ) {
    throw new Error(
      `raw report ${plan.rawEventId} already has a different assignment`,
    );
  }
  await db
    .update(rawEvents)
    .set({
      incidentId: plan.incidentId,
      clusterId: plan.rawClusterId,
      clusteredAt: new Date(plan.assignedAt),
      clusterRunId: plan.stageRunId,
    })
    .where(
      and(
        eq(rawEvents.id, plan.rawEventId),
        or(
          eq(rawEvents.incidentId, plan.incidentId),
          sql`${rawEvents.incidentId} is null`,
        ),
      ),
    );
  const raw = await db
    .select({
      incidentId: rawEvents.incidentId,
      clusterId: rawEvents.clusterId,
    })
    .from(rawEvents)
    .where(eq(rawEvents.id, plan.rawEventId))
    .limit(1);
  if (
    raw[0]?.incidentId !== plan.incidentId ||
    raw[0]?.clusterId !== plan.rawClusterId
  ) {
    throw new Error(
      `raw report ${plan.rawEventId} did not accept its incident assignment`,
    );
  }
}

export interface AttachIncidentEvidencePlan {
  eventId: string;
  rawEventId: string;
  sourceId: string;
  sourceType: string;
  sourceName: string;
  sourceUrl: string | null;
  stageRunId: string;
  attachedAt: string;
  rationale: string;
}

export function validateAttachIncidentEvidencePlan(
  plan: AttachIncidentEvidencePlan,
): void {
  for (const [name, value] of [
    ["eventId", plan.eventId],
    ["rawEventId", plan.rawEventId],
    ["sourceId", plan.sourceId],
    ["sourceType", plan.sourceType],
    ["sourceName", plan.sourceName],
    ["stageRunId", plan.stageRunId],
    ["rationale", plan.rationale],
  ] as const)
    nonBlank(value, name);
  validInstant(plan.attachedAt, "attachedAt");
}

export async function attachAssignedEvidenceToCurrentEvent(
  db: Db,
  plan: AttachIncidentEvidencePlan,
): Promise<void> {
  validateAttachIncidentEvidencePlan(plan);
  const [eventRows, rawRows] = await Promise.all([
    db
      .select({
        incidentId: pulseEventsV2.incidentId,
        classificationRunId: pulseEventsV2.classificationRunId,
      })
      .from(pulseEventsV2)
      .where(
        and(
          eq(pulseEventsV2.id, plan.eventId),
          eq(pulseEventsV2.projectionStatus, "current"),
        ),
      )
      .limit(1),
    db
      .select({ incidentId: rawEvents.incidentId })
      .from(rawEvents)
      .where(eq(rawEvents.id, plan.rawEventId))
      .limit(1),
  ]);
  if (!eventRows[0])
    throw new Error("evidence target is not a current event projection");
  if (!rawRows[0]?.incidentId)
    throw new Error("raw evidence has no incident assignment");
  if (eventRows[0].incidentId !== rawRows[0].incidentId) {
    throw new Error(
      "raw evidence and current event belong to different incidents",
    );
  }
  await db
    .insert(pulseSources)
    .values({
      eventId: plan.eventId,
      sourceId: plan.sourceId,
      sourceType: plan.sourceType,
      sourceName: plan.sourceName,
      sourceUrl: plan.sourceUrl,
      rawEventId: plan.rawEventId,
    })
    .onConflictDoNothing({ target: pulseSources.rawEventId });
  await db
    .update(rawEvents)
    .set({
      classificationDisposition: "event",
      classificationReason: plan.rationale,
      classificationDecision: {
        schemaVersion: PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION,
        eventId: plan.eventId,
        rawEventId: plan.rawEventId,
        attachedWithoutReclassification: true,
      },
      // This report inherits the event's classification lineage. The incident
      // assignment itself remains attributed to the later clustering run.
      classificationRunId: eventRows[0].classificationRunId,
      classifiedAt: new Date(plan.attachedAt),
    })
    .where(eq(rawEvents.id, plan.rawEventId));
}

export interface RepairAssignedEvidenceOptions {
  limit?: number;
  attachedAt?: Date;
}

/**
 * Repair the narrow cluster/classify interleaving where a report receives its
 * stable incident assignment after classification selected its frozen input,
 * but before the current event projection commits. The report intentionally
 * stays outside that model input; a later cluster delivery attaches it as
 * retained evidence under the already-classified incident.
 *
 * Source insertion, raw disposition, inherited classification lineage, and a
 * final count guard share one PostgreSQL statement. The operation is
 * repeatable: already attached evidence is no longer pending and is ignored.
 */
export async function repairAssignedEvidenceForCurrentEvents(
  db: Db,
  options: RepairAssignedEvidenceOptions = {},
): Promise<number> {
  const limit = options.limit ?? 1_000;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 10_000) {
    throw new Error("late-evidence repair limit must be between 1 and 10000");
  }
  const attachedAt = options.attachedAt ?? new Date();
  if (!Number.isFinite(attachedAt.getTime())) {
    throw new Error("late-evidence repair attachedAt is invalid");
  }
  const rationale =
    "PUL-031 repaired evidence assigned during classification without reclassification.";

  const result = await db.execute(sql`
    WITH eligible AS MATERIALIZED (
      SELECT
        r.id AS raw_event_id,
        r.source_id,
        r.source_type,
        r.source_url,
        e.id AS event_id,
        e.classification_run_id
      FROM raw_events r
      CROSS JOIN LATERAL (
        SELECT current_event.id, current_event.classification_run_id
        FROM pulse_events_v2 current_event
        WHERE current_event.incident_id = r.incident_id
          AND current_event.projection_status = 'current'
        ORDER BY current_event.updated_at DESC, current_event.id
        LIMIT 1
      ) e
      WHERE r.incident_id IS NOT NULL
        AND r.cluster_id IS NOT NULL
        AND r.classification_disposition = 'pending'
      ORDER BY r.id
      LIMIT ${limit}
      FOR UPDATE OF r
    ), inserted AS (
      INSERT INTO pulse_sources (
        event_id, source_id, source_type, source_name, source_url, raw_event_id
      )
      SELECT
        event_id, source_id, source_type, source_id, source_url, raw_event_id
      FROM eligible
      ON CONFLICT (raw_event_id) WHERE raw_event_id IS NOT NULL DO NOTHING
      RETURNING raw_event_id, event_id
    ), effective_sources AS (
      SELECT raw_event_id, event_id FROM inserted
      UNION
      SELECT e.raw_event_id, e.event_id
      FROM eligible e
      JOIN pulse_sources ps
        ON ps.raw_event_id = e.raw_event_id
       AND ps.event_id = e.event_id
    ), updated AS (
      UPDATE raw_events r
      SET
        classification_disposition = 'event',
        classification_reason = ${rationale},
        classification_decision = jsonb_build_object(
          'schemaVersion', ${PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION}::text,
          'eventId', e.event_id,
          'rawEventId', e.raw_event_id,
          'attachedWithoutReclassification', true,
          'repair', true
        ),
        classification_run_id = e.classification_run_id,
        classified_at = ${attachedAt}
      FROM eligible e
      JOIN effective_sources s
        ON s.raw_event_id = e.raw_event_id
       AND s.event_id = e.event_id
      WHERE r.id = e.raw_event_id
        AND r.classification_disposition = 'pending'
      RETURNING r.id
    ), outcome AS (
      SELECT
        (SELECT COUNT(*)::integer FROM eligible) AS eligible_count,
        (SELECT COUNT(*)::integer FROM updated) AS attached_count
    )
    SELECT
      attached_count,
      1 / (CASE WHEN eligible_count = attached_count THEN 1 ELSE 0 END)
        AS atomic_guard
    FROM outcome
  `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: Array<{ attached_count?: unknown }> }).rows ?? []);
  return Number(rows[0]?.attached_count ?? 0);
}

export async function appendIncidentResolution(
  db: Db,
  plan: IncidentResolutionRecordPlan,
): Promise<void> {
  validateIncidentResolutionRecordPlan(plan);
  await db
    .insert(pulseIncidentResolutions)
    .values({
      ...plan,
      leftIncidentId: [plan.leftIncidentId, plan.rightIncidentId].sort()[0],
      rightIncidentId: [plan.leftIncidentId, plan.rightIncidentId].sort()[1],
      evidenceRefs: [...new Set(plan.evidenceRefs)].sort(),
      decidedAt: new Date(plan.decidedAt),
    })
    .onConflictDoNothing({ target: pulseIncidentResolutions.resolutionKey });
}
