"use client";

import { useState, useMemo } from "react";
import { CountryFlag } from "@/components/CountryFlag";

interface ElectionRow {
  election: {
    id: string;
    electionDate: string | null;
    electionType: string | null;
    electionName: string | null;
    electoralSystem: string | null;
    turnoutPercent: number | null;
  };
  jurisdiction: {
    slug: string;
    name: string;
    iso2: string | null;
    continent: string | null;
  };
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

function electionYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return parseInt(dateStr.split("-")[0], 10);
}

export default function ElectionsClient({
  upcoming,
  recent,
  stats,
}: {
  upcoming: ElectionRow[];
  recent: ElectionRow[];
  stats: Stats;
}) {
  const [regionFilter, setRegionFilter] = useState("All Regions");
  const [typeFilter, setTypeFilter] = useState("All Types");

  const filteredUpcoming = useMemo(() => {
    return upcoming.filter((e) => {
      if (regionFilter !== "All Regions" && e.jurisdiction.continent !== regionFilter) return false;
      if (typeFilter !== "All Types" && e.election.electionType?.toLowerCase() !== typeFilter.toLowerCase()) return false;
      return true;
    });
  }, [upcoming, regionFilter, typeFilter]);

  const filteredRecent = useMemo(() => {
    return recent.filter((e) => {
      if (regionFilter !== "All Regions" && e.jurisdiction.continent !== regionFilter) return false;
      if (typeFilter !== "All Types" && e.election.electionType?.toLowerCase() !== typeFilter.toLowerCase()) return false;
      return true;
    });
  }, [recent, regionFilter, typeFilter]);

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

  return (
    <div className="cv-container" style={{ paddingTop: "var(--spacing-hero-top)", paddingBottom: "var(--spacing-section-y)" }}>
      {/* Hero */}
      <h1 className="hero-heading">Elections</h1>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-16)", color: "var(--color-text-40)", marginBottom: 32 }}>
        Track upcoming and past elections worldwide. Turnout data from IDEA. Results from Wikidata and official sources.
      </p>

      {/* Stats — matching Index page pattern */}
      <div className="index-stats-row" style={{ marginBottom: 32 }}>
        {[
          { value: stats.electionsThisYear || "—", label: `Elections in ${new Date().getFullYear()}` },
          { value: stats.upcomingCount || "—", label: "Upcoming" },
          { value: stats.avgTurnout ? `${stats.avgTurnout}%` : "—", label: "Avg Turnout" },
          { value: stats.totalElections.toLocaleString() || "—", label: "Total Tracked" },
        ].map((s, i, arr) => (
          <div key={s.label} style={{ display: "contents" }}>
            <div className="index-stat">
              <span className="index-stat__value">{s.value}</span>
              <span className="index-stat__label">{s.label}</span>
            </div>
            {i < arr.length - 1 && <div className="index-stat-divider" />}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap", alignItems: "center", paddingTop: 24, borderTop: "1px solid var(--color-divider)" }}>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="cv-select"
          style={{ minWidth: 140, padding: "8px 32px 8px 14px", fontSize: "var(--text-11)" }}
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
      </div>

      {/* Upcoming Elections */}
      {filteredUpcoming.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div className="index-continent-header">
            <h2 className="index-continent-title">Upcoming Elections</h2>
            <div className="index-continent-meta">
              <span>{filteredUpcoming.length} elections</span>
            </div>
          </div>
          <div className="index-card-grid">
            {filteredUpcoming.map((e) => {
              const days = e.election.electionDate ? daysUntil(e.election.electionDate) : null;
              return (
                <a
                  key={e.election.id}
                  href={`/countries/${e.jurisdiction.slug}`}
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
                    <div className="index-card-data">
                      <span className="index-card-datum" style={{ color: "var(--color-accent)" }}>
                        {formatDate(e.election.electionDate)}
                      </span>
                    </div>
                    {days !== null && days > 0 && (
                      <span className="index-card-datum index-card-datum--dim">
                        {days}d away
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent Election Results Timeline */}
      <section>
        <div className="index-continent-header">
          <h2 className="index-continent-title">Recent Results</h2>
          <div className="index-continent-meta">
            <span>{filteredRecent.length} elections</span>
          </div>
        </div>

        <div style={{ position: "relative", marginTop: 8 }}>
          <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 2, background: "var(--color-divider)" }} />

          {recentByYear.map(({ year, items }) => (
            <div key={year}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-28)", fontWeight: 400, color: "var(--color-text-20)", paddingLeft: 52, marginBottom: 16, marginTop: 8 }}>
                {year}
              </div>
              {items.map((e) => (
                <TimelineCard key={e.election.id} election={e} />
              ))}
            </div>
          ))}

          {recentByYear.length === 0 && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-14)", color: "var(--color-text-25)", padding: "40px 0", textAlign: "center" }}>
              No election results match the current filters.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function TimelineCard({ election: e }: { election: ElectionRow }) {
  const [expanded, setExpanded] = useState(true);
  const isLegislative = e.election.electionType === "legislative";
  const dotColor = isLegislative ? "var(--color-branch-legislative)" : "var(--color-branch-executive)";

  return (
    <div style={{ position: "relative", paddingLeft: 52, paddingBottom: 32 }}>
      <div style={{
        position: "absolute", left: 14, top: 6, width: 14, height: 14,
        borderRadius: "50%", border: `2px solid ${dotColor}`, background: "var(--color-bg)", zIndex: 1,
      }} />

      <div
        onClick={() => setExpanded(!expanded)}
        className="cv-card cv-card--interactive"
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-14)", color: "var(--color-text-40)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span>{formatDate(e.election.electionDate)}</span>
          {e.election.electoralSystem && (
            <span style={{
              fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-10)", color: "var(--color-text-25)",
              padding: "3px 8px", border: "1px solid var(--color-card-border)",
              borderRadius: "var(--radius-sm)",
            }}>
              {e.election.electoralSystem}
            </span>
          )}
        </div>

        {/* Turnout */}
        {e.election.turnoutPercent && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", color: "var(--color-text-25)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>Voter Turnout</span>
              <span style={{ color: "var(--color-accent)" }}>{e.election.turnoutPercent}%</span>
            </div>
            <div style={{ height: 8, background: "var(--color-card-border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4, transition: "width 0.6s ease",
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
    <div style={{ marginTop: 16 }}>
      {results.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{
            fontFamily: "var(--font-body)", fontSize: "var(--text-13)",
            color: "var(--color-text-85)", width: 140, overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {r.candidateName || r.partyName || "Unknown"}
          </span>
          <div style={{ flex: 1, height: 16, background: "var(--color-card-border)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
            <div style={{
              height: "100%", borderRadius: 3, transition: "width 0.6s ease",
              width: `${((r.votesPercent ?? 0) / maxPct) * 100}%`,
              background: r.partyColor || "var(--color-accent)",
            }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-40)", width: 44, textAlign: "right", flexShrink: 0 }}>
            {r.votesPercent != null ? `${r.votesPercent}%` : "—"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", color: "var(--color-text-25)", width: 50, textAlign: "right", flexShrink: 0 }}>
            {r.seatsWon != null ? `${r.seatsWon} seats` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
