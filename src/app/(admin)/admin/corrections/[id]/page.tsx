import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Chip } from "@/components/editorial/Pill";
import { isAtlasCorrectionSchemaReady } from "@/lib/corrections/schema-readiness";
import { db } from "@/lib/db";
import {
  atlasEntityChangeHistory,
  correctionLog,
} from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Atlas correction detail — Civica admin",
  robots: { index: false, follow: false },
};

const STATUSES = [
  "open",
  "in_review",
  "resolved_corrected",
  "resolved_no_change",
  "rejected",
] as const;

export default async function AtlasCorrectionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAtlasCorrectionSchemaReady())) notFound();
  const { id } = await params;
  const [rows, linkedChanges] = await Promise.all([
    db
      .select()
      .from(correctionLog)
      .where(eq(correctionLog.id, id))
      .limit(1),
    db
      .select({
        id: atlasEntityChangeHistory.id,
        entityType: atlasEntityChangeHistory.entityType,
        releaseId: atlasEntityChangeHistory.releaseId,
        changeKind: atlasEntityChangeHistory.changeKind,
        recordedAt: atlasEntityChangeHistory.recordedAt,
      })
      .from(atlasEntityChangeHistory)
      .where(eq(atlasEntityChangeHistory.correctionLogId, id)),
  ]);
  const report = rows[0];
  if (!report || report.category !== "atlas_data_error") notFound();
  const redirect = `/admin/corrections/${report.id}`;

  return (
    <>
      <Link href="/admin/corrections" className="admin-back-link">
        ← All Atlas corrections
      </Link>

      <header className="admin-page-head">
        <h1 className="admin-title">{report.acknowledgmentCode}</h1>
        <p className="admin-subtitle">
          {report.entityType} · {report.entityId} · {report.fieldPath}
        </p>
        <p className="admin-meta">
          <Chip>{report.status}</Chip>
          <span className="admin-meta-sep">·</span>
          <span>
            Received{" "}
            {report.submittedAt.toLocaleString("en", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </p>
      </header>

      <section className="admin-section">
        <h2 className="admin-section-title">Exact report coordinates</h2>
        <div className="admin-card">
          <dl className="admin-kv">
            <dt>Entity</dt>
            <dd>
              {report.entityType} · {report.entityId}
            </dd>
            <dt>Field</dt>
            <dd>{report.fieldPath}</dd>
            <dt>Affected release</dt>
            <dd>{report.affectedReleaseId}</dd>
            <dt>Displayed source</dt>
            <dd>{report.reportedSourceId}</dd>
            <dt>Source URL</dt>
            <dd>
              {report.reportedSourceUrl ? (
                <a href={report.reportedSourceUrl}>
                  {report.reportedSourceUrl}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt>Published value</dt>
            <dd>{report.publishedValue}</dd>
            <dt>Proposed value</dt>
            <dd>{report.proposedValue ?? "Not supplied"}</dd>
            <dt>Supporting evidence</dt>
            <dd>
              {report.evidenceUrl ? (
                <a href={report.evidenceUrl}>{report.evidenceUrl}</a>
              ) : (
                "Not supplied"
              )}
            </dd>
          </dl>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Report and submitter</h2>
        <div className="admin-card">
          <p className="admin-prose">{report.description}</p>
          <dl className="admin-kv">
            <dt>Name</dt>
            <dd>{report.submitterName ?? "Not supplied"}</dd>
            <dt>Email</dt>
            <dd>{report.submitterEmail ?? "Not supplied"}</dd>
            <dt>Affiliation</dt>
            <dd>{report.submitterAffiliation ?? "Not supplied"}</dd>
            <dt>Public log</dt>
            <dd>{report.isPublic ? "Included" : "Withheld by request"}</dd>
            <dt>Notice</dt>
            <dd>{report.noticeVersion}</dd>
          </dl>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Linked correction history</h2>
        <div className="admin-card">
          {linkedChanges.length ? (
            <ul>
              {linkedChanges.map((change) => (
                <li key={change.id}>
                  {change.changeKind} · {change.entityType} ·{" "}
                  {change.releaseId} ·{" "}
                  {change.recordedAt.toLocaleDateString("en", {
                    dateStyle: "medium",
                  })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-prose">
              No ATL-020 change event is linked. The report cannot be marked
              corrected until a versioned writer records one.
            </p>
          )}
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Triage</h2>
        <form
          method="post"
          action={`/api/admin/corrections/${report.id}`}
          className="admin-card"
        >
          <input type="hidden" name="redirect" value={redirect} />
          <div className="corr-field">
            <label className="corr-label" htmlFor="correction-status">
              Status
            </label>
            <select
              id="correction-status"
              name="status"
              className="corr-select"
              defaultValue={report.status}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="corr-field">
            <label className="corr-label" htmlFor="correction-disposition">
              Public disposition
            </label>
            <textarea
              id="correction-disposition"
              name="disposition"
              className="corr-textarea"
              rows={5}
              defaultValue={report.disposition ?? ""}
            />
          </div>
          <div className="corr-field">
            <label className="corr-label" htmlFor="correction-notes">
              Internal notes
            </label>
            <textarea
              id="correction-notes"
              name="internalNotes"
              className="corr-textarea"
              rows={5}
              defaultValue={report.internalNotes ?? ""}
            />
          </div>
          <label className="corr-privacy-label">
            <input
              type="checkbox"
              name="redactSubmitter"
              value="1"
              className="corr-checkbox"
            />
            <span>
              Redact optional name, email, and affiliation after a privacy
              request while retaining the evidence report.
            </span>
          </label>
          <button type="submit" className="btn btn--primary btn--sm">
            Record triage
          </button>
        </form>
      </section>
    </>
  );
}
