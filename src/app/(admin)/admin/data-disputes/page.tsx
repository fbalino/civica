/**
 * Phase F.5 — operator data-disputes queue.
 * Extended in R.21:
 *   - severity-desc default sort (normalized `|gap| / threshold`)
 *   - filter chips for source-pair, fact-key, severity bucket, age bucket
 *   - severity badge on each card
 *   - sort selector (severity / newest / oldest)
 *   - link to /admin/data-disputes/audit
 *
 * Mirrors `/admin/pulse-review`:
 *   - Filter chips
 *   - Editorial cards listing each open dispute
 *   - Click into `/admin/data-disputes/[id]` for the resolution form
 *
 * Auth gating happens in `(admin)/layout.tsx`. This page assumes a
 * valid admin session.
 *
 * Methodology:
 *   - Phase F.5: ~/civica/plan/phase-f-methodology-v0.1.md §7
 *   - R.21: ~/civica/plan/disputes-triage-resolution-v1.md §2c
 */
import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Pill } from "@/components/editorial/Pill";
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
  "default" | "accent" | "success" | "warn" | "danger"
> = {
  material_error: "danger",
  plausibility_envelope: "warn",
  group_a_override: "warn",
  group_c_override: "warn",
  rank_demoted: "default",
  public_correction: "accent",
  other: "default",
};

const FACT_GROUPS = ["A", "B", "C"] as const;

const SEVERITY_VARIANT: Record<
  SeverityBucket,
  "default" | "accent" | "success" | "warn" | "danger"
