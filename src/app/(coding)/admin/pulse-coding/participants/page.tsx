import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Chip } from "@/components/editorial/Pill";
import { DataTable } from "@/components/editorial/DataTable";
import { db } from "@/lib/db";
import { pulseCodingParticipants, pulseCodingStudies } from "@/lib/db/schema";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import { ParticipantIssuer } from "./ParticipantIssuer";

export const metadata: Metadata = {
  title: "Coding access — Civica admin",
  robots: { index: false, follow: false },
};

export default async function PulseCodingParticipantsPage() {
  const session = await getPulseCodingSession();
  if (session?.role !== "study_admin") redirect("/admin/pulse-coding");
  const [studies, participants] = await Promise.all([
    db
      .select({ id: pulseCodingStudies.id, title: pulseCodingStudies.title })
      .from(pulseCodingStudies)
      .where(eq(pulseCodingStudies.status, "active"))
      .orderBy(asc(pulseCodingStudies.title)),
    db
      .select({
        id: pulseCodingParticipants.id,
        pseudonym: pulseCodingParticipants.pseudonym,
        role: pulseCodingParticipants.role,
        actorType: pulseCodingParticipants.actorType,
        useStatus: pulseCodingParticipants.useStatus,
        status: pulseCodingParticipants.status,
        studyTitle: pulseCodingStudies.title,
      })
      .from(pulseCodingParticipants)
      .innerJoin(
        pulseCodingStudies,
        eq(pulseCodingParticipants.studyId, pulseCodingStudies.id),
      )
      .orderBy(asc(pulseCodingStudies.title), asc(pulseCodingParticipants.pseudonym)),
  ]);
  return (
    <>
      <header className="admin-page-head">
        <p className="admin-eyebrow">Research coding</p>
        <h1 className="admin-title">Participant access</h1>
        <p className="admin-subtitle">
          Issue pseudonymous, role-scoped access without sharing the owner account.
          Random codes are stored only as hashes and can be revoked.
        </p>
      </header>
      <section className="admin-card" aria-labelledby="issue-access-title">
        <h2 id="issue-access-title" className="admin-section-title">Issue one role</h2>
        <ParticipantIssuer studies={studies} />
      </section>
      <section className="admin-section" aria-labelledby="participants-title">
        <h2 id="participants-title" className="admin-section-title">Current participants</h2>
        <div className="admin-table-scroll">
          <DataTable className="admin-table">
            <thead><tr><th>Pseudonym</th><th>Study</th><th>Role</th><th>Use</th><th>State</th></tr></thead>
            <tbody>
              {participants.map((participant) => (
                <tr key={participant.id}>
                  <td className="admin-row-primary">{participant.pseudonym}</td>
                  <td>{participant.studyTitle}</td>
                  <td>{participant.role}</td>
                  <td><Chip variant={participant.useStatus === "dry_run_not_gold" ? "warn" : "blue"}>{participant.useStatus}</Chip></td>
                  <td><Chip variant={participant.status === "active" ? "success" : "neutral"}>{participant.status}</Chip></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </section>
    </>
  );
}
