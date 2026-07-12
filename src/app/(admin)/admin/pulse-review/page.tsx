import type { Metadata } from "next";
import Link from "next/link";
import { Chip } from "@/components/editorial/Pill";
import { SourceDot } from "@/components/SourceDot";
import { DataTable } from "@/components/editorial/DataTable";
import { AdminRow } from "@/app/(admin)/AdminRow";
import { getPulseReviewQueue } from "@/lib/db/queries-pulse-review";
import { PULSE_DIMENSIONS, type PulseDimension } from "@/lib/pulse/v2/types";
import { loadPulseSourceCoverageReport } from "@/lib/pulse/v2/source-coverage";
import { loadPulseReviewSlaReport } from "@/lib/pulse/v2/review-sla-store";

export const metadata: Metadata = {
  title: "Pulse review queue — Civica admin",
  robots: { index: false, follow: false },
};

const DIMENSION_LABELS: Record<string, string> = {
  democratic_quality: "Democratic Quality",
  rule_of_law: "Rule of Law",
  freedom_rights: "Rights & Freedoms",
  corruption_control: "Corruption Control",
  stability: "Stability",
};

const SEVERITY_LABELS: Record<string, string> = {
  low_pos: "Low +",
  moderate_pos: "Moderate +",
  high_pos: "High +",
  low_neg: "Low −",
  moderate_neg: "Moderate −",
  severe_neg: "Severe −",
  catastrophic_neg: "Catastrophic −",
};

const SEVERITY_VARIANT: Record<
  string,
  "neutral" | "accent" | "success" | "warn" | "danger"
> = {
  low_pos: "success",
  moderate_pos: "success",
  high_pos: "success",
  low_neg: "warn",
  moderate_neg: "warn",
  severe_neg: "danger",
  catastrophic_neg: "danger",
};

