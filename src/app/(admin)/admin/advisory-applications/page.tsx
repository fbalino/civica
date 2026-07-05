/**
 * Admin queue — inbound advisory-board applications.
 *
 * Lists applications in the canonical DataTable; each row links to a detail
 * view where the operator reads the full application and flips its triage
 * status. Applications arrive via the public form at
 * `/about/advisory-board/apply` → `/api/advisory-applications` (DB insert),
 * the same "row-in-DB, read via authed admin surface" path contact messages
 * use. The JSON feed lives at `/api/admin/advisory-applications`.
 *
 * Auth gating happens in `(admin)/layout.tsx`; this page assumes a valid admin
 * session.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AdminRow } from "@/app/(admin)/AdminRow";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Chip } from "@/components/editorial/Pill";
import { DataTable } from "@/components/editorial/DataTable";

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

const STATUS_VARIANT: Record<Status, "neutral" | "accent" | "success" | "warn"> =
  {
    new: "accent",
    reviewed: "warn",
    contacted: "success",
    archived: "neutral",
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
    <>
      <header className="admin-page-head">
        <h1 className="admin-title">Advisory applications</h1>
        <p className="admin-subtitle">
          People applying to the independent academic advisory board via{" "}
          <Link href="/about/advisory-board/apply">
            /about/advisory-board/apply
          </Link>
          . Applications are stored in the database — this queue (and the{" "}
          <code>/api/admin/advisory-applications</code> JSON feed) is how new
          applications surface, the same way contact messages do.
        </p>
        <p className="admin-meta">
          <span className="admin-meta-num">{totalMatching}</span>
          <span>{status ? STATUS_LABELS[status].toLowerCase() : "total"}</span>
          <span className="admin-meta-sep">·</span>
          <span>
            Showing <span className="admin-meta-num">{rows.length}</span>
          </span>
        </p>
      </header>

      <div className="admin-filters">
        <div className="admin-filter-row">
          <span className="admin-filter-label">Status</span>
          <FilterChip href={buildHref(undefined, 1)} active={!status}>
            All
          </FilterChip>
          {STATUSES.map((s) => (
            <FilterChip key={s} href={buildHref(s, 1)} active={status === s}>
              {STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-empty">
          <strong>No applications</strong>
          {totalMatching === 0 && !status
            ? "No one has applied to the advisory board yet."
            : "No applications match this filter."}
        </div>
      ) : (
        <div className="admin-table-scroll">
          <DataTable className="admin-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Expertise</th>
                <th>Status</th>
                <th className="num">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((app) => {
                const appStatus = (STATUSES as readonly string[]).includes(
                  app.status
                )
                  ? (app.status as Status)
                  : "new";
                return (
                  <AdminRow key={app.id} href={`/admin/advisory-applications/${app.id}`}>
                    <td>
                      <Link
                        href={`/admin/advisory-applications/${app.id}`}
                        className="admin-row-link"
                      >
                        <span className="admin-row-primary">{app.name}</span>
                        <span className="admin-row-secondary">
                          {app.role} · {app.institution}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Chip>{app.expertiseArea}</Chip>
                    </td>
                    <td>
                      <Chip variant={STATUS_VARIANT[appStatus]}>
                        {STATUS_LABELS[appStatus]}
                      </Chip>
                    </td>
                    <td className="num admin-cell-date">
                      {formatDate(app.createdAt)}
                    </td>
                  </AdminRow>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      )}

      {totalMatching > limit ? (
        <nav className="admin-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link href={buildHref(status, page - 1)}>← Page {page - 1}</Link>
          ) : (
            <span aria-hidden>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < totalMatching ? (
            <Link href={buildHref(status, page + 1)}>Page {page + 1} →</Link>
          ) : (
            <span aria-hidden>—</span>
          )}
        </nav>
      ) : null}
    </>
  );
}
