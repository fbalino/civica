import { CompareColumnHeader } from "./CompareColumnHeader";
import type { getElectionsByJurisdiction } from "@/lib/db/queries";

type ElectionList = Awaited<ReturnType<typeof getElectionsByJurisdiction>>;

export interface CompareElectionsProps {
  countries: Array<{
    jurisdiction: { slug: string; name: string; iso2: string | null };
    elections: ElectionList;
    seriesColor: string;
  }>;
}

function formatDate(iso: string | Date | null): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isUpcoming(date: string | Date | null): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getTime() >= Date.now();
}

export function CompareElections({ countries }: CompareElectionsProps) {
  if (countries.length === 0) return null;
  const colCount = countries.length;

  return (
    <div
      className="compare-elections-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
        gap: 16,
      }}
    >
      {countries.map((c) => {
        const upcoming = c.elections.filter((e) => isUpcoming(e.election.electionDate));
        const past = c.elections
          .filter((e) => !isUpcoming(e.election.electionDate))
          .slice(0, 3);

        return (
          <div key={c.jurisdiction.slug} className="compare-elections-col">
            <CompareColumnHeader
              slug={c.jurisdiction.slug}
              name={c.jurisdiction.name}
              iso2={c.jurisdiction.iso2}
              seriesColor={c.seriesColor}
            />

            {upcoming.length > 0 && (
              <div className="compare-elections-block">
                <div className="compare-elections-eyebrow">UPCOMING</div>
                {upcoming.slice(0, 2).map((e) => (
                  <div key={e.election.id} className="compare-election-card">
                    <div className="compare-election-title">
                      {e.election.electionName ?? "Election"}
                    </div>
                    <div className="compare-election-sub">
                      {formatDate(e.election.electionDate)}
                      {e.election.electionType
                        ? ` · ${e.election.electionType}`
                        : ""}
                    </div>
                    {e.election.electoralSystem && (
                      <div className="compare-election-system">
                        {e.election.electoralSystem}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {past.length > 0 ? (
              <div className="compare-elections-block">
                <div className="compare-elections-eyebrow">RECENT RESULTS</div>
                {past.map((e) => {
                  const maxPct = Math.max(
                    0,
                    ...e.results.map((r) => Number(r.votesPercent ?? 0))
                  );
                  return (
                    <div key={e.election.id} className="compare-election-card">
                      <div className="compare-election-title">
                        {e.election.electionName ?? "Election"}
                      </div>
                      <div className="compare-election-sub">
                        {formatDate(e.election.electionDate)}
                        {e.election.electionType
                          ? ` · ${e.election.electionType}`
                          : ""}
                        {e.election.turnoutPercent
                          ? ` · ${Number(e.election.turnoutPercent).toFixed(1)}% turnout`
                          : ""}
                      </div>
                      {e.results.length > 0 ? (
                        <div className="compare-election-results">
                          {e.results.slice(0, 3).map((r) => {
                            const pct = Number(r.votesPercent ?? 0);
                            const widthPct = maxPct > 0
                              ? Math.round((pct / maxPct) * 100)
                              : 0;
                            return (
                              <div
                                key={r.id}
                                className="compare-election-result-row"
                              >
                                <div className="compare-election-result-name">
                                  {r.partyName}
                                  {r.isWinner && (
                                    <span className="compare-election-winner">
                                      ★
                                    </span>
                                  )}
                                </div>
                                <div className="compare-election-result-bar">
                                  <span
                                    style={{
                                      width: `${widthPct}%`,
                                      background: r.partyColor ?? "#888",
                                    }}
                                  />
                                </div>
                                <div className="compare-election-result-pct">
                                  {pct > 0
                                    ? `${pct.toFixed(1)}%`
                                    : r.seatsWon
                                      ? `${r.seatsWon} seats`
                                      : "—"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="compare-election-noresults">
                          Results not yet recorded
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              upcoming.length === 0 && (
                <div className="compare-elections-placeholder">
                  No election data available
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
