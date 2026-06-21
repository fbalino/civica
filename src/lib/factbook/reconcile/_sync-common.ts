/**
 * Shared, byte-identical helpers extracted from the ~18 factbook
 * reconcile sync adapters (`sync-*.ts`). This module holds ONLY the
 * definitions that were genuinely identical across every adapter — the
 * `payloadHash()` content-hash helper and the `CivicaSourceRole`
 * editorial-role type. Per-adapter logic (fetch + map + counters +
 * `freshCounters()`) is intentionally NOT moved here because it differs
 * per source; extracting it would change behavior.
 *
 * This is a pure extract-and-import: the implementations below are the
 * verbatim definitions that previously lived (copy-pasted) in each
 * adapter. No freshness logic lives here — `last_sync_at` stamping
 * continues to flow through `markSourcesSynced()` from
 * `@/lib/db/source-freshness` inside each adapter, unchanged.
 */
import { createHash } from "node:crypto";

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
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}
