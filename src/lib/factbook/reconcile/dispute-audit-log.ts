/**
 * Phase R.21 — `data_facts_audit_log` writer + reader helpers.
 *
 * The audit-log table was created in Phase F.5 but never wired to a
 * write site. R.21 wires manual reviewer decisions via
 * `POST /api/admin/data-disputes/[id]`. Auto-resolve sweeps use the atomic
 * data-modifying CTE in `auto-resolve-disputes.ts`, so the dispute status and
 * audit row cannot commit separately.
 *
 * Plus reopen actions (admin reopens a previously-resolved dispute).
 *
 * Methodology: ~/civica/plan/disputes-triage-resolution-v1.md §2b
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataFactsAuditLog, dataDisputes } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type DisputeRow = InferSelectModel<typeof dataDisputes>;

/**
 * Action enum for `data_facts_audit_log.action`. Only `reviewer_decision`
 * + `auto_resolve_stale` + `reopen` are wired in R.21 v1.0; the other
 * three (resolver_recompute / methodology_version_bump / sync_*) are
 * preserved for the original Phase F.5 spec but not used yet.
 */
export type DisputeAuditAction =
  | "reviewer_decision"
  | "auto_resolve_stale"
  | "reopen"
  | "resolver_recompute"
  | "methodology_version_bump"
  | "sync_rejected"
  | "sync_admitted";

/**
 * Subset of `data_disputes` columns we snapshot into `before` / `after`.
 * Stable names so future schema-evolution tooling can replay history.
 */
export interface DisputeSnapshot {
  id: string;
  status: string;
  reviewerId: string | null;
  reviewerNotes: string | null;
  resolvedAt: string | null;
  resolutionAction: string | null;
}

export function snapshotDispute(d: DisputeRow): DisputeSnapshot {
  return {
    id: d.id,
    status: d.status,
    reviewerId: d.reviewerId,
    reviewerNotes: d.reviewerNotes,
    resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
    resolutionAction: d.resolutionAction,
  };
}

export interface WriteAuditLogInput {
  dispute: DisputeRow;
  action: DisputeAuditAction;
  actorId: string;
  before: DisputeSnapshot;
  after: DisputeSnapshot;
  notes?: string | null;
}

/**
 * Insert a single audit-log row. Returns the inserted row's id.
 *
 * Errors are not silently swallowed. Manual review callers await the insert
 * before responding and surface a 500 if it fails. Cron auto-resolution does
 * not call this standalone writer; it uses one atomic PostgreSQL statement so
 * an audit failure also rolls back the domain-row update.
 */
export async function writeDisputeAuditLog(
  input: WriteAuditLogInput,
): Promise<string> {
  const inserted = await db
    .insert(dataFactsAuditLog)
    .values({
      jurisdictionId: input.dispute.jurisdictionId,
      factKey: input.dispute.factKey,
      disputeId: input.dispute.id,
      action: input.action,
      actorId: input.actorId,
      before: input.before,
      after: input.after,
      notes: input.notes ?? null,
    })
    .returning({ id: dataFactsAuditLog.id });
  return inserted[0]!.id;
}

/**
 * Read recent audit-log rows for a single dispute. Used by the
 * dispute detail page to render "prior actions" panel.
 */
export interface AuditLogRow {
  id: string;
  disputeId: string | null;
  action: string;
  actorId: string;
  before: DisputeSnapshot | null;
  after: DisputeSnapshot | null;
  notes: string | null;
  createdAt: string;
}

