import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  pulseCodingAdjudications,
  pulseCodingAssignments,
  pulseCodingAuditLog,
  pulseCodingComparisons,
  pulseCodingPackets,
  pulseCodingParticipants,
  pulseCodingStudies,
} from "@/lib/db/schema";
import {
  PULSE_CODING_WORKSPACE_VERSION,
  comparePulseCodingSubmissions,
  pulseCodingCanReadPeerSubmission,
  pulseCodingStudyExportIsTerminal,
  pulseCodingAccessCodeHash,
  pulseCodingAdjudicationErrors,
  pulseCodingHash,
  pulseCodingSubmissionErrors,
  type PulseCodingAdjudicationInput,
  type PulseCodingAddedEvidence,
  type PulseCodingEvidenceAssessment,
  type PulseCodingPacketSnapshot,
  type PulseCodingStudyContract,
  type PulseCodingSubmissionEnvelope,
} from "./coding-workspace";
import type { PulseCoderAnswer } from "./coder-protocol";
import {
  parsePulseCodingExport,
  projectPulseCodingExportBody,
  type PulseCodingExport,
} from "./coding-export";
import { PulseCodingStoreError } from "./coding-errors";
import type { PulseCodingSession } from "./coding-session";

export interface PulseCodingDraftInput {
  evidenceAssessments: PulseCodingEvidenceAssessment[];
  addedEvidence: PulseCodingAddedEvidence[];
  answer: PulseCoderAnswer;
}

export interface PulseCodingAssignmentSummary {
  assignmentId: string;
  packetId: string;
  packetKey: string;
  country: string;
  iso3: string | null;
  date: string;
  status: string;
  slot: string;
  useStatus: string;
  codebookVersion: string;
  ontologyVersion: string;
}

export interface PulseCodingParticipantDashboard {
  kind: "participant";
  study: PulseCodingStudyContract;
  assignments: PulseCodingAssignmentSummary[];
}

export interface PulseCodingAdminStudySummary {
  id: string;
  slug: string;
  title: string;
  purpose: string;
  status: string;
  packets: number;
  participants: number;
  lockedCoderAssignments: number;
  comparisons: number;
  adjudicated: number;
  unresolved: number;
}

export interface PulseCodingAdminDashboard {
  kind: "admin";
  studies: PulseCodingAdminStudySummary[];
}

export type PulseCodingDashboard =
  PulseCodingParticipantDashboard | PulseCodingAdminDashboard;

const PULSE_CODING_STUDY_CONTRACT_SELECTION = {
  schemaVersion: pulseCodingStudies.schemaVersion,
  id: pulseCodingStudies.id,
  title: pulseCodingStudies.title,
  purpose: pulseCodingStudies.purpose,
  protocolVersion: pulseCodingStudies.protocolVersion,
  codebookVersion: pulseCodingStudies.codebookVersion,
  ontologyVersion: pulseCodingStudies.ontologyVersion,
  datasetVersion: pulseCodingStudies.datasetVersion,
  packetSetSha256: pulseCodingStudies.packetSetSha256,
  traceSetSha256: pulseCodingStudies.traceSetSha256,
  status: pulseCodingStudies.status,
} as const;

type PulseCodingStudyContractRow = Pick<
  typeof pulseCodingStudies.$inferSelect,
  keyof typeof PULSE_CODING_STUDY_CONTRACT_SELECTION
>;

function studyContract(
  row: PulseCodingStudyContractRow,
): PulseCodingStudyContract {
  return {
    schemaVersion:
      row.schemaVersion as PulseCodingStudyContract["schemaVersion"],
    id: row.id,
    title: row.title,
    purpose: row.purpose as PulseCodingStudyContract["purpose"],
    protocolVersion:
      row.protocolVersion as PulseCodingStudyContract["protocolVersion"],
    codebookVersion:
      row.codebookVersion as PulseCodingStudyContract["codebookVersion"],
    ontologyVersion:
      row.ontologyVersion as PulseCodingStudyContract["ontologyVersion"],
    datasetVersion: row.datasetVersion,
    packetSetSha256: row.packetSetSha256,
    traceSetSha256: row.traceSetSha256,
    status: row.status as PulseCodingStudyContract["status"],
  };
}

