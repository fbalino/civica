import { ciTier } from "@/lib/ci/tiers";

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

interface CIPulseScoreDisplayProps {
  ciScore: CIScoreData | null;
  pulseScore: PulseScoreData | null;
  ciChangeText?: string | null;
}

function formatQuarter(quarter: string): string {
  const match = quarter.match(/^(\d{4})-Q(\d)$/);
  if (!match) return quarter;
  return `Q${match[2]} ${match[1]}`;
}

function formatDateLabel(dateString: string): string {
  if (!dateString) return "Date unavailable";

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPulseDelta(delta: number): string {
  if (Math.abs(delta) < 0.05) return "Flat today";
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} today`;
}

function ProvenanceDot({ kind }: { kind: "frozen" | "live" }) {
  const isLive = kind === "live";

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: 12,
        height: 12,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {isLive ? (
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "999px",
            background: "var(--color-source-live)",
            opacity: 0.2,
            animation: "civ-pulse 2s ease-out infinite",
          }}
        />
      ) : null}
      <span
        style={{
          position: "relative",
          width: 8,
          height: 8,
          borderRadius: "999px",
          background: isLive ? "var(--color-source-live)" : "var(--color-source-frozen)",
          boxShadow: `0 0 0 1px ${isLive ? "rgba(92, 170, 110, 0.22)" : "rgba(212, 160, 74, 0.28)"}`,
        }}
      />
    </span>
  );
}

function ScorePane({
  title,
  chip,
  provenance,
  scoreLabel,
  tierLabel,
  tierColor,
  scoreValue,
  barValue,
  secondaryLine,
  footer,
}: {
  title: string;
  chip: string;
  provenance: "frozen" | "live";
  scoreLabel: string;
  tierLabel: string;
  tierColor: string;
  scoreValue: string;
  barValue: number;
  secondaryLine: string;
  footer: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-card-bg)",
        padding: "28px 28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <ProvenanceDot kind={provenance} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-text-35)",
            }}
          >
            {title}
          </span>
          <span
            className="ci-beta-pill"
            aria-label="Beta — methodology under active revision"
            title="Methodology under active revision. See /civica-index/methodology for details."
          >
            Beta
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-10)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-text-35)",
            padding: "4px 8px",
            borderRadius: "999px",
            border: "1px solid var(--color-card-border)",
            background: "var(--color-page-bg)",
            whiteSpace: "nowrap",
          }}
        >
          {chip}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 400,
            fontSize: "clamp(64px, 11vw, 88px)",
            letterSpacing: "-0.03em",
            lineHeight: 0.88,
            color: tierColor,
          }}
        >
          {scoreValue}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-40)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {scoreLabel}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: tierColor,
            }}
          >
            {tierLabel}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-40)",
            }}
          >
            {secondaryLine}
          </span>
        </div>

        <div
          style={{
            height: 8,
            borderRadius: "999px",
            background: "var(--color-card-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(barValue, 100))}%`,
              height: "100%",
              background: tierColor,
            }}
          />
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-body-sans, var(--font-body))",
          fontSize: "var(--text-13)",
          lineHeight: "var(--leading-relaxed)",
          color: "var(--color-text-55)",
        }}
      >
        {footer}
      </p>
    </div>
  );
}

export function CIPulseScoreDisplay({
  ciScore,
  pulseScore,
  ciChangeText,
}: CIPulseScoreDisplayProps) {
  const ciTierInfo = ciScore ? ciTier(ciScore.score) : null;
  const pulseTierInfo = pulseScore ? ciTier(pulseScore.pulseScore) : null;

  const ciFooter =
    ciScore && ciTierInfo
      ? [
          ciScore.rank && ciScore.totalRanked
            ? `Rank ${ciScore.rank} of ${ciScore.totalRanked}.`
            : null,
          "Structural index across six weighted dimensions.",
          ciScore.isPartial ? "Current quarter is partial." : "Updated quarterly.",
        ]
          .filter(Boolean)
          .join(" ")
      : "Composite score not available yet.";

  const pulseFooter =
    pulseScore && pulseTierInfo
      ? [
          `${pulseScore.activeEvents} active event${pulseScore.activeEvents === 1 ? "" : "s"} in the trailing 120 days.`,
          `Last refresh ${formatDateLabel(pulseScore.scoreDate)}.`,
          pulseScore.isLowConfidence ? "Low confidence." : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "Pulse score not available yet.";

  return (
    <section
      aria-label="Civica Index and Civica Pulse scores"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 1,
        border: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        background: "var(--color-card-border)",
        boxShadow: "var(--shadow-hard-lg)",
        marginBottom: 24,
      }}
    >
      <ScorePane
        title="Civica Index"
        chip={ciScore ? `CI · ${formatQuarter(ciScore.quarter)}` : "CI · Pending"}
        provenance="frozen"
        scoreLabel="/ 100"
        tierLabel={ciTierInfo ? ciTierInfo.label : "Unscored"}
        tierColor={ciTierInfo ? ciTierInfo.cssVar : "var(--color-text-40)"}
        scoreValue={ciScore ? ciScore.score.toFixed(1) : "—"}
        barValue={ciScore?.score ?? 0}
        secondaryLine={ciChangeText ?? (ciScore?.isPartial ? "Partial quarter" : "Quarterly cadence")}
        footer={ciFooter}
      />

      <ScorePane
        title="Civica Pulse"
        chip="CP · Live"
        provenance="live"
        scoreLabel="/ 100"
        tierLabel={pulseTierInfo ? pulseTierInfo.label : "Awaiting events"}
        tierColor={pulseTierInfo ? pulseTierInfo.cssVar : "var(--color-text-40)"}
        scoreValue={pulseScore ? pulseScore.pulseScore.toFixed(1) : "—"}
        barValue={pulseScore?.pulseScore ?? 0}
        secondaryLine={pulseScore ? formatPulseDelta(pulseScore.eventImpact) : "Daily cadence"}
        footer={pulseFooter}
      />
    </section>
  );
}
