import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PULSE_CODING_EXPORT_CLAIM_BOUNDARY,
  PULSE_CODING_EXPORT_SCHEMA_VERSION,
  parsePulseCodingExport,
  projectPulseCodingExportBody,
  type PulseCodingExportSourceRows,
} from "./coding-export";
import {
  PULSE_CODING_WORKSPACE_VERSION,
  pulseCodingHash,
} from "./coding-workspace";

const NOW = "2026-07-14T12:00:00.000Z";
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const IDS = {
  study: "00000000-0000-4000-8000-000000000001",
  packet: "00000000-0000-4000-8000-000000000002",
  participant: "00000000-0000-4000-8000-000000000003",
  assignmentA: "00000000-0000-4000-8000-000000000004",
  assignmentB: "00000000-0000-4000-8000-000000000005",
  comparison: "00000000-0000-4000-8000-000000000006",
  adjudication: "00000000-0000-4000-8000-000000000007",
  audit: "00000000-0000-4000-8000-000000000008",
  exportAudit: "00000000-0000-4000-8000-000000000009",
} as const;

function sourceRows(): PulseCodingExportSourceRows {
  return {
    study: {
      id: IDS.study,
      slug: "sentinel-study",
      schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
      title: "Sentinel study",
      purpose: "evaluation",
      protocolVersion: "pulse-independent-coding/v1",
      codebookVersion: "pulse-independent-coding/v1",
      ontologyVersion: "pulse-event-ontology/v1",
      datasetVersion: "fixture-v1",
      packetSetSha256: SHA_A,
      traceSetSha256: null,
      status: "closed",
      createdBy: "study-owner",
      createdAt: NOW,
      closedAt: NOW,
      futurePrivateStudyColumn: "DROP_STUDY_PRIVATE",
      secretToken: "DROP_STUDY_SECRET",
    },
    packets: [
      {
        id: IDS.packet,
        studyId: IDS.study,
        packetKey: "packet-1",
        analysisStatus: "analysis_candidate",
        packetSnapshot: { schemaVersion: PULSE_CODING_WORKSPACE_VERSION },
        packetSnapshotSha256: SHA_A,
        importedAt: NOW,
        privatePublisherPayload: "DROP_PACKET_PRIVATE",
      },
    ],
    participants: [
      {
        id: IDS.participant,
        pseudonym: "coder-001",
        role: "coder",
        actorType: "qualified_human",
        useStatus: "evaluation_candidate",
        status: "active",
        createdAt: NOW,
        revokedAt: null,
        credentialHash: SHA_B,
        credential_hash: SHA_B,
        passwordHash: SHA_B,
        futurePrivateParticipantColumn: "DROP_PARTICIPANT_PRIVATE",
      },
    ],
    assignments: [
      {
        id: IDS.assignmentA,
        packetId: IDS.packet,
        participantId: IDS.participant,
        slot: "coder_a",
        status: "assigned",
        draft: null,
        draftSha256: null,
        submission: null,
        submissionSha256: null,
        assignedAt: NOW,
        draftUpdatedAt: null,
        lockedAt: null,
        privateReviewerIp: "DROP_ASSIGNMENT_PRIVATE",
      },
    ],
    comparisons: [
      {
        id: IDS.comparison,
        packetId: IDS.packet,
        coderAssignmentAId: IDS.assignmentA,
        coderAssignmentBId: IDS.assignmentB,
        comparison: { schemaVersion: PULSE_CODING_WORKSPACE_VERSION },
        comparisonSha256: SHA_A,
        disagreementAxes: [],
        generatedAt: NOW,
        privateModelTrace: "DROP_COMPARISON_PRIVATE",
      },
    ],
    adjudications: [
      {
        id: IDS.adjudication,
        comparisonId: IDS.comparison,
        adjudicatorAssignmentId: IDS.assignmentB,
        status: "pending",
        resolution: null,
        resolutionSha256: null,
        reasonCodes: [],
        notes: null,
        createdAt: NOW,
        resolvedAt: null,
        secretAdjudicatorIdentity: "DROP_ADJUDICATION_SECRET",
      },
    ],
    audit: [
      {
        id: IDS.audit,
        studyId: IDS.study,
        packetId: IDS.packet,
        participantId: IDS.participant,
        actorId: "coder-001",
        actorRole: "coder",
        action: "access_granted",
        entityType: "coding_session",
        entityId: IDS.participant,
        requestId: null,
        beforeSha256: null,
        afterSha256: null,
        details: { accessCodeRetained: false },
        createdAt: NOW,
        privateNetworkAddress: "DROP_AUDIT_PRIVATE",
      },
      {
        id: IDS.exportAudit,
        studyId: IDS.study,
        packetId: null,
        participantId: IDS.participant,
        actorId: "coder-001",
        actorRole: "adjudicator",
        action: "export_generated",
        entityType: "coding_study",
        entityId: IDS.study,
        requestId: null,
        beforeSha256: null,
        afterSha256: SHA_A,
        details: { schemaVersion: PULSE_CODING_EXPORT_SCHEMA_VERSION },
        createdAt: NOW,
        futureSecretExportColumn: "DROP_EXPORT_AUDIT_SECRET",
      },
    ],
  };
}

