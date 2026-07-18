import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { config } from "dotenv";
import { db } from "../src/lib/db";
import {
  pulseCodingAssignments,
  pulseCodingPackets,
  pulseCodingParticipants,
  pulseCodingStudies,
} from "../src/lib/db/schema";
import { containsPulseCoderForbiddenField } from "../src/lib/pulse/v2/coder-protocol";
import {
  pulseEvaluationPacketReleaseErrors,
  type PulseEvaluationPacketFrozenInputs,
  type PulseEvaluationPacketFrame,
  type PulseEvaluationPacketManifest,
  type PulseEvaluationPacketPopulationReference,
} from "../src/lib/pulse/v2/evaluation-packets";
import {
  type PulseCodingPacketSnapshot,
} from "../src/lib/pulse/v2/coding-workspace";
import {
  PULSE_EVALUATION_BATCH_A_FRAME,
  PULSE_EVALUATION_BATCH_A_LEGACY,
  PULSE_EVALUATION_BATCH_A_RECONCILED,
  pulseEvaluationWorkspaceReconciliationPlan,
} from "../src/lib/pulse/v2/evaluation-workspace-reconciliation";
import {
  buildSnapshots,
  deterministicUuid,
  loadPrivateEvidence,
} from "./seed-pulse-evaluation-coding-studies";

config({ path: ".env.local", override: true });

const LIVE = process.argv.includes("--live-workspace");
const checked = JSON.parse(
  readFileSync("data/research/pulse-evaluation-packet-manifest-v1.json", "utf8"),
) as PulseEvaluationPacketManifest;
const frozenInputs = JSON.parse(
  readFileSync("data/research/pulse-evaluation-packet-frozen-inputs-v1.json", "utf8"),
) as PulseEvaluationPacketFrozenInputs;
const population = JSON.parse(
  readFileSync("data/research/pulse-evaluation-frame-population-v1.json", "utf8"),
) as PulseEvaluationPacketPopulationReference;

const CURRENT_STUDIES: Record<
  Exclude<PulseEvaluationPacketFrame, typeof PULSE_EVALUATION_BATCH_A_FRAME>,
  string
> = {
  system_negative_probability: "pulse-evaluation-batch-b-v1",
};

async function studySetupCounts(studyId: string) {
  const [packets, participants, assignments] = await Promise.all([
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
  ]);
  assert.equal(participants.length, 0, `${studyId}: participant leaked into setup study`);
  assert.equal(assignments.length, 0, `${studyId}: assignment leaked into setup study`);
  return packets;
}

