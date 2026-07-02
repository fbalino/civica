"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PulseEventDetailCard } from "@/components/pulse/PulseEventDetailCard";
import {
  PULSE_DIMENSIONS,
  type PulseDimension,
} from "@/lib/pulse/v2/types";
import {
  DIMENSION_LABELS,
  SEVERITY_TIER_LABELS,
} from "@/lib/pulse/v2/labels";
import type { PulseV2ChangelogRow } from "@/lib/db/queries-pulse-v2";

const PAGE_SIZE = 25;

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

interface Country {
  slug: string;
  name: string;
}

interface Props {
  events: PulseV2ChangelogRow[];
  countries: Country[];
}

export function PulseChangelogFilterClient({ events, countries }: Props) {
  const searchParams = useSearchParams();

  const [country, setCountry] = useState<string | undefined>();
  const [dimension, setDimension] = useState<PulseDimension | undefined>();
  const [severity, setSeverity] = useState<string | undefined>();
  const [showReview, setShowReview] = useState(false);
  const [page, setPage] = useState(1);

  // Read ?country=<slug> ONCE on mount to honor deep links from country
  // pages and PulseDimensionalDeltas. Other URL params are ignored.
  useEffect(() => {
    const initial = searchParams.get("country")?.toLowerCase();
    if (initial && countries.some((c) => c.slug === initial)) {
      setCountry(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (country && e.country?.slug?.toLowerCase() !== country) return false;
      if (dimension && e.dimension !== dimension) return false;
      if (severity && e.severityTier !== severity) return false;
      if (!showReview && !e.published) return false;
      return true;
    });
  }, [events, country, dimension, severity, showReview]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + slice.length < filtered.length;

  const resetPage = () => setPage(1);

  return (
    <>
      <div className="editorial-filter-bar">
        <fieldset className="editorial-filter-row">
          <legend className="editorial-filter-label">Country</legend>
          <div
            className="editorial-filter-group"
            role="group"
            aria-label="Filter by country"
          >
            <FilterChip
              onClick={() => {
                setCountry(undefined);
                resetPage();
              }}
              active={!country}
            >
              All countries
            </FilterChip>
            {country ? (
              <FilterChip
                onClick={() => {
                  setCountry(undefined);
                  resetPage();
                }}
                active
              >
                {countries.find((c) => c.slug === country)?.name ?? country} ✕
              </FilterChip>
            ) : null}
            <select
              className="editorial-filter-select"
              aria-label="Pick a country"
              value={country ?? ""}
              onChange={(e) => {
                const next = e.target.value;
                setCountry(next === "" ? undefined : next);
                resetPage();
              }}
            >
              <option value="">— pick country —</option>
              {countries.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset className="editorial-filter-row">
          <legend className="editorial-filter-label">Dimension</legend>
          <div
            className="editorial-filter-group"
            role="group"
            aria-label="Filter by dimension"
          >
            <FilterChip
              onClick={() => {
                setDimension(undefined);
                resetPage();
              }}
              active={!dimension}
            >
              All
            </FilterChip>
            {PULSE_DIMENSIONS.map((d) => (
              <FilterChip
                key={d}
                onClick={() => {
                  setDimension(d);
                  resetPage();
                }}
                active={dimension === d}
              >
                {DIMENSION_LABELS[d]}
              </FilterChip>
            ))}
          </div>
        </fieldset>

        <fieldset className="editorial-filter-row">
          <legend className="editorial-filter-label">Severity</legend>
          <div
            className="editorial-filter-group"
            role="group"
            aria-label="Filter by severity"
          >
            <FilterChip
              onClick={() => {
                setSeverity(undefined);
                resetPage();
              }}
              active={!severity}
            >
              Any
            </FilterChip>
            {Object.entries(SEVERITY_TIER_LABELS).map(([key, label]) => (
              <FilterChip
                key={key}
                onClick={() => {
                  setSeverity(key);
                  resetPage();
                }}
                active={severity === key}
              >
                {label}
              </FilterChip>
            ))}
          </div>
        </fieldset>

        <fieldset className="editorial-filter-row">
          <legend className="editorial-filter-label">Status</legend>
          <div
            className="editorial-filter-group"
            role="group"
            aria-label="Filter by status"
          >
            <FilterChip
              onClick={() => {
                setShowReview(false);
                resetPage();
              }}
              active={!showReview}
            >
              Published only
            </FilterChip>
            <FilterChip
              onClick={() => {
                setShowReview(true);
                resetPage();
              }}
              active={showReview}
            >
              Show review queue
            </FilterChip>
          </div>
        </fieldset>
      </div>

      <div className="editorial-results-header-block">
        <span className="editorial-eyebrow">Events</span>
        <h2 className="editorial-results-title">
          {slice.length === 0 && safePage === 1
            ? "No events match these filters"
            : `${slice.length} event${slice.length === 1 ? "" : "s"} on this page`}
        </h2>
        <p className="editorial-results-dek">
          {showReview
            ? "Including events queued for human review. These do not drive published scores yet."
            : "Published events only. Toggle status above to include the review queue."}
        </p>
      </div>

      {slice.length === 0 && safePage === 1 ? (
        <p className="editorial-empty">
          No events match.{" "}
          <button
            type="button"
            onClick={() => {
              setCountry(undefined);
              setDimension(undefined);
              setSeverity(undefined);
              setShowReview(false);
              resetPage();
            }}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--color-accent)",
              font: "inherit",
              textDecoration: "underline",
            }}
          >
            Clear all filters
          </button>
          .
        </p>
      ) : (
        <div style={{ marginBottom: "var(--space-6)" }}>
          {slice.map((event) => (
            <PulseEventDetailCard key={event.id} event={event} />
          ))}
        </div>
      )}

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
        {hasMore ? (
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
    </>
  );
}
