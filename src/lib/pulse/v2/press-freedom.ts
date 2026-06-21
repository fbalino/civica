/**
 * Phase 5.5 — country press-freedom scores for the corroboration rule.
 *
 * Per spec §3.5, news-only signals carry different weight depending
 * on the country's RSF Press Freedom Index score:
 *   - score ≥ 70 (free press)        : full confidence
 *   - score 50–69 (partially free)   : −20% confidence; specialist
 *                                      corroboration preferred
 *   - score < 50 (restricted press)  : news-only signals do NOT
 *                                      trigger classification on
 *                                      their own; held in pending
 *                                      review state
 *
 * The full RSF country index is loaded into Civica via
 * `rsf_press_freedom` source ingestion in the CI pipeline. For the
 * Pulse, we keep a static fallback table of recent (2024) RSF scores
 * for the most-covered countries, refreshed annually. If a country
 * isn't in the table we default to 50 (partially-free) which is the
 * neutral midpoint.
 *
 * To refresh: pull the latest RSF index, copy the country → score
 * pairs into the map below, bump LAST_UPDATED.
 */

/** Approximate RSF 2024 World Press Freedom Index scores by country
 *  ISO3 code. Higher = freer press. Range 0-100. */
export const RSF_SCORES_2024: Record<string, number> = {
  // Free press (≥ 70)
  NOR: 91,
  DNK: 89,
  SWE: 88,
  NLD: 88,
  FIN: 87,
  EST: 86,
  PRT: 85,
  IRL: 85,
  CHE: 85,
  DEU: 83,
  CZE: 80,
  ISL: 80,
  CAN: 80,
  LTU: 80,
  AUT: 79,
  LUX: 79,
  BEL: 79,
  TWN: 78,
  GBR: 75,
  AUS: 75,
  ESP: 74,
  FRA: 73,
  NZL: 73,
  CHL: 73,
  JPN: 72,
  KOR: 72,
  POL: 71,
  USA: 70,
  ARG: 70,

  // Partially free (50–69)
  ITA: 67,
  ZAF: 66,
  ZMB: 66,
  CRI: 65,
  HUN: 65,
  ROU: 65,
  BGR: 65,
  GRC: 65,
  HRV: 65,
  ALB: 64,
  ISR: 60,
  BWA: 60,
  MEX: 58,
  BRA: 58,
  GHA: 58,
  IND: 56,
  IDN: 56,
  PHL: 56,
  KEN: 56,
  COL: 55,
  PER: 55,
  TUN: 55,
  UKR: 55,
  TZA: 55,
  PAK: 53,
  LKA: 53,
  ARM: 52,
  ECU: 50,
  HTI: 50,
  ETH: 50,

  // Restricted press (< 50)
  NGA: 47,
  BGD: 45,
  HND: 45,
  THA: 44,
  TUR: 42,
  HKG: 42,
  RWA: 42,
  SGP: 41,
  EGY: 38,
  AGO: 37,
  BLR: 36,
  CMR: 36,
  COD: 35,
  RUS: 33,
  AFG: 32,
  MMR: 28,
  IRN: 28,
  CHN: 23,
  SYR: 22,
  YEM: 22,
  CUB: 22,
  VNM: 22,
  TKM: 22,
  PRK: 21,
  ERI: 18,
  SAU: 18,
};

/** Conservative midpoint for unknown countries. */
const DEFAULT_SCORE = 50;

/** Given a jurisdiction (by iso3 or by lookup), return the press
 *  freedom score 0-100. */
export function pressFreedomScore(
  iso3OrCode: string | null | undefined
): number {
  if (!iso3OrCode) return DEFAULT_SCORE;
  return RSF_SCORES_2024[iso3OrCode.toUpperCase()] ?? DEFAULT_SCORE;
}

export function pressFreedomTier(
  score: number
): "free" | "partial" | "restricted" {
  if (score >= 70) return "free";
  if (score >= 50) return "partial";
  return "restricted";
}
