import { createHash, timingSafeEqual } from "node:crypto";
import {
  PULSE_ADJUDICATION_REASON_CODES,
  PULSE_CODER_OBSERVATION_STATES,
  PULSE_INDEPENDENT_CODING_VERSION,
  PULSE_PACKET_OUTCOMES,
  comparePulseCoderSubmissions,
  containsPulseCoderForbiddenField,
  pulseCoderSubmissionErrors,
  type PulseCoderAnswer,
  type PulseCoderEvidence,
  type PulseCoderPacket,
  type PulseCoderSubmission,
} from "./coder-protocol";
import { PULSE_EVENT_ONTOLOGY_VERSION } from "./event-ontology";

export const PULSE_CODING_WORKSPACE_VERSION =
  "pulse-coding-workspace/v1" as const;

export const PULSE_CODING_ROLES = [
  "coder",
  "adjudicator",
  "study_admin",
] as const;
export type PulseCodingRole = (typeof PULSE_CODING_ROLES)[number];

export const PULSE_CODING_STUDY_STATUSES = [
  "setup",
  "active",
  "closed",
] as const;
export type PulseCodingStudyStatus =
  (typeof PULSE_CODING_STUDY_STATUSES)[number];

export const PULSE_CODING_ASSIGNMENT_STATUSES = [
  "assigned",
  "draft",
  "locked",
] as const;
export type PulseCodingAssignmentStatus =
  (typeof PULSE_CODING_ASSIGNMENT_STATUSES)[number];

export const PULSE_CODING_ADJUDICATION_STATUSES = [
  "pending",
  "resolved",
  "unresolved",
] as const;
export type PulseCodingAdjudicationStatus =
  (typeof PULSE_CODING_ADJUDICATION_STATUSES)[number];

export const PULSE_CODING_AUDIT_ACTIONS = [
  "study_created",
  "packet_imported",
  "participant_issued",
  "participant_revoked",
  "assignment_created",
  "draft_saved",
  "submission_locked",
  "comparison_generated",
  "adjudication_recorded",
  "export_generated",
  "access_granted",
  "access_denied",
] as const;

export interface PulseCodingStudyContract {
  schemaVersion: typeof PULSE_CODING_WORKSPACE_VERSION;
  id: string;
  title: string;
  purpose: "instruction_pilot" | "evaluation";
  protocolVersion: typeof PULSE_INDEPENDENT_CODING_VERSION;
  codebookVersion: typeof PULSE_INDEPENDENT_CODING_VERSION;
  ontologyVersion: typeof PULSE_EVENT_ONTOLOGY_VERSION;
  datasetVersion: string;
  packetSetSha256: string;
  traceSetSha256: string | null;
  status: PulseCodingStudyStatus;
}

export interface PulseCodingPacketSnapshot extends PulseCoderPacket {
  schemaVersion: typeof PULSE_CODING_WORKSPACE_VERSION;
  studyId: string;
  datasetVersion: string;
  packetSetSha256: string;
  packetSnapshotSha256: string;
  jurisdiction: {
    id: string;
    name: string;
    iso3: string | null;
  };
  analysisStatus: "analysis_candidate" | "reserve" | "pilot";
}

export interface PulseCodingEvidenceAssessment {
  evidenceId: string;
  accessState: PulseCoderEvidence["accessState"];
  dateRelevance: "relevant" | "not_relevant" | "undetermined";
  reportedDate: string | null;
  sourceFamilyId: string;
  notes: string;
}

export interface PulseCodingAddedEvidence extends PulseCoderEvidence {
  channel: "audit_search" | "context";
  url: string;
  title: string;
}

export interface PulseCodingSubmissionEnvelope {
  schemaVersion: typeof PULSE_CODING_WORKSPACE_VERSION;
  protocolVersion: typeof PULSE_INDEPENDENT_CODING_VERSION;
  codebookVersion: typeof PULSE_INDEPENDENT_CODING_VERSION;
  ontologyVersion: typeof PULSE_EVENT_ONTOLOGY_VERSION;
  datasetVersion: string;
  packetId: string;
  packetSnapshotSha256: string;
  coderId: string;
  coderType: "qualified_human" | "agent_dry_pilot";
  useStatus: "evaluation_candidate" | "dry_run_not_gold";
  submittedAt: string | null;
  locked: boolean;
  evidenceAssessments: PulseCodingEvidenceAssessment[];
  addedEvidence: PulseCodingAddedEvidence[];
  answer: PulseCoderAnswer;
}

export interface PulseCodingAccessContext {
  participantId: string;
  role: PulseCodingRole;
  assignedCoderIds: [string, string];
  assignedAdjudicatorId: string | null;
  ownSubmissionLocked: boolean;
  bothSubmissionsLocked: boolean;
  adjudicationTerminal: boolean;
}