export async function getPulseCodingDashboard(
  session: PulseCodingSession,
): Promise<PulseCodingDashboard> {
  if (session.kind === "admin") {
    const result = await db.execute(sql`
      SELECT
        s.id,
        s.slug,
        s.title,
        s.purpose,
        s.status,
        COUNT(DISTINCT p.id)::int AS packets,
        COUNT(DISTINCT participant.id)::int AS participants,
        COUNT(DISTINCT a.id) FILTER (
          WHERE a.slot IN ('coder_a','coder_b') AND a.status = 'locked'
        )::int AS locked_coder_assignments,
        COUNT(DISTINCT comparison.id)::int AS comparisons,
        COUNT(DISTINCT adjudication.id) FILTER (
          WHERE adjudication.status = 'resolved'
        )::int AS adjudicated,
        COUNT(DISTINCT adjudication.id) FILTER (
          WHERE adjudication.status = 'unresolved'
        )::int AS unresolved
      FROM pulse_coding_studies s
      LEFT JOIN pulse_coding_packets p ON p.study_id = s.id
      LEFT JOIN pulse_coding_participants participant ON participant.study_id = s.id
      LEFT JOIN pulse_coding_assignments a ON a.packet_id = p.id
      LEFT JOIN pulse_coding_comparisons comparison ON comparison.packet_id = p.id
      LEFT JOIN pulse_coding_adjudications adjudication
        ON adjudication.comparison_id = comparison.id
      GROUP BY s.id
      ORDER BY s.created_at DESC, s.slug ASC
    `);
    const rows = ((result as unknown as { rows?: unknown[] }).rows ??
      result) as Array<Record<string, unknown>>;
    return {
      kind: "admin",
      studies: rows.map((row) => ({
        id: String(row.id),
        slug: String(row.slug),
        title: String(row.title),
        purpose: String(row.purpose),
        status: String(row.status),
        packets: Number(row.packets),
        participants: Number(row.participants),
        lockedCoderAssignments: Number(row.locked_coder_assignments),
        comparisons: Number(row.comparisons),
        adjudicated: Number(row.adjudicated),
        unresolved: Number(row.unresolved),
      })),
    };
  }

  const [studyRows, assignmentRows] = await Promise.all([
    db
      .select(PULSE_CODING_STUDY_CONTRACT_SELECTION)
      .from(pulseCodingStudies)
      .where(eq(pulseCodingStudies.id, session.studyId))
      .limit(1),
    db
      .select({
        assignmentId: pulseCodingAssignments.id,
        packetId: pulseCodingPackets.id,
        packetKey: pulseCodingPackets.packetKey,
        packetSnapshot: pulseCodingPackets.packetSnapshot,
        status: pulseCodingAssignments.status,
        slot: pulseCodingAssignments.slot,
        useStatus: pulseCodingParticipants.useStatus,
        codebookVersion: pulseCodingStudies.codebookVersion,
        ontologyVersion: pulseCodingStudies.ontologyVersion,
      })
      .from(pulseCodingAssignments)
      .innerJoin(
        pulseCodingPackets,
        eq(pulseCodingAssignments.packetId, pulseCodingPackets.id),
      )
      .innerJoin(
        pulseCodingParticipants,
        eq(pulseCodingAssignments.participantId, pulseCodingParticipants.id),
      )
      .innerJoin(
        pulseCodingStudies,
        eq(pulseCodingPackets.studyId, pulseCodingStudies.id),
      )
      .where(eq(pulseCodingAssignments.participantId, session.participantId))
      .orderBy(asc(pulseCodingPackets.packetKey)),
  ]);
  const study = studyRows[0];
  if (!study) throw new Error("Pulse coding study not found");
  return {
    kind: "participant",
    study: studyContract(study),
    assignments: assignmentRows.map((row) => {
      const packet = row.packetSnapshot as PulseCodingPacketSnapshot;
      return {
        assignmentId: row.assignmentId,
        packetId: row.packetId,
        packetKey: row.packetKey,
        country: packet.jurisdiction.name,
        iso3: packet.jurisdiction.iso3,
        date: packet.date,
        status: row.status,
        slot: row.slot,
        useStatus: row.useStatus,
        codebookVersion: row.codebookVersion,
        ontologyVersion: row.ontologyVersion,
      };
    }),
  };
}

export interface PulseCodingWorkspaceView {
  study: PulseCodingStudyContract;
  packetRecordId: string;
  packet: PulseCodingPacketSnapshot;
  assignment: {
    id: string;
    slot: string;
    status: string;
    draft: PulseCodingSubmissionEnvelope | null;
    submission: PulseCodingSubmissionEnvelope | null;
    lockedAt: string | null;
  };
  comparison: {
    id: string;
    value: Record<string, unknown>;
    sha256: string;
    axes: string[];
  } | null;
  peerSubmissions: PulseCodingSubmissionEnvelope[] | null;
  adjudication: PulseCodingAdjudicationInput | null;
}

