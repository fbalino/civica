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
  pulseEvaluationPacketManifestErrors,
  type PulseEvaluationPacketFrame,
  type PulseEvaluationPacketManifest,
} from "../src/lib/pulse/v2/evaluation-packets";
import {
  PULSE_CODING_WORKSPACE_VERSION,
  pulseCodingHash,
  pulseCodingPacketErrors,
  type PulseCodingPacketSnapshot,
  type PulseCodingStudyContract,
} from "../src/lib/pulse/v2/coding-workspace";
import { buildPulseEvaluationPacketsFromDatabase } from "./generate-pulse-evaluation-packets";

config({ path: ".env.local", override: true });

const LIVE = process.argv.includes("--live-workspace");
const COMPARE_CURRENT_DATABASE = process.argv.includes(
  "--compare-current-database",
);
const checked = JSON.parse(
  readFileSync("data/research/pulse-evaluation-packet-manifest-v1.json", "utf8"),
) as PulseEvaluationPacketManifest;
const population = JSON.parse(
  readFileSync(
    "data/research/pulse-evaluation-frame-population-v1.json",
    "utf8",
  ),
) as {
  populationFreezeAt: string;
  semanticSha256: string;
  counts: {
    retainedEventCandidateCensus: number;
    systemNegativePopulation: number;
  };
};

const STUDIES: Record<PulseEvaluationPacketFrame, string> = {
  retained_event_candidate_census: "pulse-evaluation-batch-a-v1",
  system_negative_probability: "pulse-evaluation-batch-b-v1",
};

async function validateLiveWorkspace() {
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
    assert.equal(studyRow.schemaVersion, PULSE_CODING_WORKSPACE_VERSION);
    assert.equal(studyRow.protocolVersion, checked.codebookVersion);
    assert.equal(studyRow.codebookVersion, checked.codebookVersion);
    assert.equal(studyRow.ontologyVersion, checked.ontologyVersion);
    assert.equal(
      studyRow.datasetVersion,
      `${checked.schemaVersion}:${frame}`,
      `${slug}: dataset version drifted`,
    );
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
    const packetSetSha256 = pulseCodingHash({
      manifestSha256: checked.semanticSha256,
      frame,
      packetKeys: expected.map(({ packetKey, packetMaterialSha256 }) => ({
        packetKey,
        packetMaterialSha256,
      })),
    });
    assert.equal(
      studyRow.packetSetSha256,
      packetSetSha256,
      `${slug}: packet-set hash drifted from the frozen manifest`,
    );
    const study: PulseCodingStudyContract = {
      schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
      id: studyRow.id,
      title: studyRow.title,
      purpose: "evaluation",
      protocolVersion: checked.codebookVersion,
      codebookVersion: checked.codebookVersion,
      ontologyVersion: checked.ontologyVersion,
      datasetVersion: studyRow.datasetVersion,
      packetSetSha256: studyRow.packetSetSha256,
      traceSetSha256: studyRow.traceSetSha256,
      status: "setup",
    };
    const expectedByKey = new Map(expected.map((packet) => [packet.packetKey, packet]));
    for (const row of packets) {
      const snapshot = row.packetSnapshot as PulseCodingPacketSnapshot;
      const source = expectedByKey.get(row.packetKey);
      assert.ok(source, `${slug}/${row.packetKey}: packet is outside the frozen manifest`);
      assert.equal(row.analysisStatus, source.analysisStatus);
      assert.equal(snapshot.date, source.referenceDate);
      assert.equal(snapshot.id, source.packetKey);
      assert.equal(snapshot.jurisdiction.id, "evaluation:independent-attribution");
      assert.equal(snapshot.evidence.length, source.evidenceRefs.length);
      assert.deepEqual(snapshot.searchFamilies, source.requiredSearchFamilies);
      assert.equal(containsPulseCoderForbiddenField(snapshot), false);
      assert.equal(row.packetSnapshotSha256, snapshot.packetSnapshotSha256);
      assert.deepEqual(
        pulseCodingPacketErrors(snapshot, study),
        [],
        `${slug}/${row.packetKey}: stored packet snapshot is invalid`,
      );
      assert.deepEqual(
        snapshot.evidence.map(({ sourceFamilyId, reportedDate }) => ({
          sourceFamilyId,
          reportedDate,
        })),
        source.evidenceRefs.map(({ sourceFamilyId, reportedDate }) => ({
          sourceFamilyId,
          reportedDate,
        })),
        `${slug}/${row.packetKey}: frozen evidence context drifted`,
      );
    }
  }
}

async function main() {
  assert.deepEqual(pulseEvaluationPacketManifestErrors(checked), []);
  assert.equal(
    checked.populationArtifactSha256,
    population.semanticSha256,
    "packet manifest is not bound to the checked population artifact",
  );
  assert.equal(
    checked.populationFreezeAt,
    population.populationFreezeAt,
    "packet and population freeze timestamps drifted",
  );
  assert.equal(
    checked.counts.eventCensus,
    population.counts.retainedEventCandidateCensus,
    "packet census does not match the checked population artifact",
  );
  assert.ok(
    checked.counts.systemNegativeInitialDraw <=
      population.counts.systemNegativePopulation,
    "packet draw exceeds the checked system-negative population",
  );
  if (COMPARE_CURRENT_DATABASE) {
    const generated = await buildPulseEvaluationPacketsFromDatabase();
    assert.deepEqual(
      checked,
      generated,
      "current mutable database state no longer reproduces the frozen packet manifest; do not regenerate the frozen artifact",
    );
  }
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
    `PASS — ${checked.counts.totalPackets} rights-safe unlabeled frozen packets bound to population ${checked.populationArtifactSha256}${LIVE ? " and two isolated setup studies" : ""}${COMPARE_CURRENT_DATABASE ? " and the current database reconstruction" : ""}; ${checked.semanticSha256}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
