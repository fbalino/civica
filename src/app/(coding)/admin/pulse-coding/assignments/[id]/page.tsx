import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chip } from "@/components/editorial/Pill";
import boundaryArtifact from "../../../../../../../data/research/pulse-category-coding-boundaries-v1.json";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import { getPulseCodingWorkspace, type PulseCodingDraftInput } from "@/lib/pulse/v2/coding-store";
import { EVENT_CATEGORY_INDEX } from "@/lib/pulse/v2/taxonomy";
import { CodingEditor, type CodingBoundary } from "./CodingEditor";
import { SubmissionSummary } from "./SubmissionSummary";
import { AdjudicationForm } from "./AdjudicationForm";

export const metadata: Metadata = {
  title: "Coding packet — Civica admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PulseCodingAssignmentPage({ params }: PageProps) {
  const session = await getPulseCodingSession();
  if (!session) redirect("/admin/pulse-coding/sign-in");
  if (session.kind !== "participant") redirect("/admin/pulse-coding");
  const { id } = await params;
  const workspace = await getPulseCodingWorkspace(session, id);
  if (!workspace) notFound();
  const boundaries: CodingBoundary[] = boundaryArtifact.categories.map((boundary) => ({
    ...boundary,
    label: EVENT_CATEGORY_INDEX[boundary.categoryId]?.label ?? boundary.categoryId.replaceAll("_", " "),
    dimension: EVENT_CATEGORY_INDEX[boundary.categoryId]?.dimension ?? "unmapped",
  }));
  const lockedSubmission = workspace.assignment.submission;

  return (
    <>
      <nav className="admin-breadcrumbs">
        <Link href="/admin/pulse-coding">Independent coding</Link>
        <span className="admin-breadcrumbs-sep" aria-hidden>/</span>
        <span>{workspace.packet.jurisdiction.name} · {workspace.packet.date}</span>
      </nav>
      <header className="admin-page-head coding-packet-head">
        <p className="admin-eyebrow">{workspace.assignment.slot.replaceAll("_", " ")} · {workspace.packet.analysisStatus.replaceAll("_", " ")}</p>
        <h1 className="admin-title">{workspace.packet.jurisdiction.name} — {workspace.packet.date}</h1>
        <p className="admin-subtitle">
          One sampled sovereign-country UTC day. Code zero, one, or several distinct events without inferring a country verdict.
        </p>
        <div className="coding-version-strip">
          <Chip variant="blue">{workspace.study.codebookVersion}</Chip>
          <Chip variant="neutral">{workspace.study.ontologyVersion}</Chip>
          <Chip variant="neutral">Packet {workspace.packet.packetSnapshotSha256.slice(0, 12)}</Chip>
          <Chip variant={session.useStatus === "dry_run_not_gold" ? "warn" : "blue"}>
            {session.useStatus === "dry_run_not_gold" ? "Dry run — not gold" : "Evaluation candidate"}
          </Chip>
        </div>
      </header>
      <div className="admin-note">
        <strong>Blind evidence boundary:</strong> production labels, model votes,
        publication state, owner approvals, peer work, and purported gold answers
        are absent. Evidence-channel tags remain because retrieval misses require them.
      </div>

      {session.role === "coder" ? (
        lockedSubmission ? (
          <>
            <div className="admin-note">
              <strong>Locked and immutable.</strong> Your raw response is preserved.
              Peer labels and disagreement results remain hidden from coders.
            </div>
            <SubmissionSummary submission={lockedSubmission} label="Your submission" />
          </>
        ) : (
          <CodingEditor
            assignmentId={workspace.assignment.id}
            packet={workspace.packet}
            boundaries={boundaries}
            initialDraft={
              workspace.assignment.draft
                ? {
                    evidenceAssessments: workspace.assignment.draft.evidenceAssessments,
                    addedEvidence: workspace.assignment.draft.addedEvidence,
                    answer: workspace.assignment.draft.answer,
                  } satisfies PulseCodingDraftInput
                : null
            }
          />
        )
      ) : workspace.comparison && workspace.peerSubmissions ? (
        <>
          <div className="coding-comparison-grid">
            <SubmissionSummary submission={workspace.peerSubmissions[0]} label="Coder A · immutable raw" />
            <SubmissionSummary submission={workspace.peerSubmissions[1]} label="Coder B · immutable raw" />
          </div>
          {workspace.adjudication ? (
            <section className="admin-card">
              <p className="admin-eyebrow">Terminal adjudication</p>
              <h2 className="admin-section-title">Decision preserved</h2>
              <pre className="coding-json-readout">{JSON.stringify(workspace.adjudication, null, 2)}</pre>
            </section>
          ) : (
            <AdjudicationForm
              assignmentId={workspace.assignment.id}
              packetId={workspace.packet.id}
              comparisonSha256={workspace.comparison.sha256}
              axes={workspace.comparison.axes}
              submissions={workspace.peerSubmissions}
            />
          )}
        </>
      ) : (
        <section className="admin-card">
          <p className="admin-eyebrow">Waiting</p>
          <h2 className="admin-section-title">Comparison not available</h2>
          <p className="admin-section-intro">
            Both independent submissions must lock before this adjudicator can see
            either answer. Individual coder progress is deliberately hidden.
          </p>
        </section>
      )}
    </>
  );
}
