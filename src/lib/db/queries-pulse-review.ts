/**
 * Phase 5.7 — Pulse review queue query helpers.
 *
 * The queue is `pulse_events_v2` rows where:
 *   review_status = 'pending'
 *   AND published = false
 *
 * Ordered by severity urgency (catastrophic_neg first), then
 * by classifier_agreement (none first — those need the most help),
 * then by event_date desc.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  jurisdictions,
  pulseEventsV2,
  pulseReviewAuditLog,
  pulseSources,
} from "@/lib/db/schema";
import type { PulseDimension } from "@/lib/pulse/v2/types";

export interface ReviewQueueRow {
  id: string;
  eventDate: string;
  country: { slug: string; name: string };
  category: string;
  dimension: PulseDimension;
  severityTier: string;
  severityValue: number;
  classifierAgreement: string;
  corroborationConfidence: number;
  pressFreedomScoreAtClassification: number | null;
  headline: string;
  reviewStatus: string;
  sourceIds: string[];
  priority: "critical" | "urgent" | "standard";
  queuedAt: string;
  dueAt: string;
  complianceState:
    | "within_sla"
    | "escalation_due"
    | "breached_unexcepted"
    | "breached_excepted";
  exceptionActive: boolean;
}

export interface ReviewQueueResult {
  rows: ReviewQueueRow[];
  totalPending: number;
}

export async function getPulseReviewQueue(
  opts: {
    limit?: number;
    offset?: number;
    dimension?: PulseDimension;
    severity?: string;
  } = {},
): Promise<ReviewQueueResult> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const wheres: ReturnType<typeof sql>[] = [
    sql`p.review_status = 'pending'`,
    sql`p.published = false`,
    sql`p.projection_status = 'current'`,
  ];
  if (opts.dimension) wheres.push(sql`p.dimension = ${opts.dimension}`);
  if (opts.severity) wheres.push(sql`p.severity_tier = ${opts.severity}`);
  const whereClause = sql.join(wheres, sql` AND `);

  // SLA priority and deadline are the queue order. This prevents newer event
  // dates from starving older obligations within the same severity tier.
  const priorityOrder = sql`
    CASE o.priority
      WHEN 'critical' THEN 0
      WHEN 'urgent' THEN 1
      ELSE 2
    END
  `;
  const agreementOrder = sql`
    CASE p.classifier_agreement
      WHEN 'none' THEN 0
      WHEN 'two_of_three' THEN 1
      WHEN 'all' THEN 2
      ELSE 99
    END
  `;

  const rowsResult = await db.execute(sql`
    SELECT
      p.id,
      p.event_date,
      j.slug AS country_slug,
      j.name AS country_name,
      p.category,
      p.dimension,
      p.severity_tier,
      p.severity_value,
      p.classifier_agreement,
      p.corroboration_confidence,
      p.press_freedom_score_at_classification,
      p.headline,
      p.review_status,
      o.priority,
      o.queued_at,
      o.due_at,
      EXISTS (
        SELECT 1 FROM pulse_review_sla_events exception
        WHERE exception.obligation_id = o.id
          AND exception.kind = 'exception_granted'
          AND exception.effective_at <= now()
          AND exception.expires_at > now()
      ) AS exception_active,
      CASE
        WHEN o.due_at <= now() AND EXISTS (
          SELECT 1 FROM pulse_review_sla_events exception
          WHERE exception.obligation_id = o.id
            AND exception.kind = 'exception_granted'
            AND exception.effective_at <= now()
            AND exception.expires_at > now()
        ) THEN 'breached_excepted'
        WHEN o.due_at <= now() THEN 'breached_unexcepted'
        WHEN o.escalate_at <= now() THEN 'escalation_due'
        ELSE 'within_sla'
      END AS compliance_state,
      ARRAY(
        SELECT DISTINCT ps.source_id
        FROM pulse_sources ps
        JOIN pulse_events_v2 source_event ON source_event.id = ps.event_id
        WHERE source_event.incident_id = p.incident_id
      ) AS source_ids
    FROM pulse_events_v2 p
    JOIN jurisdictions j ON j.id = p.jurisdiction_id
    JOIN pulse_review_obligations o
      ON o.event_id = p.id
      AND o.sla_version = 'pulse-review-sla/v1'
      AND o.state IN ('open','claimed')
    WHERE ${whereClause}
    ORDER BY
      ${priorityOrder} ASC,
      o.due_at ASC,
      ${agreementOrder} ASC,
      o.queued_at ASC,
      p.id ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const trimmed = ((rowsResult as unknown as { rows?: unknown[] }).rows ??
    rowsResult) as Array<Record<string, unknown>>;

  const rows: ReviewQueueRow[] = trimmed.map((r) => ({
    id: String(r.id),
    eventDate: String(r.event_date),
    country: {
      slug: String(r.country_slug),
      name: String(r.country_name),
    },
    category: String(r.category),
    dimension: r.dimension as PulseDimension,
    severityTier: String(r.severity_tier),
    severityValue: Number(r.severity_value),
    classifierAgreement: String(r.classifier_agreement),
    corroborationConfidence: Number(r.corroboration_confidence),
    pressFreedomScoreAtClassification:
      r.press_freedom_score_at_classification !== null
        ? Number(r.press_freedom_score_at_classification)
        : null,
    headline: String(r.headline),
    reviewStatus: String(r.review_status),
    sourceIds: Array.isArray(r.source_ids) ? (r.source_ids as string[]) : [],
    priority: r.priority as ReviewQueueRow["priority"],
    queuedAt: new Date(String(r.queued_at)).toISOString(),
    dueAt: new Date(String(r.due_at)).toISOString(),
    complianceState: r.compliance_state as ReviewQueueRow["complianceState"],
    exceptionActive: Boolean(r.exception_active),
  }));

  // Total pending count for the queue header
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM pulse_events_v2
    WHERE review_status = 'pending'
      AND published = false
      AND projection_status = 'current'
  `);
  const countRows = ((countResult as unknown as { rows?: unknown[] }).rows ??
    countResult) as Array<Record<string, unknown>>;
  const totalPending = Number(countRows[0]?.total ?? 0);

  return { rows, totalPending };
}

export interface ReviewEventDetail {
  id: string;
  eventDate: string;
  country: { id: string; slug: string; name: string; iso3: string | null };
  category: string;
  dimension: PulseDimension;
  severityTier: string;
  severityValue: number;
  corroborationConfidence: number;
  classifierRuns: Array<{
    run: number;
    temp: number;
    model: string;
    /** Vendor engine that produced the run (ensemble rows; absent on legacy). */
    provider?: string;
    role?: "classify" | "verify";
    promptVersion?: string;
    methodVersion?: string;
    configurationHash?: string;
    configuredEngineCount?: number;
    category: string;
    dimension: string;
    severityTier: string;
    severityValue: number;
    selfConfidence: number;
    /** Verify-pass verdict on the verify row (ensemble/single); absent on
     *  classify rows and legacy rows. */
    confidence?: "high" | "medium" | "low";
    rationale: string;
  }>;
  classifierAgreement: string;
  humanReviewed: boolean;
  reviewerId: string | null;
  reviewNotes: string | null;
  reviewStatus: string;
  published: boolean;
  headline: string;
  description: string;
  aiSummary: string | null;
  pressFreedomScoreAtClassification: number | null;
  createdAt: string;
  updatedAt: string;
  sources: Array<{
    sourceId: string;
    sourceType: string;
    sourceName: string;
    sourceUrl: string | null;
  }>;
}

