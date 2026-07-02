"use client";

import { useMemo, useState, useTransition } from "react";
import { Pill } from "@/components/editorial/Pill";
import {
  PUBLIC_DISPUTE_STATUS_BUCKETS,
  PUBLIC_DISPUTE_STATUS_LABELS,
  type PublicDisputeStatusBucket,
  type PublicDisputeRow,
  type PublicAuditLogRow,
  type AgeBucket,
  type DisputeSortKey,
  type DisputeFilterDistributions,
} from "@/lib/db/queries-data-disputes";
import {
  SEVERITY_BUCKETS,
  SEVERITY_BUCKET_LABELS,
  formatSeverity,
  type SeverityBucket,
  type SeverityScore,
} from "@/lib/factbook/reconcile/dispute-severity";
import { loadAuditLog } from "./actions";

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

const PAGE_SIZE = 50;

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active ? "editorial-chip editorial-chip--active" : "editorial-chip"
      }
    >
      {children}
    </button>
  );
}

/**
 * A filter row rendered as a semantic <fieldset>/<legend> group (mirrors the
 * canonical AlmanacFilters pattern) so screen readers announce the group name
 * before its chips. Chips carry aria-pressed via <FilterChip>.
 */
function FilterFieldset({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="editorial-filter-row">
      <legend className="editorial-filter-label">{legend}</legend>
      <div
        className="editorial-filter-group"
        role="group"
        aria-label={`Filter by ${legend.toLowerCase()}`}
      >
        {children}
      </div>
    </fieldset>
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

function ageBucketOf(createdAtIso: string): AgeBucket {
  const ageDays =
    (Date.now() - new Date(createdAtIso).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return "0-7d";
  if (ageDays <= 30) return "7-30d";
  if (ageDays <= 90) return "30-90d";
  return "90d+";
}

interface Props {
  disputes: PublicDisputeRow[];
  distributions: DisputeFilterDistributions;
  totalAll: number;
}

export function DisputesFilterClient({
  disputes,
  distributions,
  totalAll,
}: Props) {
  const [statusBucket, setStatusBucket] = useState<
    PublicDisputeStatusBucket | undefined
  >();
  const [kind, setKind] = useState<string | undefined>();
  const [group, setGroup] = useState<string | undefined>();
  const [factKey, setFactKey] = useState<string | undefined>();
  const [sourcePair, setSourcePair] = useState<string | undefined>();
  const [severityBucket, setSeverityBucket] = useState<
    SeverityBucket | undefined
  >();
  const [ageBucket, setAgeBucket] = useState<AgeBucket | undefined>();
  const [sort, setSort] = useState<DisputeSortKey>("severity");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditCache, setAuditCache] = useState<
    Record<string, PublicAuditLogRow[] | "loading">
  >({});
  const [, startTransition] = useTransition();

  const resetPage = () => setPage(1);

  const filtered = useMemo(() => {
    const matched = disputes.filter((d) => {
      if (statusBucket && d.statusBucket !== statusBucket) return false;
      if (kind && d.disputeKind !== kind) return false;
      if (group && d.factGroup !== group) return false;
      if (factKey && d.factKey !== factKey) return false;
      if (sourcePair) {
        const [pa, pb] = sourcePair.split("|");
        if (pa && d.factA?.sourceId !== pa) return false;
        if (pb && d.factB?.sourceId !== pb) return false;
      }
      if (severityBucket && d.severity.bucket !== severityBucket) return false;
      if (ageBucket && ageBucketOf(d.createdAt) !== ageBucket) return false;
      return true;
    });

    matched.sort((a, b) => {
      if (sort === "severity") {
        const av = a.severity.severity ?? -Infinity;
        const bv = b.severity.severity ?? -Infinity;
        if (bv !== av) return bv - av;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sort === "age") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return matched;
  }, [
    disputes,
    statusBucket,
    kind,
    group,
    factKey,
    sourcePair,
    severityBucket,
    ageBucket,
    sort,
  ]);

  const totalMatching = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(offset, offset + PAGE_SIZE);

  const handleExpand = (disputeId: string) => {
    if (expandedId === disputeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(disputeId);
    if (!auditCache[disputeId]) {
      setAuditCache((prev) => ({ ...prev, [disputeId]: "loading" }));
      startTransition(async () => {
        const rows = await loadAuditLog(disputeId);
        setAuditCache((prev) => ({ ...prev, [disputeId]: rows }));
      });
    }
  };

  return (
    <>
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
          Showing {slice.length} of {totalMatching}
          {totalMatching !== totalAll ? " (filtered)" : ""}
        </span>
        <span>·</span>
        <span>
          Page {safePage} of {totalPages}
        </span>
      </p>

      <div className="editorial-filter-bar">
        <FilterFieldset legend="Sort">
          {(["severity", "age", "oldest"] as DisputeSortKey[]).map((s) => (
            <FilterChip
              key={s}
              onClick={() => {
                setSort(s);
                resetPage();
              }}
              active={sort === s}
            >
              {SORT_LABELS[s]}
            </FilterChip>
          ))}
        </FilterFieldset>

        <FilterFieldset legend="Status">
          <FilterChip
            onClick={() => {
              setStatusBucket(undefined);
              resetPage();
            }}
            active={!statusBucket}
          >
            All
          </FilterChip>
          {PUBLIC_DISPUTE_STATUS_BUCKETS.map((s) => (
            <FilterChip
              key={s}
              onClick={() => {
                setStatusBucket(s);
                resetPage();
              }}
              active={statusBucket === s}
            >
              {PUBLIC_DISPUTE_STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </FilterFieldset>

        <FilterFieldset legend="Severity">
          <FilterChip
            onClick={() => {
              setSeverityBucket(undefined);
              resetPage();
            }}
            active={!severityBucket}
          >
            Any
          </FilterChip>
          {SEVERITY_BUCKETS.map((b) => (
            <FilterChip
              key={b}
              onClick={() => {
                setSeverityBucket(b);
                resetPage();
              }}
              active={severityBucket === b}
            >
              {SEVERITY_BUCKET_LABELS[b]}
            </FilterChip>
          ))}
        </FilterFieldset>

        <FilterFieldset legend="Kind">
          <FilterChip
            onClick={() => {
              setKind(undefined);
              resetPage();
            }}
            active={!kind}
          >
            All
          </FilterChip>
          {Object.entries(KIND_LABELS).map(([key, label]) => (
            <FilterChip
              key={key}
              onClick={() => {
                setKind(key);
                resetPage();
              }}
              active={kind === key}
            >
              {label}
            </FilterChip>
          ))}
        </FilterFieldset>

        <FilterFieldset legend="Group">
          <FilterChip
            onClick={() => {
              setGroup(undefined);
              resetPage();
            }}
            active={!group}
          >
            Any
          </FilterChip>
          {FACT_GROUPS.map((g) => (
            <FilterChip
              key={g}
              onClick={() => {
                setGroup(g);
                resetPage();
              }}
              active={group === g}
            >
              {g}
            </FilterChip>
          ))}
        </FilterFieldset>

        {distributions.factKeys.length > 0 ? (
          <FilterFieldset legend="Fact-key">
            <FilterChip
              onClick={() => {
                setFactKey(undefined);
                resetPage();
              }}
              active={!factKey}
            >
              Any
            </FilterChip>
            {distributions.factKeys.map((fk) => (
              <FilterChip
                key={fk.value}
                onClick={() => {
                  setFactKey(fk.value);
                  resetPage();
                }}
                active={factKey === fk.value}
              >
                {fk.value} ({fk.count})
              </FilterChip>
            ))}
          </FilterFieldset>
        ) : null}

        {distributions.sourcePairs.length > 0 ? (
          <FilterFieldset legend="Source pair">
            <FilterChip
              onClick={() => {
                setSourcePair(undefined);
                resetPage();
              }}
              active={!sourcePair}
            >
              Any
            </FilterChip>
            {distributions.sourcePairs.map((sp) => (
              <FilterChip
                key={sp.value}
                onClick={() => {
                  setSourcePair(sp.value);
                  resetPage();
                }}
                active={sourcePair === sp.value}
              >
                {sp.label} ({sp.count})
              </FilterChip>
            ))}
          </FilterFieldset>
        ) : null}

        <FilterFieldset legend="Age">
          <FilterChip
            onClick={() => {
              setAgeBucket(undefined);
              resetPage();
            }}
            active={!ageBucket}
          >
            Any
          </FilterChip>
          {AGE_BUCKETS.map((b) => (
            <FilterChip
              key={b}
              onClick={() => {
                setAgeBucket(b);
                resetPage();
              }}
              active={ageBucket === b}
            >
              {b}
            </FilterChip>
          ))}
        </FilterFieldset>
      </div>

      {slice.length === 0 ? (
        <p className="editorial-empty">
          {totalAll === 0
            ? "No disputes recorded yet. The resolver runs after each fact-sync; new disputes will appear here as upstream sources disagree."
            : "No disputes match the current filters. Try widening the filters above."}
        </p>
      ) : (
        <div style={{ marginBottom: "var(--space-6)" }}>
          {slice.map((dispute) => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              expanded={expandedId === dispute.id}
              auditState={auditCache[dispute.id]}
              onToggle={() => handleExpand(dispute.id)}
            />
          ))}
        </div>
      )}

      {totalMatching > PAGE_SIZE ? (
        <nav className="editorial-pagination" aria-label="Pagination">
          {safePage > 1 ? (
            <button
              type="button"
              onClick={() => setPage(safePage - 1)}
              className="editorial-pagination-link"
            >
              ← Page {safePage - 1}
            </button>
          ) : (
            <span>—</span>
          )}
          <span>Page {safePage}</span>
          {offset + slice.length < totalMatching ? (
            <button
              type="button"
              onClick={() => setPage(safePage + 1)}
              className="editorial-pagination-link"
            >
              Page {safePage + 1} →
            </button>
          ) : (
            <span>—</span>
          )}
        </nav>
      ) : null}
    </>
  );
}

function DisputeCard({
  dispute,
  expanded,
  auditState,
  onToggle,
}: {
  dispute: PublicDisputeRow;
  expanded: boolean;
  auditState: PublicAuditLogRow[] | "loading" | undefined;
  onToggle: () => void;
}) {
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
              fontSize: "var(--text-12)",
              color: "var(--color-text-40)",
              letterSpacing: "0.05em",
            }}
          >
            {dispute.factKey}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
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
          <Pill variant={KIND_VARIANT[dispute.disputeKind] ?? "default"}>
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
          fontSize: "var(--text-13)",
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
            fontSize: "var(--text-14)",
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
              fontSize: "var(--text-12)",
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
            fontSize: "var(--text-14)",
            color: "var(--color-text-60)",
            lineHeight: 1.55,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
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
          <button
            type="button"
            onClick={onToggle}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--color-accent)",
              font: "inherit",
            }}
          >
            {expanded ? "Hide audit history ↑" : "Show audit history →"}
          </button>
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
              fontSize: "var(--text-12)",
              color: "var(--color-text-40)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "var(--space-3)",
            }}
          >
            Audit history
          </div>
          {auditState === "loading" || auditState === undefined ? (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-14)",
                color: "var(--color-text-60)",
                margin: 0,
              }}
            >
              Loading audit history…
            </p>
          ) : auditState.length === 0 ? (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-14)",
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
              {auditState.map((row) => (
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
                      fontSize: "var(--text-12)",
                      color: "var(--color-text-40)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {formatDateTime(row.createdAt)} · {row.actorLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-14)",
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
                        fontSize: "var(--text-14)",
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
