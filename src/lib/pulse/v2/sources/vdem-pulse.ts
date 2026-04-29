/**
 * V-Dem Institute — early-warning / pulse signals.
 * License: academic non-commercial.
 *
 * STATUS: stub. V-Dem publishes its annual datasets (V-Dem v15 etc.)
 * at https://v-dem.net/data/ but doesn't expose a daily pulse-style
 * feed. The "early-warning" indicators they publish are themselves
 * derived from the annual dataset, refreshed semi-annually at best.
 *
 * The Pulse's real-time governance signal comes from the news +
 * specialist activist feeds (HRW, Amnesty, ACLED, CIVICUS, RSF).
 * V-Dem's role is in the quarterly CI dimensional weights, not the
 * Pulse layer.
 *
 * This connector remains in the orchestrator only as an extension
 * point — when V-Dem ships a real-time pulse (or we obtain dataset
 * deltas between releases), the body below gets a real implementation.
 */

import type { JurisdictionMap } from "../country-resolver";
import type { RawEventInput } from "../types";

export interface VdemPulseResult {
  rows: RawEventInput[];
  fetched: number;
}

export async function fetchVdemPulse(
  // Map kept in the signature so future implementations don't change
  // the orchestrator interface.
  _map: JurisdictionMap
): Promise<VdemPulseResult> {
  return { rows: [], fetched: 0 };
}