export async function getAuditLogForDispute(
  disputeId: string,
): Promise<AuditLogRow[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      dispute_id,
      action,
      actor_id,
      before,
      after,
      notes,
      created_at
    FROM data_facts_audit_log
    WHERE dispute_id = ${disputeId}
    ORDER BY created_at DESC
    LIMIT 100
  `);
  const raw = ((result as unknown as { rows?: unknown[] }).rows ??
    result) as Array<Record<string, unknown>>;
  return raw.map((r) => ({
    id: String(r.id),
    disputeId: r.dispute_id ? String(r.dispute_id) : null,
    action: String(r.action),
    actorId: String(r.actor_id),
    before: (r.before as DisputeSnapshot | null) ?? null,
    after: (r.after as DisputeSnapshot | null) ?? null,
    notes: r.notes ? String(r.notes) : null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  }));
}

/**
 * Read the global audit timeline for `/admin/data-disputes/audit`.
 * Joined to dispute + jurisdiction for context display.
 */
export interface AuditTimelineRow extends AuditLogRow {
  factKey: string | null;
  countrySlug: string | null;
  countryName: string | null;
  disputeKind: string | null;
}

export interface AuditTimelineFilters {
  action?: string;
  countrySlug?: string;
  sinceIso?: string;
  untilIso?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditTimeline(
  filters: AuditTimelineFilters = {},
): Promise<{ rows: AuditTimelineRow[]; totalCount: number }> {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  const wheres: ReturnType<typeof sql>[] = [];
  if (filters.action) {
    wheres.push(sql`l.action = ${filters.action}`);
  }
  if (filters.countrySlug) {
    wheres.push(sql`j.slug = ${filters.countrySlug}`);
  }
  if (filters.sinceIso) {
    wheres.push(sql`l.created_at >= ${filters.sinceIso}`);
  }
  if (filters.untilIso) {
    wheres.push(sql`l.created_at <= ${filters.untilIso}`);
  }
  const whereClause =
    wheres.length > 0 ? sql`WHERE ${sql.join(wheres, sql` AND `)}` : sql``;

  const result = await db.execute(sql`
    SELECT
      l.id,
      l.dispute_id,
      l.action,
      l.actor_id,
      l.before,
      l.after,
      l.notes,
      l.created_at,
      l.fact_key AS log_fact_key,
      d.dispute_kind,
      j.slug AS country_slug,
      j.name AS country_name
    FROM data_facts_audit_log l
    LEFT JOIN data_disputes d ON d.id = l.dispute_id
    LEFT JOIN jurisdictions j ON j.id = COALESCE(l.jurisdiction_id, d.jurisdiction_id)
    ${whereClause}
    ORDER BY l.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const raw = ((result as unknown as { rows?: unknown[] }).rows ??
    result) as Array<Record<string, unknown>>;

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM data_facts_audit_log l
    LEFT JOIN data_disputes d ON d.id = l.dispute_id
    LEFT JOIN jurisdictions j ON j.id = COALESCE(l.jurisdiction_id, d.jurisdiction_id)
    ${whereClause}
  `);
  const countRows = ((countResult as unknown as { rows?: unknown[] }).rows ??
    countResult) as Array<Record<string, unknown>>;
  const totalCount = Number(countRows[0]?.total ?? 0);

  const rows: AuditTimelineRow[] = raw.map((r) => ({
    id: String(r.id),
    disputeId: r.dispute_id ? String(r.dispute_id) : null,
    action: String(r.action),
    actorId: String(r.actor_id),
    before: (r.before as DisputeSnapshot | null) ?? null,
    after: (r.after as DisputeSnapshot | null) ?? null,
    notes: r.notes ? String(r.notes) : null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
    factKey: r.log_fact_key ? String(r.log_fact_key) : null,
    countrySlug: r.country_slug ? String(r.country_slug) : null,
    countryName: r.country_name ? String(r.country_name) : null,
    disputeKind: r.dispute_kind ? String(r.dispute_kind) : null,
  }));

  return { rows, totalCount };
}

/**
 * Distinct actions we expect to see (for the audit-page filter chip
 * row). Fixed list rather than a SELECT DISTINCT so unused actions
 * still show as filterable chips when the table is empty.
 */
export const AUDIT_ACTION_FILTER_LABELS: Record<string, string> = {
  reviewer_decision: "Reviewer decision",
  auto_resolve_stale: "Auto-resolve (stale)",
  reopen: "Reopen",
  resolver_recompute: "Resolver recompute",
  methodology_version_bump: "Methodology version bump",
  sync_rejected: "Sync rejected",
  sync_admitted: "Sync admitted",
};
