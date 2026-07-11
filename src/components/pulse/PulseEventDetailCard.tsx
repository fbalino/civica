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

function severityVariant(v: number): "danger" | "success" | "warn" {
  if (v < 0) return "danger";
  if (v > 0) return "success";
  return "warn";
}

/** Strip the "- HEADLINE (Click to expand Image" lead, drop standalone
 *  © / Getty Images credit lines, render paragraphs separately. */
function cleanDescriptionParagraphs(raw: string, headline: string): string[] {
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
    event.headline,
  );
  const providerTaggedClassifyRuns = event.classifierRuns.filter(
    (run) => run.provider && run.model && !run.confidence,
  );
  const currentEnsembleShape =
    providerTaggedClassifyRuns.length >= 2 &&
    event.classifierRuns.some((run) => run.confidence !== undefined);
  const agreementLabel = currentEnsembleShape
    ? event.classifierAgreement === "all"
      ? `${providerTaggedClassifyRuns.length}/${providerTaggedClassifyRuns.length} classify consensus`
      : event.classifierAgreement === "two_of_three"
        ? `Majority classify consensus`
        : "No classify consensus"
    : event.classifierAgreement === "all"
      ? "Recorded agreement: high"
      : event.classifierAgreement === "two_of_three"
        ? "Recorded agreement: partial"
        : "Recorded agreement: unresolved";
  const unresolved = event.category === "none";

  return (
    <article id={`evt-${event.id}`} className="editorial-card pulse-event-card">
      <details className="pulse-event-accordion">
        <summary className="pulse-event-summary">
          <span className="pulse-event-summary-main">
            <span className="pulse-event-kicker">
              <span>{event.country.name}</span>
              <span>{formatEventDate(event.eventDate)}</span>
            </span>
            <span className="pulse-event-headline">{event.headline}</span>
          </span>
          <span className="editorial-card-pills pulse-event-result-pills">
            <Pill>{dimensionLabel(event.dimension)}</Pill>
            {!unresolved &&
            event.severityTier !== null &&
            event.severityValue !== null ? (
              <Pill variant={severityVariant(event.severityValue)}>
                {severityTierLabel(event.severityTier)} ·{" "}
                {signedSeverity(event.severityValue)}
              </Pill>
            ) : null}
            <Pill
              variant={
                event.classifierAgreement === "all"
                  ? "success"
                  : event.classifierAgreement === "none"
                    ? "warn"
                    : "default"
              }
            >
              {agreementLabel}
            </Pill>
            {event.publicationOrigin === "human_rejected" ? (
              <Pill variant="danger">Human rejected</Pill>
            ) : event.publicationOrigin === "legacy_rejected_unverified" ? (
              <Pill variant="warn">Rejected · origin unverified</Pill>
            ) : event.publicationOrigin === "queued" ? (
              <Pill variant="warn">Queued for review</Pill>
            ) : event.publicationOrigin === "human_edited" ? (
              <Pill variant="success">Human edited</Pill>
            ) : event.publicationOrigin === "human_approved" ? (
              <Pill variant="success">Human approved</Pill>
            ) : (
              <Pill>Auto-published</Pill>
            )}
          </span>
        </summary>

        <div className="pulse-event-expanded">
          <div className="pulse-event-actions">
            <Link href={`/country/${event.country.slug}`}>
              Open country page
            </Link>
            <a href={`#evt-${event.id}`} aria-label="Permalink to this event">
              Permalink
            </a>
          </div>

          {event.aiSummary ? (
            <div className="pulse-event-ai-summary">
              {event.aiSummary}
              <div className="pulse-event-meta-label">
                AI summary · Claude Haiku
              </div>
            </div>
          ) : null}

          {paragraphs.length > 0 ? (
            <details className="pulse-event-nested-details">
              <summary>
                Source description ({paragraphs.length} paragraph
                {paragraphs.length === 1 ? "" : "s"})
              </summary>
              <div className="pulse-event-paragraphs">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </details>
          ) : null}

          {event.sourceDetail.length > 0 ? (
            <div className="pulse-event-sources">
              {event.sourceDetail.map((src, i) => (
                <span key={i} className="pulse-event-source-chip">
                  <SourceDot source={src.sourceId} retrievedAt={null} />
                  <strong>{src.sourceName}</strong>
                  <span>{src.sourceType}</span>
                  {src.sourceUrl ? (
                    <a
                      href={src.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read ↗
                    </a>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}

          {event.classifierRuns.length > 0 ? (
            <details className="pulse-event-nested-details">
              <summary>
                Classifier runs ({event.classifierRuns.length} passes)
              </summary>
              <div className="pulse-event-classifier-grid">
                {event.classifierRuns.map((run) => (
                  <div key={run.run} className="pulse-event-classifier-run">
                    <div className="pulse-event-meta-label">
                      {run.model
                        ? `${run.provider ? `${run.provider} · ` : ""}${run.model}`
                        : `Run ${run.run} · temp ${run.temp}`}
                    </div>
                    <div className="pulse-event-classifier-category">
                      {categoryLabel(run.category)}
                    </div>
                    <div className="pulse-event-classifier-pills">
                      <Pill>{dimensionLabel(run.dimension)}</Pill>
                      <Pill variant={severityVariant(run.severityValue)}>
                        {severityTierLabel(run.severityTier)} ·{" "}
                        {signedSeverity(run.severityValue)}
                      </Pill>
                    </div>
                    <div className="pulse-event-rationale">{run.rationale}</div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          <footer className="editorial-card-foot">
            <span>
              Corroboration weight{" "}
              {(event.corroborationConfidence ?? 0).toFixed(2)} · heuristic, not
              a probability
              {event.legacyInformationContextPresent
                ? " · legacy unversioned context retained for audit"
                : ""}
            </span>
            <span>
              {unresolved
                ? "Unresolved candidate"
                : categoryLabel(event.category)}
            </span>
          </footer>
        </div>
      </details>
    </article>
  );
}
