import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  pulseCodingAssignments,
  pulseCodingAuditLog,
  pulseCodingPackets,
  pulseCodingParticipants,
  pulseCodingStudies,
} from "../src/lib/db/schema";
import {
  PULSE_INDEPENDENT_CODING_VERSION,
  type PulseCoderPilotPacket,
} from "../src/lib/pulse/v2/coder-protocol";
import {
  PULSE_CODING_WORKSPACE_VERSION,
  pulseCodingAccessCodeHash,
  pulseCodingHash,
  pulseCodingPacketHash,
  type PulseCodingPacketSnapshot,
} from "../src/lib/pulse/v2/coding-workspace";
import { PULSE_EVENT_ONTOLOGY_VERSION } from "../src/lib/pulse/v2/event-ontology";

config({ path: ".env.local" });

const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] ?? "editor";
const revoke = process.argv.includes("--revoke");
if (!["editor", "locked", "adjudicator"].includes(target))
  throw new Error("target must be editor, locked, or adjudicator");

async function ensureEditorFixture() {
  const slug = "pul-017-browser-qa-v1";
  let study = (
    await db.select().from(pulseCodingStudies).where(eq(pulseCodingStudies.slug, slug)).limit(1)
  )[0];
  if (!study) {
    const pilot = JSON.parse(
      readFileSync("data/research/pulse-coder-pilot-v1.json", "utf8"),
    ) as { semanticSha256: string; packets: PulseCoderPilotPacket[] };
    const source = pilot.packets.find(({ id }) => id === "PILOT-001")!;
    const studyId = randomUUID();
    const packetId = randomUUID();
    const participantId = randomUUID();
    const assignmentId = randomUUID();
    const packetSetSha256 = pulseCodingHash({
      purpose: "PUL-017 browser QA",
      source: pilot.semanticSha256,
      packet: source.id,
    });
    const body: Omit<PulseCodingPacketSnapshot, "packetSnapshotSha256"> = {
      schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
      studyId,
      datasetVersion: "pulse-coding-ui-qa/v1",
      packetSetSha256,
      id: "QA-PEACEFUL-TRANSFER",
      date: source.date,
      jurisdiction: { id: "synthetic:qa", name: source.countryAlias, iso3: null },
      analysisStatus: "pilot",
      searchFamilies: source.searchFamilies,
      telemetry: source.telemetry,
      informationEnvironment: source.informationEnvironment,
      evidence: source.evidence,
    };
    const snapshot: PulseCodingPacketSnapshot = {
      ...body,
      packetSnapshotSha256: pulseCodingPacketHash(body),
    };
    await db.batch([
      db.insert(pulseCodingStudies).values({
        id: studyId,
        slug,
        schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
        title: "PUL-017 browser QA",
        purpose: "instruction_pilot",
        protocolVersion: PULSE_INDEPENDENT_CODING_VERSION,
        codebookVersion: PULSE_INDEPENDENT_CODING_VERSION,
        ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
        datasetVersion: "pulse-coding-ui-qa/v1",
        packetSetSha256,
        status: "active",
        createdBy: "PUL-017 browser QA",
      }),
      db.insert(pulseCodingPackets).values({
        id: packetId,
        studyId,
        packetKey: snapshot.id,
        analysisStatus: "pilot",
        packetSnapshot: snapshot,
        packetSnapshotSha256: snapshot.packetSnapshotSha256,
      }),
      db.insert(pulseCodingParticipants).values({
        id: participantId,
        studyId,
        pseudonym: "QA-CODER",
        role: "coder",
        actorType: "agent_dry_pilot",
        useStatus: "dry_run_not_gold",
        credentialHash: "0".repeat(64),
        status: "revoked",
        revokedAt: new Date(),
      }),
      db.insert(pulseCodingAssignments).values({
        id: assignmentId,
        packetId,
        participantId,
        slot: "coder_a",
      }),
      db.insert(pulseCodingAuditLog).values({
        studyId,
        packetId,
        participantId,
        actorId: "PUL-017 browser QA",
        actorRole: "system",
        action: "study_created",
        entityType: "browser_qa_fixture",
        entityId: studyId,
        details: { dryRunNotGold: true },
      }),
    ]);
    study = (
      await db.select().from(pulseCodingStudies).where(eq(pulseCodingStudies.id, studyId)).limit(1)
    )[0];
  }
  const participant = (
    await db
      .select()
      .from(pulseCodingParticipants)
      .where(
        and(
          eq(pulseCodingParticipants.studyId, study.id),
          eq(pulseCodingParticipants.pseudonym, "QA-CODER"),
        ),
      )
      .limit(1)
  )[0];
  return { study, participant };
}

async function existingPilotParticipant(pseudonym: string) {
  const rows = await db
    .select({ study: pulseCodingStudies, participant: pulseCodingParticipants })
    .from(pulseCodingParticipants)
    .innerJoin(
      pulseCodingStudies,
      eq(pulseCodingParticipants.studyId, pulseCodingStudies.id),
    )
    .where(
      and(
        eq(pulseCodingStudies.slug, "pulse-independent-coding-synthetic-pilot-v1"),
        eq(pulseCodingParticipants.pseudonym, pseudonym),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error(`Missing ${pseudonym}; run the tool pilot first`);
  return rows[0];
}

async function main() {
  const record =
    target === "editor"
      ? await ensureEditorFixture()
      : await existingPilotParticipant(
          target === "locked" ? "SP-CODER-A" : "SP-ADJUDICATOR",
        );
  if (revoke) {
    await db.batch([
      db
        .update(pulseCodingParticipants)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(eq(pulseCodingParticipants.id, record.participant.id)),
      db.insert(pulseCodingAuditLog).values({
        studyId: record.study.id,
        participantId: record.participant.id,
        actorId: "PUL-017 browser QA",
        actorRole: "system",
        action: "participant_revoked",
        entityType: "coding_participant",
        entityId: record.participant.id,
        details: { target, reason: "Browser QA complete" },
      }),
    ]);
    console.log(`PASS — revoked ${target} browser-QA access.`);
    return;
  }
  const code = `pc_${randomBytes(32).toString("base64url")}`;
  await db.batch([
    db
      .update(pulseCodingStudies)
      .set({ status: "active", closedAt: null })
      .where(eq(pulseCodingStudies.id, record.study.id)),
    db
      .update(pulseCodingParticipants)
      .set({
        credentialHash: pulseCodingAccessCodeHash(code),
        status: "active",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: null,
      })
      .where(eq(pulseCodingParticipants.id, record.participant.id)),
    db.insert(pulseCodingAuditLog).values({
      studyId: record.study.id,
      participantId: record.participant.id,
      actorId: "PUL-017 browser QA",
      actorRole: "system",
      action: "participant_issued",
      entityType: "coding_participant",
      entityId: record.participant.id,
      afterSha256: pulseCodingHash({ target, participantId: record.participant.id }),
      details: { target, accessCodeRetained: false },
    }),
  ]);
  console.log(code);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
