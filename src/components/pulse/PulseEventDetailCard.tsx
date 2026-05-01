/**
 * Phase 5.10 polish — public-facing event card with full detail.
 *
 * Renders the same content as `/admin/pulse-review/[id]` minus the
 * decision form. Used on `/civica-index/pulse-changelog` so reviewers
 * and the public see the same evidence — full transparency.
 *
 * Each card has `id={`evt-${event.id}`}` so per-driving-event links
 * from country panels can deep-link via `#evt-...`.
 */

import Link from "next/link";
import { Pill } from "@/components/editorial/Pill";
import { SourceDot } from "@/components/SourceDot";
import {
  categoryLabel,
  dimensionLabel,
  severityTierLabel,
  signedSeverity,
} from "@/lib/pulse/v2/labels";
import type { PulseV2ChangelogRow } from "@/lib/db/queries-pulse-v2";

function formatEventDate(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function severityVariant(
  v: number
): "danger" | "success" | "warn" {
  if (v < 0) return "danger";
  if (v > 0) return "success";
  return "warn";
}

/** Strip the "- HEADLINE (Click to expand Image" lead, drop standalone
 *  © / Getty Images credit lines, render paragraphs separately. */
function cleanDescriptionParagraphs(
  raw: string,
  headline: string
): string[] {
  if (!raw) return [];
  let text = raw;
  const lead = `- ${headline}`;
  if (text.startsWith(lead)) text = text.slice(lead.length);
  text = text.replace(/\(Click to expand Image\b/gi, "");
  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return text
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+\n/g, "\n").trim())
    .filter((p) => {
      if (p.length === 0) return false;
      if (/^©\s/.test(p)) return false;
      if (/Getty Images$/.test(p) && p.length < 220) return false;
      if (/^Click to expand /i.test(p)) return false;
      return true;
    });
}

export function PulseEventDetailCard({
  event,
}: {
  event: PulseV2ChangelogRow;
}) {
  const paragraphs = cleanDescriptionParagraphs(
    event.description,
    event.headline
  );

  return (
    <article
      id={`evt-${event.id}`}
      className="editorial-card"
      style={{ scrollMarginTop: 80 }}
    >
      <header className="editorial-card-head">
        <div className="editorial-card-head-left">
          <Link
            href={`/countries/${event.country.slug}`}
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-16)",
              fontWeight: 500,
              color: "var(--color-text-primary)",
              textDecoration: "none",
            }}
          >
            {event.country.name}
          </Link>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-40)",
              letterSpacing: "0.05em",
            }}
          >
            {formatEventDate(event.eventDate)}
          </span>
          <a
            href={`#evt-${event.id}`}
            aria-label="Permalink to this event"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-40)",
              letterSpacing: "0.05em",
              textDecoration: "none",
              opacity: 0.5,
            }}
          >
            #
          </a>
        </div>
        <div className="editorial-card-pills">
          <Pill>{dimensionLabel(event.dimension)}</Pill>
          <Pill variant={severityVariant(event.severityValue)}>
            {severityTierLabel(event.severityTier)} ·{" "}
            {signedSeverity(event.severityValue)}
          </Pill>
          {event.classifierAgreement === "all" ? (
            <Pill variant="success">3/3 agree</Pill>
          ) : event.classifierAgreement === "two_of_three" ? (
            <Pill>2/3 agree</Pill>
          ) : (
            <Pill variant="warn">No consensus</Pill>
          )}
          {!event.published ? (
            <Pill variant="warn">Queued for review</Pill>
          ) : null}
        </div>
      </header>

      <h3 className="editorial-card-headline">{event.headline}</h3>

      {/* AI summary — same shape as admin review surface */}
      {event.aiSummary ? (
        <div
          style={{
            background: "var(--color-card-bg)",
            border: "1px solid var(--color-card-border)",
            borderLeft: "3px solid var(--color-accent)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            margin: "12px 0 16px",
            fontSize: "var(--text-14)",
            lineHeight: 1.6,
            color: "var(--color-text-primary)",
          }}
        >
          {event.aiSummary}
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-10)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-40)",
            }}
          >
            AI summary · Claude Haiku
          </div>
        </div>
      ) : null}

      {/* Source description — collapsible if long */}
      {paragraphs.length > 0 ? (
        <details style={{ marginBottom: 16 }}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-40)",
              padding: "6px 0",
            }}
          >
            Source description ({paragraphs.length} paragraph
            {paragraphs.length === 1 ? "" : "s"})
          </summary>
          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 8,
              paddingLeft: 12,
              borderLeft: "2px solid var(--color-card-border)",
              fontSize: "var(--text-13)",
              lineHeight: 1.6,
              color: "var(--color-text-60)",
            }}
          >
            {paragraphs.map((p, i) => (
              <p key={i} style={{ margin: 0 }}>
                {p}
              </p>
            ))}
          </div>
        </details>
      ) : null}

      {/* Sources */}
      {event.sourceDetail.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {event.sourceDetail.map((src, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                background: "var(--color-card-bg)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-12)",
              }}
            >
              <SourceDot source={src.sourceId} retrievedAt={null} />
              <strong style={{ color: "var(--color-text-primary)" }}>
                {src.sourceName}
              </strong>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-10)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-text-40)",
                }}
              >
                {src.sourceType}
              </span>
              {src.sourceUrl ? (
                <a
                  href={src.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--color-accent)",
                    fontSize: "var(--text-11)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.04em",
                    textDecoration: "none",
                  }}
                >
                  Read ↗
                </a>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      {/* Classifier runs — collapsible audit trail */}
      {event.classifierRuns.length > 0 ? (
        <details style={{ marginBottom: 8 }}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-40)",
              padding: "6px 0",
            }}
          >
            Classifier runs ({event.classifierRuns.length} passes)
          </summary>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
              marginTop: 10,
            }}
          >
            {event.classifierRuns.map((run) => (
              <div
                key={run.run}
                style={{
                  background: "var(--color-card-bg)",
                  border: "1px solid var(--color-card-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-10)",
                    color: "var(--color-text-40)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Run {run.run} · temp {run.temp}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-13)",
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    marginBottom: 4,
                  }}
                >
                  {categoryLabel(run.category)}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  <Pill>{dimensionLabel(run.dimension)}</Pill>
                  <Pill variant={severityVariant(run.severityValue)}>
                    {severityTierLabel(run.severityTier)} ·{" "}
                    {signedSeverity(run.severityValue)}
                  </Pill>
                </div>
                <div
                  style={{
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-60)",
                    lineHeight: 1.55,
                  }}
                >
                  {run.rationale}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <footer className="editorial-card-foot">
        <span>
          Confidence{" "}
          {(event.corroborationConfidence ?? 0).toFixed(2)}
          {event.pressFreedomScoreAtClassification != null
            ? ` · RSF ${event.pressFreedomScoreAtClassification.toFixed(0)}`
            : ""}
        </span>
        <span>
          {categoryLabel(event.category)}
        </span>
      </footer>
    </article>
  );
}
