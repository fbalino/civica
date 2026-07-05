/**
 * Admin queue — inbound advisory-board applications.
 *
 * Mirrors `/admin/data-disputes`:
 *   - Filter chips (by triage status)
 *   - Editorial cards listing each application
 *
 * Auth gating happens in `(admin)/layout.tsx`; this page assumes a
 * valid admin session. Applications arrive via the public form at
 * `/about/advisory-board/apply` → `/api/advisory-applications` (DB
 * insert), the same "row-in-DB, read via authed admin surface" path
 * the contact form uses. The JSON feed lives at
 * `/api/admin/advisory-applications`.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Pill } from "@/components/editorial/Pill";

export const metadata: Metadata = {
  title: "Advisory applications — Civica admin",
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

const STATUS_VARIANT: Record<Status, "default" | "accent" | "success" | "warn"> = {
  new: "accent",
  reviewed: "warn",
  contacted: "success",
  archived: "default",
};

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

function buildHref(status: Status | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "/admin/advisory-applications";
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

function FilterChip({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active ? "editorial-chip editorial-chip--active" : "editorial-chip"
      }
    >
      {children}
    </Link>
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function AdvisoryApplicationsQueuePage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const status =
    params.status && (STATUSES as readonly string[]).includes(params.status)
      ? (params.status as Status)
      : undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  // Where to send the operator back to after a status change — preserve the
  // active filter + page so the queue view doesn't reset.
  const redirectTo = buildHref(status, page);

  const base = db.select().from(advisoryApplications);
  const rows = await (status
    ? base.where(eq(advisoryApplications.status, status))
    : base
  )
    .orderBy(desc(advisoryApplications.createdAt))
    .limit(limit)
    .offset(offset);

  const countRows = await (status
    ? db
        .select({ n: sql<number>`count(*)::int` })
        .from(advisoryApplications)
        .where(eq(advisoryApplications.status, status))
    : db.select({ n: sql<number>`count(*)::int` }).from(advisoryApplications));
  const totalMatching = countRows[0]?.n ?? 0;

  return (
    <EditorialPage width="wide">
      <h1 className="editorial-page-title">Advisory applications</h1>
      <p className="editorial-page-subtitle">
        People applying to the independent academic advisory board via{" "}
        <Link href="/about/advisory-board/apply">
          /about/advisory-board/apply
        </Link>
        . Applications are stored in the database; there is no email provider
        wired, so this queue (and the{" "}
        <code>/api/admin/advisory-applications</code> JSON feed) is how new
        applications surface — the same way contact submissions do.
      </p>

      <p
        className="editorial-page-meta"
        style={{ marginBottom: 24, gap: 12, flexWrap: "wrap" }}
      >
        <span>
          {totalMatching} {status ? STATUS_LABELS[status].toLowerCase() : "total"}
        </span>
        <span>·</span>
        <span>Showing {rows.length}</span>
      </p>

      <div className="editorial-filter-bar">
        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Status</span>
          <FilterChip href={buildHref(undefined, 1)} active={!status}>
            All
          </FilterChip>
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              href={buildHref(s, 1)}
              active={status === s}
            >
              {STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="editorial-empty">
          {totalMatching === 0 && !status
            ? "No applications yet."
            : "No applications match this filter."}
        </p>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {rows.map((app) => {
            const appStatus = (STATUSES as readonly string[]).includes(app.status)
              ? (app.status as Status)
              : "new";
            return (
              <article key={app.id} className="editorial-card">
                <header className="editorial-card-head">
                  <div className="editorial-card-head-left">
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "var(--text-16)",
                        fontWeight: 500,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {app.name}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-13)",
                        color: "var(--color-text-40)",
                      }}
                    >
                      {app.role} · {app.institution}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-12)",
                        color: "var(--color-text-40)",
                        letterSpacing: "var(--tracking-wide)",
                      }}
                    >
                      · {formatDate(app.createdAt)}
                    </span>
                  </div>
                  <div className="editorial-card-pills">
                    <Pill variant={STATUS_VARIANT[appStatus]}>
                      {STATUS_LABELS[appStatus]}
                    </Pill>
                    <Pill>{app.expertiseArea}</Pill>
                  </div>
                </header>

                <p
                  style={{
                    marginTop: 12,
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-15)",
                    lineHeight: "var(--leading-relaxed)",
                    color: "var(--color-text-60)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {app.experience}
                </p>

                <footer
                  className="editorial-card-foot"
                  style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}
                >
                  <a href={`mailto:${app.email}`}>{app.email}</a>
                  {app.cvUrl && isHttpUrl(app.cvUrl) ? (
                    <a
                      href={app.cvUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      CV / profile →
                    </a>
                  ) : null}
                </footer>

                {app.links ? (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: "var(--text-13)",
                      color: "var(--color-text-40)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {app.links}
                  </div>
                ) : null}

                <div
                  className="editorial-card-foot"
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span className="editorial-filter-label">Set status</span>
                  {STATUSES.map((s) => (
                    <form
                      key={s}
                      method="post"
                      action={`/api/admin/advisory-applications/${app.id}`}
                    >
                      <input type="hidden" name="status" value={s} />
                      <input type="hidden" name="redirect" value={redirectTo} />
                      <button
                        type="submit"
                        className="btn btn--tertiary btn--sm"
                        disabled={appStatus === s}
                        aria-current={appStatus === s ? "true" : undefined}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    </form>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalMatching > limit ? (
        <nav className="editorial-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link href={buildHref(status, page - 1)}>← Page {page - 1}</Link>
          ) : (
            <span>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < totalMatching ? (
            <Link href={buildHref(status, page + 1)}>Page {page + 1} →</Link>
          ) : (
            <span>—</span>
          )}
        </nav>
      ) : null}
    </EditorialPage>
  );
}