interface PageProps {
  searchParams: Promise<{
    dimension?: string;
    severity?: string;
    page?: string;
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
  return qs ? `?${qs}` : "/admin/pulse-review";
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

function formatDate(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not observed";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function formatAge(from: string, to: string): string {
  const hours = Math.max(
    0,
    Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 3_600_000),
  );
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default async function PulseReviewQueuePage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const dimension = (PULSE_DIMENSIONS as string[]).includes(
    params.dimension ?? "",
  )
    ? (params.dimension as PulseDimension)
    : undefined;
  const severity = params.severity;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const [{ rows, totalPending }, sourceCoverage, sla] = await Promise.all([
    getPulseReviewQueue({ dimension, severity, limit, offset }),
    loadPulseSourceCoverageReport(),
    loadPulseReviewSlaReport(),
  ]);

  const baseParams = { dimension, severity };

  return (
    <>
      <header className="admin-page-head">
        <h1 className="admin-title">Pulse review</h1>
        <p className="admin-subtitle">
          Pending Pulse events awaiting a reviewer decision. High-positive,
          severe-negative, and catastrophic-negative classifications; deadlocks
          or no quorum; and weak/degraded majorities paired with low-confidence,
          refuted, or failed verification land here automatically.
        </p>
        <p className="admin-meta">
          <span className="admin-meta-num">{totalPending}</span>
          <span>total pending</span>
          <span className="admin-meta-sep">·</span>
          <span>
            Showing <span className="admin-meta-num">{rows.length}</span>
          </span>
        </p>
      </header>

      <section className="admin-section" aria-labelledby="review-sla-title">
        <h2 id="review-sla-title" className="admin-section-title">
          Review service level
        </h2>
        <p className="admin-section-intro">
          Internal operating targets under {sla.slaVersion}: catastrophic
          classifications are due in 24 hours, severe and high-positive items in
          72 hours, and other queued items in seven days. These are review
          controls, not staffed guarantees or validation claims.
        </p>
        <p className="admin-meta">
          <Chip
            variant={
              sla.healthState === "incomplete_review_sla"
                ? "danger"
                : sla.active
                  ? "warn"
                  : "success"
            }
          >
            {sla.healthState.replaceAll("_", " ")}
          </Chip>
          <span>{sla.active} active</span>
          <span className="admin-meta-sep">·</span>
          <span>{sla.escalationDue} escalated</span>
          <span className="admin-meta-sep">·</span>
          <span>
            {sla.breachedUnexcepted + sla.breachedExcepted} past deadline
          </span>
          <span className="admin-meta-sep">·</span>
          <span>{sla.activeExceptions} active exceptions</span>
          <span className="admin-meta-sep">·</span>
          <span>{sla.legacyQuarantined} legacy quarantined</span>
        </p>
        <div className="admin-table-scroll">
          <DataTable className="admin-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Open</th>
                <th>Escalation due</th>
                <th>Past deadline</th>
                <th>Oldest active age</th>
              </tr>
            </thead>
            <tbody>
              {sla.byPriority.map((priority) => (
                <tr key={priority.priority}>
                  <td>
                    <Chip
                      variant={
                        priority.priority === "critical"
                          ? "danger"
                          : priority.priority === "urgent"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {priority.priority}
                    </Chip>
                  </td>
                  <td>{priority.open}</td>
                  <td>{priority.escalationDue}</td>
                  <td>{priority.breached}</td>
                  <td>
                    {priority.oldestQueuedAt
                      ? formatAge(priority.oldestQueuedAt, sla.generatedAt)
                      : "None"}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
        {!sla.dailyCompletenessEligible ? (
          <div className="admin-note">
            Daily-completeness wording is withheld while any review obligation
            is past deadline. An exception explains delay but does not restore
            completeness.
          </div>
        ) : null}
      </section>

      <section
        className="admin-section"
        aria-labelledby="source-coverage-title"
      >
        <h2 id="source-coverage-title" className="admin-section-title">
          Source operations
        </h2>
        <p className="admin-section-intro">
          Live connector outcomes and retained evidence scope. A configured or
          stub connector cannot appear operating without a successful latest
          retrieval, retained evidence, and registered rights.
        </p>
        <div className="admin-table-scroll">
          <DataTable className="admin-table">
            <thead>
              <tr>
                <th>Feed / state</th>
                <th>Latest retrieval</th>
                <th>Yield</th>
                <th>Retained evidence</th>
                <th>Observed scope / rights</th>
              </tr>
            </thead>
            <tbody>
              {sourceCoverage.feeds.map((feed) => (
                <tr key={feed.feedId}>
                  <td>
                    <span className="admin-row-primary">{feed.feedId}</span>
                    <Chip
                      variant={
                        feed.state === "operating"
                          ? "success"
                          : feed.state === "degraded"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {feed.state}
                    </Chip>
                  </td>
                  <td>
                    {formatTimestamp(feed.retrieval.latestAttemptAt)}
                    <span className="admin-row-secondary">
                      {feed.retrieval.successfulRuns} successful ·{" "}
                      {feed.retrieval.failedRuns} failed
                    </span>
                  </td>
                  <td>
                    {feed.retrieval.latestFetched ?? "—"} fetched ·{" "}
                    {feed.retrieval.latestYield ?? "—"} yielded ·{" "}
                    {feed.retrieval.latestInserted ?? "—"} inserted
                  </td>
                  <td>
                    {feed.evidence.retainedRows} rows
                    <span className="admin-row-secondary">
                      Latest {formatTimestamp(feed.evidence.lastDataAt)}
                    </span>
                  </td>
                  <td>
                    {feed.evidence.languages.join(", ") ||
                      "No language observed"}
                    {" · "}
                    {feed.evidence.observedJurisdictions} jurisdictions
                    <span className="admin-row-secondary">
                      Rights{" "}
                      {feed.rights
                        .map(({ reviewStatus }) => reviewStatus)
                        .join(", ") || "not registered"}
                      . {feed.blindSpots.join(" ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </section>

      <div className="admin-filters">
        <div className="admin-filter-row">
          <span className="admin-filter-label">Dimension</span>
          <FilterChip
            href={buildHref(baseParams, {
              dimension: undefined,
              page: undefined,
            })}
            active={!dimension}
          >
            All
          </FilterChip>
          {PULSE_DIMENSIONS.map((d) => (
            <FilterChip
              key={d}
              href={buildHref(baseParams, { dimension: d, page: undefined })}
              active={dimension === d}
            >
              {DIMENSION_LABELS[d]}
            </FilterChip>
          ))}
        </div>

        <div className="admin-filter-row">
          <span className="admin-filter-label">Severity</span>
          <FilterChip
            href={buildHref(baseParams, {
              severity: undefined,
              page: undefined,
            })}
            active={!severity}
          >
            Any
          </FilterChip>
          {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
            <FilterChip
              key={key}
              href={buildHref(baseParams, { severity: key, page: undefined })}
              active={severity === key}
            >
              {label}
            </FilterChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-empty">
          <strong>Nothing to review</strong>
          {totalPending === 0
            ? sla.legacyQuarantined > 0
              ? "The active queue is empty. Pre-contract items remain retained in the separate legacy quarantine and are not counted as reviewed."
              : "The active queue is empty."
            : "No events match these filters."}
        </div>
      ) : (
        <div className="admin-table-scroll">
          <DataTable className="admin-table">
            <thead>
              <tr>
                <th>Country / headline</th>
                <th>Dimension</th>
                <th>Severity</th>
                <th>Consensus</th>
                <th className="num">SLA / age</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <AdminRow
                  key={event.id}
                  href={`/admin/pulse-review/${event.id}`}
                >
                  <td>
                    <Link
                      href={`/admin/pulse-review/${event.id}`}
                      className="admin-row-link"
                    >
                      <span className="admin-row-primary">
                        {event.country.name}
                        <span className="admin-cell-dots">
                          {event.sourceIds.map((src) => (
                            <SourceDot
                              key={src}
                              source={src}
                              retrievedAt={null}
                            />
                          ))}
                        </span>
                      </span>
                      <span className="admin-row-secondary">
                        {event.headline}
                      </span>
                    </Link>
                  </td>
                  <td>
                    <Chip>
                      {DIMENSION_LABELS[event.dimension] ?? event.dimension}
                    </Chip>
                  </td>
                  <td>
                    <span className="admin-cell-chips">
                      <Chip
                        variant={
                          SEVERITY_VARIANT[event.severityTier] ?? "neutral"
                        }
                      >
                        {SEVERITY_LABELS[event.severityTier] ??
                          event.severityTier}{" "}
                        ·{" "}
                        {event.severityValue > 0
                          ? `+${event.severityValue}`
                          : event.severityValue}
                      </Chip>
                      {event.pressFreedomScoreAtClassification != null ? (
                        <Chip variant="warn">Legacy unversioned context</Chip>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    {event.classifierAgreement === "all" ? (
                      <Chip variant="success">3/3 agree</Chip>
                    ) : event.classifierAgreement === "two_of_three" ? (
                      <Chip>2/3 agree</Chip>
                    ) : (
                      <Chip variant="warn">No consensus</Chip>
                    )}
                  </td>
                  <td className="num admin-cell-date">
                    <Chip
                      variant={
                        event.complianceState.startsWith("breached")
                          ? "danger"
                          : event.complianceState === "escalation_due"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {event.priority}
                    </Chip>
                    <span className="admin-row-secondary">
                      {formatAge(event.queuedAt, sla.generatedAt)} old · due{" "}
                      {formatDate(event.dueAt)}
                      {event.exceptionActive ? " · exception active" : ""}
                    </span>
                  </td>
                </AdminRow>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      {totalPending > limit ? (
        <nav className="admin-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link href={buildHref(baseParams, { page: String(page - 1) })}>
              ← Page {page - 1}
            </Link>
          ) : (
            <span aria-hidden>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < totalPending ? (
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
