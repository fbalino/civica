/**
 * Pure value checks for publisher-attribution/v1 (CLM-020).
 *
 * `publisherAttributionErrors` answers one question for a displayed value:
 * is every number in it the publisher's own figure (at the printed
 * precision), a category produced by the publisher's own rule (no number at
 * all), or a Civica calculation that carries the visible marker? The unit
 * tests, the static validator's self-proof, and the read-only live validator
 * all use these functions, so each fails on the former "Free (100/100)" row.
 */

import {
  civicaCalculationDisclosure,
  fixedBoundPosition,
  type DisplayedValueOrigin,
} from "./publisher-attribution";

export interface NumericToken {
  /** The number as printed, e.g. "1,234.5" or "−0.04". */
  text: string;
  value: number;
  /** Decimal places printed. */
  decimals: number;
}

const DIGITS = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const MINUS_SIGNS = new Set(["-", "−"]);

/**
 * Every number printed in a displayed value, with its printed precision.
 * Handles thousands separators and both hyphen-minus and U+2212 minus. A dash
 * between two numbers ("1–5", "2023-2024") is a range separator, not a sign.
 */
export function numericTokens(text: string): NumericToken[] {
  const tokens: NumericToken[] = [];
  for (const match of text.matchAll(DIGITS)) {
    const start = match.index ?? 0;
    const before = text[start - 1];
    const beforeSign = text[start - 2];
    const negative =
      before !== undefined &&
      MINUS_SIGNS.has(before) &&
      (beforeSign === undefined || !/[\w.]/.test(beforeSign));
    const digits = match[0];
    const value = Number(digits.replaceAll(",", "")) * (negative ? -1 : 1);
    const decimalPart = digits.split(".")[1];
    tokens.push({
      text: `${negative ? before : ""}${digits}`,
      value,
      decimals: decimalPart ? decimalPart.length : 0,
    });
  }
  return tokens;
}

/**
 * True when `figure`, rounded to the token's printed places, can read as the
 * token. Half-way values accept either neighbour, because display formatters
 * (Intl.NumberFormat) round the decimal form while `toFixed` rounds the binary
 * value: 91.55 prints as "91.6" in one and "91.5" in the other.
 */
function printsAs(figure: number, token: NumericToken): boolean {
  return Math.abs(figure - token.value) <= 0.5 * 10 ** -token.decimals + 1e-9;
}

export interface AttributedValueDisplay {
  surfaceId: string;
  /** The value as rendered, excluding edition and period labels. */
  valueText: string;
  origin: DisplayedValueOrigin | null | undefined;
  /** The publisher's own figures, plus any scale bound printed with them
   *  (the 100 in "73 / 100"). */
  publisherFigures: readonly number[];
  /** Whether the reader-visible Civica-calculation marker is rendered. */
  markerRendered: boolean;
  /** For a Civica calculation: the publisher figure it transforms. */
  calculationInput?: number | null;
}

/**
 * Attribution errors for one displayed value. A missing origin is itself an
 * error; the value is then still checked as if it claimed to be the
 * publisher's own figure, so the report names the offending number.
 */
export function publisherAttributionErrors(
  display: AttributedValueDisplay,
): string[] {
  const errors: string[] = [];
  const subject = display.surfaceId;
  const origin = display.origin ?? null;
  if (!origin) errors.push(`${subject}: has no declared origin`);
  const kind = origin?.kind ?? "publisher_published";
  const tokens = numericTokens(display.valueText);

  if (kind === "publisher_published") {
    for (const token of tokens) {
      if (!display.publisherFigures.some((figure) => printsAs(figure, token))) {
        errors.push(
          `${subject}: shows ${token.text}, which is not the publisher's own figure (${display.publisherFigures.join(", ") || "none recorded"})`,
        );
      }
    }
    return errors;
  }

  if (origin?.kind === "publisher_rule_applied") {
    if (tokens.length > 0) {
      errors.push(
        `${subject}: a category produced by the publisher's rule must not print a number (${tokens.map((token) => token.text).join(", ")})`,
      );
    }
    if (!origin.note.trim()) errors.push(`${subject}: the rule note is empty`);
    if (!origin.ruleId.trim()) errors.push(`${subject}: the rule has no id`);
    return errors;
  }

  if (origin?.kind === "civica_calculation") {
    if (!display.markerRendered) {
      errors.push(`${subject}: a Civica calculation is shown without its visible marker`);
    }
    const disclosure = civicaCalculationDisclosure(origin.transformationId);
    if (!disclosure) {
      errors.push(
        `${subject}: Civica calculation ${origin.transformationId} has no registered reader explanation`,
      );
      return errors;
    }
    if (display.calculationInput != null) {
      const expected = fixedBoundPosition(disclosure, display.calculationInput);
      // "92 / 100": the trailing scale bound is not the position.
      const positions = numericTokens(
        display.valueText.replace(/\s*\/\s*100\s*$/, ""),
      );
      if (positions.length !== 1 || !printsAs(expected, positions[0])) {
        errors.push(
          `${subject}: shows "${display.valueText}", but ${origin.transformationId} maps ${display.calculationInput} to ${expected}`,
        );
      }
    }
  }
  return errors;
}

