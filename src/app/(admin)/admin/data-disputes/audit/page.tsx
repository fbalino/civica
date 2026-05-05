/**
 * Phase R.21 — `/admin/data-disputes/audit`.
 *
 * Read-only timeline of every state change across all disputes. Sourced
 * from `data_facts_audit_log`, joined to the dispute + jurisdiction.
 *
 * Filters:
 *   - action chip (reviewer_decision / auto_resolve_stale / reopen / ...)
 *   - country slug (free text input → exact match)
 *   - date range (since / until — ISO YYYY-MM-DD)
 *
 * No bulk-action; this is a read surface.
 *
 * Methodology: ~/civica/plan/disputes-triage-resolution-v1.md §2b
 */
import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Pill } from "@/components/editorial/Pill";
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
  override: Record<string, string | undefined>,
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

  const baseParams = {
    action,
    country,
    since,
    until,
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <EditorialPage width="wide">
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/admin/data-disputes"
          className="editorial-page-meta"
          style={{ color: "var(--color-text-40)" }}
        >
          ← Back to queue
        </Link>
      </div>

      <h1 className="editorial-page-title">Disputes audit log</h1>
      <p className="editorial-page-subtitle">
        Append-only timeline of every state change on{" "}
        <code>data_disputes</code>. Sourced from{" "}
        <code>data_facts_audit_log</code>. Each row preserves the pre-
        and post-update snapshot, the actor, and any reviewer notes.
      </p>

      <p
        className="editorial-page-meta"
        style={{ marginBottom: 24, gap: 12, flexWrap: "wrap" }}
      >
        <span>{totalCount} total entries</span>
        <span>·</span>
        <span>Showing {rows.length}</span>
        <span>·</span>
        <span>
          Page {page} of {totalPages}
        </span>
      </p>

      <div className="editorial-filter-bar">
        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Action</span>
          <FilterChip
            href={buildHref(baseParams, {
              action: undefined,
              page: undefined,
            })}
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

        <div className="editorial-filter-row">
          <form
            method="GET"
            action="/admin/data-disputes/audit"
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {action ? (
              <input type="hidden" name="action" value={action} />
            ) : null}
            <input
              type="text"
              name="country"
              placeholder="country slug (e.g. argentina)"
              defaultValue={country ?? ""}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-12)",
                padding: "6px 10px",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg)",
                color: "var(--color-text-primary)",
                minWidth: 200,
              }}
            />
            <input
              type="date"
              name="since"
              defaultValue={since ?? ""}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-12)",
                padding: "6px 10px",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg)",
                color: "var(--color-text-primary)",
              }}
              aria-label="Since"
            />
            <input
              type="date"
              name="until"
              defaultValue={until ?? ""}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-12)",
                padding: "6px 10px",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg)",
                color: "var(--color-text-primary)",
              }}
              aria-label="Until"
            />
            <button
              type="submit"
              className="editorial-button"
              style={{
                background: "var(--color-card-bg)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-card-border)",
              }}
            >
              Apply
            </button>
            {(country || since || until) ? (
              <Link
                href={buildHref({ action }, {})}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-40)",
                }}
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="editorial-empty">
          {totalCount === 0
            ? "Audit log is empty. The log starts at 2026-05-05 (R.21 wiring); pre-R.21 reviewer decisions live on the dispute rows themselves."
            : "No audit entries match these filters."}
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {rows.map((row) => (
            <li
              key={row.id}
              className="editorial-card"
              style={{ padding: "12px 16px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-40)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {formatDateTime(row.createdAt)} · {row.actorId}
                </div>
                <Pill
                  variant={
                    row.action === "auto_resolve_stale"
                      ? "default"
                      : row.action === "reopen"
                        ? "warn"
                        : "accent"
                  }
                >
                  {AUDIT_ACTION_FILTER_LABELS[row.action] ?? row.action}
                </Pill>
              </div>

              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-15)",
                  color: "var(--color-text-primary)",
                  marginTop: 6,
                }}
              >
                {row.countryName ?? "—"}
                {row.factKey ? ` · ${row.factKey}` : ""}
                {row.disputeKind ? ` · ${row.disputeKind}` : ""}
              </div>

              {row.before && row.after ? (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-60)",
                    marginTop: 4,
                  }}
                >
                  {row.before.status} → {row.after.status}
                </div>
              ) : null}

              {row.notes ? (
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-13)",
                    color: "var(--color-text-60)",
                    marginTop: 6,
                  }}
                >
                  {row.notes}
                </div>
              ) : null}

              {row.disputeId ? (
                <div style={{ marginTop: 8 }}>
                  <Link
                    href={`/admin/data-disputes/${row.disputeId}`}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-12)",
                      color: "var(--color-accent)",
                    }}
                  >
                    View dispute →
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {totalCount > PAGE_SIZE ? (
        <nav className="editorial-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={buildHref(baseParams, { page: String(page - 1) })}
            >
              ← Page {page - 1}
            </Link>
          ) : (
            <span>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < totalCount ? (
            <Link
              href={buildHref(baseParams, { page: String(page + 1) })}
            >
              Page {page + 1} →
            </Link>
          ) : (
            <span>—</span>
          )}
        </nav>
      ) : null}
    </EditorialPage>
  );
}
