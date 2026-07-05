/**
 * Operator data-disputes queue.
 *
 * Lists open conflicts the resolver flagged for human review — material errors
 * between sources, plausibility-envelope rejections, and public corrections —
 * in the canonical DataTable. Each row links to `/admin/data-disputes/[id]`
 * for the resolution form. Filters use the canonical editorial chips.
 *
 * Auth gating happens in `(admin)/layout.tsx`; this page assumes a valid admin
 * session.
 *
 * Methodology:
 *   - Phase F.5: ~/civica/plan/phase-f-methodology-v0.1.md §7
 *   - R.21: ~/civica/plan/disputes-triage-resolution-v1.md §2c
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Chip } from "@/components/editorial/Pill";
import { DataTable } from "@/components/editorial/DataTable";
import {
  getDataDisputeQueue,
  getDisputeFilterDistributions,
  type DisputeSortKey,
  type AgeBucket,
} from "@/lib/db/queries-data-disputes";
import {
  SEVERITY_BUCKETS,
  SEVERITY_BUCKET_LABELS,
  formatSeverity,
  type SeverityBucket,
  type SeverityScore,
} from "@/lib/factbook/reconcile/dispute-severity";

export const metadata: Metadata = {
  title: "Data disputes queue — Civica admin",
  robots: { index: false, follow: false },
};

const KIND_LABELS: Record<string, string> = {
  material_error: "Material error",
  plausibility_envelope: "Envelope reject",
  group_a_override: "Group A override",
  group_c_override: "Group C override",
  rank_demoted: "Rank demoted",
  public_correction: "Public correction",
  other: "Other",
};

const KIND_VARIANT: Record<
  string,
  "neutral" | "accent" | "success" | "warn" | "danger"
> = {
  material_error: "danger",
  plausibility_envelope: "warn",
  group_a_override: "warn",
  group_c_override: "warn",
  rank_demoted: "neutral",
  public_correction: "accent",
  other: "neutral",
};

const FACT_GROUPS = ["A", "B", "C"] as const;

const SEVERITY_VARIANT: Record<
  SeverityBucket,
  "neutral" | "accent" | "success" | "warn" | "danger"
> = {
  lo: "neutral",
  mid: "warn",
  hi: "danger",
  xhi: "danger",
};

const AGE_BUCKETS: AgeBucket[] = ["0-7d", "7-30d", "30-90d", "90d+"];

const SORT_LABELS: Record<DisputeSortKey, string> = {
  severity: "Severity",
  age: "Newest",
  oldest: "Oldest",
};

interface PageProps {
  searchParams: Promise<{
    kind?: string;
    group?: string;
    factKey?: string;
    sourcePair?: string;
    severityBucket?: string;
    ageBucket?: string;
    sort?: string;
    page?: string;
    showResolved?: string;
  }>;
}

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
  return qs ? `?${qs}` : "/admin/data-disputes";
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

function formatDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function severityBadgeVariant(score: SeverityScore) {
  if (score.bucket == null) return "neutral" as const;
  return SEVERITY_VARIANT[score.bucket];
}

export default async function DataDisputesQueuePage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const kind =
    params.kind && KIND_LABELS[params.kind] ? params.kind : undefined;
  const group =
    params.group && (FACT_GROUPS as readonly string[]).includes(params.group)
      ? params.group
      : undefined;
  const factKey = params.factKey ? params.factKey : undefined;
  const sourcePair = params.sourcePair ? params.sourcePair : undefined;
  const severityBucket =
    params.severityBucket &&
    (SEVERITY_BUCKETS as string[]).includes(params.severityBucket)
      ? (params.severityBucket as SeverityBucket)
      : undefined;
  const ageBucket =
    params.ageBucket && (AGE_BUCKETS as string[]).includes(params.ageBucket)
      ? (params.ageBucket as AgeBucket)
      : undefined;
  const sort: DisputeSortKey =
    params.sort === "age" || params.sort === "oldest"
      ? params.sort
      : "severity";
  const showResolved = params.showResolved === "1";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const [{ rows, totalOpen, totalMatching }, distributions] = await Promise.all(
    [
      getDataDisputeQueue({
        disputeKind: kind,
        factGroup: group,
        factKey,
        sourcePair,
        severityBucket,
        ageBucket,
        includeResolved: showResolved,
        sort,
        limit,
        offset,
      }),
      getDisputeFilterDistributions({
        includeResolved: showResolved,
        topN: 8,
      }),
    ]
  );

  const baseParams = {
    kind,
    group,
    factKey,
    sourcePair,
    severityBucket,
    ageBucket,
    sort: sort === "severity" ? undefined : sort,
    showResolved: showResolved ? "1" : undefined,
  };

  return (
    <>
      <header className="admin-page-head">
        <h1 className="admin-title">Data disputes</h1>
        <p className="admin-subtitle">
          Open conflicts the resolver flagged for human review — material errors
          between sources, plausibility-envelope rejections, and public
          corrections. Resolutions are recorded for audit while the resolver
          keeps computing canonical picks per methodology.
        </p>
        <p className="admin-meta">
          <span className="admin-meta-num">{totalOpen}</span>
          <span>open</span>
          <span className="admin-meta-sep">·</span>
          <span>
            Showing <span className="admin-meta-num">{rows.length}</span> of{" "}
            <span className="admin-meta-num">{totalMatching}</span>
            {totalMatching !== totalOpen ? " (filtered)" : ""}
          </span>
          <span className="admin-meta-sep">·</span>
          <Link
            href={buildHref(baseParams, {
              showResolved: showResolved ? undefined : "1",
              page: undefined,
            })}
          >
            {showResolved ? "Hide resolved" : "Show resolved"}
          </Link>
          <span className="admin-meta-sep">·</span>
          <Link href="/admin/data-disputes/audit">Audit log →</Link>
        </p>
      </header>

      <div className="admin-filters">
        <div className="admin-filter-row">
          <span className="admin-filter-label">Sort</span>
          {(["severity", "age", "oldest"] as DisputeSortKey[]).map((s) => (
            <FilterChip
              key={s}
              href={buildHref(baseParams, {
                sort: s === "severity" ? undefined : s,
                page: undefined,
              })}
              active={sort === s}
            >
              {SORT_LABELS[s]}
            </FilterChip>
          ))}
        </div>

        <div className="admin-filter-row">
          <span className="admin-filter-label">Severity</span>
          <FilterChip
            href={buildHref(baseParams, {
              severityBucket: undefined,
              page: undefined,
            })}
            active={!severityBucket}
          >
            Any
          </FilterChip>
          {SEVERITY_BUCKETS.map((b) => (
            <FilterChip
              key={b}
              href={buildHref(baseParams, {
                severityBucket: b,
                page: undefined,
              })}
              active={severityBucket === b}
            >
              {SEVERITY_BUCKET_LABELS[b]}
            </FilterChip>
          ))}
        </div>

        <div className="admin-filter-row">
          <span className="admin-filter-label">Kind</span>
          <FilterChip
            href={buildHref(baseParams, { kind: undefined, page: undefined })}
            active={!kind}
          >
            All
          </FilterChip>
          {Object.entries(KIND_LABELS).map(([key, label]) => (
            <FilterChip
              key={key}
              href={buildHref(baseParams, { kind: key, page: undefined })}
              active={kind === key}
            >
              {label}
            </FilterChip>
          ))}
        </div>

        <div className="admin-filter-row">
          <span className="admin-filter-label">Group</span>
          <FilterChip
            href={buildHref(baseParams, { group: undefined, page: undefined })}
            active={!group}
          >
            Any
          </FilterChip>
          {FACT_GROUPS.map((g) => (
            <FilterChip
              key={g}
              href={buildHref(baseParams, { group: g, page: undefined })}
              active={group === g}
            >
              {g}
            </FilterChip>
          ))}
        </div>

        {distributions.factKeys.length > 0 ? (
          <div className="admin-filter-row">
            <span className="admin-filter-label">Fact-key</span>
            <FilterChip
              href={buildHref(baseParams, {
                factKey: undefined,
                page: undefined,
              })}
              active={!factKey}
            >
              Any
            </FilterChip>
            {distributions.factKeys.map((fk) => (
              <FilterChip
                key={fk.value}
                href={buildHref(baseParams, {
                  factKey: fk.value,
                  page: undefined,
                })}
                active={factKey === fk.value}
              >
                {fk.value} ({fk.count})
              </FilterChip>
            ))}
          </div>
        ) : null}

        {distributions.sourcePairs.length > 0 ? (
          <div className="admin-filter-row">
            <span className="admin-filter-label">Source pair</span>
            <FilterChip
              href={buildHref(baseParams, {
                sourcePair: undefined,
                page: undefined,
              })}
              active={!sourcePair}
            >
              Any
            </FilterChip>
            {distributions.sourcePairs.map((sp) => (
              <FilterChip
                key={sp.value}
                href={buildHref(baseParams, {
                  sourcePair: sp.value,
                  page: undefined,
                })}
                active={sourcePair === sp.value}
              >
                {sp.label} ({sp.count})
              </FilterChip>
            ))}
          </div>
        ) : null}

        <div className="admin-filter-row">
          <span className="admin-filter-label">Age</span>
          <FilterChip
            href={buildHref(baseParams, {
              ageBucket: undefined,
              page: undefined,
            })}
            active={!ageBucket}
          >
            Any
          </FilterChip>
          {AGE_BUCKETS.map((b) => (
            <FilterChip
              key={b}
              href={buildHref(baseParams, { ageBucket: b, page: undefined })}
              active={ageBucket === b}
            >
              {b}
            </FilterChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-empty">
          <strong>Queue is clear</strong>
          {totalOpen === 0 && !showResolved
            ? "Nothing is flagged for human review."
            : "No disputes match these filters."}
        </div>
      ) : (
        <div className="admin-table-scroll">
          <DataTable className="admin-table">
            <thead>
              <tr>
                <th>Country / fact</th>
                <th>Kind</th>
                <th>Severity</th>
                <th>Status</th>
                <th className="num">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((dispute) => (
                <tr key={dispute.id}>
                  <td>
                    <Link
                      href={`/admin/data-disputes/${dispute.id}`}
                      className="admin-row-link"
                    >
                      <span className="admin-row-primary">
                        {dispute.country.name} · {dispute.factKey}
                      </span>
                      <span className="admin-row-secondary">
                        {dispute.description ??
                          `${
                            KIND_LABELS[dispute.disputeKind] ?? "Dispute"
                          } · Group ${dispute.factGroup}`}
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className="admin-cell-chips">
                      <Chip
                        variant={KIND_VARIANT[dispute.disputeKind] ?? "neutral"}
                      >
                        {KIND_LABELS[dispute.disputeKind] ??
                          dispute.disputeKind}
                      </Chip>
                      <Chip>{`Group ${dispute.factGroup}`}</Chip>
                    </span>
                  </td>
                  <td>
                    {dispute.severity.severity != null ? (
                      <Chip variant={severityBadgeVariant(dispute.severity)}>
                        {formatSeverity(dispute.severity)}
                      </Chip>
                    ) : (
                      <span className="admin-cell-arrow">—</span>
                    )}
                  </td>
                  <td>
                    {dispute.status === "open" ? (
                      <Chip variant="warn">Open</Chip>
                    ) : dispute.status === "in_review" ? (
                      <Chip variant="accent">In review</Chip>
                    ) : (
                      <Chip>{dispute.status.replaceAll("_", " ")}</Chip>
                    )}
                  </td>
                  <td className="num admin-cell-date">
                    {formatDate(dispute.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      {totalMatching > limit ? (
        <nav className="admin-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link href={buildHref(baseParams, { page: String(page - 1) })}>
              ← Page {page - 1}
            </Link>
          ) : (
            <span aria-hidden>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < totalMatching ? (
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
