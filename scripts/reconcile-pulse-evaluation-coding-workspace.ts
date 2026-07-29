import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { config } from "dotenv";
import { db } from "../src/lib/db";
import {
  pulseCodingAssignments,
  pulseCodingAuditLog,
  pulseCodingPackets,
  pulseCodingParticipants,
  pulseCodingStudies,
} from "../src/lib/db/schema";
import {
  PULSE_EVALUATION_BATCH_A_FRAME,
  PULSE_EVALUATION_BATCH_A_LEGACY,
  PULSE_EVALUATION_BATCH_A_RECONCILED,
  PULSE_EVALUATION_BATCH_B_FRAME,
  PULSE_EVALUATION_BATCH_B_LEGACY,
  PULSE_EVALUATION_BATCH_B_RECONCILED,
  PULSE_EVALUATION_BATCH_B_WORKSPACE_RECONCILIATION_VERSION,
  PULSE_EVALUATION_WORKSPACE_RECONCILIATION_VERSION,
  pulseEvaluationWorkspaceReconciliationPlan,
} from "../src/lib/pulse/v2/evaluation-workspace-reconciliation";
import type { PulseEvaluationPacketFrame } from "../src/lib/pulse/v2/evaluation-packets";
import { pulseCodingHash } from "../src/lib/pulse/v2/coding-workspace";
import {
  buildSnapshots,
  deterministicUuid,
  evaluationPacketManifest,
  loadPrivateEvidence,
} from "./seed-pulse-evaluation-coding-studies";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

type ReconciliationSpec = {
  label: string;
  frame: PulseEvaluationPacketFrame;
  legacy: {
    slug: string;
    id: string;
    packetSetSha256: string;
  };
  reconciled: {
    slug: string;
    datasetVersionSuffix: string;
    title: string;
    packetSetSha256: string;
    supersessionReason: "frozen_packet_hash_mismatch";
  };
  reconciliationVersion: string;
};

const RECONCILIATIONS: readonly ReconciliationSpec[] = [
  {
    label: "batch A",
    frame: PULSE_EVALUATION_BATCH_A_FRAME,
    legacy: PULSE_EVALUATION_BATCH_A_LEGACY,
    reconciled: PULSE_EVALUATION_BATCH_A_RECONCILED,
    reconciliationVersion: PULSE_EVALUATION_WORKSPACE_RECONCILIATION_VERSION,
  },
  {
    label: "batch B",
    frame: PULSE_EVALUATION_BATCH_B_FRAME,
    legacy: PULSE_EVALUATION_BATCH_B_LEGACY,
    reconciled: PULSE_EVALUATION_BATCH_B_RECONCILED,
    reconciliationVersion:
      PULSE_EVALUATION_BATCH_B_WORKSPACE_RECONCILIATION_VERSION,
  },
];

const studyFields = {
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
  supersedesStudyId: pulseCodingStudies.supersedesStudyId,
  supersessionReason: pulseCodingStudies.supersessionReason,
  status: pulseCodingStudies.status,
  createdBy: pulseCodingStudies.createdBy,
  createdAt: pulseCodingStudies.createdAt,
  closedAt: pulseCodingStudies.closedAt,
};

type StudyRow = Awaited<ReturnType<typeof getStudy>>;

function expectedSuccessor(spec: ReconciliationSpec) {
  const plan = pulseEvaluationWorkspaceReconciliationPlan(
    evaluationPacketManifest.semanticSha256,
    evaluationPacketManifest.schemaVersion,
    spec.legacy.id,
    deterministicUuid,
    spec.frame,
    spec.reconciled.datasetVersionSuffix,
  );
  const packets = evaluationPacketManifest.packets.filter(
    (packet) => packet.frame === spec.frame,
  );
  return {
    ...plan,
    packets,
  };
}

async function getStudy(slug: string) {
  return (
    await db
      .select(studyFields)
      .from(pulseCodingStudies)
      .where(eq(pulseCodingStudies.slug, slug))
      .limit(1)
  )[0];
}