export async function getPulseCodingWorkspace(
  session: PulseCodingSession,
  assignmentId: string,
): Promise<PulseCodingWorkspaceView | null> {
  if (session.kind !== "participant") return null;
  const rows = await db
    .select({
      assignment: {
        id: pulseCodingAssignments.id,
        slot: pulseCodingAssignments.slot,
        status: pulseCodingAssignments.status,
        draft: pulseCodingAssignments.draft,
        submission: pulseCodingAssignments.submission,
        lockedAt: pulseCodingAssignments.lockedAt,
      },
      packetRecordId: pulseCodingPackets.id,
      packet: pulseCodingPackets.packetSnapshot,
      study: PULSE_CODING_STUDY_CONTRACT_SELECTION,
    })
    .from(pulseCodingAssignments)
    .innerJoin(
      pulseCodingPackets,
      eq(pulseCodingAssignments.packetId, pulseCodingPackets.id),
    )
    .innerJoin(
      pulseCodingStudies,
      eq(pulseCodingPackets.studyId, pulseCodingStudies.id),
    )
    .where(
      and(
        eq(pulseCodingAssignments.id, assignmentId),
        eq(pulseCodingAssignments.participantId, session.participantId),
        eq(pulseCodingStudies.id, session.studyId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  let comparison: PulseCodingWorkspaceView["comparison"] = null;
  let peerSubmissions: PulseCodingSubmissionEnvelope[] | null = null;
  let adjudication: PulseCodingAdjudicationInput | null = null;
  if (session.role === "adjudicator") {
    const comparisonRows = await db
      .select({
        id: pulseCodingComparisons.id,
        comparison: pulseCodingComparisons.comparison,
        comparisonSha256: pulseCodingComparisons.comparisonSha256,
        disagreementAxes: pulseCodingComparisons.disagreementAxes,
      })
      .from(pulseCodingComparisons)
      .where(eq(pulseCodingComparisons.packetId, row.packetRecordId))
      .limit(1);
    const found = comparisonRows[0];
    if (found) {
      comparison = {
        id: found.id,
        value: found.comparison as Record<string, unknown>,
        sha256: found.comparisonSha256,
        axes: found.disagreementAxes,
      };
      const coderRows = await db
        .select({ submission: pulseCodingAssignments.submission })
        .from(pulseCodingAssignments)
        .where(
          and(
            eq(pulseCodingAssignments.packetId, row.packetRecordId),
            inArray(pulseCodingAssignments.slot, ["coder_a", "coder_b"]),
            eq(pulseCodingAssignments.status, "locked"),
          ),
        )
        .orderBy(asc(pulseCodingAssignments.slot));
      if (
        coderRows.length === 2 &&
        coderRows.every(({ submission }) => submission)
      )
        peerSubmissions = coderRows.map(
          ({ submission }) => submission as PulseCodingSubmissionEnvelope,
        );
      const adjudicationRows = await db
        .select({ resolution: pulseCodingAdjudications.resolution })
        .from(pulseCodingAdjudications)
        .where(eq(pulseCodingAdjudications.comparisonId, found.id))
        .limit(1);
      adjudication =
        (adjudicationRows[0]
          ?.resolution as PulseCodingAdjudicationInput | null) ?? null;
    }
  }

  return {
    study: studyContract(row.study),
    packetRecordId: row.packetRecordId,
    packet: row.packet as PulseCodingPacketSnapshot,
    assignment: {
      id: row.assignment.id,
      slot: row.assignment.slot,
      status: row.assignment.status,
      draft: row.assignment.draft as PulseCodingSubmissionEnvelope | null,
      submission: row.assignment
        .submission as PulseCodingSubmissionEnvelope | null,
      lockedAt: row.assignment.lockedAt?.toISOString() ?? null,
    },
    comparison,
    peerSubmissions,
    adjudication,
  };
}

function buildSubmission(
  session: Extract<PulseCodingSession, { kind: "participant" }>,
  study: PulseCodingStudyContract,
  packet: PulseCodingPacketSnapshot,
  input: PulseCodingDraftInput,
  locked: boolean,
  submittedAt: string | null,
): PulseCodingSubmissionEnvelope {
  return {
    schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
    protocolVersion: study.protocolVersion,
    codebookVersion: study.codebookVersion,
    ontologyVersion: study.ontologyVersion,
    datasetVersion: study.datasetVersion,
    packetId: packet.id,
    packetSnapshotSha256: packet.packetSnapshotSha256,
    coderId: session.pseudonym,
    coderType: session.actorType,
    useStatus: session.useStatus,
    submittedAt,
    locked,
    evidenceAssessments: input.evidenceAssessments,
    addedEvidence: input.addedEvidence,
    answer: input.answer,
  };
}

async function loadOwnedCoderAssignment(
  participantId: string,
  assignmentId: string,
) {
  const rows = await db
    .select({
      assignment: {
        status: pulseCodingAssignments.status,
        draftSha256: pulseCodingAssignments.draftSha256,
      },
      packetRecordId: pulseCodingPackets.id,
      packet: pulseCodingPackets.packetSnapshot,
      study: PULSE_CODING_STUDY_CONTRACT_SELECTION,
    })
    .from(pulseCodingAssignments)
    .innerJoin(
      pulseCodingPackets,
      eq(pulseCodingAssignments.packetId, pulseCodingPackets.id),
    )
    .innerJoin(
      pulseCodingStudies,
      eq(pulseCodingPackets.studyId, pulseCodingStudies.id),
    )
    .where(
      and(
        eq(pulseCodingAssignments.id, assignmentId),
        eq(pulseCodingAssignments.participantId, participantId),
        inArray(pulseCodingAssignments.slot, ["coder_a", "coder_b"]),
        eq(pulseCodingStudies.status, "active"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function savePulseCodingDraft(input: {
  session: PulseCodingSession;
  assignmentId: string;
  requestId: string;
  draft: PulseCodingDraftInput;
}): Promise<{ sha256: string }> {
  if (input.session.kind !== "participant" || input.session.role !== "coder")
    throw new PulseCodingStoreError(
      "FORBIDDEN",
      "Only an assigned coder can save this draft",
    );
  const row = await loadOwnedCoderAssignment(
    input.session.participantId,
    input.assignmentId,
  );
  if (!row)
    throw new PulseCodingStoreError(
      "NOT_FOUND",
      "Pulse coding assignment not found",
    );
  if (row.assignment.status === "locked")
    throw new PulseCodingStoreError(
      "CONFLICT",
      "Locked Pulse coding submissions are immutable",
    );
  const study = studyContract(row.study);
  const packet = row.packet as PulseCodingPacketSnapshot;
  const draft = buildSubmission(
    input.session,
    study,
    packet,
    input.draft,
    false,
    null,
  );
  const errors = pulseCodingSubmissionErrors(draft, packet, study).filter(
    (error) => error !== "submission is not locked",
  );
  if (errors.some((error) => error.includes("forbidden blind field")))
    throw new PulseCodingStoreError("INVALID_REQUEST_BODY", errors.join("; "));
  const sha256 = pulseCodingHash(draft);
  const result = await db.execute(sql`
    WITH updated AS (
      UPDATE pulse_coding_assignments
      SET status = 'draft',
          draft = ${JSON.stringify(draft)}::jsonb,
          draft_sha256 = ${sha256},
          draft_updated_at = NOW()
      WHERE id = ${input.assignmentId}::uuid
        AND participant_id = ${input.session.participantId}::uuid
        AND status <> 'locked'
      RETURNING id
    )
    INSERT INTO pulse_coding_audit_log (
      study_id, packet_id, participant_id, actor_id, actor_role, action,
      entity_type, entity_id, request_id, before_sha256, after_sha256, details
    )
    SELECT
      ${row.study.id}::uuid,
      ${row.packetRecordId}::uuid,
      ${input.session.participantId}::uuid,
      ${input.session.participantId},
      'coder',
      'draft_saved',
      'coding_assignment',
      updated.id::text,
      ${input.requestId},
      ${row.assignment.draftSha256},
      ${sha256},
      ${JSON.stringify({ validationErrors: errors })}::jsonb
    FROM updated
    RETURNING id
  `);
  const changed = ((result as unknown as { rows?: unknown[] }).rows ??
    result) as unknown[];
  if (changed.length !== 1)
    throw new PulseCodingStoreError(
      "CONFLICT",
      "Draft save lost the lock race",
    );
  return { sha256 };
}

export async function lockPulseCodingSubmission(input: {
  session: PulseCodingSession;
  assignmentId: string;
  requestId: string;
  draft: PulseCodingDraftInput;
}): Promise<{ submissionSha256: string; comparisonSha256: string | null }> {
  if (input.session.kind !== "participant" || input.session.role !== "coder")
    throw new PulseCodingStoreError(
      "FORBIDDEN",
      "Only an assigned coder can lock this submission",
    );
  const row = await loadOwnedCoderAssignment(
    input.session.participantId,
    input.assignmentId,
  );
  if (!row)
    throw new PulseCodingStoreError(
      "NOT_FOUND",
      "Pulse coding assignment not found",
    );
  if (row.assignment.status === "locked")
    throw new PulseCodingStoreError(
      "CONFLICT",
      "Locked Pulse coding submissions are immutable",
    );
  const study = studyContract(row.study);
  const packet = row.packet as PulseCodingPacketSnapshot;
  const submittedAt = new Date().toISOString();
  const submission = buildSubmission(
    input.session,
    study,
    packet,
    input.draft,
    true,
    submittedAt,
  );
  const errors = pulseCodingSubmissionErrors(submission, packet, study);
  if (errors.length)
    throw new PulseCodingStoreError("INVALID_REQUEST_BODY", errors.join("; "));
  const submissionSha256 = pulseCodingHash(submission);
  let comparisonSha256: string | null = null;

  const lockResult = await db.execute(sql`
    WITH updated AS (
      UPDATE pulse_coding_assignments
      SET status = 'locked',
          draft = ${JSON.stringify(submission)}::jsonb,
          draft_sha256 = ${submissionSha256},
          submission = ${JSON.stringify(submission)}::jsonb,
          submission_sha256 = ${submissionSha256},
          draft_updated_at = ${new Date(submittedAt)},
          locked_at = ${new Date(submittedAt)}
      WHERE id = ${input.assignmentId}::uuid
        AND participant_id = ${input.session.participantId}::uuid
        AND status <> 'locked'
      RETURNING id
    )
    INSERT INTO pulse_coding_audit_log (
      study_id, packet_id, participant_id, actor_id, actor_role, action,
      entity_type, entity_id, request_id, before_sha256, after_sha256, details
    )
    SELECT
      ${row.study.id}::uuid,
      ${row.packetRecordId}::uuid,
      ${input.session.participantId}::uuid,
      ${input.session.participantId},
      'coder',
      'submission_locked',
      'coding_assignment',
      updated.id::text,
      ${input.requestId},
      ${row.assignment.draftSha256},
      ${submissionSha256},
      ${JSON.stringify({ useStatus: submission.useStatus })}::jsonb
    FROM updated
    RETURNING id
  `);
  const locked = ((lockResult as unknown as { rows?: unknown[] }).rows ??
    lockResult) as unknown[];
  if (locked.length !== 1)
    throw new PulseCodingStoreError(
      "CONFLICT",
      "Submission lock lost the race",
    );

  comparisonSha256 = await ensurePulseCodingComparison(
    row.packetRecordId,
    row.study.id,
  );
  return { submissionSha256, comparisonSha256 };
}

export async function ensurePulseCodingComparison(
  packetRecordId: string,
  studyId: string,
): Promise<string | null> {
  const coderRows = await db
    .select({
      id: pulseCodingAssignments.id,
      slot: pulseCodingAssignments.slot,
      submission: pulseCodingAssignments.submission,
    })
    .from(pulseCodingAssignments)
    .where(
      and(
        eq(pulseCodingAssignments.packetId, packetRecordId),
        inArray(pulseCodingAssignments.slot, ["coder_a", "coder_b"]),
        eq(pulseCodingAssignments.status, "locked"),
      ),
    )
    .orderBy(asc(pulseCodingAssignments.slot));
  if (coderRows.length !== 2 || coderRows.some(({ submission }) => !submission))
    return null;
  const generated = comparePulseCodingSubmissions(
    coderRows[0].submission as PulseCodingSubmissionEnvelope,
    coderRows[1].submission as PulseCodingSubmissionEnvelope,
  );
  const comparisonId = randomUUID();
  const comparisonResult = await db.execute(sql`
    WITH inserted AS (
      INSERT INTO pulse_coding_comparisons (
        id, packet_id, coder_assignment_a_id, coder_assignment_b_id,
        comparison, comparison_sha256, disagreement_axes
      ) VALUES (
        ${comparisonId}::uuid,
        ${packetRecordId}::uuid,
        ${coderRows[0].id}::uuid,
        ${coderRows[1].id}::uuid,
        ${JSON.stringify(generated.comparison)}::jsonb,
        ${generated.sha256},
        ARRAY(
          SELECT jsonb_array_elements_text(
            ${JSON.stringify(generated.comparison.disagreementAxes)}::jsonb
          )
        )
      )
      ON CONFLICT (packet_id) DO NOTHING
      RETURNING id
    )
    INSERT INTO pulse_coding_audit_log (
      study_id, packet_id, actor_id, actor_role, action,
      entity_type, entity_id, after_sha256, details
    )
    SELECT
      ${studyId}::uuid,
      ${packetRecordId}::uuid,
      'system',
      'system',
      'comparison_generated',
      'coding_comparison',
      inserted.id::text,
      ${generated.sha256},
      ${JSON.stringify({
        disagreementAxes: generated.comparison.disagreementAxes,
      })}::jsonb
    FROM inserted
    RETURNING id
  `);
  const comparisonInserted = ((
    comparisonResult as unknown as { rows?: unknown[] }
  ).rows ?? comparisonResult) as unknown[];
  if (comparisonInserted.length === 0) {
    const existing = await db
      .select({ sha256: pulseCodingComparisons.comparisonSha256 })
      .from(pulseCodingComparisons)
      .where(eq(pulseCodingComparisons.packetId, packetRecordId))
      .limit(1);
    if (existing[0]?.sha256 !== generated.sha256)
      throw new PulseCodingStoreError(
        "CONFLICT",
        "Existing comparison hash differs from the locked pair",
      );
  }
  return generated.sha256;
}

export async function recordPulseCodingAdjudication(input: {
  session: PulseCodingSession;
  assignmentId: string;
  requestId: string;
  adjudication: Omit<
    PulseCodingAdjudicationInput,
    "schemaVersion" | "adjudicatorId" | "recordedAt"
  >;
}): Promise<{ resolutionSha256: string }> {
  if (
    input.session.kind !== "participant" ||
    input.session.role !== "adjudicator"
  )
    throw new PulseCodingStoreError(
      "FORBIDDEN",
      "Only the assigned adjudicator can decide this packet",
    );
  const workspace = await getPulseCodingWorkspace(
    input.session,
    input.assignmentId,
  );
  if (!workspace?.comparison || !workspace.peerSubmissions)
    throw new PulseCodingStoreError(
      "CONFLICT",
      "Both independent submissions must lock before adjudication",
    );
  if (workspace.adjudication)
    throw new PulseCodingStoreError(
      "CONFLICT",
      "Terminal adjudication is immutable",
    );
  const assignmentIds = await db
    .select({ participantId: pulseCodingAssignments.participantId })
    .from(pulseCodingAssignments)
    .where(
      and(
        eq(pulseCodingAssignments.packetId, workspace.packetRecordId),
        inArray(pulseCodingAssignments.slot, ["coder_a", "coder_b"]),
      ),
    );
  const adjudication: PulseCodingAdjudicationInput = {
    ...input.adjudication,
    schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
    adjudicatorId: input.session.participantId,
    recordedAt: new Date().toISOString(),
  };
  const context = {
    participantId: input.session.participantId,
    role: input.session.role,
    assignedCoderIds: assignmentIds.map(
      ({ participantId }) => participantId,
    ) as [string, string],
    assignedAdjudicatorId: input.session.participantId,
    ownSubmissionLocked: false,
    bothSubmissionsLocked: true,
    adjudicationTerminal: false,
  };
  const errors = pulseCodingAdjudicationErrors(adjudication, context);
  if (errors.length)
    throw new PulseCodingStoreError("INVALID_REQUEST_BODY", errors.join("; "));
  if (adjudication.comparisonSha256 !== workspace.comparison.sha256)
    throw new PulseCodingStoreError(
      "CONFLICT",
      "Adjudication points to another comparison",
    );
  const resolutionSha256 = pulseCodingHash(adjudication);
  const status = adjudication.status;

  const adjudicationId = randomUUID();
  const result = await db.execute(sql`
    WITH inserted AS (
      INSERT INTO pulse_coding_adjudications (
        id, comparison_id, adjudicator_assignment_id, status, resolution,
        resolution_sha256, reason_codes, notes, resolved_at
      ) VALUES (
        ${adjudicationId}::uuid,
        ${workspace.comparison.id}::uuid,
        ${input.assignmentId}::uuid,
        ${status},
        ${JSON.stringify(adjudication)}::jsonb,
        ${resolutionSha256},
        ARRAY(
          SELECT jsonb_array_elements_text(
            ${JSON.stringify(adjudication.reasonCodes)}::jsonb
          )
        ),
        ${adjudication.resolution.rationale},
        ${new Date(adjudication.recordedAt)}
      )
      RETURNING id
    )
    INSERT INTO pulse_coding_audit_log (
      study_id, packet_id, participant_id, actor_id, actor_role, action,
      entity_type, entity_id, request_id, after_sha256, details
    )
    SELECT
      ${workspace.study.id}::uuid,
      ${workspace.packetRecordId}::uuid,
      ${input.session.participantId}::uuid,
      ${input.session.participantId},
      'adjudicator',
      'adjudication_recorded',
      'coding_adjudication',
      inserted.id::text,
      ${input.requestId},
      ${resolutionSha256},
      ${JSON.stringify({
        status,
        reasonCodes: adjudication.reasonCodes,
      })}::jsonb
    FROM inserted
    RETURNING id
  `);
  const inserted = ((result as unknown as { rows?: unknown[] }).rows ??
    result) as unknown[];
  if (inserted.length !== 1) throw new Error("Adjudication was not recorded");
  return { resolutionSha256 };
}

export async function issuePulseCodingParticipant(input: {
  actorId: string;
  /** Optional preallocated ID lets the owner-admin audit name the exact target. */
  participantId?: string;
  studyId: string;
  pseudonym: string;
  slot: "coder_a" | "coder_b" | "adjudicator";
  actorType: "qualified_human" | "agent_dry_pilot";
  useStatus: "evaluation_candidate" | "dry_run_not_gold";
  expiresAt: Date | null;
  requestId: string;
}): Promise<{
  participantId: string;
  accessCode: string;
  assignments: number;
}> {
  const role = input.slot === "adjudicator" ? "adjudicator" : "coder";
  if (
    input.actorType === "agent_dry_pilot" &&
    input.useStatus !== "dry_run_not_gold"
  )
    throw new Error("Agent participants are permanently non-gold");
  const accessCode = `pc_${randomBytes(32).toString("base64url")}`;
  const credentialHash = pulseCodingAccessCodeHash(accessCode);
  const participantId = input.participantId ?? randomUUID();
  const [studies, packets] = await Promise.all([
    db
      .select({ id: pulseCodingStudies.id })
      .from(pulseCodingStudies)
      .where(eq(pulseCodingStudies.id, input.studyId))
      .limit(1),
    db
      .select({ id: pulseCodingPackets.id })
      .from(pulseCodingPackets)
      .where(eq(pulseCodingPackets.studyId, input.studyId)),
  ]);
  if (!studies[0]) throw new Error("Pulse coding study not found");
  if (!packets.length) throw new Error("Pulse coding study has no packets");
  const assignmentRows = packets.map(({ id }) => ({
    id: randomUUID(),
    packetId: id,
    participantId,
    slot: input.slot,
  }));
  await db.batch([
    db.insert(pulseCodingParticipants).values({
      id: participantId,
      studyId: input.studyId,
      pseudonym: input.pseudonym,
      role,
      actorType: input.actorType,
      useStatus: input.useStatus,
      credentialHash,
      expiresAt: input.expiresAt,
    }),
    db.insert(pulseCodingAssignments).values(assignmentRows),
    db.insert(pulseCodingAuditLog).values([
      {
        studyId: input.studyId,
        participantId,
        actorId: input.actorId,
        actorRole: "study_admin",
        action: "participant_issued",
        entityType: "coding_participant",
        entityId: participantId,
        requestId: input.requestId,
        afterSha256: pulseCodingHash({
          participantId,
          pseudonym: input.pseudonym,
          role,
          actorType: input.actorType,
          useStatus: input.useStatus,
        }),
        details: { slot: input.slot, accessCodeRetained: false },
      },
      ...assignmentRows.map((assignment) => ({
        studyId: input.studyId,
        packetId: assignment.packetId,
        participantId,
        actorId: input.actorId,
        actorRole: "study_admin" as const,
        action: "assignment_created" as const,
        entityType: "coding_assignment",
        entityId: assignment.id,
        details: { slot: input.slot },
      })),
    ]),
  ]);
  return { participantId, accessCode, assignments: assignmentRows.length };
}

export async function exportPulseCodingStudy(
  session: PulseCodingSession,
  studyId: string,
): Promise<PulseCodingExport> {
  if (session.role !== "study_admin" && session.role !== "adjudicator")
    throw new Error(
      "Coding study export requires an adjudicator or study admin",
    );
  if (session.kind === "participant" && session.studyId !== studyId)
    throw new Error("Participant cannot export another study");
  const [
    studies,
    packets,
    participants,
    assignments,
    comparisons,
    adjudications,
    audit,
  ] = await Promise.all([
    db
      .select({
        id: pulseCodingStudies.id,
        slug: pulseCodingStudies.slug,
        schemaVersion: pulseCodingStudies.schemaVersion,
        title: pulseCodingStudies.title,
        purpose: pulseCodingStudies.purpose,
        protocolVersion: pulseCodingStudies.protocolVersion,
        codebookVersion: pulseCodingStudies.codebookVersion,
        ontologyVersion: pulseCodingStudies.ontologyVersion,
        datasetVersion: pulseCodingStudies.datasetVersion,
        packetSetSha256: pulseCodingStudies.packetSetSha256,
        traceSetSha256: pulseCodingStudies.traceSetSha256,
        status: pulseCodingStudies.status,
        createdBy: pulseCodingStudies.createdBy,
        createdAt: pulseCodingStudies.createdAt,
        closedAt: pulseCodingStudies.closedAt,
      })
      .from(pulseCodingStudies)
      .where(eq(pulseCodingStudies.id, studyId)),
    db
      .select({
        id: pulseCodingPackets.id,
        studyId: pulseCodingPackets.studyId,
        packetKey: pulseCodingPackets.packetKey,
        analysisStatus: pulseCodingPackets.analysisStatus,
        packetSnapshot: pulseCodingPackets.packetSnapshot,
        packetSnapshotSha256: pulseCodingPackets.packetSnapshotSha256,
        importedAt: pulseCodingPackets.importedAt,
      })
      .from(pulseCodingPackets)
      .where(eq(pulseCodingPackets.studyId, studyId)),
    db
      .select({
        id: pulseCodingParticipants.id,
        pseudonym: pulseCodingParticipants.pseudonym,
        role: pulseCodingParticipants.role,
        actorType: pulseCodingParticipants.actorType,
        useStatus: pulseCodingParticipants.useStatus,
        status: pulseCodingParticipants.status,
        createdAt: pulseCodingParticipants.createdAt,
        revokedAt: pulseCodingParticipants.revokedAt,
      })
      .from(pulseCodingParticipants)
      .where(eq(pulseCodingParticipants.studyId, studyId)),
    db
      .select({
        id: pulseCodingAssignments.id,
        packetId: pulseCodingAssignments.packetId,
        participantId: pulseCodingAssignments.participantId,
        slot: pulseCodingAssignments.slot,
        status: pulseCodingAssignments.status,
        draft: pulseCodingAssignments.draft,
        draftSha256: pulseCodingAssignments.draftSha256,
        submission: pulseCodingAssignments.submission,
        submissionSha256: pulseCodingAssignments.submissionSha256,
        assignedAt: pulseCodingAssignments.assignedAt,
        draftUpdatedAt: pulseCodingAssignments.draftUpdatedAt,
        lockedAt: pulseCodingAssignments.lockedAt,
      })
      .from(pulseCodingAssignments)
      .innerJoin(
        pulseCodingPackets,
        eq(pulseCodingAssignments.packetId, pulseCodingPackets.id),
      )
      .where(eq(pulseCodingPackets.studyId, studyId)),
    db
      .select({
        id: pulseCodingComparisons.id,
        packetId: pulseCodingComparisons.packetId,
        coderAssignmentAId: pulseCodingComparisons.coderAssignmentAId,
        coderAssignmentBId: pulseCodingComparisons.coderAssignmentBId,
        comparison: pulseCodingComparisons.comparison,
        comparisonSha256: pulseCodingComparisons.comparisonSha256,
        disagreementAxes: pulseCodingComparisons.disagreementAxes,
        generatedAt: pulseCodingComparisons.generatedAt,
      })
      .from(pulseCodingComparisons)
      .innerJoin(
        pulseCodingPackets,
        eq(pulseCodingComparisons.packetId, pulseCodingPackets.id),
      )
      .where(eq(pulseCodingPackets.studyId, studyId)),
    db
      .select({
        id: pulseCodingAdjudications.id,
        comparisonId: pulseCodingAdjudications.comparisonId,
        adjudicatorAssignmentId:
          pulseCodingAdjudications.adjudicatorAssignmentId,
        status: pulseCodingAdjudications.status,
        resolution: pulseCodingAdjudications.resolution,
        resolutionSha256: pulseCodingAdjudications.resolutionSha256,
        reasonCodes: pulseCodingAdjudications.reasonCodes,
        notes: pulseCodingAdjudications.notes,
        createdAt: pulseCodingAdjudications.createdAt,
        resolvedAt: pulseCodingAdjudications.resolvedAt,
      })
      .from(pulseCodingAdjudications)
      .innerJoin(
        pulseCodingComparisons,
        eq(pulseCodingAdjudications.comparisonId, pulseCodingComparisons.id),
      )
      .innerJoin(
        pulseCodingPackets,
        eq(pulseCodingComparisons.packetId, pulseCodingPackets.id),
      )
      .where(eq(pulseCodingPackets.studyId, studyId)),
    db
      .select({
        id: pulseCodingAuditLog.id,
        studyId: pulseCodingAuditLog.studyId,
        packetId: pulseCodingAuditLog.packetId,
        participantId: pulseCodingAuditLog.participantId,
        actorId: pulseCodingAuditLog.actorId,
        actorRole: pulseCodingAuditLog.actorRole,
        action: pulseCodingAuditLog.action,
        entityType: pulseCodingAuditLog.entityType,
        entityId: pulseCodingAuditLog.entityId,
        requestId: pulseCodingAuditLog.requestId,
        beforeSha256: pulseCodingAuditLog.beforeSha256,
        afterSha256: pulseCodingAuditLog.afterSha256,
        details: pulseCodingAuditLog.details,
        createdAt: pulseCodingAuditLog.createdAt,
      })
      .from(pulseCodingAuditLog)
      .where(eq(pulseCodingAuditLog.studyId, studyId))
      .orderBy(asc(pulseCodingAuditLog.createdAt), asc(pulseCodingAuditLog.id)),
  ]);
  if (!studies[0]) throw new Error("Pulse coding study not found");
  const study = studies[0];
  const assignmentRows = assignments;
  const comparisonRows = comparisons;
  const adjudicationRows = adjudications;
  const terminal = pulseCodingStudyExportIsTerminal({
    studyStatus: study.status,
    packetIds: packets.map(({ id }) => id),
    comparisons: comparisonRows,
    adjudications: adjudicationRows,
  });
  if (!terminal)
    throw new Error(
      "Study admins receive status only until the study is closed and every disagreement is terminal",
    );

  if (session.kind !== "admin") {
    const assignedPacketIds = new Set(
      assignmentRows
        .filter(
          ({ participantId, slot }) =>
            participantId === session.participantId && slot === "adjudicator",
        )
        .map(({ packetId }) => packetId),
    );
    const allPacketsReadyForAdjudicator = packets.every(({ id: packetId }) => {
      const coderAssignments = assignmentRows.filter(
        ({ packetId: assignmentPacketId, slot }) =>
          assignmentPacketId === packetId &&
          (slot === "coder_a" || slot === "coder_b"),
      );
      if (coderAssignments.length !== 2) return false;
      const bothCoderSubmissionsLocked = coderAssignments.every(
        ({ status, submission }) => status === "locked" && submission != null,
      );
      return pulseCodingCanReadPeerSubmission({
        participantId: session.participantId,
        role: session.role,
        assignedCoderIds: [
          coderAssignments[0].participantId,
          coderAssignments[1].participantId,
        ],
        assignedAdjudicatorId: assignedPacketIds.has(packetId)
          ? session.participantId
          : null,
        ownSubmissionLocked: false,
        bothSubmissionsLocked: bothCoderSubmissionsLocked,
        adjudicationTerminal: false,
      });
    });
    if (
      assignedPacketIds.size !== packets.length ||
      comparisonRows.some(({ packetId }) => !assignedPacketIds.has(packetId)) ||
      !allPacketsReadyForAdjudicator
    )
      throw new Error(
        "Adjudicator export is limited to a fully assigned study queue",
      );
  }
  const body = projectPulseCodingExportBody({
    study,
    packets,
    participants,
    assignments: assignmentRows,
    comparisons: comparisonRows,
    adjudications: adjudicationRows,
    audit,
  });
  const semanticSha256 = pulseCodingHash(body);
  const exportedAt = new Date().toISOString();
  await db.insert(pulseCodingAuditLog).values({
    studyId,
    participantId: session.participantId,
    actorId: session.participantId ?? session.pseudonym,
    actorRole: session.role,
    action: "export_generated",
    entityType: "coding_study",
    entityId: studyId,
    afterSha256: semanticSha256,
    details: { schemaVersion: body.schemaVersion },
  });
  return parsePulseCodingExport({ ...body, exportedAt, semanticSha256 });
}
