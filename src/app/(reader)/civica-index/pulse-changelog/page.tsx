import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { jurisdictions } from "@/lib/db/schema";
import { EditorialPage } from "@/components/editorial/EditorialPage";
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
      className={
        active ? "editorial-chip editorial-chip--active" : "editorial-chip"
      }
    >
      {children}
    </Link>
  );
}

function EventCard({ event }: { event: PulseV2ChangelogRow }) {
  const isPos = event.severityValue > 0;
  return (
    <article className="editorial-card">
      <header className="editorial-card-head">
        <div className="editorial-card-head-left">
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
        <div className="editorial-card-pills">
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

      <h3 className="editorial-card-headline">{event.headline}</h3>

      <p className="editorial-card-desc">
        {event.description.length > 320
          ? `${event.description.slice(0, 320)}…`
          : event.description}
      </p>

      <footer className="editorial-card-foot">
        <div className="editorial-card-foot-row">
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
    <EditorialPage width="wide">
      <nav className="editorial-breadcrumbs">
        <Link href="/civica-index">← Civica Index</Link>
        <span>/</span>
        Pulse changelog
      </nav>

      <h1 className="editorial-page-title">
        Pulse changelog
        <span className="editorial-beta-tag">Beta</span>
      </h1>
      <p className="editorial-page-subtitle">
        Every governance event classified by the Civica Pulse Beta pipeline.
        Updated daily.
      </p>

      <div className="editorial-warning">
        The Civica Pulse Beta is a real-time governance shock monitor under
        active validation. Events queued for human review (
        <strong>severe and catastrophic severity tiers</strong>, plus events
        where the classifier didn&apos;t reach consensus) do{" "}
        <strong>not</strong> drive published Pulse scores until a reviewer
        confirms them. See the{" "}
        <Link href="/civica-index/methodology/pulse">Pulse methodology</Link>{" "}
        for the full pipeline.
      </div>

      <div className="editorial-filter-bar">
        {/* Country filter */}
        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Country</span>
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
          <form
            action="/civica-index/pulse-changelog"
            method="get"
            className="editorial-filter-form"
          >
            {dimension ? (
              <input type="hidden" name="dimension" value={dimension} />
            ) : null}
            {severity ? (
              <input type="hidden" name="severity" value={severity} />
            ) : null}
            {showReview ? <input type="hidden" name="review" value="1" /> : null}
            <select name="country" defaultValue={country ?? ""}>
              <option value="">— pick country —</option>
              {countries.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit">Apply</button>
          </form>
        </div>

        {/* Dimension chips */}
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

        {/* Severity chips */}
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

        {/* Review-queue toggle */}
        <div className="editorial-filter-row">
          <span className="editorial-filter-label">Status</span>
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

      <div className="editorial-results-header-block">
        <span className="editorial-eyebrow">Events</span>
        <h2 className="editorial-results-title">
          {result.rows.length === 0 && page === 1
            ? "No events match these filters"
            : `${result.rows.length} event${result.rows.length === 1 ? "" : "s"} on this page`}
        </h2>
        <p className="editorial-results-dek">
          {showReview
            ? "Including events queued for human review. These do not drive published scores yet."
            : "Published events only. Toggle status above to include the review queue."}
        </p>
      </div>

      {result.rows.length === 0 && page === 1 ? (
        <p className="editorial-empty">
          No events match. Try{" "}
          <Link href="/civica-index/pulse-changelog">
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

      <nav className="editorial-pagination" aria-label="Pagination">
        {page > 1 ? (
          <Link href={buildHref(baseParams, { page: String(page - 1) })}>
            ← Page {page - 1}
          </Link>
        ) : (
          <span>—</span>
        )}
        <span>Page {page}</span>
        {result.hasMore ? (
          <Link href={buildHref(baseParams, { page: String(page + 1) })}>
            Page {page + 1} →
          </Link>
        ) : (
          <span>—</span>
        )}
      </nav>
    </EditorialPage>
  );
}
