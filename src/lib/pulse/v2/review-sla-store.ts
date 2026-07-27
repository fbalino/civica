import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  PULSE_REVIEW_SLA_VERSION,
  type PulseReviewHealthState,
  type PulseReviewPriority,
} from "./review-sla";

export const PULSE_REVIEW_EXCEPTION_REASONS = [
  "source_access_failure",
  "language_or_expertise_needed",
  "identity_resolution_pending",
  "evidence_conflict",
  "legal_or_security_hold",
  "reviewer_conflict",
  "system_outage",
] as const;

export type PulseReviewExceptionReason =
  (typeof PULSE_REVIEW_EXCEPTION_REASONS)[number];

export interface PulseReviewSlaPrioritySummary {
  priority: PulseReviewPriority;
  open: number;
  escalationDue: number;
  breached: number;
  oldestQueuedAt: string | null;
}

export interface PulseReviewSlaReport {
  schemaVersion: "pulse-review-sla-report/v1";
  slaVersion: typeof PULSE_REVIEW_SLA_VERSION;
  generatedAt: string;
  healthState: PulseReviewHealthState;
  dailyCompletenessEligible: boolean;
  active: number;
  claimed: number;
  legacyQuarantined: number;
  dueWithin24Hours: number;
  escalationDue: number;
  breachedUnexcepted: number;
  breachedExcepted: number;
  activeExceptions: number;
  unresolvedCategory: number;
  oldestQueuedAt: string | null;
  byPriority: PulseReviewSlaPrioritySummary[];
}

function resultRows(result: unknown): Array<Record<string, unknown>> {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Array<Record<string, unknown>>;
}

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export async function loadPulseReviewSlaReport(
  now = new Date(),
): Promise<PulseReviewSlaReport> {
  const rows = resultRows(
    await db.execute(sql`
    WITH active_exception AS (
      SELECT DISTINCT obligation_id
      FROM pulse_review_sla_events
      WHERE kind = 'exception_granted'
        AND effective_at <= ${now}
        AND expires_at > ${now}
    ), active AS (
      SELECT
        o.*,
        p.severity_tier,
        p.category,
        (x.obligation_id IS NOT NULL) AS excepted
      FROM pulse_review_obligations o
      JOIN pulse_events_v2 p ON p.id = o.event_id
      LEFT JOIN active_exception x ON x.obligation_id = o.id
      WHERE o.sla_version = ${PULSE_REVIEW_SLA_VERSION}
        AND o.state IN ('open','claimed')
    )
    SELECT
      (SELECT count(*)::int FROM active) AS active,
      (SELECT count(*)::int FROM active WHERE state = 'claimed') AS claimed,
      (SELECT count(*)::int FROM pulse_review_obligations
        WHERE sla_version = ${PULSE_REVIEW_SLA_VERSION}
          AND state = 'legacy_quarantined') AS legacy_quarantined,
      (SELECT count(*)::int FROM active
        WHERE due_at > ${now}::timestamp
          AND due_at <= ${now}::timestamp + interval '24 hours') AS due_within_24_hours,
      (SELECT count(*)::int FROM active
        WHERE escalate_at <= ${now}) AS escalation_due,
      (SELECT count(*)::int FROM active
        WHERE due_at <= ${now} AND excepted = false) AS breached_unexcepted,
      (SELECT count(*)::int FROM active
        WHERE due_at <= ${now} AND excepted = true) AS breached_excepted,
      (SELECT count(*)::int FROM active WHERE excepted = true) AS active_exceptions,
      (SELECT count(*)::int FROM active WHERE category = 'none') AS unresolved_category,
      (SELECT min(queued_at) FROM active) AS oldest_queued_at
  `),
  );
  const row = rows[0] ?? {};

  const priorityRows = resultRows(
    await db.execute(sql`
    SELECT
      o.priority,
      count(*)::int AS open,
      count(*) FILTER (WHERE o.escalate_at <= ${now})::int AS escalation_due,
      count(*) FILTER (WHERE o.due_at <= ${now})::int AS breached,
      min(o.queued_at) AS oldest_queued_at
    FROM pulse_review_obligations o
    WHERE o.sla_version = ${PULSE_REVIEW_SLA_VERSION}
      AND o.state IN ('open','claimed')
    GROUP BY o.priority
    ORDER BY CASE o.priority
      WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END
  `),
  );

  const active = Number(row.active ?? 0);
  const breached =
    Number(row.breached_unexcepted ?? 0) + Number(row.breached_excepted ?? 0);
  const healthState: PulseReviewHealthState = breached
    ? "incomplete_review_sla"
    : active
      ? "current_reviews_pending"
      : "complete";

  const byPriority = (["critical", "urgent", "standard"] as const).map(
    (priority) => {
      const match = priorityRows.find((item) => item.priority === priority);
      return {
        priority,
        open: Number(match?.open ?? 0),
        escalationDue: Number(match?.escalation_due ?? 0),
        breached: Number(match?.breached ?? 0),
        oldestQueuedAt: iso(match?.oldest_queued_at),
      };
    },
  );

  return {
    schemaVersion: "pulse-review-sla-report/v1",
    slaVersion: PULSE_REVIEW_SLA_VERSION,
    generatedAt: now.toISOString(),
    healthState,
    dailyCompletenessEligible: breached === 0,
    active,
    claimed: Number(row.claimed ?? 0),
    legacyQuarantined: Number(row.legacy_quarantined ?? 0),
    dueWithin24Hours: Number(row.due_within_24_hours ?? 0),
    escalationDue: Number(row.escalation_due ?? 0),
    breachedUnexcepted: Number(row.breached_unexcepted ?? 0),
    breachedExcepted: Number(row.breached_excepted ?? 0),
    activeExceptions: Number(row.active_exceptions ?? 0),
    unresolvedCategory: Number(row.unresolved_category ?? 0),
    oldestQueuedAt: iso(row.oldest_queued_at),
    byPriority,
  };
}

