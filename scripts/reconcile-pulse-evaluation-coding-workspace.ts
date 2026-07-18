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
  PULSE_EVALUATION_WORKSPACE_RECONCILIATION_VERSION,
  pulseEvaluationWorkspaceReconciliationPlan,
} from "../src/lib/pulse/v2/evaluation-workspace-reconciliation";
import { pulseCodingHash } from "../src/lib/pulse/v2/coding-workspace";
import {
  buildSnapshots,
  deterministicUuid,
  evaluationPacketManifest,
  loadPrivateEvidence,
} from "./seed-pulse-evaluation-coding-studies";

config({ path: ".env.local", override: true });

const APPLY = process.argv.includes("--apply");

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
  status: pulseCodingStudies.status,
  createdBy: pulseCodingStudies.createdBy,
  closedAt: pulseCodingStudies.closedAt,
};

type StudyRow = Awaited<ReturnType<typeof getStudy>>;

function expectedSuccessor() {
  const plan = pulseEvaluationWorkspaceReconciliationPlan(
    evaluationPacketManifest.semanticSha256,
    evaluationPacketManifest.schemaVersion,
    PULSE_EVALUATION_BATCH_A_LEGACY.id,
    deterministicUuid,
  );
  const packets = evaluationPacketManifest.packets.filter(
    (packet) => packet.frame === PULSE_EVALUATION_BATCH_A_FRAME,
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

async function studyCounts(studyId: string) {
  const [packets, participants, assignments] = await Promise.all([
    db
      .select({
        packetKey: pulseCodingPackets.packetKey,
        analysisStatus: pulseCodingPackets.analysisStatus,
        packetSnapshot: pulseCodingPackets.packetSnapshot,
        packetSnapshotSha256: pulseCodingPackets.packetSnapshotSha256,
      })
      .from(pulseCodingPackets)
      .where(eq(pulseCodingPackets.studyId, studyId)),
    db
      .select({ id: pulseCodingParticipants.id })
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
  ]);
  return { packets, participants, assignments };
}

function immutableStudyFingerprint(study: NonNullable<StudyRow>, counts: Awaited<ReturnType<typeof studyCounts>>) {
  return pulseCodingHash({
    study,
    packets: [...counts.packets].sort((left, right) =>
      left.packetKey.localeCompare(right.packetKey),
    ),
    participants: counts.participants.map(({ id }) => id).sort(),
    assignments: counts.assignments.map(({ id }) => id).sort(),
  });
}

async function validateLegacy() {
  const plan = expectedSuccessor();
  const legacy = await getStudy(PULSE_EVALUATION_BATCH_A_LEGACY.slug);
  assert.ok(legacy, "legacy batch A study is missing");
  assert.equal(legacy.id, PULSE_EVALUATION_BATCH_A_LEGACY.id, "legacy batch A identity drifted");
  assert.equal(legacy.status, "setup", "legacy batch A study access is enabled");
  assert.equal(legacy.purpose, "evaluation", "legacy batch A purpose drifted");
  assert.equal(
    legacy.packetSetSha256,
    PULSE_EVALUATION_BATCH_A_LEGACY.packetSetSha256,
    "legacy batch A packet-set hash was rewritten instead of preserved",
  );
  const counts = await studyCounts(legacy.id);
  assert.equal(
    counts.packets.length,
    plan.packets.length,
    "legacy batch A packet count drifted",
  );
  assert.equal(counts.participants.length, 0, "legacy batch A gained participants");
  assert.equal(counts.assignments.length, 0, "legacy batch A gained assignments");
  return { legacy, counts, fingerprint: immutableStudyFingerprint(legacy, counts) };
}

async function validateSuccessor(
  plan: ReturnType<typeof expectedSuccessor>,
  legacyId: string,
) {
  const row = (
    await db
      .select({
        ...studyFields,
        supersedesStudyId: pulseCodingStudies.supersedesStudyId,
        supersessionReason: pulseCodingStudies.supersessionReason,
      })
      .from(pulseCodingStudies)
      .where(eq(pulseCodingStudies.slug, PULSE_EVALUATION_BATCH_A_RECONCILED.slug))
      .limit(1)
  )[0];
  assert.ok(row, "reconciled batch A study is missing");
  assert.equal(row.id, plan.successorStudyId, "reconciled batch A identity drifted");
  assert.equal(row.status, "setup", "reconciled batch A study access is enabled");
  assert.equal(row.purpose, "evaluation", "reconciled batch A purpose drifted");
  assert.equal(row.supersedesStudyId, legacyId, "reconciled batch A has the wrong predecessor");
  assert.equal(
    row.supersessionReason,
    PULSE_EVALUATION_BATCH_A_RECONCILED.supersessionReason,
    "reconciled batch A has the wrong supersession reason",
  );
  const evidenceById = await loadPrivateEvidence();
  const rebuilt = buildSnapshots(
    PULSE_EVALUATION_BATCH_A_FRAME,
    plan.successorStudyId,
    plan.packets,
    evidenceById,
    {
      datasetVersion: plan.successorDatasetVersion,
      title: PULSE_EVALUATION_BATCH_A_RECONCILED.title,
    },
  );
  assert.equal(
    row.packetSetSha256,
    rebuilt.study.packetSetSha256,
    "reconciled batch A packet-set hash drifted",
  );
  assert.equal(
    row.datasetVersion,
    plan.successorDatasetVersion,
    "reconciled batch A dataset version drifted",
  );
  assert.equal(row.title, PULSE_EVALUATION_BATCH_A_RECONCILED.title);
  const counts = await studyCounts(row.id);
  assert.equal(counts.packets.length, rebuilt.snapshots.length, "reconciled batch A packet count drifted");
  assert.equal(counts.participants.length, 0, "reconciled batch A gained participants");
  assert.equal(counts.assignments.length, 0, "reconciled batch A gained assignments");
  const actualByKey = new Map(counts.packets.map((packet) => [packet.packetKey, packet]));
  for (const snapshot of rebuilt.snapshots) {
    const actual = actualByKey.get(snapshot.id);
    assert.ok(actual, `reconciled batch A/${snapshot.id}: packet is missing`);
    assert.equal(actual.packetSnapshotSha256, snapshot.packetSnapshotSha256);
    assert.deepEqual(actual.packetSnapshot, snapshot);
  }
  return { row, rebuilt, counts };
}

async function applySuccessor(
  plan: ReturnType<typeof expectedSuccessor>,
  legacyId: string,
) {
  const evidenceById = await loadPrivateEvidence();
  const rebuilt = buildSnapshots(
    PULSE_EVALUATION_BATCH_A_FRAME,
    plan.successorStudyId,
    plan.packets,
    evidenceById,
    {
      datasetVersion: plan.successorDatasetVersion,
      title: PULSE_EVALUATION_BATCH_A_RECONCILED.title,
    },
  );
  const successorHash = pulseCodingHash({
    ...rebuilt.study,
    supersedesStudyId: legacyId,
    supersessionReason: PULSE_EVALUATION_BATCH_A_RECONCILED.supersessionReason,
  });
  await db
    .insert(pulseCodingStudies)
    .values({
      ...rebuilt.study,
      slug: PULSE_EVALUATION_BATCH_A_RECONCILED.slug,
      createdBy: "PUL-043 append-only reconciliation",
      supersedesStudyId: legacyId,
      supersessionReason: PULSE_EVALUATION_BATCH_A_RECONCILED.supersessionReason,
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
        reconciliationVersion: PULSE_EVALUATION_WORKSPACE_RECONCILIATION_VERSION,
        manifestSha256: evaluationPacketManifest.semanticSha256,
        supersedesStudyId: legacyId,
        supersessionReason: PULSE_EVALUATION_BATCH_A_RECONCILED.supersessionReason,
        labelStatus: "unlabeled",
        participantAccess: "disabled_while_setup",
      },
    })
    .onConflictDoNothing();
  for (let offset = 0; offset < rebuilt.snapshots.length; offset += 50) {
    const chunk = rebuilt.snapshots.slice(offset, offset + 50).map((snapshot) => ({
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
              reconciliationVersion: PULSE_EVALUATION_WORKSPACE_RECONCILIATION_VERSION,
            },
          })),
        )
        .onConflictDoNothing(),
    ]);
  }
  return rebuilt;
}