test("closed projection preserves v1 fields and drops credentials/private future columns", () => {
  const body = projectPulseCodingExportBody(sourceRows());

  assert.equal(body.schemaVersion, PULSE_CODING_EXPORT_SCHEMA_VERSION);
  assert.equal(body.claimBoundary, PULSE_CODING_EXPORT_CLAIM_BOUNDARY);
  assert.deepEqual(Object.keys(body.study), [
    "id",
    "slug",
    "schemaVersion",
    "title",
    "purpose",
    "protocolVersion",
    "codebookVersion",
    "ontologyVersion",
    "datasetVersion",
    "packetSetSha256",
    "traceSetSha256",
    "status",
    "createdBy",
    "createdAt",
    "closedAt",
  ]);
  assert.deepEqual(Object.keys(body.packets[0]), [
    "id",
    "studyId",
    "packetKey",
    "analysisStatus",
    "packetSnapshot",
    "packetSnapshotSha256",
    "importedAt",
  ]);
  assert.deepEqual(Object.keys(body.participants[0]), [
    "id",
    "pseudonym",
    "role",
    "actorType",
    "useStatus",
    "status",
    "createdAt",
    "revokedAt",
  ]);
  assert.deepEqual(Object.keys(body.assignments[0]), [
    "id",
    "packetId",
    "participantId",
    "slot",
    "status",
    "draft",
    "draftSha256",
    "submission",
    "submissionSha256",
    "assignedAt",
    "draftUpdatedAt",
    "lockedAt",
  ]);
  assert.deepEqual(Object.keys(body.comparisons[0]), [
    "id",
    "packetId",
    "coderAssignmentAId",
    "coderAssignmentBId",
    "comparison",
    "comparisonSha256",
    "disagreementAxes",
    "generatedAt",
  ]);
  assert.deepEqual(Object.keys(body.adjudications[0]), [
    "id",
    "comparisonId",
    "adjudicatorAssignmentId",
    "status",
    "resolution",
    "resolutionSha256",
    "reasonCodes",
    "notes",
    "createdAt",
    "resolvedAt",
  ]);
  assert.deepEqual(Object.keys(body.audit[0]), [
    "id",
    "studyId",
    "packetId",
    "participantId",
    "actorId",
    "actorRole",
    "action",
    "entityType",
    "entityId",
    "requestId",
    "beforeSha256",
    "afterSha256",
    "details",
    "createdAt",
  ]);
  assert.equal(body.audit.length, 1, "prior export audit rows stay excluded");

  const serialized = JSON.stringify(body);
  assert.doesNotMatch(
    serialized,
    /credentialHash|credential_hash|passwordHash|secretToken|futurePrivate|privatePublisher|privateReviewer|privateModel|secretAdjudicator|privateNetwork|futureSecret|DROP_/,
  );
});

test("strict v1 response parser accepts only a hash-consistent closed artifact", () => {
  const body = projectPulseCodingExportBody(sourceRows());
  const artifact = parsePulseCodingExport({
    ...body,
    exportedAt: NOW,
    semanticSha256: pulseCodingHash(body),
  });

  assert.equal(artifact.exportedAt, NOW);
  assert.equal(artifact.semanticSha256, pulseCodingHash(body));

  assert.throws(() =>
    parsePulseCodingExport({
      ...artifact,
      schemaVersion: "pulse-coding-export/v2",
    }),
  );
  assert.throws(() =>
    parsePulseCodingExport({
      ...artifact,
      credentialHash: SHA_A,
    }),
  );
  assert.throws(() =>
    parsePulseCodingExport({
      ...artifact,
      participants: [
        {
          ...artifact.participants[0],
          futurePrivateParticipantColumn: "must-fail",
        },
      ],
    }),
  );
  assert.throws(() =>
    parsePulseCodingExport({
      ...artifact,
      exportedAt: "not-a-timestamp",
    }),
  );
  assert.throws(
    () =>
      parsePulseCodingExport({
        ...artifact,
        semanticSha256: SHA_B,
      }),
    /semantic hash does not match/,
  );
});

test("projection fails closed when an intended field is missing or malformed", () => {
  const missingPseudonym = sourceRows();
  delete (missingPseudonym.participants[0] as Record<string, unknown>)
    .pseudonym;
  assert.throws(() => projectPulseCodingExportBody(missingPseudonym));

  const invalidStudyVersion = sourceRows();
  (invalidStudyVersion.study as Record<string, unknown>).schemaVersion =
    "pulse-coding-workspace/v2";
  assert.throws(() => projectPulseCodingExportBody(invalidStudyVersion));

  const invalidRows = sourceRows();
  invalidRows.assignments = [null];
  assert.throws(
    () => projectPulseCodingExportBody(invalidRows),
    /assignment export row must be an object/,
  );

  const nestedCredential = sourceRows();
  (nestedCredential.audit[0] as Record<string, unknown>).details = {
    credential_hash: SHA_A,
  };
  assert.throws(
    () => projectPulseCodingExportBody(nestedCredential),
    /contains a credential hash/,
  );
});

test("coding store contains no whole-table Drizzle selections", () => {
  const source = readFileSync("src/lib/pulse/v2/coding-store.ts", "utf8");
  assert.doesNotMatch(source, /[.]select\(\s*\)/);
  assert.doesNotMatch(
    source,
    /:\s*pulseCoding(?:Studies|Packets|Participants|Assignments|Comparisons|Adjudications|AuditLog)\s*[,}]/,
  );

  const exportSource = source.slice(
    source.indexOf("export async function exportPulseCodingStudy"),
  );
  assert.doesNotMatch(exportSource, /credentialHash|credential_hash/);
});

test("adjudicator exports retain terminal-study and blind-read predicates", () => {
  const source = readFileSync("src/lib/pulse/v2/coding-store.ts", "utf8");
  const exportSource = source.slice(
    source.indexOf("export async function exportPulseCodingStudy"),
  );

  assert.match(exportSource, /pulseCodingCanReadPeerSubmission/);
  assert.match(exportSource, /pulseCodingStudyExportIsTerminal/);
  assert.match(exportSource, /bothCoderSubmissionsLocked/);
  assert.match(
    exportSource,
    /Adjudicator export is limited to a fully assigned study queue/,
  );
});
