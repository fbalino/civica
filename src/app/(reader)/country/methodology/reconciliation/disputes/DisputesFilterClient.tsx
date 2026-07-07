"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Pill } from "@/components/editorial/Pill";
import { SegmentedControl } from "@/components/editorial/SegmentedControl";
import { SingleSelectMenu } from "@/components/editorial/SingleSelectMenu";
import {
  PUBLIC_DISPUTE_STATUS_BUCKETS,
  PUBLIC_DISPUTE_STATUS_LABELS,
  groupDisputesByFact,
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

/** Which dropdown is currently open — enforces "one menu open at a time". */
type OpenMenu =
  | "sort"
  | "kind"
  | "factKey"
  | "severity"
  | "group"
  | "sourcePair"
  | "age"
  | null;

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
    PublicDisputeStatusBucket | "all"
  >("all");
  const [kind, setKind] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [factKey, setFactKey] = useState<string>("");
  const [sourcePair, setSourcePair] = useState<string>("");
  const [severityBucket, setSeverityBucket] = useState<SeverityBucket | "">("");
  const [ageBucket, setAgeBucket] = useState<AgeBucket | "">("");
  const [sort, setSort] = useState<DisputeSortKey>("severity");
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditCache, setAuditCache] = useState<
    Record<string, PublicAuditLogRow[] | "loading">
  >({});
  const [, startTransition] = useTransition();
  const toolbarRef = useRef<HTMLDivElement>(null);

  const resetPage = () => setPage(1);

  // Outside-click / Escape closes any open dropdown (SingleSelectMenu is
  // caller-controlled, so the parent owns dismissal).
  useEffect(() => {
    if (!openMenu) return;
    function onPointerDown(event: PointerEvent) {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  const hasActiveFilter =
    statusBucket !== "all" ||
    Boolean(kind) ||
    Boolean(group) ||
    Boolean(factKey) ||
    Boolean(sourcePair) ||
    Boolean(severityBucket) ||
    Boolean(ageBucket);

  const resetAll = () => {
    setStatusBucket("all");
    setKind("");
    setGroup("");
    setFactKey("");
    setSourcePair("");
    setSeverityBucket("");
    setAgeBucket("");
    resetPage();
  };

  // ── Filter + sort the flat pairwise rows, THEN consolidate into one entry
  //    per (jurisdiction, fact_key). The three near-identical pairwise
  //    disputes for one fact collapse into a single expandable group.
  const groups = useMemo(() => {
    const matched = disputes.filter((d) => {
      if (statusBucket !== "all" && d.statusBucket !== statusBucket)
        return false;
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

    return groupDisputesByFact(matched);
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

  const totalGroups = groups.length;
  const totalMatchingRows = groups.reduce((n, g) => n + g.members.length, 0);
  const totalPages = Math.max(1, Math.ceil(totalGroups / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const slice = groups.slice(offset, offset + PAGE_SIZE);

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

  // Dropdown item sets.
  const sortItems = (["severity", "age", "oldest"] as DisputeSortKey[]).map(
    (s) => ({ value: s, label: SORT_LABELS[s] }),
  );
  const kindItems = [
    { value: "", label: "All kinds" },
    ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
  ];
  const groupItems = [
    { value: "", label: "Any group" },
    ...FACT_GROUPS.map((g) => ({ value: g, label: `Group ${g}` })),
  ];
  const severityItems = [
    { value: "", label: "Any severity" },
    ...SEVERITY_BUCKETS.map((b) => ({
      value: b,
      label: SEVERITY_BUCKET_LABELS[b],
    })),
  ];
  const ageItems = [
    { value: "", label: "Any age" },
    ...AGE_BUCKETS.map((b) => ({ value: b, label: b })),
  ];
  const factKeyItems = [
    { value: "", label: "Any fact-key" },
    ...distributions.factKeys.map((fk) => ({
      value: fk.value,
      label: `${fk.value} (${fk.count})`,
    })),
  ];
  const sourcePairItems = [
    { value: "", label: "Any source pair" },
    ...distributions.sourcePairs.map((sp) => ({
      value: sp.value,
      label: `${sp.label} (${sp.count})`,
    })),
  ];

  return (
    <>
      <div className="disputes-controls">
        <SegmentedControl<PublicDisputeStatusBucket | "all">
          ariaLabel="Filter by status"
          value={statusBucket}
          onChange={(v) => {
            setStatusBucket(v);
            resetPage();
          }}
          options={[
            { value: "all", label: "All" },
            ...PUBLIC_DISPUTE_STATUS_BUCKETS.map((s) => ({
              value: s,
              label: PUBLIC_DISPUTE_STATUS_LABELS[s],
            })),
          ]}
        />

        <div className="disputes-toolbar" ref={toolbarRef}>
          <SingleSelectMenu
            label="Sort"
            ariaLabel="Sort disputes"
            value={sort}
            items={sortItems}
            open={openMenu === "sort"}
            onOpenChange={(o) => setOpenMenu(o ? "sort" : null)}
            onSelect={(v) => {
              setSort(v as DisputeSortKey);
              resetPage();
            }}
            minWidth={130}
          />
          <SingleSelectMenu
            label="Kind"
            ariaLabel="Filter by dispute kind"
            value={kind}
            items={kindItems}
            open={openMenu === "kind"}
            onOpenChange={(o) => setOpenMenu(o ? "kind" : null)}
            onSelect={(v) => {
              setKind(v);
              resetPage();
            }}
            minWidth={150}
          />
          <SingleSelectMenu
            label="Fact-key"
            ariaLabel="Filter by fact-key"
            value={factKey}
            items={factKeyItems}
            open={openMenu === "factKey"}
            onOpenChange={(o) => setOpenMenu(o ? "factKey" : null)}
            onSelect={(v) => {
              setFactKey(v);
              resetPage();
            }}
            minWidth={170}
          />
          <SingleSelectMenu
            label="Severity"
            ariaLabel="Filter by severity"
            value={severityBucket}
            items={severityItems}
            open={openMenu === "severity"}
            onOpenChange={(o) => setOpenMenu(o ? "severity" : null)}
            onSelect={(v) => {
              setSeverityBucket(v as SeverityBucket | "");
              resetPage();
            }}
            minWidth={140}
          />
          <SingleSelectMenu
            label="Group"
            ariaLabel="Filter by fact group"
            value={group}
            items={groupItems}
            open={openMenu === "group"}
            onOpenChange={(o) => setOpenMenu(o ? "group" : null)}
            onSelect={(v) => {
              setGroup(v);
              resetPage();
            }}
            minWidth={120}
          />
          <SingleSelectMenu
            label="Source pair"
            ariaLabel="Filter by source pair"
            value={sourcePair}
            items={sourcePairItems}
            open={openMenu === "sourcePair"}
            onOpenChange={(o) => setOpenMenu(o ? "sourcePair" : null)}
            onSelect={(v) => {
              setSourcePair(v);
              resetPage();
            }}
            minWidth={180}
          />
          <SingleSelectMenu
            label="Age"
            ariaLabel="Filter by dispute age"
            value={ageBucket}
            items={ageItems}
            open={openMenu === "age"}
            onOpenChange={(o) => setOpenMenu(o ? "age" : null)}
            onSelect={(v) => {
              setAgeBucket(v as AgeBucket | "");
              resetPage();
            }}
            minWidth={120}
          />
          {hasActiveFilter ? (
            <button
              type="button"
              className="disputes-reset"
              onClick={resetAll}
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </div>

      <p className="disputes-summary">
        <span>{totalAll} total disputes on record</span>
        <span aria-hidden>·</span>
        <span>
          {totalGroups} {totalGroups === 1 ? "fact" : "facts"} in conflict
          {totalMatchingRows !== totalGroups
            ? ` (${totalMatchingRows} source pairs)`
            : ""}
          {hasActiveFilter ? " · filtered" : ""}
        </span>
        <span aria-hidden>·</span>
        <span>
          Page {safePage} of {totalPages}
        </span>
      </p>

      {slice.length === 0 ? (
        <p className="editorial-empty">
          {totalAll === 0
            ? "No disputes recorded yet. The resolver runs after each fact-sync; new disputes will appear here as upstream sources disagree."
            : "No disputes match the current filters. Try widening the filters above."}
        </p>
      ) : (
        <div style={{ marginBottom: "var(--space-6)" }}>
          {slice.map((factGroup) => (
            <DisputeGroupCard
              key={factGroup.key}
              factGroup={factGroup}
              expandedId={expandedId}
              auditCache={auditCache}
              onToggleAudit={handleExpand}
            />
          ))}
        </div>
      )}

      {totalGroups > PAGE_SIZE ? (
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
          {offset + slice.length < totalGroups ? (
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

/**
 * One consolidated card per (jurisdiction, fact_key). The header carries the
 * fact and status; the body lists every pairwise sub-dispute (source A vs B,
 * outcome, reviewer notes, audit history) as its own sub-row. When a fact has
 * a single pairwise dispute the card reads like a normal dispute; when it has
 * several, they roll up under one heading instead of scattering as near-dupes.
 */
function DisputeGroupCard({
  factGroup,
  expandedId,
  auditCache,
  onToggleAudit,
}: {
  factGroup: ReturnType<typeof groupDisputesByFact<PublicDisputeRow>>[number];
  expandedId: string | null;
  auditCache: Record<string, PublicAuditLogRow[] | "loading">;
  onToggleAudit: (id: string) => void;
}) {
  const { lead, members } = factGroup;
  const multi = members.length > 1;

  return (
    <article
      className="editorial-card disputes-group"
      id={`dispute-${lead.id}`}
      style={{ scrollMarginTop: "var(--space-7)" }}
    >
      <header className="editorial-card-head">
        <div className="editorial-card-head-left">
          <span className="disputes-country">{factGroup.country.name}</span>
          <span className="disputes-factkey">{factGroup.factKey}</span>
          {multi ? (
            <span className="disputes-factkey">
              · {members.length} source pairs
            </span>
          ) : null}
        </div>
        <div className="editorial-card-pills">
          {lead.severity.severity != null ? (
            <Pill variant={severityBadgeVariant(lead.severity)}>
              {formatSeverity(lead.severity)}
            </Pill>
          ) : null}
          <Pill variant={KIND_VARIANT[lead.disputeKind] ?? "default"}>
            {KIND_LABELS[lead.disputeKind] ?? lead.disputeKind}
          </Pill>
          <Pill>{`Group ${factGroup.factGroup}`}</Pill>
          <Pill variant={STATUS_BUCKET_VARIANT[lead.statusBucket]}>
            {PUBLIC_DISPUTE_STATUS_LABELS[lead.statusBucket]}
          </Pill>
          {factGroup.hasReviewerNotes ? (
            <Pill variant="accent">Reviewer note</Pill>
          ) : null}
        </div>
      </header>

      <h3
        className="editorial-card-headline"
        style={{ marginTop: "var(--space-3)" }}
      >
        {lead.description ??
          `${KIND_LABELS[lead.disputeKind] ?? "Dispute"} on ${factGroup.factKey}.`}
      </h3>

      <div className="disputes-subrows">
        {members.map((dispute) => (
          <DisputeSubRow
            key={dispute.id}
            dispute={dispute}
            showPairHeading={multi}
            expanded={expandedId === dispute.id}
            auditState={auditCache[dispute.id]}
            onToggle={() => onToggleAudit(dispute.id)}
          />
        ))}
      </div>
    </article>
  );
}

function DisputeSubRow({
  dispute,
  showPairHeading,
  expanded,
  auditState,
  onToggle,
}: {
  dispute: PublicDisputeRow;
  showPairHeading: boolean;
  expanded: boolean;
  auditState: PublicAuditLogRow[] | "loading" | undefined;
  onToggle: () => void;
}) {
  return (
    <div className="disputes-subrow">
      {showPairHeading ? (
        <div className="disputes-subrow-head">
          <span className="disputes-pair-label">
            {dispute.factA?.sourceId ?? "—"} × {dispute.factB?.sourceId ?? "—"}
          </span>
          <span className="disputes-subrow-meta">
            <Pill variant={STATUS_BUCKET_VARIANT[dispute.statusBucket]}>
              {PUBLIC_DISPUTE_STATUS_LABELS[dispute.statusBucket]}
            </Pill>
            <span>created {formatDate(dispute.createdAt)}</span>
          </span>
        </div>
      ) : (
        <div className="disputes-subrow-head">
          <span className="disputes-subrow-meta">
            created {formatDate(dispute.createdAt)}
          </span>
        </div>
      )}

      <div className="disputes-facts">
        <div className="disputes-fact">
          <div className="disputes-fact-label">
            A · {dispute.factA?.sourceId ?? "—"}
          </div>
          <div className="disputes-fact-value">
            {formatFactValue(dispute.factA)}
          </div>
          {dispute.factA?.asOf ? (
            <div className="disputes-fact-asof">as of {dispute.factA.asOf}</div>
          ) : null}
        </div>
        <div className="disputes-fact">
          <div className="disputes-fact-label">
            B · {dispute.factB?.sourceId ?? "—"}
          </div>
          <div className="disputes-fact-value">
            {formatFactValue(dispute.factB)}
          </div>
          {dispute.factB?.asOf ? (
            <div className="disputes-fact-asof">as of {dispute.factB.asOf}</div>
          ) : null}
        </div>
      </div>

      {dispute.statusBucket !== "open" ? (
        <div className="disputes-outcome">
          <span className="disputes-outcome-label">Outcome</span>
          <span className="disputes-outcome-value">
            {dispute.resolutionLabel ?? "—"}
          </span>
          {dispute.resolvedAt ? (
            <span className="disputes-outcome-date">
              · {formatDate(dispute.resolvedAt)}
            </span>
          ) : null}
        </div>
      ) : null}

      {dispute.reviewerNotes ? (
        <div className="disputes-note">
          <span className="disputes-note-label">Reviewer note</span>
          <p className="disputes-note-body">{dispute.reviewerNotes}</p>
        </div>
      ) : null}

      <div className="disputes-subrow-foot">
        {dispute.submitterName ? (
          <span className="disputes-submitter">
            Submitted by {dispute.submitterName}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onToggle}
          className="disputes-audit-toggle"
        >
          {expanded ? "Hide audit history ↑" : "Show audit history →"}
        </button>
      </div>

      {expanded ? (
        <div className="disputes-audit">
          <div className="disputes-audit-title">Audit history</div>
          {auditState === "loading" || auditState === undefined ? (
            <p className="disputes-audit-empty">Loading audit history…</p>
          ) : auditState.length === 0 ? (
            <p className="disputes-audit-empty">
              No audit entries on this dispute. The audit log starts at
              2026-05-05; pre-R.21 reviewer decisions are recoverable from the
              resolution metadata above.
            </p>
          ) : (
            <ul className="disputes-audit-list">
              {auditState.map((row) => (
                <li key={row.id} className="disputes-audit-item">
                  <div className="disputes-audit-meta">
                    {formatDateTime(row.createdAt)} · {row.actorLabel}
                  </div>
                  <div className="disputes-audit-headline">
                    <strong>{row.action}</strong>
                    {row.beforeStatus && row.afterStatus
                      ? `: ${row.beforeStatus} → ${row.afterStatus}`
                      : ""}
                  </div>
                  {row.notes ? (
                    <div className="disputes-audit-notes">{row.notes}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
