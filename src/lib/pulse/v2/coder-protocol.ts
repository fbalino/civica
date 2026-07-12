import { createHash } from "node:crypto";
import {
  PULSE_EVENT_ONTOLOGY_VERSION,
  ontologyCategoryDimension,
  type PulseOntologyAnnotation,
  validatePulseOntologyAnnotation,
} from "./event-ontology";
import {
  PULSE_OBSERVABILITY_THRESHOLDS,
} from "./observability";

export const PULSE_INDEPENDENT_CODING_VERSION =
  "pulse-independent-coding/v1" as const;
export const PULSE_CODER_PILOT_VERSION = "pulse-coder-pilot/v1" as const;

export const PULSE_PACKET_OUTCOMES = [
  "qualifying_event",
  "true_negative",
  "retrieval_miss",
  "insufficient_observation",
  "out_of_scope",
] as const;
export type PulsePacketOutcome = (typeof PULSE_PACKET_OUTCOMES)[number];

export const PULSE_CODER_OBSERVATION_STATES = [
  "sufficient_observation",
  "low_coverage",
  "source_outage",
  "restricted_information_environment",
  "undetermined",
] as const;
export type PulseCoderObservationState =
  (typeof PULSE_CODER_OBSERVATION_STATES)[number];

export const PULSE_ADJUDICATION_REASON_CODES = [
  "evidence_overlooked",
  "scope_boundary",
  "date_boundary",
  "source_independence",
  "duplicate_identity",
  "category_boundary",
  "effect_direction",
  "severity",
  "observability",
  "insufficient_context",
  "coder_error",
  "codebook_gap",
] as const;

export const PULSE_CODER_FORBIDDEN_FIELDS = [
  "productionLabel",
  "productionDisposition",
  "publishedStatus",
  "modelVote",
  "modelConfidence",
  "ownerApproval",
  "otherCoderSubmission",
  "adjudicatedAnswer",
  "goldLabel",
  "truth",
] as const;

export const PULSE_INDEPENDENT_CODING_PROTOCOL = Object.freeze({
  id: PULSE_INDEPENDENT_CODING_VERSION,
  frozenOn: "2026-07-11",
  ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
  unit: "one sampled sovereign-country UTC day, which may contain zero, one, or several distinct events",
  evidenceChannels: Object.freeze([
    "pulse_retained: private retained evidence available to the frozen pipeline",
    "audit_search: rights-safe audit evidence found outside the retained Pulse packet",
    "context: source, access, date, outage, and information-environment evidence used only to judge observability",
  ]),
  coderSequence: Object.freeze([
    "Verify the country-day unit and inspect every evidence item without viewing production, owner, or peer labels.",
    "Record access failures, language limits, source dependence, date mismatch, and known outage or information-environment evidence.",
    "Identify distinct in-scope occurrences on the sampled date; collapse copies of one underlying report or event.",
    "Apply the ontology independently to each event facet, retaining candidates instead of forcing unresolved labels.",
    "Assign the packet outcome from the event and observability rules, then lock the complete submission.",
  ]),
  outcomeRules: Object.freeze({
    qualifying_event:
      "At least one qualifying event is supported and every supported event in the packet has retained Pulse evidence.",
    retrieval_miss:
      "At least one qualifying event on the sampled date is supported only by audit-search evidence and has no matching retained Pulse evidence.",
    true_negative:
      "No qualifying event is found after sufficient observation. This means no event found under the frozen audit protocol, not proof that no real-world event occurred.",
    insufficient_observation:
      "No qualifying event can be established and coverage, access, language, outage, restriction, or unresolved evidence prevents a sufficient-observation judgment.",
    out_of_scope:
      "The sampled unit itself is invalid for the frozen population. Out-of-scope stories inside a valid packet are excluded evidence, not an out-of-scope packet.",
  }),
  sufficientObservation: Object.freeze({
    minimumAccessibleRelevantDocuments:
      PULSE_OBSERVABILITY_THRESHOLDS.minimumRetainedDocuments,
    minimumIndependentSourceFamilies:
      PULSE_OBSERVABILITY_THRESHOLDS.minimumObservedFeedFamilies,
    requiredSearchFamilies: Object.freeze([
      "institutions",
      "accountabilitySecurity",
      "broadCountryDay",
    ]),
    rule:
      "Sufficient observation requires all three search families reviewed, at least five accessible and date-relevant documents across at least two independent source families, and no known source outage or sourced restricted-information condition. Meeting this operational threshold does not validate retrieval recall.",
  }),
  blinding: Object.freeze({
    forbiddenFields: PULSE_CODER_FORBIDDEN_FIELDS,
    identityPolicy:
      "Coder identity is pseudonymous during coding. Each coder receives the same packet and codebook but cannot see another submission before locking their own.",
    productionPolicy:
      "The packet may identify evidence as Pulse-retained or audit-search because retrieval misses require that distinction; it never reveals production labels, votes, review decisions, scores, publication state, or owner approval.",
  }),
  trainingAndPilot: Object.freeze({
    training:
      "Worked synthetic examples and their teaching answers are visible before qualification and excluded from every performance estimate.",
    pilot:
      "Blind synthetic pilot cases contain no answer key. Agent pilot submissions test instructions and tooling only and can never become gold labels.",
    revision:
      "A codebook change after pilot review creates a new version and requires every affected pilot or evaluation item to be recoded under that version.",
  }),
  adjudication: Object.freeze({
    trigger: "Every axis disagreement and every unresolved codebook issue remains visible and enters a separate adjudication queue.",
    independence:
      "The adjudicator acts only after both submissions are locked, cannot be either coder, and cannot see production, owner, or model answers.",
    decision:
      "The adjudicator may select one supported annotation, write a new evidence-grounded annotation, or leave the item unresolved; two-coder majority voting is prohibited.",
    retention:
      "Raw coder submissions are immutable and exported beside the adjudication record. Adjudication never overwrites disagreement.",
    authority:
      "Only a qualified human adjudication can enter a later gold release. Owner preference, production output, model consensus, and agent dry runs are not answer keys.",
  }),
  sources: Object.freeze([
    "https://aclanthology.org/2024.cl-3.1/",
    "https://aclanthology.org/W15-0809/",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC9099179/",
  ]),
} as const);

