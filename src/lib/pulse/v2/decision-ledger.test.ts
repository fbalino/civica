import assert from "node:assert/strict";
import test from "node:test";

import {
  PULSE_DECISION_KINDS,
  createPulseDecision,
  refutePulseDecision,
  reviewsFromVerifier,
} from "./decision-ledger";

const base = {
  clusterId: "11111111-1111-4111-8111-111111111111",
  eventId: "22222222-2222-4222-8222-222222222222",
  actor: {
    type: "classifier" as const,
    provider: "anthropic",
    model: "fixture",
    reviewerId: null,
  },
  stageRunId: "33333333-3333-4333-8333-333333333333",
  methodVersion: "pulse-v2.7-beta",
  rationale: "fixture decision",
  evidenceRefs: ["source-b", "source-a", "source-a"],
  decidedAt: "2026-07-11T20:00:00.000Z",
};

test("decision identity is deterministic and evidence-order invariant", () => {
  const first = createPulseDecision({
    ...base,
    kind: "category_labels",
    verdict: "affirmed",
    payload: {
      categoryIds: ["fair_election"],
      dimensionIds: ["democratic_quality"],
    },
  });
  const second = createPulseDecision({
    ...base,
    evidenceRefs: ["source-a", "source-b"],
    kind: "category_labels",
    verdict: "affirmed",
    payload: {
      categoryIds: ["fair_election"],
      dimensionIds: ["democratic_quality"],
    },
  });
  assert.equal(first.decisionKey, second.decisionKey);
  assert.deepEqual(first.evidenceRefs, ["source-a", "source-b"]);
  assert.equal("confidence" in first, false);
});

test("the verifier evaluates four axes independently", () => {
  const reviews = reviewsFromVerifier({
    verdict: "revised",
    confidence: "low",
    categoryOk: false,
    severityOk: true,
    subjectOk: false,
    isEvent: true,
    rationale: "category and subject are unsupported",
  });
  assert.deepEqual(
    Object.fromEntries(reviews.map((review) => [review.kind, review.verdict])),
    {
      event_existence: "affirmed",
      subject_attribution: "refuted",
      category_labels: "refuted",
      severity: "affirmed",
    },
  );
});

test("every decision kind can be refuted without changing another axis", () => {
  for (const kind of PULSE_DECISION_KINDS) {
    const target = createPulseDecision({
      ...base,
      kind,
      verdict: "unresolved",
      payload:
        kind === "event_existence"
          ? { disposition: "unresolved" }
          : kind === "subject_attribution"
            ? {
                status: "unresolved",
                primaryJurisdictionId: null,
                affectedJurisdictionIds: [],
              }
            : kind === "category_labels"
              ? { categoryIds: [], dimensionIds: [] }
              : kind === "severity"
                ? { tier: null, value: null, direction: "unknown" }
                : kind === "calibration"
                  ? {
                      standing: "not_calibrated",
                      signals: ["legacy_classifier_agreement"],
                      targetDecisionKinds: ["category_labels"],
                      validationReleaseId: null,
                    }
                  : kind === "corroboration"
                    ? {
                        independentEvidenceGroups: null,
                        contributingReports: null,
                        confidenceWeight: null,
                        calibrationStanding: "heuristic_not_probability",
                      }
                    : {
                        eligible: false,
                        origin: "queued",
                        gateReasons: ["unresolved"],
                      },
    });
    const refutation = refutePulseDecision({
      target,
      actor: {
        type: "human_reviewer",
        provider: null,
        model: null,
        reviewerId: "reviewer",
      },
      stageRunId: "44444444-4444-4444-8444-444444444444",
      methodVersion: "pulse-review/decision-ledger-v1",
      rationale: `refuted ${kind}`,
      decidedAt: "2026-07-11T21:00:00.000Z",
    });
    assert.equal(refutation.kind, kind);
    assert.equal(refutation.verdict, "refuted");
    assert.equal(refutation.supersedesDecisionKey, target.decisionKey);
  }
});

test("corroboration is explicitly heuristic rather than probability", () => {
  assert.throws(
    () =>
      createPulseDecision({
        ...base,
        kind: "corroboration",
        verdict: "affirmed",
        payload: {
          independentEvidenceGroups: 2,
          contributingReports: 3,
          confidenceWeight: 0.8,
          calibrationStanding: "probability" as "heuristic_not_probability",
        },
      }),
    /heuristic standing/,
  );
});
