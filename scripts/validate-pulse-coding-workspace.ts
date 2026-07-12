import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  pulseCodingAdjudications,
  pulseCodingAssignments,
  pulseCodingComparisons,
  pulseCodingPackets,
  pulseCodingParticipants,
  pulseCodingStudies,
} from "../src/lib/db/schema";
import {
  comparePulseCodingSubmissions,
  pulseCodingCanAdjudicate,
  pulseCodingCanReadPeerSubmission,
  type PulseCodingSubmissionEnvelope,
} from "../src/lib/pulse/v2/coding-workspace";
import { exportPulseCodingStudy } from "../src/lib/pulse/v2/coding-store";

config({ path: ".env.local" });

const errors: string[] = [];
const requiredFiles = [
  "src/app/(coding)/admin/pulse-coding/layout.tsx",
  "src/app/(coding)/admin/pulse-coding/page.tsx",
  "src/app/(coding)/admin/pulse-coding/assignments/[id]/page.tsx",
  "src/app/(coding)/admin/pulse-coding/assignments/[id]/CodingEditor.tsx",
  "src/app/(coding)/admin/pulse-coding/assignments/[id]/AdjudicationForm.tsx",
  "src/app/(coding-auth)/admin/pulse-coding/sign-in/page.tsx",
  "src/app/api/pulse-coding/session/route.ts",
  "src/app/api/pulse-coding/assignments/[id]/route.ts",
  "src/app/api/pulse-coding/adjudications/[assignmentId]/route.ts",
  "src/app/api/pulse-coding/exports/[studyId]/route.ts",
];
for (const path of requiredFiles) {
  try {
    readFileSync(path, "utf8");
  } catch {
    errors.push(`missing workspace route ${path}`);
  }
}

const migration = [
  readFileSync("drizzle/authoritative/0021_steep_brood.sql", "utf8"),
  readFileSync("drizzle/authoritative/0022_puzzling_killraven.sql", "utf8"),
].join("\n");
for (const marker of [
  "pulse_coding_assignment_lock_guard",
  "pulse_coding_comparisons_append_only",
  "pulse_coding_adjudication_terminal_guard",
  "pulse_coding_assignment_role_guard",
  "pulse_coding_adjudicator_guard",
  "civica_pulse_coding_has_forbidden_field",
]) {
  if (!migration.includes(marker)) errors.push(`migration lacks ${marker}`);
}

const editor = readFileSync(
  "src/app/(coding)/admin/pulse-coding/assignments/[id]/CodingEditor.tsx",
  "utf8",
);
for (const marker of [
  "Read the boundary before assigning",
  "Candidate events",
  "Review and lock",
  "PULSE_PACKET_OUTCOMES",
  "PULSE_CODER_OBSERVATION_STATES",
]) {
  if (!editor.includes(marker)) errors.push(`coding editor lacks ${marker}`);
}
const adjudicationUi = readFileSync(
  "src/app/(coding)/admin/pulse-coding/assignments/[id]/AdjudicationForm.tsx",
  "utf8",
);
if (!adjudicationUi.includes("There is no majority-vote option"))
  errors.push("adjudication UI does not prohibit majority voting");
if (!adjudicationUi.includes("PULSE_ADJUDICATION_REASON_CODES"))
  errors.push("adjudication UI does not use canonical reason codes");

const coderContext = {
  participantId: "coder-a",
  role: "coder" as const,
  assignedCoderIds: ["coder-a", "coder-b"] as [string, string],
  assignedAdjudicatorId: "judge",
  ownSubmissionLocked: true,
  bothSubmissionsLocked: true,
  adjudicationTerminal: true,
};
if (pulseCodingCanReadPeerSubmission(coderContext))
  errors.push("coder can read peer labels after lock");
if (
  pulseCodingCanAdjudicate({
    ...coderContext,
    role: "adjudicator",
    assignedAdjudicatorId: "coder-a",
  })
)
  errors.push("coder can adjudicate their own packet");

