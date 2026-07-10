/**
 * Civica Index score display — Beta methodology.
 *
 * Renders a single editorial pane showing the CI score, Monte Carlo
 * input-variation range, A–F band, and completeness flag.
 *
 * Phase 5.4 added Beta methodology display.
 * Phase 5.6 dropped the merged-scalar Pulse pane entirely. The
 * dimensional-delta replacement is `<PulseDimensionalDeltas>` —
 * consumers render it below this CI pane. The legacy `pulseScore`
 * prop remains accepted (and ignored) so callers can migrate at
 * their own pace, but new code should not pass it.
 */

import { BAND_RANGES, type CIBand } from "@/lib/ci/bands";
import { civicaIndex } from "@/lib/content/site-state";
import { BetaChip } from "@/components/editorial/BetaChip";
import { Tooltip } from "@/components/editorial/Tooltip";

export interface CIScoreData {
  score: number;
  scoreLower: number | null;
  scoreUpper: number | null;
  band: CIBand | string | null;
  completenessFlag: "full" | "partial" | "insufficient" | string | null;
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
  /**
   * @deprecated Phase 5.6 removed the merged-scalar Pulse pane.
   * The replacement is the `<PulseDimensionalDeltas>` component
   * rendered alongside this one. This prop is accepted for
   * backwards compatibility and ignored at render time.
   */
  pulseScore?: PulseScoreData | null;
  ciChangeText?: string | null;
  /**
   * Number of governance dimensions actually rendered in the breakdown.
   * Partial countries carry only 3 of the 4 headline dimensions, so the
   * footer sentence must reflect the real count rather than the static
   * `civicaIndex.dimensionCount`. Falls back to the static count when the
   * caller doesn't pass it.
   */
  dimensionCount?: number;
}

function formatQuarter(quarter: string): string {
  const match = quarter.match(/^(\d{4})-Q(\d)$/);
  if (!match) return quarter;
  return `Q${match[2]} ${match[1]}`;
}

/**
 * Pick the band row for a given letter. Returns null when the letter is
 * absent/unrecognized — a no-data jurisdiction (Vatican, Jersey, etc.)
 * must NOT inherit the last band ("F · Failed / authoritarian"); the
 * caller renders a neutral "No score yet" label instead.
 */
function bandRow(letter: string | null) {
  return BAND_RANGES.find((b) => b.letter === letter) ?? null;
}

/** Map a Beta CI band → a CSS color token from the existing tier palette. */
function bandColor(letter: string | null): string {
  switch (letter) {
    case "A":
      return "var(--tier-exceptional)";
    case "B":
      return "var(--tier-strong)";
    case "C":
      return "var(--tier-mixed)";
    case "D":
      return "var(--tier-weak)";
    case "E":
      return "var(--tier-failed)";
    case "F":
      return "var(--tier-failed)";
    default:
      return "var(--color-text-40)";
  }
}

function ProvenanceDot() {
  // CI is sourced from quarterly upstream data; "frozen" until next refresh.
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
      <span
        style={{
          position: "relative",
          width: 8,
          height: 8,
          borderRadius: "999px",
          background: "var(--color-source-frozen)",
          boxShadow: "0 0 0 1px color-mix(in oklab, var(--color-warn) 28%, transparent)",
        }}
      />
    </span>
  );
}

function ScorePane({
  title,
  chip,
  scoreLabel,
  bandLetter,
  bandLabel,
  bandColorVar,
  scoreValue,
  intervalLine,
  barValue,
  secondaryLine,
  footer,
}: {
  title: string;
  chip: string;
  scoreLabel: string;
  bandLetter: string | null;
  bandLabel: string;
  bandColorVar: string;
  scoreValue: string;
  intervalLine: string | null;
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
          <ProvenanceDot />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-text-30)",
            }}
          >
            {title}
          </span>
          {civicaIndex.status === "beta" ? (
            <Tooltip content="Methodology under active revision. See /civica-index/methodology for details.">
              <BetaChip aria-label="Beta — methodology under active revision" />
            </Tooltip>
          ) : null}
        </div>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: "var(--text-12)",
            letterSpacing: 0,
            color: "var(--color-text-30)",
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
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
            color: bandColorVar,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {scoreValue}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-13)",
            color: "var(--color-text-40)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {scoreLabel}
        </span>
      </div>

      {/* Monte Carlo input-variation range — not a confidence interval. */}
      {intervalLine ? (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-13)",
            color: "var(--color-text-50)",
            letterSpacing: "0.05em",
            marginTop: -4,
          }}
        >
          {intervalLine}
        </span>
      ) : null}

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
              fontSize: "var(--text-12)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: bandColorVar,
            }}
          >
            {bandLetter ? `${bandLetter} · ${bandLabel}` : bandLabel}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
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
              background: bandColorVar,
            }}
          />
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-body-sans, var(--font-body))",
          fontSize: "var(--text-14)",
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
  ciChangeText,
  dimensionCount,
}: CIPulseScoreDisplayProps) {
  // Prefer the caller's rendered-dimension count; fall back to the static
  // count when it's absent or 0 (never print "Composite of 0 dimensions").
  const dimCount =
    dimensionCount && dimensionCount > 0
      ? dimensionCount
      : civicaIndex.dimensionCount;
  const ciBandLetter = ciScore?.band ?? null;
  const ciBandRow = bandRow(ciBandLetter as string | null);
  const ciColorVar = bandColor(ciBandLetter as string | null);
  // No band row → honest no-data label (never fall back to the F row).
  const ciBandLabel = ciBandRow ? ciBandRow.label : "No score yet";

  const ciIntervalLine =
    ciScore && ciScore.scoreLower != null && ciScore.scoreUpper != null
      ? `Central 90% of simulations: ${ciScore.scoreLower}–${ciScore.scoreUpper}`
      : null;

  const ciFooter = ciScore
    ? [
        ciScore.rank && ciScore.totalRanked
          ? `Rank ${ciScore.rank} of ${ciScore.totalRanked}.`
          : null,
        `Composite of ${dimCount} governance dimensions.`,
        ciScore.completenessFlag === "partial"
          ? "Partial — one optional dimension missing."
          : "Updated quarterly.",
      ]
        .filter(Boolean)
        .join(" ")
    : "Composite score not available yet.";

  return (
    <section
      aria-label="Civica Index score"
      style={{
        border: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        boxShadow: "var(--shadow-hard-lg)",
        marginBottom: 24,
      }}
    >
      <ScorePane
        title="Civica Index"
        chip={ciScore ? `CI · ${formatQuarter(ciScore.quarter)}${civicaIndex.status === "beta" ? " (Beta)" : ""}` : "CI · Pending"}
        scoreLabel="/ 100"
        bandLetter={(ciBandLetter as string | null) ?? null}
        bandLabel={ciBandLabel}
        bandColorVar={ciColorVar}
        scoreValue={ciScore ? Math.round(ciScore.score).toString() : "—"}
        intervalLine={ciIntervalLine}
        barValue={ciScore?.score ?? 0}
        secondaryLine={ciChangeText ?? (ciScore?.completenessFlag === "partial" ? "Partial" : "Quarterly cadence")}
        footer={ciFooter}
      />
    </section>
  );
}
