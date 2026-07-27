/**
 * QA-007 — Pulse decay + classification-metric golden.
 *
 * Locks the EXACT numeric outputs of the published Pulse scoring
 * calculations against fixed synthetic inputs. Values were captured by
 * running the real production functions, not hand-derived, then verified
 * against the closed-form decay identity where one exists.
 *
 * Source of truth:
 *   - `decayedImpact` / `daysSince` (src/lib/pulse/v2/decay.ts)
 *   - `HALF_LIFE_DAYS` via `halfLifeFor` (src/lib/pulse/v2/taxonomy.ts)
 *   - `clampSeverityToTier` (src/lib/pulse/v2/ensemble.ts) — the
 *     classification-severity metric that maps a raw model severity into
 *     the tier's numeric range
 *   - `calculateDimensionalDeltas` (src/lib/pulse/v2/score.ts) — end-to-end
 *     dimensional deltaValue
 *
 * Pure: no DB, no network (the scorer runs in `dryRun` with preloaded
 * fixture events and a fixed `now`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { decayedImpact, daysSince } from "./decay";
import { clampSeverityToTier } from "./ensemble";
import { calculateDimensionalDeltas, type PublishedEvent } from "./score";
import { pulseDeltaVersionEnvelope } from "./versioning";

const LN2 = Math.LN2;

// ── decayedImpact: impact = severity × confidence × exp(-ln2·days/halfLife) ─
test("decay golden: named severity-tier / day-offset combinations reproduce exact deltas", () => {
  // coup half-life = 365 days.
  // day 0  -> exp(0)=1  -> -9 × 0.8 × 1   = -7.2
  assert.equal(decayedImpact(-9, 0.8, 0, "coup"), -7.2);
  // day 365 (exactly one half-life) -> exp(-ln2)=0.5 -> -7.2 × 0.5 = -3.6
  assert.equal(decayedImpact(-9, 0.8, 365, "coup"), -3.6);

  // journalist_arrest half-life = 60 days.
  // day 0   -> -5 × 0.7 × 1   = -3.5
  assert.equal(decayedImpact(-5, 0.7, 0, "journalist_arrest"), -3.5);
  // day 60 (one half-life) -> -3.5 × 0.5 = -1.75
  assert.equal(decayedImpact(-5, 0.7, 60, "journalist_arrest"), -1.75);

  // fair_election half-life = 90 days, positive tier.
  // day 45 (half a half-life) -> 5 × 0.9 × exp(-0.5·ln2) = 3.181980515339464
  assert.equal(decayedImpact(5, 0.9, 45, "fair_election"), 3.181980515339464);

  // Cross-check the day-45 value against the closed-form identity.
  assert.ok(Math.abs(decayedImpact(5, 0.9, 45, "fair_election") - 5 * 0.9 * Math.exp(-LN2 * 45 / 90)) < 1e-12);
});

test("decay golden: an unknown category falls back to the 90-day half-life", () => {
  // 90-day default: day 90 -> exp(-ln2) = 0.5.
  assert.equal(decayedImpact(-4, 1, 90, "not_a_real_category"), -2);
});

test("daysSince golden: UTC-floored, non-negative day counts", () => {
  assert.equal(daysSince("2026-01-01", new Date("2026-07-12T12:00:00Z")), 192);
  assert.equal(daysSince("2026-07-12", new Date("2026-07-12T00:00:00Z")), 0);
  // Future event date floors to 0, never negative.
  assert.equal(daysSince("2027-01-01", new Date("2026-07-12T00:00:00Z")), 0);
});

// ── clampSeverityToTier: classification-severity metric ────────────────────
test("classification-metric golden: clampSeverityToTier bounds + rounds into the tier range", () => {
  // catastrophic_neg range [-10,-8]: below the floor clamps up to -10.
  assert.equal(clampSeverityToTier(-12, "catastrophic_neg"), -10);
  // in-range value is preserved.
  assert.equal(clampSeverityToTier(-9, "catastrophic_neg"), -9);
  // moderate_pos range [3,4]: 3.6 rounds to 4.
  assert.equal(clampSeverityToTier(3.6, "moderate_pos"), 4);
  // low_neg range [-2,-1]: -9 clamps up to -2.
  assert.equal(clampSeverityToTier(-9, "low_neg"), -2);
});

// ── calculateDimensionalDeltas: end-to-end dimensional deltaValue ──────────
test("score golden: calculateDimensionalDeltas produces exact per-dimension deltaValues", async () => {
  const envelope = pulseDeltaVersionEnvelope([], []).envelope;
  const now = new Date("2026-07-12T00:00:00Z");
  const events: PublishedEvent[] = [
    {
      id: "evt-coup", jurisdictionId: "j-coup", dimension: "stability", category: "coup",
      severityTier: "catastrophic_neg", severityValue: -9, corroborationConfidence: 0.8,
      eventDate: "2026-07-12", derivationVersions: envelope, sourceIds: ["s1"],
      publicationRunId: "pub-1", corroborationRunId: "cor-1", absorptionDecisionKey: null, absorptionOutcome: null,
    },
    {
      id: "evt-jarrest", jurisdictionId: "j-coup", dimension: "freedom_rights", category: "journalist_arrest",
      severityTier: "severe_neg", severityValue: -5, corroborationConfidence: 0.7,
      eventDate: "2026-05-13", derivationVersions: envelope, sourceIds: ["s2"],
      publicationRunId: "pub-2", corroborationRunId: "cor-2", absorptionDecisionKey: null, absorptionOutcome: null,
    },
  ];

  const summary = await calculateDimensionalDeltas(null as never, {
    dryRun: true, events, existingJurisdictionIds: [], now,
  });

  const byKey = new Map(summary.planned.map((p) => [`${p.jurisdictionId}::${p.dimension}`, p]));
  // coup on the day it happened -> full decayedImpact -7.2 (within the [-15,10] clamp).
  assert.equal(byKey.get("j-coup::stability")?.deltaValue, -7.2);
  assert.deepEqual(byKey.get("j-coup::stability")?.contributingEventIds, ["evt-coup"]);
  // journalist_arrest exactly one half-life (60 days) earlier -> -1.75.
  assert.equal(byKey.get("j-coup::freedom_rights")?.deltaValue, -1.75);
  assert.deepEqual(byKey.get("j-coup::freedom_rights")?.contributingEventIds, ["evt-jarrest"]);
  // Dimensions with no event decay to exactly 0.
  assert.equal(byKey.get("j-coup::democratic_quality")?.deltaValue, 0);
  assert.equal(byKey.get("j-coup::rule_of_law")?.deltaValue, 0);
  assert.equal(byKey.get("j-coup::corruption_control")?.deltaValue, 0);
});