export async function getPulseReviewEvent(
  id: string,
): Promise<ReviewEventDetail | null> {
  const eventRows = await db
    .select({
      id: pulseEventsV2.id,
      eventDate: pulseEventsV2.eventDate,
      jurisdictionId: pulseEventsV2.jurisdictionId,
      category: pulseEventsV2.category,
      dimension: pulseEventsV2.dimension,
      severityTier: pulseEventsV2.severityTier,
      severityValue: pulseEventsV2.severityValue,
      corroborationConfidence: pulseEventsV2.corroborationConfidence,
      classifierRuns: pulseEventsV2.classifierRuns,
      classifierAgreement: pulseEventsV2.classifierAgreement,
      humanReviewed: pulseEventsV2.humanReviewed,
      reviewerId: pulseEventsV2.reviewerId,
      reviewNotes: pulseEventsV2.reviewNotes,
      reviewStatus: pulseEventsV2.reviewStatus,
      published: pulseEventsV2.published,
      headline: pulseEventsV2.headline,
      description: pulseEventsV2.description,
      aiSummary: pulseEventsV2.aiSummary,
      pressFreedomScoreAtClassification:
        pulseEventsV2.pressFreedomScoreAtClassification,
      createdAt: pulseEventsV2.createdAt,
      updatedAt: pulseEventsV2.updatedAt,
      incidentId: pulseEventsV2.incidentId,
    })
    .from(pulseEventsV2)
    .where(
      and(
        eq(pulseEventsV2.id, id),
        eq(pulseEventsV2.projectionStatus, "current"),
      ),
    )
    .limit(1);

  const event = eventRows[0];
  if (!event) return null;

  const jurisdictionRows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.id, event.jurisdictionId))
    .limit(1);

  const jurisdiction = jurisdictionRows[0];
  if (!jurisdiction) return null;

  const sourceResult = await db.execute(sql`
    SELECT DISTINCT
      ps.source_id,
      ps.source_type,
      ps.source_name,
      ps.source_url
    FROM pulse_sources ps
    JOIN pulse_events_v2 source_event ON source_event.id = ps.event_id
    WHERE source_event.incident_id = ${event.incidentId}
    ORDER BY ps.source_id, ps.source_url NULLS FIRST
  `);
  const sourceRows = ((sourceResult as unknown as { rows?: unknown[] }).rows ??
    sourceResult) as Array<Record<string, unknown>>;

  return {
    id: event.id,
    eventDate: event.eventDate,
    country: {
      id: jurisdiction.id,
      slug: jurisdiction.slug,
      name: jurisdiction.name,
      iso3: jurisdiction.iso3,
    },
    category: event.category,
    dimension: event.dimension as PulseDimension,
    severityTier: event.severityTier,
    severityValue: event.severityValue,
    corroborationConfidence: event.corroborationConfidence,
    classifierRuns:
      (event.classifierRuns as ReviewEventDetail["classifierRuns"]) ?? [],
    classifierAgreement: event.classifierAgreement,
    humanReviewed: event.humanReviewed,
    reviewerId: event.reviewerId,
    reviewNotes: event.reviewNotes,
    reviewStatus: event.reviewStatus,
    published: event.published,
    headline: event.headline,
    description: event.description,
    aiSummary: event.aiSummary,
    pressFreedomScoreAtClassification: event.pressFreedomScoreAtClassification,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    sources: sourceRows.map((source) => ({
      sourceId: String(source.source_id),
      sourceType: String(source.source_type),
      sourceName: String(source.source_name),
      sourceUrl:
        source.source_url === null || source.source_url === undefined
          ? null
          : String(source.source_url),
    })),
  };
}

