"use client";

import { useMemo, useState } from "react";
import type { PulseCodingDraftInput } from "@/lib/pulse/v2/coding-store";
import type { PulseCodingPacketSnapshot } from "@/lib/pulse/v2/coding-workspace";
import { PULSE_CODER_OBSERVATION_STATES, PULSE_PACKET_OUTCOMES } from "@/lib/pulse/v2/coder-protocol";
import { ONTOLOGY_EFFECT_DIRECTIONS, ONTOLOGY_SEVERITY_DESCRIPTORS, PULSE_EVENT_ONTOLOGY_VERSION } from "@/lib/pulse/v2/event-ontology";

export interface CodingBoundary {
  categoryId: string;
  label: string;
  dimension: string;
  operationalDefinition: string;
  includeWhen: string;
  excludeWhen: string;
  commonConfusion: string | null;
}

interface Props {
  assignmentId: string;
  packet: PulseCodingPacketSnapshot;
  boundaries: CodingBoundary[];
  initialDraft: PulseCodingDraftInput | null;
}

type DraftEvent = PulseCodingDraftInput["answer"]["events"][number];
type DraftCandidate = PulseCodingDraftInput["answer"]["candidateEvents"][number];

function blankEvent(packet: PulseCodingPacketSnapshot, index: number): DraftEvent {
  return {
    eventId: `event-${index + 1}`,
    eventDate: packet.date,
    datePrecision: "exact",
    primaryJurisdiction: packet.jurisdiction.name,
    affectedJurisdictions: [],
    evidenceIds: [],
    retrievalStatus: "pulse_retained",
    annotation: {
      ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
      disposition: "qualifying_event",
      labels: [],
      candidateLabels: [],
      ambiguityReason: null,
    },
  };
}

function blankCandidate(packet: PulseCodingPacketSnapshot, index: number): DraftCandidate {
  return {
    candidateId: `candidate-${index + 1}`,
    eventDate: packet.date,
    evidenceIds: [],
    candidateLabels: [],
    ambiguityReason: "",
  };
}

function initialValue(packet: PulseCodingPacketSnapshot): PulseCodingDraftInput {
  return {
    evidenceAssessments: packet.evidence.map((item) => ({
      evidenceId: item.id,
      accessState: item.accessState,
      dateRelevance: "undetermined",
      reportedDate: item.reportedDate,
      sourceFamilyId: item.sourceFamilyId,
      notes: "",
    })),
    addedEvidence: [],
    answer: {
      packetOutcome: "insufficient_observation",
      observationState: "undetermined",
      observationRationale: "",
      events: [],
      candidateEvents: [],
      excludedEvidenceIds: [],
      coderNotes: "",
    },
  };
}

