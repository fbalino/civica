import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Pill } from "@/components/editorial/Pill";
import { SourceDot } from "@/components/SourceDot";
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
  "default" | "accent" | "success" | "warn" | "danger"
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
    <EditorialPage width="wide">
      <h1 className="editorial-page-title">Review queue</h1>
      <p className="editorial-page-subtitle">
        Pending Pulse events awaiting reviewer decision. Severe and
        catastrophic events plus events without classifier consensus land
        here automatically.
      </p>

      <p
        className="editorial-page-meta"
        style={{ marginBottom: 24 }}
      >
        <span>{totalPending} total pending</span>
        <span>·</span>
        <span>Showing {rows.length}</span>
      </p>

      <div className="editorial-filter-bar">
        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Dimension</span>
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

        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Severity</span>
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
        <p className="editorial-empty">
          {totalPending === 0
            ? "Queue is empty — every event has been reviewed."
            : "No events match these filters."}
        </p>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {rows.map((event) => (
            <Link
              key={event.id}
              href={`/admin/pulse-review/${event.id}`}
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
                      {event.country.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-12)",
                        color: "var(--color-text-40)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {formatDate(event.eventDate)}
                    </span>
                  </div>
                  <div className="editorial-card-pills">
                    <Pill>
                      {DIMENSION_LABELS[event.dimension] ?? event.dimension}
                    </Pill>
                    <Pill
                      variant={
                        SEVERITY_VARIANT[event.severityTier] ?? "default"
                      }
                    >
                      {SEVERITY_LABELS[event.severityTier] ??
                        event.severityTier}{" "}
                      ·{" "}
                      {event.severityValue > 0
                        ? `+${event.severityValue}`
                        : event.severityValue}
                    </Pill>
                    {event.classifierAgreement === "all" ? (
                      <Pill variant="success">3/3 agree</Pill>
                    ) : event.classifierAgreement === "two_of_three" ? (
                      <Pill>2/3 agree</Pill>
                    ) : (
                      <Pill variant="warn">No consensus</Pill>
                    )}
                    {event.pressFreedomScoreAtClassification != null &&
                    event.pressFreedomScoreAtClassification < 50 ? (
                      <Pill variant="warn">Restricted press</Pill>
                    ) : null}
                  </div>
                </header>

                <h3 className="editorial-card-headline">{event.headline}</h3>

                <footer className="editorial-card-foot">
                  <div className="editorial-card-foot-row">
                    {event.sourceIds.map((src) => (
                      <SourceDot key={src} source={src} retrievedAt={null} />
                    ))}
                  </div>
                  <span>
                    Confidence{" "}
                    {(event.corroborationConfidence ?? 0).toFixed(2)} ·{" "}
                    {event.severityValue > 0 ? "+" : ""}
                    {event.severityValue} · Open →
                  </span>
                </footer>
              </article>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPending > limit ? (
        <nav className="editorial-pagination" aria-label="Pagination">
          {page > 1 ? (
            <Link href={buildHref(baseParams, { page: String(page - 1) })}>
              ← Page {page - 1}
            </Link>
          ) : (
            <span>—</span>
          )}
          <span>Page {page}</span>
          {offset + rows.length < totalPending ? (
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
