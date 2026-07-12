import type { Metadata } from "next";
import Link from "next/link";
import { Chip } from "@/components/editorial/Pill";
import { DataTable } from "@/components/editorial/DataTable";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import { getPulseCodingDashboard } from "@/lib/pulse/v2/coding-store";

export const metadata: Metadata = {
  title: "Independent coding — Civica admin",
  robots: { index: false, follow: false },
};

function statusVariant(status: string): "neutral" | "blue" | "warn" | "success" {
  if (["locked", "resolved", "closed"].includes(status)) return "success";
  if (["draft", "active"].includes(status)) return "blue";
  if (["unresolved", "setup"].includes(status)) return "warn";
  return "neutral";
}

export default async function PulseCodingDashboardPage() {
  const session = await getPulseCodingSession();
  if (!session) return null;
  const dashboard = await getPulseCodingDashboard(session);

  if (dashboard.kind === "admin") {
    return (
      <>
        <header className="admin-page-head">
          <p className="admin-eyebrow">Research coding · status only</p>
          <h1 className="admin-title">Independent coding studies</h1>
          <p className="admin-subtitle">
            Operational progress without label content. Raw answers stay hidden
            from the owner until adjudication is terminal.
          </p>
        </header>
        <div className="admin-note">
          <strong>Structural separation:</strong> this workspace never queries
          the production Pulse review output. Study administration cannot define
          an answer key.
        </div>
        <div className="admin-table-scroll">
          <DataTable className="admin-table">
            <thead>
              <tr>
                <th>Study</th>
                <th>State</th>
                <th>Packets / people</th>
                <th>Locked / compared</th>
                <th>Terminal review</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.studies.map((study) => (
                <tr key={study.id}>
                  <td>
                    <span className="admin-row-primary">{study.title}</span>
                    <span className="admin-row-secondary">{study.purpose}</span>
                  </td>
                  <td><Chip variant={statusVariant(study.status)}>{study.status}</Chip></td>
                  <td>{study.packets} packets · {study.participants} participants</td>
                  <td>{study.lockedCoderAssignments} locks · {study.comparisons} comparisons</td>
                  <td>{study.adjudicated} adjudicated · {study.unresolved} unresolved</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
        <div className="admin-actions coding-dashboard-actions">
          <Link href="/admin/pulse-coding/participants" className="btn btn--secondary">
            Manage access
          </Link>
          <Link href="/admin/pulse-coding/exports" className="btn btn--secondary">
            Export audit bundles
          </Link>
        </div>
      </>
    );
  }

  const isCoder = session.role === "coder";
  return (
    <>
      <header className="admin-page-head">
        <p className="admin-eyebrow">{dashboard.study.title}</p>
        <h1 className="admin-title">
          {isCoder ? "My assignments" : "Adjudication queue"}
        </h1>
        <p className="admin-subtitle">
          {isCoder
            ? "Code each country-day independently. Peer progress and labels remain hidden after you lock."
            : "A comparison becomes available only after both independent submissions are locked."}
        </p>
        <p className="admin-meta">
          <span className="admin-meta-num">{dashboard.assignments.length}</span>
          <span>assigned packets</span>
          <span className="admin-meta-sep">·</span>
          <span>{dashboard.study.codebookVersion}</span>
        </p>
      </header>
      <div className="admin-note">
        <strong>Blind boundary:</strong> production labels, model votes, owner
        approvals, numeric effects, and purported gold answers are not present in
        this workspace.
      </div>
      <div className="admin-table-scroll">
        <DataTable className="admin-table">
          <thead>
            <tr>
              <th>Packet</th>
              <th>Sampled date</th>
              <th>Method</th>
              <th>Your state</th>
              <th><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {dashboard.assignments.map((assignment) => (
              <tr key={assignment.assignmentId}>
                <td>
                  <span className="admin-row-primary">{assignment.country}</span>
                  <span className="admin-row-secondary">
                    {assignment.iso3 ?? "Synthetic pilot"} · {assignment.packetKey}
                  </span>
                </td>
                <td>{assignment.date}</td>
                <td>
                  <span className="admin-row-secondary">{assignment.codebookVersion}</span>
                  <span className="admin-row-secondary">{assignment.ontologyVersion}</span>
                </td>
                <td><Chip variant={statusVariant(assignment.status)}>{assignment.status}</Chip></td>
                <td>
                  <Link
                    className="btn btn--secondary btn--sm"
                    href={`/admin/pulse-coding/assignments/${assignment.assignmentId}`}
                  >
                    {assignment.status === "locked" ? "View" : isCoder ? "Code" : "Open"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </>
  );
}