export async function recordDuePulseReviewEscalations(
  now = new Date(),
): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO pulse_review_sla_events (
      schema_version, event_key, obligation_id, kind, actor, reason_code,
      note, effective_at, expires_at, metadata
    )
    SELECT
      'pulse-review-sla-event/v1',
      'pulse-review-sla-event/sha256:' || encode(
        digest(o.id::text || E'\nescalated\n' || o.escalate_at::text, 'sha256'),
        'hex'
      ),
      o.id, 'escalated',
      '{"type":"automated_monitor","version":"pulse-review-sla/v1"}'::jsonb,
      CASE WHEN o.due_at <= ${now} THEN 'sla_breached' ELSE 'escalation_due' END,
      CASE WHEN o.due_at <= ${now}
        THEN 'Human-review obligation passed its disposition deadline.'
        ELSE 'Human-review obligation reached its escalation threshold.' END,
      ${now}, NULL,
      jsonb_build_object('priority', o.priority, 'dueAt', o.due_at)
    FROM pulse_review_obligations o
    WHERE o.sla_version = ${PULSE_REVIEW_SLA_VERSION}
      AND o.state IN ('open','claimed')
      AND o.escalate_at <= ${now}
    ON CONFLICT (event_key) DO NOTHING
    RETURNING id
  `);
  return resultRows(result).length;
}

function exceptionEventKey(input: {
  obligationId: string;
  reason: PulseReviewExceptionReason;
  effectiveAt: string;
  expiresAt: string;
}): string {
  const hash = createHash("sha256")
    .update(
      [
        input.obligationId,
        "exception_granted",
        input.reason,
        input.effectiveAt,
        input.expiresAt,
      ].join("\n"),
    )
    .digest("hex");
  return `pulse-review-sla-event/sha256:${hash}`;
}

export async function grantPulseReviewException(input: {
  eventId: string;
  actorId: string;
  reason: PulseReviewExceptionReason;
  note: string;
  expiresAt: Date;
  now?: Date;
}): Promise<{ id: string }> {
  const now = input.now ?? new Date();
  if (!PULSE_REVIEW_EXCEPTION_REASONS.includes(input.reason)) {
    throw new Error("Unsupported review-SLA exception reason");
  }
  if (input.note.trim().length < 12) {
    throw new Error("Review-SLA exception note must explain the delay");
  }
  if (input.expiresAt <= now) {
    throw new Error("Review-SLA exception must expire in the future");
  }
  if (input.expiresAt.getTime() - now.getTime() > 30 * 24 * 60 * 60 * 1000) {
    throw new Error("Review-SLA exception cannot exceed 30 days");
  }

  const obligations = resultRows(
    await db.execute(sql`
    SELECT o.id
    FROM pulse_review_obligations o
    JOIN pulse_events_v2 p ON p.id = o.event_id
    WHERE o.event_id = ${input.eventId}::uuid
      AND o.sla_version = ${PULSE_REVIEW_SLA_VERSION}
      AND o.state IN ('open','claimed')
      AND p.review_status = 'pending'
      AND p.published = false
      AND NOT EXISTS (
        SELECT 1 FROM pulse_review_sla_events e
        WHERE e.obligation_id = o.id
          AND e.kind = 'exception_granted'
          AND e.effective_at <= ${now}
          AND e.expires_at > ${now}
      )
    LIMIT 1
  `),
  );
  const obligationId = String(obligations[0]?.id ?? "");
  if (!obligationId) throw new Error("No eligible open review obligation");

  const effectiveAt = now.toISOString();
  const expiresAt = input.expiresAt.toISOString();
  const eventKey = exceptionEventKey({
    obligationId,
    reason: input.reason,
    effectiveAt,
    expiresAt,
  });
  const inserted = resultRows(
    await db.execute(sql`
    INSERT INTO pulse_review_sla_events (
      schema_version, event_key, obligation_id, kind, actor, reason_code,
      note, effective_at, expires_at, metadata
    ) VALUES (
      'pulse-review-sla-event/v1', ${eventKey}, ${obligationId}::uuid,
      'exception_granted',
      ${JSON.stringify({ type: "human_reviewer", reviewerId: input.actorId })}::jsonb,
      ${input.reason}, ${input.note.trim()}, ${now}, ${input.expiresAt},
      ${JSON.stringify({ dailyCompletenessEligible: false })}::jsonb
    )
    ON CONFLICT (event_key) DO NOTHING
    RETURNING id
  `),
  );
  const id = String(inserted[0]?.id ?? "");
  if (!id) throw new Error("Review-SLA exception was not recorded");
  return { id };
}
