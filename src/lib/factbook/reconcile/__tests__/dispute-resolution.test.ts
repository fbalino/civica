/**
 * Unit test for the dispute-resolution helpers — the pure logic that decides
 * which single row a resolve action demotes.
 *
 *   npx tsx src/lib/factbook/reconcile/__tests__/dispute-resolution.test.ts
 *
 * Guards the over-demotion regression: resolving a two-way dispute must demote
 * ONLY the losing party (never the whole candidate pool, and never a bystander
 * that agrees with the winner).
 */
import assert from "node:assert/strict";
import {
  disputeWinnerId,
  disputeLoserId,
  OPEN_DISPUTE_STATUSES,
} from "@/lib/factbook/reconcile/dispute-resolution";

let pass = 0;
let fail = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  pass  ${name}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log("    ", (err as Error).message);
    fail++;
  }
}

console.log("dispute-resolution helpers\n");

const A = "fact-a";
const B = "fact-b";

test("resolve_a → A wins, B loses", () => {
  assert.equal(disputeWinnerId("resolve_a", A, B), A);
  assert.equal(disputeLoserId("resolve_a", A, B), B);
});

test("resolve_b → B wins, A loses", () => {
  assert.equal(disputeWinnerId("resolve_b", A, B), B);
  assert.equal(disputeLoserId("resolve_b", A, B), A);
});

test("resolve_a on a unary dispute (no B) → no loser to demote", () => {
  // plausibility_envelope disputes carry only fact_id_a.
  assert.equal(disputeWinnerId("resolve_a", A, null), A);
  assert.equal(disputeLoserId("resolve_a", A, null), null);
});

test("resolve_b with a missing B winner → null winner (caller must 400)", () => {
  assert.equal(disputeWinnerId("resolve_b", A, null), null);
  // Loser would be A here, but the caller rejects on the null winner first.
  assert.equal(disputeLoserId("resolve_b", A, null), A);
});

test("winner and loser are always distinct for a full 2-way dispute", () => {
  for (const action of ["resolve_a", "resolve_b"] as const) {
    const w = disputeWinnerId(action, A, B);
    const l = disputeLoserId(action, A, B);
    assert.notEqual(w, l, `${action}: winner and loser must differ`);
  }
});

test("open statuses accept a decision; terminal statuses do not", () => {
  assert.ok(OPEN_DISPUTE_STATUSES.has("open"));
  assert.ok(OPEN_DISPUTE_STATUSES.has("in_review"));
  for (const terminal of [
    "resolved_a_wins",
    "resolved_b_wins",
    "resolved_held",
    "rejected_invalid",
    "resolved_auto_stale",
  ]) {
    assert.ok(
      !OPEN_DISPUTE_STATUSES.has(terminal),
      `${terminal} must require a reopen before re-resolving`,
    );
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
process.exit(0);
