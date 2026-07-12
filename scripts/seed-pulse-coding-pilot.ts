import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import { db } from "../src/lib/db";
import {
  pulseCodingAuditLog,
  pulseCodingPackets,
  pulseCodingStudies,
} from "../src/lib/db/schema";
import {
  PULSE_CODER_PILOT_VERSION,
  PULSE_INDEPENDENT_CODING_VERSION,
  pulseCoderPilotErrors,
  type PulseCoderPilotPacket,
} from "../src/lib/pulse/v2/coder-protocol";
import {
  PULSE_CODING_WORKSPACE_VERSION,
  pulseCodingHash,
  pulseCodingPacketErrors,
  pulseCodingPacketHash,
  type PulseCodingPacketSnapshot,
  type PulseCodingStudyContract,
} from "../src/lib/pulse/v2/coding-workspace";
import { PULSE_EVENT_ONTOLOGY_VERSION } from "../src/lib/pulse/v2/event-ontology";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const STUDY_SLUG = "pulse-independent-coding-synthetic-pilot-v1";
const pilot = JSON.parse(
  readFileSync("data/research/pulse-coder-pilot-v1.json", "utf8"),
) as Record<string, unknown> & {
  semanticSha256: string;
  packets: PulseCoderPilotPacket[];
};

const pilotErrors = pulseCoderPilotErrors(pilot);
if (pilotErrors.length) throw new Error(pilotErrors.join("; "));
const blindPackets = pilot.packets.filter(({ split }) => split === "blind_pilot");

async function main() {
  const existing = await db
    .select()
    .from(pulseCodingStudies)
    .where(eq(pulseCodingStudies.slug, STUDY_SLUG))
    .limit(1);
  if (!APPLY) {
    console.log(
      JSON.stringify(
        {
          writesPerformed: 0,
          mode: "dry_run",
          studySlug: STUDY_SLUG,
          datasetVersion: PULSE_CODER_PILOT_VERSION,
          packetSetSha256: pilot.semanticSha256,
          blindPackets: blindPackets.length,
          existing: Boolean(existing[0]),
          labelStatus: "unlabeled_dry_run_not_gold",
        },
        null,
        2,
      ),
    );
    return;
  }

  if (existing[0]) {
    if (
      existing[0].packetSetSha256 !== pilot.semanticSha256 ||
      existing[0].datasetVersion !== PULSE_CODER_PILOT_VERSION
    )
      throw new Error("Existing coding pilot points to another frozen artifact");
    const packetRows = await db
      .select({ id: pulseCodingPackets.id })
      .from(pulseCodingPackets)
      .where(eq(pulseCodingPackets.studyId, existing[0].id));
    if (packetRows.length !== blindPackets.length)
      throw new Error("Existing coding pilot packet count drifted");
    console.log(
      `PASS — ${STUDY_SLUG} already exists with ${packetRows.length} frozen packets.`,
    );
    return;
  }

  const studyId = randomUUID();
  const studyTitle = "Independent coding synthetic pilot";
    const study: PulseCodingStudyContract = {
      schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
      id: studyId,
      title: studyTitle,
      purpose: "instruction_pilot",
      protocolVersion: PULSE_INDEPENDENT_CODING_VERSION,
      codebookVersion: PULSE_INDEPENDENT_CODING_VERSION,
      ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
      datasetVersion: PULSE_CODER_PILOT_VERSION,
      packetSetSha256: pilot.semanticSha256,
      traceSetSha256: null,
      status: "active",
    };
    const snapshots = blindPackets.map((packet) => {
      const body: Omit<PulseCodingPacketSnapshot, "packetSnapshotSha256"> = {
        schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
        studyId,
        datasetVersion: PULSE_CODER_PILOT_VERSION,
        packetSetSha256: pilot.semanticSha256,
        id: packet.id,
        date: packet.date,
        jurisdiction: {
          id: `synthetic:${packet.countryAlias}`,
          name: packet.countryAlias,
          iso3: null,
        },
        analysisStatus: "pilot",
        searchFamilies: packet.searchFamilies,
        telemetry: packet.telemetry,
        informationEnvironment: packet.informationEnvironment,
        evidence: packet.evidence,
      };
      const snapshot: PulseCodingPacketSnapshot = {
        ...body,
        packetSnapshotSha256: pulseCodingPacketHash(body),
      };
      const errors = pulseCodingPacketErrors(snapshot, study);
      if (errors.length) throw new Error(`${packet.id}: ${errors.join("; ")}`);
      return snapshot;
    });
  const packetRows = snapshots.map((snapshot) => ({
    recordId: randomUUID(),
    snapshot,
  }));
  await db.batch([
    db
      .insert(pulseCodingStudies)
      .values({
        id: studyId,
        slug: STUDY_SLUG,
        schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
        title: studyTitle,
        purpose: "instruction_pilot",
        protocolVersion: PULSE_INDEPENDENT_CODING_VERSION,
        codebookVersion: PULSE_INDEPENDENT_CODING_VERSION,
        ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
        datasetVersion: PULSE_CODER_PILOT_VERSION,
        packetSetSha256: pilot.semanticSha256,
        status: "active",
        createdBy: "PUL-017 seed script",
      }),
    db
      .insert(pulseCodingPackets)
      .values(
        packetRows.map(({ recordId, snapshot }) => ({
          id: recordId,
          studyId,
          packetKey: snapshot.id,
          analysisStatus: snapshot.analysisStatus,
          packetSnapshot: snapshot,
          packetSnapshotSha256: snapshot.packetSnapshotSha256,
        })),
      ),
    db.insert(pulseCodingAuditLog).values([
      {
        studyId,
        actorId: "system",
        actorRole: "system",
        action: "study_created",
        entityType: "coding_study",
        entityId: studyId,
        afterSha256: pulseCodingHash(study),
        details: { labelStatus: "unlabeled_dry_run_not_gold" },
      },
      ...packetRows.map(({ recordId, snapshot }) => {
        return {
          studyId,
          packetId: recordId,
          actorId: "system",
          actorRole: "system" as const,
          action: "packet_imported" as const,
          entityType: "coding_packet",
          entityId: recordId,
          afterSha256: snapshot.packetSnapshotSha256,
          details: { packetKey: snapshot.id },
        };
      }),
    ]),
  ]);
  const created = { studyId, packets: packetRows.length };
  console.log(
    `PASS — seeded ${STUDY_SLUG} with ${created.packets} frozen answer-free packets (${created.studyId}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