export interface PulseCoderEvidence {
  id: string;
  channel: "pulse_retained" | "audit_search" | "context";
  sourceFamilyId: string;
  accessState: "accessible" | "metadata_only" | "inaccessible";
  reportedDate: string | null;
  text: string;
}

export interface PulseCoderPacket {
  id: string;
  date: string;
  searchFamilies: string[];
  telemetry: {
    outage: boolean;
    note: string;
  };
  informationEnvironment: "restricted_sourced" | "not_supplied";
  evidence: PulseCoderEvidence[];
}

export interface PulseCoderPilotPacket extends PulseCoderPacket {
  id: string;
  split: "training" | "blind_pilot";
  synthetic: true;
  countryAlias: string;
  date: string;
  searchFamilies: string[];
  telemetry: {
    outage: boolean;
    note: string;
  };
  informationEnvironment: "restricted_sourced" | "not_supplied";
  evidence: PulseCoderEvidence[];
  teachingAnswer?: Record<string, unknown>;
}

export interface PulseCodedEvent {
  eventId: string;
  eventDate: string;
  datePrecision: "exact" | "bounded";
  primaryJurisdiction: string;
  affectedJurisdictions: string[];
  evidenceIds: string[];
  retrievalStatus: "pulse_retained" | "audit_search_only";
  annotation: PulseOntologyAnnotation;
}

export interface PulseCandidateEvent {
  candidateId: string;
  eventDate: string | null;
  evidenceIds: string[];
  candidateLabels: Array<{ categoryId: string; reason: string }>;
  ambiguityReason: string;
}

export interface PulseCoderAnswer {
  packetOutcome: PulsePacketOutcome;
  observationState: PulseCoderObservationState;
  observationRationale: string;
  events: PulseCodedEvent[];
  candidateEvents: PulseCandidateEvent[];
  excludedEvidenceIds: string[];
  coderNotes: string;
}

export interface PulseCoderSubmission extends PulseCoderAnswer {
  schemaVersion: typeof PULSE_INDEPENDENT_CODING_VERSION;
  pilotVersion: typeof PULSE_CODER_PILOT_VERSION;
  packetId: string;
  coderId: string;
  coderType: "qualified_human" | "agent_dry_pilot";
  useStatus: "evaluation_candidate" | "dry_run_not_gold";
  submittedAt: string;
  locked: true;
}