/** The subset of a score row the checks read; the legacy row fits it too. */
export interface PublisherScoreDisplay {
  id: string;
  score: number | null;
  scoreFormatted: string;
  category?: string | null;
  publisherEdition?: string;
  valueOrigin?: DisplayedValueOrigin | null;
}

/**
 * Attribution errors for a country score row against the publisher's native
 * figure for that row (V-Dem's value; Freedom House's PR+CL sum).
 */
export function scoreRowAttributionErrors(
  row: PublisherScoreDisplay,
  nativeValue: number,
): string[] {
  const subject = `score row ${row.id}`;
  const valueText = row.publisherEdition
    ? row.scoreFormatted.replace(row.publisherEdition, "")
    : row.scoreFormatted;
  const errors = publisherAttributionErrors({
    surfaceId: subject,
    valueText,
    origin: row.valueOrigin,
    publisherFigures: [nativeValue],
    markerRendered: false,
  });
  const origin = row.valueOrigin ?? null;
  if (origin?.kind === "publisher_rule_applied") {
    if (row.score !== null) {
      errors.push(`${subject}: a rule-applied row carries the number ${row.score}`);
    }
    if (!row.category) errors.push(`${subject}: a rule-applied row has no category`);
    if (row.scoreFormatted !== `${row.category} · ${row.publisherEdition}`) {
      errors.push(`${subject}: the value must read "<status> · <publisher edition>"`);
    }
  } else if (origin?.kind === "publisher_published") {
    if (row.score === null || Math.abs(row.score - nativeValue) > 0.0005) {
      errors.push(
        `${subject}: score ${row.score} is not the publisher's own figure (${nativeValue})`,
      );
    }
  } else if (origin?.kind === "civica_calculation") {
    errors.push(`${subject}: a publisher score row cannot carry a Civica calculation`);
  } else if (row.score !== null && Math.abs(row.score - nativeValue) > 0.0005) {
    errors.push(
      `${subject}: score ${row.score} is not the publisher's own figure (${nativeValue})`,
    );
  }
  return errors;
}

export interface ScaleEndClusterSignature {
  n: number;
  shareAtMax: number;
  shareAtMin: number;
  flagged: boolean;
}

/**
 * Share of values sitting exactly on either end of a scale. A heuristic,
 * recorded in the live report only: clustering at a scale end appears when a
 * transform saturates, and also when a publisher's own scale clusters (as
 * Freedom House's best ratings do). Value-equality comparisons, not this
 * signature, decide pass or fail.
 */
export function scaleEndClusterSignature(
  values: readonly number[],
  scale: { min: number; max: number },
  threshold = 0.1,
): ScaleEndClusterSignature {
  const n = values.length;
  if (n === 0) return { n, shareAtMax: 0, shareAtMin: 0, flagged: false };
  const epsilon = (scale.max - scale.min) * 1e-9;
  const atMax = values.filter((value) => value >= scale.max - epsilon).length;
  const atMin = values.filter((value) => value <= scale.min + epsilon).length;
  const shareAtMax = atMax / n;
  const shareAtMin = atMin / n;
  return {
    n,
    shareAtMax,
    shareAtMin,
    flagged: shareAtMax > threshold || shareAtMin > threshold,
  };
}

/**
 * The Freedom House row exactly as the pre-CLM-020 formatter built it:
 * `${status} (${Math.round(position)}/100)`, where `position` was Civica's
 * 0–100 rescale of the PR+CL sum, carried as `score` with no declared origin.
 * Tests, the static validator's self-proof, and the live validator use it to
 * prove the checks fail on the old row.
 */
export function legacyFreedomHouseRow(
  status: string,
  civicaPosition: number,
): PublisherScoreDisplay {
  const rounded = Math.round(civicaPosition);
  return {
    id: "freedom-house",
    score: rounded,
    scoreFormatted: `${status} (${rounded}/100)`,
  };
}
