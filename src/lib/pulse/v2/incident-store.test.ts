import assert from "node:assert/strict";
import test from "node:test";

import {
  PULSE_INCIDENT_ASSIGNMENT_ALGORITHM_VERSION,
  PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION,
  buildIncidentAssignmentKey,
  buildIncidentResolutionKey,
  loadActiveIncidentCandidates,
  validateIncidentAssignmentPlan,
  validateIncidentResolutionRecordPlan,
  type IncidentAssignmentPlan,
  type IncidentResolutionRecordPlan,
} from "./incident-store";
import { PULSE_INCIDENT_RESOLUTION_VERSION } from "./incident-resolution";

function assignment(): IncidentAssignmentPlan {
  const payload = {
    incidentId: "incident-a",
    rawEventId: "raw-a",
    rawClusterId: "cluster-a",
    matchKind: "persisted_match" as const,
    semanticSimilarity: 0.91,
    tokenSimilarity: 0.7,
    anchorOverlap: 1,
    exactNormalizedMatch: false,
    algorithmVersion: PULSE_INCIDENT_ASSIGNMENT_ALGORITHM_VERSION,
    embeddingModel: "fixture-embedding",
    fallbackMode: "semantic" as const,
    stageRunId: "run-a",
    actor: { type: "pipeline", name: "fixture" },
    rationale: "Strong semantic and identity-anchor match.",
    assignedAt: "2026-07-12T12:00:00.000Z",
  };
  return {
    schemaVersion: PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION,
    assignmentKey: buildIncidentAssignmentKey(payload),
    ...payload,
  };
}

function resolution(): IncidentResolutionRecordPlan {
  const payload = {
    leftIncidentId: "incident-b",
    rightIncidentId: "incident-a",
    outcome: "candidate" as const,
    canonicalIncidentId: null,
    signals: { semanticSimilarity: 0.94, exactNormalizedMatch: false },
    methodVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
    stageRunId: "run-a",
    actor: { type: "pipeline", name: "fixture" },
    rationale: "Candidate retained for controlled review.",
    evidenceRefs: ["raw:b", "raw:a", "raw:a"],
    decidedAt: "2026-07-12T12:00:00.000Z",
  };
  return {
    schemaVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
    resolutionKey: buildIncidentResolutionKey(payload),
    ...payload,
  };
}

test("assignment keys are deterministic and payload-bound", () => {
  const plan = assignment();
  assert.match(plan.assignmentKey, /^pulse-incident-assignment\/sha256:[a-f0-9]{64}$/);
  assert.equal(buildIncidentAssignmentKey(plan), plan.assignmentKey);
  validateIncidentAssignmentPlan(plan);
  assert.throws(
    () => validateIncidentAssignmentPlan({ ...plan, rawEventId: "raw-b" }),
    /key does not match/,
  );
});

test("resolution keys canonicalize pair order and evidence references", () => {
  const plan = resolution();
  assert.match(plan.resolutionKey, /^pulse-incident-resolution\/sha256:[a-f0-9]{64}$/);
  assert.equal(
    buildIncidentResolutionKey({
      ...plan,
      leftIncidentId: plan.rightIncidentId,
      rightIncidentId: plan.leftIncidentId,
      evidenceRefs: ["raw:a", "raw:b"],
    }),
    plan.resolutionKey,
  );
  validateIncidentResolutionRecordPlan(plan);
});

test("resolution validation prevents a candidate record from applying a merge", () => {
  const plan = resolution();
  assert.throws(
    () =>
      validateIncidentResolutionRecordPlan({
        ...plan,
        canonicalIncidentId: plan.leftIncidentId,
      }),
    /only a confirmed merge/,
  );
});

test("fixture loading prefers the current event projection and falls back to retained incident evidence", async () => {
  const candidates = await loadActiveIncidentCandidates({} as never, {
    windowStart: "2026-07-10T00:00:00.000Z",
    windowEnd: "2026-07-10T23:59:59.999Z",
    rows: [
      {
        incidentId: "incident-current",
        representativeTitle: "Old representative title",
        eventDateStart: "2026-07-10",
        eventDateEnd: "2026-07-10",
        representativeEmbedding: [1, 0],
        incidentCreatedAt: "2026-07-10T01:00:00.000Z",
        eventId: "event-current",
        clusterId: "cluster-current",
        jurisdictionId: "country-a",
        eventDate: "2026-07-10",
        headline: "Reviewed current title",
        description: "Current event description",
        published: true,
        humanReviewed: true,
        reviewStatus: "approved",
        category: "court_ruling",
        dimension: "rol",
        severityTier: "moderate_pos",
        eventCreatedAt: "2026-07-10T02:00:00.000Z",
        sourceCount: 3,
      },
      {
        incidentId: "incident-unclassified",
        representativeTitle: "Retained representative title",
        eventDateStart: "2026-07-09",
        eventDateEnd: "2026-07-09",
        representativeEmbedding: null,
        incidentCreatedAt: "2026-07-09T01:00:00.000Z",
        eventId: null,
        clusterId: null,
        jurisdictionId: null,
        eventDate: null,
        headline: null,
        description: null,
        published: null,
        humanReviewed: null,
        reviewStatus: null,
        category: null,
        dimension: null,
        severityTier: null,
        eventCreatedAt: null,
        rawFallback: {
          jurisdictionId: "country-b",
          eventDate: "2026-07-09",
          title: "Retained raw title",
          body: "Retained raw body",
          clusterId: "cluster-unclassified",
        },
        sourceCount: 1,
      },
    ],
  });
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].headline, "Reviewed current title");
  assert.equal(candidates[0].clusterId, "cluster-current");
  assert.equal(candidates[0].reviewStatus, "human_current");
  assert.equal(candidates[0].direction, "positive");
  assert.equal(candidates[1].headline, "Retained raw title");
  assert.equal(candidates[1].eventId, null);
  assert.equal(candidates[1].clusterId, "cluster-unclassified");
  assert.equal(candidates[1].reviewStatus, "unreviewed");
});

test("candidate windows and invalid similarity plans fail closed", async () => {
  await assert.rejects(
    loadActiveIncidentCandidates({} as never, {
      windowStart: "2026-07-12T00:00:00Z",
      windowEnd: "2026-07-11T00:00:00Z",
      rows: [],
    }),
    /must not follow/,
  );
  const plan = assignment();
  assert.throws(
    () => validateIncidentAssignmentPlan({ ...plan, tokenSimilarity: 1.1 }),
    /between 0 and 1/,
  );
});