export interface AuditTrailRow {
  id: string;
  reviewerId: string;
  action: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
}

export interface ReviewSlaEventRow {
  kind: string;
  reasonCode: string;
  note: string;
  effectiveAt: string;
  expiresAt: string | null;
  actor: Record<string, unknown>;
}

export interface ReviewSlaDetail {
  priority: "critical" | "urgent" | "standard";
  state: string;
  queuedAt: string;
  escalateAt: string;
  dueAt: string;
  events: ReviewSlaEventRow[];
}

export async function getPulseReviewSlaDetail(
  eventId: string,
): Promise<ReviewSlaDetail | null> {
  const result = await db.execute(sql`
    SELECT
      o.id,
      o.priority,
      o.state,
      o.queued_at,
      o.escalate_at,
      o.due_at,
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'kind', e.kind,
          'reasonCode', e.reason_code,
          'note', e.note,
          'effectiveAt', e.effective_at,
          'expiresAt', e.expires_at,
          'actor', e.actor
        ) ORDER BY e.effective_at DESC, e.id DESC
      ) FILTER (WHERE e.id IS NOT NULL), '[]'::jsonb) AS events
    FROM pulse_review_obligations o
    LEFT JOIN pulse_review_sla_events e ON e.obligation_id = o.id
    WHERE o.event_id = ${eventId}::uuid
      AND o.sla_version = 'pulse-review-sla/v1'
    GROUP BY o.id
    LIMIT 1
  `);
  const record = (
    ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<
      Record<string, unknown>
    >
  )[0];
  if (!record) return null;
  const stamp = (value: unknown) => new Date(String(value)).toISOString();
  const events = Array.isArray(record.events)
    ? (record.events as Array<Record<string, unknown>>).map((event) => ({
        kind: String(event.kind),
        reasonCode: String(event.reasonCode),
        note: String(event.note),
        effectiveAt: stamp(event.effectiveAt),
        expiresAt: event.expiresAt ? stamp(event.expiresAt) : null,
        actor: (event.actor ?? {}) as Record<string, unknown>,
      }))
    : [];
  return {
    priority: record.priority as ReviewSlaDetail["priority"],
    state: String(record.state),
    queuedAt: stamp(record.queued_at),
    escalateAt: stamp(record.escalate_at),
    dueAt: stamp(record.due_at),
    events,
  };
}

export async function getPulseReviewAuditTrail(
  eventId: string,
): Promise<AuditTrailRow[]> {
  const rows = await db
    .select()
    .from(pulseReviewAuditLog)
    .where(eq(pulseReviewAuditLog.eventId, eventId))
    .orderBy(sql`${pulseReviewAuditLog.createdAt} DESC`);
  return rows.map((r) => ({
    id: r.id,
    reviewerId: r.reviewerId,
    action: r.action,
    before: (r.before as Record<string, unknown>) ?? {},
    after: (r.after as Record<string, unknown>) ?? {},
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}
