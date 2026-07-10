import type { CSSProperties } from "react";

type ScorePositionStyle = CSSProperties & {
  "--score-position"?: string;
  "--score-range-start"?: string;
  "--score-range-width"?: string;
};

export interface ScorePositionProps {
  /** Numeric estimate to place on the scale. `null` renders an empty track. */
  value: number | null;
  /** Optional lower edge of an input-variation or uncertainty range. */
  lower?: number | null;
  /** Optional upper edge of an input-variation or uncertainty range. */
  upper?: number | null;
  min?: number;
  max?: number;
  /** Accessible name for the estimate represented by the marker. */
  label: string;
  /** Hide the numeric endpoints in space-constrained surfaces. */
  compact?: boolean;
}

function position(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/**
 * Neutral numeric-position primitive for estimates that must not imply a
 * categorical country verdict. The blue marker encodes position only; it is
 * never mapped to a good/bad, letter-grade, or traffic-light scale.
 */
export function ScorePosition({
  value,
  lower = null,
  upper = null,
  min = 0,
  max = 100,
  label,
  compact = false,
}: ScorePositionProps) {
  const hasValue = value != null && Number.isFinite(value);
  const hasRange =
    lower != null &&
    upper != null &&
    Number.isFinite(lower) &&
    Number.isFinite(upper);

  const markerPosition = hasValue ? position(value, min, max) : 0;
  const rangeStart = hasRange ? position(Math.min(lower, upper), min, max) : 0;
  const rangeEnd = hasRange ? position(Math.max(lower, upper), min, max) : 0;
  const style: ScorePositionStyle = {
    "--score-position": `${markerPosition}%`,
    "--score-range-start": `${rangeStart}%`,
    "--score-range-width": `${Math.max(0, rangeEnd - rangeStart)}%`,
  };

  const rangeText = hasRange
    ? `; input-variation range ${lower} to ${upper}`
    : "";
  const ariaLabel = hasValue
    ? `${label}: ${value} on a scale from ${min} to ${max}${rangeText}`
    : `${label}: no estimate available`;

  return (
    <div
      className={`score-position${compact ? " score-position--compact" : ""}`}
      style={style}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="score-position__track" aria-hidden="true">
        {hasRange ? <span className="score-position__range" /> : null}
        {hasValue ? <span className="score-position__marker" /> : null}
      </div>
      {!compact ? (
        <div className="score-position__scale" aria-hidden="true">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      ) : null}
    </div>
  );
}
