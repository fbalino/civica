import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  pulseCodingAssignments,
  pulseCodingAuditLog,
  pulseCodingComparisons,
  pulseCodingPackets,
  pulseCodingParticipants,
  pulseCodingStudies,
} from "../src/lib/db/schema";
import type { PulseCoderSubmission } from "../src/lib/pulse/v2/coder-protocol";
import type { PulseCodingParticipantSession } from "../src/lib/pulse/v2/coding-session";
import {
  issuePulseCodingParticipant,
  ensurePulseCodingComparison,
  lockPulseCodingSubmission,
  recordPulseCodingAdjudication,
  type PulseCodingDraftInput,
} from "../src/lib/pulse/v2/coding-store";
import type { PulseCodingPacketSnapshot } from "../src/lib/pulse/v2/coding-workspace";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const STUDY_SLUG = "pulse-independent-coding-synthetic-pilot-v1";
const CODERS = [
  { pseudonym: "SP-CODER-A", slot: "coder_a" as const },
  { pseudonym: "SP-CODER-B", slot: "coder_b" as const },
  { pseudonym: "SP-ADJUDICATOR", slot: "adjudicator" as const },
];

const submissions = [
  ...(JSON.parse(
    readFileSync("data/research/pulse-coder-pilot-sp-a-v1.json", "utf8"),
  ) as PulseCoderSubmission[]),
  ...(JSON.parse(
    readFileSync("data/research/pulse-coder-pilot-sp-b-v1.json", "utf8"),
  ) as PulseCoderSubmission[]),
];

function answerOf(submission: PulseCoderSubmission) {
  return {
    packetOutcome: submission.packetOutcome,
    observationState: submission.observationState,
    observationRationale: submission.observationRationale,
    events: submission.events,
    candidateEvents: submission.candidateEvents,
    excludedEvidenceIds: submission.excludedEvidenceIds,
    coderNotes: submission.coderNotes,
  };
}