function toggle(items: string[], value: string): string[] {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

export function CodingEditor({ assignmentId, packet, boundaries, initialDraft }: Props) {
  const [draft, setDraft] = useState<PulseCodingDraftInput>(
    initialDraft ?? initialValue(packet),
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const boundaryById = useMemo(
    () => new Map(boundaries.map((boundary) => [boundary.categoryId, boundary])),
    [boundaries],
  );

  function patchAnswer(patch: Partial<PulseCodingDraftInput["answer"]>) {
    setDraft((current) => ({ ...current, answer: { ...current.answer, ...patch } }));
  }

  function updateEvent(index: number, event: DraftEvent) {
    const events = [...draft.answer.events];
    events[index] = event;
    patchAnswer({ events });
  }

  function updateCandidate(index: number, candidate: DraftCandidate) {
    const candidateEvents = [...draft.answer.candidateEvents];
    candidateEvents[index] = candidate;
    patchAnswer({ candidateEvents });
  }

  async function send(action: "save" | "lock") {
    if (
      action === "lock" &&
      !window.confirm(
        "Lock this submission? It becomes immutable and cannot be edited or withdrawn.",
      )
    )
      return;
    setPending(true);
    setMessage(null);
    setErrors([]);
    try {
      const response = await fetch(`/api/pulse-coding/assignments/${assignmentId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ action, draft }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "The submission could not be saved.");
      if (action === "lock") window.location.reload();
      else setMessage("Draft saved. Peer labels remain hidden.");
    } catch (error) {
      const list = (error instanceof Error ? error.message : "Request failed")
        .split("; ")
        .filter(Boolean);
      setErrors(list);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="coding-workspace-grid">
      <section className="coding-evidence-pane" aria-labelledby="evidence-title">
        <div className="coding-pane-head">
          <p className="admin-eyebrow">Frozen packet</p>
          <h2 id="evidence-title" className="admin-section-title">Evidence</h2>
          <p className="admin-section-intro">
            Record access and date relevance for every item. Channel tags are
            retained only to distinguish Pulse evidence from audit-search evidence.
          </p>
        </div>
        <div className="coding-search-family-list" aria-label="Required search families">
          {packet.searchFamilies.map((family) => (
            <span className="editorial-chip editorial-chip--blue" key={family}>{family}</span>
          ))}
        </div>
        {packet.evidence.map((evidence, index) => {
          const assessment = draft.evidenceAssessments.find(
            (row) => row.evidenceId === evidence.id,
          )!;
          return (
            <article className="admin-card coding-evidence-card" key={evidence.id}>
              <div className="coding-evidence-meta">
                <span className="editorial-chip">{evidence.channel}</span>
                <span>{evidence.sourceFamilyId}</span>
                <span>{evidence.reportedDate ?? "Date not supplied"}</span>
              </div>
              <h3 className="coding-evidence-id">{evidence.id}</h3>
              <p className="admin-prose">{evidence.text}</p>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-field-label" htmlFor={`access-${evidence.id}`}>Access</label>
                  <select
                    id={`access-${evidence.id}`}
                    className="admin-select"
                    value={assessment.accessState}
                    onChange={(event) => {
                      const next = [...draft.evidenceAssessments];
                      next[index] = { ...assessment, accessState: event.target.value as typeof assessment.accessState };
                      setDraft({ ...draft, evidenceAssessments: next });
                    }}
                  >
                    <option value="accessible">Accessible</option>
                    <option value="metadata_only">Metadata only</option>
                    <option value="inaccessible">Inaccessible</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label className="admin-field-label" htmlFor={`relevance-${evidence.id}`}>Date relevance</label>
                  <select
                    id={`relevance-${evidence.id}`}
                    className="admin-select"
                    value={assessment.dateRelevance}
                    onChange={(event) => {
                      const next = [...draft.evidenceAssessments];
                      next[index] = { ...assessment, dateRelevance: event.target.value as typeof assessment.dateRelevance };
                      setDraft({ ...draft, evidenceAssessments: next });
                    }}
                  >
                    <option value="undetermined">Undetermined</option>
                    <option value="relevant">Relevant</option>
                    <option value="not_relevant">Not relevant</option>
                  </select>
                </div>
              </div>
              <div className="admin-field">
                <label className="admin-field-label" htmlFor={`evidence-note-${evidence.id}`}>Assessment note</label>
                <textarea
                  id={`evidence-note-${evidence.id}`}
                  className="admin-textarea coding-textarea-compact"
                  value={assessment.notes}
                  onChange={(event) => {
                    const next = [...draft.evidenceAssessments];
                    next[index] = { ...assessment, notes: event.target.value };
                    setDraft({ ...draft, evidenceAssessments: next });
                  }}
                />
              </div>
            </article>
          );
        })}
      </section>

      <section className="coding-form-pane" aria-labelledby="coding-form-title">
        <div className="coding-sticky-form">
          <div className="coding-pane-head">
            <p className="admin-eyebrow">Independent response</p>
            <h2 id="coding-form-title" className="admin-section-title">Code this country-day</h2>
          </div>
          <div className="admin-form">
            <div className="admin-field">
              <label className="admin-field-label" htmlFor="observation-state">Observation state</label>
              <select
                id="observation-state"
                className="admin-select"
                value={draft.answer.observationState}
                onChange={(event) => patchAnswer({ observationState: event.target.value as typeof draft.answer.observationState })}
              >
                {PULSE_CODER_OBSERVATION_STATES.map((state) => <option key={state} value={state}>{state.replaceAll("_", " ")}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-field-label" htmlFor="observation-rationale">Observation rationale</label>
              <textarea
                id="observation-rationale"
                className="admin-textarea"
                value={draft.answer.observationRationale}
                onChange={(event) => patchAnswer({ observationRationale: event.target.value })}
                required
              />
            </div>
            <fieldset className="coding-fieldset">
              <legend className="admin-field-label">Packet outcome</legend>
              {PULSE_PACKET_OUTCOMES.map((outcome) => (
                <label className="coding-radio-row" key={outcome}>
                  <input
                    type="radio"
                    name="packet-outcome"
                    value={outcome}
                    checked={draft.answer.packetOutcome === outcome}
                    onChange={() => patchAnswer({ packetOutcome: outcome })}
                  />
                  <span>{outcome.replaceAll("_", " ")}</span>
                </label>
              ))}
            </fieldset>

            <section className="coding-builder" aria-labelledby="events-builder-title">
              <div className="coding-builder-head">
                <h3 id="events-builder-title" className="admin-section-title">Assigned events</h3>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => patchAnswer({ events: [...draft.answer.events, blankEvent(packet, draft.answer.events.length)] })}
                >
                  Add event
                </button>
              </div>
              {draft.answer.events.map((codedEvent, eventIndex) => (
                <article className="coding-event-card" key={`${codedEvent.eventId}-${eventIndex}`}>
                  <div className="coding-builder-head">
                    <p className="admin-eyebrow">Event {eventIndex + 1}</p>
                    <button type="button" className="btn btn--text btn--sm" onClick={() => patchAnswer({ events: draft.answer.events.filter((_, index) => index !== eventIndex) })}>Remove</button>
                  </div>
                  <div className="admin-grid-2">
                    <div className="admin-field">
                      <label className="admin-field-label">Event ID</label>
                      <input className="admin-input" value={codedEvent.eventId} onChange={(event) => updateEvent(eventIndex, { ...codedEvent, eventId: event.target.value })} />
                    </div>
                    <div className="admin-field">
                      <label className="admin-field-label">Date precision</label>
                      <select className="admin-select" value={codedEvent.datePrecision} onChange={(event) => updateEvent(eventIndex, { ...codedEvent, datePrecision: event.target.value as DraftEvent["datePrecision"] })}>
                        <option value="exact">Exact</option><option value="bounded">Bounded</option>
                      </select>
                    </div>
                  </div>
                  <div className="admin-field">
                    <label className="admin-field-label">Retrieval status</label>
                    <select className="admin-select" value={codedEvent.retrievalStatus} onChange={(event) => updateEvent(eventIndex, { ...codedEvent, retrievalStatus: event.target.value as DraftEvent["retrievalStatus"] })}>
                      <option value="pulse_retained">Pulse retained</option>
                      <option value="audit_search_only">Audit search only</option>
                    </select>
                  </div>
                  <fieldset className="coding-fieldset">
                    <legend className="admin-field-label">Event evidence</legend>
                    {packet.evidence.map((item) => (
                      <label className="coding-check-row" key={item.id}>
                        <input type="checkbox" checked={codedEvent.evidenceIds.includes(item.id)} onChange={() => {
                          const evidenceIds = toggle(codedEvent.evidenceIds, item.id);
                          updateEvent(eventIndex, {
                            ...codedEvent,
                            evidenceIds,
                            annotation: {
                              ...codedEvent.annotation,
                              labels: codedEvent.annotation.labels.map((label) => ({
                                ...label,
                                evidenceIds,
                              })),
                            },
                          });
                        }} />
                        <span>{item.id}</span>
                      </label>
                    ))}
                  </fieldset>
                  <div className="coding-labels">
                    <div className="coding-builder-head">
                      <h4 className="coding-subheading">Ontology labels</h4>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => updateEvent(eventIndex, {
                          ...codedEvent,
                          annotation: {
                            ...codedEvent.annotation,
                            labels: [...codedEvent.annotation.labels, {
                              categoryId: boundaries[0]?.categoryId ?? "",
                              facetId: `facet-${codedEvent.annotation.labels.length + 1}`,
                              effectDirection: "not_assessed",
                              severity: "not_assessed",
                              evidenceIds: codedEvent.evidenceIds,
                              rationale: "",
                            }],
                          },
                        })}
                      >Add label</button>
                    </div>
                    {codedEvent.annotation.labels.map((label, labelIndex) => {
                      const boundary = boundaryById.get(label.categoryId);
                      return (
                        <div className="coding-label-card" key={`${label.facetId}-${labelIndex}`}>
                          <div className="admin-field">
                            <label className="admin-field-label">Category</label>
                            <select
                              className="admin-select"
                              value={label.categoryId}
                              onChange={(event) => {
                                const labels = [...codedEvent.annotation.labels];
                                labels[labelIndex] = { ...label, categoryId: event.target.value };
                                updateEvent(eventIndex, { ...codedEvent, annotation: { ...codedEvent.annotation, labels } });
                              }}
                            >
                              {boundaries.map((item) => <option key={item.categoryId} value={item.categoryId}>{item.label} · {item.dimension}</option>)}
                            </select>
                          </div>
                          {boundary ? (
                            <details className="coding-boundary" open>
                              <summary>Read the boundary before assigning</summary>
                              <p>{boundary.operationalDefinition}</p>
                              <dl>
                                <dt>Include</dt><dd>{boundary.includeWhen}</dd>
                                <dt>Exclude</dt><dd>{boundary.excludeWhen}</dd>
                                <dt>Nearest confusion</dt><dd>{boundary.commonConfusion ?? "None named"}</dd>
                              </dl>
                            </details>
                          ) : null}
                          <div className="admin-grid-2">
                            <div className="admin-field">
                              <label className="admin-field-label">Effect</label>
                              <select className="admin-select" value={label.effectDirection} onChange={(event) => {
                                const labels = [...codedEvent.annotation.labels];
                                labels[labelIndex] = { ...label, effectDirection: event.target.value as typeof label.effectDirection };
                                updateEvent(eventIndex, { ...codedEvent, annotation: { ...codedEvent.annotation, labels } });
                              }}>
                                {ONTOLOGY_EFFECT_DIRECTIONS.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                              </select>
                            </div>
                            <div className="admin-field">
                              <label className="admin-field-label">Severity</label>
                              <select className="admin-select" value={label.severity} onChange={(event) => {
                                const labels = [...codedEvent.annotation.labels];
                                labels[labelIndex] = { ...label, severity: event.target.value as typeof label.severity };
                                updateEvent(eventIndex, { ...codedEvent, annotation: { ...codedEvent.annotation, labels } });
                              }}>
                                {Object.keys(ONTOLOGY_SEVERITY_DESCRIPTORS).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="admin-field">
                            <label className="admin-field-label">Label rationale</label>
                            <textarea className="admin-textarea coding-textarea-compact" value={label.rationale} onChange={(event) => {
                              const labels = [...codedEvent.annotation.labels];
                              labels[labelIndex] = { ...label, rationale: event.target.value, evidenceIds: codedEvent.evidenceIds };
                              updateEvent(eventIndex, { ...codedEvent, annotation: { ...codedEvent.annotation, labels } });
                            }} />
                          </div>
                          <button type="button" className="btn btn--text btn--sm" onClick={() => {
                            const labels = codedEvent.annotation.labels.filter((_, index) => index !== labelIndex);
                            updateEvent(eventIndex, { ...codedEvent, annotation: { ...codedEvent.annotation, labels } });
                          }}>Remove label</button>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </section>

            <section className="coding-builder coding-builder--candidate" aria-labelledby="candidate-builder-title">
              <div className="coding-builder-head">
                <h3 id="candidate-builder-title" className="admin-section-title">Candidate events</h3>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => patchAnswer({ candidateEvents: [...draft.answer.candidateEvents, blankCandidate(packet, draft.answer.candidateEvents.length)] })}>Add candidate</button>
              </div>
              <p className="admin-section-intro">Use this path when evidence supports a possible event but the date, existence, or category cannot be assigned without forcing certainty.</p>
              {draft.answer.candidateEvents.map((candidate, index) => (
                <article className="coding-candidate-card" key={`${candidate.candidateId}-${index}`}>
                  <div className="admin-field">
                    <label className="admin-field-label">Candidate ID</label>
                    <input className="admin-input" value={candidate.candidateId} onChange={(event) => updateCandidate(index, { ...candidate, candidateId: event.target.value })} />
                  </div>
                  <div className="admin-field">
                    <label className="admin-field-label">Candidate category</label>
                    <select className="admin-select" value={candidate.candidateLabels[0]?.categoryId ?? ""} onChange={(event) => updateCandidate(index, { ...candidate, candidateLabels: [{ categoryId: event.target.value, reason: candidate.candidateLabels[0]?.reason ?? "" }] })}>
                      <option value="">Choose only if plausible</option>
                      {boundaries.map((item) => <option key={item.categoryId} value={item.categoryId}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="admin-field">
                    <label className="admin-field-label">Why only a candidate?</label>
                    <textarea className="admin-textarea coding-textarea-compact" value={candidate.ambiguityReason} onChange={(event) => updateCandidate(index, { ...candidate, ambiguityReason: event.target.value, candidateLabels: candidate.candidateLabels.map((label) => ({ ...label, reason: event.target.value })) })} />
                  </div>
                  <fieldset className="coding-fieldset">
                    <legend className="admin-field-label">Candidate evidence</legend>
                    {packet.evidence.map((item) => <label className="coding-check-row" key={item.id}><input type="checkbox" checked={candidate.evidenceIds.includes(item.id)} onChange={() => updateCandidate(index, { ...candidate, evidenceIds: toggle(candidate.evidenceIds, item.id) })} /><span>{item.id}</span></label>)}
                  </fieldset>
                  <button type="button" className="btn btn--text btn--sm" onClick={() => patchAnswer({ candidateEvents: draft.answer.candidateEvents.filter((_, candidateIndex) => candidateIndex !== index) })}>Remove candidate</button>
                </article>
              ))}
            </section>

            <fieldset className="coding-fieldset">
              <legend className="admin-field-label">Excluded evidence</legend>
              {packet.evidence.map((item) => <label className="coding-check-row" key={item.id}><input type="checkbox" checked={draft.answer.excludedEvidenceIds.includes(item.id)} onChange={() => patchAnswer({ excludedEvidenceIds: toggle(draft.answer.excludedEvidenceIds, item.id) })} /><span>{item.id}</span></label>)}
            </fieldset>
            <div className="admin-field">
              <label className="admin-field-label" htmlFor="coder-notes">Coder notes</label>
              <textarea id="coder-notes" className="admin-textarea" value={draft.answer.coderNotes} onChange={(event) => patchAnswer({ coderNotes: event.target.value })} />
            </div>
            {errors.length ? (
              <div className="coding-validation-errors" role="alert">
                <strong>Resolve before locking</strong>
                <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            ) : null}
            {message ? <p className="admin-hint" role="status">{message}</p> : null}
            <div className="admin-actions">
              <button type="button" className="btn btn--secondary" disabled={pending} onClick={() => send("save")}>Save draft</button>
              <button type="button" className="btn btn--primary" disabled={pending} onClick={() => send("lock")}>
                Review and lock <span className="btn__arrow" aria-hidden>→</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
