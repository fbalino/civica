import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Pill } from "@/components/editorial/Pill";
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

/** Splits the raw RSS-derived description into clean paragraphs.
 *  Drops the leading "- HEADLINE (Click to expand Image" boilerplate
 *  some HRW feed items emit, drops standalone copyright lines and
 *  image-credit lines, and collapses runs of blank lines. The result
 *  is rendered as separate <p> elements for readability. */
function cleanDescriptionParagraphs(
  raw: string,
  headline: string
): string[] {
  if (!raw) return [];
  let text = raw;
  // Some feeds prefix a "- HEADLINE (Click to expand Image" line.
  const lead = `- ${headline}`;
  if (text.startsWith(lead)) text = text.slice(lead.length);
  text = text.replace(/\(Click to expand Image\b/gi, "");
  // Normalise newlines + collapse 3+ blanks to a paragraph break.
  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+\n/g, "\n").trim())
    .filter((p) => p.length > 0);
  return paragraphs.filter((p) => {
    // Drop standalone image credits + copyright artifacts.
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

  // Lazy-generate the AI summary on first view. If generation fails
  // we fall back to rendering just the cleaned raw description.
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

  const severityVariant: "danger" | "success" | "warn" =
    event.severityValue < 0
      ? "danger"
      : event.severityValue > 0
      ? "success"
      : "warn";

  return (
    <EditorialPage width="wide">
      <nav className="editorial-breadcrumbs">
        <Link href="/admin/pulse-review">/ admin</Link>
        <span aria-hidden> / </span>
        <Link href="/admin/pulse-review">Pulse review</Link>
        <span aria-hidden> / </span>
        <span style={{ color: "var(--color-text-60)" }}>
          {event.country.name}
        </span>
      </nav>

      <h1
        className="editorial-page-title"
        style={{ fontSize: "var(--text-32)" }}
      >
        {event.country.name} — {event.headline}
      </h1>

      <p className="editorial-page-meta" style={{ marginBottom: 16 }}>
        <span>Event date {event.eventDate}</span>
        <span>·</span>
        <span>Country: {event.country.name}</span>
        {event.country.iso3 ? (
          <>
            <span>·</span>
            <span>{event.country.iso3}</span>
          </>
        ) : null}
        <span>·</span>
        <span>Status: {event.reviewStatus}</span>
        <span>·</span>
        <span>Published: {event.published ? "yes" : "no"}</span>
      </p>

      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}
      >
        <Pill>{dimensionLabel(event.dimension)}</Pill>
        <Pill variant={severityVariant}>
          {severityTierLabel(event.severityTier)} ·{" "}
          {signedSeverity(event.severityValue)}
        </Pill>
        {event.classifierAgreement === "all" ? (
          <Pill variant="success">Classifier 3/3 agree</Pill>
        ) : event.classifierAgreement === "two_of_three" ? (
          <Pill>Classifier 2/3 agree</Pill>
        ) : (
          <Pill variant="warn">Classifier no consensus</Pill>
        )}
        <Pill>
          Confidence {(event.corroborationConfidence ?? 0).toFixed(2)}
        </Pill>
        {event.pressFreedomScoreAtClassification != null ? (
          <Pill>
            RSF {event.pressFreedomScoreAtClassification.toFixed(0)}
          </Pill>
        ) : null}
      </div>

      {aiSummary ? (
        <section className="editorial-section">
          <h2>Summary</h2>
          <div
            style={{
              background: "var(--color-card-bg)",
              border: "1px solid var(--color-card-border)",
              borderLeft: "3px solid var(--color-accent)",
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              fontSize: "var(--text-15)",
              lineHeight: 1.6,
              color: "var(--color-text-primary)",
            }}
          >
            {aiSummary}
          </div>
          <p
            style={{
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-40)",
            }}
          >
            AI summary · Claude Haiku · for reviewer context only
          </p>
        </section>
      ) : null}

      <section className="editorial-section">
        <h2>Source description</h2>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-12)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-text-40)",
            marginBottom: 12,
          }}
        >
          Raw text from the source feed
        </p>
        <div
          style={{
            display: "grid",
            gap: 12,
            fontSize: "var(--text-15)",
            lineHeight: 1.65,
            color: "var(--color-text-primary)",
          }}
        >
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} style={{ margin: 0 }}>
                {p}
              </p>
            ))
          ) : (
            <p style={{ margin: 0, color: "var(--color-text-40)" }}>
              No description available.
            </p>
          )}
        </div>
      </section>

      <section className="editorial-section">
        <h2>Sources</h2>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 8,
          }}
        >
          {event.sources.map((src, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                background: "var(--color-card-bg)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                fontSize: "var(--text-15)",
              }}
            >
              <SourceDot source={src.sourceId} retrievedAt={null} />
              <strong style={{ color: "var(--color-text-primary)" }}>
                {src.sourceName}
              </strong>
              <Pill variant={src.sourceType === "specialist" ? "success" : undefined}>
                {src.sourceType}
              </Pill>
              {src.sourceUrl ? (
                <a
                  href={src.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-13)",
                    letterSpacing: "0.04em",
                    color: "var(--color-accent)",
                  }}
                >
                  Read source ↗
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="editorial-section">
        <h2>Classifier runs</h2>
        <p>
          Three independent passes at temperatures 0.0, 0.4, and 0.8.
          Per-run output is preserved verbatim for audit.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          {event.classifierRuns.map((run) => (
            <div
              key={run.run}
              style={{
                background: "var(--color-card-bg)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-40)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Run {run.run} · temp {run.temp}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-15)",
                  color: "var(--color-text-primary)",
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                {categoryLabel(run.category)}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <Pill>{dimensionLabel(run.dimension)}</Pill>
                <Pill
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
                </Pill>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-60)",
                  lineHeight: 1.55,
                }}
              >
                {run.rationale}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="editorial-section">
        <h2>Decision</h2>
        <p>
          Approve as-is, edit the classification before approving, or
          reject the event. Rejection keeps the row in the audit trail
          but excludes it from scoring.
        </p>

        <form
          action={`/api/admin/pulse-review/${event.id}`}
          method="post"
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 12,
            alignItems: "center",
            background: "var(--color-card-bg)",
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-md)",
            padding: 20,
            marginTop: 16,
          }}
        >
          <input
            type="hidden"
            name="redirect"
            value="/admin/pulse-review"
          />

          <label htmlFor="category" style={labelStyle}>
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={event.category}
            style={inputStyle}
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <label htmlFor="dimension" style={labelStyle}>
            Dimension
          </label>
          <select
            id="dimension"
            name="dimension"
            defaultValue={event.dimension}
            style={inputStyle}
          >
            {PULSE_DIMENSIONS.map((d) => (
              <option key={d} value={d}>
                {dimensionLabel(d)}
              </option>
            ))}
          </select>

          <label htmlFor="severityTier" style={labelStyle}>
            Severity tier
          </label>
          <select
            id="severityTier"
            name="severityTier"
            defaultValue={event.severityTier}
            style={inputStyle}
          >
            {SEVERITY_TIERS.map((t) => (
              <option key={t} value={t}>
                {severityTierLongLabel(t)}
              </option>
            ))}
          </select>

          <label htmlFor="severityValue" style={labelStyle}>
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
            style={inputStyle}
          />

          <label htmlFor="notes" style={labelStyle}>
            Reviewer notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={event.reviewNotes ?? ""}
            placeholder="Optional rationale for the decision."
            style={{
              ...inputStyle,
              resize: "vertical",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-14)",
            }}
          />

          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            <button
              type="submit"
              name="action"
              value="approve"
              style={{
                ...buttonBase,
                borderColor: "var(--tier-strong)",
                background:
                  "color-mix(in oklch, var(--tier-strong) 16%, var(--color-page-bg) 84%)",
              }}
            >
              ✓ Approve as-is
            </button>
            <button
              type="submit"
              name="action"
              value="edit"
              style={{
                ...buttonBase,
                borderColor: "var(--color-accent)",
                background:
                  "color-mix(in oklch, var(--color-accent) 14%, var(--color-page-bg) 86%)",
              }}
            >
              ✎ Save edits + approve
            </button>
            <button
              type="submit"
              name="action"
              value="reject"
              style={{
                ...buttonBase,
                borderColor: "var(--tier-failed)",
                background:
                  "color-mix(in oklch, var(--tier-failed) 14%, var(--color-page-bg) 86%)",
              }}
            >
              ✕ Reject
            </button>
          </div>
        </form>
      </section>

      {auditTrail.length > 0 ? (
        <section className="editorial-section">
          <h2>Audit trail</h2>
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {auditTrail.map((entry) => (
              <li
                key={entry.id}
                style={{
                  background: "var(--color-card-bg)",
                  border: "1px solid var(--color-card-border)",
                  borderRadius: "var(--radius-md)",
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-40)",
                    letterSpacing: "0.05em",
                    marginBottom: 4,
                  }}
                >
                  <span>
                    <strong style={{ color: "var(--color-text-primary)" }}>
                      {entry.reviewerId}
                    </strong>{" "}
                    · {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span>{formatDate(entry.createdAt)}</span>
                </div>
                {entry.notes ? (
                  <p
                    style={{
                      margin: "4px 0",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-14)",
                      color: "var(--color-text-60)",
                      lineHeight: 1.5,
                    }}
                  >
                    {entry.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </EditorialPage>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-12)",
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-40)",
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-13)",
  border: "1px solid var(--color-card-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-page-bg)",
  color: "var(--color-text-primary)",
};

const buttonBase: React.CSSProperties = {
  padding: "8px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-13)",
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  border: "1px solid",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)",
  cursor: "pointer",
};
