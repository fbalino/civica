/**
 * Phase R.23.1 — public read-only data disputes log.
 *
 * Mirrors the admin queue at `/admin/data-disputes` but with reviewer
 * identity redacted and submitter PII stripped. Reads via the public-
 * safe query helpers in `queries-data-disputes.ts`. Linked from the
 * methodology page rewrite (R.23) and discoverable from the methodology
 * hub at `/methodology`.
 *
 * Methodology decisions (see R.23.1 brief):
 *   - Q1 (visibility): show outcome labels + system-action labels +
 *     methodology-rationale notes; redact reviewer identity. Submitter
 *     name shown only when `is_public = true`.
 *   - Q2 (UX): mirrors the admin queue — severity-desc default sort,
 *     URL-param-driven filter chips for status / severity / source-pair
 *     / fact-key / age, pagination at 50/page.
 *   - Q3 (empty state): contextual copy explaining the filter mismatch.
 *   - Q4 (surfacing): linked from R.23 methodology page; breadcrumb
 *     back to /factbook/methodology/reconciliation.
 *
 * Single-route surface — no `[id]` detail page; per-dispute audit
 * history is rendered inline via a <details> accordion to keep the
 * page bounded.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { Pill } from "@/components/editorial/Pill";
import {
  getPublicDisputeFeed,
  getPublicDisputeFilterDistributions,
  getPublicAuditLogForDispute,
  PUBLIC_DISPUTE_STATUS_BUCKETS,
  PUBLIC_DISPUTE_STATUS_LABELS,
  type PublicDisputeStatusBucket,
  type PublicDisputeRow,
  type AgeBucket,
  type DisputeSortKey,
} from "@/lib/db/queries-data-disputes";
import {
  SEVERITY_BUCKETS,
  SEVERITY_BUCKET_LABELS,
  formatSeverity,
  type SeverityBucket,
  type SeverityScore,
} from "@/lib/factbook/reconcile/dispute-severity";
import { reconciliation } from "@/lib/content/site-state";

export const metadata: Metadata = {
  title:
    "Data disputes log (Beta) — Civica Atlas reconciliation methodology",
  description:
    "Public read-only log of conflicts the resolver flagged across CIA Factbook, Wikidata, and named statistical agencies. Open, resolved, and auto-resolved disputes with severity, source attribution, and methodology notes.",
  alternates: {
    canonical:
      "https://civicaatlas.org/factbook/methodology/reconciliation/disputes",
  },
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

const SEVERITY_VARIANT: Record<
  SeverityBucket,
  "default" | "accent" | "success" | "warn" | "danger"
> = {
  lo: "default",
  mid: "warn",
  hi: "danger",
  xhi: "danger",
};

const STATUS_BUCKET_VARIANT: Record<
  PublicDisputeStatusBucket,
  "default" | "accent" | "success" | "warn" | "danger"
> = {
  open: "warn",
  resolved: "success",
  auto_resolved: "default",
};

const AGE_BUCKETS: AgeBucket[] = ["0-7d", "7-30d", "30-90d", "90d+"];

const FACT_GROUPS = ["A", "B", "C"] as const;

const SORT_LABELS: Record<DisputeSortKey, string> = {
  severity: "Severity",
  age: "Newest",
  oldest: "Oldest",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    kind?: string;
    group?: string;
    factKey?: string;
    sourcePair?: string;
    severityBucket?: string;
    ageBucket?: string;
    sort?: string;
    page?: string;
    expand?: string;
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
  return qs ? `?${qs}` : "/factbook/methodology/reconciliation/disputes";
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

async function DisputeCard({
  dispute,
  expanded,
  baseParams,
}: {
  dispute: PublicDisputeRow;
  expanded: boolean;
  baseParams: Record<string, string | undefined>;
}) {
  const auditTrail = expanded
    ? await getPublicAuditLogForDispute(dispute.id)
    : [];
  const collapseHref = buildHref(baseParams, { expand: undefined });
  const expandHref = buildHref(baseParams, { expand: dispute.id });

  return (
    <article
      className="editorial-card"
      id={`dispute-${dispute.id}`}
      style={{ scrollMarginTop: "var(--space-7)" }}
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
            · created {formatDate(dispute.createdAt)}
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
          <Pill variant={STATUS_BUCKET_VARIANT[dispute.statusBucket]}>
            {PUBLIC_DISPUTE_STATUS_LABELS[dispute.statusBucket]}
          </Pill>
          {dispute.systemAction === "auto_resolve_stale" ? (
            <Pill>auto_resolve_stale</Pill>
          ) : null}
        </div>
      </header>

      <h3
        className="editorial-card-headline"
        style={{ marginTop: "var(--space-3)" }}
      >
        {dispute.description ??
          `${KIND_LABELS[dispute.disputeKind] ?? "Dispute"} on ${dispute.factKey}.`}
      </h3>

      <div
        style={{
          marginTop: "var(--space-3)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-5)",
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
              marginBottom: "var(--space-2)",
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
              marginBottom: "var(--space-2)",
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

      {dispute.statusBucket !== "open" ? (
        <div
          style={{
            marginTop: "var(--space-4)",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--color-card-border)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-13)",
            color: "var(--color-text-60)",
            display: "flex",
            gap: "var(--space-3)",
            flexWrap: "wrap",
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-40)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Outcome
          </span>
          <span style={{ color: "var(--color-text-primary)" }}>
            {dispute.resolutionLabel ?? "—"}
          </span>
          {dispute.resolvedAt ? (
            <span style={{ color: "var(--color-text-40)" }}>
              · {formatDate(dispute.resolvedAt)}
            </span>
          ) : null}
        </div>
      ) : null}

      {dispute.reviewerNotes ? (
        <div
          style={{
            marginTop: "var(--space-3)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-13)",
            color: "var(--color-text-60)",
            lineHeight: 1.55,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-40)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginRight: "var(--space-3)",
            }}
          >
            Notes
          </span>
          {dispute.reviewerNotes}
        </div>
      ) : null}

      <footer
        className="editorial-card-foot"
        style={{ marginTop: "var(--space-4)" }}
      >
        <div className="editorial-card-foot-row">
          {dispute.submitterName ? (
            <span>Submitted by {dispute.submitterName}</span>
          ) : null}
        </div>
        <div className="editorial-card-foot-row">
          {expanded ? (
            <Link
              href={`${collapseHref}#dispute-${dispute.id}`}
              style={{ color: "var(--color-accent)" }}
            >
              Hide audit history ↑
            </Link>
          ) : (
            <Link
              href={`${expandHref}#dispute-${dispute.id}`}
              style={{ color: "var(--color-accent)" }}
            >
              Show audit history →
            </Link>
          )}
        </div>
      </footer>

      {expanded ? (
        <div
          style={{
            marginTop: "var(--space-4)",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--color-card-border)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-40)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "var(--space-3)",
            }}
          >
            Audit history
          </div>
          {auditTrail.length === 0 ? (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-13)",
                color: "var(--color-text-60)",
                margin: 0,
              }}
            >
              No audit entries on this dispute. The audit log starts at
              2026-05-05; pre-R.21 reviewer decisions are recoverable from
              the resolution metadata above.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              {auditTrail.map((row) => (
                <li
                  key={row.id}
                  style={{
                    borderLeft: "2px solid var(--color-card-border)",
                    paddingLeft: "var(--space-3)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-11)",
                      color: "var(--color-text-40)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {formatDateTime(row.createdAt)} · {row.actorLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-13)",
                      color: "var(--color-text-primary)",
                      marginTop: "var(--space-1, 4px)",
                    }}
                  >
                    <strong>{row.action}</strong>
                    {row.beforeStatus && row.afterStatus
                      ? `: ${row.beforeStatus} → ${row.afterStatus}`
                      : ""}
                  </div>
                  {row.notes ? (
                    <div
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--text-13)",
                        color: "var(--color-text-60)",
                        marginTop: "var(--space-1, 4px)",
                      }}
                    >
                      {row.notes}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </article>
  );
}

export default async function PublicDisputesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const statusBucket =
    params.status &&
    (PUBLIC_DISPUTE_STATUS_BUCKETS as string[]).includes(params.status)
      ? (params.status as PublicDisputeStatusBucket)
      : undefined;
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
  const expandedId = params.expand ?? null;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const [{ rows, totalMatching, totalAll }, distributions] = await Promise.all([
    getPublicDisputeFeed({
      statusBucket,
      disputeKind: kind,
      factGroup: group,
      factKey,
      sourcePair,
      severityBucket,
      ageBucket,
      sort,
      limit,
      offset,
    }),
    getPublicDisputeFilterDistributions({ topN: 8 }),
  ]);

  const baseParams = {
    status: statusBucket,
    kind,
    group,
    factKey,
    sourcePair,
    severityBucket,
    ageBucket,
    sort: sort === "severity" ? undefined : sort,
    page: page > 1 ? String(page) : undefined,
    expand: expandedId ?? undefined,
  };

  // Filter base — used to construct chip hrefs (drops `expand` and `page`
  // so toggling a filter doesn't carry over the open accordion or stale
  // pagination position).
  const chipBase = {
    ...baseParams,
    expand: undefined,
    page: undefined,
  };

  const totalPages = Math.max(1, Math.ceil(totalMatching / limit));

  return (
    <EditorialPage width="wide">
      <SmartBreadcrumbs />

      <h1 className="editorial-page-title">
        Data disputes
        {reconciliation.status === "beta" ? (
          <span className="editorial-beta-tag">Beta</span>
        ) : null}
      </h1>
      <p className="editorial-page-subtitle">
        Public read-only log of conflicts the resolver flagged across the
        Civica source allowlist. Open disputes await human review;
        resolved disputes carry an outcome and methodology rationale;
        auto-resolved disputes were closed by the staleness cron after
        the resolver stopped emitting them. Reviewer identity is
        redacted on this surface.
      </p>

      <div className="editorial-warning">
        These disputes are part of the reconciliation methodology under
        active revision. The resolver, source allowlist, and
        material-error thresholds may change before v1.0. See the{" "}
        <Link href="/factbook/methodology/reconciliation">
          full reconciliation methodology
        </Link>{" "}
        for context.
      </div>

      <p
        className="editorial-page-meta"
        style={{
          marginBottom: "var(--space-6)",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <span>{totalAll} total disputes on record</span>
        <span>·</span>
        <span>
          Showing {rows.length} of {totalMatching}
          {totalMatching !== totalAll ? " (filtered)" : ""}
        </span>
        <span>·</span>
        <span>
          Page {page} of {totalPages}
        </span>
      </p>

      <div className="editorial-filter-bar">
        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Sort</span>
          {(["severity", "age", "oldest"] as DisputeSortKey[]).map((s) => (
            <FilterChip
              key={s}
              href={buildHref(chipBase, {
                sort: s === "severity" ? undefined : s,
              })}
              active={sort === s}
            >
              {SORT_LABELS[s]}
            </FilterChip>
          ))}
        </div>

        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Status</span>
          <FilterChip
            href={buildHref(chipBase, { status: undefined })}
            active={!statusBucket}
          >
            All
          </FilterChip>
          {PUBLIC_DISPUTE_STATUS_BUCKETS.map((s) => (
            <FilterChip
              key={s}
              href={buildHref(chipBase, { status: s })}
              active={statusBucket === s}
            >
              {PUBLIC_DISPUTE_STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </div>

        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Severity</span>
          <FilterChip
            href={buildHref(chipBase, { severityBucket: undefined })}
            active={!severityBucket}
          >
            Any
          </FilterChip>
          {SEVERITY_BUCKETS.map((b) => (
            <FilterChip
              key={b}
              href={buildHref(chipBase, { severityBucket: b })}
              active={severityBucket === b}
            >
              {SEVERITY_BUCKET_LABELS[b]}
            </FilterChip>
          ))}
        </div>

        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Kind</span>
          <FilterChip
            href={buildHref(chipBase, { kind: undefined })}
            active={!kind}
          >
            All
          </FilterChip>
          {Object.entries(KIND_LABELS).map(([key, label]) => (
            <FilterChip
              key={key}
              href={buildHref(chipBase, { kind: key })}
              active={kind === key}
            >
              {label}
            </FilterChip>
          ))}
        </div>

        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Group</span>
          <FilterChip
            href={buildHref(chipBase, { group: undefined })}
            active={!group}
          >
            Any
          </FilterChip>
          {FACT_GROUPS.map((g) => (
            <FilterChip
              key={g}
              href={buildHref(chipBase, { group: g })}
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
              href={buildHref(chipBase, { factKey: undefined })}
              active={!factKey}
            >
              Any
            </FilterChip>
            {distributions.factKeys.map((fk) => (
              <FilterChip
                key={fk.value}
                href={buildHref(chipBase, { factKey: fk.value })}
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
              href={buildHref(chipBase, { sourcePair: undefined })}
              active={!sourcePair}
            >
              Any
            </FilterChip>
            {distributions.sourcePairs.map((sp) => (
              <FilterChip
                key={sp.value}
                href={buildHref(chipBase, { sourcePair: sp.value })}
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
            href={buildHref(chipBase, { ageBucket: undefined })}
            active={!ageBucket}
          >
            Any
          </FilterChip>
          {AGE_BUCKETS.map((b) => (
            <FilterChip
              key={b}
              href={buildHref(chipBase, { ageBucket: b })}
              active={ageBucket === b}
            >
              {b}
            </FilterChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="editorial-empty">
          {totalAll === 0
            ? "No disputes recorded yet. The resolver runs after each fact-sync; new disputes will appear here as upstream sources disagree."
            : "No disputes match the current filters. Try widening the filters above."}
        </p>
      ) : (
        <div style={{ marginBottom: "var(--space-6)" }}>
          {rows.map((dispute) => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              expanded={expandedId === dispute.id}
              baseParams={baseParams}
            />
          ))}
        </div>
      )}

      {totalMatching > limit ? (
        <nav className="editorial-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={buildHref(
                { ...baseParams, expand: undefined },
                { page: page - 1 > 1 ? String(page - 1) : undefined },
              )}
            >
              ← Page {page - 1}
            </Link>
          ) : (
            <span>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < totalMatching ? (
            <Link
              href={buildHref(
                { ...baseParams, expand: undefined },
                { page: String(page + 1) },
              )}
            >
              Page {page + 1} →
            </Link>
          ) : (
            <span>—</span>
          )}
        </nav>
      ) : null}

      <footer
        className="editorial-footer-nav"
        style={{ marginTop: "var(--space-7)" }}
      >
        <Link href="/factbook/methodology/reconciliation">
          ← Back to reconciliation methodology
        </Link>
        <Link href="/methodology">Methodology hub →</Link>
      </footer>
    </EditorialPage>
  );
}
