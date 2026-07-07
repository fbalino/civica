/**
 * Dispute-resolution helpers — the pure logic behind the admin resolve
 * endpoint (`src/app/api/admin/data-disputes/[id]/route.ts`).
 *
 * A `data_disputes` row is a TWO-WAY disagreement between exactly two
 * `country_facts` rows, `fact_id_a` and `fact_id_b`. A reviewer resolves it
 * with `resolve_a` (A is correct) or `resolve_b` (B is correct).
 *
 * Resolving a dispute demotes ONLY the losing party — never the whole
 * candidate pool. The resolver (see `resolver.ts`) then re-picks canonical by
 * methodology over the survivors, so a source that was never part of the
 * dispute (including one that AGREES with the winner, or a fresher third
 * publisher) correctly stays active and visible in the alternates panel. The
 * reviewer adjudicated a specific PAIR, not the entire source set.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §7
 */

export type ResolveAction = "resolve_a" | "resolve_b";

/**
 * The WINNING party's fact id for a resolve action. `resolve_a` → A wins;
 * `resolve_b` → B wins. Returns null when the chosen winner has no fact row
 * (a malformed dispute) — the caller should reject rather than proceed.
 */
export function disputeWinnerId(
  action: ResolveAction,
  factIdA: string | null,
  factIdB: string | null,
): string | null {
  return action === "resolve_a" ? factIdA : factIdB;
}

/**
 * The LOSING party's fact id for a resolve action — the ONLY row a resolve
 * demotes. `resolve_a` → B loses; `resolve_b` → A loses. Returns null when the
 * losing side has no fact row: a unary dispute (e.g. `plausibility_envelope`)
 * carries only `fact_id_a`, so there is no peer to demote and the resolve
 * records the decision without demoting anything.
 */
export function disputeLoserId(
  action: ResolveAction,
  factIdA: string | null,
  factIdB: string | null,
): string | null {
  return action === "resolve_a" ? factIdB : factIdA;
}

/** Dispute statuses that still accept a resolve/hold/reject decision. A
 *  dispute in any terminal state must be reopened before it can be
 *  re-resolved — otherwise flipping resolve_a↔resolve_b would demote BOTH
 *  parties and leave the dispute pointing at two dead rows. */
export const OPEN_DISPUTE_STATUSES = new Set(["open", "in_review"]);
