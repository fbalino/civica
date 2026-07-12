import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  pulseCodingAssignments,
  pulseCodingAuditLog,
  pulseCodingPackets,
  pulseCodingParticipants,
  pulseCodingStudies,
  rawEvents,
} from "../src/lib/db/schema";
import {
  pulseEvaluationPacketManifestErrors,
  type PulseEvaluationPacketFrame,
  type PulseEvaluationPacketManifest,
  type PulseEvaluationPacketManifestRow,
} from "../src/lib/pulse/v2/evaluation-packets";
import {
  PULSE_CODING_WORKSPACE_VERSION,
  pulseCodingHash,
  pulseCodingPacketErrors,
  pulseCodingPacketHash,
  type PulseCodingPacketSnapshot,
  type PulseCodingStudyContract,
} from "../src/lib/pulse/v2/coding-workspace";

config({ path: ".env.local", override: true });

const APPLY = process.argv.includes("--apply");
const MANIFEST_PATH = "data/research/pulse-evaluation-packet-manifest-v1.json";
const manifest = JSON.parse(
  readFileSync(MANIFEST_PATH, "utf8"),
) as PulseEvaluationPacketManifest;

const FRAME_CONFIG: Record<
  PulseEvaluationPacketFrame,
  { slug: string; title: string }
> = {
  retained_event_candidate_census: {
    slug: "pulse-evaluation-batch-a-v1",
    title: "Pulse evaluation batch A",
  },
  system_negative_probability: {
    slug: "pulse-evaluation-batch-b-v1",
    title: "Pulse evaluation batch B",
  },
};

function deterministicUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function framePacketSetSha256(
  frame: PulseEvaluationPacketFrame,
  packets: PulseEvaluationPacketManifestRow[],
): string {
  return pulseCodingHash({
    manifestSha256: manifest.semanticSha256,
    frame,
    packetKeys: packets.map(({ packetKey, packetMaterialSha256 }) => ({
      packetKey,
      packetMaterialSha256,
    })),
  });
}

export type PrivateEvidence = {
  evidenceIdentityKey: string;
  evidenceContentHash: string;
  title: string;
  body: string | null;
};

export async function loadPrivateEvidence() {
  const keys = new Set(manifest.packets.flatMap(({ evidenceIdentityKeys }) => evidenceIdentityKeys));
  const rows = await db
    .select({
      evidenceIdentityKey: rawEvents.evidenceIdentityKey,
      evidenceContentHash: rawEvents.evidenceContentHash,
      title: rawEvents.title,
      body: rawEvents.body,
    })
    .from(rawEvents)
    .where(inArray(rawEvents.evidenceIdentityKey, [...keys]));
  assert.equal(rows.length, keys.size, "not every frozen evidence identity can be rehydrated");
  return new Map(rows.map((row) => [row.evidenceIdentityKey, row as PrivateEvidence]));
}

export function buildSnapshots(
  frame: PulseEvaluationPacketFrame,
  studyId: string,
  packets: PulseEvaluationPacketManifestRow[],
  evidenceById: Map<string, PrivateEvidence>,
) {
  const packetSetSha256 = framePacketSetSha256(frame, packets);
  const datasetVersion = `${manifest.schemaVersion}:${frame}`;
  const study: PulseCodingStudyContract = {
    schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
    id: studyId,
    title: FRAME_CONFIG[frame].title,
    purpose: "evaluation",
    protocolVersion: manifest.codebookVersion,
    codebookVersion: manifest.codebookVersion,
    ontologyVersion: manifest.ontologyVersion,
    datasetVersion,
    packetSetSha256,
    traceSetSha256: null,
    status: "setup",
  };
  const snapshots = packets.map((packet) => {
    const evidence = packet.evidenceRefs.map((ref, index) => {
      const privateRow = evidenceById.get(ref.evidenceIdentityKey);
      assert.ok(privateRow, `${packet.packetKey}: missing private evidence`);
      assert.equal(
        privateRow.evidenceContentHash,
        ref.evidenceContentHash,
        `${packet.packetKey}: private evidence hash drifted`,
      );
      return {
        id: `E-${String(index + 1).padStart(2, "0")}`,
        channel: "pulse_retained" as const,
        sourceFamilyId: ref.sourceFamilyId,
        accessState: "accessible" as const,
        reportedDate: ref.reportedDate,
        text: [privateRow.title.trim(), privateRow.body?.trim()]
          .filter(Boolean)
          .join("\n\n"),
      };
    });
    const body: Omit<PulseCodingPacketSnapshot, "packetSnapshotSha256"> = {
      schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
      studyId,
      datasetVersion,
      packetSetSha256,
      id: packet.packetKey,
      date: packet.referenceDate,
      jurisdiction: {
        id: "evaluation:independent-attribution",
        name: "Independent attribution required",
        iso3: null,
      },
      analysisStatus: packet.analysisStatus,
      searchFamilies: packet.requiredSearchFamilies,
      telemetry: {
        outage: false,
        note: "No sourced outage metadata was supplied in the frozen packet.",
      },
      informationEnvironment: "not_supplied",
      evidence,
    };
    const snapshot: PulseCodingPacketSnapshot = {
      ...body,
      packetSnapshotSha256: pulseCodingPacketHash(body),
    };
    const errors = pulseCodingPacketErrors(snapshot, study);
    assert.deepEqual(errors, [], `${packet.packetKey}: ${errors.join("; ")}`);
    return snapshot;
  });
  return { study, snapshots };
}

