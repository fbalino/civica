import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { jurisdictions } from "@/lib/db/schema";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { Banner } from "@/components/editorial/Banner";
import { Pill } from "@/components/editorial/Pill";
import { SourceDot } from "@/components/SourceDot";
import {
  getPulseV2Changelog,
  type PulseV2ChangelogRow,
} from "@/lib/db/queries-pulse-v2";
import { PULSE_DIMENSIONS, type PulseDimension } from "@/lib/pulse/v2/types";

export const metadata: Metadata = {
  title: "Pulse changelog (Beta) — Civica Index",
  description:
    "Every governance event classified by the Civica Pulse Beta pipeline. Filterable by country, dimension, and severity, with full source attribution and human-review status.",
  alternates: {
    canonical: "https://civicaatlas.org/civica-index/pulse-changelog",
  },
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
    country?: string;
    dimension?: string;
    severity?: string;
    review?: string;
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
  return qs ? `?${qs}` : "/civica-index/pulse-changelog";
}

function formatEventDate(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${active ? "var(--color-accent)" : "var(--color-card-border)"}`,
        background: active
          ? "color-mix(in oklch, var(--color-accent) 14%, var(--color-page-bg) 86%)"
          : "var(--color-page-bg)",
        color: active ? "var(--color-text-primary)" : "var(--color-text-55)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-11)",
        fontWeight: "var(--font-weight-mono)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Link>
  );
}

function EventCard({ event }: { event: PulseV2ChangelogRow }) {
  const isPos = event.severityValue > 0;
  return (
    <article
      style={{
        background: "var(--color-card-bg)",
        border: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-sm)",
        boxShadow: "var(--shadow-hard)",
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/countries/${event.country.slug}`}
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-16)",
              fontWeight: 500,
              color: "var(--color-text-primary)",
              textDecoration: "none",
            }}
          >
            {event.country.name}
          </Link>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-40)",
              letterSpacing: "0.05em",
            }}
          >
            {formatEventDate(event.eventDate)}
          </span>
        </div>
        <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
          <Pill>{DIMENSION_LABELS[event.dimension] ?? event.dimension}</Pill>
          <Pill variant={SEVERITY_VARIANT[event.severityTier] ?? "default"}>
            {SEVERITY_LABELS[event.severityTier] ?? event.severityTier} ·{" "}
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
          {!event.published ? (
            <Pill variant="warn">Queued for review</Pill>
          ) : null}
        </div>
      </header>

      <h3
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-18)",
          fontWeight: 400,
          lineHeight: 1.3,
          margin: "8px 0 12px",
          color: "var(--color-text-primary)",
        }}
      >
        {event.headline}
      </h3>

      <p
        style={{
          margin: "0 0 12px",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-13)",
          lineHeight: 1.55,
          color: "var(--color-text-55)",
        }}
      >
        {event.description.length > 320
          ? `${event.description.slice(0, 320)}…`
          : event.description}
      </p>

      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          paddingTop: 10,
          borderTop: "1px solid var(--color-card-border)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-11)",
          color: "var(--color-text-40)",
          letterSpacing: "0.04em",
        }}
      >
        <div style={{ display: "inline-flex", gap: 12, flexWrap: "wrap" }}>
          {event.sources.map((src) => (
            <SourceDot key={src} source={src} retrievedAt={null} />
          ))}
        </div>
        <span>
          Confidence{" "}
          {(event.corroborationConfidence ?? 0).toFixed(2)} · {isPos ? "+" : ""}
          {event.severityValue}
        </span>
      </footer>
    </article>
  );
}

