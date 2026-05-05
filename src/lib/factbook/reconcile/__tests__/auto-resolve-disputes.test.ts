/**
 * Phase R.21 — `decideStaleness` unit tests.
 *
 * Run with:
 *     npx tsx src/lib/factbook/reconcile/__tests__/auto-resolve-disputes.test.ts
 *
 * Targets the pure verdict function so no DB is required. Covers the
 * staleness decision branches: still_proposed, orphaned fact-id,
 * resolver-returned-nothing, demoted-fact, current-resolver-still-emits,
 * current-resolver-no-longer-emits.
 *
 * Methodology: ~/civica/plan/disputes-triage-resolution-v1.md §2a + §2d
 */
import assert from "node:assert/strict";
import { decideStaleness } from "@/lib/factbook/reconcile/auto-resolve-disputes";

let pass = 0;
let fail = 0;

function test(name: string, fn: () => void): void {
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

console.log("auto-resolve decideStaleness tests");

test("still_proposed when resolver emits matching (kind, A, B)", () => {
  const v = decideStaleness({
    factIdA: "a-1",
    factIdB: "b-1",
    disputeKind: "material_error",
    factAStatus: "active",
    factBStatus: "active",
    resolverProposed: [
      { kind: "material_error", factIdA: "a-1", factIdB: "b-1" },
    ],
  });
  assert.equal(v.outcome, "still_proposed");
});

test("auto_resolved when resolver list omits the dispute (post-threshold-raise case)", () => {
  // Cabo Verde public_debt scenario: was 50pp threshold, now 300pp;
  // resolver no longer emits.
  const v = decideStaleness({
    factIdA: "cia-row",
    factIdB: "imf-row",
    disputeKind: "material_error",
    factAStatus: "active",
    factBStatus: "active",
    resolverProposed: [], // resolver emitted no disputes for this fact-key
  });
  assert.equal(v.outcome, "auto_resolved");
  if (v.outcome === "auto_resolved") {
    assert.match(v.reason, /resolver no longer emits/);
  }
});

test("auto_resolved when fact_id_a is null (orphan)", () => {
  const v = decideStaleness({
    factIdA: null,
    factIdB: "b-1",
    disputeKind: "material_error",
    factAStatus: null,
    factBStatus: "active",
    resolverProposed: [],
  });
  assert.equal(v.outcome, "auto_resolved");
  if (v.outcome === "auto_resolved") {
    assert.match(v.reason, /fact_id_a is null/);
  }
});

test("auto_resolved when resolver returned null (fact-key has zero active rows)", () => {
  const v = decideStaleness({
    factIdA: "a-1",
    factIdB: "b-1",
    disputeKind: "material_error",
    factAStatus: "active",
    factBStatus: "active",
    resolverProposed: null,
  });
  assert.equal(v.outcome, "auto_resolved");
  if (v.outcome === "auto_resolved") {
    assert.match(v.reason, /resolver returned no output/);
  }
});

test("auto_resolved when fact_a is demoted (manual review previously closed it)", () => {
  const v = decideStaleness({
    factIdA: "a-1",
    factIdB: "b-1",
    disputeKind: "material_error",
    factAStatus: "demoted",
    factBStatus: "active",
    resolverProposed: [
      { kind: "material_error", factIdA: "a-1", factIdB: "b-1" },
    ],
  });
  assert.equal(v.outcome, "auto_resolved");
  if (v.outcome === "auto_resolved") {
    assert.match(v.reason, /fact_a status='demoted'/);
  }
});

test("auto_resolved when fact_b is demoted", () => {
  const v = decideStaleness({
    factIdA: "a-1",
    factIdB: "b-1",
    disputeKind: "material_error",
    factAStatus: "active",
    factBStatus: "rejected",
    resolverProposed: [
      { kind: "material_error", factIdA: "a-1", factIdB: "b-1" },
    ],
  });
  assert.equal(v.outcome, "auto_resolved");
  if (v.outcome === "auto_resolved") {
    assert.match(v.reason, /fact_b status='rejected'/);
  }
});

test("kind mismatch → auto_resolved (different dispute_kind)", () => {
  const v = decideStaleness({
    factIdA: "a-1",
    factIdB: "b-1",
    disputeKind: "material_error",
    factAStatus: "active",
    factBStatus: "active",
    resolverProposed: [
      { kind: "plausibility_envelope", factIdA: "a-1", factIdB: "b-1" },
    ],
  });
  assert.equal(v.outcome, "auto_resolved");
});

test("factIdB mismatch → auto_resolved (resolver picked a different challenger)", () => {
  const v = decideStaleness({
    factIdA: "a-1",
    factIdB: "b-1",
    disputeKind: "material_error",
    factAStatus: "active",
    factBStatus: "active",
    resolverProposed: [
      // Resolver now flags a different challenger for the same A
      { kind: "material_error", factIdA: "a-1", factIdB: "b-2" },
    ],
  });
  assert.equal(v.outcome, "auto_resolved");
});

test("factIdB null on both → still_proposed (envelope-style dispute)", () => {
  // plausibility_envelope disputes have factIdB = null on both sides
  const v = decideStaleness({
    factIdA: "a-1",
    factIdB: null,
    disputeKind: "plausibility_envelope",
    factAStatus: "active",
    factBStatus: null,
    resolverProposed: [
      { kind: "plausibility_envelope", factIdA: "a-1", factIdB: null },
    ],
  });
  assert.equal(v.outcome, "still_proposed");
});

test("Marshall Islands live case — resolver still emits CIA-vs-WB", () => {
  // From DB probe: resolver currently emits 2 material_error disputes
  // for Marshall Islands population_total against WB and UN.
  const v = decideStaleness({
    factIdA: "61d80cac-f5f7-4a0a-9440-e1436ee8ca4c",
    factIdB: "4e2a5643-e6fc-4898-8a4c-0f4a608d5234",
    disputeKind: "material_error",
    factAStatus: "active",
    factBStatus: "active",
    resolverProposed: [
      {
        kind: "material_error",
        factIdA: "61d80cac-f5f7-4a0a-9440-e1436ee8ca4c",
        factIdB: "4e2a5643-e6fc-4898-8a4c-0f4a608d5234",
      },
      {
        kind: "material_error",
        factIdA: "61d80cac-f5f7-4a0a-9440-e1436ee8ca4c",
        factIdB: "0a7da6d0-3690-47d8-a6f0-6af3f2bd0957",
      },
    ],
  });
  assert.equal(v.outcome, "still_proposed");
});

console.log(`\n  ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
