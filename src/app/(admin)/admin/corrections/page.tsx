import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";

import { AdminRow } from "@/app/(admin)/AdminRow";
import { DataTable } from "@/components/editorial/DataTable";
import { Chip } from "@/components/editorial/Pill";
import { isAtlasCorrectionSchemaReady } from "@/lib/corrections/schema-readiness";
import { db } from "@/lib/db";
import { correctionLog } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Atlas corrections — Civica admin",
  robots: { index: false, follow: false },
};

const STATUSES = [
  "open",
  "in_review",
  "resolved_corrected",
  "resolved_no_change",
  "rejected",
] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  in_review: "In review",
  resolved_corrected: "Corrected",
  resolved_no_change: "No change",
  rejected: "Rejected",
};

const STATUS_VARIANTS: Record<
  Status,
  "neutral" | "accent" | "success" | "warn"
> = {
  open: "warn",
  in_review: "accent",
  resolved_corrected: "success",
  resolved_no_change: "neutral",
  rejected: "neutral",
};

function href(status: Status | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "/admin/corrections";
}

export default async function AtlasCorrectionsQueue({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const schemaReady = await isAtlasCorrectionSchemaReady();
  if (!schemaReady) {
    return (
      <>
        <header className="admin-page-head">
          <h1 className="admin-title">Atlas corrections</h1>
          <p className="admin-subtitle">
            The append-only ATL-024 schema has not been activated in this
            environment. The public form is also safely unavailable.
          </p>
        </header>
        <div className="admin-empty">
          <strong>Migration pending</strong>
          Apply the authoritative migration through the release protocol before
          accepting or triaging Atlas data reports.
        </div>
      </>
    );
  }

  const params = await searchParams;
  const status =
    params.status && (STATUSES as readonly string[]).includes(params.status)
      ? (params.status as Status)
      : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;
  const filter = status
    ? sql`${correctionLog.category} = 'atlas_data_error' AND ${correctionLog.status} = ${status}`
    : eq(correctionLog.category, "atlas_data_error");
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: correctionLog.id,
        acknowledgmentCode: correctionLog.acknowledgmentCode,
        entityType: correctionLog.entityType,
        entityId: correctionLog.entityId,
        fieldPath: correctionLog.fieldPath,
        status: correctionLog.status,
        submittedAt: correctionLog.submittedAt,
      })
      .from(correctionLog)
      .where(filter)
      .orderBy(desc(correctionLog.submittedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(correctionLog)
      .where(filter),
  ]);
  const total = counts[0]?.count ?? 0;

  return (
    <>
      <header className="admin-page-head">
        <h1 className="admin-title">Atlas corrections</h1>
        <p className="admin-subtitle">
          Precise public reports with immutable intake coordinates and
          authenticated triage. A corrected resolution requires a linked
          release-history event.
        </p>
        <p className="admin-meta">
          <span className="admin-meta-num">{total}</span>
          <span>matching reports</span>
        </p>
      </header>

      <div className="admin-filters">
        <div className="admin-filter-row">
          <span className="admin-filter-label">Status</span>
          <Link
            href={href(undefined, 1)}
            className={
              status
                ? "editorial-chip"
                : "editorial-chip editorial-chip--active"
            }
          >
            All
          </Link>
          {STATUSES.map((candidate) => (
            <Link
              key={candidate}
              href={href(candidate, 1)}
              className={
                status === candidate
                  ? "editorial-chip editorial-chip--active"
                  : "editorial-chip"
              }
            >
              {STATUS_LABELS[candidate]}
            </Link>
          ))}
        </div>
      </div>

      {rows.length ? (
        <div className="admin-table-scroll">
          <DataTable className="admin-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Record</th>
                <th>Status</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowStatus = (STATUSES as readonly string[]).includes(
                  row.status,
                )
                  ? (row.status as Status)
                  : "open";
                return (
                  <AdminRow key={row.id}>
                    <td>
                      <Link
                        href={`/admin/corrections/${row.id}`}
                        className="admin-row-link"
                      >
                        <span className="admin-row-primary">
                          {row.acknowledgmentCode}
                        </span>
                        <span className="admin-row-secondary">
                          {row.entityType}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="admin-row-primary">{row.entityId}</span>
                      <span className="admin-row-secondary">
                        {row.fieldPath}
                      </span>
                    </td>
                    <td>
                      <Chip variant={STATUS_VARIANTS[rowStatus]}>
                        {STATUS_LABELS[rowStatus]}
                      </Chip>
                    </td>
                    <td>
                      {row.submittedAt.toLocaleDateString("en", {
                        dateStyle: "medium",
                      })}
                    </td>
                  </AdminRow>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      ) : (
        <div className="admin-empty">
          <strong>No Atlas reports</strong>
          No reports match this filter.
        </div>
      )}

      {total > limit ? (
        <nav className="admin-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link href={href(status, page - 1)}>← Page {page - 1}</Link>
          ) : (
            <span aria-hidden>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < total ? (
            <Link href={href(status, page + 1)}>Page {page + 1} →</Link>
          ) : (
            <span aria-hidden>—</span>
          )}
        </nav>
      ) : null}
    </>
  );
}
