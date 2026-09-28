/**
 * Absolute majority of a chamber's statutory membership: more than half of
 * all seats, i.e. `floor(totalSeats / 2) + 1`. A 31-seat chamber needs 16,
 * a 99-seat chamber 50, and a 100-seat chamber 51.
 *
 * This is the single threshold every rendered legislature majority line uses
 * (hemicycle label, stats grid, composition bar, and coalition badge), so one
 * chamber can never show two different majority numbers. The basis is the
 * statutory seat total, not seats currently filled or voting.
 *
 * Returns null when the total is not a positive safe integer, so callers show
 * their missing-value fallback instead of an invented threshold.
 */
export function absoluteMajorityThreshold(totalSeats: number): number | null {
  if (!Number.isSafeInteger(totalSeats) || totalSeats <= 0) return null;
  return Math.floor(totalSeats / 2) + 1;
}

/**
 * Whether `seats` reaches the absolute majority of `totalSeats`. Returns null
 * when the chamber total is invalid (see `absoluteMajorityThreshold`).
 */
export function holdsAbsoluteMajority(
  seats: number,
  totalSeats: number,
): boolean | null {
  const threshold = absoluteMajorityThreshold(totalSeats);
  if (threshold == null) return null;
  return seats >= threshold;
}
