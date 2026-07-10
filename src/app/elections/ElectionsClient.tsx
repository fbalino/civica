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
  };
}

interface Coverage {
  legislativeJurisdictions: number;
  presidentialJurisdictions: number;
  turnoutJurisdictions: number;
  estimatedJurisdictions: number;
  ipuRetrievedAt: string | null;
  wikidataRetrievedAt: string | null;
  ideaRetrievedAt: string | null;
}

/**
 * Which source produced a row's date, per the field-by-field authority model
 * (resolution §3): legislative dates come from IPU Parline; presidential dates
 * from Wikidata. Everything else (referendum/local/general legacy rows) is
 * attributed to Wikidata, its broader identity/date spine.
 */
function sourceForType(electionType: string | null): "ipu_parline" | "wikidata" {
  return electionType?.toLowerCase() === "legislative" ? "ipu_parline" : "wikidata";
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
  totalElections: number;
  upcomingCount: number;
  avgTurnout: number;
  electionsThisYear: number;
}

const REGIONS = ["All Regions", "Africa", "Americas", "Asia", "Europe", "Oceania"];
const TYPES = ["All Types", "Presidential", "Legislative", "Referendum", "Local"];
const REGION_CONTINENTS: Record<string, string[]> = {
  Americas: ["North America", "South America"],
};

const ESTIMATE_NOTE =
  "Civica-computed estimate from the chamber's term length — not a source-confirmed date.";

