/**
 * DEPRECATED HISTORICAL REPLAY ONLY (retired 2026-07-09).
 *
 * These definitions document how already-stored legacy A–F values were
 * produced. They must never be imported by a public UI, API, export, metadata,
 * or current score writer. New and recomputed rows persist `band = NULL`.
 */

export type CIBand = "A" | "B" | "C" | "D" | "E" | "F";

interface BandRow {
  letter: CIBand;
  min: number;
  max: number;
  label: string;
}

/** @deprecated Historical audit/replay only. */
export const BAND_RANGES: readonly BandRow[] = [
  { letter: "A", min: 85, max: 100, label: "Exceptional" },
  { letter: "B", min: 70, max: 84, label: "Strong" },
  { letter: "C", min: 55, max: 69, label: "Mixed" },
  { letter: "D", min: 40, max: 54, label: "Weak" },
  { letter: "E", min: 25, max: 39, label: "Very weak" },
  { letter: "F", min: 0, max: 24, label: "Failed / authoritarian" },
] as const;

/**
 * Map a 0–100 integer score to its A–F band. Inputs outside [0, 100]
 * are clamped before assignment.
 */
/** @deprecated Historical audit/replay only. */
export function scoreToBand(score: number): CIBand {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  for (const row of BAND_RANGES) {
    if (clamped >= row.min && clamped <= row.max) return row.letter;
  }
  return "F"; // unreachable but TypeScript exhaustiveness
}

/** @deprecated Historical audit/replay only. */
export function bandLabel(band: CIBand): string {
  return BAND_RANGES.find((b) => b.letter === band)?.label ?? "Unknown";
}
