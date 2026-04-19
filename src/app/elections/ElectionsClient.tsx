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
    <div style={{ maxWidth: "var(--max-w-content)", margin: "0 auto", padding: "40px var(--spacing-page-x)" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-52)", fontWeight: 400, letterSpacing: "var(--tracking-tighter)", marginBottom: 8, lineHeight: "var(--leading-tight)" }}>
        Elections
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-25)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", marginBottom: 32 }}>
        Track upcoming and past elections worldwide. Turnout data from IDEA. Results from Wikidata and official sources.
      </p>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "var(--color-divider)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: 32 }}>
        {[
          { value: stats.electionsThisYear || "—", label: `Elections in ${new Date().getFullYear()}` },
          { value: stats.upcomingCount || "—", label: "Upcoming" },
          { value: stats.avgTurnout ? `${stats.avgTurnout}%` : "—", label: "Avg Global Turnout" },
          { value: stats.totalElections.toLocaleString() || "—", label: "Total Elections Tracked" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--color-surface-elevated)", padding: 20, textAlign: "center" }}>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-32)", fontWeight: 400, color: "var(--color-accent)", display: "block" }}>
              {s.value}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", color: "var(--color-text-25)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", marginTop: 4, display: "block" }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          style={{
            background: "var(--color-surface-elevated)", border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-sm)", padding: "8px 32px 8px 14px",
            fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)",
            color: "var(--color-text-primary)", outline: "none", cursor: "pointer",
            appearance: "none", WebkitAppearance: "none",
          }}
        >
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)",
              padding: "5px 12px", borderRadius: 999,
              border: `1px solid ${typeFilter === t ? "var(--color-accent)" : "var(--color-card-border)"}`,
              background: typeFilter === t ? "var(--color-selection)" : "var(--color-surface-elevated)",
              color: typeFilter === t ? "var(--color-accent)" : "var(--color-text-40)",
              cursor: "pointer", transition: "all 0.15s", letterSpacing: "var(--tracking-wide)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Upcoming Elections */}
      {filteredUpcoming.length > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--color-text-20)", marginBottom: 16 }}>
            Upcoming Elections
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 1, background: "var(--color-divider)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: 40 }}>
            {filteredUpcoming.map((e) => {
              const days = e.election.electionDate ? daysUntil(e.election.electionDate) : null;
              return (
                <a
                  key={e.election.id}
                  href={`/countries/${e.jurisdiction.slug}`}
                  style={{ background: "var(--color-surface-elevated)", padding: 20, display: "flex", flexDirection: "column", gap: 8, textDecoration: "none", color: "inherit", transition: "background 0.15s" }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--color-selection)")}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = "var(--color-surface-elevated)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CountryFlag iso2={e.jurisdiction.iso2} size={24} />
                    <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-18)", fontWeight: 400 }}>
                      {e.jurisdiction.name}
                    </span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", color: "var(--color-text-25)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
                    {e.election.electionType} election
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-accent)" }}>
                    {formatDate(e.election.electionDate)}
                  </span>
                  {days !== null && days > 0 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-branch-executive)" }}>
                      {days} {days === 1 ? "day" : "days"} away
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </>
      )}

      {/* Recent Election Results Timeline */}
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--color-text-20)", marginBottom: 16 }}>
        Recent Election Results
      </div>
      <div style={{ position: "relative", marginBottom: 40 }}>
        {/* Timeline line */}
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
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-25)", padding: "40px 0", textAlign: "center", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase" }}>
            No election results match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineCard({ election: e }: { election: ElectionRow }) {
  const [expanded, setExpanded] = useState(true);
  const isLegislative = e.election.electionType === "legislative";
  const dotColor = isLegislative ? "var(--color-branch-legislative)" : "var(--color-branch-executive)";

  return (
    <div style={{ position: "relative", paddingLeft: 52, paddingBottom: 32 }}>
      {/* Dot */}
      <div style={{
        position: "absolute", left: 14, top: 6, width: 14, height: 14,
        borderRadius: "50%", border: `2px solid ${dotColor}`, background: "var(--color-bg)", zIndex: 1,
      }} />

      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "var(--color-surface-elevated)", border: "1px solid var(--color-card-border)",
          borderRadius: "var(--radius-md)", padding: 20, cursor: "pointer",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(ev) => (ev.currentTarget.style.borderColor = "var(--color-accent)")}
        onMouseLeave={(ev) => (ev.currentTarget.style.borderColor = "var(--color-card-border)")}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CountryFlag iso2={e.jurisdiction.iso2} size={24} />
            <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-20)", fontWeight: 400 }}>
              {e.jurisdiction.name}
            </span>
          </div>
          <span style={{
            fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)",
            letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", padding: "3px 10px",
            borderRadius: 999,
            background: isLegislative ? "rgba(78, 139, 212, 0.15)" : "rgba(212, 118, 78, 0.15)",
            color: dotColor,
          }}>
            {e.election.electionType}
          </span>
        </div>

        {/* Meta */}
        <div style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-25)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span>{formatDate(e.election.electionDate)}</span>
          {e.election.electoralSystem && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
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

        {/* Results (fetched inline from recent data) */}
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
            fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)",
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
