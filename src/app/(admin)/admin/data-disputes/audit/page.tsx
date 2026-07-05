/**
 * `/admin/data-disputes/audit` — read-only timeline of every state change
 * across all disputes, sourced from `data_facts_audit_log` joined to the
 * dispute + jurisdiction.
 *
 * Filters: action chip, country slug (exact match), date range (since / until).
 * No mutations — this is a read surface.
 *
 * Methodology: ~/civica/plan/disputes-triage-resolution-v1.md §2b
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Chip } from "@/components/editorial/Pill";
import {
  getAuditTimeline,
  AUDIT_ACTION_FILTER_LABELS,
} from "@/lib/factbook/reconcile/dispute-audit-log";

export const metadata: Metadata = {
  title: "Disputes audit log — Civica admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    action?: string;
    country?: string;
    since?: string;
    until?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 100;

function buildHref(
  base: Record<string, string | undefined>,
  override: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...override };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "/admin/data-disputes/audit";
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

function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionVariant(
  action: string
): "neutral" | "accent" | "warn" {
  if (action === "auto_resolve_stale") return "neutral";
  if (action === "reopen") return "warn";
  return "accent";
}

export default async function DisputesAuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const action =
    params.action && AUDIT_ACTION_FILTER_LABELS[params.action]
      ? params.action
      : undefined;
  const country = params.country?.trim() || undefined;
  const since = params.since?.trim() || undefined;
  const until = params.until?.trim() || undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { rows, totalCount } = await getAuditTimeline({
    action,
    countrySlug: country,
    sinceIso: since,
    untilIso: until,
    limit: PAGE_SIZE,
    offset,
  });

  const baseParams = { action, country, since, until };
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <Link href="/admin/data-disputes" className="admin-back-link">
        ← Back to queue
      </Link>

      <header className="admin-page-head">
        <h1 className="admin-title">Disputes audit log</h1>
        <p className="admin-subtitle">
          Append-only timeline of every state change on{" "}
          <code>data_disputes</code>. Sourced from{" "}
          <code>data_facts_audit_log</code>. Each row preserves the pre- and
          post-update snapshot, the actor, and any reviewer notes.
        </p>
        <p className="admin-meta">
          <span className="admin-meta-num">{totalCount}</span>
          <span>total entries</span>
          <span className="admin-meta-sep">·</span>
          <span>
            Showing <span className="admin-meta-num">{rows.length}</span>
          </span>
          <span className="admin-meta-sep">·</span>
          <span>
            Page {page} of {totalPages}
          </span>
        </p>
      </header>

      <div className="admin-filters">
        <div className="admin-filter-row">
          <span className="admin-filter-label">Action</span>
          <FilterChip
            href={buildHref(baseParams, { action: undefined, page: undefined })}
            active={!action}
          >
            All
          </FilterChip>
          {Object.entries(AUDIT_ACTION_FILTER_LABELS).map(([key, label]) => (
            <FilterChip
              key={key}
              href={buildHref(baseParams, { action: key, page: undefined })}
              active={action === key}
            >
              {label}
            </FilterChip>
          ))}
        </div>

        <div className="admin-filter-row">
          <span className="admin-filter-label">Find</span>
          <form
            method="GET"
            action="/admin/data-disputes/audit"
            className="admin-filter-inline"
          >
            {action ? (
              <input type="hidden" name="action" value={action} />
            ) : null}
            <input
              className="admin-input-inline"
              type="text"
              name="country"
              placeholder="country slug (e.g. argentina)"
              defaultValue={country ?? ""}
            />
            <input
              className="admin-input-inline"
              type="date"
              name="since"
              defaultValue={since ?? ""}
              aria-label="Since"
            />
            <input
              className="admin-input-inline"
              type="date"
              name="until"
              defaultValue={until ?? ""}
              aria-label="Until"
            />
            <button type="submit" className="btn btn--secondary btn--sm">
              Apply
            </button>
            {country || since || until ? (
              <Link
                href={buildHref({ action }, {})}
                className="admin-cell-arrow"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-empty">
          <strong>No audit entries</strong>
          {totalCount === 0
            ? "The log starts at 2026-05-05 (R.21 wiring); pre-R.21 reviewer decisions live on the dispute rows themselves."
            : "No audit entries match these filters."}
        </div>
      ) : (
        <ul className="admin-timeline">
          {rows.map((row) => (
            <li key={row.id} className="admin-timeline-item">
              <div className="admin-timeline-meta">
                <span>{formatDateTime(row.createdAt)}</span>
                <span className="admin-timeline-actor">{row.actorId}</span>
                <Chip variant={actionVariant(row.action)}>
                  {AUDIT_ACTION_FILTER_LABELS[row.action] ?? row.action}
                </Chip>
              </div>
              <div className="admin-timeline-headline">
                {row.countryName ?? "—"}
                {row.factKey ? ` · ${row.factKey}` : ""}
                {row.disputeKind ? ` · ${row.disputeKind}` : ""}
              </div>
              {row.before && row.after ? (
                <div className="admin-timeline-notes">
                  {row.before.status} → {row.after.status}
                </div>
              ) : null}
              {row.notes ? (
                <div className="admin-timeline-notes">{row.notes}</div>
              ) : null}
              {row.disputeId ? (
                <div className="admin-timeline-notes">
                  <Link href={`/admin/data-disputes/${row.disputeId}`}>
                    View dispute →
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {totalCount > PAGE_SIZE ? (
        <nav className="admin-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link href={buildHref(baseParams, { page: String(page - 1) })}>
              ← Page {page - 1}
            </Link>
          ) : (
            <span aria-hidden>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < totalCount ? (
            <Link href={buildHref(baseParams, { page: String(page + 1) })}>
              Page {page + 1} →
            </Link>
          ) : (
            <span aria-hidden>—</span>
          )}
        </nav>
      ) : null}
    </>
  );
}
