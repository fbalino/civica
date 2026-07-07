/**
 * Operator data-dispute detail + resolution form.
 *
 * Two columns show fact A vs fact B with full provenance. The resolution form
 * offers Resolve A / Resolve B / Hold / Reject (and Reopen on resolved rows),
 * each POSTing to `/api/admin/data-disputes/[id]` — which updates
 * `data_disputes.status`, stamps `resolved_at`, records the reviewer, and
 * writes a `data_facts_audit_log` row. Auth + semantics unchanged.
 *
 * Methodology:
 *   - Phase F.5: ~/civica/plan/phase-f-methodology-v0.1.md §7
 *   - R.21: ~/civica/plan/disputes-triage-resolution-v1.md §2b + §2c
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@/components/editorial/Pill";
import { getDataDispute } from "@/lib/db/queries-data-disputes";
import { getAuditLogForDispute } from "@/lib/factbook/reconcile/dispute-audit-log";
import {
  formatSeverity,
  type SeverityBucket,
  type SeverityScore,
} from "@/lib/factbook/reconcile/dispute-severity";

export const metadata: Metadata = {
  title: "Dispute detail — Civica admin",
  robots: { index: false, follow: false },
};

const KIND_LABELS: Record<string, string> = {
  material_error: "Material error",
  plausibility_envelope: "Envelope reject",
  group_a_override: "Group A override",
  group_c_override: "Group C override",
  rank_demoted: "Rank demoted",
  public_correction: "Public correction",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_review: "In review",
  resolved_a_wins: "Resolved · A wins",
  resolved_b_wins: "Resolved · B wins",
  resolved_held: "Resolved · held",
  resolved_auto_stale: "Resolved · auto (stale)",
  rejected_invalid: "Rejected as invalid",
};

const SEVERITY_VARIANT: Record<
  SeverityBucket,
  "neutral" | "accent" | "success" | "warn" | "danger"
> = {
  lo: "neutral",
  mid: "warn",
  hi: "danger",
  xhi: "danger",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  reviewer_decision: "Reviewer decision",
  auto_resolve_stale: "Auto-resolved (stale)",
  reopen: "Reopened",
  resolver_recompute: "Resolver recompute",
  methodology_version_bump: "Methodology bump",
  sync_rejected: "Sync rejected",
  sync_admitted: "Sync admitted",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFactValue(
  fact: {
    factValue: string | null;
    factValueNumeric: number | null;
    factUnit: string | null;
  } | null
): string {
  if (!fact) return "—";
  if (fact.factValueNumeric !== null) {
    const formatted = fact.factValueNumeric.toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
    return fact.factUnit ? `${formatted} ${fact.factUnit}` : formatted;
  }
  return fact.factValue ?? "—";
}

function severityBadgeVariant(score: SeverityScore) {
  if (score.bucket == null) return "neutral" as const;
  return SEVERITY_VARIANT[score.bucket];
}

function FactColumn({
  label,
  fact,
}: {
  label: "A" | "B";
  fact:
    | {
        sourceId: string;
        factValue: string | null;
        factValueNumeric: number | null;
        factUnit: string | null;
        factYear: number | null;
        asOf: string | null;
      }
    | null;
}) {
  return (
    <div className="admin-card">
      <p className="admin-eyebrow">Fact {label}</p>
      <div className="admin-fact-value">{formatFactValue(fact)}</div>
      <div className="admin-cell-chips">
        <Chip>{fact?.sourceId ?? "—"}</Chip>
      </div>
      {fact?.asOf || fact?.factYear ? (
        <p className="admin-fact-note">
          {fact?.asOf ? `as of ${fact.asOf}` : null}
          {fact?.asOf && fact?.factYear ? " · " : null}
          {fact?.factYear ? `year ${fact.factYear}` : null}
        </p>
      ) : null}
    </div>
  );
}

export default async function DataDisputeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const dispute = await getDataDispute(id);
  if (!dispute) notFound();

  const auditTrail = await getAuditLogForDispute(id);

  const isResolved =
    dispute.status.startsWith("resolved_") ||
    dispute.status === "rejected_invalid";

  return (
    <>
      <Link href="/admin/data-disputes" className="admin-back-link">
        ← All disputes
      </Link>

      <header className="admin-page-head">
        <h1 className="admin-title">
          {dispute.country.name} · {dispute.factKey}
        </h1>
        <p className="admin-subtitle">
          {dispute.description ??
            `${
              KIND_LABELS[dispute.disputeKind] ?? "Dispute"
            } flagged for review.`}
        </p>
        <p className="admin-meta">
          <Chip variant={KIND_VARIANTof(dispute.disputeKind)}>
            {KIND_LABELS[dispute.disputeKind] ?? dispute.disputeKind}
          </Chip>
          <Chip>{`Group ${dispute.factGroup}`}</Chip>
          {dispute.severity.severity != null ? (
            <Chip variant={severityBadgeVariant(dispute.severity)}>
              {formatSeverity(dispute.severity)}
            </Chip>
          ) : null}
          <Chip
            variant={
              isResolved
                ? "neutral"
                : dispute.status === "in_review"
                ? "accent"
                : "warn"
            }
          >
            {STATUS_LABELS[dispute.status] ?? dispute.status}
          </Chip>
          {dispute.autoResolveEligible ? (
            <Chip variant="accent">Auto-resolve eligible</Chip>
          ) : null}
          <span className="admin-meta-sep">·</span>
          <span>Created {formatDate(dispute.createdAt)}</span>
          {dispute.proposedAction ? (
            <span>· Proposed: {dispute.proposedAction}</span>
          ) : null}
        </p>
      </header>

      {dispute.autoResolveEligible && dispute.autoResolveNote ? (
        <div className="admin-note">
          <strong>Note —</strong> {dispute.autoResolveNote}. The next
          auto-resolve cron run (daily at 02:30 UTC) will close this dispute as{" "}
          <code>resolved_auto_stale</code>. Manual resolution remains available
          and is preserved in the audit trail; pick whichever action best
          reflects the editorial record you want.
        </div>
      ) : null}

      <section className="admin-section">
        <h2 className="admin-section-title">Sources in conflict</h2>
        <div className="admin-grid-2">
          <FactColumn label="A" fact={dispute.factA} />
          <FactColumn label="B" fact={dispute.factB} />
        </div>
      </section>

      {dispute.reviewerNotes ? (
        <section className="admin-section">
          <h2 className="admin-section-title">Reviewer note</h2>
          <div className="admin-note">
            <p className="admin-prose">{dispute.reviewerNotes}</p>
            {dispute.reviewerId ? (
              <p className="admin-prose admin-prose-muted">
                — {dispute.reviewerId}
                {dispute.resolvedAt ? ` · ${formatDate(dispute.resolvedAt)}` : ""}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {dispute.submitterName || dispute.submitterAffiliation ? (
        <section className="admin-section">
          <h2 className="admin-section-title">Submitter</h2>
          <div className="admin-card">
            <p className="admin-prose">
              {dispute.submitterName ?? "anonymous"}
              {dispute.submitterAffiliation
                ? ` · ${dispute.submitterAffiliation}`
                : ""}
              {dispute.submitterEmail ? ` · ${dispute.submitterEmail}` : ""}
            </p>
          </div>
        </section>
      ) : null}

      {isResolved ? (
        <section className="admin-section">
          <h2 className="admin-section-title">Resolution</h2>
          <div className="admin-card">
            <p className="admin-prose">
              <strong>
                {STATUS_LABELS[dispute.status] ?? dispute.status}
              </strong>
              {dispute.resolvedAt ? ` · ${formatDate(dispute.resolvedAt)}` : ""}
              {dispute.reviewerId ? ` · by ${dispute.reviewerId}` : ""}
            </p>
            {dispute.resolutionAction ? (
              <p className="admin-prose admin-prose-muted">
                Action: {dispute.resolutionAction}
              </p>
            ) : null}
            {dispute.reviewerNotes ? (
              <p className="admin-prose admin-prose-muted">
                Reviewer note shown above.
              </p>
            ) : null}

            <form
              method="POST"
              action={`/api/admin/data-disputes/${dispute.id}`}
              className="admin-actions"
            >
              <input
                type="hidden"
                name="redirect"
                value={`/admin/data-disputes/${dispute.id}`}
              />
              <input type="hidden" name="action" value="reopen" />
              <button type="submit" className="btn btn--secondary btn--sm">
                Reopen this dispute
              </button>
            </form>
            <p className="admin-hint">
              Reopen flips the status back to <code>open</code>, preserves
              reviewer notes for history, and writes a <code>reopen</code>{" "}
              audit-log row.
            </p>
          </div>
        </section>
      ) : (
        <section className="admin-section">
          <h2 className="admin-section-title">Resolve</h2>
          <p className="admin-section-intro">
            Recording your decision sets <code>data_disputes.status</code>,
            stamps <code>resolved_at</code>, writes your reviewer ID + notes,
            and inserts a <code>data_facts_audit_log</code> row. Per F.5 v1 the
            resolver keeps computing canonical picks for <code>hold</code> /{" "}
            <code>reject</code>; <code>resolve_a</code> / <code>resolve_b</code>{" "}
            demote the losing rows so the resolver returns the chosen value on
            next read.
          </p>
          <form
            method="POST"
            action={`/api/admin/data-disputes/${dispute.id}`}
            className="admin-form"
          >
            <div className="admin-field">
              <label className="admin-field-label" htmlFor="notes">
                Reviewer notes
              </label>
              <textarea
                id="notes"
                className="admin-textarea"
                name="notes"
                rows={4}
                placeholder="Optional — e.g. 'Wikidata 2024 figure preferred; CIA prose appears to be 2017-vintage.'"
              />
            </div>

            <input type="hidden" name="redirect" value="/admin/data-disputes" />

            <div className="admin-actions">
              <button
                type="submit"
                name="action"
                value="resolve_a"
                disabled={!dispute.factA}
                className="btn btn--sm admin-btn-success"
              >
                Resolve · A wins
              </button>
              <button
                type="submit"
                name="action"
                value="resolve_b"
                disabled={!dispute.factB}
                className="btn btn--sm admin-btn-success"
              >
                Resolve · B wins
              </button>
              <button
                type="submit"
                name="action"
                value="hold"
                className="btn btn--secondary btn--sm"
              >
                Hold (no change)
              </button>
              <button
                type="submit"
                name="action"
                value="reject"
                className="btn btn--sm admin-btn-danger"
              >
                Reject as invalid
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-section">
        <h2 className="admin-section-title">Audit history</h2>
        {auditTrail.length === 0 ? (
          <p className="admin-section-intro">
            No audit entries yet. The audit log starts at 2026-05-05 (R.21
            wiring); pre-R.21 reviewer decisions are recoverable from the
            resolution metadata above.
          </p>
        ) : (
          <ul className="admin-timeline">
            {auditTrail.map((row) => (
              <li key={row.id} className="admin-timeline-item">
                <div className="admin-timeline-meta">
                  <span>{formatDateTime(row.createdAt)}</span>
                  <span className="admin-timeline-actor">{row.actorId}</span>
                </div>
                <div className="admin-timeline-headline">
                  <strong>
                    {AUDIT_ACTION_LABELS[row.action] ?? row.action}
                  </strong>
                  {row.before && row.after
                    ? `: ${row.before.status} → ${row.after.status}`
                    : ""}
                </div>
                {row.notes ? (
                  <div className="admin-timeline-notes">{row.notes}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

const KIND_VARIANT_MAP: Record<
  string,
  "neutral" | "accent" | "success" | "warn" | "danger"
> = {
  material_error: "danger",
  plausibility_envelope: "warn",
  group_a_override: "warn",
  group_c_override: "warn",
  rank_demoted: "neutral",
  public_correction: "accent",
  other: "neutral",
};

function KIND_VARIANTof(
  kind: string
): "neutral" | "accent" | "success" | "warn" | "danger" {
  return KIND_VARIANT_MAP[kind] ?? "neutral";
}