> = {
  lo: "default",
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
  override: Record<string, string | undefined>,
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

function formatFactValue(
  fact: {
    factValue: string | null;
    factValueNumeric: number | null;
    factUnit: string | null;
  } | null,
): string {
  if (!fact) return "—";
  if (fact.factValueNumeric !== null) {
    const formatted = fact.factValueNumeric.toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
    return fact.factUnit ? `${formatted} ${fact.factUnit}` : formatted;
  }
  return fact.factValue ?? "—";
}

function severityBadgeVariant(score: SeverityScore) {
  if (score.bucket == null) return "default" as const;
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
    params.severityBucket && (SEVERITY_BUCKETS as string[]).includes(params.severityBucket)
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

  const [{ rows, totalOpen, totalMatching }, distributions] = await Promise.all([
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
  ]);

  const baseParams = {
    kind,
    group,
    factKey,
    sourcePair,
    severityBucket,
    ageBucket,
    sort: sort === "severity" ? undefined : sort, // omit default
    showResolved: showResolved ? "1" : undefined,
  };

  return (
    <EditorialPage width="wide">
      <h1 className="editorial-page-title">Data disputes</h1>
      <p className="editorial-page-subtitle">
        Open conflicts the resolver flagged for human review — material
        errors between sources, plausibility-envelope rejections, and
        public correction submissions. Resolutions are recorded for audit
        but the resolver continues to compute canonical picks per
        methodology rules; manual pinning of canonical rows is a future
        extension.
      </p>

      <p
        className="editorial-page-meta"
        style={{ marginBottom: 24, gap: 12, flexWrap: "wrap" }}
      >
        <span>{totalOpen} open</span>
        <span>·</span>
        <span>
          Showing {rows.length} of {totalMatching}
          {totalMatching !== totalOpen ? " (filtered)" : ""}
        </span>
        <span>·</span>
        <Link
          href={buildHref(baseParams, {
            showResolved: showResolved ? undefined : "1",
            page: undefined,
          })}
          style={{ color: "var(--color-accent)" }}
        >
          {showResolved ? "Hide resolved" : "Show resolved"}
        </Link>
        <span>·</span>
        <Link
          href="/admin/data-disputes/audit"
          style={{ color: "var(--color-accent)" }}
        >
          Audit log →
        </Link>
      </p>

      <div className="editorial-filter-bar">
        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Sort</span>
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

        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Severity</span>
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

        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Kind</span>
          <FilterChip
            href={buildHref(baseParams, {
              kind: undefined,
              page: undefined,
            })}
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

        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Group</span>
          <FilterChip
            href={buildHref(baseParams, {
              group: undefined,
              page: undefined,
            })}
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
          <div className="editorial-filter-row">
            <span className="editorial-filter-label">Fact-key</span>
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
          <div className="editorial-filter-row">
            <span className="editorial-filter-label">Source pair</span>
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

        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Age</span>
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
              href={buildHref(baseParams, {
                ageBucket: b,
                page: undefined,
              })}
              active={ageBucket === b}
            >
              {b}
            </FilterChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="editorial-empty">
          {totalOpen === 0 && !showResolved
            ? "Queue is clear — nothing flagged for human review."
            : "No disputes match these filters."}
        </p>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {rows.map((dispute) => (
            <Link
              key={dispute.id}
              href={`/admin/data-disputes/${dispute.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article
                className="editorial-card"
                style={{ cursor: "pointer" }}
              >
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
                      {dispute.country.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-11)",
                        color: "var(--color-text-40)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {dispute.factKey}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-11)",
                        color: "var(--color-text-40)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      · {formatDate(dispute.createdAt)}
                    </span>
                  </div>
                  <div className="editorial-card-pills">
                    {dispute.severity.severity != null ? (
                      <Pill variant={severityBadgeVariant(dispute.severity)}>
                        {formatSeverity(dispute.severity)}
                      </Pill>
                    ) : null}
                    <Pill
                      variant={KIND_VARIANT[dispute.disputeKind] ?? "default"}
                    >
                      {KIND_LABELS[dispute.disputeKind] ?? dispute.disputeKind}
                    </Pill>
                    <Pill>{`Group ${dispute.factGroup}`}</Pill>
                    {dispute.status !== "open" ? (
                      <Pill
                        variant={
                          dispute.status === "in_review"
                            ? "accent"
                            : "default"
                        }
                      >
                        {dispute.status.replaceAll("_", " ")}
                      </Pill>
                    ) : null}
                  </div>
                </header>

                <h3
                  className="editorial-card-headline"
                  style={{ marginTop: 8 }}
                >
                  {dispute.description ??
                    `${KIND_LABELS[dispute.disputeKind] ?? "dispute"} on ${dispute.factKey}`}
                </h3>

                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-60)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--color-text-30)",
                        marginBottom: 4,
                      }}
                    >
                      A · {dispute.factA?.sourceId ?? "—"}
                    </div>
                    <div style={{ color: "var(--color-text-primary)" }}>
                      {formatFactValue(dispute.factA)}
                    </div>
                    {dispute.factA?.asOf ? (
                      <div style={{ color: "var(--color-text-40)" }}>
                        as of {dispute.factA.asOf}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--color-text-30)",
                        marginBottom: 4,
                      }}
                    >
                      B · {dispute.factB?.sourceId ?? "—"}
                    </div>
                    <div style={{ color: "var(--color-text-primary)" }}>
                      {formatFactValue(dispute.factB)}
                    </div>
                    {dispute.factB?.asOf ? (
                      <div style={{ color: "var(--color-text-40)" }}>
                        as of {dispute.factB.asOf}
                      </div>
                    ) : null}
                  </div>
                </div>

                <footer
                  className="editorial-card-foot"
                  style={{ marginTop: 12 }}
                >
                  <span>
                    {dispute.submitterName
                      ? `Submitted by ${dispute.submitterName} · `
                      : ""}
                    Open →
                  </span>
                </footer>
              </article>
            </Link>
          ))}
        </div>
      )}

      {totalMatching > limit ? (
        <nav className="editorial-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link href={buildHref(baseParams, { page: String(page - 1) })}>
              ← Page {page - 1}
            </Link>
          ) : (
            <span>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < totalMatching ? (
            <Link href={buildHref(baseParams, { page: String(page + 1) })}>
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