export interface PulseCodingAdjudicationInput {
  schemaVersion: typeof PULSE_CODING_WORKSPACE_VERSION;
  packetId: string;
  comparisonSha256: string;
  adjudicatorId: string;
  status: "resolved" | "unresolved";
  reasonCodes: Array<(typeof PULSE_ADJUDICATION_REASON_CODES)[number]>;
  resolution:
    | { kind: "select_submission"; coderId: string; rationale: string }
    | { kind: "new_annotation"; answer: PulseCoderAnswer; rationale: string }
    | { kind: "unresolved"; rationale: string };
  recordedAt: string;
}

export interface PulseCodingComparison {
  schemaVersion: typeof PULSE_CODING_WORKSPACE_VERSION;
  packetId: string;
  packetSnapshotSha256: string;
  coderIds: [string, string];
  submissionSha256s: [string, string];
  disagreementAxes: string[];
  rawSubmissionsRemainImmutable: true;
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function pulseCodingHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function pulseCodingPacketHash(
  packet: Omit<PulseCodingPacketSnapshot, "packetSnapshotSha256">,
): string {
  return pulseCodingHash(packet);
}

export function pulseCodingAccessCodeHash(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function pulseCodingHashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function pulseCodingStudyErrors(
  study: PulseCodingStudyContract,
): string[] {
  const errors: string[] = [];
  if (study.schemaVersion !== PULSE_CODING_WORKSPACE_VERSION)
    errors.push("wrong workspace version");
  if (study.protocolVersion !== PULSE_INDEPENDENT_CODING_VERSION)
    errors.push("wrong protocol version");
  if (study.codebookVersion !== PULSE_INDEPENDENT_CODING_VERSION)
    errors.push("wrong codebook version");
  if (study.ontologyVersion !== PULSE_EVENT_ONTOLOGY_VERSION)
    errors.push("wrong ontology version");
  if (!study.id.trim() || !study.title.trim() || !study.datasetVersion.trim())
    errors.push("study identity is incomplete");
  if (!isSha256(study.packetSetSha256))
    errors.push("packet-set hash is invalid");
  if (study.traceSetSha256 && !isSha256(study.traceSetSha256))
    errors.push("trace-set hash is invalid");
  if (!PULSE_CODING_STUDY_STATUSES.includes(study.status))
    errors.push("study status is invalid");
  return errors;
}

export function pulseCodingPacketErrors(
  packet: PulseCodingPacketSnapshot,
  study?: PulseCodingStudyContract,
): string[] {
  const errors: string[] = [];
  if (packet.schemaVersion !== PULSE_CODING_WORKSPACE_VERSION)
    errors.push("wrong packet workspace version");
  if (!packet.id.trim() || !packet.studyId.trim())
    errors.push("packet identity is incomplete");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(packet.date))
    errors.push("packet date is invalid");
  if (!packet.jurisdiction.id || !packet.jurisdiction.name)
    errors.push("packet jurisdiction is incomplete");
  if (!isSha256(packet.packetSetSha256))
    errors.push("packet-set hash is invalid");
  if (!isSha256(packet.packetSnapshotSha256))
    errors.push("packet snapshot hash is invalid");
  const body = { ...packet };
  delete (body as Partial<PulseCodingPacketSnapshot>).packetSnapshotSha256;
  if (packet.packetSnapshotSha256 !== pulseCodingPacketHash(body))
    errors.push("packet snapshot hash drifted");
  if (containsPulseCoderForbiddenField(packet))
    errors.push("forbidden blind field leaked into packet");
  const evidenceIds = packet.evidence.map(({ id }) => id);
  if (new Set(evidenceIds).size !== evidenceIds.length)
    errors.push("packet evidence ids are not unique");
  if (study) {
    if (packet.studyId !== study.id) errors.push("packet points to another study");
    if (packet.datasetVersion !== study.datasetVersion)
      errors.push("packet dataset version drifted");
    if (packet.packetSetSha256 !== study.packetSetSha256)
      errors.push("packet set points to another study artifact");
  }
  return errors;
}

function packetWithCoderEvidence(
  packet: PulseCodingPacketSnapshot,
  submission: PulseCodingSubmissionEnvelope,
): PulseCoderPacket {
  const assessments = new Map(
    submission.evidenceAssessments.map((row) => [row.evidenceId, row]),
  );
  return {
    id: packet.id,
    date: packet.date,
    searchFamilies: packet.searchFamilies,
    telemetry: packet.telemetry,
    informationEnvironment: packet.informationEnvironment,
    evidence: [
      ...packet.evidence.map((item) => {
        const assessment = assessments.get(item.id);
        return assessment
          ? {
              ...item,
              accessState: assessment.accessState,
              reportedDate: assessment.reportedDate,
              sourceFamilyId: assessment.sourceFamilyId,
            }
          : item;
      }),
      ...submission.addedEvidence,
    ],
  };
}

export function pulseCodingSubmissionErrors(
  submission: PulseCodingSubmissionEnvelope,
  packet: PulseCodingPacketSnapshot,
  study: PulseCodingStudyContract,
): string[] {
  const errors: string[] = [];
  if (submission.schemaVersion !== PULSE_CODING_WORKSPACE_VERSION)
    errors.push("wrong workspace submission version");
  if (
    submission.protocolVersion !== study.protocolVersion ||
    submission.codebookVersion !== study.codebookVersion ||
    submission.ontologyVersion !== study.ontologyVersion
  )
    errors.push("submission method versions drifted");
  if (
    submission.datasetVersion !== study.datasetVersion ||
    submission.packetId !== packet.id ||
    submission.packetSnapshotSha256 !== packet.packetSnapshotSha256
  )
    errors.push("submission points to another packet snapshot");
  if (!submission.coderId.trim()) errors.push("coder identity is blank");
  if (submission.locked && !submission.submittedAt)
    errors.push("locked submission lacks a submission time");
  if (!submission.locked && submission.submittedAt)
    errors.push("draft submission has a submission time");
  if (
    submission.coderType === "agent_dry_pilot" &&
    submission.useStatus !== "dry_run_not_gold"
  )
    errors.push("agent pilot cannot become evaluation gold");
  if (containsPulseCoderForbiddenField(submission))
    errors.push("forbidden blind field leaked into submission");

  const packetIds = new Set(packet.evidence.map(({ id }) => id));
  const assessedIds = submission.evidenceAssessments.map(
    ({ evidenceId }) => evidenceId,
  );
  if (
    new Set(assessedIds).size !== assessedIds.length ||
    assessedIds.some((id) => !packetIds.has(id))
  )
    errors.push("evidence assessments are duplicated or outside the packet");
  for (const assessment of submission.evidenceAssessments) {
    if (!assessment.sourceFamilyId.trim() || !assessment.notes.trim())
      errors.push(`${assessment.evidenceId}: evidence assessment is incomplete`);
    if (
      assessment.reportedDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(assessment.reportedDate)
    )
      errors.push(`${assessment.evidenceId}: reported date is invalid`);
  }
  const allEvidenceIds = new Set(packetIds);
  for (const evidence of submission.addedEvidence) {
    if (allEvidenceIds.has(evidence.id))
      errors.push(`${evidence.id}: added evidence id is duplicated`);
    allEvidenceIds.add(evidence.id);
    if (!/^https?:\/\//.test(evidence.url) || !evidence.title.trim())
      errors.push(`${evidence.id}: added evidence identity is invalid`);
  }

  const validationSubmission: PulseCoderSubmission = {
    schemaVersion: PULSE_INDEPENDENT_CODING_VERSION,
    pilotVersion: "pulse-coder-pilot/v1",
    packetId: submission.packetId,
    coderId: submission.coderId,
    coderType: submission.coderType,
    useStatus: submission.useStatus,
    submittedAt: submission.submittedAt ?? "draft",
    locked: true,
    ...submission.answer,
  };
  errors.push(
    ...pulseCoderSubmissionErrors(
      validationSubmission,
      packetWithCoderEvidence(packet, submission),
    ),
  );
  return [...new Set(errors)];
}

function workspaceAsProtocolSubmission(
  submission: PulseCodingSubmissionEnvelope,
): PulseCoderSubmission {
  return {
    schemaVersion: PULSE_INDEPENDENT_CODING_VERSION,
    pilotVersion: "pulse-coder-pilot/v1",
    packetId: submission.packetId,
    coderId: submission.coderId,
    coderType: submission.coderType,
    useStatus: submission.useStatus,
    submittedAt: submission.submittedAt ?? "draft",
    locked: true,
    ...submission.answer,
  };
}

export function comparePulseCodingSubmissions(
  left: PulseCodingSubmissionEnvelope,
  right: PulseCodingSubmissionEnvelope,
): { comparison: PulseCodingComparison; sha256: string } {
  if (!left.locked || !right.locked)
    throw new Error("comparison requires two locked submissions");
  if (
    left.packetId !== right.packetId ||
    left.packetSnapshotSha256 !== right.packetSnapshotSha256
  )
    throw new Error("comparison requires one pinned packet snapshot");
  const protocolComparison = comparePulseCoderSubmissions(
    workspaceAsProtocolSubmission(left),
    workspaceAsProtocolSubmission(right),
  );
  const comparison: PulseCodingComparison = {
    schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
    packetId: left.packetId,
    packetSnapshotSha256: left.packetSnapshotSha256,
    coderIds: [left.coderId, right.coderId],
    submissionSha256s: [pulseCodingHash(left), pulseCodingHash(right)],
    disagreementAxes: protocolComparison.axes,
    rawSubmissionsRemainImmutable: true,
  };
  return { comparison, sha256: pulseCodingHash(comparison) };
}

export function pulseCodingCanReadOwnAssignment(
  context: PulseCodingAccessContext,
): boolean {
  return (
    context.role === "study_admin" ||
    context.assignedCoderIds.includes(context.participantId) ||
    context.assignedAdjudicatorId === context.participantId
  );
}

export function pulseCodingCanReadPeerSubmission(
  context: PulseCodingAccessContext,
): boolean {
  if (!context.bothSubmissionsLocked) return false;
  if (context.role === "study_admin") return context.adjudicationTerminal;
  if (context.role === "adjudicator")
    return (
      context.assignedAdjudicatorId === context.participantId &&
      !context.assignedCoderIds.includes(context.participantId)
    );
  return false;
}

/**
 * Whole-study exports contain every coder draft and submission, so their
 * disclosure boundary is stricter than the per-packet adjudication workspace:
 * the study must be closed, every packet must have exactly one comparison,
 * and every disagreement must have a terminal adjudication.
 */
export function pulseCodingStudyExportIsTerminal(input: {
  studyStatus: string;
  packetIds: readonly string[];
  comparisons: ReadonlyArray<{
    id: string;
    packetId: string;
    disagreementAxes: readonly unknown[];
  }>;
  adjudications: ReadonlyArray<{
    comparisonId: string;
    status: string;
  }>;
}): boolean {
  if (input.studyStatus !== "closed") return false;

  const packetIds = new Set(input.packetIds);
  if (packetIds.size !== input.packetIds.length) return false;
  if (input.comparisons.length !== packetIds.size) return false;

  const comparedPacketIds = new Set<string>();
  for (const comparison of input.comparisons) {
    if (
      !packetIds.has(comparison.packetId) ||
      comparedPacketIds.has(comparison.packetId)
    ) {
      return false;
    }
    comparedPacketIds.add(comparison.packetId);
  }

  const terminalComparisonIds = new Set(
    input.adjudications
      .filter(
        ({ status }) => status === "resolved" || status === "unresolved",
      )
      .map(({ comparisonId }) => comparisonId),
  );
  return input.comparisons
    .filter(({ disagreementAxes }) => disagreementAxes.length > 0)
    .every(({ id }) => terminalComparisonIds.has(id));
}

export function pulseCodingCanAdjudicate(
  context: PulseCodingAccessContext,
): boolean {
  return (
    context.role === "adjudicator" &&
    context.bothSubmissionsLocked &&
    context.assignedAdjudicatorId === context.participantId &&
    !context.assignedCoderIds.includes(context.participantId)
  );
}

export function pulseCodingAdjudicationErrors(
  input: PulseCodingAdjudicationInput,
  context: PulseCodingAccessContext,
): string[] {
  const errors: string[] = [];
  if (input.schemaVersion !== PULSE_CODING_WORKSPACE_VERSION)
    errors.push("wrong adjudication version");
  if (!pulseCodingCanAdjudicate(context))
    errors.push("participant is not authorized to adjudicate this packet");
  if (input.adjudicatorId !== context.participantId)
    errors.push("adjudicator identity does not match the session");
  if (!isSha256(input.comparisonSha256))
    errors.push("comparison hash is invalid");
  if (
    !input.reasonCodes.length ||
    input.reasonCodes.some(
      (code) =>
        !(PULSE_ADJUDICATION_REASON_CODES as readonly string[]).includes(code),
    )
  )
    errors.push("adjudication reason codes are invalid");
  if (containsPulseCoderForbiddenField(input))
    errors.push("forbidden answer-key field leaked into adjudication");
  if (
    input.status === "unresolved" &&
    input.resolution.kind !== "unresolved"
  )
    errors.push("unresolved status requires an unresolved resolution");
  if (
    input.status === "resolved" &&
    input.resolution.kind === "unresolved"
  )
    errors.push("resolved status cannot carry an unresolved resolution");
  if (
    input.resolution.kind === "select_submission" &&
    !context.assignedCoderIds.includes(input.resolution.coderId)
  )
    errors.push("selected submission is not part of the locked pair");
  if (
    input.resolution.kind === "new_annotation" &&
    (!PULSE_PACKET_OUTCOMES.includes(input.resolution.answer.packetOutcome) ||
      !PULSE_CODER_OBSERVATION_STATES.includes(
        input.resolution.answer.observationState,
      ))
  )
    errors.push("new adjudicated annotation is invalid");
  if (!input.resolution.rationale.trim())
    errors.push("adjudication rationale is blank");
  if (Number.isNaN(Date.parse(input.recordedAt)))
    errors.push("adjudication time is invalid");
  return errors;
}
