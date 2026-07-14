import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
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
  buildSnapshots,
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

const STUDIES: Record<PulseEvaluationPacketFrame, string> = {
  retained_event_candidate_census: "pulse-evaluation-batch-a-v1",
  system_negative_probability: "pulse-evaluation-batch-b-v1",
};

async function validateLiveWorkspace() {
  const evidenceById = await loadPrivateEvidence();
  const rows = await db
    .select()
    .from(pulseCodingStudies)
    .where(inArray(pulseCodingStudies.slug, Object.values(STUDIES)));
  assert.equal(rows.length, 2, "both isolated evaluation studies must exist");
  for (const [frame, slug] of Object.entries(STUDIES) as Array<
    [PulseEvaluationPacketFrame, string]
  >) {
    const studyRow = rows.find((row) => row.slug === slug);
    assert.ok(studyRow, `${slug}: study is missing`);
    assert.equal(studyRow.status, "setup", `${slug}: study access is enabled prematurely`);
    assert.equal(studyRow.purpose, "evaluation");
    assert.equal(studyRow.codebookVersion, checked.codebookVersion);
    assert.equal(studyRow.ontologyVersion, checked.ontologyVersion);
    const expected = checked.packets.filter((packet) => packet.frame === frame);
    const [packets, participants, assignments] = await Promise.all([
      db
        .select()
        .from(pulseCodingPackets)
        .where(eq(pulseCodingPackets.studyId, studyRow.id)),
      db
        .select()
        .from(pulseCodingParticipants)
        .where(eq(pulseCodingParticipants.studyId, studyRow.id)),
      db
        .select({ id: pulseCodingAssignments.id })
        .from(pulseCodingAssignments)
        .innerJoin(
          pulseCodingPackets,
          and(
            eq(pulseCodingAssignments.packetId, pulseCodingPackets.id),
            eq(pulseCodingPackets.studyId, studyRow.id),
          ),
        ),
    ]);
    assert.equal(packets.length, expected.length, `${slug}: packet count drifted`);
    assert.equal(participants.length, 0, `${slug}: participant leaked into setup study`);
    assert.equal(assignments.length, 0, `${slug}: assignment leaked into setup study`);
    const expectedByKey = new Map(expected.map((packet) => [packet.packetKey, packet]));
    const rebuilt = buildSnapshots(frame, studyRow.id, expected, evidenceById);
    assert.equal(
      studyRow.packetSetSha256,
      rebuilt.study.packetSetSha256,
      `${slug}: frozen packet-set hash drifted`,
    );
    const rebuiltByKey = new Map(rebuilt.snapshots.map((snapshot) => [snapshot.id, snapshot]));
    for (const row of packets) {
      const snapshot = row.packetSnapshot as PulseCodingPacketSnapshot;
      const source = expectedByKey.get(row.packetKey);
      const expectedSnapshot = rebuiltByKey.get(row.packetKey);
      assert.ok(source, `${slug}/${row.packetKey}: packet is outside the frozen manifest`);
      assert.ok(expectedSnapshot, `${slug}/${row.packetKey}: packet cannot be rebuilt`);
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
