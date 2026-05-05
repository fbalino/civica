/**
 * Phase R.23.1 — public dispute feed redaction tests.
 *
 * Run with:
 *     npx tsx src/lib/db/__tests__/public-disputes-redaction.test.ts
 *
 * Targets the pure helpers exposed for the public-facing
 * /factbook/methodology/reconciliation/disputes page:
 *   - mapStatusToPublicBucket — deterministic raw-status → 3-bucket map
 *   - AUTO_RESOLVE_ACTOR_ID + REVIEWER_REDACTION_LABEL — sentinel values
 *     used by the audit-log helper to redact human-reviewer ids while
 *     preserving the system-action label
 *   - PUBLIC_DISPUTE_STATUS_BUCKETS / _LABELS shape — used by the page
 *     to build chip rows; ordering and presence are load-bearing
 *
 * No DB required. The DB-touching helpers (`getPublicDisputeFeed`,
 * `getPublicAuditLogForDispute`, `getPublicDisputeFilterDistributions`)
 * are exercised in the live spot-check on the page itself.
 *
 * Methodology: ~/civica/plan/disputes-triage-resolution-v1.md §2c
 *              + R.23.1 brief Q1 (visibility / redaction).
 */
import assert from "node:assert/strict";
import {
  mapStatusToPublicBucket,
  AUTO_RESOLVE_ACTOR_ID,
  REVIEWER_REDACTION_LABEL,
  PUBLIC_DISPUTE_STATUS_BUCKETS,
  PUBLIC_DISPUTE_STATUS_LABELS,
  type PublicDisputeStatusBucket,
} from "@/lib/db/queries-data-disputes";

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

console.log("public-disputes-redaction tests");

test("mapStatusToPublicBucket — open + in_review fold to 'open'", () => {
  assert.equal(mapStatusToPublicBucket("open"), "open");
  assert.equal(mapStatusToPublicBucket("in_review"), "open");
});

test("mapStatusToPublicBucket — auto-resolve has its own bucket", () => {
  assert.equal(
    mapStatusToPublicBucket("resolved_auto_stale"),
    "auto_resolved",
  );
});

test("mapStatusToPublicBucket — manual resolutions fold to 'resolved'", () => {
  assert.equal(mapStatusToPublicBucket("resolved_a_wins"), "resolved");
  assert.equal(mapStatusToPublicBucket("resolved_b_wins"), "resolved");
  assert.equal(mapStatusToPublicBucket("resolved_held"), "resolved");
  assert.equal(mapStatusToPublicBucket("rejected_invalid"), "resolved");
});

test("mapStatusToPublicBucket — unknown status defaults to 'resolved'", () => {
  // Defensive: a future status enum addition shouldn't 500 the page.
  // Defaulting to 'resolved' is safe because the alternative ('open')
  // would surface unfinished review state to the public, and 'resolved'
  // simply means "not actionable here." A genuinely-unknown status is
  // a DB anomaly; logging would handle that case better but is out of
  // scope for the redaction layer.
  assert.equal(mapStatusToPublicBucket("future_status_value"), "resolved");
});

test("AUTO_RESOLVE_ACTOR_ID matches the cron's reviewer id", () => {
  // Stays in lockstep with `auto-resolve-disputes.ts` AUTO_RESOLVE_REVIEWER_ID.
  // If the cron renames its actor id, this test fails — and the public
  // audit log would silently start redacting auto-resolve rows as if
  // they were human reviewers.
  assert.equal(AUTO_RESOLVE_ACTOR_ID, "system_auto_resolve");
});

test("REVIEWER_REDACTION_LABEL is human-readable, no PII shape", () => {
  // Must not contain @, /, or anything that looks like a reviewer
  // handle. The page renders this string verbatim.
  assert.equal(REVIEWER_REDACTION_LABEL, "Civica reviewer");
  assert.doesNotMatch(REVIEWER_REDACTION_LABEL, /@|\.|\//);
});

test("PUBLIC_DISPUTE_STATUS_BUCKETS shape — open, resolved, auto_resolved", () => {
  // Order is load-bearing for chip layout: open chips first (active
  // workload), then resolved (manual outcomes), then auto-resolved
  // (system disposal). Adding new buckets requires a UI review.
  assert.deepEqual(
    [...PUBLIC_DISPUTE_STATUS_BUCKETS],
    ["open", "resolved", "auto_resolved"],
  );
});

test("PUBLIC_DISPUTE_STATUS_LABELS — every bucket has a label", () => {
  for (const b of PUBLIC_DISPUTE_STATUS_BUCKETS) {
    const label = PUBLIC_DISPUTE_STATUS_LABELS[b as PublicDisputeStatusBucket];
    assert.ok(typeof label === "string" && label.length > 0, `missing label for ${b}`);
  }
});

console.log(`\n  ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
