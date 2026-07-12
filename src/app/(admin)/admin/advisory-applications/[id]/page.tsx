/**
 * Advisory-application detail + triage.
 *
 * Full application view with the status-transition buttons. Each button POSTs
 * to the existing `/api/admin/advisory-applications/[id]` route (auth: admin
 * session cookie), which flips `status` and 303s back here. Auth gating for the
 * page itself happens in `(admin)/layout.tsx`.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import { Chip } from "@/components/editorial/Pill";
import { advisoryApplicationRetentionDeadline } from "@/lib/research/advisory-application";

export const metadata: Metadata = {
  title: "Application detail — Civica admin",
  robots: { index: false, follow: false },
};

const STATUSES = ["new", "reviewed", "contacted", "archived"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  reviewed: "Reviewed",
  contacted: "Contacted",
  archived: "Archived",
};

const STATUS_VARIANT: Record<Status, "neutral" | "accent" | "success" | "warn"> =
  {
    new: "accent",
    reviewed: "warn",
    contacted: "success",
    archived: "neutral",
  };

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(value: Date | string): string {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function AdvisoryApplicationDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(advisoryApplications)
    .where(eq(advisoryApplications.id, id))
    .limit(1);
  const app = rows[0];
  if (!app) notFound();

  const appStatus = (STATUSES as readonly string[]).includes(app.status)
    ? (app.status as Status)
    : "new";
  const redirectTo = `/admin/advisory-applications/${app.id}`;

  return (
    <>
      <Link href="/admin/advisory-applications" className="admin-back-link">
        ← All applications
      </Link>

      <header className="admin-page-head">
        <h1 className="admin-title">{app.name}</h1>
        <p className="admin-subtitle">
          {app.role} · {app.institution}
        </p>
        <p className="admin-meta">
          <Chip variant={STATUS_VARIANT[appStatus]}>
            {STATUS_LABELS[appStatus]}
          </Chip>
          <Chip>{app.expertiseArea}</Chip>
          <span className="admin-meta-sep">·</span>
          <span>Received {formatDate(app.createdAt)}</span>
          <span className="admin-meta-sep">·</span>
          <span>Delete by {formatDate(advisoryApplicationRetentionDeadline(new Date(app.createdAt)))}</span>
        </p>
      </header>

      <section className="admin-section">
        <h2 className="admin-section-title">Contact</h2>
        <div className="admin-card">
          <dl className="admin-kv">
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${app.email}`}>{app.email}</a>
            </dd>
            <dt>Institution</dt>
            <dd>{app.institution}</dd>
            <dt>Role</dt>
            <dd>{app.role}</dd>
            <dt>Expertise</dt>
            <dd>{app.expertiseArea}</dd>
            {app.cvUrl && isHttpUrl(app.cvUrl) ? (
              <>
                <dt>CV / profile</dt>
                <dd>
                  <a
                    href={app.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {app.cvUrl} ↗
                  </a>
                </dd>
              </>
            ) : null}
            {app.links ? (
              <>
                <dt>Links</dt>
                <dd className="admin-prose admin-prose-muted">{app.links}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Retention and deletion</h2>
        <p className="admin-section-intro">
          The public application notice commits Civica to deleting this record
          within 18 months of receipt. Appointment records are created separately.
          Permanent deletion cannot be undone.
        </p>
        <form method="post" action={`/api/admin/advisory-applications/${app.id}`} className="admin-action-form">
          <input type="hidden" name="intent" value="delete" />
          <label>
            <input type="checkbox" name="confirm" value="delete" required />{" "}
            I understand this permanently deletes the application.
          </label>
          <button type="submit" className="btn btn--secondary btn--sm">
            Delete application permanently
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Experience</h2>
        <div className="admin-card">
          <p className="admin-prose">{app.experience}</p>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Set status</h2>
        <p className="admin-section-intro">
          Flip the triage status. The current status is disabled. This updates{" "}
          <code>advisory_applications.status</code> so the queue filter reflects
          reality.
        </p>
        <div className="admin-actions">
          {STATUSES.map((s) => (
            <form
              key={s}
              method="post"
              action={`/api/admin/advisory-applications/${app.id}`}
              className="admin-action-form"
            >
              <input type="hidden" name="status" value={s} />
              <input type="hidden" name="redirect" value={redirectTo} />
              <button
                type="submit"
                className={
                  s === "archived"
                    ? "btn btn--secondary btn--sm"
                    : "btn btn--tertiary btn--sm"
                }
                disabled={appStatus === s}
                aria-current={appStatus === s ? "true" : undefined}
              >
                {STATUS_LABELS[s]}
              </button>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}
