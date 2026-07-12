"use client";

import { useMemo, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import { Reveal } from "@/components/motion/Reveal";
import { PageHero } from "@/components/PageHero";
import { SourceDot } from "@/components/SourceDot";
import { Tooltip, InfoTip } from "@/components/editorial/Tooltip";
import {
  CountrySearchCombobox,
  type CountrySearchOption,
} from "@/components/CountrySearchCombobox";
import { resolvePartyColor } from "@/lib/data/party-colors";
import type { JurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";

interface ElectionRow {
  election: {
    id: string;
    electionDate: string | null;
    electionType: string | null;
    electionName: string | null;
    electoralSystem: string | null;
    turnoutPercent: number | null;
    dateConfidence: string | null;
  };
  jurisdiction: {
    slug: string;
    name: string;
    iso2: string | null;
    continent: string | null;
    status: JurisdictionStatusPresentation;
  };
  audit: {
    dateBasis: "source_confirmed" | "derived_term_projection" | "unknown";
    temporalClass:
      "historical" | "source_dated_upcoming" | "projection_due" | "unknown";
    sourceEventStatus: string;
    evidence: {
      sourceId: string | null;
      retrievedAt: string | null;
      rightsReview: "verified" | "pending" | "unknown";
    };
    fieldEvidence: {
      turnout: {
        sourceId: string;
        retrievedAt: string | null;
      } | null;
      results: {
        sourceId: string;
        retrievedAt: string | null;
      } | null;
    };
  } | null;
}

interface Coverage {
  asOf: string;
  baselineRows: number;
  qualifiedEvents: number;
  quarantinedRows: number;
  legislativeJurisdictions: number;
  presidentialJurisdictions: number;
  turnoutRows: number;
  projectionGroups: number;
  limitedRecognitionJurisdictions: number;
  ipuRightsReview: "verified" | "pending";
  ideaRightsReview: "verified" | "pending";
}

interface RecentElectionRow extends ElectionRow {
  results?: Array<{
    partyName: string | null;
    partyColor: string | null;
    candidateName: string | null;
    votesPercent: number | null;
    seatsWon: number | null;
    isWinner: boolean | null;
  }>;
}

interface Stats {
  qualifiedEvents: number;
  sovereignJurisdictions: number;
  sourceDatedUpcoming: number;
  projectionGroups: number;
}

const REGIONS = [
  "All Regions",
  "Africa",
  "Americas",
  "Asia",
  "Europe",
  "Oceania",
];
const TYPES = ["All Types", "Presidential", "Legislative"];
const REGION_CONTINENTS: Record<string, string[]> = {
  Americas: ["North America", "South America"],
};

const ESTIMATE_NOTE =
  "Civica-computed estimate from the chamber's term length — not a source-confirmed date.";

function matchesRegion(
  continent: string | null,
  regionFilter: string,
): boolean {
  if (regionFilter === "All Regions") return true;
  const acceptedContinents = REGION_CONTINENTS[regionFilter] ?? [regionFilter];
  return continent !== null && acceptedContinents.includes(continent);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Estimated dates are only meaningful to the year; show "Est. 2029". */
function formatEstimate(dateStr: string | null): string {
  if (!dateStr) return "Est. TBD";
  return `Est. ${dateStr.split("-")[0]}`;
}

function electionYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return parseInt(dateStr.split("-")[0], 10);
}

export default function ElectionsClient({
  upcoming,
  recent,
  stats,
  coverage,
  dataAvailable,
}: {
  upcoming: ElectionRow[];
  recent: ElectionRow[];
  stats: Stats | null;
  coverage: Coverage | null;
  dataAvailable: boolean;
}) {
  const [regionFilter, setRegionFilter] = useState("All Regions");
  const [typeFilter, setTypeFilter] = useState("All Types");
  // Country narrowing via the hero typeahead (mirrors the /country landing tab).
  const [countryFilter, setCountryFilter] =
    useState<CountrySearchOption | null>(null);

  // Search options: every distinct country that actually has an election on
  // this page (search never offers a country with nothing to show).
  const searchOptions = useMemo<CountrySearchOption[]>(() => {
    const seen = new Map<string, CountrySearchOption>();
    for (const e of [...upcoming, ...recent]) {
      if (!seen.has(e.jurisdiction.slug)) {
        seen.set(e.jurisdiction.slug, {
          slug: e.jurisdiction.slug,
          name: e.jurisdiction.name,
          iso2: e.jurisdiction.iso2,
          status: e.jurisdiction.status,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [upcoming, recent]);

  function passesFilters(e: ElectionRow): boolean {
    if (countryFilter && e.jurisdiction.slug !== countryFilter.slug)
      return false;
    if (!matchesRegion(e.jurisdiction.continent, regionFilter)) return false;
    if (
      typeFilter !== "All Types" &&
      e.election.electionType?.toLowerCase() !== typeFilter.toLowerCase()
    )
      return false;
    return true;
  }

  const filteredUpcoming = useMemo(
    () => upcoming.filter(passesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upcoming, regionFilter, typeFilter, countryFilter],
  );

  const filteredRecent = useMemo(
    () => recent.filter(passesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recent, regionFilter, typeFilter, countryFilter],
  );

  const filteredSourceDatedCount = filteredUpcoming.filter(
    (row) => row.audit?.temporalClass === "source_dated_upcoming",
  ).length;
  const filteredProjectionCount = filteredUpcoming.filter(
    (row) => row.audit?.temporalClass === "projection_due",
  ).length;

  const recentByYear = useMemo(() => {
    const groups: Record<number, ElectionRow[]> = {};
    for (const e of filteredRecent) {
      const yr = electionYear(e.election.electionDate);
      if (yr) {
        (groups[yr] ??= []).push(e);
      }
    }
    return Object.entries(groups)
      .map(([y, items]) => ({ year: Number(y), items }))
      .sort((a, b) => b.year - a.year);
  }, [filteredRecent]);

  const anyFilterActive =
    countryFilter !== null ||
    regionFilter !== "All Regions" ||
    typeFilter !== "All Types";

  return (
    <>
      {/* Canonical full-bleed page hero (shared PageHero shell) with a centered
          country typeahead — the same CountrySearchCombobox the /country landing
          tab uses. Selecting a country narrows every list below client-side. */}
      <PageHero
        /* PUBLIC_CLAIM: elections.qualified-corpus */
        eyebrow="Elections"
        titleId="elections-hero-title"
        title="National election records, audited row by row."
        description={
          <>
            Latest legislative contests, uneven presidential history, and
            separately labelled term-length projections. Coverage limitations
            and unresolved-row counts remain visible.
          </>
        }
        engraving={{
          src: "/engravings/hero.webp",
          darkSrc: "/engravings/hero-dark.webp",
        }}
        search={
          <CountrySearchCombobox
            countries={searchOptions}
            placeholder="Filter by country&hellip;"
            ariaLabel="Filter elections by country"
            onSelect={(c) => setCountryFilter(c)}
          />
        }
      />

      <div
        className="cv-container"
        style={{
          paddingTop: "var(--space-8)",
          paddingBottom: "var(--spacing-section-y)",
        }}
      >
        {/* Stats — matching Index page pattern. */}
        <Reveal
          as="div"
          amount={0.4}
          className="index-stats-row"
          style={{ marginBottom: "var(--space-7)" }}
        >
          {[
            {
              value: stats?.qualifiedEvents ?? "—",
              label: "Qualified events",
            },
            {
              value: stats?.sovereignJurisdictions ?? "—",
              label: "Sovereign jurisdictions",
            },
            {
              value: stats?.sourceDatedUpcoming ?? "—",
              label: "Source-dated future",
            },
            {
              value: stats?.projectionGroups ?? "—",
              label: "Due-date projections",
            },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ display: "contents" }}>
              <div className="index-stat">
                <span className="index-stat__value">{s.value}</span>
                <span className="index-stat__label">{s.label}</span>
              </div>
              {i < arr.length - 1 && <div className="index-stat-divider" />}
            </div>
          ))}
        </Reveal>

        {/* Explainer link — how electoral systems turn votes into seats */}
        <Reveal
          as="a"
          amount={0.4}
          href="/elections/systems"
          className="elections-explainer-link"
        >
          <span className="elections-explainer-link__body">
            <span className="elections-explainer-link__eyebrow">Explainer</span>
            <span className="elections-explainer-link__title">
              How electoral systems work
            </span>
            <span className="elections-explainer-link__dek">
              First past the post, proportional, mixed-member, ranked choice,
              and two-round — illustrated with sourced country records.
            </span>
          </span>
          <span className="elections-explainer-link__arrow" aria-hidden="true">
            →
          </span>
        </Reveal>

        {/* Filters */}
        <Reveal
          as="div"
          amount={0.4}
          style={{
            display: "flex",
            gap: "var(--space-3)",
            marginBottom: "var(--space-7)",
            flexWrap: "wrap",
            alignItems: "center",
            paddingTop: "var(--space-6)",
            borderTop: "1px solid var(--color-divider)",
          }}
        >
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="cv-select"
            style={{
              minWidth: 140,
              padding: "8px 32px 8px 14px",
              fontSize: "var(--text-12)",
            }}
          >
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="index-continent-chip"
              style={{
                ...(typeFilter === t
                  ? {
                      background: "var(--color-accent)",
                      color: "var(--color-bg)",
                      borderColor: "var(--color-accent)",
                    }
                  : {}),
              }}
            >
              {t}
            </button>
          ))}
          {/* Active country filter shown as a removable chip (mirrors the
              countries page's removable-filter affordance). */}
          {countryFilter && (
            <button
              type="button"
              onClick={() => setCountryFilter(null)}
              className="editorial-chip editorial-chip--accent editorial-chip--active"
              aria-label={`Clear country filter: ${countryFilter.name}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
              }}
            >
              {countryFilter.name}
              <span
                aria-hidden="true"
                style={{ fontSize: "var(--text-15)", lineHeight: 1 }}
              >
                ×
              </span>
            </button>
          )}
        </Reveal>

        {/* Upcoming Elections */}
        {filteredUpcoming.length > 0 && (
          <Reveal
            as="section"
            amount={0.15}
            style={{ marginBottom: "var(--space-8)" }}
          >
            <div className="index-continent-header">
              <h2 className="index-continent-title">
                Future source dates &amp; due-date projections
              </h2>
              <div className="index-continent-meta">
                <span>
                  {filteredSourceDatedCount} source-dated events ·{" "}
                  {filteredProjectionCount} projected events
                </span>
              </div>
            </div>
            <div className="index-card-grid">
              {filteredUpcoming.map((e) => {
                const isEstimated = e.audit?.temporalClass === "projection_due";
                return (
                  <a
                    key={e.election.id}
                    href={`/country/${e.jurisdiction.slug}`}
                    className="index-country-card"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="index-card-top">
                      <CountryFlag iso2={e.jurisdiction.iso2} size={28} />
                      <div className="index-card-name-block">
                        <span className="index-card-name">
                          {e.jurisdiction.name}
                        </span>
                        <span
                          className="index-card-capital"
                          style={{ textTransform: "capitalize" }}
                        >
                          {e.election.electionType} election
                        </span>
                      </div>
                    </div>
                    <div className="index-card-bottom">
                      <div
                        className="index-card-data"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                        }}
                      >
                        {isEstimated ? (
                          // Civica-computed estimate — muted, distinct from a
                          // source-confirmed date, with the mandated InfoTip.
                          <>
                            <span
                              className="index-card-datum"
                              style={{
                                color: "var(--color-text-40)",
                                fontStyle: "italic",
                              }}
                            >
                              {formatEstimate(e.election.electionDate)}
                            </span>
                            <span
                              onClick={(ev) => ev.preventDefault()}
                              style={{ display: "inline-flex" }}
                            >
                              <InfoTip
                                content={ESTIMATE_NOTE}
                                label="About this estimate"
                              />
                            </span>
                            {e.audit?.evidence.sourceId && (
                              <SourceDot
                                source={e.audit.evidence.sourceId}
                                retrievedAt={e.audit.evidence.retrievedAt}
                              />
                            )}
                          </>
                        ) : (
                          <>
                            <span
                              className="index-card-datum"
                              style={{ color: "var(--color-accent)" }}
                            >
                              {formatDate(e.election.electionDate)}
                            </span>
                            {e.audit?.evidence.sourceId && (
                              <SourceDot
                                source={e.audit.evidence.sourceId}
                                retrievedAt={e.audit.evidence.retrievedAt}
                              />
                            )}
                          </>
                        )}
                      </div>
                      {!isEstimated && e.audit?.sourceEventStatus && (
                        <span className="index-card-datum index-card-datum--dim">
                          {e.audit.sourceEventStatus === "tentative"
                            ? "Tentative source date"
                            : e.audit.sourceEventStatus === "source_dated"
                              ? "Source-dated; schedule not independently verified"
                              : e.audit.sourceEventStatus.replaceAll("_", " ")}
                        </span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </Reveal>
        )}
        {filteredUpcoming.length === 0 && (
          <Reveal
            as="section"
            amount={0.15}
            style={{ marginBottom: "var(--space-8)" }}
          >
            <div className="index-continent-header">
              <h2 className="index-continent-title">
                Future source dates &amp; due-date projections
              </h2>
            </div>
            <p className="editorial-empty">
              {!dataAvailable
                ? "Election records are temporarily unavailable."
                : anyFilterActive
                  ? "No qualified future date or term-length projection matches these filters."
                  : "This audited release contains no qualified future date or term-length projection."}
            </p>
          </Reveal>
        )}

        {/* Recent Election Results Timeline — only elections that carry results
            reach this section (query layer), so a card is never an empty box. */}
        <Reveal as="section" amount={0.1}>
          <div className="index-continent-header">
            <h2 className="index-continent-title">Recent Results</h2>
            <div className="index-continent-meta">
              <span hidden={!dataAvailable}>
                {filteredRecent.length} qualified election records
              </span>
              <span hidden={dataAvailable}>Data temporarily unavailable</span>
            </div>
          </div>

          <div style={{ position: "relative", marginTop: "var(--space-3)" }}>
            <div
              style={{
                position: "absolute",
                left: 20,
                top: 0,
                bottom: 0,
                width: 2,
                background: "var(--color-divider)",
              }}
            />

            {recentByYear.map(({ year, items }) => (
              <div key={year}>
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-28)",
                    fontWeight: 400,
                    color: "var(--color-text-20)",
                    paddingLeft: 52,
                    marginBottom: "var(--space-5)",
                    marginTop: "var(--space-3)",
                  }}
                >
                  {year}
                </div>
                {items.map((e) => (
                  <TimelineCard key={e.election.id} election={e} />
                ))}
              </div>
            ))}

            {recentByYear.length === 0 && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-15)",
                  color: "var(--color-text-25)",
                  padding: "40px 0",
                  textAlign: "center",
                }}
              >
                {!dataAvailable
                  ? "Election data is temporarily unavailable."
                  : anyFilterActive
                    ? "No compiled results match the current filters."
                    : "No compiled results yet."}
              </p>
            )}
          </div>
        </Reveal>

        {/* Audited corpus scope and source-rights posture. */}
        <Reveal as="section" amount={0.2} className="elsys-sources">
          {coverage ? (
            <>
              <p>
                <strong>Qualification:</strong> the {coverage.baselineRows}-row
                baseline was audited as of {formatDate(coverage.asOf)}. It
                supports {coverage.qualifiedEvents} conceptual events across{" "}
                {coverage.legislativeJurisdictions} jurisdictions with
                legislative records and {coverage.presidentialJurisdictions}
                with presidential records. {coverage.quarantinedRows} rows are
                withheld for provenance, identity, precision, status, or
                duplication problems. The {coverage.projectionGroups} public
                country/type projections show the earliest estimated due year,
                consolidate overlapping chamber-derived rows, and remain
                separate from source-dated future records.
              </p>
              <p>
                <strong>Sources and rights:</strong> legislative dates and
                qualified party-seat records use{" "}
                <a
                  href="https://data.ipu.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  IPU Parline
                </a>{" "}
                (statement license CC BY-NC-SA 4.0); presidential dates use{" "}
                <a
                  href="https://www.wikidata.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Wikidata
                </a>{" "}
                (CC0); {coverage.turnoutRows} turnout fields use{" "}
                <a
                  href="https://www.idea.int/data-tools/data/voter-turnout-database"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  International IDEA
                </a>{" "}
                (statement license CC BY-NC-SA 4.0). Formal DAT-003 rights
                review remains {coverage.ipuRightsReview} for IPU and{" "}
                {coverage.ideaRightsReview} for IDEA, so their data stays out of
                the public bulk export. Kosovo and Taiwan account for{" "}
                {coverage.limitedRecognitionJurisdictions} limited-recognition
                jurisdiction records and remain outside sovereign-state totals.
              </p>
            </>
          ) : (
            <p>Election qualification metadata is temporarily unavailable.</p>
          )}
        </Reveal>
      </div>
    </>
  );
}

function TimelineCard({ election: e }: { election: ElectionRow }) {
  const [expanded, setExpanded] = useState(true);
  const isLegislative =
    e.election.electionType?.toLowerCase() === "legislative";
  const dotColor = isLegislative
    ? "var(--color-branch-legislative)"
    : "var(--color-branch-executive)";
  const rowSource = e.audit?.evidence.sourceId;
  const rowRetrievedAt = e.audit?.evidence.retrievedAt;

  return (
    <div
      style={{
        position: "relative",
        paddingLeft: 52,
        paddingBottom: "var(--space-7)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 6,
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `2px solid ${dotColor}`,
          background: "var(--color-bg)",
          zIndex: 1,
        }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
        className="cv-card cv-card--interactive"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-4)",
            flexWrap: "wrap",
            gap: "var(--space-3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <CountryFlag iso2={e.jurisdiction.iso2} size={24} />
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-20)",
                fontWeight: 400,
              }}
            >
              {e.jurisdiction.name}
            </span>
          </div>
          <span
            className="gov-badge"
            style={{
              borderRadius: 999,
              padding: "3px 10px",
              background: isLegislative
                ? "var(--color-branch-legislative-bg)"
                : "var(--color-branch-executive-bg)",
              color: dotColor,
            }}
          >
            {e.election.electionType}
          </span>
        </div>

        {/* Meta */}
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-15)",
            color: "var(--color-text-40)",
            display: "flex",
            gap: "var(--space-5)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            {formatDate(e.election.electionDate)}
            {rowSource && (
              <SourceDot source={rowSource} retrievedAt={rowRetrievedAt} />
            )}
          </span>
          {e.election.electoralSystem && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-25)",
                padding: "3px 8px",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {e.election.electoralSystem}
            </span>
          )}
        </div>

        {/* Turnout — quiet stat, tabular numerals, sourced to IDEA. */}
        {e.election.turnoutPercent != null && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-25)",
                textTransform: "uppercase",
                letterSpacing: "var(--tracking-wide)",
                marginBottom: "var(--space-2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                Voter Turnout
                {e.audit?.fieldEvidence.turnout && (
                  <SourceDot
                    source={e.audit.fieldEvidence.turnout.sourceId}
                    retrievedAt={e.audit.fieldEvidence.turnout.retrievedAt}
                  />
                )}
              </span>
              <span
                style={{
                  color: "var(--color-accent)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {e.election.turnoutPercent}%
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: "var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: "var(--radius-sm)",
                  transition: "width 0.6s ease",
                  width: `${e.election.turnoutPercent}%`,
                  background: `linear-gradient(90deg, var(--color-accent), ${dotColor})`,
                }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {expanded &&
          (e as RecentElectionRow).results &&
          (e as RecentElectionRow).results!.length > 0 && (
            <ResultsBar results={(e as RecentElectionRow).results!} />
          )}
      </div>
    </div>
  );
}

function ResultsBar({
  results,
}: {
  results: Array<{
    partyName: string | null;
    partyColor: string | null;
    candidateName: string | null;
    votesPercent: number | null;
    seatsWon: number | null;
    isWinner: boolean | null;
  }>;
}) {
  const usesSeats = results.some((result) => result.seatsWon != null);
  const maxValue = Math.max(
    ...results.map((result) =>
      usesSeats ? (result.seatsWon ?? 0) : (result.votesPercent ?? 0),
    ),
    1,
  );

  return (
    <div style={{ marginTop: "var(--space-5)" }}>
      {results.map((r, i) => {
        const label = r.candidateName || r.partyName || "Unknown";
        // Item 1: reuse the EXACT color source the legislature hemicycle uses
        // (resolvePartyColor → well-known party map → named colors → indexed
        // fallback palette), so result bars are party-colored, not all one hue.
        const barColor = resolvePartyColor(
          r.partyColor,
          r.partyName ?? r.candidateName,
          i,
        );
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-2)",
            }}
          >
            {/* Item 2: the name ellipsizes at 140px; wrap it in the canonical
                instant Tooltip so the full name is always recoverable. */}
            <Tooltip content={label}>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-85)",
                  width: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  cursor: "default",
                  display: "block",
                }}
              >
                {label}
              </span>
            </Tooltip>
            <div
              style={{
                flex: 1,
                height: 16,
                background: "var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: "var(--radius-sm)",
                  transition: "width 0.6s ease",
                  width: `${((usesSeats ? (r.seatsWon ?? 0) : (r.votesPercent ?? 0)) / maxValue) * 100}%`,
                  background: barColor,
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-40)",
                width: 44,
                textAlign: "right",
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {!usesSeats && r.votesPercent != null ? `${r.votesPercent}%` : ""}
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-25)",
                width: 50,
                textAlign: "right",
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.seatsWon != null ? `${r.seatsWon} seats` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
