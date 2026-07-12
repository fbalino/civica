import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pulseCodingStudies } from "@/lib/db/schema";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";

export const metadata: Metadata = {
  title: "Coding exports — Civica admin",
  robots: { index: false, follow: false },
};

export default async function PulseCodingExportsPage() {
  const session = await getPulseCodingSession();
  if (!session || session.role === "coder") redirect("/admin/pulse-coding");
  const studies = await db
    .select({ id: pulseCodingStudies.id, title: pulseCodingStudies.title, status: pulseCodingStudies.status })
    .from(pulseCodingStudies)
    .where(
      session.kind === "participant"
        ? eq(pulseCodingStudies.id, session.studyId)
        : eq(pulseCodingStudies.status, "closed"),
    )
    .orderBy(asc(pulseCodingStudies.title));
  return (
    <>
      <header className="admin-page-head">
        <p className="admin-eyebrow">Research coding</p>
        <h1 className="admin-title">Audit exports</h1>
        <p className="admin-subtitle">
          Deterministic bundles retain frozen packets, both immutable raw submissions,
          disagreement axes, adjudications, version hashes, and the append-only access log.
        </p>
      </header>
      <div className="admin-note">
        <strong>Claim boundary:</strong> an export is coding evidence, not a gold release,
        validation result, governance score, or owner-approved answer key.
      </div>
      {session.kind === "admin" ? (
        <div className="admin-note">
          Study administrators see status only while coding is active. A bundle becomes
          available after closure and terminal treatment of every disagreement.
        </div>
      ) : null}
      <div className="coding-export-list">
        {studies.map((study) => (
          <article className="admin-card" key={study.id}>
            <p className="admin-eyebrow">{study.status}</p>
            <h2 className="admin-section-title">{study.title}</h2>
            <a className="btn btn--secondary" href={`/api/pulse-coding/exports/${study.id}`}>
              Download JSON audit bundle
            </a>
          </article>
        ))}
        {studies.length === 0 ? (
          <p className="admin-empty">No terminal coding study is ready to export.</p>
        ) : null}
      </div>
    </>
  );
}
