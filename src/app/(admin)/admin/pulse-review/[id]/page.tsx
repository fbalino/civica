import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@/components/editorial/Pill";
import { SourceDot } from "@/components/SourceDot";
import {
  getPulseReviewEvent,
  getPulseReviewAuditTrail,
} from "@/lib/db/queries-pulse-review";
import { EVENT_CATEGORIES } from "@/lib/pulse/v2/taxonomy";
import { PULSE_DIMENSIONS } from "@/lib/pulse/v2/types";
import {
  categoryLabel,
  dimensionLabel,
  severityTierLabel,
  severityTierLongLabel,
  signedSeverity,
} from "@/lib/pulse/v2/labels";
import { ensurePulseSummary } from "@/lib/pulse/v2/summarize";

export const metadata: Metadata = {
  title: "Review event — Civica admin",
  robots: { index: false, follow: false },
};

const SEVERITY_TIERS = [
  "low_pos",
  "moderate_pos",
  "high_pos",
  "low_neg",
  "moderate_neg",
  "severe_neg",
  "catastrophic_neg",
] as const;

const ACTION_LABELS: Record<string, string> = {
  approve: "Approved",
  edit: "Edited + approved",
  reject: "Rejected",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Splits the raw RSS-derived description into clean paragraphs. Drops leading
 *  "- HEADLINE (Click to expand Image" boilerplate, standalone copyright /
 *  image-credit lines, and collapses blank-line runs. */
function cleanDescriptionParagraphs(raw: string, headline: string): string[] {
  if (!raw) return [];
  let text = raw;
  const lead = `- ${headline}`;
  if (text.startsWith(lead)) text = text.slice(lead.length);
  text = text.replace(/\(Click to expand Image\b/gi, "");
  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+\n/g, "\n").trim())
    .filter((p) => p.length > 0);
  return paragraphs.filter((p) => {
    if (/^©\s/.test(p)) return false;
    if (/Getty Images$/.test(p) && p.length < 220) return false;
    if (/^Click to expand /i.test(p)) return false;
    return true;
  });
}