function matchesRegion(continent: string | null, regionFilter: string): boolean {
  if (regionFilter === "All Regions") return true;
  const acceptedContinents = REGION_CONTINENTS[regionFilter] ?? [regionFilter];
  return continent !== null && acceptedContinents.includes(continent);
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00Z");
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
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
  const [countryFilter, setCountryFilter] = useState<CountrySearchOption | null>(
    null,
  );

  const ipuRetrievedAt = coverage?.ipuRetrievedAt ?? null;
  const wikidataRetrievedAt = coverage?.wikidataRetrievedAt ?? null;
  const ideaRetrievedAt = coverage?.ideaRetrievedAt ?? null;

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
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [upcoming, recent]);

  function passesFilters(e: ElectionRow): boolean {
    if (countryFilter && e.jurisdiction.slug !== countryFilter.slug) return false;
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
        eyebrow="Elections"
        titleId="elections-hero-title"
        title="Elections, tracked worldwide."
        description={
          <>
            A worldwide election calendar: legislative dates and party seat
            results from IPU Parline, and presidential elections from Wikidata.
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

      <div className="cv-container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--spacing-section-y)" }}>
        {/* Stats — matching Index page pattern. */}
        <Reveal as="div" amount={0.4} className="index-stats-row" style={{ marginBottom: "var(--space-7)" }}>
          {[
            { value: stats?.electionsThisYear ?? "—", label: `Elections in ${new Date().getFullYear()}` },
            { value: stats?.upcomingCount ?? "—", label: "Upcoming" },
            { value: stats?.avgTurnout != null ? `${stats.avgTurnout}%` : "—", label: "Avg Turnout" },
            { value: stats?.totalElections != null ? stats.totalElections.toLocaleString() : "—", label: "Total Tracked" },
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
        <Reveal as="a" amount={0.4} href="/elections/systems" className="elections-explainer-link">
          <span className="elections-explainer-link__body">
            <span className="elections-explainer-link__eyebrow">Explainer</span>
            <span className="elections-explainer-link__title">
              How electoral systems work
            </span>
            <span className="elections-explainer-link__dek">
              First past the post, proportional, mixed-member, ranked choice, and
              two-round — with real per-country data from IPU Parline.
            </span>
          </span>
          <span className="elections-explainer-link__arrow" aria-hidden="true">→</span>
        </Reveal>

        {/* Filters */}
        <Reveal as="div" amount={0.4} style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-7)", flexWrap: "wrap", alignItems: "center", paddingTop: "var(--space-6)", borderTop: "1px solid var(--color-divider)" }}>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="cv-select"
            style={{ minWidth: 140, padding: "8px 32px 8px 14px", fontSize: "var(--text-12)" }}
          >
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="index-continent-chip"
              style={{
                ...(typeFilter === t ? {
                  background: "var(--color-accent)",
                  color: "var(--color-bg)",
                  borderColor: "var(--color-accent)",
                } : {}),
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
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}
            >
              {countryFilter.name}
              <span aria-hidden="true" style={{ fontSize: "var(--text-15)", lineHeight: 1 }}>×</span>
            </button>
          )}
        </Reveal>

        {/* Upcoming Elections */}
        {filteredUpcoming.length > 0 && (
          <Reveal as="section" amount={0.15} style={{ marginBottom: "var(--space-8)" }}>
            <div className="index-continent-header">
              <h2 className="index-continent-title">Upcoming Elections</h2>
              <div className="index-continent-meta">
                <span>{filteredUpcoming.length} elections</span>
              </div>
            </div>
            <div className="index-card-grid">
              {filteredUpcoming.map((e) => {
                const isEstimated = e.election.dateConfidence === "estimated";
                const days = e.election.electionDate ? daysUntil(e.election.electionDate) : null;
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
                        <span className="index-card-name">{e.jurisdiction.name}</span>
                        <span className="index-card-capital" style={{ textTransform: "capitalize" }}>
                          {e.election.electionType} election
                        </span>
                      </div>
                    </div>
                    <div className="index-card-bottom">
                      <div
                        className="index-card-data"
                        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
                      >
                        {isEstimated ? (
                          // Civica-computed estimate — muted, distinct from a
                          // source-confirmed date, with the mandated InfoTip.
                          <>
                            <span
                              className="index-card-datum"
                              style={{ color: "var(--color-text-40)", fontStyle: "italic" }}
                            >
                              {formatEstimate(e.election.electionDate)}
                            </span>
                            <span onClick={(ev) => ev.preventDefault()} style={{ display: "inline-flex" }}>
                              <InfoTip content={ESTIMATE_NOTE} label="About this estimate" />
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="index-card-datum" style={{ color: "var(--color-accent)" }}>
                              {formatDate(e.election.electionDate)}
                            </span>
                            <SourceDot
                              source={sourceForType(e.election.electionType)}
                              retrievedAt={
                                sourceForType(e.election.electionType) === "ipu_parline"
                                  ? ipuRetrievedAt
                                  : wikidataRetrievedAt
                              }
                            />
                          </>
                        )}
                      </div>
                      {!isEstimated && days !== null && days > 0 && (
                        <span className="index-card-datum index-card-datum--dim">
                          {days}d away
                        </span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* Recent Election Results Timeline — only elections that carry results
            reach this section (query layer), so a card is never an empty box. */}
        <Reveal as="section" amount={0.1}>
          <div className="index-continent-header">
            <h2 className="index-continent-title">Recent Results</h2>
            <div className="index-continent-meta">
              <span>
                {dataAvailable
                  ? `${filteredRecent.length} elections`
                  : "Data temporarily unavailable"}
              </span>
            </div>
          </div>

          <div style={{ position: "relative", marginTop: "var(--space-3)" }}>
            <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 2, background: "var(--color-divider)" }} />

            {recentByYear.map(({ year, items }) => (
              <div key={year}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-28)", fontWeight: 400, color: "var(--color-text-20)", paddingLeft: 52, marginBottom: "var(--space-5)", marginTop: "var(--space-3)" }}>
                  {year}
                </div>
                {items.map((e) => (
                  <TimelineCard
                    key={e.election.id}
                    election={e}
                    ipuRetrievedAt={ipuRetrievedAt}
                    wikidataRetrievedAt={wikidataRetrievedAt}
                    ideaRetrievedAt={ideaRetrievedAt}
                  />
                ))}
              </div>
            ))}

            {recentByYear.length === 0 && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-15)", color: "var(--color-text-25)", padding: "40px 0", textAlign: "center" }}>
                {!dataAvailable
                  ? "Election data is temporarily unavailable."
                  : anyFilterActive
                  ? "No compiled results match the current filters."
                  : "No compiled results yet."}
              </p>
            )}
          </div>
        </Reveal>

        {/* Sources — quiet foot-of-page note (the elsys-sources register the
            sibling /elections/systems page uses). Numbers are live-from-DB. */}
        <Reveal as="section" amount={0.2} className="elsys-sources">
          {coverage ? (
            <p>
              <strong>Sources:</strong> legislative election dates, electoral
              systems, and party seat results for{" "}
              {coverage.legislativeJurisdictions} national parliaments come from{" "}
              <a href="https://data.ipu.org/" target="_blank" rel="noopener noreferrer">
                IPU Parline
              </a>{" "}
              (CC BY-NC-SA 4.0); presidential elections for{" "}
              {coverage.presidentialJurisdictions} countries come from{" "}
              <a href="https://www.wikidata.org/" target="_blank" rel="noopener noreferrer">
                Wikidata
              </a>{" "}
              (CC0); voter turnout for {coverage.turnoutJurisdictions} elections
              comes from{" "}
              <a
                href="https://www.idea.int/data-tools/data/voter-turnout-database"
                target="_blank"
                rel="noopener noreferrer"
              >
                International IDEA
              </a>{" "}
              (CC BY-NC-SA 4.0). Estimated next-election dates are Civica
              projections from each chamber&rsquo;s term length, not
              source-confirmed dates.
            </p>
          ) : (
            <p>
              <strong>Sources:</strong> legislative election dates, electoral
              systems, and party seat results come from{" "}
              <a href="https://data.ipu.org/" target="_blank" rel="noopener noreferrer">
                IPU Parline
              </a>{" "}
              (CC BY-NC-SA 4.0); presidential elections come from{" "}
              <a href="https://www.wikidata.org/" target="_blank" rel="noopener noreferrer">
                Wikidata
              </a>{" "}
              (CC0); voter turnout comes from{" "}
              <a
                href="https://www.idea.int/data-tools/data/voter-turnout-database"
                target="_blank"
                rel="noopener noreferrer"
              >
                International IDEA
              </a>{" "}
              (CC BY-NC-SA 4.0). Estimated next-election dates are Civica
              projections from each chamber&rsquo;s term length, not
              source-confirmed dates.
            </p>
          )}
        </Reveal>
      </div>
    </>
  );
}

