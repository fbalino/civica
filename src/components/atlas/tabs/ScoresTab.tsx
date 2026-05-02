"use client";

import type { Country } from "../data";
import type { DemocracyData } from "../AtlasCountryCenter";
import type { ScoreRow } from "@/lib/db/queries-scores";
import { ScoresAndRankingsView } from "@/components/scores/ScoresAndRankings";

export interface ScoresTabProps {
  active: boolean;
  loading: boolean;
  country: Country;
  democracyData: DemocracyData | null;
  /** P1.1 — pre-fetched Scores & Rankings rows (canonical surface). */
  scoresRows: ScoreRow[] | null;
}

/**
 * Phase C — "Scores & Rankings" tab.
 *
 * P1.1 wires the new `<ScoresAndRankingsView>` as the primary surface:
 * one compact table with Civica Index, Pulse, V-Dem, Freedom House,
 * RSF, HDI, and CPI. The legacy Freedom House facts strip and regional
 * comparison remain below as a supplemental block until they're folded
 * into a full dimension breakdown by the v2 methodology rebuild.
 */
export function ScoresTab({
  active,
  loading,
  country,
  democracyData,
  scoresRows,
}: ScoresTabProps) {
  if (!active) return null;

  return (
    <div className="atlas-pane on">
      <div
        className="atlas-mono"
        style={{
          fontSize: 10,
          color: "var(--atlas-muted)",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Scores & Rankings
      </div>

      {loading && !scoresRows ? (
        <div
          className="atlas-mono"
          style={{
            fontSize: 11,
            color: "var(--atlas-muted)",
            padding: "40px 0",
            textAlign: "center",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Loading…
        </div>
      ) : scoresRows && scoresRows.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <ScoresAndRankingsView
            rows={scoresRows}
            countryName={country.name}
            variant="atlas"
          />
        </div>
      ) : (
        <div
          className="atlas-mono"
          style={{
            fontSize: 11,
            color: "var(--atlas-muted)",
            padding: "24px 0",
            textAlign: "center",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          No score data available
        </div>
      )}

      {/* Supplemental Freedom House facts + regional comparison —
          kept until the dimension-breakdown rebuild lands. */}
      {democracyData &&
        (democracyData.freedomHouseFacts.length > 0 ||
          democracyData.regionalComparison.length > 0) && (
          <>
            <div
              className="atlas-mono"
              style={{
                fontSize: 10,
                color: "var(--atlas-muted)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              More detail
            </div>

            {democracyData.freedomHouseFacts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <SectionHead>Freedom House facts</SectionHead>
                {democracyData.freedomHouseFacts.map((f) => (
                  <div
                    key={f.factKey}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "1px solid var(--atlas-rule-2)",
                    }}
                  >
                    <span
                      className="atlas-sans"
                      style={{
                        fontSize: 13,
                        color: "var(--atlas-ink-2)",
                        textTransform: "capitalize",
                      }}
                    >
                      {f.factKey
                        .replace("freedom_house_", "")
                        .replace(/_/g, " ")}
                    </span>
                    <span
                      className="atlas-mono"
                      style={{ fontSize: 12, color: "var(--atlas-ink)" }}
                    >
                      {f.factValue ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {democracyData.regionalComparison.length > 0 && (
              <div>
                <SectionHead>Regional comparison</SectionHead>
                {democracyData.regionalComparison.slice(0, 8).map((rc, i) => (
                  <div
                    key={rc.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 0",
                      borderBottom: "1px solid var(--atlas-rule-2)",
                      fontWeight: rc.id === country.id ? 700 : 400,
                    }}
                  >
                    <span className="atlas-sans" style={{ fontSize: 13 }}>
                      <span
                        style={{
                          color: "var(--atlas-muted)",
                          marginRight: 6,
                          fontSize: 10,
                        }}
                      >
                        {i + 1}.
                      </span>
                      {rc.name}
                    </span>
                    <span
                      className="atlas-mono"
                      style={{ fontSize: 11, color: "var(--atlas-muted)" }}
                    >
                      {rc.democracyIndex?.toFixed(2) ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="atlas-mono"
      style={{
        fontSize: 10,
        color: "var(--atlas-muted)",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}
