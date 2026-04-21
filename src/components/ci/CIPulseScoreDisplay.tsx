export interface CIScoreData {
  score: number;
  rank: number | null;
  totalRanked: number | null;
  quarter: string;
  isPartial: boolean;
}

export interface PulseScoreData {
  pulseScore: number;
  eventImpact: number;
  activeEvents: number;
  scoreDate: string;
  isLowConfidence: boolean;
}

export function ciTierInfo(score: number): { label: string; cssVar: string } {
  if (score >= 90) return { label: "Exceptional governance", cssVar: "--tier-exceptional" };
  if (score >= 75) return { label: "Strong governance",      cssVar: "--tier-strong" };
  if (score >= 50) return { label: "Mixed governance",       cssVar: "--tier-mixed" };
  if (score >= 25) return { label: "Weak governance",        cssVar: "--tier-weak" };
  return               { label: "Failed governance",      cssVar: "--tier-failed" };
}

function formatQuarter(q: string): string {
  const m = q.match(/^(\d{4})-Q(\d)$/);
  if (!m) return q;
  return `${m[1]} Q${m[2]}`;
}

interface CIPulseScoreDisplayProps {
  ciScore: CIScoreData | null;
  pulseScore: PulseScoreData | null;
}

export function CIPulseScoreDisplay({ ciScore, pulseScore }: CIPulseScoreDisplayProps) {
  const ciTier = ciScore ? ciTierInfo(ciScore.score) : null;
  const cpTier = pulseScore ? ciTierInfo(pulseScore.pulseScore) : null;
  const ciRounded = ciScore ? Math.round(ciScore.score * 10) / 10 : null;
  const cpRounded = pulseScore ? Math.round(pulseScore.pulseScore * 10) / 10 : null;

  const pulseDelta = pulseScore ? pulseScore.eventImpact : 0;
  const deltaSign = pulseDelta > 0 ? "▲" : pulseDelta < 0 ? "▼" : "—";
  const deltaClass = pulseDelta > 0.1 ? "pulse-up" : pulseDelta < -0.1 ? "pulse-down" : "pulse-flat";
  const deltaLabel = `${deltaSign} ${Math.abs(pulseDelta).toFixed(1)} today`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 1,
        background: "var(--color-card-border)",
        border: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-sm, 2px)",
        overflow: "hidden",
        marginBottom: 48,
        boxShadow: "var(--shadow-hard-lg)",
      }}
    >
      {/* CI half — frozen / structural */}
      <div
        style={{
          background: "var(--color-card-bg)",
          padding: "32px 36px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--color-text-30)",
            marginBottom: 8,
          }}
        >
          <span>Civica Index · structural</span>
          <span
            className="source-dot source-dot--frozen"
            role="img"
            aria-label="Updates quarterly"
            title="Updates quarterly"
          />
        </div>

        {ciRounded !== null && ciTier ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 400,
                  fontSize: 88,
                  letterSpacing: "-0.05em",
                  lineHeight: 0.9,
                  color: `var(${ciTier.cssVar})`,
                }}
              >
                {ciRounded}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  fontSize: 14,
                  color: "var(--color-text-25)",
                  marginLeft: 4,
                }}
              >
                /100
              </span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                marginTop: 16,
                padding: "4px 10px",
                borderRadius: "var(--radius-sm, 2px)",
                background: "rgba(128,128,128,0.06)",
                color: `var(${ciTier.cssVar})`,
              }}
            >
              ● {ciTier.label}
            </div>

            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 13,
                color: "var(--color-text-40)",
                marginTop: 10,
              }}
            >
              Last recalculated {ciScore!.isPartial ? "(partial) " : ""}{formatQuarter(ciScore!.quarter)} · weighted composite of 6 dimensions
            </div>
          </>
        ) : (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 14,
              color: "var(--color-text-40)",
              paddingTop: 16,
            }}
          >
            No CI score yet
          </div>
        )}
      </div>

      {/* CP half — live / real-time */}
      <div
        style={{
          background: "var(--color-card-bg)",
          padding: "32px 36px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--color-text-30)",
            marginBottom: 8,
          }}
        >
          <span>Civica Pulse · real-time</span>
          <span
            className="source-dot source-dot--live"
            role="img"
            aria-label="Updates daily"
            title="Updates daily"
          />
        </div>

        {cpRounded !== null && cpTier ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 400,
                  fontSize: 88,
                  letterSpacing: "-0.05em",
                  lineHeight: 0.9,
                  color: `var(${cpTier.cssVar})`,
                }}
              >
                {cpRounded}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  fontSize: 14,
                  color: "var(--color-text-25)",
                  marginLeft: 4,
                }}
              >
                /100
              </span>
              {pulseDelta !== 0 && (
                <span
                  className={`score-pulse-delta ${deltaClass}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm, 2px)",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    fontSize: 12,
                    background:
                      pulseDelta > 0.1
                        ? "rgba(92,170,110,0.15)"
                        : pulseDelta < -0.1
                          ? "rgba(212,118,78,0.15)"
                          : "rgba(196,189,174,0.10)",
                    color:
                      pulseDelta > 0.1
                        ? "var(--color-source-live)"
                        : pulseDelta < -0.1
                          ? "var(--color-danger, oklch(65% 0.18 25))"
                          : "var(--color-text-40)",
                  }}
                >
                  {deltaLabel}
                </span>
              )}
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                marginTop: 16,
                padding: "4px 10px",
                borderRadius: "var(--radius-sm, 2px)",
                background: "rgba(128,128,128,0.06)",
                color: `var(${cpTier.cssVar})`,
              }}
            >
              ● {cpTier.label}
            </div>

            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 13,
                color: "var(--color-text-40)",
                marginTop: 10,
              }}
            >
              CI {ciRounded ?? "—"} + event impact {pulseDelta >= 0 ? "+" : ""}{pulseDelta.toFixed(1)} · {pulseScore!.activeEvents} events in trailing 120d
            </div>
          </>
        ) : (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 14,
              color: "var(--color-text-40)",
              paddingTop: 16,
            }}
          >
            No Pulse score yet
          </div>
        )}
      </div>
    </div>
  );
}
