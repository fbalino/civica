/**
 * Phase F.5 — operator data-dispute detail + resolution form.
 *
 * Two columns side-by-side showing fact A vs fact B with their full
 * provenance metadata. Resolution form below offers four actions:
 *   - Resolve: A wins
 *   - Resolve: B wins
 *   - Hold (no change)
 *   - Reject as invalid
 *
 * Each action POSTs to /api/admin/data-disputes/[id], updating
 * `data_disputes.status` + reviewer fields and recording
 * resolved_at + reviewer notes. Note: this surface ONLY records the
 * review decision; the resolver continues to compute canonical picks
 * via methodology rules. A future extension can add explicit
 * `country_facts.status='demoted'` writes from "A wins" / "B wins"
 * to pin the choice durably.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §7
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Pill } from "@/components/editorial/Pill";
import { getDataDispute } from "@/lib/db/queries-data-disputes";

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
  rejected_invalid: "Rejected as invalid",
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

function formatFactValue(
  fact: {
    factValue: string | null;
    factValueNumeric: number | null;
    factUnit: string | null;
  } | null,
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
    <div className="editorial-card" style={{ margin: 0 }}>
      <header className="editorial-card-head">
        <div className="editorial-card-head-left">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-text-30)",
            }}
          >
            Fact {label}
          </span>
          <Pill>{fact?.sourceId ?? "—"}</Pill>
        </div>
      </header>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-32, 28px)",
          color: "var(--color-text-primary)",
          margin: "12px 0 8px",
          lineHeight: 1.1,
        }}
      >
        {formatFactValue(fact)}
      </div>
      {fact?.asOf || fact?.factYear ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-40)",
          }}
        >
          {fact?.asOf ? `as of ${fact.asOf}` : null}
          {fact?.asOf && fact?.factYear ? " · " : null}
          {fact?.factYear ? `year ${fact.factYear}` : null}
        </div>
      ) : null}
      {fact?.factValue && fact.factValueNumeric !== null ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-11)",
            color: "var(--color-text-30)",
            marginTop: 8,
            wordBreak: "break-word",
          }}
        >
          raw: {fact.factValue}
        </div>
      ) : null}
    </div>
  );
}

export default async function DataDisputeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const dispute = await getDataDispute(id);
  if (!dispute) notFound();

  const isResolved = dispute.status.startsWith("resolved_") ||
    dispute.status === "rejected_invalid";

  return (
    <EditorialPage width="wide">
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/admin/data-disputes"
          className="editorial-page-meta"
          style={{ color: "var(--color-text-40)" }}
        >
          ← All disputes
        </Link>
      </div>

      <h1 className="editorial-page-title">
        {dispute.country.name} · {dispute.factKey}
      </h1>
      <p className="editorial-page-subtitle">
        {dispute.description ??
          `${KIND_LABELS[dispute.disputeKind] ?? "Dispute"} flagged for review.`}
      </p>

      <div
        className="editorial-page-meta"
        style={{ marginBottom: 24, gap: 12, flexWrap: "wrap" }}
      >
        <Pill>{KIND_LABELS[dispute.disputeKind] ?? dispute.disputeKind}</Pill>
        <Pill>{`Group ${dispute.factGroup}`}</Pill>
        <Pill
          variant={
            isResolved ? "default" : dispute.status === "in_review" ? "accent" : "warn"
          }
        >
          {STATUS_LABELS[dispute.status] ?? dispute.status}
        </Pill>
        <span>Created {formatDate(dispute.createdAt)}</span>
        {dispute.proposedAction ? (
          <span>· Proposed: {dispute.proposedAction}</span>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <FactColumn label="A" fact={dispute.factA} />
        <FactColumn label="B" fact={dispute.factB} />
      </div>

      {dispute.submitterName || dispute.submitterAffiliation ? (
        <section className="editorial-section" style={{ marginBottom: 24 }}>
          <h2 className="editorial-section-title">Submitter</h2>
          <p>
            {dispute.submitterName ?? "anonymous"}
            {dispute.submitterAffiliation
              ? ` · ${dispute.submitterAffiliation}`
              : ""}
            {dispute.submitterEmail ? ` · ${dispute.submitterEmail}` : ""}
          </p>
        </section>
      ) : null}

      {isResolved ? (
        <section className="editorial-section" style={{ marginBottom: 24 }}>
          <h2 className="editorial-section-title">Resolution</h2>
          <p>
            <strong>{STATUS_LABELS[dispute.status] ?? dispute.status}</strong>
            {dispute.resolvedAt ? ` · ${formatDate(dispute.resolvedAt)}` : ""}
            {dispute.reviewerId ? ` · by ${dispute.reviewerId}` : ""}
          </p>
          {dispute.resolutionAction ? (
            <p style={{ color: "var(--color-text-60)" }}>
              Action: {dispute.resolutionAction}
            </p>
          ) : null}
          {dispute.reviewerNotes ? (
            <p style={{ color: "var(--color-text-60)" }}>
              Notes: {dispute.reviewerNotes}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="editorial-section" style={{ marginBottom: 24 }}>
          <h2 className="editorial-section-title">Resolve</h2>
          <p style={{ color: "var(--color-text-60)", marginBottom: 16 }}>
            Recording your decision sets <code>data_disputes.status</code>,
            stamps <code>resolved_at</code>, and writes your reviewer ID +
            notes. Per F.5 v1, the resolver continues to compute canonical
            picks via methodology rules — manual pinning of canonical
            <code>country_facts</code> rows is left as a follow-up.
          </p>
          <form
            method="POST"
            action={`/api/admin/data-disputes/${dispute.id}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-40)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Reviewer notes
              </span>
              <textarea
                name="notes"
                rows={4}
                placeholder="Optional — e.g. 'Wikidata 2024 figure preferred; CIA prose appears to be 2017-vintage.'"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-14)",
                  padding: "10px 12px",
                  border: "1px solid var(--color-card-border)",
                  borderRadius: "var(--radius-sm, 4px)",
                  background: "var(--color-bg)",
                  color: "var(--color-text-primary)",
                  resize: "vertical",
                }}
              />
            </label>

            <input
              type="hidden"
              name="redirect"
              value="/admin/data-disputes"
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="submit"
                name="action"
                value="resolve_a"
                disabled={!dispute.factA}
                className="editorial-button"
                style={{ background: "var(--color-success, #2c8f3f)" }}
              >
                Resolve · A wins
              </button>
              <button
                type="submit"
                name="action"
                value="resolve_b"
                disabled={!dispute.factB}
                className="editorial-button"
                style={{ background: "var(--color-success, #2c8f3f)" }}
              >
                Resolve · B wins
              </button>
              <button
                type="submit"
                name="action"
                value="hold"
                className="editorial-button"
              >
                Hold (no change)
              </button>
              <button
                type="submit"
                name="action"
                value="reject"
                className="editorial-button"
                style={{ background: "var(--color-danger, #b94328)" }}
              >
                Reject as invalid
              </button>
            </div>
          </form>
        </section>
      )}
    </EditorialPage>
  );
}