async function studyState(studyId: string) {
  const [packets, participants, assignments, auditRows] = await Promise.all([
    db
      .select()
      .from(pulseCodingPackets)
      .where(eq(pulseCodingPackets.studyId, studyId)),
    db
      .select()
      .from(pulseCodingParticipants)
      .where(eq(pulseCodingParticipants.studyId, studyId)),
    db
      .select({ id: pulseCodingAssignments.id })
      .from(pulseCodingAssignments)
      .innerJoin(
        pulseCodingPackets,
        and(
          eq(pulseCodingAssignments.packetId, pulseCodingPackets.id),
          eq(pulseCodingPackets.studyId, studyId),
        ),
      ),
    db
      .select()
      .from(pulseCodingAuditLog)
      .where(eq(pulseCodingAuditLog.studyId, studyId)),
  ]);
  return { packets, participants, assignments, auditRows };
}

function immutableStudyFingerprint(
  study: NonNullable<StudyRow>,
  state: Awaited<ReturnType<typeof studyState>>,
) {
  return pulseCodingHash({
    study,
    packets: [...state.packets].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    participants: [...state.participants].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    assignments: [...state.assignments].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    auditRows: [...state.auditRows].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  });
}

async function validateLegacy(spec: ReconciliationSpec) {
  const plan = expectedSuccessor(spec);
  const legacy = await getStudy(spec.legacy.slug);
  assert.ok(legacy, `legacy ${spec.label} study is missing`);
  assert.equal(
    legacy.id,
    spec.legacy.id,
    `legacy ${spec.label} identity drifted`,
  );
  assert.equal(
    legacy.status,
    "setup",
    `legacy ${spec.label} study access is enabled`,
  );
  assert.equal(
    legacy.purpose,
    "evaluation",
    `legacy ${spec.label} purpose drifted`,
  );
  assert.equal(
    legacy.packetSetSha256,
    spec.legacy.packetSetSha256,
    `legacy ${spec.label} packet-set hash was rewritten instead of preserved`,
  );
  assert.equal(
    legacy.supersedesStudyId,
    null,
    `legacy ${spec.label} unexpectedly supersedes another study`,
  );
  assert.equal(
    legacy.supersessionReason,
    null,
    `legacy ${spec.label} supersession state drifted`,
  );
  const state = await studyState(legacy.id);
  assert.equal(
    state.packets.length,
    plan.packets.length,
    `legacy ${spec.label} packet count drifted`,
  );
  assert.equal(
    state.participants.length,
    0,
    `legacy ${spec.label} gained participants`,
  );
  assert.equal(
    state.assignments.length,
    0,
    `legacy ${spec.label} gained assignments`,
  );
  return {
    legacy,
    state,
    fingerprint: immutableStudyFingerprint(legacy, state),
  };
}