async function main() {
  const plan = expectedSuccessor();
  const before = await validateLegacy();
  const existingSuccessor = await getStudy(PULSE_EVALUATION_BATCH_A_RECONCILED.slug);
  if (!APPLY) {
    console.log(
      JSON.stringify(
        {
          mode: "dry_run",
          writesPerformed: 0,
          migrationRequired: "0045_pulse_evaluation_workspace_reconciliation",
          reconciliationVersion: PULSE_EVALUATION_WORKSPACE_RECONCILIATION_VERSION,
          legacy: {
            slug: before.legacy.slug,
            id: before.legacy.id,
            packetSetSha256: before.legacy.packetSetSha256,
            immutableFingerprint: before.fingerprint,
            packets: before.counts.packets.length,
            participants: before.counts.participants.length,
            assignments: before.counts.assignments.length,
            operations: [],
          },
          successor: {
            slug: PULSE_EVALUATION_BATCH_A_RECONCILED.slug,
            id: plan.successorStudyId,
            supersedesStudyId: plan.legacyStudyId,
            datasetVersion: plan.successorDatasetVersion,
            packetSetSha256: buildSnapshots(
              PULSE_EVALUATION_BATCH_A_FRAME,
              plan.successorStudyId,
              plan.packets,
              await loadPrivateEvidence(),
              {
                datasetVersion: plan.successorDatasetVersion,
                title: PULSE_EVALUATION_BATCH_A_RECONCILED.title,
              },
            ).study.packetSetSha256,
            packetsToInsert: plan.packets.length,
            studyAlreadyPresent: !!existingSuccessor,
            operations: ["insert_study", "insert_audit_log", "insert_packets"],
          },
        },
        null,
        2,
      ),
    );
    return;
  }
  if (existingSuccessor) {
    await validateSuccessor(plan, before.legacy.id);
    console.log(
      `PASS — ${PULSE_EVALUATION_BATCH_A_RECONCILED.slug} is already a valid ` +
        "append-only successor; no workspace rows were changed.",
    );
    return;
  }
  await applySuccessor(plan, before.legacy.id);
  const after = await validateLegacy();
  assert.equal(
    after.fingerprint,
    before.fingerprint,
    "legacy batch A changed during append-only reconciliation",
  );
  await validateSuccessor(plan, before.legacy.id);
  console.log(
    `PASS — appended ${PULSE_EVALUATION_BATCH_A_RECONCILED.slug}; ` +
      `${PULSE_EVALUATION_BATCH_A_LEGACY.slug} remains unchanged and disabled.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