export default async function PulseChangelogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country?.toLowerCase();
  const dimension = (PULSE_DIMENSIONS as string[]).includes(params.dimension ?? "")
    ? (params.dimension as PulseDimension)
    : undefined;
  const severity = params.severity;
  const showReview = params.review === "1";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;

  // Fetch the country list once for the filter dropdown
  const countries = await db
    .select({
      slug: jurisdictions.slug,
      name: jurisdictions.name,
    })
    .from(jurisdictions)
    .orderBy(jurisdictions.name);

  const result = await getPulseV2Changelog({
    country,
    dimension,
    severityTier: severity,
    publishedOnly: !showReview,
    limit,
    offset,
  });

  const baseParams = {
    country,
    dimension,
    severity,
    review: showReview ? "1" : undefined,
  };

  return (
    <EditorialPage
      className="editorial-page repl-layout"
      breadcrumbs={
        <>
          <Link href="/civica-index">← Civica Index</Link>
          <span style={{ margin: "0 8px", color: "var(--color-text-40)" }}>
            /
          </span>
          Pulse changelog
        </>
      }
      title={
        <>
          Pulse changelog{" "}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-status-warning)",
              fontWeight: "var(--font-weight-mono)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              verticalAlign: "middle",
              padding: "2px 8px",
              border: "1px solid var(--color-status-warning)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            Beta
          </span>
        </>
      }
      meta="Every governance event classified by the Civica Pulse Beta pipeline. Updated daily."
    >
      <Banner variant="warn">
        <div style={{ padding: "14px 18px", lineHeight: 1.5 }}>
          The Civica Pulse Beta is a real-time governance shock monitor under
          active validation. Events queued for human review (
          <strong>severe and catastrophic severity tiers</strong>, plus events
          where the classifier didn&apos;t reach consensus) do{" "}
          <strong>not</strong> drive published Pulse scores until a reviewer
          confirms them. See the{" "}
          <Link
            href="/civica-index/methodology/pulse"
            style={{ color: "var(--color-accent)" }}
          >
            Pulse methodology
          </Link>{" "}
          for the full pipeline.
        </div>
      </Banner>

      <SectionHeader eyebrow="Filters" title="Narrow the feed" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Country filter — chips for active, native select for the long list */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              fontWeight: "var(--font-weight-mono)",
              color: "var(--color-text-40)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              minWidth: 80,
            }}
          >
            Country
          </span>
          <FilterChip
            href={buildHref(baseParams, { country: undefined, page: undefined })}
            active={!country}
          >
            All countries
          </FilterChip>
          {country ? (
            <FilterChip
              href={buildHref(baseParams, { country: undefined, page: undefined })}
              active
            >
              {countries.find((c) => c.slug === country)?.name ?? country} ✕
            </FilterChip>
          ) : null}
          <form action="/civica-index/pulse-changelog" method="get">
            {/* Persist current filter state across the country swap */}
            {dimension ? (
              <input type="hidden" name="dimension" value={dimension} />
            ) : null}
            {severity ? (
              <input type="hidden" name="severity" value={severity} />
            ) : null}
            {showReview ? <input type="hidden" name="review" value="1" /> : null}
            <select
              name="country"
              defaultValue={country ?? ""}
              style={{
                padding: "4px 8px",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-11)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-card-border)",
                background: "var(--color-page-bg)",
                color: "var(--color-text-primary)",
              }}
            >
              <option value="">— pick country —</option>
              {countries.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              style={{
                marginLeft: 6,
                padding: "4px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-11)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-card-border)",
                background: "var(--color-page-bg)",
                color: "var(--color-accent)",
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </form>
        </div>

        {/* Dimension chips */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              fontWeight: "var(--font-weight-mono)",
              color: "var(--color-text-40)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              minWidth: 80,
            }}
          >
            Dimension
          </span>
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

        {/* Severity chips */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              fontWeight: "var(--font-weight-mono)",
              color: "var(--color-text-40)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              minWidth: 80,
            }}
          >
            Severity
          </span>
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

        {/* Review-queue toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              fontWeight: "var(--font-weight-mono)",
              color: "var(--color-text-40)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              minWidth: 80,
            }}
          >
            Status
          </span>
          <FilterChip
            href={buildHref(baseParams, {
              review: undefined,
              page: undefined,
            })}
            active={!showReview}
          >
            Published only
          </FilterChip>
          <FilterChip
            href={buildHref(baseParams, { review: "1", page: undefined })}
            active={showReview}
          >
            Show review queue
          </FilterChip>
        </div>
      </div>

      <SectionHeader
        eyebrow="Events"
        title={
          result.rows.length === 0 && page === 1
            ? "No events match these filters"
            : `${result.rows.length} event${result.rows.length === 1 ? "" : "s"} on this page`
        }
        dek={
          showReview
            ? "Including events queued for human review. These do not drive published scores yet."
            : "Published events only. Toggle status above to include the review queue."
        }
      />

      {result.rows.length === 0 && page === 1 ? (
        <p
          style={{
            margin: "16px 0 24px",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-55)",
            lineHeight: 1.5,
          }}
        >
          No events match. Try{" "}
          <Link
            href="/civica-index/pulse-changelog"
            style={{ color: "var(--color-accent)" }}
          >
            clearing all filters
          </Link>
          .
        </p>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {result.rows.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <nav
        aria-label="Pagination"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingTop: 16,
          borderTop: "1px solid var(--color-card-border)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-12)",
        }}
      >
        {page > 1 ? (
          <Link
            href={buildHref(baseParams, {
              page: String(page - 1),
            })}
            style={{
              color: "var(--color-accent)",
              textDecoration: "none",
            }}
          >
            ← Page {page - 1}
          </Link>
        ) : (
          <span style={{ color: "var(--color-text-40)" }}>—</span>
        )}
        <span style={{ color: "var(--color-text-40)" }}>Page {page}</span>
        {result.hasMore ? (
          <Link
            href={buildHref(baseParams, {
              page: String(page + 1),
            })}
            style={{
              color: "var(--color-accent)",
              textDecoration: "none",
            }}
          >
            Page {page + 1} →
          </Link>
        ) : (
          <span style={{ color: "var(--color-text-40)" }}>—</span>
        )}
      </nav>
    </EditorialPage>
  );
}
