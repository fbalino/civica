"use client";

export interface ElectionData {
  election: {
    id: string;
    electionDate: string | null;
    electionType: string | null;
    electionName: string | null;
    electoralSystem: string | null;
    turnoutPercent: number | null;
  };
  results: Array<{
    partyName: string | null;
    partyColor: string | null;
    candidateName: string | null;
    votesPercent: number | null;
    seatsWon: number | null;
    isWinner: boolean | null;
  }>;
}

export interface ElectionsTabProps {
  active: boolean;
  countryName: string;
  electionData: ElectionData[];
  electionsLoading: boolean;
}

export function ElectionsTab({
  active,
  electionData,
  electionsLoading,
}: ElectionsTabProps) {
  return (
    <div className={`atlas-pane${active ? " on" : ""}`}>
      {electionsLoading ? (
        <div
          className="atlas-mono"
          style={{
            fontSize: 11,
            color: "var(--atlas-muted)",
            padding: 40,
            textAlign: "center",
          }}
        >
          Loading elections&hellip;
        </div>
      ) : electionData.length === 0 ? (
        <div
          className="atlas-mono"
          style={{
            fontSize: 11,
            color: "var(--atlas-muted)",
            padding: 40,
            textAlign: "center",
          }}
        >
          No election data available yet.
        </div>
      ) : (
        <ElectionsList elections={electionData} />
      )}
    </div>
  );
}

function ElectionsList({ elections }: { elections: ElectionData[] }) {
  const now = new Date();
  const upcoming = elections.filter(
    (e) =>
      e.election.electionDate &&
      new Date(e.election.electionDate + "T00:00:00Z") >= now,
  );
  const past = elections.filter(
    (e) =>
      e.election.electionDate &&
      new Date(e.election.electionDate + "T00:00:00Z") < now,
  );

  function formatDate(d: string | null) {
    if (!d) return "TBD";
    return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  function daysUntil(d: string) {
    return Math.ceil(
      (new Date(d + "T00:00:00Z").getTime() - now.getTime()) / 86400000,
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {upcoming.length > 0 && (
        <div>
          <div
            className="atlas-mono"
            style={{
              fontSize: 10,
              color: "var(--atlas-muted)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Upcoming Elections
          </div>
          {upcoming.map((e) => (
            <div
              key={e.election.id}
              style={{
                border: "1px solid var(--atlas-rule)",
                padding: "14px 16px",
                marginBottom: 8,
                background: "var(--atlas-paper-2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    className="atlas-serif"
                    style={{ fontSize: 17, lineHeight: 1.25 }}
                  >
                    {e.election.electionName ||
                      `${e.election.electionType || "Election"}`}
                  </div>
                  <div
                    className="atlas-mono"
                    style={{
                      fontSize: 11,
                      color: "var(--atlas-muted)",
                      marginTop: 4,
                    }}
                  >
                    {formatDate(e.election.electionDate)}
                  </div>
                </div>
                {e.election.electionDate && (
                  <span
                    className="atlas-mono"
                    style={{
                      fontSize: 10,
                      color: "var(--atlas-accent)",
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      border: "1px solid var(--atlas-accent)",
                      padding: "2px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {daysUntil(e.election.electionDate)}d
                  </span>
                )}
              </div>
              {e.election.electoralSystem && (
                <div
                  className="atlas-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--atlas-muted)",
                    marginTop: 6,
                  }}
                >
                  {e.election.electoralSystem}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div
            className="atlas-mono"
            style={{
              fontSize: 10,
              color: "var(--atlas-muted)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Past Elections
          </div>
          {past.map((e) => (
            <div
              key={e.election.id}
              style={{
                border: "1px solid var(--atlas-rule)",
                padding: "14px 16px",
                marginBottom: 8,
              }}
            >
              <div
                className="atlas-serif"
                style={{ fontSize: 17, lineHeight: 1.25 }}
              >
                {e.election.electionName ||
                  `${e.election.electionType || "Election"}`}
              </div>
              <div
                className="atlas-mono"
                style={{
                  fontSize: 11,
                  color: "var(--atlas-muted)",
                  marginTop: 4,
                }}
              >
                {formatDate(e.election.electionDate)}
                {e.election.turnoutPercent != null &&
                  ` · ${e.election.turnoutPercent.toFixed(1)}% turnout`}
              </div>
              {e.results && e.results.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      height: 8,
                      borderRadius: 4,
                      overflow: "hidden",
                      gap: 1,
                    }}
                  >
                    {e.results
                      .filter((r) => r.votesPercent != null)
                      .map((r, i) => (
                        <div
                          key={i}
                          style={{
                            flex: r.votesPercent!,
                            background:
                              r.partyColor || "var(--atlas-muted)",
                            minWidth: 2,
                          }}
                          title={`${r.partyName}: ${r.votesPercent?.toFixed(1)}%`}
                        />
                      ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px 12px",
                      marginTop: 8,
                    }}
                  >
                    {e.results.slice(0, 5).map((r, i) => (
                      <div
                        key={i}
                        className="atlas-mono"
                        style={{
                          fontSize: 10,
                          color: "var(--atlas-ink-2)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: r.partyColor || "var(--atlas-muted)",
                          }}
                        />
                        {r.partyName || r.candidateName || "Unknown"}
                        {r.votesPercent != null && (
                          <span style={{ color: "var(--atlas-muted)" }}>
                            {r.votesPercent.toFixed(1)}%
                          </span>
                        )}
                        {r.isWinner && (
                          <span style={{ color: "var(--atlas-accent)" }}>
                            ✓
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <a
        href="/elections"
        className="atlas-mono"
        style={{
          fontSize: 11,
          color: "var(--atlas-accent)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        View all elections &rarr;
      </a>
    </div>
  );
}