function TimelineCard({
  election: e,
  ipuRetrievedAt,
  wikidataRetrievedAt,
  ideaRetrievedAt,
}: {
  election: ElectionRow;
  ipuRetrievedAt: string | null;
  wikidataRetrievedAt: string | null;
  ideaRetrievedAt: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const isLegislative = e.election.electionType?.toLowerCase() === "legislative";
  const dotColor = isLegislative ? "var(--color-branch-legislative)" : "var(--color-branch-executive)";
  const rowSource = sourceForType(e.election.electionType);
  const rowRetrievedAt = rowSource === "ipu_parline" ? ipuRetrievedAt : wikidataRetrievedAt;

  return (
    <div style={{ position: "relative", paddingLeft: 52, paddingBottom: "var(--space-7)" }}>
      <div style={{
        position: "absolute", left: 14, top: 6, width: 14, height: 14,
        borderRadius: "50%", border: `2px solid ${dotColor}`, background: "var(--color-bg)", zIndex: 1,
      }} />

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <CountryFlag iso2={e.jurisdiction.iso2} size={24} />
            <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-20)", fontWeight: 400 }}>
              {e.jurisdiction.name}
            </span>
          </div>
          <span className="gov-badge" style={{
            borderRadius: 999,
            padding: "3px 10px",
            background: isLegislative ? "var(--color-branch-legislative-bg)" : "var(--color-branch-executive-bg)",
            color: dotColor,
          }}>
            {e.election.electionType}
          </span>
        </div>

        {/* Meta */}
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-15)", color: "var(--color-text-40)", display: "flex", gap: "var(--space-5)", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            {formatDate(e.election.electionDate)}
            <SourceDot source={rowSource} retrievedAt={rowRetrievedAt} />
          </span>
          {e.election.electoralSystem && (
            <span style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-12)", color: "var(--color-text-25)",
              padding: "3px 8px", border: "1px solid var(--color-card-border)",
              borderRadius: "var(--radius-sm)",
            }}>
              {e.election.electoralSystem}
            </span>
          )}
        </div>

        {/* Turnout — quiet stat, tabular numerals, sourced to IDEA. */}
        {e.election.turnoutPercent != null && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-12)", color: "var(--color-text-25)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                Voter Turnout
                <SourceDot source="international_idea" retrievedAt={ideaRetrievedAt} />
              </span>
              <span style={{ color: "var(--color-accent)", fontVariantNumeric: "tabular-nums" }}>{e.election.turnoutPercent}%</span>
            </div>
            <div style={{ height: 8, background: "var(--color-card-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "var(--radius-sm)", transition: "width 0.6s ease",
                width: `${e.election.turnoutPercent}%`,
                background: `linear-gradient(90deg, var(--color-accent), ${dotColor})`,
              }} />
            </div>
          </div>
        )}

        {/* Results */}
        {expanded && (e as RecentElectionRow).results && (e as RecentElectionRow).results!.length > 0 && (
          <ResultsBar results={(e as RecentElectionRow).results!} />
        )}
      </div>
    </div>
  );
}

function ResultsBar({ results }: {
  results: Array<{
    partyName: string | null;
    partyColor: string | null;
    candidateName: string | null;
    votesPercent: number | null;
    seatsWon: number | null;
    isWinner: boolean | null;
  }>;
}) {
  const maxPct = Math.max(...results.map((r) => r.votesPercent ?? 0), 1);

  return (
    <div style={{ marginTop: "var(--space-5)" }}>
      {results.map((r, i) => {
        const label = r.candidateName || r.partyName || "Unknown";
        // Item 1: reuse the EXACT color source the legislature hemicycle uses
        // (resolvePartyColor → well-known party map → named colors → indexed
        // fallback palette), so result bars are party-colored, not all one hue.
        const barColor = resolvePartyColor(r.partyColor, r.partyName ?? r.candidateName, i);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
            {/* Item 2: the name ellipsizes at 140px; wrap it in the canonical
                instant Tooltip so the full name is always recoverable. */}
            <Tooltip content={label}>
              <span style={{
                fontFamily: "var(--font-body)", fontSize: "var(--text-14)",
                color: "var(--color-text-85)", width: 140, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", flexShrink: 0, cursor: "default", display: "block",
              }}>
                {label}
              </span>
            </Tooltip>
            <div style={{ flex: 1, height: 16, background: "var(--color-card-border)", borderRadius: "var(--radius-sm)", overflow: "hidden", position: "relative" }}>
              <div style={{
                height: "100%", borderRadius: "var(--radius-sm)", transition: "width 0.6s ease",
                width: `${((r.votesPercent ?? 0) / maxPct) * 100}%`,
                background: barColor,
              }} />
            </div>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-12)", color: "var(--color-text-40)", width: 44, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
              {r.votesPercent != null ? `${r.votesPercent}%` : "—"}
            </span>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-12)", color: "var(--color-text-25)", width: 50, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
              {r.seatsWon != null ? `${r.seatsWon} seats` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
