"use client";

import { usePathname, useRouter } from "next/navigation";
import { PulseEventDetailCard } from "@/components/pulse/PulseEventDetailCard";
import {
  PULSE_DIMENSIONS,
} from "@/lib/pulse/v2/types";
import {
  DIMENSION_LABELS,
  SEVERITY_TIER_LABELS,
} from "@/lib/pulse/v2/labels";
import type { PulseV2ChangelogRow } from "@/lib/db/queries-pulse-v2";
import {
  pulseChangelogSearch,
  type PulseChangelogPageQuery,
} from "./query";

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
  query: PulseChangelogPageQuery;
  hasMore: boolean;
}

export function PulseChangelogFilterClient({
  events,
  countries,
  query,
  hasMore,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const selectedCountry = query.country;
  const selectedDimension = query.dimension;
  const selectedSeverity = query.severity;

  function navigate(next: Partial<PulseChangelogPageQuery>) {
    const nextQuery: PulseChangelogPageQuery = {
      ...query,
      ...next,
      page: next.page ?? 1,
    };
    router.push(`${pathname}${pulseChangelogSearch(nextQuery)}`);
  }

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
                navigate({ country: undefined });
              }}
              active={!selectedCountry}
            >
              All countries
            </FilterChip>
            {selectedCountry ? (
              <FilterChip
                onClick={() => {
                  navigate({ country: undefined });
                }}
                active
              >
                {countries.find((c) => c.slug === selectedCountry)?.name ?? selectedCountry} ✕
              </FilterChip>
            ) : null}
            <select
              className="editorial-filter-select"
              aria-label="Pick a country"
              value={selectedCountry ?? ""}
              onChange={(e) => {
                const next = e.target.value;
                navigate({ country: next === "" ? undefined : next });
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
                navigate({ dimension: undefined });
              }}
              active={!selectedDimension}
            >
              All
            </FilterChip>
            {PULSE_DIMENSIONS.map((d) => (
              <FilterChip
                key={d}
                onClick={() => {
                  navigate({ dimension: d });
                }}
                active={selectedDimension === d}
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
                navigate({ severity: undefined });
              }}
              active={!selectedSeverity}
            >
              Any
            </FilterChip>
            {Object.entries(SEVERITY_TIER_LABELS).map(([key, label]) => (
              <FilterChip
                key={key}
                onClick={() => {
                  navigate({ severity: key });
                }}
                active={selectedSeverity === key}
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
                navigate({ showReview: false });
              }}
              active={!query.showReview}
            >
              Published only
            </FilterChip>
            <FilterChip
              onClick={() => {
                navigate({ showReview: true });
              }}
              active={query.showReview}
            >
              Show review outcomes
            </FilterChip>
          </div>
        </fieldset>
      </div>

      <div className="editorial-results-header-block">
        <span className="editorial-eyebrow">Events</span>
        <h2 className="editorial-results-title">
          {events.length === 0 && query.page === 1
            ? "No events match these filters"
            : `${events.length} event${events.length === 1 ? "" : "s"} on this page`}
        </h2>
        <p className="editorial-results-dek">
          {query.showReview
            ? "Including active review candidates, rejected rows, and retained pre-contract legacy-quarantine rows. Quarantined rows are not human review decisions; none of these rows affects API-only experimental deltas."
            : "Published events only. Toggle status above to include active review, rejection, and legacy-quarantine outcomes."}
        </p>
      </div>

      {events.length === 0 && query.page === 1 ? (
        <p className="editorial-empty">
          No events match.{" "}
          <button
            type="button"
            onClick={() => {
              navigate({
                country: undefined,
                dimension: undefined,
                severity: undefined,
                showReview: false,
              });
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
          {events.map((event) => (
            <PulseEventDetailCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <nav className="editorial-pagination" aria-label="Pagination">
        {query.page > 1 ? (
          <button
            type="button"
            onClick={() => navigate({ page: query.page - 1 })}
            className="editorial-pagination-link"
          >
            ← Page {query.page - 1}
          </button>
        ) : (
          <span>—</span>
        )}
        <span>Page {query.page}</span>
        {hasMore ? (
          <button
            type="button"
            onClick={() => navigate({ page: query.page + 1 })}
            className="editorial-pagination-link"
          >
            Page {query.page + 1} →
          </button>
        ) : (
          <span>—</span>
        )}
      </nav>
    </>
  );
}