async function seedFrame(
  frame: PulseEvaluationPacketFrame,
  evidenceById: Map<string, PrivateEvidence>,
) {
  const packets = manifest.packets.filter((packet) => packet.frame === frame);
  const studyId = deterministicUuid(`study|${manifest.semanticSha256}|${frame}`);
  const { study, snapshots } = buildSnapshots(frame, studyId, packets, evidenceById);
  const config = FRAME_CONFIG[frame];
  const existing = await db
    .select()
    .from(pulseCodingStudies)
    .where(eq(pulseCodingStudies.slug, config.slug))
    .limit(1);
  if (existing[0]) {
    assert.equal(existing[0].id, studyId, `${config.slug}: study identity drifted`);
    assert.equal(existing[0].status, "setup", `${config.slug}: study is no longer isolated`);
    assert.equal(existing[0].packetSetSha256, study.packetSetSha256);
  }
  if (!APPLY) return { slug: config.slug, studyId, packets: snapshots.length, existing: !!existing[0] };

  await db
    .insert(pulseCodingStudies)
    .values({
      ...study,
      slug: config.slug,
      createdBy: "PUL-041 seed script",
    })
    .onConflictDoNothing();
  await db
    .insert(pulseCodingAuditLog)
    .values({
      studyId,
      actorId: "system",
      actorRole: "system",
      action: "study_created",
      entityType: "coding_study",
      entityId: studyId,
      requestId: `pul-041-study-${studyId}`,
      afterSha256: pulseCodingHash(study),
      details: {
        labelStatus: "unlabeled",
        manifestSha256: manifest.semanticSha256,
        participantAccess: "disabled_while_setup",
      },
    })
    .onConflictDoNothing();
  for (let offset = 0; offset < snapshots.length; offset += 50) {
    const chunk = snapshots.slice(offset, offset + 50).map((snapshot) => ({
      recordId: deterministicUuid(`${studyId}|${snapshot.id}`),
      snapshot,
    }));
    await db.batch([
      db
        .insert(pulseCodingPackets)
        .values(
          chunk.map(({ recordId, snapshot }) => ({
            id: recordId,
            studyId,
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
            studyId,
            packetId: recordId,
            actorId: "system",
            actorRole: "system" as const,
            action: "packet_imported" as const,
            entityType: "coding_packet",
            entityId: recordId,
            requestId: `pul-041-packet-${recordId}`,
            afterSha256: snapshot.packetSnapshotSha256,
            details: { packetKey: snapshot.id, manifestSha256: manifest.semanticSha256 },
          })),
        )
        .onConflictDoNothing(),
    ]);
  }
  const [stored, participants, assignments] = await Promise.all([
    db.select().from(pulseCodingPackets).where(eq(pulseCodingPackets.studyId, studyId)),
    db.select().from(pulseCodingParticipants).where(eq(pulseCodingParticipants.studyId, studyId)),
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
  assert.equal(stored.length, snapshots.length, `${config.slug}: packet count drifted`);
  assert.equal(participants.length, 0, `${config.slug}: participants were issued prematurely`);
  assert.equal(assignments.length, 0, `${config.slug}: assignments were issued prematurely`);
  return { slug: config.slug, studyId, packets: stored.length, existing: !!existing[0] };
}

async function main() {
  assert.deepEqual(pulseEvaluationPacketManifestErrors(manifest), []);
  const evidenceById = await loadPrivateEvidence();
  const results = [];
  for (const frame of Object.keys(FRAME_CONFIG) as PulseEvaluationPacketFrame[])
    results.push(await seedFrame(frame, evidenceById));
  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry_run",
        writesPerformed: APPLY ? "idempotent_import" : 0,
        manifestSha256: manifest.semanticSha256,
        studies: results,
        credentialsIssued: 0,
        assignmentsCreated: 0,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