type JsonRecord = Record<string, unknown>;

export function containsPulseCoderForbiddenField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPulseCoderForbiddenField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as JsonRecord).some(
    ([key, child]) =>
      (PULSE_CODER_FORBIDDEN_FIELDS as readonly string[]).includes(key) ||
      containsPulseCoderForbiddenField(child),
  );
}

export function pulseCoderPilotErrors(artifact: JsonRecord): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== PULSE_CODER_PILOT_VERSION)
    errors.push("wrong pilot version");
  if (artifact.codebookVersion !== PULSE_INDEPENDENT_CODING_VERSION)
    errors.push("wrong codebook version");
  if (artifact.ontologyVersion !== PULSE_EVENT_ONTOLOGY_VERSION)
    errors.push("wrong ontology version");
  const packets = Array.isArray(artifact.packets)
    ? (artifact.packets as PulseCoderPilotPacket[])
    : [];
  if (packets.filter(({ split }) => split === "training").length < 6)
    errors.push("at least six training packets are required");
  if (packets.filter(({ split }) => split === "blind_pilot").length < 10)
    errors.push("at least ten blind pilot packets are required");
  const ids = new Set<string>();
  for (const packet of packets) {
    if (ids.has(packet.id)) errors.push(`duplicate packet ${packet.id}`);
    ids.add(packet.id);
    if (!packet.synthetic) errors.push(`${packet.id}: pilot packet is not synthetic`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(packet.date))
      errors.push(`${packet.id}: invalid date`);
    if (
      JSON.stringify([...packet.searchFamilies].sort()) !==
      JSON.stringify(
        [...PULSE_INDEPENDENT_CODING_PROTOCOL.sufficientObservation.requiredSearchFamilies].sort(),
      )
    )
      errors.push(`${packet.id}: search-family review is incomplete`);
    if (packet.evidence.length === 0)
      errors.push(`${packet.id}: evidence packet is empty`);
    if (packet.split === "blind_pilot" && packet.teachingAnswer)
      errors.push(`${packet.id}: answer leaked into blind pilot`);
    if (packet.split === "training" && !packet.teachingAnswer)
      errors.push(`${packet.id}: training answer is missing`);
    if (containsPulseCoderForbiddenField(packet))
      errors.push(`${packet.id}: forbidden blind field leaked`);
  }
  const body = { ...artifact };
  delete body.semanticSha256;
  if (
    artifact.semanticSha256 !==
    createHash("sha256").update(JSON.stringify(body)).digest("hex")
  )
    errors.push("pilot semantic hash drifted");
  return errors;
}