async function validateSuccessor(
  spec: ReconciliationSpec,
  plan: ReturnType<typeof expectedSuccessor>,
  legacyId: string,
) {
  const row = await getStudy(spec.reconciled.slug);
  assert.ok(row, `reconciled ${spec.label} study is missing`);
  assert.equal(
    row.id,
    plan.successorStudyId,
    `reconciled ${spec.label} identity drifted`,
  );
  assert.equal(
    row.status,
    "setup",
    `reconciled ${spec.label} study access is enabled`,
  );
  assert.equal(
    row.purpose,
    "evaluation",
    `reconciled ${spec.label} purpose drifted`,
  );
  assert.equal(
    row.supersedesStudyId,
    legacyId,
    `reconciled ${spec.label} has the wrong predecessor`,
  );
  assert.equal(
    row.supersessionReason,
    spec.reconciled.supersessionReason,
    `reconciled ${spec.label} has the wrong supersession reason`,
  );
  const evidenceById = await loadPrivateEvidence();
  const rebuilt = buildSnapshots(
    spec.frame,
    plan.successorStudyId,
    plan.packets,
    evidenceById,
    {
      datasetVersion: plan.successorDatasetVersion,
      title: spec.reconciled.title,
    },
  );
  assert.equal(
    rebuilt.study.packetSetSha256,
    spec.reconciled.packetSetSha256,
    `reconciled ${spec.label} expected packet-set hash drifted`,
  );
  assert.equal(
    row.packetSetSha256,
    rebuilt.study.packetSetSha256,
    `reconciled ${spec.label} packet-set hash drifted`,
  );
  assert.equal(
    row.datasetVersion,
    plan.successorDatasetVersion,
    `reconciled ${spec.label} dataset version drifted`,
  );
  assert.equal(row.title, spec.reconciled.title);
  const state = await studyState(row.id);
  assert.equal(
    state.packets.length,
    rebuilt.snapshots.length,
    `reconciled ${spec.label} packet count drifted`,
  );
  assert.equal(
    state.participants.length,
    0,
    `reconciled ${spec.label} gained participants`,
  );
  assert.equal(
    state.assignments.length,
    0,
    `reconciled ${spec.label} gained assignments`,
  );
  const actualByKey = new Map(
    state.packets.map((packet) => [packet.packetKey, packet]),
  );
  for (const snapshot of rebuilt.snapshots) {
    const actual = actualByKey.get(snapshot.id);
    assert.ok(
      actual,
      `reconciled ${spec.label}/${snapshot.id}: packet is missing`,
    );
    assert.equal(actual.packetSnapshotSha256, snapshot.packetSnapshotSha256);
    assert.deepEqual(actual.packetSnapshot, snapshot);
  }
  return { row, rebuilt, state };
}

async function applySuccessor(
  spec: ReconciliationSpec,
  plan: ReturnType<typeof expectedSuccessor>,
  legacyId: string,
) {
  const evidenceById = await loadPrivateEvidence();
  const rebuilt = buildSnapshots(
    spec.frame,
    plan.successorStudyId,
    plan.packets,
    evidenceById,
    {
      datasetVersion: plan.successorDatasetVersion,
      title: spec.reconciled.title,
    },
  );
  const successorHash = pulseCodingHash({
    ...rebuilt.study,
    supersedesStudyId: legacyId,
    supersessionReason: spec.reconciled.supersessionReason,
  });
  await db
    .insert(pulseCodingStudies)
    .values({
      ...rebuilt.study,
      slug: spec.reconciled.slug,
      createdBy: "PUL-043 append-only reconciliation",
      supersedesStudyId: legacyId,
      supersessionReason: spec.reconciled.supersessionReason,
    })
    .onConflictDoNothing();
  await db
    .insert(pulseCodingAuditLog)
    .values({
      studyId: plan.successorStudyId,
      actorId: "system",
      actorRole: "system",
      action: "study_created",
      entityType: "coding_study",
      entityId: plan.successorStudyId,
      requestId: `pul-043-study-${plan.successorStudyId}`,
      afterSha256: successorHash,
      details: {
        reconciliationVersion: spec.reconciliationVersion,
        manifestSha256: evaluationPacketManifest.semanticSha256,
        supersedesStudyId: legacyId,
        supersessionReason: spec.reconciled.supersessionReason,
        labelStatus: "unlabeled",
        participantAccess: "disabled_while_setup",
      },
    })
    .onConflictDoNothing();
  for (let offset = 0; offset < rebuilt.snapshots.length; offset += 50) {
    const chunk = rebuilt.snapshots
      .slice(offset, offset + 50)
      .map((snapshot) => ({
        recordId: deterministicUuid(`${plan.successorStudyId}|${snapshot.id}`),
        snapshot,
      }));
    await db.batch([
      db
        .insert(pulseCodingPackets)
        .values(
          chunk.map(({ recordId, snapshot }) => ({
            id: recordId,
            studyId: plan.successorStudyId,
            packetKey: snapshot.id,
            analysisStatus: snapshot.analysisStatus,
            packetSnapshot: snapshot,
            packetSnapshotSha256: snapshot.packetSnapshotSha256,
          })),
        )
        .onConflictDoNothing(),
      db
        .insert(pulseCodingAuditLog)
        .values(
          chunk.map(({ recordId, snapshot }) => ({
            studyId: plan.successorStudyId,
            packetId: recordId,
            actorId: "system",
            actorRole: "system" as const,
            action: "packet_imported" as const,
            entityType: "coding_packet",
            entityId: recordId,
            requestId: `pul-043-packet-${recordId}`,
            afterSha256: snapshot.packetSnapshotSha256,
            details: {
              packetKey: snapshot.id,
              manifestSha256: evaluationPacketManifest.semanticSha256,
              reconciliationVersion: spec.reconciliationVersion,
            },
          })),
        )
        .onConflictDoNothing(),
    ]);
  }
  return rebuilt;
}