async function validateRebuiltStudy(
  frame: PulseEvaluationPacketFrame,
  studyRow: typeof pulseCodingStudies.$inferSelect,
  evidenceById: Awaited<ReturnType<typeof loadPrivateEvidence>>,
  options: { datasetVersion?: string; title?: string } = {},
) {
  assert.equal(studyRow.status, "setup", `${studyRow.slug}: study access is enabled prematurely`);
  assert.equal(studyRow.purpose, "evaluation");
  assert.equal(studyRow.codebookVersion, checked.codebookVersion);
  assert.equal(studyRow.ontologyVersion, checked.ontologyVersion);
  const expected = checked.packets.filter((packet) => packet.frame === frame);
  const packets = await studySetupCounts(studyRow.id);
  assert.equal(packets.length, expected.length, `${studyRow.slug}: packet count drifted`);
  const expectedByKey = new Map(expected.map((packet) => [packet.packetKey, packet]));
  const rebuilt = buildSnapshots(frame, studyRow.id, expected, evidenceById, options);
  assert.equal(
    studyRow.packetSetSha256,
    rebuilt.study.packetSetSha256,
    `${studyRow.slug}: frozen packet-set hash drifted`,
  );
  const rebuiltByKey = new Map(rebuilt.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  for (const row of packets) {
    const snapshot = row.packetSnapshot as PulseCodingPacketSnapshot;
    const source = expectedByKey.get(row.packetKey);
    const expectedSnapshot = rebuiltByKey.get(row.packetKey);
    assert.ok(source, `${studyRow.slug}/${row.packetKey}: packet is outside the frozen manifest`);
    assert.ok(expectedSnapshot, `${studyRow.slug}/${row.packetKey}: packet cannot be rebuilt`);
    assert.equal(row.analysisStatus, source.analysisStatus);
    assert.equal(snapshot.date, source.referenceDate);
    assert.equal(snapshot.id, source.packetKey);
    assert.equal(snapshot.jurisdiction.id, "evaluation:independent-attribution");
    assert.equal(snapshot.evidence.length, source.evidenceRefs.length);
    assert.deepEqual(snapshot.searchFamilies, source.requiredSearchFamilies);
    assert.equal(containsPulseCoderForbiddenField(snapshot), false);
    assert.equal(row.packetSnapshotSha256, expectedSnapshot.packetSnapshotSha256);
    assert.equal(snapshot.packetSnapshotSha256, expectedSnapshot.packetSnapshotSha256);
    assert.deepEqual(snapshot, expectedSnapshot);
  }
}

async function validateLiveWorkspace() {
  const columns = await db.execute(sql`
    SELECT count(*)::int AS n
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pulse_coding_studies'
      AND column_name IN ('supersedes_study_id', 'supersession_reason')
  `);
  const columnRows = ((columns as unknown as { rows?: unknown[] }).rows ??
    columns) as Array<{ n?: number | string }>;
  assert.equal(
    Number(columnRows[0]?.n),
    2,
    "PUL-043 requires migration 0045_pulse_evaluation_workspace_reconciliation before live workspace validation",
  );
  const evidenceById = await loadPrivateEvidence();
  const reconciliation = pulseEvaluationWorkspaceReconciliationPlan(
    checked.semanticSha256,
    checked.schemaVersion,
    PULSE_EVALUATION_BATCH_A_LEGACY.id,
    deterministicUuid,
  );
  const rows = await db
    .select()
    .from(pulseCodingStudies)
    .where(
      inArray(pulseCodingStudies.slug, [
        PULSE_EVALUATION_BATCH_A_LEGACY.slug,
        PULSE_EVALUATION_BATCH_A_RECONCILED.slug,
        ...Object.values(CURRENT_STUDIES),
      ]),
    );
  assert.equal(rows.length, 3, "both current studies and the preserved legacy study must exist");
  const legacy = rows.find((row) => row.slug === PULSE_EVALUATION_BATCH_A_LEGACY.slug);
  assert.ok(legacy, "legacy batch A study is missing");
  assert.equal(legacy.id, reconciliation.legacyStudyId, "legacy batch A identity drifted");
  assert.equal(legacy.status, "setup", "legacy batch A study access is enabled prematurely");
  assert.equal(legacy.packetSetSha256, PULSE_EVALUATION_BATCH_A_LEGACY.packetSetSha256);
  assert.equal(legacy.supersedesStudyId, null, "legacy batch A must not replace another study");
  assert.equal(legacy.supersessionReason, null, "legacy batch A supersession state drifted");
  const legacyPackets = await studySetupCounts(legacy.id);
  assert.equal(
    legacyPackets.length,
    checked.packets.filter((packet) => packet.frame === PULSE_EVALUATION_BATCH_A_FRAME).length,
    "legacy batch A packet count drifted",
  );

  const successor = rows.find((row) => row.slug === PULSE_EVALUATION_BATCH_A_RECONCILED.slug);
  assert.ok(successor, "reconciled batch A study is missing");
  assert.equal(successor.id, reconciliation.successorStudyId, "reconciled batch A identity drifted");
  assert.equal(successor.supersedesStudyId, legacy.id, "reconciled batch A has the wrong predecessor");
  assert.equal(
    successor.supersessionReason,
    PULSE_EVALUATION_BATCH_A_RECONCILED.supersessionReason,
    "reconciled batch A has the wrong supersession reason",
  );
  await validateRebuiltStudy(
    PULSE_EVALUATION_BATCH_A_FRAME,
    successor,
    evidenceById,
    {
      datasetVersion: reconciliation.successorDatasetVersion,
      title: PULSE_EVALUATION_BATCH_A_RECONCILED.title,
    },
  );

  const batchB = rows.find((row) => row.slug === CURRENT_STUDIES.system_negative_probability);
  assert.ok(batchB, "batch B study is missing");
  assert.equal(batchB.supersedesStudyId, null, "batch B unexpectedly supersedes a study");
  assert.equal(batchB.supersessionReason, null, "batch B supersession state drifted");
  await validateRebuiltStudy("system_negative_probability", batchB, evidenceById);
}

async function main() {
  assert.deepEqual(
    pulseEvaluationPacketReleaseErrors({
      frozenInputs,
      manifest: checked,
      population,
    }),
    [],
    "checked packet release does not reproduce from retained frozen inputs",
  );
  const serialized = JSON.stringify(checked);
  assert.equal(
    /"(?:title|body|raw|headline|description|category|dimension|severityTier|severityValue|classifierRuns|classifierAgreement|reviewStatus|published|humanReviewed|ownerApproval|modelVote|goldLabel|truth)"\s*:/.test(
      serialized,
    ),
    false,
    "publisher payload, production output, or answer field leaked into the checked manifest",
  );
  if (LIVE) await validateLiveWorkspace();
  console.log(
    `PASS — ${checked.counts.totalPackets} rights-safe unlabeled packets reproduced from retained frozen inputs${LIVE ? " and two isolated setup studies" : ""}; ${checked.semanticSha256}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
