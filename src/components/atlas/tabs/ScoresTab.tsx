"use client";

import type { Country } from "../data";
import type { DemocracyData } from "../AtlasCountryCenter";

export interface ScoresTabProps {
  active: boolean;
  loading: boolean;
  country: Country;
  democracyData: DemocracyData | null;
}

/**
 * Phase C — "Scores & Rankings" tab.
 *
 * Folds in the old Democracy tab content (V-Dem index, Freedom House facts,
 * regional comparison) and reserves the top of the pane for a CI / dimension
 * breakdown that lands in a follow-up phase. Until then, the Civica Index
 * + Pulse hero already lives in the masthead, so this tab is functionally
 * "more detail on the scores you already saw at the top of the page."
 */
export function ScoresTab({
  active,
  loading,
  country,
  democracyData,
}: ScoresTabProps) {
  if (!active) return null;

  return (
    <div className="atlas-pane on">
      {/* CI dimension breakdown placeholder. Real charts land in a
          dedicated CI rebuild; for now the masthead's chip strip
          (HDI / DQ / ROL / FNR / CC / SS) is the primary surface. */}
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
        Civica Index — dimension breakdown
      </div>
      <div
        style={{
          padding: "16px 18px",
          border: "1px dashed var(--atlas-rule)",
          background: "var(--atlas-paper-2)",
          marginBottom: 28,
        }}
      >
        <div
          className="atlas-sans"
          style={{
            fontSize: 13,
            color: "var(--atlas-ink-2)",
            lineHeight: 1.5,
          }}
        >
          The full Civica Index dimension breakdown for {country.name} is
          shown in the masthead chip strip above (HDI · DQ · ROL · FNR ·
          CC · SS). Charts and historical trend lines land in the v2
          methodology rebuild.
        </div>
      </div>

      {/* V-Dem democracy index + Freedom House facts + regional comparison —
          recovered from the old Democracy tab. */}
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
        Democracy
      </div>

      {loading && !democracyData ? (
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
      ) : democracyData ? (
        <>
          <div
            style={{
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: "1px solid var(--atlas-rule)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span className="atlas-serif" style={{ fontSize: 48 }}>
                {democracyData.democracyIndex != null
                  ? democracyData.democracyIndex.toFixed(2)
                  : "—"}
              </span>
              <span
                className="atlas-mono"
                style={{
                  fontSize: 10,
                  color: "var(--atlas-muted)",
                  letterSpacing: ".1em",
                }}
              >
                / 1.00 V-DEM
              </span>
            </div>
            {democracyData.democracyIndex != null && (
              <>
                <div
                  style={{
                    background: "var(--atlas-rule-2)",
                    borderRadius: 3,
                    height: 8,
                    overflow: "hidden",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${(democracyData.democracyIndex * 100).toFixed(1)}%`,
                      height: "100%",
                      borderRadius: 3,
                      background:
                        democracyData.democracyIndex >= 0.7
                          ? "var(--color-success)"
                          : democracyData.democracyIndex >= 0.4
                            ? "var(--color-warn)"
                            : "var(--color-danger)",
                    }}
                  />
                </div>
                <span
                  className="atlas-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--atlas-ink-2)",
                    letterSpacing: ".08em",
                  }}
                >
                  {democracyData.democracyIndex >= 0.7
                    ? "LIBERAL DEMOCRACY"
                    : democracyData.democracyIndex >= 0.4
                      ? "ELECTORAL DEMOCRACY / HYBRID"
                      : "AUTOCRACY / CLOSED"}
                </span>
              </>
            )}
          </div>

          {democracyData.freedomHouseFacts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionHead>Freedom House</SectionHead>
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
              <SectionHead>Regional Comparison</SectionHead>
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
      ) : (
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
          No democracy data available
        </div>
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