async function dryRun() {
  const evidenceById = await loadPrivateEvidence();
  const reconciliations = [];
  for (const spec of RECONCILIATIONS) {
    const plan = expectedSuccessor(spec);
    const before = await validateLegacy(spec);
    const existingSuccessor = await getStudy(spec.reconciled.slug);
    const rebuilt = buildSnapshots(
      spec.frame,
      plan.successorStudyId,
      plan.packets,
      evidenceById,
      {
        datasetVersion: plan.successorDatasetVersion,
        title: spec.reconciled.title,
      },
    );
    assert.equal(
      rebuilt.study.packetSetSha256,
      spec.reconciled.packetSetSha256,
      `reconciled ${spec.label} expected packet-set hash drifted`,
    );
    if (existingSuccessor)
      await validateSuccessor(spec, plan, before.legacy.id);
    reconciliations.push({
      reconciliationVersion: spec.reconciliationVersion,
      legacy: {
        slug: before.legacy.slug,
        id: before.legacy.id,
        packetSetSha256: before.legacy.packetSetSha256,
        immutableFingerprint: before.fingerprint,
        packets: before.state.packets.length,
        participants: before.state.participants.length,
        assignments: before.state.assignments.length,
        auditRows: before.state.auditRows.length,
        operations: [],
      },
      successor: {
        slug: spec.reconciled.slug,
        id: plan.successorStudyId,
        supersedesStudyId: plan.legacyStudyId,
        datasetVersion: plan.successorDatasetVersion,
        packetSetSha256: rebuilt.study.packetSetSha256,
        packetsToInsert: existingSuccessor ? 0 : plan.packets.length,
        auditRowsToInsert: existingSuccessor ? 0 : plan.packets.length + 1,
        participantsToInsert: 0,
        assignmentsToInsert: 0,
        studyAlreadyPresent: !!existingSuccessor,
        operations: existingSuccessor
          ? []
          : ["insert_study", "insert_audit_log", "insert_packets"],
      },
    });
  }
  console.log(
    JSON.stringify(
      {
        mode: "dry_run",
        writesPerformed: 0,
        migrationRequired: "0045_pulse_evaluation_workspace_reconciliation",
        reconciliations,
      },
      null,
      2,
    ),
  );
}

async function apply() {
  const results = [];
  for (const spec of RECONCILIATIONS) {
    const plan = expectedSuccessor(spec);
    const before = await validateLegacy(spec);
    const existingSuccessor = await getStudy(spec.reconciled.slug);
    if (!existingSuccessor) await applySuccessor(spec, plan, before.legacy.id);
    const after = await validateLegacy(spec);
    assert.equal(
      after.fingerprint,
      before.fingerprint,
      `legacy ${spec.label} changed during append-only reconciliation`,
    );
    await validateSuccessor(spec, plan, before.legacy.id);
    results.push({
      legacy: spec.legacy.slug,
      successor: spec.reconciled.slug,
      appended: !existingSuccessor,
    });
  }
  console.log(
    JSON.stringify(
      {
        mode: "apply",
        writesPerformed: results.some(({ appended }) => appended)
          ? "append_only_successors"
          : 0,
        results,
      },
      null,
      2,
    ),
  );
}

async function main() {
  if (APPLY) await apply();
  else await dryRun();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
