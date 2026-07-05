/**
 * Admin queue — inbound contact messages.
 *
 * Contact submissions land in `contact_submissions` via the public form at
 * `/contact` → `/api/contact`. There's no email provider wired, so this queue
 * (and the `/api/admin/contact` JSON feed) is how messages surface. Each row
 * links to a read-only detail view where the operator reads the full message
 * and marks it read / archived.
 *
 * Auth gating happens in `(admin)/layout.tsx`; this page assumes a valid admin
 * session.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Chip } from "@/components/editorial/Pill";
import { DataTable } from "@/components/editorial/DataTable";

export const metadata: Metadata = {
  title: "Messages — Civica admin",
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
  searchParams: Promise<{ status?: string; page?: string }>;
}

function buildHref(status: Status | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "/admin/messages";
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

export default async function MessagesQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status =
    params.status && (STATUSES as readonly string[]).includes(params.status)
      ? (params.status as Status)
      : undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const base = db.select().from(contactSubmissions);
  const rows = await (status
    ? base.where(eq(contactSubmissions.status, status))
    : base
  )
    .orderBy(desc(contactSubmissions.createdAt))
    .limit(limit)
    .offset(offset);

  const countRows = await (status
    ? db
        .select({ n: sql<number>`count(*)::int` })
        .from(contactSubmissions)
        .where(eq(contactSubmissions.status, status))
    : db.select({ n: sql<number>`count(*)::int` }).from(contactSubmissions));
  const totalMatching = countRows[0]?.n ?? 0;

  return (
    <>
      <header className="admin-page-head">
        <h1 className="admin-title">Messages</h1>
        <p className="admin-subtitle">
          Contact submissions from the public form at{" "}
          <Link href="/contact">/contact</Link>. No email provider is wired, so
          this queue is how messages surface. Open a message to read it in full
          and mark it read or archived.
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
          <strong>No messages</strong>
          {totalMatching === 0 && !status
            ? "No one has sent a message yet."
            : "No messages match this filter."}
        </div>
      ) : (
        <div className="admin-table-scroll">
          <DataTable className="admin-table">
            <thead>
              <tr>
                <th>From / subject</th>
                <th>Status</th>
                <th className="num">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((msg) => {
                const msgStatus = (STATUSES as readonly string[]).includes(
                  msg.status
                )
                  ? (msg.status as Status)
                  : "new";
                return (
                  <tr key={msg.id}>
                    <td>
                      <Link
                        href={`/admin/messages/${msg.id}`}
                        className="admin-row-link"
                      >
                        <span className="admin-row-primary">
                          {msg.name} · {msg.subject}
                        </span>
                        <span className="admin-row-secondary">{msg.email}</span>
                      </Link>
                    </td>
                    <td>
                      <Chip variant={STATUS_VARIANT[msgStatus]}>
                        {STATUS_LABELS[msgStatus]}
                      </Chip>
                    </td>
                    <td className="num admin-cell-date">
                      {formatDate(msg.createdAt)}
                    </td>
                  </tr>
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
