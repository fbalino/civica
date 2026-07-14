/**
 * Shared, byte-identical helpers extracted from the ~18 factbook
 * reconcile sync adapters (`sync-*.ts`). This module holds the definitions
 * that are genuinely identical across every adapter: payload hashing,
 * Civica's editorial source-role type, and the final aggregate-success gate
 * for source freshness. Per-adapter logic (fetch + map + counters +
 * `freshCounters()`) is intentionally NOT moved here because it differs per
 * source; extracting it would change behavior.
 *
 * Freshness still flows exclusively through `markSourcesSynced()` from
 * `@/lib/db/source-freshness`. The shared gate below only decides whether an
 * adapter is allowed to call that sanctioned writer after every downstream
 * step, including dispute persistence, has finished successfully.
 */
import { createHash } from "node:crypto";

import type { markSourcesSynced } from "@/lib/db/source-freshness";

/**
 * Civica's editorial role for a given (source, fact-key) pair.
 *
 * - `canonical` — Civica regards this source as the authoritative
 *   reference for this fact-key (e.g. WB nominal GDP). The Phase F
 *   resolver does NOT use this field for runtime selection (the
 *   resolver is freshness-driven per methodology §3.3); the field
 *   is informational metadata for the methodology page rewrite at
 *   Phase R.23 and for downstream phases (R.3 UN WPP, R.4 WHO,
 *   R.5 UNESCO, R.10 ILO, R.12 WTO) so they inherit the
 *   canonical/alternate assignment without re-deciding.
 * - `alternate` — Civica regards this source as a corroborating
 *   reference; another Tier-1 publisher is or will be canonical.
 *   This is the default when omitted.
 *
 * Per `~/civica/plan/wb-wdi-expansion-resolution-v1.md` §2d.
 */
export type CivicaSourceRole = "canonical" | "alternate";

/**
 * Deterministic SHA-256 content hash of an upstream payload object.
 * Used for `fact_snapshots` dedup (sourceId + payloadHash) and as the
 * `country_facts.sourceHash` value. Byte-identical across every
 * reconcile adapter.
 */
export function payloadHash(payload: object): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Record a fail-loud outcome when a configured, required subfeed did not
 * produce even one usable Civica row. A sibling target writing rows must not
 * hide an empty response, parser drift, an all-rejected payload, or a complete
 * jurisdiction-mapping miss for another required target.
 *
 * Call this once per configured target after its write/dry-run loop. A
 * genuinely optional or expected-empty target must model that policy
 * explicitly instead of silently omitting this assertion.
 */
export function recordRequiredSubfeedOutcome(options: {
  errors: string[];
  source: string;
  target: string;
  rowsWritten: number;
}): boolean {
  if (Number.isSafeInteger(options.rowsWritten) && options.rowsWritten > 0) {
    return true;
  }

  const message = `${options.source} required subfeed '${options.target}' produced no usable rows`;
  if (!options.errors.includes(message)) options.errors.push(message);
  return false;
}

/**
 * Stamp an external source only after the adapter's complete error aggregate
 * is empty. Call this after dispute persistence and after folding any returned
 * dispute errors into `errors`.
 *
 * The callback remains `markSourcesSynced` (or its injected test seam), so its
 * positive-row and dry-run rules stay authoritative. Skipping the callback
 * entirely on aggregate failure makes retry behavior explicit: a failed run
 * cannot consume or advance a freshness stamp.
 */
export async function markExternalSourceSyncedAfterAggregateSuccess(options: {
  sourceIds: string | string[];
  rowsWritten: number;
  dryRun?: boolean;
  executor: Parameters<typeof markSourcesSynced>[1]["executor"];
  errors: readonly string[];
  markSynced: typeof markSourcesSynced;
}): Promise<string[]> {
  if (options.errors.length > 0) return [];

  return options.markSynced(options.sourceIds, {
    rowsWritten: options.rowsWritten,
    dryRun: options.dryRun,
    executor: options.executor,
  });
}
