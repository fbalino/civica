import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import { resolveCiRelease, type CiReleaseContract } from "@/lib/ci/release-selection";
import {
  assessEventAbsorption,
  comparableFixedScaleReleaseReasons,
  parseExplicitAbsorptionLinks,
  type AbsorptionAssessmentInput,
} from "./absorption";
import { decoupleAbsorbedEvents } from "./decouple";

type Db = NeonHttpDatabase<typeof schema>;

const previous = resolveCiRelease("ci-beta-r5-2024-Q4");
const current: CiReleaseContract = {
  ...previous,
  releaseId: "ci-beta-r5-2025-Q4",
  quarter: "2025-Q4",
  vintageLabel: "Civica Index 2025 Q4 (fixture)",
  series: {
    ...previous.series,
    releaseId: "ci-beta-r5-2025-Q4",
    observationPeriodStart: "2025-Q4",
    observationPeriodEnd: "2025-Q4",
    calculatedAt: "2026-12-01T00:00:00.000Z",
    citationLabel: "Fixture fixed-scale successor",
  },
};

const base: AbsorptionAssessmentInput = {
  event: {
    id: "event-1",
    jurisdictionId: "jurisdiction-1",
    dimension: "rule_of_law",
    eventDate: "2025-03-01",
    severityValue: -4,
  },
  previousRelease: previous,
  currentRelease: current,
  previousScore: 61,
  currentScore: 56,
  link: {
    eventId: "event-1",
    jurisdictionId: "jurisdiction-1",
    dimension: "rule_of_law",
    currentReleaseId: "ci-beta-r5-2025-Q4",
    standing: "confirmed",
    actorType: "human_reviewer",
    linkMethodVersion: "pulse-ci-link/manual-review-v1",
    rationale: "The source-native observation explicitly incorporates the institutional change recorded by this event.",
    evidenceRefs: [
      "pulse-event:event-1",
      "ci-observation:ci-beta-r5-2025-Q4:jurisdiction-1:rule_of_law",
    ],
  },
  asOf: "2026-12-01",
};

test("a confirmed event link and comparable fixed-scale release can support absorption", () => {
  const result = assessEventAbsorption(base);
  assert.equal(result.outcome, "absorbed");
  assert.equal(result.scoreDelta, -5);
  assert.deepEqual(result.reasons, []);
  assert.match(result.absorptionKey, /^pulse-absorption\/sha256:[a-f0-9]{64}$/);
});

test("same-period and changed-scale releases fail closed", () => {
  assert.ok(
    comparableFixedScaleReleaseReasons(previous, previous, "rule_of_law").includes(
      "nonsequential_observation_period",
    ),
  );
  const changedScale = {
    ...current,
    displayTransformVersion: "ci-display/relative-ranks-v2",
  };
  const result = assessEventAbsorption({ ...base, currentRelease: changedScale });
  assert.equal(result.outcome, "not_absorbed");
  assert.ok(result.reasons.includes("display_transform_changed"));
  assert.ok(result.reasons.includes("scale_not_declared_fixed"));
});

test("aggregate movement without a confirmed explicit link cannot absorb an event", () => {
  const result = assessEventAbsorption({
    ...base,
    link: { ...base.link, standing: "candidate", actorType: "model_candidate" },
  });
  assert.equal(result.outcome, "not_absorbed");
  assert.ok(result.reasons.includes("link_not_confirmed"));
  assert.ok(result.reasons.includes("model_candidate_cannot_confirm_link"));
});

test("opposite-direction movement cannot absorb the linked event", () => {
  const result = assessEventAbsorption({ ...base, currentScore: 67 });
  assert.equal(result.outcome, "not_absorbed");
  assert.ok(result.reasons.includes("movement_direction_mismatch"));
});

test("identical evidence produces a stable decision key", () => {
  const first = assessEventAbsorption(base);
  const second = assessEventAbsorption({
    ...base,
    link: { ...base.link, evidenceRefs: [...base.link.evidenceRefs].reverse() },
  });
  assert.equal(first.absorptionKey, second.absorptionKey);
});

test("the current same-period backcast set cannot absorb any event", async () => {
  let writes = 0;
  const result = await decoupleAbsorbedEvents(
    {} as Db,
    "ci-beta-r5-2024-Q4",
    {
      links: [
        { ...base.link, currentReleaseId: "ci-beta-r5-2024-Q4" },
      ],
      write: async () => {
        writes++;
      },
    },
  );
  assert.equal(result.noComparableRelease, true);
  assert.equal(result.explicitLinksExamined, 1);
  assert.equal(result.decisionsPlanned, 0);
  assert.equal(result.eventsZeroed, 0);
  assert.equal(writes, 0);
});

test("reviewed link input fails closed on unsupported or incomplete rows", () => {
  assert.deepEqual(parseExplicitAbsorptionLinks([base.link]), [base.link]);
  assert.throws(
    () =>
      parseExplicitAbsorptionLinks([
        { ...base.link, dimension: "stability", evidenceRefs: [] },
      ]),
    /unsupported dimension/,
  );
});
