import { getFactKey } from "@/lib/factbook/reconcile/fact-keys";

export interface NumericValidationResult {
  accepted: boolean;
  reason: string | null;
}

/** Validate a parsed candidate against the registered fact-key envelope.
 * Text-only facts pass. Numeric fact keys fail closed when parsing produced no
 * finite number, so an upstream prose/layout change is retained as rejected
 * evidence instead of becoming an active pseudo-measurement. */
export function validateFactNumeric(
  factKey: string,
  numericValue: number | null | undefined,
): NumericValidationResult {
  const definition = getFactKey(factKey);
  const envelope = definition?.envelope;
  if (!envelope) return { accepted: true, reason: null };
  if (numericValue == null || !Number.isFinite(numericValue)) {
    return {
      accepted: false,
      reason: `numeric_parse_failed:${factKey}`,
    };
  }

  const min = envelope.isYear
    ? Math.max(envelope.min ?? 1500, 1500)
    : envelope.isPercent
      ? Math.max(envelope.min ?? -1, -1)
      : envelope.min;
  const max = envelope.isYear
    ? Math.min(envelope.max ?? 2100, 2100)
    : envelope.isPercent
      ? Math.min(envelope.max ?? 101, 101)
      : envelope.max;

  if ((min != null && numericValue < min) || (max != null && numericValue > max)) {
    return {
      accepted: false,
      reason: `plausibility_envelope:${factKey}:${numericValue}:[${min ?? "-inf"},${max ?? "inf"}]`,
    };
  }
  return { accepted: true, reason: null };
}

/** Parse one leading quantity without allowing a scale word elsewhere in a
 * prose paragraph to modify an unrelated year. Percentage-of-GDP fields must
 * contain a single, unambiguous percentage tied to GDP. */
export function parseFactbookNumeric(
  text: string | null | undefined,
  expectedUnit = "",
): { value: number | null; unit: string; year: number | null; note: string } {
  if (!text) return { value: null, unit: "", year: null, note: "" };
  const yearMatch = text.match(/\((\d{4})\s*(?:est\.?|census)?\)/i);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const note = yearMatch?.[0] ?? "";

  if (/^%|%|percent/i.test(expectedUnit)) {
    const percentMatches = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*%|(-?\d+(?:\.\d+)?)\s*%/gi)];
    if (percentMatches.length !== 1 || percentMatches[0][2] != null) {
      return { value: null, unit: "%", year, note };
    }
    const match = percentMatches[0];
    const value = Number(match[3]);
    return { value: Number.isFinite(value) ? value : null, unit: "%", year, note };
  }

  const withoutNote = text.replace(/\(.*?\)/g, "").trim();
  const quantity = withoutNote.match(/^\s*\$?\s*(-?\d+(?:[,.]\d+)*)\s*(trillion|billion|million)?/i);
  if (!quantity) return { value: null, unit: "", year, note };
  const base = Number(quantity[1].replace(/,/g, ""));
  const scale = quantity[2]?.toLowerCase();
  const multiplier = scale === "trillion" ? 1e12 : scale === "billion" ? 1e9 : scale === "million" ? 1e6 : 1;
  const unit = withoutNote.trimStart().startsWith("$") ? "$" : /%\s*$/.test(withoutNote) ? "%" : "";
  const value = base * multiplier;
  return { value: Number.isFinite(value) ? value : null, unit, year, note };
}