export function pulseCoderSubmissionErrors(
  submission: PulseCoderSubmission,
  packet?: PulseCoderPacket,
): string[] {
  const errors: string[] = [];
  if (submission.schemaVersion !== PULSE_INDEPENDENT_CODING_VERSION)
    errors.push("wrong submission version");
  if (submission.pilotVersion !== PULSE_CODER_PILOT_VERSION)
    errors.push("wrong pilot version");
  if (!submission.coderId.trim()) errors.push("coder id is blank");
  if (!submission.locked) errors.push("submission is not locked");
  if (submission.coderType === "agent_dry_pilot" && submission.useStatus !== "dry_run_not_gold")
    errors.push("agent pilot cannot become evaluation gold");
  if (!PULSE_PACKET_OUTCOMES.includes(submission.packetOutcome))
    errors.push("unknown packet outcome");
  if (!PULSE_CODER_OBSERVATION_STATES.includes(submission.observationState))
    errors.push("unknown observation state");
  if (!submission.observationRationale.trim())
    errors.push("observation rationale is blank");
  if (containsPulseCoderForbiddenField(submission)) errors.push("forbidden blind field leaked");
  if (packet && submission.packetId !== packet.id)
    errors.push("submission points to another packet");
  const packetEvidence = new Map(
    (packet?.evidence ?? []).map((item) => [item.id, item]),
  );
  const eventIds = new Set<string>();
  for (const event of submission.events) {
    if (eventIds.has(event.eventId)) errors.push(`duplicate event ${event.eventId}`);
    eventIds.add(event.eventId);
    if (!event.eventId.trim() || !event.evidenceIds.length)
      errors.push("coded event is missing identity or evidence");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.eventDate))
      errors.push(`${event.eventId}: invalid event date`);
    if (packet && event.eventDate !== packet.date)
      errors.push(`${event.eventId}: event falls outside the sampled date`);
    if (
      event.affectedJurisdictions.includes(event.primaryJurisdiction) ||
      new Set(event.affectedJurisdictions).size !==
        event.affectedJurisdictions.length
    )
      errors.push(`${event.eventId}: affected jurisdictions are invalid`);
    const eventEvidence = event.evidenceIds.map((id) => packetEvidence.get(id));
    if (packet && eventEvidence.some((item) => !item))
      errors.push(`${event.eventId}: event cites evidence outside the packet`);
    const channels = new Set(eventEvidence.map((item) => item?.channel));
    if (
      event.retrievalStatus === "pulse_retained" &&
      !channels.has("pulse_retained")
    )
      errors.push(`${event.eventId}: retained status lacks retained evidence`);
    if (
      event.retrievalStatus === "audit_search_only" &&
      (!channels.has("audit_search") || channels.has("pulse_retained"))
    )
      errors.push(`${event.eventId}: audit-only status has invalid channels`);
    for (const label of event.annotation.labels) {
      if (label.evidenceIds.some((id) => !event.evidenceIds.includes(id)))
        errors.push(`${event.eventId}: label cites evidence outside its event`);
    }
    errors.push(
      ...validatePulseOntologyAnnotation(event.annotation).map(
        (error) => `${event.eventId}: ${error}`,
      ),
    );
  }
  for (const candidate of submission.candidateEvents) {
    if (!candidate.candidateId.trim() || !candidate.evidenceIds.length)
      errors.push("candidate event is missing identity or evidence");
    if (!candidate.candidateLabels.length || !candidate.ambiguityReason.trim())
      errors.push(`${candidate.candidateId}: candidate ambiguity is incomplete`);
    for (const label of candidate.candidateLabels) {
      if (!ontologyCategoryDimension(label.categoryId) || !label.reason.trim())
        errors.push(`${candidate.candidateId}: candidate label is invalid`);
    }
    if (candidate.eventDate && packet && candidate.eventDate !== packet.date)
      errors.push(`${candidate.candidateId}: candidate falls outside the sampled date`);
    if (packet && candidate.evidenceIds.some((id) => !packetEvidence.has(id)))
      errors.push(`${candidate.candidateId}: candidate cites evidence outside the packet`);
  }
  if (
    packet &&
    submission.excludedEvidenceIds.some((id) => !packetEvidence.has(id))
  )
    errors.push("excluded evidence points outside the packet");
  const hasMiss = submission.events.some(
    ({ retrievalStatus }) => retrievalStatus === "audit_search_only",
  );
  if (
    ["qualifying_event", "retrieval_miss"].includes(submission.packetOutcome) &&
    submission.events.length === 0
  )
    errors.push("positive packet outcome requires an event");
  if (submission.packetOutcome === "retrieval_miss" && !hasMiss)
    errors.push("retrieval miss requires audit-search-only event evidence");
  if (submission.packetOutcome === "qualifying_event" && hasMiss)
    errors.push("a packet with a missed event must use retrieval_miss");
  if (
    ["true_negative", "insufficient_observation", "out_of_scope"].includes(
      submission.packetOutcome,
    ) && submission.events.length > 0
  )
    errors.push("negative or out-of-scope packet cannot carry assigned events");
  if (
    ["true_negative", "out_of_scope"].includes(submission.packetOutcome) &&
    submission.candidateEvents.length > 0
  )
    errors.push("true-negative or out-of-scope packet cannot carry candidate events");
  if (
    submission.packetOutcome === "true_negative" &&
    submission.observationState !== "sufficient_observation"
  )
    errors.push("true negative requires sufficient observation");
  if (
    submission.packetOutcome === "insufficient_observation" &&
    submission.observationState === "sufficient_observation"
  )
    errors.push("insufficient-observation outcome contradicts observation state");
  if (packet) {
    const accessible = packet.evidence.filter(
      ({ channel, accessState }) =>
        channel !== "context" && accessState === "accessible",
    );
    const structurallySufficient =
      accessible.length >=
        PULSE_INDEPENDENT_CODING_PROTOCOL.sufficientObservation
          .minimumAccessibleRelevantDocuments &&
      new Set(accessible.map(({ sourceFamilyId }) => sourceFamilyId)).size >=
        PULSE_INDEPENDENT_CODING_PROTOCOL.sufficientObservation
          .minimumIndependentSourceFamilies &&
      !packet.telemetry.outage &&
      packet.informationEnvironment !== "restricted_sourced";
    if (
      submission.packetOutcome === "true_negative" &&
      !structurallySufficient
    )
      errors.push("true negative lacks the structural observation minimum");
    if (packet.telemetry.outage && submission.observationState !== "source_outage")
      errors.push("known source outage was not retained in observation state");
    if (
      packet.informationEnvironment === "restricted_sourced" &&
      submission.observationState !== "restricted_information_environment"
    )
      errors.push("sourced restriction was not retained in observation state");
  }
  return errors;
}

