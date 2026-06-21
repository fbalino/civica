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

import { eq, sql } from "drizzle-orm";
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
}

export interface ReviewQueueResult {
  rows: ReviewQueueRow[];
  totalPending: number;
}

export async function getPulseReviewQueue(opts: {
  limit?: number;
  offset?: number;
  dimension?: PulseDimension;
  severity?: string;
} = {}): Promise<ReviewQueueResult> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const wheres: ReturnType<typeof sql>[] = [
    sql`p.review_status = 'pending'`,
    sql`p.published = false`,
  ];
  if (opts.dimension) wheres.push(sql`p.dimension = ${opts.dimension}`);
  if (opts.severity) wheres.push(sql`p.severity_tier = ${opts.severity}`);
  const whereClause = sql.join(wheres, sql` AND `);

  // Deterministic ordering MUST happen in SQL, before LIMIT/OFFSET —
  // otherwise pagination is arbitrary across pages and rows can
  // duplicate or skip. Urgency first (severity rank, then classifier
  // agreement), then event_date DESC, then id as a stable final
  // tiebreaker. The CASE expressions encode the queue's intended urgency
  // contract: catastrophic_neg first, then severe_neg, etc.; and among
  // ties, classifier "none" agreement first (those need the most help).
  const severityOrder = sql`
    CASE p.severity_tier
      WHEN 'catastrophic_neg' THEN 0
      WHEN 'severe_neg' THEN 1
      WHEN 'high_pos' THEN 2
      WHEN 'moderate_neg' THEN 3
      WHEN 'moderate_pos' THEN 4
      WHEN 'low_neg' THEN 5
      WHEN 'low_pos' THEN 6
      ELSE 99
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
      ARRAY(
        SELECT DISTINCT ps.source_id
        FROM pulse_sources ps
        WHERE ps.event_id = p.id
      ) AS source_ids
    FROM pulse_events_v2 p
    JOIN jurisdictions j ON j.id = p.jurisdiction_id
    WHERE ${whereClause}
    ORDER BY
      ${severityOrder} ASC,
      ${agreementOrder} ASC,
      p.event_date DESC,
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
  }));

  // Total pending count for the queue header
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM pulse_events_v2
    WHERE review_status = 'pending' AND published = false
  `);
  const countRows =
    ((countResult as unknown as { rows?: unknown[] }).rows ??
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
    category: string;
    dimension: string;
    severityTier: string;
    severityValue: number;
    selfConfidence: number;
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
  id: string
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
    })
    .from(pulseEventsV2)
    .where(eq(pulseEventsV2.id, id))
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

  const sourceRows = await db
    .select({
      sourceId: pulseSources.sourceId,
      sourceType: pulseSources.sourceType,
      sourceName: pulseSources.sourceName,
      sourceUrl: pulseSources.sourceUrl,
    })
    .from(pulseSources)
    .where(eq(pulseSources.eventId, event.id));

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
    classifierRuns: (event.classifierRuns as ReviewEventDetail["classifierRuns"]) ?? [],
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
    sources: sourceRows,
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

export async function getPulseReviewAuditTrail(
  eventId: string
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