async function main() {
  const studies = await db
    .select()
    .from(pulseCodingStudies)
    .where(eq(pulseCodingStudies.slug, STUDY_SLUG))
    .limit(1);
  const study = studies[0];
  if (!study) throw new Error("Seed the PUL-017 synthetic study first");
  const existingComparisons = await db
    .select({ id: pulseCodingComparisons.id })
    .from(pulseCodingComparisons)
    .innerJoin(
      pulseCodingPackets,
      eq(pulseCodingComparisons.packetId, pulseCodingPackets.id),
    )
    .where(eq(pulseCodingPackets.studyId, study.id));
  if (!APPLY) {
    console.log(
      JSON.stringify(
        {
          writesPerformed: 0,
          mode: "dry_run",
          studyId: study.id,
          packets: 12,
          independentSubmissions: submissions.length,
          participants: CODERS.length,
          existingComparisons: existingComparisons.length,
          useStatus: "dry_run_not_gold",
          credentialsRetained: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (existingComparisons.length === 12) {
    console.log("PASS — PUL-017 tool pilot already has 12 immutable comparisons.");
    return;
  }
  if (existingComparisons.length)
    throw new Error("Partial tool pilot exists; inspect before rerunning");

  const issued: Array<{
    participantId: string;
    pseudonym: string;
    slot: (typeof CODERS)[number]["slot"];
  }> = [];
  const existingParticipants = await db
    .select({
      id: pulseCodingParticipants.id,
      pseudonym: pulseCodingParticipants.pseudonym,
      role: pulseCodingParticipants.role,
      status: pulseCodingParticipants.status,
    })
    .from(pulseCodingParticipants)
    .where(eq(pulseCodingParticipants.studyId, study.id));
  for (const participant of CODERS) {
    const found = existingParticipants.find(
      ({ pseudonym }) => pseudonym === participant.pseudonym,
    );
    if (found && found.status !== "active")
      throw new Error(`Partial pilot participant ${found.pseudonym} is not active`);
    const result = found
      ? { participantId: found.id }
      : await issuePulseCodingParticipant({
          actorId: "PUL-017 tool pilot",
          studyId: study.id,
          pseudonym: participant.pseudonym,
          slot: participant.slot,
          actorType: "agent_dry_pilot",
          useStatus: "dry_run_not_gold",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          requestId: randomUUID(),
        });
    issued.push({
      participantId: result.participantId,
      pseudonym: participant.pseudonym,
      slot: participant.slot,
    });
  }

  const packets = await db
    .select({
      recordId: pulseCodingPackets.id,
      packetKey: pulseCodingPackets.packetKey,
      snapshot: pulseCodingPackets.packetSnapshot,
    })
    .from(pulseCodingPackets)
    .where(eq(pulseCodingPackets.studyId, study.id));
  const packetByKey = new Map(packets.map((packet) => [packet.packetKey, packet]));

  for (const coder of issued.filter(({ slot }) => slot !== "adjudicator")) {
    const assignmentRows = await db
      .select({
        id: pulseCodingAssignments.id,
        packetId: pulseCodingAssignments.packetId,
        status: pulseCodingAssignments.status,
      })
      .from(pulseCodingAssignments)
      .where(eq(pulseCodingAssignments.participantId, coder.participantId));
    const assignmentByPacket = new Map(
      assignmentRows.map((assignment) => [assignment.packetId, assignment]),
    );
    const session: PulseCodingParticipantSession = {
      kind: "participant",
      participantId: coder.participantId,
      studyId: study.id,
      studySlug: study.slug,
      pseudonym: coder.pseudonym,
      role: "coder",
      actorType: "agent_dry_pilot",
      useStatus: "dry_run_not_gold",
    };
    for (const raw of submissions.filter(({ coderId }) => coder.pseudonym === coderId)) {
      const packet = packetByKey.get(raw.packetId);
      if (!packet) throw new Error(`Missing packet ${raw.packetId}`);
      const snapshot = packet.snapshot as PulseCodingPacketSnapshot;
      const draft: PulseCodingDraftInput = {
        evidenceAssessments: snapshot.evidence.map((evidence) => ({
          evidenceId: evidence.id,
          accessState: evidence.accessState,
          dateRelevance:
            evidence.reportedDate === snapshot.date ? "relevant" : "undetermined",
          reportedDate: evidence.reportedDate,
          sourceFamilyId: evidence.sourceFamilyId,
          notes: `Dry pilot retained ${evidence.accessState} state from the frozen synthetic packet.`,
        })),
        addedEvidence: [],
        answer: answerOf(raw),
      };
      const assignment = assignmentByPacket.get(packet.recordId);
      if (!assignment) throw new Error(`Missing assignment for ${raw.packetId}`);
      if (assignment.status !== "locked") {
        await lockPulseCodingSubmission({
          session,
          assignmentId: assignment.id,
          requestId: randomUUID(),
          draft,
        });
      }
    }
  }

  for (const packet of packets)
    await ensurePulseCodingComparison(packet.recordId, study.id);

  const adjudicator = issued.find(({ slot }) => slot === "adjudicator")!;
  const adjudicatorAssignments = await db
    .select({
      id: pulseCodingAssignments.id,
      packetId: pulseCodingAssignments.packetId,
      packetKey: pulseCodingPackets.packetKey,
      comparisonSha256: pulseCodingComparisons.comparisonSha256,
      axes: pulseCodingComparisons.disagreementAxes,
    })
    .from(pulseCodingAssignments)
    .innerJoin(
      pulseCodingPackets,
      eq(pulseCodingAssignments.packetId, pulseCodingPackets.id),
    )
    .innerJoin(
      pulseCodingComparisons,
      eq(pulseCodingAssignments.packetId, pulseCodingComparisons.packetId),
    )
    .where(
      and(
        eq(pulseCodingAssignments.participantId, adjudicator.participantId),
        inArray(pulseCodingAssignments.slot, ["adjudicator"]),
      ),
    )
    .orderBy(asc(pulseCodingPackets.packetKey));
  const judgeSession: PulseCodingParticipantSession = {
    kind: "participant",
    participantId: adjudicator.participantId,
    studyId: study.id,
    studySlug: study.slug,
    pseudonym: adjudicator.pseudonym,
    role: "adjudicator",
    actorType: "agent_dry_pilot",
    useStatus: "dry_run_not_gold",
  };
  for (const assignment of adjudicatorAssignments.filter(({ axes }) => axes.length)) {
    const firstAxis = assignment.axes[0];
    const reasonCode =
      firstAxis === "effect_direction"
        ? "effect_direction"
        : firstAxis === "severity"
          ? "severity"
          : firstAxis === "category_labels"
            ? "category_boundary"
            : "scope_boundary";
    await recordPulseCodingAdjudication({
      session: judgeSession,
      assignmentId: assignment.id,
      requestId: randomUUID(),
      adjudication: {
        packetId: assignment.packetKey,
        comparisonSha256: assignment.comparisonSha256,
        status: "unresolved",
        reasonCodes: [reasonCode],
        resolution: {
          kind: "unresolved",
          rationale:
            "Synthetic same-model tool pilot preserves this disagreement for later qualified human adjudication.",
        },
      },
    });
  }

  const revokedAt = new Date();
  await db.batch([
    db
      .update(pulseCodingParticipants)
      .set({ status: "revoked", revokedAt })
      .where(inArray(pulseCodingParticipants.id, issued.map(({ participantId }) => participantId))),
    db.insert(pulseCodingAuditLog).values(
      issued.map((participant) => ({
        studyId: study.id,
        participantId: participant.participantId,
        actorId: "PUL-017 tool pilot",
        actorRole: "system" as const,
        action: "participant_revoked" as const,
        entityType: "coding_participant",
        entityId: participant.participantId,
        details: { reason: "Synthetic tool pilot complete; plaintext access code was never retained." },
      })),
    ),
  ]);
  console.log(
    "PASS — locked 24 dry-run submissions, generated 12 comparisons, preserved disagreements, and revoked all synthetic credentials.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