export default async function PulseReviewDetailPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getPulseReviewEvent(id);
  if (!event) notFound();

  const auditTrail = await getPulseReviewAuditTrail(id);

  const aiSummary = await ensurePulseSummary({
    eventId: event.id,
    country: event.country.name,
    headline: event.headline,
    description: event.description,
    existingSummary: event.aiSummary,
  });

  const paragraphs = cleanDescriptionParagraphs(
    event.description,
    event.headline
  );
  const unresolved = event.category === "none";

  const severityVariant: "danger" | "success" | "warn" =
    event.severityValue < 0
      ? "danger"
      : event.severityValue > 0
      ? "success"
      : "warn";

  return (
    <>
      <nav className="admin-breadcrumbs">
        <Link href="/admin/pulse-review">Pulse review</Link>
        <span className="admin-breadcrumbs-sep" aria-hidden>
          /
        </span>
        <span>{event.country.name}</span>
      </nav>

      <header className="admin-page-head">
        <h1 className="admin-title">
          {event.country.name} — {event.headline}
        </h1>
        <p className="admin-meta">
          <span>Event date {event.eventDate}</span>
          {event.country.iso3 ? (
            <>
              <span className="admin-meta-sep">·</span>
              <span>{event.country.iso3}</span>
            </>
          ) : null}
          <span className="admin-meta-sep">·</span>
          <span>Status: {event.reviewStatus}</span>
          <span className="admin-meta-sep">·</span>
          <span>Published: {event.published ? "yes" : "no"}</span>
        </p>
        <div className="admin-cell-chips">
          <Chip>{dimensionLabel(event.dimension)}</Chip>
          <Chip variant={severityVariant}>
            {severityTierLabel(event.severityTier)} ·{" "}
            {signedSeverity(event.severityValue)}
          </Chip>
          {event.classifierAgreement === "all" ? (
            <Chip variant="success">Classifier 3/3 agree</Chip>
          ) : event.classifierAgreement === "two_of_three" ? (
            <Chip>Classifier 2/3 agree</Chip>
          ) : (
            <Chip variant="warn">Classifier no consensus</Chip>
          )}
          <Chip>
            Confidence {(event.corroborationConfidence ?? 0).toFixed(2)}
          </Chip>
          {event.pressFreedomScoreAtClassification != null ? (
            <Chip>RSF {event.pressFreedomScoreAtClassification.toFixed(0)}</Chip>
          ) : null}
        </div>
      </header>

      {aiSummary ? (
        <section className="admin-section">
          <h2 className="admin-section-title">Summary</h2>
          <div className="admin-note">{aiSummary}</div>
          <p className="admin-hint">
            AI summary · Claude Haiku · for reviewer context only
          </p>
        </section>
      ) : null}

      <section className="admin-section">
        <h2 className="admin-section-title">Source description</h2>
        <p className="admin-section-intro">Raw text from the source feed.</p>
        <div className="admin-card">
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} className="admin-prose">
                {p}
              </p>
            ))
          ) : (
            <p className="admin-prose admin-prose-muted">
              No description available.
            </p>
          )}
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Sources</h2>
        <ul className="admin-source-list">
          {event.sources.map((src, i) => (
            <li key={i} className="admin-source-item">
              <SourceDot source={src.sourceId} retrievedAt={null} />
              <strong>{src.sourceName}</strong>
              <Chip variant={src.sourceType === "specialist" ? "success" : "neutral"}>
                {src.sourceType}
              </Chip>
              {src.sourceUrl ? (
                <a
                  href={src.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-source-link"
                >
                  Read source ↗
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Classifier runs</h2>
        <p className="admin-section-intro">
          Independent reasoning passes — one classify run per model, then a
          verify (refute) pass. Each run is preserved verbatim for audit.
        </p>
        <div className="admin-runs-grid">
          {event.classifierRuns.map((run) => (
            <div key={run.run} className="admin-run-card">
              <div className="admin-run-head">
                {run.model
                  ? `${run.provider ? `${run.provider} · ` : ""}${run.model}`
                  : `Run ${run.run} · temp ${run.temp}`}
              </div>
              <div className="admin-run-category">
                {categoryLabel(run.category)}
              </div>
              <div className="admin-run-chips">
                <Chip>{dimensionLabel(run.dimension)}</Chip>
                <Chip
                  variant={
                    run.severityValue < 0
                      ? "danger"
                      : run.severityValue > 0
                      ? "success"
                      : "warn"
                  }
                >
                  {severityTierLabel(run.severityTier)} ·{" "}
                  {signedSeverity(run.severityValue)}
                </Chip>
              </div>
              {run.rationale &&
              run.rationale !== "subscription-agent classification" ? (
                <div className="admin-run-rationale">{run.rationale}</div>
              ) : (
                <div className="admin-run-rationale admin-run-rationale--empty">
                  No per-model rationale recorded (legacy classification).
                  Re-run under the current ensemble to capture each
                  model&rsquo;s reasoning.
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Decision</h2>
        <p className="admin-section-intro">
          Approve as-is, edit the classification before approving, or reject the
          event. Rejection keeps the row in the audit trail but excludes it from
          scoring.
        </p>

        <form
          action={`/api/admin/pulse-review/${event.id}`}
          method="post"
          className="admin-card"
        >
          <div className="admin-grid-form">
            <input type="hidden" name="redirect" value="/admin/pulse-review" />

            <label className="admin-field-label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={event.category}
              className="admin-select"
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            <label className="admin-field-label" htmlFor="dimension">
              Dimension
            </label>
            <select
              id="dimension"
              name="dimension"
              defaultValue={event.dimension}
              className="admin-select"
            >
              {PULSE_DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {dimensionLabel(d)}
                </option>
              ))}
            </select>

            <label className="admin-field-label" htmlFor="severityTier">
              Severity tier
            </label>
            <select
              id="severityTier"
              name="severityTier"
              defaultValue={event.severityTier}
              className="admin-select"
            >
              {SEVERITY_TIERS.map((t) => (
                <option key={t} value={t}>
                  {severityTierLongLabel(t)}
                </option>
              ))}
            </select>

            <label className="admin-field-label" htmlFor="severityValue">
              Severity value
            </label>
            <input
              id="severityValue"
              name="severityValue"
              type="number"
              min={-10}
              max={10}
              step={1}
              defaultValue={event.severityValue}
              className="admin-input"
            />

            <label className="admin-field-label" htmlFor="notes">
              Reviewer notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={event.reviewNotes ?? ""}
              placeholder="Optional rationale for the decision."
              className="admin-textarea"
            />

            <div className="admin-actions admin-actions--full">
              {unresolved ? (
                <span className="admin-hint">
                  Unresolved candidates must be edited to a valid taxonomy
                  category, dimension, severity tier, and value before
                  publication.
                </span>
              ) : (
                <button
                  type="submit"
                  name="action"
                  value="approve"
                  className="btn btn--sm admin-btn-success"
                >
                  ✓ Approve as-is
                </button>
              )}
              <button
                type="submit"
                name="action"
                value="edit"
                className="btn btn--sm admin-btn-accent"
              >
                ✎ Save edits + approve
              </button>
              <button
                type="submit"
                name="action"
                value="reject"
                className="btn btn--sm admin-btn-danger"
              >
                ✕ Reject
              </button>
            </div>
          </div>
        </form>
      </section>

      {auditTrail.length > 0 ? (
        <section className="admin-section">
          <h2 className="admin-section-title">Audit trail</h2>
          <ul className="admin-timeline">
            {auditTrail.map((entry) => (
              <li key={entry.id} className="admin-timeline-item">
                <div className="admin-timeline-meta">
                  <span className="admin-timeline-actor">
                    {entry.reviewerId}
                  </span>
                  <span>{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  <span>{formatDate(entry.createdAt)}</span>
                </div>
                {entry.notes ? (
                  <div className="admin-timeline-notes">{entry.notes}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
