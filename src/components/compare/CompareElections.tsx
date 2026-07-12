import { CompareColumnHeader } from "./CompareColumnHeader";
import type { getElectionsByJurisdiction } from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { resolvePartyColor } from "@/lib/data/party-colors";
import { getElectionPublicFutureKey } from "@/lib/elections/corpus-audit-runtime";
import { Banner } from "@/components/editorial/Banner";

type ElectionList = Awaited<ReturnType<typeof getElectionsByJurisdiction>>;

export type CompareElectionAvailability =
  | { status: "available"; rows: ElectionList }
  | { status: "temporarily_unavailable" };

export interface CompareElectionsProps {
  countries: Array<{
    jurisdiction: { slug: string; name: string; iso2: string | null };
    electionAvailability: CompareElectionAvailability;
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
    timeZone: "UTC",
  });
}

export function CompareElections({ countries }: CompareElectionsProps) {
  if (countries.length === 0) return null;
  const colCount = countries.length;

  return (
    <>
      <Banner variant="info">
        Election dates are calendar dates. No time of day or source timezone is
        recorded.
      </Banner>
      <div
        className="compare-elections-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
          gap: "var(--space-4)",
        }}
      >
        {countries.map((c) => {
          if (c.electionAvailability.status === "temporarily_unavailable") {
            return (
              <div key={c.jurisdiction.slug} className="compare-elections-col">
                <CompareColumnHeader
                  slug={c.jurisdiction.slug}
                  name={c.jurisdiction.name}
                  iso2={c.jurisdiction.iso2}
                  seriesColor={c.seriesColor}
                />
                <div className="compare-elections-placeholder">
                  Election records are temporarily unavailable.
                </div>
              </div>
            );
          }
          const elections = c.electionAvailability.rows;
          const upcomingByPublicKey = new Map<
            string,
            (typeof elections)[number]
          >();
          const upcomingCandidates = elections
            .filter(
              (e) =>
                e.audit?.primaryRowId === e.election.id &&
                (e.audit.temporalClass === "source_dated_upcoming" ||
                  e.audit.temporalClass === "projection_due"),
            )
            .sort((a, b) =>
              String(a.election.electionDate).localeCompare(
                String(b.election.electionDate),
              ),
            );
          for (const election of upcomingCandidates) {
            const publicKey =
              getElectionPublicFutureKey(election.election.id) ??
              election.election.id;
            if (!upcomingByPublicKey.has(publicKey)) {
              upcomingByPublicKey.set(publicKey, election);
            }
          }
          const upcoming = [...upcomingByPublicKey.values()];
          const historical = elections.filter(
            (e) => e.audit?.temporalClass === "historical",
          );
          const past = historical
            .filter(
              (e) =>
                e.audit?.temporalClass === "historical" && e.results.length > 0,
            )
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
                  <div className="compare-elections-eyebrow">
                    FUTURE DATES &amp; PROJECTIONS
                  </div>
                  {upcoming.slice(0, 2).map((e) => (
                    <div key={e.election.id} className="compare-election-card">
                      <div className="compare-election-title">
                        {e.election.electionName ?? "Election"}
                      </div>
                      <div className="compare-election-sub">
                        {e.audit?.temporalClass === "projection_due"
                          ? `Est. ${String(e.election.electionDate).slice(0, 4)}`
                          : formatDate(e.election.electionDate)}
                        {e.election.electionType
                          ? ` · ${e.election.electionType}`
                          : ""}
                        {e.audit?.temporalClass === "projection_due"
                          ? " · term-length projection"
                          : e.audit?.sourceEventStatus === "tentative"
                            ? " · tentative source date"
                            : " · source-dated; schedule not independently verified"}
                        {e.audit?.evidence.sourceId && (
                          <SourceDot
                            source={e.audit.evidence.sourceId}
                            retrievedAt={e.audit.evidence.retrievedAt}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {upcoming.length === 0 && (
                <div className="compare-elections-placeholder">
                  No qualified future source date or term-length projection.
                </div>
              )}

              {past.length > 0 ? (
                <div className="compare-elections-block">
                  <div className="compare-elections-eyebrow">
                    RECENT QUALIFIED CONTESTS
                  </div>
                  {past.map((e) => {
                    const usesSeats = e.results.some(
                      (result) => result.seatsWon != null,
                    );
                    const maxValue = Math.max(
                      0,
                      ...e.results.map((result) =>
                        Number(
                          usesSeats
                            ? (result.seatsWon ?? 0)
                            : (result.votesPercent ?? 0),
                        ),
                      ),
                    );
                    return (
                      <div
                        key={e.election.id}
                        className="compare-election-card"
                      >
                        <div className="compare-election-title">
                          {e.election.electionName ?? "Election"}
                        </div>
                        <div className="compare-election-sub">
                          <span>
                            {formatDate(e.election.electionDate)}
                            {e.audit?.evidence.sourceId && (
                              <SourceDot
                                source={e.audit.evidence.sourceId}
                                retrievedAt={e.audit.evidence.retrievedAt}
                              />
                            )}
                          </span>
                          {e.election.electionType && (
                            <span>{` · ${e.election.electionType}`}</span>
                          )}
                          {e.election.turnoutPercent != null && (
                            <span>
                              {` · ${Number(e.election.turnoutPercent).toFixed(1)}% turnout`}
                              {e.audit?.fieldEvidence.turnout && (
                                <SourceDot
                                  source={
                                    e.audit.fieldEvidence.turnout.sourceId
                                  }
                                  retrievedAt={
                                    e.audit.fieldEvidence.turnout.retrievedAt
                                  }
                                />
                              )}
                            </span>
                          )}
                        </div>
                        {e.results.length > 0 ? (
                          <div className="compare-election-results">
                            {e.audit?.fieldEvidence.results && (
                              <div className="compare-election-sub">
                                Results{" "}
                                <SourceDot
                                  source={
                                    e.audit.fieldEvidence.results.sourceId
                                  }
                                  retrievedAt={
                                    e.audit.fieldEvidence.results.retrievedAt
                                  }
                                />
                              </div>
                            )}
                            {e.results.slice(0, 3).map((r, resultIndex) => {
                              const value = Number(
                                usesSeats
                                  ? (r.seatsWon ?? 0)
                                  : (r.votesPercent ?? 0),
                              );
                              const widthPct =
                                maxValue > 0
                                  ? Math.round((value / maxValue) * 100)
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
                                        background: resolvePartyColor(
                                          r.partyColor,
                                          r.partyName ?? r.candidateName,
                                          resultIndex,
                                        ),
                                      }}
                                    />
                                  </div>
                                  <div className="compare-election-result-pct">
                                    {usesSeats && r.seatsWon != null
                                      ? `${r.seatsWon} seats`
                                      : value > 0
                                        ? `${value.toFixed(1)}%`
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
              ) : historical.length > 0 ? (
                <div className="compare-elections-placeholder">
                  Qualified historical records exist, but results are not
                  compiled.
                </div>
              ) : (
                <div className="compare-elections-placeholder">
                  No qualified historical election record in this audited
                  release.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
