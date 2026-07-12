import { Chip } from "@/components/editorial/Pill";
import type { PulseCodingSubmissionEnvelope } from "@/lib/pulse/v2/coding-workspace";

export function SubmissionSummary({ submission, label }: { submission: PulseCodingSubmissionEnvelope; label: string }) {
  return (
    <article className="admin-card coding-submission-summary">
      <div className="coding-builder-head">
        <div>
          <p className="admin-eyebrow">{label}</p>
          <h2 className="admin-section-title">{submission.coderId}</h2>
        </div>
        <Chip variant="success">Locked</Chip>
      </div>
      <dl className="admin-kv">
        <dt>Outcome</dt><dd>{submission.answer.packetOutcome.replaceAll("_", " ")}</dd>
        <dt>Observation</dt><dd>{submission.answer.observationState.replaceAll("_", " ")}</dd>
        <dt>Rationale</dt><dd>{submission.answer.observationRationale}</dd>
        <dt>Events</dt><dd>{submission.answer.events.length}</dd>
        <dt>Candidates</dt><dd>{submission.answer.candidateEvents.length}</dd>
      </dl>
      {submission.answer.events.map((event) => (
        <section className="coding-summary-event" key={event.eventId}>
          <h3 className="coding-subheading">{event.eventId}</h3>
          <p className="admin-fact-note">{event.eventDate} · {event.retrievalStatus.replaceAll("_", " ")}</p>
          {event.annotation.labels.map((assertion) => (
            <div className="coding-summary-label" key={`${event.eventId}-${assertion.facetId}`}>
              <Chip variant="blue">{assertion.categoryId.replaceAll("_", " ")}</Chip>
              <span>{assertion.effectDirection} · {assertion.severity}</span>
              <p>{assertion.rationale}</p>
            </div>
          ))}
        </section>
      ))}
      {submission.answer.coderNotes ? <p className="admin-prose-muted">{submission.answer.coderNotes}</p> : null}
    </article>
  );
}
