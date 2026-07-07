/**
 * Contact-message detail — read-only view + triage.
 *
 * Shows the full submission (sender, subject, message body, metadata) and the
 * status-transition buttons. Each button POSTs to `/api/admin/messages/[id]`
 * (auth: admin session cookie), which flips `status` and 303s back here. Page
 * auth gating happens in `(admin)/layout.tsx`.
 *
 * The message body itself is never mutated — this surface is read-only apart
 * from the triage status.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
import { Chip } from "@/components/editorial/Pill";

export const metadata: Metadata = {
  title: "Message detail — Civica admin",
  robots: { index: false, follow: false },
};

const STATUSES = ["new", "read", "archived"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  read: "Read",
  archived: "Archived",
};

const STATUS_VARIANT: Record<Status, "neutral" | "accent" | "success"> = {
  new: "accent",
  read: "success",
  archived: "neutral",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(value: Date | string): string {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MessageDetailPage({ params }: PageProps) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(contactSubmissions)
    .where(eq(contactSubmissions.id, id))
    .limit(1);
  const msg = rows[0];
  if (!msg) notFound();

  const msgStatus = (STATUSES as readonly string[]).includes(msg.status)
    ? (msg.status as Status)
    : "new";
  const redirectTo = `/admin/messages/${msg.id}`;
  const mailtoHref = `mailto:${msg.email}?subject=${encodeURIComponent(
    `Re: ${msg.subject}`
  )}`;

  return (
    <>
      <Link href="/admin/messages" className="admin-back-link">
        ← All messages
      </Link>

      <header className="admin-page-head">
        <h1 className="admin-title">{msg.subject}</h1>
        <p className="admin-subtitle">
          From {msg.name} · <a href={mailtoHref}>{msg.email}</a>
        </p>
        <p className="admin-meta">
          <Chip variant={STATUS_VARIANT[msgStatus]}>
            {STATUS_LABELS[msgStatus]}
          </Chip>
          <span className="admin-meta-sep">·</span>
          <span>Received {formatDateTime(msg.createdAt)}</span>
        </p>
      </header>

      <section className="admin-section">
        <h2 className="admin-section-title">Sender</h2>
        <div className="admin-card">
          <dl className="admin-kv">
            <dt>Name</dt>
            <dd>{msg.name}</dd>
            <dt>Email</dt>
            <dd>
              <a href={mailtoHref}>{msg.email}</a>
            </dd>
            <dt>Subject</dt>
            <dd>{msg.subject}</dd>
            {msg.ipAddress ? (
              <>
                <dt>IP address</dt>
                <dd>{msg.ipAddress}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Message</h2>
        <div className="admin-card">
          <p className="admin-prose">{msg.message}</p>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Set status</h2>
        <p className="admin-section-intro">
          Mark this message read or archived. The current status is disabled.
          This is the only mutation on this surface — the message itself is
          never edited.
        </p>
        <div className="admin-actions">
          {STATUSES.map((s) => (
            <form
              key={s}
              method="post"
              action={`/api/admin/messages/${msg.id}`}
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
                disabled={msgStatus === s}
                aria-current={msgStatus === s ? "true" : undefined}
              >
                Mark {STATUS_LABELS[s].toLowerCase()}
              </button>
            </form>
          ))}
          <a href={mailtoHref} className="btn btn--primary btn--sm">
            Reply by email
          </a>
        </div>
      </section>
    </>
  );
}