async function validateLive() {
  const studies = await db
    .select()
    .from(pulseCodingStudies)
    .where(eq(pulseCodingStudies.slug, "pulse-independent-coding-synthetic-pilot-v1"))
    .limit(1);
  const study = studies[0];
  if (!study) {
    errors.push("live synthetic coding study is absent");
    return;
  }
  const [packets, participants, assignments, comparisons, adjudications] =
    await Promise.all([
      db.select().from(pulseCodingPackets).where(eq(pulseCodingPackets.studyId, study.id)),
      db
        .select()
        .from(pulseCodingParticipants)
        .where(eq(pulseCodingParticipants.studyId, study.id)),
      db
        .select({ assignment: pulseCodingAssignments })
        .from(pulseCodingAssignments)
        .innerJoin(
          pulseCodingPackets,
          eq(pulseCodingAssignments.packetId, pulseCodingPackets.id),
        )
        .where(eq(pulseCodingPackets.studyId, study.id)),
      db
        .select()
        .from(pulseCodingComparisons)
        .innerJoin(
          pulseCodingPackets,
          eq(pulseCodingComparisons.packetId, pulseCodingPackets.id),
        )
        .where(eq(pulseCodingPackets.studyId, study.id)),
      db
        .select({ adjudication: pulseCodingAdjudications })
        .from(pulseCodingAdjudications)
        .innerJoin(
          pulseCodingComparisons,
          eq(pulseCodingAdjudications.comparisonId, pulseCodingComparisons.id),
        )
        .innerJoin(
          pulseCodingPackets,
          eq(pulseCodingComparisons.packetId, pulseCodingPackets.id),
        )
        .where(eq(pulseCodingPackets.studyId, study.id)),
    ]);
  const assignmentRows = assignments.map(({ assignment }) => assignment);
  if (packets.length !== 12) errors.push(`live packet count is ${packets.length}`);
  if (participants.length !== 3) errors.push(`live participant count is ${participants.length}`);
  if (participants.some(({ status }) => status !== "revoked"))
    errors.push("synthetic access credential remains active");
  if (assignmentRows.length !== 36)
    errors.push(`live assignment count is ${assignmentRows.length}`);
  if (
    assignmentRows.filter(
      ({ slot, status }) => ["coder_a", "coder_b"].includes(slot) && status === "locked",
    ).length !== 24
  )
    errors.push("not all dry coder submissions are locked");
  if (comparisons.length !== 12)
    errors.push(`live comparison count is ${comparisons.length}`);
  if (
    comparisons.filter(({ pulse_coding_comparisons: row }) =>
      row.disagreementAxes.length > 0,
    ).length !== 3
  )
    errors.push("live disagreement count is not three");
  if (
    adjudications.length !== 3 ||
    adjudications.some(({ adjudication }) => adjudication.status !== "unresolved")
  )
    errors.push("dry adjudication did not preserve all three disagreements as unresolved");

  const assignmentsByPacket = new Map<string, PulseCodingSubmissionEnvelope[]>();
  for (const row of assignmentRows) {
    if (!row.submission) continue;
    const list = assignmentsByPacket.get(row.packetId) ?? [];
    list.push(row.submission as PulseCodingSubmissionEnvelope);
    assignmentsByPacket.set(row.packetId, list);
  }
  for (const joined of comparisons) {
    const comparison = joined.pulse_coding_comparisons;
    const pair = assignmentsByPacket.get(comparison.packetId) ?? [];
    if (pair.length !== 2) {
      errors.push(`${comparison.packetId}: comparison lacks two raw submissions`);
      continue;
    }
    const recomputed = comparePulseCodingSubmissions(pair[0], pair[1]);
    if (recomputed.sha256 !== comparison.comparisonSha256)
      errors.push(`${comparison.packetId}: comparison hash cannot be reproduced`);
  }

  const forbidden = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM pulse_coding_packets
        WHERE civica_pulse_coding_has_forbidden_field(packet_snapshot))::int AS packets,
      (SELECT count(*) FROM pulse_coding_assignments
        WHERE civica_pulse_coding_has_forbidden_field(draft)
           OR civica_pulse_coding_has_forbidden_field(submission))::int AS assignments,
      (SELECT count(*) FROM pulse_coding_comparisons
        WHERE civica_pulse_coding_has_forbidden_field(comparison))::int AS comparisons,
      (SELECT count(*) FROM pulse_coding_adjudications
        WHERE civica_pulse_coding_has_forbidden_field(resolution))::int AS adjudications
  `);
  const forbiddenRows = ((forbidden as unknown as { rows?: unknown[] }).rows ??
    forbidden) as Array<Record<string, unknown>>;
  if (
    Object.values(forbiddenRows[0] ?? {}).some((value) => Number(value) !== 0)
  )
    errors.push("forbidden production or answer-key field exists in live coding data");

  const lockedAssignment = assignmentRows.find(({ status }) => status === "locked");
  if (!lockedAssignment) errors.push("no locked assignment available for immutability probe");
  else {
    try {
      await db
        .update(pulseCodingAssignments)
        .set({ draftUpdatedAt: new Date() })
        .where(eq(pulseCodingAssignments.id, lockedAssignment.id));
      errors.push("database allowed a locked submission mutation");
    } catch (error) {
      const detail = `${String(error)} ${String(
        (error as { cause?: unknown })?.cause ?? "",
      )}`;
      if (!detail.includes("immutable"))
        errors.push(`locked-submission probe failed for an unexpected reason: ${detail}`);
    }
  }

  const coder = participants.find(({ role }) => role === "coder");
  if (coder && packets[0]) {
    try {
      await db.insert(pulseCodingAssignments).values({
        id: randomUUID(),
        packetId: packets[0].id,
        participantId: coder.id,
        slot: "adjudicator",
      });
      errors.push("database allowed a coder in an adjudicator slot");
    } catch (error) {
      if (!/adjudicator|unique/i.test(String(error)))
        errors.push("role-collision probe failed for an unexpected reason");
    }
  }

  const adjudicator = participants.find(({ role }) => role === "adjudicator");
  if (!adjudicator) errors.push("live study lacks its adjudicator");
  else {
    const exportSession = {
      kind: "participant" as const,
      participantId: adjudicator.id,
      studyId: study.id,
      studySlug: study.slug,
      pseudonym: adjudicator.pseudonym,
      role: "adjudicator" as const,
      actorType: adjudicator.actorType as "qualified_human" | "agent_dry_pilot",
      useStatus: adjudicator.useStatus as
        | "evaluation_candidate"
        | "dry_run_not_gold",
    };
    const firstExport = await exportPulseCodingStudy(exportSession, study.id);
    const secondExport = await exportPulseCodingStudy(exportSession, study.id);
    if (firstExport.semanticSha256 !== secondExport.semanticSha256)
      errors.push("unchanged live state produced nondeterministic export hashes");
    if (
      JSON.stringify(firstExport).includes("credentialHash") ||
      JSON.stringify(firstExport).includes("credential_hash")
    )
      errors.push("coding export exposes a participant credential hash");
  }
}

async function main() {
  if (process.argv.includes("--live")) await validateLive();
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(
    `PASS — pulse-coding-workspace/v1: separate role sessions, blind packet routes, immutable locks, separate adjudication, deterministic export, and${
      process.argv.includes("--live") ? " 12 live dry-run comparisons with three preserved disagreements" : " static access contracts"
    }.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
