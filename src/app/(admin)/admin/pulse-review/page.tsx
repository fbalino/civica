import type { Metadata } from "next";
import Link from "next/link";
import { Chip } from "@/components/editorial/Pill";
import { SourceDot } from "@/components/SourceDot";
import { DataTable } from "@/components/editorial/DataTable";
import { AdminRow } from "@/app/(admin)/AdminRow";
import { getPulseReviewQueue } from "@/lib/db/queries-pulse-review";
import { PULSE_DIMENSIONS, type PulseDimension } from "@/lib/pulse/v2/types";

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
  override: Record<string, string | undefined>
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

export default async function PulseReviewQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dimension = (PULSE_DIMENSIONS as string[]).includes(
    params.dimension ?? ""
  )
    ? (params.dimension as PulseDimension)
    : undefined;
  const severity = params.severity;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const { rows, totalPending } = await getPulseReviewQueue({
    dimension,
    severity,
    limit,
    offset,
  });

  const baseParams = { dimension, severity };

  return (
    <>
      <header className="admin-page-head">
        <h1 className="admin-title">Pulse review</h1>
        <p className="admin-subtitle">
          Pending Pulse events awaiting a reviewer decision. Severe and
          catastrophic events, plus events without classifier consensus, land
          here automatically.
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
            ? "Every queued event has been reviewed."
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
                <th className="num">Date</th>
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
                        variant={SEVERITY_VARIANT[event.severityTier] ?? "neutral"}
                      >
                        {SEVERITY_LABELS[event.severityTier] ??
                          event.severityTier}{" "}
                        ·{" "}
                        {event.severityValue > 0
                          ? `+${event.severityValue}`
                          : event.severityValue}
                      </Chip>
                      {event.pressFreedomScoreAtClassification != null &&
                      event.pressFreedomScoreAtClassification < 50 ? (
                        <Chip variant="warn">Restricted press</Chip>
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
                    {formatDate(event.eventDate)}
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