export interface PulseCoderDisagreement {
  packetId: string;
  coderIds: [string, string];
  axes: string[];
  submissionsRemainVisible: true;
}

export function comparePulseCoderSubmissions(
  left: PulseCoderSubmission,
  right: PulseCoderSubmission,
): PulseCoderDisagreement {
  if (left.packetId !== right.packetId)
    throw new Error("cannot compare submissions from different packets");
  if (left.coderId === right.coderId)
    throw new Error("independent submissions require different coders");
  const axes: string[] = [];
  if (left.packetOutcome !== right.packetOutcome) axes.push("packet_outcome");
  if (left.observationState !== right.observationState)
    axes.push("observability");
  const eventIdentity = (submission: PulseCoderSubmission) =>
    submission.events
      .map(({ eventDate, datePrecision, primaryJurisdiction, affectedJurisdictions }) =>
        [
          eventDate,
          datePrecision,
          primaryJurisdiction,
          [...affectedJurisdictions].sort().join(","),
        ].join("|"),
      )
      .sort();
  const eventIdentityMatches =
    JSON.stringify(eventIdentity(left)) === JSON.stringify(eventIdentity(right));
  if (!eventIdentityMatches)
    axes.push("event_identity");
  const categories = (submission: PulseCoderSubmission) =>
    submission.events
      .flatMap(({ annotation }) => annotation.labels.map(({ categoryId }) => categoryId))
      .sort();
  if (eventIdentityMatches) {
    if (JSON.stringify(categories(left)) !== JSON.stringify(categories(right)))
      axes.push("category_labels");
    const effects = (submission: PulseCoderSubmission) =>
      submission.events
        .flatMap(({ annotation }) =>
          annotation.labels.map(({ effectDirection }) => effectDirection),
        )
        .sort();
    if (JSON.stringify(effects(left)) !== JSON.stringify(effects(right)))
      axes.push("effect_direction");
  }
  const severity = (submission: PulseCoderSubmission) =>
    submission.events
      .flatMap(({ annotation }) => annotation.labels.map(({ severity }) => severity))
      .sort();
  if (
    eventIdentityMatches &&
    JSON.stringify(severity(left)) !== JSON.stringify(severity(right))
  )
    axes.push("severity");
  const evidence = (submission: PulseCoderSubmission) =>
    submission.events
      .map(({ evidenceIds }) => [...evidenceIds].sort().join("|"))
      .sort();
  if (
    eventIdentityMatches &&
    JSON.stringify(evidence(left)) !== JSON.stringify(evidence(right))
  )
    axes.push("evidence_references");
  const candidateLabels = (submission: PulseCoderSubmission) =>
    submission.candidateEvents
      .flatMap(({ candidateLabels: labels }) =>
        labels.map(({ categoryId }) => categoryId),
      )
      .sort();
  if (
    JSON.stringify(candidateLabels(left)) !==
    JSON.stringify(candidateLabels(right))
  )
    axes.push("candidate_labels");
  return {
    packetId: left.packetId,
    coderIds: [left.coderId, right.coderId],
    axes,
    submissionsRemainVisible: true,
  };
}
